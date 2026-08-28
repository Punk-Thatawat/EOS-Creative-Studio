"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, CloudUpload, Info, WandSparkles, X } from "lucide-react";
import { EosVideoPlayer } from "@/components/media/eos-video-player";
import { ModelPreviewMedia } from "./model-preview-media";
import { listGenerationModels, type GenerationModelOption } from "@/lib/api/generation-models";
import { uploadImageAsset } from "@/lib/api/storage";
import {
  createMotionTransferGeneration,
  getMotionTransferGenerationStatus,
  type MotionTransferGenerationInput,
  type MotionTransferGenerationResponse,
  type MotionTransferGenerationStatus,
} from "@/lib/api/motion-transfer-generations";
import { VideoResultLibrary } from "./video-result-library";
import { VideoPreviewOverlayActions, VideoPreviewPlaceholder } from "./video-preview-placeholder";
import { emitGenerationStarted } from "@/lib/generation-progress-events";
import { validateMediaFile } from "@/lib/media/upload-validation";
import { useVideoCreditEstimate, VideoCreditEstimate } from "./components/video-credit-estimate";
import styles from "./video-generation-page.module.css";
import { modelTier, modelTierClass } from "./model-tier";

type MotionSchemaProperty = {
  type?: string;
  title?: string;
  description?: string;
  default?: unknown;
  enum?: unknown[];
  minimum?: number;
  maximum?: number;
  step?: number;
  [key: string]: unknown;
};

type MotionAsset = { url: string; file: File; kind: "image" | "video"; name: string };
type MotionStatus = "idle" | "uploading" | "processing" | "completed" | "failed";

const motionCoreParameterNames = new Set([
  "sourceImage",
  "source_image",
  "image",
  "motionVideo",
  "motion_video",
  "video",
  "motion",
  "model",
  "quality",
  "prompt",
  "negativePrompt",
  "negative_prompt",
  "characterOrientation",
  "character_orientation",
  "characterMode",
  "character_mode",
  "keepOriginalSound",
  "keep_original_sound",
  "keepSound",
  "keep_sound",
]);

function motionSchemaProperties(model: GenerationModelOption | undefined): Record<string, MotionSchemaProperty> {
  const properties = (model?.capabilities.apiSchema?.request_schema?.properties ?? {}) as Record<string, MotionSchemaProperty>;
  if (Object.keys(properties).length) return properties;
  return Object.fromEntries((model?.capabilities.parameters ?? []).map((name) => [name, { type: "string" }]));
}

function motionRequiredProperties(model: GenerationModelOption | undefined): string[] {
  return model?.capabilities.apiSchema?.request_schema?.required ?? model?.capabilities.requiredParameters ?? [];
}

function motionSchemaDefault(property: MotionSchemaProperty | undefined): unknown {
  if (!property) return undefined;
  if (property.default !== undefined) return property.default;
  if (property.enum?.length) return property.enum[0];
  if (property.type === "boolean") return false;
  return undefined;
}

function motionFindProperty(properties: Record<string, MotionSchemaProperty>, names: string[]): [string, MotionSchemaProperty] | undefined {
  for (const name of names) if (properties[name]) return [name, properties[name]];
  return undefined;
}

function motionLabel(name: string): string {
  return name.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function motionHasValue(value: unknown): boolean {
  return value !== undefined && value !== null && value !== "" && (!Array.isArray(value) || value.length > 0);
}

function motionModelRole(model: GenerationModelOption | undefined): string {
  if (!model) return "Transfer reference movement to a character";
  if (model.model.includes("pixverse")) return "Fast character motion transfer";
  if (model.model.includes("pro")) return "Highest motion fidelity and control";
  return "Controlled character motion transfer";
}

function parseMotionValue(raw: string, property: MotionSchemaProperty): unknown {
  if (property.enum) return property.enum.find((value) => String(value) === raw) ?? raw;
  if (property.type === "integer") return raw === "" ? undefined : Number.parseInt(raw, 10);
  if (property.type === "number") return raw === "" ? undefined : Number(raw);
  return raw === "" ? undefined : raw;
}

function MotionSchemaField({
  name,
  property,
  value,
  required,
  labelOverride,
  onChange,
}: {
  name: string;
  property: MotionSchemaProperty;
  value: unknown;
  required?: boolean;
  labelOverride?: string;
  onChange: (value: unknown) => void;
}) {
  const label = labelOverride ?? property.title ?? motionLabel(name);
  const type = property.type ?? (property.enum ? "string" : typeof property.default === "boolean" ? "boolean" : typeof property.default === "number" ? "number" : "string");
  if (property.enum?.length) {
    return (
      <label className={styles.dynamicField}>
        <span>{label}{required ? <b>*</b> : null}</span>
        <select className={styles.dynamicSelect} value={value === undefined ? "" : String(value)} onChange={(event) => onChange(parseMotionValue(event.target.value, property))} aria-required={required}>
          {!required ? <option value="">Auto</option> : null}
          {property.enum.map((option) => <option key={String(option)} value={String(option)}>{String(option)}</option>)}
        </select>
        {property.description ? <small>{property.description}</small> : null}
      </label>
    );
  }
  if (type === "boolean") {
    return <div className={styles.toggleRow}>{label}{required ? <b>*</b> : null}<button type="button" className={styles.toggle} aria-pressed={Boolean(value)} onClick={() => onChange(!Boolean(value))}><i /></button></div>;
  }
  if (type === "array") {
    return <label className={styles.dynamicField}><span>{label}{required ? <b>*</b> : null}</span><input className={styles.dynamicInput} value={Array.isArray(value) ? value.join(", ") : ""} placeholder="Add values separated by commas" onChange={(event) => onChange(event.target.value.split(",").map((item) => item.trim()).filter(Boolean))} aria-required={required} />{property.description ? <small>{property.description}</small> : null}</label>;
  }
  if (type === "object") {
    const objectValue = value && typeof value === "object" ? JSON.stringify(value, null, 2) : "";
    return <label className={styles.dynamicField}><span>{label}{required ? <b>*</b> : null}</span><textarea className={styles.dynamicTextarea} value={objectValue} placeholder="Enter JSON" onChange={(event) => { try { onChange(event.target.value ? JSON.parse(event.target.value) : undefined); } catch { /* Keep the field editable until the JSON is complete. */ } }} aria-required={required} />{property.description ? <small>{property.description}</small> : null}</label>;
  }
  const numeric = type === "integer" || type === "number";
  if (numeric && property.minimum !== undefined && property.maximum !== undefined) {
    return <div className={styles.settingBlock}><div className={styles.settingLabel}>{label}{required ? <b>*</b> : null}<strong>{value === undefined ? "Auto" : String(value)}</strong></div><input type="range" min={property.minimum} max={property.maximum} step={property.step ?? (type === "integer" ? 1 : 0.01)} value={typeof value === "number" ? value : property.minimum} onChange={(event) => onChange(parseMotionValue(event.target.value, property))} aria-label={label} /><div className={styles.rangeLabels}><span>{property.minimum}</span><span>{property.maximum}</span></div></div>;
  }
  return <label className={styles.dynamicField}><span>{label}{required ? <b>*</b> : null}</span><input className={styles.dynamicInput} type={numeric ? "number" : "text"} value={value === undefined ? "" : String(value)} min={property.minimum} max={property.maximum} step={property.step ?? (type === "integer" ? 1 : "any")} onChange={(event) => onChange(parseMotionValue(event.target.value, property))} aria-required={required} />{property.description ? <small>{property.description}</small> : null}</label>;
}

function MotionSectionTitle({ number, children }: { number?: string; children: string }) {
  return <div className={styles.sectionTitle}><h2>{number ? `${number}. ` : ""}{children}</h2></div>;
}

function motionOutputUrl(payload: MotionTransferGenerationResponse | MotionTransferGenerationStatus): string | null {
  const output = Array.isArray(payload.output) ? payload.output : [];
  const url = output.find((item) => typeof item.url === "string" && item.url)?.url;
  return typeof url === "string" ? url : null;
}

function motionProgress(payload: MotionTransferGenerationStatus, fallback: number): number {
  if (typeof payload.progress === "number") return Math.max(0, Math.min(100, payload.progress <= 1 ? payload.progress * 100 : payload.progress));
  return payload.status === "completed" ? 100 : fallback;
}

export function MotionTransferWorkspace() {
  const [models, setModels] = useState<GenerationModelOption[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [modelsLoading, setModelsLoading] = useState(true);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const [sourceImage, setSourceImage] = useState<MotionAsset | null>(null);
  const [motionVideo, setMotionVideo] = useState<MotionAsset | null>(null);
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [qualityValue, setQualityValue] = useState<unknown>(undefined);
  const [orientationValue, setOrientationValue] = useState<unknown>(undefined);
  const [keepOriginalSound, setKeepOriginalSound] = useState<unknown>(false);
  const [modelParams, setModelParams] = useState<Record<string, unknown>>({});
  const [generationStatus, setGenerationStatus] = useState<MotionStatus>("idle");
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null);
  const [previewVideoUrl, setPreviewVideoUrl] = useState<string | null>(null);
  const [libraryRefreshKey, setLibraryRefreshKey] = useState(0);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const sourceImageInputRef = useRef<HTMLInputElement | null>(null);
  const motionVideoInputRef = useRef<HTMLInputElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const selectedModelOption = models.find((model) => model.model === selectedModel);
  const properties = motionSchemaProperties(selectedModelOption);
  const requiredProperties = new Set(motionRequiredProperties(selectedModelOption));
  const qualityProperty = motionFindProperty(properties, ["quality", "outputQuality", "output_quality"]);
  const orientationProperty = motionFindProperty(properties, ["characterOrientation", "character_orientation", "characterMode", "character_mode"]);
  const keepSoundProperty = motionFindProperty(properties, ["keepOriginalSound", "keep_original_sound", "keepSound", "keep_sound"]);
  const promptProperty = motionFindProperty(properties, ["prompt", "positive_prompt", "instruction"]);
  const negativePromptProperty = motionFindProperty(properties, ["negativePrompt", "negative_prompt"]);
  const capabilities = selectedModelOption?.capabilities;
  const promptSupported = Boolean(promptProperty || capabilities?.promptParameter);
  const promptRequired = Boolean(
    (promptProperty && requiredProperties.has(promptProperty[0]))
    || (capabilities?.promptParameter && requiredProperties.has(capabilities.promptParameter)),
  );
  const negativePromptSupported = Boolean(negativePromptProperty || selectedModelOption?.capabilities.negativePromptParameter);
  const modelParameterEntries = Object.entries(properties).filter(([name]) => {
    return !motionCoreParameterNames.has(name)
      && name !== capabilities?.promptParameter
      && name !== promptProperty?.[0]
      && name !== capabilities?.negativePromptParameter
      && name !== negativePromptProperty?.[0];
  });

  useEffect(() => {
    let active = true;
    listGenerationModels("motion-transfer")
      .then((items) => {
        if (!active) return;
        const eligible = items.filter((item) => item.enabled);
        setModels(eligible);
        setSelectedModel((current) => eligible.some((item) => item.model === current) ? current : eligible.find((item) => item.isDefault)?.model ?? eligible[0]?.model ?? "");
      })
      .catch((error: unknown) => {
        if (active) setModelsError(error instanceof Error ? error.message : "Unable to load motion transfer models");
      })
      .finally(() => {
        if (active) setModelsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => () => abortRef.current?.abort(), []);
  useEffect(() => () => { if (sourceImage?.url.startsWith("blob:")) URL.revokeObjectURL(sourceImage.url); }, [sourceImage]);
  useEffect(() => () => { if (motionVideo?.url.startsWith("blob:")) URL.revokeObjectURL(motionVideo.url); }, [motionVideo]);

  useEffect(() => {
    if (!selectedModel) return;
    const selected = models.find((model) => model.model === selectedModel);
    const nextProperties = motionSchemaProperties(selected);
    const nextQuality = motionFindProperty(nextProperties, ["quality", "outputQuality", "output_quality"]);
    const nextOrientation = motionFindProperty(nextProperties, ["characterOrientation", "character_orientation", "characterMode", "character_mode"]);
    const nextKeepSound = motionFindProperty(nextProperties, ["keepOriginalSound", "keep_original_sound", "keepSound", "keep_sound"]);
    const nextPromptProperty = motionFindProperty(nextProperties, ["prompt", "positive_prompt", "instruction"]);
    const nextNegativePromptProperty = motionFindProperty(nextProperties, ["negativePrompt", "negative_prompt"]);
    const nextParams: Record<string, unknown> = {};
    for (const [name, property] of Object.entries(nextProperties)) {
      if (motionCoreParameterNames.has(name)
        || name === selected?.capabilities.promptParameter
        || name === selected?.capabilities.negativePromptParameter
        || name === nextPromptProperty?.[0]
        || name === nextNegativePromptProperty?.[0]) continue;
      const value = motionSchemaDefault(property);
      if (value !== undefined) nextParams[name] = value;
    }
    const timeoutId = window.setTimeout(() => {
      setQualityValue(motionSchemaDefault(nextQuality?.[1]));
      setOrientationValue(motionSchemaDefault(nextOrientation?.[1]));
      setKeepOriginalSound(motionSchemaDefault(nextKeepSound?.[1]) ?? false);
      setModelParams(nextParams);
      setNotice(null);
      setGenerationError(null);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [models, selectedModel]);

  const setMotionAsset = async (file: File, type: "image" | "video") => {
    const validationError = await validateMediaFile(file, type, capabilities?.uploadConstraints);
    if (validationError) {
      setGenerationError(validationError);
      return;
    }
    const asset = { url: URL.createObjectURL(file), file, kind: type, name: file.name } satisfies MotionAsset;
    if (type === "image") setSourceImage(asset); else setMotionVideo(asset);
    setSubmitAttempted(false);
  };

  const isComplete = Boolean(
    !modelsLoading && selectedModel && sourceImage && motionVideo
    && (!promptRequired || motionHasValue(prompt))
    && (!qualityProperty || !requiredProperties.has(qualityProperty[0]) || motionHasValue(qualityValue))
    && (!orientationProperty || !requiredProperties.has(orientationProperty[0]) || motionHasValue(orientationValue))
    && (!keepSoundProperty || !requiredProperties.has(keepSoundProperty[0]) || motionHasValue(keepOriginalSound))
    && !modelParameterEntries.some(([name]) => requiredProperties.has(name) && !motionHasValue(modelParams[name])),
  );
  const validationMessage = !selectedModel
    ? "Select a motion transfer model."
    : !sourceImage
      ? "Upload a source image."
      : !motionVideo
        ? "Upload a motion video."
        : promptRequired && !motionHasValue(prompt)
          ? "Prompt is required for this model."
          : modelParameterEntries.find(([name]) => requiredProperties.has(name) && !motionHasValue(modelParams[name]))
            ? `${motionLabel(modelParameterEntries.find(([name]) => requiredProperties.has(name) && !motionHasValue(modelParams[name]))?.[0] ?? "Parameter")} is required for this model.`
            : null;

  const handleGenerate = async () => {
    setSubmitAttempted(true);
    if (!isComplete || !sourceImage || !motionVideo) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setGenerationError(null);
    setNotice(null);
    setFinalVideoUrl(null);
    setPreviewVideoUrl(null);
    setGenerationProgress(0);
    setGenerationStatus("uploading");
    try {
      setNotice("Uploading source image…");
      const sourceImageUrl = await uploadImageAsset(sourceImage.file, { purpose: "content", feature: "motion-transfer", uploadConstraints: capabilities?.uploadConstraints });
      setNotice("Uploading motion video…");
      const motionVideoUrl = await uploadImageAsset(motionVideo.file, { purpose: "content", feature: "motion-transfer", uploadConstraints: capabilities?.uploadConstraints });
      const request: MotionTransferGenerationInput = { sourceImage: sourceImageUrl, motionVideo: motionVideoUrl, model: selectedModel };
      if (qualityProperty && motionHasValue(qualityValue)) request.quality = qualityValue;
      if (promptSupported && prompt.trim()) request.prompt = prompt.trim();
      if (negativePrompt.trim() && negativePromptSupported) request.negativePrompt = negativePrompt.trim();
      if (orientationProperty && motionHasValue(orientationValue)) request[orientationProperty[0]] = orientationValue;
      if (keepSoundProperty) request[keepSoundProperty[0]] = keepOriginalSound;
      if (Object.keys(modelParams).length) request.modelParams = modelParams;
      setGenerationStatus("processing");
      setNotice("Submitting motion transfer generation…");
      const created = await createMotionTransferGeneration(request, controller.signal);
      if (created.workspaceId) window.sessionStorage.setItem("eos.generation.workspace-id", created.workspaceId);
      const generationId = created.generationId ?? created.id;
      const pollUrl = created.pollUrl ?? (generationId ? `/generations/${encodeURIComponent(generationId)}/status` : "");
      if (generationId && pollUrl) emitGenerationStarted({ feature: "motion-transfer", generationId, pollUrl, workspaceId: created.workspaceId, model: selectedModel, status: created.status === "processing" ? "processing" : "queued" });
      let status: MotionTransferGenerationStatus = { ...created, status: created.status ?? "processing" } as MotionTransferGenerationStatus;
      let progress = 0;
      if (status.status !== "completed" && status.status !== "failed" && status.status !== "cancelled") {
        if (!pollUrl) throw new Error("Motion transfer request did not return a polling URL");
        while (true) {
          status = await getMotionTransferGenerationStatus(pollUrl, controller.signal);
          progress = motionProgress(status, progress);
          setGenerationProgress(progress);
          setNotice(`Generating motion transfer… ${progress}%`);
          if (status.status === "completed" || status.status === "failed" || status.status === "cancelled") break;
          await new Promise<void>((resolve, reject) => {
            const timeout = window.setTimeout(resolve, 2500);
            controller.signal.addEventListener("abort", () => { window.clearTimeout(timeout); reject(new DOMException("Generation cancelled", "AbortError")); }, { once: true });
          });
        }
      }
      if (status.status !== "completed") throw new Error(status.errorMessage ?? `Motion transfer generation ${status.status}`);
      const videoUrl = motionOutputUrl(status);
      if (!videoUrl) throw new Error("Motion transfer completed without an output URL");
      setFinalVideoUrl(videoUrl);
      setPreviewVideoUrl(videoUrl);
      setGenerationProgress(100);
      setGenerationStatus("completed");
      setLibraryRefreshKey((value) => value + 1);
      setNotice("Video ready");
    } catch (error: unknown) {
      if (controller.signal.aborted) return;
      setGenerationStatus("failed");
      setNotice(null);
      setGenerationError(error instanceof Error ? error.message : "Unable to generate motion transfer video");
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  };

  const displayedVideoUrl = previewVideoUrl ?? finalVideoUrl;
  const videoCreditEstimate = useVideoCreditEstimate(selectedModel ? {
    feature: "motion-transfer",
    model: selectedModel,
    prompt: prompt.trim() || undefined,
    negativePrompt: negativePrompt.trim() || undefined,
    modelParams: { ...modelParams, ...(qualityProperty && motionHasValue(qualityValue) ? { [qualityProperty[0]]: qualityValue } : {}) },
  } : null);
  const isGenerating = generationStatus === "uploading" || generationStatus === "processing";
  const motionGuide = {
    eyebrow: "REFERENCE MOTION",
    description: "Drive a character with the movement from a reference video while keeping the target identity.",
    note: "Use this when the movement is the source of truth—not the dialogue or mouth shape.",
    chips: ["Copy movement", "Character image", "Driving video"],
  };
  const guidanceVisible = promptSupported || negativePromptSupported;
  const settingsStep = guidanceVisible ? "4" : "3";

  return (
    <div className={styles.columns}>
      <div className={styles.leftColumn}>
        <section className={styles.panel}><section className={styles.videoModePanel} aria-labelledby="motion-transfer-title"><div className={styles.videoModeHeading}><h2 id="motion-transfer-title">MOTION TRANSFER</h2><Info size={11} /></div><div className={styles.featureIdentity}><span className={styles.featureIdentityEyebrow}>{motionGuide.eyebrow}</span><p className={styles.textVideoDescription}>{motionGuide.description}</p><div className={styles.featurePills}>{motionGuide.chips.map((chip) => <span key={chip} className={styles.featurePill}>{chip}</span>)}</div><small className={styles.featureGuideNote}>{motionGuide.note}</small></div></section></section>
        <section className={styles.panel}>
          <MotionSectionTitle number="1">CHARACTER IMAGE</MotionSectionTitle>
          <div className={`${styles.peopleSourcePreview} ${!sourceImage ? styles.peopleSourceUploadEmpty : ""}`}>{sourceImage ? <div className={styles.peopleSourceMedia}><Image src={sourceImage.url} alt="Source character" fill unoptimized className="object-cover" /><button type="button" onClick={() => setSourceImage(null)} aria-label="Remove source image"><X size={14} /></button></div> : <button type="button" className={styles.upload} onClick={() => document.getElementById("motion-source-image")?.click()}><CloudUpload size={23} /><strong>Upload Image</strong><small>PNG / JPG / WEBP</small></button>}</div>
          <input id="motion-source-image" ref={sourceImageInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void setMotionAsset(file, "image"); event.currentTarget.value = ""; }} />
        </section>
        <section className={styles.panel}>
          <MotionSectionTitle number="2">DRIVING VIDEO</MotionSectionTitle>
          <div className={`${styles.peopleSourcePreview} ${!motionVideo ? styles.peopleSourceUploadEmpty : ""}`}>{motionVideo ? <div className={styles.peopleSourceMedia}><video src={motionVideo.url} muted playsInline controls={false} /><button type="button" onClick={() => setMotionVideo(null)} aria-label="Remove motion video"><X size={14} /></button></div> : <button type="button" className={styles.upload} onClick={() => motionVideoInputRef.current?.click()}><CloudUpload size={23} /><strong>Upload Video</strong><small>MP4 / WEBM</small></button>}</div>
          <input ref={motionVideoInputRef} type="file" accept="video/mp4,video/webm" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void setMotionAsset(file, "video"); event.currentTarget.value = ""; }} />
        </section>
        {guidanceVisible ? (
          <section className={styles.panel}>
            <MotionSectionTitle number="3">MOTION GUIDANCE</MotionSectionTitle>
            {promptSupported ? <><label className={styles.peopleFieldLabel}>Prompt <small>({promptRequired ? "Required for selected model" : "Optional"})</small><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Natural movement, keep the character's identity" /></label><span className={styles.counter}>{prompt.length} / 2000</span></> : null}
            {negativePromptSupported ? <label className={styles.peopleFieldLabel}>Negative Prompt <small>(Optional)</small><input value={negativePrompt} onChange={(event) => setNegativePrompt(event.target.value)} placeholder="blurry, distorted, unnatural movement" /></label> : null}
          </section>
        ) : null}
      </div>
      <div className={styles.centerColumn}>
        <section className={styles.previewPanel}>
          <div className={styles.sectionTitle}><h2>PREVIEW</h2></div>
           <div className={styles.videoPreview}>{isGenerating ? <div className={styles.videoGeneratingPreview} aria-busy="true"><WandSparkles size={26} /><strong>{generationStatus === "uploading" ? "PREPARING VIDEO" : "GENERATING VIDEO"}</strong><span>{notice ?? "Transferring motion…"}</span><div className={styles.videoGenerationProgress}><i style={{ width: `${generationProgress || 12}%` }} /></div><small>{generationProgress ? `${generationProgress}% complete` : "Working…"}</small></div> : displayedVideoUrl ? <EosVideoPlayer src={displayedVideoUrl} className={`${styles.generatedVideoPlayer} ${styles.motionGeneratedVideoPlayer}`} ariaLabel="Generated motion transfer video" /> : selectedModelOption?.previewUrl ? <ModelPreviewMedia url={selectedModelOption.previewUrl} type={selectedModelOption.previewType} alt={`${selectedModelOption.displayName} model preview`} className={`${styles.generatedVideoPlayer} ${styles.motionGeneratedVideoPlayer}`} /> : <VideoPreviewPlaceholder />}{displayedVideoUrl ? <VideoPreviewOverlayActions videoUrl={displayedVideoUrl} /> : null}</div>
        </section>
        <VideoResultLibrary feature="motion-transfer" currentVideoUrl={finalVideoUrl} selectedVideoUrl={displayedVideoUrl} refreshKey={libraryRefreshKey} onVideoSelect={(url) => setPreviewVideoUrl(url)} />
      </div>
      <aside className={styles.settings}>
        <MotionSectionTitle number={settingsStep}>SETTINGS</MotionSectionTitle>
        <label className="mb-2 flex items-center gap-1 text-[10px] font-bold">Model <Info size={11} /></label>
        <div className={styles.modelDropdown}>
          <button type="button" className={styles.modelDropdownTrigger} aria-haspopup="listbox" aria-expanded={isModelMenuOpen} disabled={modelsLoading || models.length === 0} onClick={() => setIsModelMenuOpen((open) => !open)}><span><strong>{modelsLoading ? "Loading motion transfer models…" : selectedModelOption?.displayName ?? "No motion transfer model"}</strong><span className={styles.modelProviderRow}>{selectedModelOption ? <b className={`${styles.modelTierBadge} ${styles[modelTierClass(modelTier(selectedModelOption, Math.max(0, models.findIndex((item) => item.model === selectedModel))))]}`}>{modelTier(selectedModelOption, Math.max(0, models.findIndex((item) => item.model === selectedModel)))}</b> : null}</span></span><ChevronDown size={17} /></button>
          {isModelMenuOpen ? <div className={styles.modelDropdownMenu} role="listbox" aria-label="Motion transfer model options">{models.map((option, index) => <button key={option.model} type="button" role="option" aria-selected={option.model === selectedModel} onClick={() => { setSelectedModel(option.model); setIsModelMenuOpen(false); }}><span><strong>{option.displayName}</strong><span className={styles.modelProviderRow}><b className={`${styles.modelTierBadge} ${styles[modelTierClass(modelTier(option, index))]}`}>{modelTier(option, index)}</b></span></span></button>)}</div> : null}
        </div>
        <p className={styles.selectedModelRole}>{motionModelRole(selectedModelOption)}</p>
        {modelsError ? <p className={styles.settingsError}>{modelsError}</p> : null}
        {qualityProperty ? <MotionSchemaField name={qualityProperty[0]} property={qualityProperty[1]} value={qualityValue} required={requiredProperties.has(qualityProperty[0])} labelOverride="Quality" onChange={setQualityValue} /> : null}
        {orientationProperty ? <MotionSchemaField name={orientationProperty[0]} property={orientationProperty[1]} value={orientationValue} required={requiredProperties.has(orientationProperty[0])} labelOverride="Character Orientation" onChange={setOrientationValue} /> : null}
        {keepSoundProperty ? <MotionSchemaField name={keepSoundProperty[0]} property={keepSoundProperty[1]} value={keepOriginalSound} required={requiredProperties.has(keepSoundProperty[0])} labelOverride="Keep Original Sound" onChange={setKeepOriginalSound} /> : null}
        {modelParameterEntries.length ? <div className={styles.sceneModelParams}><div className={styles.sceneModelParamsTitle}>MODEL PARAMETERS</div>{modelParameterEntries.map(([name, property]) => <MotionSchemaField key={name} name={name} property={property} value={modelParams[name]} required={requiredProperties.has(name)} onChange={(value) => setModelParams((current) => ({ ...current, [name]: value }))} />)}</div> : null}
        <VideoCreditEstimate featureLabel="Motion Transfer" estimate={videoCreditEstimate}>
          <button type="button" className={styles.generate} onClick={() => void handleGenerate()} disabled={!isComplete || isGenerating}><WandSparkles size={18} /> {isGenerating ? "GENERATING…" : "GENERATE VIDEO"}</button>
        </VideoCreditEstimate>
        {submitAttempted && !isComplete ? <p className={styles.settingsError}>{modelsLoading ? "Loading motion transfer models…" : validationMessage}</p> : null}
        {generationError ? <p className={styles.settingsError} role="alert">{generationError}</p> : null}
        {notice ? <p className={styles.peopleNotice}>{notice}</p> : null}
      </aside>
    </div>
  );
}
