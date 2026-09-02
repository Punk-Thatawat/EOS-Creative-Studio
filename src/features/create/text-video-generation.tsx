"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Dropdown } from "@/components/ui/dropdown";
import { CloudUpload, Info, Mic2, RotateCcw, WandSparkles, X } from "lucide-react";
import { EosVideoPlayer } from "@/components/media/eos-video-player";
import { ModelPreviewMedia } from "./model-preview-media";
import { listGenerationModels, type GenerationModelOption } from "@/lib/api/generation-models";
import { uploadImageAsset } from "@/lib/api/storage";
import { uploadPeopleMedia } from "@/lib/api/people-video-generations";
import {
  cancelTextVideoGeneration,
  createTextVideoGeneration,
  getTextVideoGenerationStatus,
  type TextVideoGenerationInput,
  type TextVideoGenerationResponse,
  type TextVideoGenerationStatus,
} from "@/lib/api/text-video-generations";
import { VideoResultLibrary } from "./video-result-library";
import { VideoPreviewOverlayActions, VideoPreviewPlaceholder } from "./video-preview-placeholder";
import { DurationControl } from "./components/duration-control";
import { emitGenerationStarted } from "@/lib/generation-progress-events";
import { validateMediaFile } from "@/lib/media/upload-validation";
import { useVideoCreditEstimate, VideoCreditEstimate } from "./components/video-credit-estimate";
import styles from "./video-generation-page.module.css";
import { VideoModelDropdown } from "./video-model-dropdown";
import { PromptOptimizerToggle } from "./image-generation/components/prompt-optimizer-toggle";

type SchemaProperty = {
  type?: string;
  title?: string;
  description?: string;
  default?: unknown;
  enum?: unknown[];
  minimum?: number;
  maximum?: number;
  step?: number;
  format?: string;
  items?: { type?: string; [key: string]: unknown };
  [key: string]: unknown;
};

type TextVideoStatus = "idle" | "uploading" | "processing" | "completed" | "failed" | "cancelled";

const textCoreParameterNames = new Set([
  "prompt",
  "text_prompt",
  "textPrompt",
  "positive_prompt",
  "positivePrompt",
  "instruction",
  "negativePrompt",
  "negative_prompt",
  "duration",
  "duration_seconds",
  "durationSeconds",
  "resolution",
  "aspectRatio",
  "aspect_ratio",
  "fps",
  "frameRate",
  "frame_rate",
  "seed",
  "generateAudio",
  "generate_audio",
  "audio",
  "audio_enabled",
  "cameraMotion",
  "camera_motion",
  "cameraMovement",
  "camera_movement",
  "image",
  "image_url",
  "imageUrl",
  "input_image",
  "inputImage",
  "referenceImage",
  "reference_image",
  "referenceImages",
  "reference_images",
]);

const textTutorials = [
  { title: "Quick Start Guide", subtitle: "", duration: "2:15", image: "/generated-assets/style-cinematic.png" },
  { title: "Prompt Like a Pro", subtitle: "Writing Better Prompts", duration: "4:08", image: "/generated-assets/recent-6.png" },
  { title: "Shot Magic", subtitle: "Camera & Movement Tips", duration: "3:42", image: "/generated-assets/recent-2.png" },
  { title: "Lipsync 101", subtitle: "Make It Talk", duration: "3:05", image: "/generated-assets/recent-5.png" },
  { title: "Sound On", subtitle: "Add Audio & Ambience", duration: "2:58", image: "/generated-assets/preview-live.png" },
];

function schemaProperties(model: GenerationModelOption | undefined): Record<string, SchemaProperty> {
  const properties = (model?.capabilities.apiSchema?.request_schema?.properties ?? {}) as Record<string, SchemaProperty>;
  if (Object.keys(properties).length) return properties;
  return Object.fromEntries((model?.capabilities.parameters ?? []).map((name) => [name, { type: "string" }]));
}

function requiredSchemaParameters(model: GenerationModelOption | undefined): string[] {
  return model?.capabilities.apiSchema?.request_schema?.required ?? model?.capabilities.requiredParameters ?? [];
}

function schemaDefault(property: SchemaProperty | undefined): unknown {
  if (!property) return undefined;
  if (property.default !== undefined) return property.default;
  if (property.enum?.length) return property.enum[0];
  if (property.type === "boolean") return false;
  return undefined;
}

function findSchemaProperty(properties: Record<string, SchemaProperty>, names: string[]): [string, SchemaProperty] | undefined {
  for (const name of names) {
    if (properties[name]) return [name, properties[name]];
  }
  return undefined;
}

function labelFromParameterName(name: string): string {
  return name.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function hasValue(value: unknown): boolean {
  return value !== undefined && value !== null && value !== "" && (!Array.isArray(value) || value.length > 0);
}

function modelParameterDefaults(model: GenerationModelOption | undefined): Record<string, unknown> {
  const properties = schemaProperties(model);
  const capabilities = model?.capabilities;
  const params: Record<string, unknown> = {};
  for (const [name, property] of Object.entries(properties)) {
    if (textCoreParameterNames.has(name) || name === capabilities?.promptParameter || name === capabilities?.negativePromptParameter || name === capabilities?.imageParameter || name === capabilities?.referenceImagesParameter) continue;
    const value = schemaDefault(property);
    if (value !== undefined) params[name] = value;
  }
  return params;
}

function parseSchemaValue(rawValue: string, property: SchemaProperty, enumValues?: unknown[]): unknown {
  if (enumValues) return enumValues.find((value) => String(value) === rawValue) ?? rawValue;
  if (property.type === "integer") return rawValue === "" ? undefined : Number.parseInt(rawValue, 10);
  if (property.type === "number") return rawValue === "" ? undefined : Number(rawValue);
  return rawValue === "" ? undefined : rawValue;
}

function TextSchemaField({
  name,
  property,
  value,
  required,
  onChange,
  labelOverride,
  choices = false,
}: {
  name: string;
  property: SchemaProperty;
  value: unknown;
  required?: boolean;
  onChange: (value: unknown) => void;
  labelOverride?: string;
  choices?: boolean;
}) {
  const label = labelOverride ?? property.title ?? labelFromParameterName(name);
  const type = property.type ?? (property.enum ? "string" : typeof property.default === "boolean" ? "boolean" : typeof property.default === "number" ? "number" : "string");
  if (labelOverride === "Duration") {
    return <DurationControl property={property} value={value} required={required} onChange={(nextValue) => onChange(nextValue)} />;
  }
  if (choices && property.enum?.length) {
    return (
      <div className={styles.settingBlock}>
        <div className={styles.settingLabel}>{label} {required ? <b>*</b> : null}</div>
        <div className={styles.ratios}>
          {property.enum.map((option) => (
            <button
              key={String(option)}
              type="button"
              className={String(value) === String(option) ? styles.ratioSelected : ""}
              onClick={() => onChange(option)}
            >
              {String(option)}
            </button>
          ))}
        </div>
      </div>
    );
  }
  if (property.enum?.length) {
    return (
      <label className={styles.dynamicField}>
        <span>{label}{required ? <b>*</b> : null}</span>
        <Dropdown
          value={value === undefined ? "" : String(value)}
          options={[
            ...(!required ? [{ value: "", label: "Auto" }] : []),
            ...property.enum.map((option) => ({ value: String(option), label: String(option) })),
          ]}
          onChange={(nextValue) => onChange(parseSchemaValue(nextValue, property, property.enum))}
          ariaLabel={label}
          placeholder="Auto"
          className={styles.dynamicDropdown}
          triggerClassName={styles.dynamicSelect}
          menuClassName={styles.dynamicDropdownMenu}
          optionClassName={styles.dynamicDropdownOption}
        />
        {property.description ? <small>{property.description}</small> : null}
      </label>
    );
  }
  if (type === "boolean") {
    return (
      <div className={styles.toggleRow}>
        {label}{required ? <b>*</b> : null}
        <button type="button" className={styles.toggle} aria-pressed={Boolean(value)} onClick={() => onChange(!Boolean(value))}><i /></button>
      </div>
    );
  }
  if (type === "array" || type === "object") {
    return (
      <label className={styles.dynamicField}>
        <span>{label}{required ? <b>*</b> : null}</span>
        <textarea
          className={styles.dynamicInput}
          value={value === undefined ? "" : Array.isArray(value) ? value.join(", ") : typeof value === "object" ? JSON.stringify(value) : String(value)}
          placeholder={type === "array" ? "Add values separated by commas" : "{}"}
          onChange={(event) => onChange(type === "array" ? event.target.value.split(",").map((item) => item.trim()).filter(Boolean) : event.target.value)}
          aria-required={required}
        />
      </label>
    );
  }
  const isNumber = type === "number" || type === "integer";
  if (isNumber && property.minimum !== undefined && property.maximum !== undefined) {
    return (
      <div className={styles.settingBlock}>
        <div className={styles.settingLabel}>{label} {required ? <b>*</b> : null}<strong>{value === undefined ? "Auto" : String(value)}</strong></div>
        <input
          type="range"
          min={property.minimum}
          max={property.maximum}
          step={property.step ?? (type === "integer" ? 1 : 0.01)}
          value={typeof value === "number" ? value : property.minimum}
          onChange={(event) => onChange(parseSchemaValue(event.target.value, property))}
          aria-label={label}
        />
        <div className={styles.rangeLabels}><span>{property.minimum}</span><span>{property.maximum}</span></div>
      </div>
    );
  }
  return (
    <label className={styles.dynamicField}>
      <span>{label}{required ? <b>*</b> : null}</span>
      <input
        className={styles.dynamicInput}
        type={isNumber ? "number" : "text"}
        value={value === undefined ? "" : String(value)}
        min={property.minimum}
        max={property.maximum}
        step={property.step ?? (type === "integer" ? 1 : "any")}
        onChange={(event) => onChange(parseSchemaValue(event.target.value, property))}
        aria-required={required}
      />
      {property.description ? <small>{property.description}</small> : null}
    </label>
  );
}

function textVideoProgress(status: TextVideoGenerationStatus, fallback: number): number {
  if (typeof status.progress === "number") return Math.max(0, Math.min(100, status.progress <= 1 ? status.progress * 100 : status.progress));
  if (typeof status.totalCount === "number" && status.totalCount > 0 && typeof status.completedCount === "number") return Math.round((status.completedCount / status.totalCount) * 100);
  if (status.status === "completed") return 100;
  return fallback;
}

function outputVideoUrl(payload: TextVideoGenerationResponse | TextVideoGenerationStatus): string | null {
  const output = Array.isArray(payload.output) ? payload.output : [];
  const firstUrl = output.find((item) => typeof item?.url === "string" && item.url)?.url;
  if (typeof firstUrl === "string") return firstUrl;
  if (typeof payload.finalVideoUrl === "string" && payload.finalVideoUrl) return payload.finalVideoUrl;
  if (typeof payload.videoUrl === "string" && payload.videoUrl) return payload.videoUrl;
  return null;
}

function TextVideoTutorials() {
  return (
    <section className={styles.tutorials}>
      <div className={styles.tutorialTitle}>
        <h2>TUTORIAL &amp; IDEAS</h2>
        <a href="#tutorials">View all tutorials →</a>
      </div>
      <div className={styles.tutorialRow}>
        {textTutorials.map((item) => (
          <button type="button" key={item.title}>
            <Image src={item.image} alt="" width={130} height={55} className="h-[55px] w-full object-cover" />
            <b>{item.title}</b>
            {item.subtitle ? <small>{item.subtitle}</small> : null}
            <time>{item.duration}</time>
          </button>
        ))}
        <button type="button" className={styles.inspirationCard}>
          <b>NEED INSPIRATION?</b>
          <span>Explore Templates</span>
          <i>→</i>
        </button>
      </div>
    </section>
  );
}

export function TextToVideoWorkspace() {
  const [models, setModels] = useState<GenerationModelOption[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [modelsLoading, setModelsLoading] = useState(true);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [promptOptimizerEnabled, setPromptOptimizerEnabled] = useState(false);
  const [negativePrompt, setNegativePrompt] = useState("");
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [referenceImageFile, setReferenceImageFile] = useState<File | null>(null);
  const [durationValue, setDurationValue] = useState<unknown>(5);
  const [resolutionValue, setResolutionValue] = useState<unknown>("720p");
  const [aspectRatioValue, setAspectRatioValue] = useState<unknown>("16:9");
  const [fpsValue, setFpsValue] = useState<unknown>(undefined);
  const [seedValue, setSeedValue] = useState<unknown>(-1);
  const [cameraMotionValue, setCameraMotionValue] = useState<unknown>(undefined);
  const [audioValue, setAudioValue] = useState<unknown>(true);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [modelParams, setModelParams] = useState<Record<string, unknown>>({});
  const [generationStatus, setGenerationStatus] = useState<TextVideoStatus>("idle");
  const [generationProgress, setGenerationProgress] = useState(0);
  const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null);
  const [previewVideoUrl, setPreviewVideoUrl] = useState<string | null>(null);
  const [libraryRefreshKey, setLibraryRefreshKey] = useState(0);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const referenceImageInputRef = useRef<HTMLInputElement | null>(null);
  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const jobRef = useRef<{ id: string; workspaceId?: string; pollUrl: string } | null>(null);

  const selectedModelOption = models.find((model) => model.model === selectedModel);
  const properties = schemaProperties(selectedModelOption);
  const requiredProperties = new Set(requiredSchemaParameters(selectedModelOption));
  const capabilities = selectedModelOption?.capabilities;
  const durationProperty = findSchemaProperty(properties, ["duration", "duration_seconds", "durationSeconds"]);
  const resolutionProperty = findSchemaProperty(properties, ["resolution"]);
  const aspectRatioProperty = findSchemaProperty(properties, ["aspectRatio", "aspect_ratio"]);
  const fpsProperty = findSchemaProperty(properties, ["fps", "frameRate", "frame_rate"]);
  const seedProperty = findSchemaProperty(properties, ["seed"]);
  const cameraMotionProperty = findSchemaProperty(properties, ["cameraMotion", "camera_motion", "cameraMovement", "camera_movement"]);
  const audioProperty = findSchemaProperty(properties, ["generateAudio", "generate_audio", "audio", "audio_enabled"]);
  const audioInputMode = Boolean(audioProperty && audioProperty[1].type !== "boolean");
  const negativePromptProperty = findSchemaProperty(properties, ["negativePrompt", "negative_prompt"]);
  const promptParameter = capabilities?.promptParameter;
  const negativePromptSupported = Boolean(negativePromptProperty || capabilities?.negativePromptParameter);
  const referenceParameter = capabilities?.referenceImagesParameter ?? capabilities?.imageParameter ?? findSchemaProperty(properties, ["referenceImage", "reference_image", "referenceImages", "reference_images", "image", "image_url"])?.[0];
  const referenceProperty = referenceParameter ? properties[referenceParameter] : undefined;
  const modelParameterEntries = Object.entries(properties).filter(([name]) => {
    return !textCoreParameterNames.has(name)
      && name !== promptParameter
      && name !== capabilities?.negativePromptParameter
      && name !== capabilities?.imageParameter
      && name !== capabilities?.referenceImagesParameter;
  });
  const videoCreditEstimate = useVideoCreditEstimate(selectedModel ? {
    feature: "text-to-video",
    model: selectedModel,
    prompt: prompt.trim() || undefined,
    negativePrompt: negativePrompt.trim() || undefined,
    duration: durationValue,
    resolution: resolutionValue,
    aspectRatio: aspectRatioValue,
    promptOptimizerEnabled,
    modelParams: { ...modelParams, ...(audioProperty && !audioInputMode ? { [audioProperty[0]]: audioValue } : {}) },
  } : null);
  const isGenerating = generationStatus === "uploading" || generationStatus === "processing";
  const missingRequiredModelParameter = modelParameterEntries.find(([name]) => requiredProperties.has(name) && !hasValue(modelParams[name]));
  const missingRequiredCoreParameter = [
    durationProperty && requiredProperties.has(durationProperty[0]) && !hasValue(durationValue) ? durationProperty[0] : null,
    resolutionProperty && requiredProperties.has(resolutionProperty[0]) && !hasValue(resolutionValue) ? resolutionProperty[0] : null,
    aspectRatioProperty && requiredProperties.has(aspectRatioProperty[0]) && !hasValue(aspectRatioValue) ? aspectRatioProperty[0] : null,
    fpsProperty && requiredProperties.has(fpsProperty[0]) && !hasValue(fpsValue) ? fpsProperty[0] : null,
    seedProperty && requiredProperties.has(seedProperty[0]) && !hasValue(seedValue) ? seedProperty[0] : null,
    cameraMotionProperty && requiredProperties.has(cameraMotionProperty[0]) && !hasValue(cameraMotionValue) ? cameraMotionProperty[0] : null,
    audioProperty && requiredProperties.has(audioProperty[0]) && !hasValue(audioInputMode ? audioFile : audioValue) ? audioProperty[0] : null,
    referenceParameter && requiredProperties.has(referenceParameter) && !referenceImage ? referenceParameter : null,
  ].find(Boolean);
  const validationMessage = modelsLoading
    ? "Loading text-to-video models..."
    : !selectedModel
      ? "Select a text-to-video model."
      : prompt.length > 2000
        ? "Prompt must be 2,000 characters or fewer."
        : !prompt.trim()
          ? "Add a prompt before generating."
          : missingRequiredCoreParameter
            ? `${labelFromParameterName(String(missingRequiredCoreParameter))} is required for this model.`
            : missingRequiredModelParameter
              ? `${labelFromParameterName(missingRequiredModelParameter[0])} is required for this model.`
              : null;
  const canGenerate = Boolean(!validationMessage && !isGenerating && !videoCreditEstimate.loading);

  useEffect(() => {
    let active = true;
    listGenerationModels("text-to-video")
      .then((items) => {
        if (!active) return;
        const eligible = items.filter((item) => item.enabled && item.capabilities.promptParameter);
        setModels(eligible);
        setSelectedModel((current) => eligible.some((item) => item.model === current)
          ? current
          : eligible.find((item) => item.isDefault)?.model ?? eligible[0]?.model ?? "");
      })
      .catch((error: unknown) => {
        if (active) setModelsError(error instanceof Error ? error.message : "Unable to load text-to-video models");
      })
      .finally(() => {
        if (active) setModelsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedModel) return;
    const nextProperties = schemaProperties(models.find((model) => model.model === selectedModel));
    const nextDuration = findSchemaProperty(nextProperties, ["duration", "duration_seconds", "durationSeconds"]);
    const nextResolution = findSchemaProperty(nextProperties, ["resolution"]);
    const nextAspectRatio = findSchemaProperty(nextProperties, ["aspectRatio", "aspect_ratio"]);
    const nextFps = findSchemaProperty(nextProperties, ["fps", "frameRate", "frame_rate"]);
    const nextSeed = findSchemaProperty(nextProperties, ["seed"]);
    const nextCameraMotion = findSchemaProperty(nextProperties, ["cameraMotion", "camera_motion", "cameraMovement", "camera_movement"]);
    const nextAudio = findSchemaProperty(nextProperties, ["generateAudio", "generate_audio", "audio", "audio_enabled"]);
    const timeoutId = window.setTimeout(() => {
      setDurationValue(schemaDefault(nextDuration?.[1]) ?? 5);
      setResolutionValue(schemaDefault(nextResolution?.[1]) ?? "720p");
      setAspectRatioValue(schemaDefault(nextAspectRatio?.[1]) ?? "16:9");
      setFpsValue(schemaDefault(nextFps?.[1]));
      setSeedValue(schemaDefault(nextSeed?.[1]) ?? -1);
      setCameraMotionValue(schemaDefault(nextCameraMotion?.[1]));
      setAudioValue(schemaDefault(nextAudio?.[1]) ?? true);
      setAudioFile(null);
      setModelParams(modelParameterDefaults(models.find((model) => model.model === selectedModel)));
      setReferenceImage((current) => {
        if (current?.startsWith("blob:")) URL.revokeObjectURL(current);
        return null;
      });
      setReferenceImageFile(null);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [models, selectedModel]);

  const clearReferenceImage = () => {
    if (referenceImage?.startsWith("blob:")) URL.revokeObjectURL(referenceImage);
    setReferenceImage(null);
    setReferenceImageFile(null);
  };

  const handleReferenceImage = async (file: File) => {
    const validationError = await validateMediaFile(file, "image", capabilities?.uploadConstraints);
    if (validationError) {
      setGenerationError(validationError);
      return;
    }
    const nextUrl = URL.createObjectURL(file);
    if (referenceImage?.startsWith("blob:")) URL.revokeObjectURL(referenceImage);
    setReferenceImage(nextUrl);
    setReferenceImageFile(file);
    setGenerationError(null);
  };

  const handleAudioFile = async (file: File) => {
    const validationError = await validateMediaFile(file, "audio", capabilities?.uploadConstraints);
    if (validationError) {
      setGenerationError(validationError);
      return;
    }
    setAudioFile(file);
    setGenerationError(null);
  };

  const handleGenerate = async () => {
    if (modelsLoading) return setGenerationError("Loading text-to-video models…");
    if (!prompt.trim()) return setGenerationError("Add a prompt before generating.");
    const missingParameter = modelParameterEntries.find(([name]) => requiredProperties.has(name) && !hasValue(modelParams[name]));
    if (missingParameter) return setGenerationError(`${labelFromParameterName(missingParameter[0])} is required for this model.`);
    const requiredCore = [
      durationProperty && requiredProperties.has(durationProperty[0]) && !hasValue(durationValue) ? durationProperty[0] : null,
      resolutionProperty && requiredProperties.has(resolutionProperty[0]) && !hasValue(resolutionValue) ? resolutionProperty[0] : null,
      aspectRatioProperty && requiredProperties.has(aspectRatioProperty[0]) && !hasValue(aspectRatioValue) ? aspectRatioProperty[0] : null,
      fpsProperty && requiredProperties.has(fpsProperty[0]) && !hasValue(fpsValue) ? fpsProperty[0] : null,
      seedProperty && requiredProperties.has(seedProperty[0]) && !hasValue(seedValue) ? seedProperty[0] : null,
      referenceParameter && requiredProperties.has(referenceParameter) && !referenceImage ? referenceParameter : null,
    ].find(Boolean);
    if (requiredCore) return setGenerationError(`${labelFromParameterName(String(requiredCore))} is required for this model.`);

    const controller = new AbortController();
    abortRef.current = controller;
    setGenerationError(null);
    setNotice(null);
    setFinalVideoUrl(null);
    setPreviewVideoUrl(null);
    setGenerationProgress(0);
    setGenerationStatus("uploading");
    try {
      let uploadedReferenceUrl: string | undefined;
      if (referenceImage && referenceParameter) {
        const file = referenceImageFile ?? await (async () => {
          const response = await fetch(referenceImage);
          if (!response.ok) throw new Error("Unable to prepare the reference image");
          const blob = await response.blob();
          return new File([blob], "reference-image.png", { type: blob.type || "image/png" });
        })();
        setNotice("Uploading reference image…");
        uploadedReferenceUrl = await uploadImageAsset(file, { purpose: "content", feature: "text-to-video", uploadConstraints: capabilities?.uploadConstraints });
      }

      const request: TextVideoGenerationInput = { prompt: prompt.trim() };
      if (promptOptimizerEnabled) request.promptOptimizerEnabled = true;
      if (selectedModel) request.model = selectedModel;
      if (negativePrompt.trim() && (!selectedModelOption || negativePromptSupported)) request.negativePrompt = negativePrompt.trim();
      if (durationProperty && hasValue(durationValue)) request.duration = durationValue;
      if (resolutionProperty && hasValue(resolutionValue)) request.resolution = resolutionValue;
      if (aspectRatioProperty && hasValue(aspectRatioValue)) request.aspectRatio = aspectRatioValue;
      if (fpsProperty && hasValue(fpsValue)) request[fpsProperty[0]] = fpsValue;
      if (seedProperty && hasValue(seedValue)) request[seedProperty[0]] = seedValue;
      if (cameraMotionProperty && hasValue(cameraMotionValue)) request[cameraMotionProperty[0]] = cameraMotionValue;
      if (audioProperty && !audioInputMode) request.generateAudio = audioValue;
      if (audioInputMode && audioFile) {
        setNotice("Uploading audio reference…");
        request.audioUrl = await uploadPeopleMedia(audioFile, controller.signal, capabilities?.uploadConstraints);
      }
      if (!selectedModelOption) {
        request.duration = durationValue;
        request.resolution = resolutionValue;
        request.aspectRatio = aspectRatioValue;
        request.seed = seedValue;
        request.generateAudio = audioValue;
      }
      if (uploadedReferenceUrl && referenceParameter) request[referenceParameter] = referenceProperty?.type === "array" ? [uploadedReferenceUrl] : uploadedReferenceUrl;
      if (Object.keys(modelParams).length) request.modelParams = modelParams;

      setGenerationStatus("processing");
      setNotice("Submitting text-to-video generation…");
      const created = await createTextVideoGeneration(request, controller.signal);
      if (created.workspaceId) window.sessionStorage.setItem("eos.generation.workspace-id", created.workspaceId);
      const generationId = created.generationId ?? created.id;
      const pollUrl = created.pollUrl ?? (generationId ? `/generations/${encodeURIComponent(generationId)}/status` : "");
      if (generationId && pollUrl) emitGenerationStarted({ feature: "text-to-video", generationId, pollUrl, workspaceId: created.workspaceId, model: selectedModel, status: created.status === "processing" ? "processing" : "queued" });
      if (generationId && pollUrl) jobRef.current = { id: generationId, workspaceId: created.workspaceId, pollUrl };
      let status: TextVideoGenerationStatus = {
        ...created,
        status: created.status ?? "processing",
      } as TextVideoGenerationStatus;
      if (status.status !== "completed" && status.status !== "failed" && status.status !== "cancelled") {
        if (!pollUrl) throw new Error("Text-to-video request did not return a polling URL");
        while (true) {
          status = await getTextVideoGenerationStatus(pollUrl, controller.signal);
          const nextProgress = textVideoProgress(status, generationProgress);
          setGenerationProgress(nextProgress);
          setNotice(`Generating video… ${nextProgress}%`);
          if (status.status === "completed" || status.status === "failed" || status.status === "cancelled") break;
          await new Promise<void>((resolve, reject) => {
            const timeout = window.setTimeout(resolve, 2500);
            controller.signal.addEventListener("abort", () => {
              window.clearTimeout(timeout);
              reject(new DOMException("Generation cancelled", "AbortError"));
            }, { once: true });
          });
        }
      }
      if (status.status !== "completed") throw new Error(status.errorMessage ?? `Video generation ${status.status}`);
      const videoUrl = outputVideoUrl(status);
      if (!videoUrl) throw new Error("Text-to-video completed without a video URL");
      setFinalVideoUrl(videoUrl);
      setPreviewVideoUrl(videoUrl);
      setLibraryRefreshKey((value) => value + 1);
      setGenerationProgress(100);
      setGenerationStatus("completed");
      setNotice("Video ready");
    } catch (error: unknown) {
      if (controller.signal.aborted) return;
      setGenerationStatus("failed");
      setNotice(null);
      setGenerationError(error instanceof Error ? error.message : "Unable to generate text-to-video");
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  };

  const cancelGeneration = async () => {
    const job = jobRef.current;
    abortRef.current?.abort();
    if (job?.id) {
      try {
        await cancelTextVideoGeneration(job.id, job.workspaceId);
      } catch {
        // The local abort still prevents another poll if the cancel endpoint is unavailable.
      }
    }
    setGenerationStatus("cancelled");
    setNotice("Generation cancelled");
    setGenerationError(null);
  };

  const displayedVideoUrl = previewVideoUrl ?? finalVideoUrl;

  return (
    <div className={styles.columns}>
      <div className={styles.leftColumn}>
        <section className={styles.panel}>
          <section className={styles.videoModePanel} aria-labelledby="text-video-title">
            <div className={styles.videoModeHeading}>
              <h2 id="text-video-title">TEXT TO VIDEO</h2>
              <Info size={11} />
            </div>
            <p className={styles.textVideoDescription}>Describe the scene and let the selected model create the motion.</p>
          </section>
        </section>
        <section className={styles.panel}>
          <div className={styles.sectionTitle}><h2>1. PROMPT</h2></div>
          <label className="block text-[10px] font-bold">
            Prompt <small>(Required)</small>
            <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="A cinematic drone shot flying through a futuristic city at night" maxLength={2000} required aria-required="true" />
          </label>
          <span className={styles.counter}>{prompt.length} / 2000</span>
          <PromptOptimizerToggle enabled={promptOptimizerEnabled} onChange={setPromptOptimizerEnabled} />
          <label className="block text-[10px] font-bold">
            Negative Prompt <small>(Optional)</small>
            <input value={negativePrompt} onChange={(event) => setNegativePrompt(event.target.value)} placeholder="e.g. blurry, watermark, distorted" />
          </label>
        </section>
        {referenceParameter ? (
          <section className={styles.panel}>
            <div className={styles.sectionTitle}><h2>2. REFERENCE IMAGE <small>(Optional)</small></h2></div>
            <div className={styles.textVideoReference}>
              {referenceImage ? (
                <div className={styles.textVideoReferencePreview}>
                  <Image src={referenceImage} alt="Reference image" fill unoptimized className="object-cover" />
                  <button type="button" onClick={clearReferenceImage} aria-label="Remove reference image"><X size={14} /></button>
                </div>
              ) : (
                <button type="button" className={styles.upload} onClick={() => referenceImageInputRef.current?.click()}>
                  <CloudUpload size={22} />
                  <strong>Upload Image</strong>
                  <small>PNG / JPG / WEBP</small>
                </button>
              )}
              <input ref={referenceImageInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleReferenceImage(file); event.currentTarget.value = ""; }} />
            </div>
          </section>
        ) : null}
      </div>
      <div className={styles.centerColumn}>
        <section className={styles.previewPanel}>
          <div className={styles.sectionTitle}><h2>PREVIEW</h2></div>
          <div className={styles.videoPreview}>
            {isGenerating ? (
              <div className={styles.videoGeneratingPreview} aria-busy="true">
                <WandSparkles size={26} />
                <strong>{generationStatus === "uploading" ? "PREPARING VIDEO" : "GENERATING VIDEO"}</strong>
                <span>{notice ?? "Your text prompt is being turned into a video…"}</span>
                <div className={styles.videoGenerationProgress}><i style={{ width: `${generationProgress || 12}%` }} /></div>
                <small>{generationProgress ? `${generationProgress}% complete` : "Working…"}</small>
              </div>
            ) : displayedVideoUrl ? (
              <EosVideoPlayer key={displayedVideoUrl} src={displayedVideoUrl} className={styles.generatedVideoPlayer} ariaLabel="Generated text-to-video" />
            ) : selectedModelOption?.previewUrl ? (
              <ModelPreviewMedia url={selectedModelOption.previewUrl} type={selectedModelOption.previewType} alt={`${selectedModelOption.displayName} model preview`} className={styles.generatedVideoPlayer} />
            ) : (
              <VideoPreviewPlaceholder />
            )}
            {displayedVideoUrl ? <VideoPreviewOverlayActions videoUrl={displayedVideoUrl} /> : null}
          </div>
        </section>
        <VideoResultLibrary
          feature="text-to-video"
          currentVideoUrl={finalVideoUrl}
          selectedVideoUrl={displayedVideoUrl}
          refreshKey={libraryRefreshKey}
          onVideoSelect={(url) => setPreviewVideoUrl(url)}
        />
      </div>
      <aside className={styles.settings}>
        <div className={styles.sectionTitle}><h2>3. SETTINGS</h2></div>
        <label className="mb-2 flex items-center gap-1 text-[10px] font-bold">Model <Info size={11} /></label>
        <VideoModelDropdown
          models={models}
          value={selectedModel}
          loading={modelsLoading}
          ariaLabel="Text-to-video model options"
          placeholder="No compatible model"
          onChange={setSelectedModel}
        />
        {modelsError ? <p className={styles.settingsError}>{modelsError}</p> : null}
        {durationProperty ? <TextSchemaField name={durationProperty[0]} property={durationProperty[1]} value={durationValue} required={requiredProperties.has(durationProperty[0])} labelOverride="Duration" onChange={setDurationValue} /> : null}
        {resolutionProperty ? <TextSchemaField name={resolutionProperty[0]} property={resolutionProperty[1]} value={resolutionValue} required={requiredProperties.has(resolutionProperty[0])} labelOverride="Resolution" onChange={setResolutionValue} /> : null}
        {aspectRatioProperty ? <TextSchemaField name={aspectRatioProperty[0]} property={aspectRatioProperty[1]} value={aspectRatioValue} required={requiredProperties.has(aspectRatioProperty[0])} labelOverride="Aspect Ratio" choices onChange={setAspectRatioValue} /> : null}
        {fpsProperty ? <TextSchemaField name={fpsProperty[0]} property={fpsProperty[1]} value={fpsValue} required={requiredProperties.has(fpsProperty[0])} labelOverride="FPS" onChange={setFpsValue} /> : null}
        {cameraMotionProperty ? <TextSchemaField name={cameraMotionProperty[0]} property={cameraMotionProperty[1]} value={cameraMotionValue} required={requiredProperties.has(cameraMotionProperty[0])} labelOverride="Camera Motion" onChange={setCameraMotionValue} /> : null}
        {audioProperty && !audioInputMode ? <TextSchemaField name={audioProperty[0]} property={audioProperty[1]} value={audioValue} required={requiredProperties.has(audioProperty[0])} labelOverride="Generate Audio" onChange={setAudioValue} /> : null}
        {audioInputMode ? (
          <section className={styles.audioReferenceField}>
            <div className={styles.settingLabel}><span>Audio Reference</span><small>Optional</small></div>
            {audioFile ? <div className={styles.peopleNotice}><Mic2 size={13} /> {audioFile.name}<button type="button" onClick={() => setAudioFile(null)} aria-label="Remove audio"><X size={13} /></button></div> : <button type="button" className={styles.upload} onClick={() => audioInputRef.current?.click()}><CloudUpload size={18} /><strong>Upload audio reference</strong><small>MP3 / WAV / M4A</small></button>}
            <input ref={audioInputRef} type="file" accept="audio/mpeg,audio/wav,audio/x-wav,audio/mp4" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleAudioFile(file); event.currentTarget.value = ""; }} />
          </section>
        ) : null}
        {modelParameterEntries.length ? (
          <div className={styles.sceneModelParams}>
            <div className={styles.sceneModelParamsTitle}>MODEL PARAMETERS</div>
            {modelParameterEntries.map(([name, property]) => <TextSchemaField key={name} name={name} property={property} value={modelParams[name]} required={requiredProperties.has(name)} onChange={(value) => setModelParams((current) => ({ ...current, [name]: value }))} />)}
          </div>
        ) : null}
        <VideoCreditEstimate featureLabel="Text to Video" duration={durationValue} estimate={videoCreditEstimate}>
          {!isGenerating && validationMessage ? <p className={styles.settingsError} role="status">{validationMessage}</p> : null}
          {generationError ? <p className={styles.settingsError} role="alert">{generationError}</p> : null}
          {isGenerating ? (
            <button type="button" className={styles.textVideoCancel} onClick={() => void cancelGeneration()}><X size={14} /> CANCEL GENERATION</button>
          ) : (
            <button type="button" className={styles.generate} onClick={() => void handleGenerate()} disabled={!canGenerate}><WandSparkles size={18} /> GENERATE VIDEO</button>
          )}
        </VideoCreditEstimate>
        {generationStatus === "failed" || generationStatus === "cancelled" ? <button type="button" className={styles.textVideoRetry} onClick={() => void handleGenerate()}><RotateCcw size={13} /> RETRY</button> : null}
      </aside>
      <TextVideoTutorials />
    </div>
  );
}
