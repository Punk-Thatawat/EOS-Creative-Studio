"use client";
import { useTemplateSettings } from "@/features/templates/use-template-settings";
import { useTemplatePrompt } from "@/features/templates/use-template-prompt";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Dropdown } from "@/components/ui/dropdown";
import { CloudUpload, LoaderCircle, Mic2, WandSparkles, X } from "lucide-react";
import { EosVideoPlayer } from "@/components/media/eos-video-player";
import { ModelPreviewMedia } from "./model-preview-media";
import { listGenerationModels, type GenerationModelOption } from "@/lib/api/generation-models";
import {
  createPeopleVideoGeneration,
  getPeopleVideoGenerationStatus,
  uploadPeopleMedia,
  type PeopleVideoGenerationInput,
  type PeopleVideoGenerationResponse,
  type PeopleVideoGenerationStatus,
} from "@/lib/api/people-video-generations";
import {
  createLipsyncGeneration,
  getLipsyncGenerationStatus,
  type LipsyncGenerationResponse,
  type LipsyncGenerationStatus,
} from "@/lib/api/lipsync-generations";
import { VideoResultLibrary } from "./video-result-library";
import { VideoPreviewLiveBadge, VideoPreviewOverlayActions, VideoPreviewPlaceholder } from "./video-preview-placeholder";
import { DurationControl } from "./components/duration-control";
import { emitGenerationStarted } from "@/lib/generation-progress-events";
import { validateMediaFile } from "@/lib/media/upload-validation";
import { useVideoCreditEstimate, VideoCreditEstimate } from "./components/video-credit-estimate";
import styles from "./video-generation-page.module.css";
import { InfoTooltip } from "./components/info-tooltip";
import { VideoModelDropdown } from "./video-model-dropdown";
import { PromptOptimizerToggle } from "./image-generation/components/prompt-optimizer-toggle";
import { ImageTutorialButton } from "./image-generation/components/image-tutorial-button";
import { formatGenerationError, generationErrorFromStatus } from "@/lib/api/generation-errors";
import { useLocale, type TranslationKey } from "@/lib/i18n/locale-provider";
import { translateVideoSchemaDescription, translateVideoSchemaLabel, translateVideoSchemaOption } from "./video-schema-copy";

type PeopleSchemaProperty = {
  type?: string;
  title?: string;
  description?: string;
  default?: unknown;
  enum?: unknown[];
  minimum?: number;
  maximum?: number;
  step?: number;
  items?: { type?: string; [key: string]: unknown };
  [key: string]: unknown;
};

type PeopleSource = {
  url: string;
  kind: "image" | "video";
  name: string;
  file?: File;
  remoteUrl?: string;
  uploadStatus?: "uploading" | "ready" | "error";
};

type PeopleGenerationStatus = "idle" | "uploading" | "processing" | "completed" | "failed";

const peopleCoreParameterNames = new Set([
  "prompt",
  "script",
  "dialogue",
  "text",
  "text_prompt",
  "actingDirection",
  "acting_direction",
  "direction",
  "negativePrompt",
  "negative_prompt",
  "image",
  "video",
  "sourceImage",
  "source_image",
  "sourceVideo",
  "source_video",
  "personImage",
  "person_image",
  "personVideo",
  "person_video",
  "duration",
  "duration_seconds",
  "durationSeconds",
  "resolution",
  "aspectRatio",
  "aspect_ratio",
  "audio",
  "audioFile",
  "audio_file",
  "audioUrl",
  "audio_url",
  "generateAudio",
  "generate_audio",
  "voice",
  "voice_id",
  "voiceId",
  "speaker",
  "speaker_id",
  "speakerId",
]);

function peopleSchemaProperties(model: GenerationModelOption | undefined): Record<string, PeopleSchemaProperty> {
  const properties = (model?.capabilities.apiSchema?.request_schema?.properties ?? {}) as Record<string, PeopleSchemaProperty>;
  if (Object.keys(properties).length) return properties;
  return Object.fromEntries((model?.capabilities.parameters ?? []).map((name) => [name, { type: "string" }]));
}

function peopleRequiredProperties(model: GenerationModelOption | undefined): string[] {
  return model?.capabilities.apiSchema?.request_schema?.required ?? model?.capabilities.requiredParameters ?? [];
}

function peopleSchemaDefault(property: PeopleSchemaProperty | undefined): unknown {
  if (!property) return undefined;
  if (property.default !== undefined) return property.default;
  if (property.enum?.length) return property.enum[0];
  if (property.type === "boolean") return false;
  return undefined;
}

function peopleFindProperty(properties: Record<string, PeopleSchemaProperty>, names: string[]): [string, PeopleSchemaProperty] | undefined {
  for (const name of names) {
    if (properties[name]) return [name, properties[name]];
  }
  return undefined;
}

function peopleHasValue(value: unknown): boolean {
  return value !== undefined && value !== null && value !== "" && (!Array.isArray(value) || value.length > 0);
}

function peopleModelRoleKey(model: GenerationModelOption | undefined, isLipsync: boolean): TranslationKey {
  const capabilities = model?.capabilities;
  if (!capabilities) return isLipsync ? "create.video.lipsync.roleDefault" : "create.video.people.roleDefault";
  if (isLipsync) {
    if (capabilities.videoParameter && capabilities.audioParameter) return "create.video.lipsync.roleVideoDubbing";
    if (capabilities.imageParameter && capabilities.audioParameter) return "create.video.lipsync.roleImageAudio";
    if (capabilities.scriptParameter && capabilities.voiceParameter) return "create.video.lipsync.roleScriptVoice";
    return "create.video.lipsync.roleDefault";
  }
  if (capabilities.audioParameter && capabilities.promptParameter) return "create.video.people.roleAudioPerformance";
  if (capabilities.audioParameter) return "create.video.people.roleAudioTalking";
  if (capabilities.scriptParameter || capabilities.promptParameter) return "create.video.people.roleScripted";
  return "create.video.people.roleDefault";
}

function parsePeopleValue(raw: string, property: PeopleSchemaProperty): unknown {
  if (property.enum) return raw === "" ? undefined : property.enum.find((value) => String(value) === raw) ?? raw;
  if (property.type === "integer") return raw === "" ? undefined : Number.parseInt(raw, 10);
  if (property.type === "number") return raw === "" ? undefined : Number(raw);
  return raw === "" ? undefined : raw;
}

function readAudioDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const audio = document.createElement("audio");
    let settled = false;
    const finish = (duration: number | null) => {
      if (settled) return;
      settled = true;
      audio.removeAttribute("src");
      audio.load();
      URL.revokeObjectURL(objectUrl);
      resolve(duration);
    };
    audio.preload = "metadata";
    audio.onloadedmetadata = () => finish(Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : null);
    audio.onerror = () => finish(null);
    audio.src = objectUrl;
  });
}

function PeopleSchemaField({
  name,
  property,
  value,
  required,
  labelOverride,
  onChange,
}: {
  name: string;
  property: PeopleSchemaProperty;
  value: unknown;
  required?: boolean;
  labelOverride?: string;
  onChange: (value: unknown) => void;
}) {
  const { t } = useLocale();
  const label = labelOverride ?? translateVideoSchemaLabel(name, property.title, t);
  const description = translateVideoSchemaDescription(property.description, t);
  const type = property.type ?? (property.enum ? "string" : typeof property.default === "boolean" ? "boolean" : typeof property.default === "number" ? "number" : "string");
  if (["duration", "duration_seconds", "durationSeconds"].includes(name)) {
    return <DurationControl property={property} value={value} required={required} onChange={(nextValue) => onChange(nextValue)} />;
  }
  if (property.enum?.length) {
    return (
      <label className={styles.dynamicField}>
        <span>{label}{required ? <b>*</b> : null}</span>
        <Dropdown
          value={value === undefined ? "" : String(value)}
          options={[
            ...(!required ? [{ value: "", label: t("create.video.common.auto") }] : []),
            ...property.enum.map((option) => ({ value: String(option), label: translateVideoSchemaOption(option, t) })),
          ]}
          onChange={(nextValue) => onChange(parsePeopleValue(nextValue, property))}
          ariaLabel={label}
          placeholder={t("create.video.common.auto")}
          className={styles.dynamicDropdown}
          triggerClassName={styles.dynamicSelect}
          menuClassName={styles.dynamicDropdownMenu}
          optionClassName={styles.dynamicDropdownOption}
        />
        {description ? <small>{description}</small> : null}
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
          placeholder={type === "array" ? t("create.video.common.addValues") : "{}"}
          onChange={(event) => onChange(type === "array" ? event.target.value.split(",").map((item) => item.trim()).filter(Boolean) : event.target.value)}
          aria-required={required}
        />
      </label>
    );
  }
  const numeric = type === "integer" || type === "number";
  if (numeric && property.minimum !== undefined && property.maximum !== undefined) {
    return (
      <div className={styles.settingBlock}>
        <div className={styles.settingLabel}>{label}{required ? <b>*</b> : null}<strong>{value === undefined ? t("create.video.common.auto") : String(value)}</strong></div>
        <input type="range" min={property.minimum} max={property.maximum} step={property.step ?? (type === "integer" ? 1 : 0.01)} value={typeof value === "number" ? value : property.minimum} onChange={(event) => onChange(parsePeopleValue(event.target.value, property))} aria-label={label} />
        <div className={styles.rangeLabels}><span>{property.minimum}</span><span>{property.maximum}</span></div>
      </div>
    );
  }
  return (
    <label className={styles.dynamicField}>
      <span>{label}{required ? <b>*</b> : null}</span>
      <input className={styles.dynamicInput} type={numeric ? "number" : "text"} value={value === undefined ? "" : String(value)} min={property.minimum} max={property.maximum} step={property.step ?? (type === "integer" ? 1 : "any")} onChange={(event) => onChange(parsePeopleValue(event.target.value, property))} aria-required={required} />
      {description ? <small>{description}</small> : null}
    </label>
  );
}

function PeopleSectionTitle({ number, children }: { number?: string; children: string }) {
  return <div className={styles.sectionTitle}><h2>{number ? `${number}. ` : ""}{children}</h2></div>;
}

function peopleOutputVideoUrl(payload: PeopleVideoGenerationResponse | PeopleVideoGenerationStatus | LipsyncGenerationResponse | LipsyncGenerationStatus): string | null {
  const output = Array.isArray(payload.output) ? payload.output : [];
  const url = output.find((item) => typeof item.url === "string" && item.url)?.url;
  return typeof url === "string" ? url : null;
}

function peopleProgress(payload: PeopleVideoGenerationStatus | LipsyncGenerationStatus, fallback: number): number {
  if (typeof payload.progress === "number") return Math.max(0, Math.min(100, payload.progress <= 1 ? payload.progress * 100 : payload.progress));
  if (payload.status === "completed") return 100;
  return fallback;
}

export function PeopleVideoWorkspace({ variant = "people-video" }: { variant?: "people-video" | "lipsync" }) {
  const { locale, t } = useLocale();
  const isLipsync = variant === "lipsync";
  const workspaceFeature = isLipsync ? "lipsync" : "people-video";
  const workspaceLabel = isLipsync ? t("create.video.lipsync.title") : t("create.video.people.title");
  const [models, setModels] = useState<GenerationModelOption[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [modelsLoading, setModelsLoading] = useState(true);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [sourcePerson, setSourcePerson] = useState<PeopleSource | null>(null);
  const [script, setScript] = useState("");
  const [actingDirection, setActingDirection] = useState("");
  useTemplatePrompt("video", setActingDirection);
  const [promptOptimizerEnabled, setPromptOptimizerEnabled] = useState(false);
  const [negativePrompt, setNegativePrompt] = useState("");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioDuration, setAudioDuration] = useState<number | null>(null);
  const [audioUploadStatus, setAudioUploadStatus] = useState<"idle" | "uploading" | "ready" | "error">("idle");
  const [durationValue, setDurationValue] = useState<unknown>(5);
  const [resolutionValue, setResolutionValue] = useState<unknown>(undefined);
  const [aspectRatioValue, setAspectRatioValue] = useState<unknown>(undefined);
  const [voiceValue, setVoiceValue] = useState<unknown>(undefined);
  const [modelParams, setModelParams] = useState<Record<string, unknown>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [generationStatus, setGenerationStatus] = useState<PeopleGenerationStatus>("idle");
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null);
  const [previewVideoUrl, setPreviewVideoUrl] = useState<string | null>(null);
  const [libraryRefreshKey, setLibraryRefreshKey] = useState(0);
  const [generationId, setGenerationId] = useState<string | null>(null);
  const sourceInputRef = useRef<HTMLInputElement | null>(null);
  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const sourceUploadAbortRef = useRef<AbortController | null>(null);
  const audioUploadAbortRef = useRef<AbortController | null>(null);

  const selectedModelOption = models.find((model) => model.model === selectedModel);
  const properties = peopleSchemaProperties(selectedModelOption);
  const requiredProperties = new Set(peopleRequiredProperties(selectedModelOption));
  const durationProperty = peopleFindProperty(properties, ["duration", "duration_seconds", "durationSeconds"]);
  const resolutionProperty = peopleFindProperty(properties, ["resolution"]);
  const aspectRatioProperty = peopleFindProperty(properties, ["aspectRatio", "aspect_ratio"]);
  const scriptProperty = peopleFindProperty(properties, ["script", "dialogue", "text", "speech_text", "script_text", "text_prompt"]);
  const promptProperty = peopleFindProperty(properties, ["prompt", "positive_prompt", "instruction"]);
  const negativePromptProperty = peopleFindProperty(properties, ["negativePrompt", "negative_prompt"]);
  const voiceProperty = peopleFindProperty(properties, ["voice", "voice_id", "voiceId", "speaker", "speaker_id", "speakerId"]);
  const capabilities = selectedModelOption?.capabilities;
  const capabilitiesKnown = Boolean(capabilities?.parameters.length);
  const sourceImageSupported = !capabilitiesKnown || Boolean(capabilities?.imageParameter || capabilities?.referenceImagesParameter);
  const sourceVideoSupported = !capabilitiesKnown || Boolean(capabilities?.videoParameter);
  const scriptSupported = Boolean(scriptProperty || capabilities?.scriptParameter);
  const promptSupported = Boolean(promptProperty || capabilities?.promptParameter);
  const driverTextSupported = scriptSupported || promptSupported;
  const actingDirectionSupported = !isLipsync && promptSupported && scriptSupported;
  const audioSupported = !capabilitiesKnown || Boolean(capabilities?.audioParameter);
  const negativePromptSupported = Boolean(negativePromptProperty || selectedModelOption?.capabilities.negativePromptParameter);
  const modelParameterEntries = Object.entries(properties).filter(([name]) => {
    return !peopleCoreParameterNames.has(name)
      && name !== capabilities?.promptParameter
      && name !== promptProperty?.[0]
      && name !== scriptProperty?.[0]
      && name !== capabilities?.negativePromptParameter;
  });
  const selectedRequiredParameters = new Set(selectedModelOption?.capabilities.requiredParameters ?? []);
  const requiredAudioInput = Boolean(selectedModelOption?.capabilities.audioParameter && selectedRequiredParameters.has(selectedModelOption.capabilities.audioParameter));
  const requiredScriptInput = Boolean(
    (scriptProperty && selectedRequiredParameters.has(scriptProperty[0]))
    || (promptProperty && selectedRequiredParameters.has(promptProperty[0]))
    || (selectedModelOption?.capabilities.scriptParameter && selectedRequiredParameters.has(selectedModelOption.capabilities.scriptParameter))
    || (selectedModelOption?.capabilities.promptParameter && selectedRequiredParameters.has(selectedModelOption.capabilities.promptParameter)),
  );
  const sourceKindSupported = sourcePerson
    ? sourcePerson.kind === "image" ? sourceImageSupported : sourceVideoSupported
    : false;
  const hasSupportedTextDriver = driverTextSupported && Boolean(script.trim());
  const hasSupportedAudioDriver = audioSupported && Boolean(audioFile || audioUrl);
  const sourceAccept = sourceImageSupported && sourceVideoSupported
    ? "image/png,image/jpeg,image/webp,video/mp4,video/webm"
    : sourceImageSupported
      ? "image/png,image/jpeg,image/webp"
      : "video/mp4,video/webm";
  const driverLabel = scriptSupported ? t("create.video.common.script") : !isLipsync && promptSupported ? t("create.video.common.performanceDirection") : t("create.video.common.prompt");
  const featureGuide = isLipsync
    ? {
      eyebrow: t("create.video.lipsync.eyebrow"),
      description: t("create.video.lipsync.description"),
      note: t("create.video.lipsync.note"),
      chips: [t("create.video.lipsync.chipAudioDriven"), t("create.video.lipsync.chipMouthAlignment"), t("create.video.lipsync.chipPreserveMotion")],
    }
    : {
      eyebrow: t("create.video.people.eyebrow"),
      description: t("create.video.people.description"),
      note: t("create.video.people.note"),
      chips: [t("create.video.people.chipExpressionPose"), t("create.video.people.chipScriptAudio"), t("create.video.people.chipTalkingCharacter")],
    };
  const textSectionVisible = driverTextSupported || negativePromptSupported || actingDirectionSupported;
  const audioSectionVisible = audioSupported || Boolean(voiceProperty);
  const audioStep = textSectionVisible ? "3" : "2";
  const settingsStep = String(1 + (textSectionVisible ? 1 : 0) + (audioSectionVisible ? 1 : 0));

  useEffect(() => {
    let active = true;
    listGenerationModels(workspaceFeature)
      .then((items) => {
        if (!active) return;
        const eligible = items.filter((item) => item.enabled);
        setModels(eligible);
        setSelectedModel((current) => eligible.some((item) => item.model === current)
          ? current
          : eligible.find((item) => item.isDefault)?.model ?? eligible[0]?.model ?? "");
      })
      .catch((error: unknown) => {
        if (active) setModelsError(error instanceof Error ? error.message : `Unable to load ${workspaceLabel} models`);
      })
      .finally(() => {
        if (active) setModelsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [workspaceFeature, workspaceLabel]);

  useEffect(() => {
    return () => {
      if (sourcePerson?.url.startsWith("blob:")) URL.revokeObjectURL(sourcePerson.url);
    };
  }, [sourcePerson?.url]);

  useEffect(() => () => {
    abortRef.current?.abort();
    sourceUploadAbortRef.current?.abort();
    audioUploadAbortRef.current?.abort();
  }, []);

  useEffect(() => {
    if (!selectedModel) return;
    const selected = models.find((model) => model.model === selectedModel);
    const nextProperties = peopleSchemaProperties(selected);
    const nextDuration = peopleFindProperty(nextProperties, ["duration", "duration_seconds", "durationSeconds"]);
    const nextResolution = peopleFindProperty(nextProperties, ["resolution"]);
    const nextAspectRatio = peopleFindProperty(nextProperties, ["aspectRatio", "aspect_ratio"]);
    const nextVoice = peopleFindProperty(nextProperties, ["voice", "voice_id", "voiceId", "speaker", "speaker_id", "speakerId"]);
    const nextScriptProperty = peopleFindProperty(nextProperties, ["script", "dialogue", "text", "speech_text", "script_text", "text_prompt"]);
    const nextPromptProperty = peopleFindProperty(nextProperties, ["prompt", "positive_prompt", "instruction"]);
    const nextParams: Record<string, unknown> = {};
    for (const [name, property] of Object.entries(nextProperties)) {
      if (peopleCoreParameterNames.has(name)
        || name === selected?.capabilities.promptParameter
        || name === selected?.capabilities.negativePromptParameter
        || name === nextPromptProperty?.[0]
        || name === nextScriptProperty?.[0]) continue;
      const value = peopleSchemaDefault(property);
      if (value !== undefined) nextParams[name] = value;
    }
    const timeoutId = window.setTimeout(() => {
      setDurationValue(peopleSchemaDefault(nextDuration?.[1]) ?? nextDuration?.[1].minimum ?? 5);
      setResolutionValue(peopleSchemaDefault(nextResolution?.[1]));
      setAspectRatioValue(peopleSchemaDefault(nextAspectRatio?.[1]));
      setVoiceValue(peopleSchemaDefault(nextVoice?.[1]));
      setModelParams(nextParams);
      setNotice(null);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [models, selectedModel]);

  const handleSourcePerson = async (file: File) => {
    const isVideo = file.type.startsWith("video/") || ["mp4", "webm", "mov", "m4v"].includes(file.name.split(".").pop()?.toLowerCase() ?? "");
    const validationError = await validateMediaFile(file, isVideo ? "video" : "image", capabilities?.uploadConstraints);
    if (validationError) {
      setGenerationError(validationError);
      return;
    }
    const url = URL.createObjectURL(file);
    sourceUploadAbortRef.current?.abort();
    const controller = new AbortController();
    sourceUploadAbortRef.current = controller;
    setSourcePerson({ url, kind: isVideo ? "video" : "image", name: file.name, file, uploadStatus: "uploading" });
    setGenerationError(null);
     setNotice(t("create.video.common.uploadingMediaToPrice"));
    try {
      const remoteUrl = await uploadPeopleMedia(file, controller.signal, capabilities?.uploadConstraints);
      setSourcePerson((current) => current?.file === file ? { ...current, remoteUrl, uploadStatus: "ready" } : current);
      setNotice(null);
    } catch (error: unknown) {
      if (controller.signal.aborted) return;
      setSourcePerson((current) => current?.file === file ? { ...current, uploadStatus: "error" } : current);
      setNotice(null);
      setGenerationError(formatGenerationError(error, t("create.video.common.uploadSourceMediaFailed")));
    } finally {
      if (sourceUploadAbortRef.current === controller) sourceUploadAbortRef.current = null;
    }
  };

  const handleAudioFile = async (file: File) => {
    const validationError = await validateMediaFile(file, "audio", capabilities?.uploadConstraints);
    if (validationError) {
      setGenerationError(validationError);
      return;
    }
    audioUploadAbortRef.current?.abort();
    const controller = new AbortController();
    audioUploadAbortRef.current = controller;
    setAudioFile(file);
    setAudioUrl(null);
    setAudioDuration(null);
    setAudioUploadStatus("uploading");
    setGenerationError(null);
    setNotice(t("create.video.common.uploadingMediaToPrice"));
    try {
      const [remoteUrl, duration] = await Promise.all([
        uploadPeopleMedia(file, controller.signal, capabilities?.uploadConstraints),
        readAudioDuration(file),
      ]);
      setAudioUrl(remoteUrl);
      setAudioDuration(duration);
      setAudioUploadStatus("ready");
      setNotice(null);
    } catch (error: unknown) {
      if (controller.signal.aborted) return;
      setAudioUploadStatus("error");
      setNotice(null);
      setGenerationError(formatGenerationError(error, t("create.video.common.uploadAudioFailed")));
    } finally {
      if (audioUploadAbortRef.current === controller) audioUploadAbortRef.current = null;
    }
  };

  const removeSourcePerson = () => {
    sourceUploadAbortRef.current?.abort();
    setSourcePerson(null);
    setNotice(null);
  };
  const removeAudioFile = () => {
    audioUploadAbortRef.current?.abort();
    setAudioFile(null);
    setAudioUrl(null);
    setAudioDuration(null);
    setAudioUploadStatus("idle");
    setNotice(null);
  };
  const mediaUploadInProgress = sourcePerson?.uploadStatus === "uploading" || audioUploadStatus === "uploading";
  const effectiveDurationValue = audioDuration !== null ? Number(audioDuration.toFixed(2)) : durationValue;
  const displayDuration = audioDuration !== null
    ? effectiveDurationValue
    : (isLipsync || requiredAudioInput ? undefined : durationValue);
  const isComplete = Boolean(
    !modelsLoading
    && selectedModel
    && sourcePerson
    && sourcePerson.remoteUrl
    && sourceKindSupported
    && (hasSupportedTextDriver || hasSupportedAudioDriver)
    && (!requiredAudioInput || Boolean(audioFile || audioUrl))
    && (!audioFile || Boolean(audioUrl))
    && (!requiredScriptInput || Boolean(script.trim()))
    && (!durationProperty || !requiredProperties.has(durationProperty[0]) || peopleHasValue(durationValue))
    && (!resolutionProperty || !requiredProperties.has(resolutionProperty[0]) || peopleHasValue(resolutionValue))
    && (!aspectRatioProperty || !requiredProperties.has(aspectRatioProperty[0]) || peopleHasValue(aspectRatioValue))
    && (!voiceProperty || !requiredProperties.has(voiceProperty[0]) || peopleHasValue(voiceValue))
    && !modelParameterEntries.some(([name]) => requiredProperties.has(name) && !peopleHasValue(modelParams[name])),
  );

  const validationMessage = !selectedModel
      ? t("create.video.common.selectFeatureModel", { feature: workspaceLabel })
      : !sourcePerson
        ? t(isLipsync ? "create.video.common.uploadSourceMedia" : "create.video.common.uploadSourcePersonMedia")
      : !sourceKindSupported
        ? t("create.video.common.parameterRequired", { parameter: sourcePerson.kind === "image" ? t("create.video.common.uploadImage") : t("create.video.common.uploadVideo") })
        : !sourcePerson.remoteUrl
          ? sourcePerson.uploadStatus === "uploading" ? t("create.video.common.uploadingMediaToPrice") : t("create.video.common.uploadMediaAgain")
        : audioFile && !audioUrl
          ? audioUploadStatus === "uploading" ? t("create.video.common.uploading") : t("create.video.common.uploadAudioAgain")
        : requiredAudioInput && !audioFile && !audioUrl
          ? t("create.video.common.requiresAudio")
        : requiredScriptInput && !script.trim()
              ? t("create.video.common.requiresDriver", { driver: driverLabel.toLowerCase() })
      : !hasSupportedTextDriver && !hasSupportedAudioDriver
        ? t("create.video.common.addDriver")
        : modelParameterEntries.find(([name]) => requiredProperties.has(name) && !peopleHasValue(modelParams[name]))
          ? t("create.video.common.parameterRequired", { parameter: translateVideoSchemaLabel(modelParameterEntries.find(([name]) => requiredProperties.has(name) && !peopleHasValue(modelParams[name]))?.[0] ?? "Parameter", undefined, t) })
          : null;
  const videoCreditEstimate = useVideoCreditEstimate(selectedModel ? {
    feature: workspaceFeature,
    model: selectedModel,
    prompt: script.trim() || actingDirection.trim() || undefined,
    duration: effectiveDurationValue,
    resolution: resolutionValue,
    aspectRatio: aspectRatioValue,
    promptOptimizerEnabled,
    ...(sourcePerson?.remoteUrl
      ? sourcePerson.kind === "image" ? { sourceImage: sourcePerson.remoteUrl } : { sourceVideo: sourcePerson.remoteUrl }
      : {}),
    ...(audioUrl ? { audioUrl } : {}),
    modelParams,
  } : null);
  const pricingBusy = mediaUploadInProgress || videoCreditEstimate.loading;

  const handleGenerate = async () => {
    if (!isComplete || !sourcePerson) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setGenerationError(null);
    setFinalVideoUrl(null);
    setPreviewVideoUrl(null);
    setGenerationId(null);
    setGenerationProgress(0);
    setGenerationStatus("uploading");
    setNotice(null);
    try {
      setNotice(t("create.video.common.preparingGeneration"));
      const sourceUrl = sourcePerson.remoteUrl;
      const uploadedAudioUrl = audioUrl ?? undefined;

      const request: PeopleVideoGenerationInput = {
        model: selectedModel,
      ...(sourcePerson.kind === "image" ? { sourceImage: sourceUrl } : { sourceVideo: sourceUrl }),
      };
      if (promptOptimizerEnabled) request.promptOptimizerEnabled = true;
      if (driverTextSupported && script.trim()) request.script = script.trim();
      if (uploadedAudioUrl) request.audioUrl = uploadedAudioUrl;
      if (actingDirectionSupported && actingDirection.trim()) request.actingDirection = actingDirection.trim();
      if (negativePrompt.trim() && negativePromptSupported) request.negativePrompt = negativePrompt.trim();
      if (durationProperty && peopleHasValue(effectiveDurationValue)) request.duration = effectiveDurationValue;
      if (resolutionProperty && peopleHasValue(resolutionValue)) request.resolution = resolutionValue;
      if (aspectRatioProperty && peopleHasValue(aspectRatioValue)) request.aspectRatio = aspectRatioValue;

      const nextModelParams = { ...modelParams };
      if (voiceProperty && peopleHasValue(voiceValue)) {
        nextModelParams[voiceProperty[0]] = voiceValue;
        // The provider schema uses voice_id, while the Lipsync API DTO uses
        // the canonical voiceId field. Keep both so schema-driven models work
        // without making the backend depend on frontend field names.
        request.voiceId = String(voiceValue);
      }
      if (Object.keys(nextModelParams).length) request.modelParams = nextModelParams;

      setGenerationStatus("processing");
      setNotice(t("create.video.common.submittingFeature", { feature: workspaceLabel }));
      const created = isLipsync
        ? await createLipsyncGeneration(request, controller.signal)
        : await createPeopleVideoGeneration(request, controller.signal);
      if (typeof created.workspaceId === "string") window.sessionStorage.setItem("eos.generation.workspace-id", created.workspaceId);
      const generationId = created.generationId ?? created.id;
      setGenerationId(generationId ?? null);
      const pollUrl = created.pollUrl ?? (generationId ? `/generations/${encodeURIComponent(generationId)}/status` : "");
      if (generationId && pollUrl) emitGenerationStarted({ feature: isLipsync ? "lipsync" : "people-video", generationId, pollUrl, workspaceId: typeof created.workspaceId === "string" ? created.workspaceId : undefined, model: selectedModel, status: created.status === "processing" ? "processing" : "queued" });
      let status: PeopleVideoGenerationStatus | LipsyncGenerationStatus = {
        ...created,
        status: created.status ?? "processing",
      } as PeopleVideoGenerationStatus | LipsyncGenerationStatus;
      let progress = 0;
      if (status.status !== "completed" && status.status !== "failed" && status.status !== "cancelled") {
        if (!pollUrl) throw new Error(`${workspaceLabel} request did not return a polling URL`);
        while (true) {
          status = isLipsync
            ? await getLipsyncGenerationStatus(pollUrl, controller.signal)
            : await getPeopleVideoGenerationStatus(pollUrl, controller.signal);
          progress = peopleProgress(status, progress);
          setGenerationProgress(progress);
          setNotice(t("create.video.common.generatingFeatureProgress", { feature: workspaceLabel, percent: progress }));
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
      if (status.status !== "completed") throw generationErrorFromStatus(status, `${workspaceLabel} generation ${status.status}`);
      const videoUrl = peopleOutputVideoUrl(status);
      if (!videoUrl) throw new Error("People video completed without an output URL");
      setFinalVideoUrl(videoUrl);
      setPreviewVideoUrl(videoUrl);
      setLibraryRefreshKey((value) => value + 1);
      setGenerationProgress(100);
      setGenerationStatus("completed");
      setNotice(t("create.video.common.videoReady"));
    } catch (error: unknown) {
      if (controller.signal.aborted) return;
      setGenerationStatus("failed");
      setNotice(null);
      setGenerationError(formatGenerationError(error, t("create.video.common.unableToGenerateFeature", { feature: workspaceLabel })));
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  };

  const displayedVideoUrl = previewVideoUrl ?? finalVideoUrl;
  useTemplateSettings('video',{ready:!modelsLoading,model:selectedModel,models:models.map(m=>m.model),setModel:setSelectedModel,apply:(s,p)=>{
    setActingDirection(p);
    if(s.duration!==undefined)setDurationValue(s.duration);if(s.resolution!==undefined)setResolutionValue(s.resolution);if(s.aspectRatio!==undefined)setAspectRatioValue(s.aspectRatio);
    const url=typeof s.sourceImage==='string'?s.sourceImage:typeof s.sourceVideo==='string'?s.sourceVideo:null;
    if(url)setSourcePerson({url,remoteUrl:url,kind:typeof s.sourceImage==='string'?'image':'video',name:'Template source',uploadStatus:'ready'});
    if(typeof s.script==='string')setScript(s.script);
    if(typeof s.audioUrl==='string'){setAudioUrl(s.audioUrl);setAudioUploadStatus('ready');}
    setNegativePrompt(typeof s.negativePrompt==='string'?s.negativePrompt:'');
    setModelParams(s.modelParams&&typeof s.modelParams==='object'?s.modelParams as Record<string,unknown>:{});
  }});

  return (
    <div className={styles.columns}>
      <div className={styles.leftColumn}>
        <section className={styles.panel}>
          <section className={styles.videoModePanel} aria-labelledby={`${workspaceFeature}-title`}>
            <div className={styles.videoModeTutorial}>
               <ImageTutorialButton feature={workspaceFeature} featureName={isLipsync ? t("create.video.lipsync.title") : t("create.video.people.title")} />
            </div>
            <div className={styles.videoModeHeading}><h2 id={`${workspaceFeature}-title`}>{isLipsync ? t("create.video.lipsync.title") : t("create.video.people.title")}</h2><InfoTooltip content={isLipsync ? t("create.video.lipsync.description") : t("create.video.people.description")} size={11} /></div>
            <div className={styles.featureIdentity}>
              <span className={styles.featureIdentityEyebrow}>{featureGuide.eyebrow}</span>
              <p className={styles.textVideoDescription}>{featureGuide.description}</p>
              <div className={styles.featurePills}>{featureGuide.chips.map((chip) => <span key={chip} className={styles.featurePill}>{chip}</span>)}</div>
              <small className={styles.featureGuideNote}>{featureGuide.note}</small>
            </div>
          </section>
        </section>
        <section className={styles.panel}>
          <PeopleSectionTitle number="1">{isLipsync ? t("create.video.common.source") : t("create.video.common.characterSource")}</PeopleSectionTitle>
          <div className={`${styles.peopleSourcePreview} ${!sourcePerson ? styles.peopleSourceUploadEmpty : ""}`}>
            {sourcePerson ? (
              <div className={styles.peopleSourceMedia}>
                {sourcePerson.kind === "video" ? <video src={sourcePerson.url} muted playsInline controls={false} /> : <Image src={sourcePerson.url} alt={t("create.video.common.sourcePerson")} fill unoptimized className="object-cover" />}
                <button type="button" onClick={removeSourcePerson} aria-label={t("create.video.common.removeSourcePerson")}><X size={14} /></button>
              </div>
            ) : (
              <button type="button" className={styles.upload} onClick={() => sourceInputRef.current?.click()}>
                <CloudUpload size={23} />
                 <strong>{sourceImageSupported && sourceVideoSupported ? t("create.video.common.uploadImageOrVideo") : sourceImageSupported ? t("create.video.common.uploadImage") : t("create.video.common.uploadVideo")}</strong>
                 <small>{sourceImageSupported ? t("create.video.common.pngFormats") : ""}{sourceImageSupported && sourceVideoSupported ? " / " : ""}{sourceVideoSupported ? t("create.video.common.videoFormats") : ""}</small>
              </button>
            )}
          </div>
          <input ref={sourceInputRef} type="file" accept={sourceAccept} className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleSourcePerson(file); event.currentTarget.value = ""; }} />
          {sourcePerson ? <p className={styles.peopleFileName}>{sourcePerson.name}</p> : null}
        </section>
        {textSectionVisible ? (
          <section className={`${styles.panel} ${driverTextSupported ? styles.videoPromptPanel : ""}`}>
            {driverTextSupported ? (
              <>
                <div className={styles.videoPromptHeading}>
                  <h2>{scriptSupported ? t("create.video.common.script") : !isLipsync && promptSupported ? t("create.video.common.performanceDirection") : t("create.video.common.prompt")} <small>({requiredScriptInput ? t("create.video.common.required") : t("create.video.common.optional")})</small></h2>
                  <span className={`${styles.videoPromptAnnotation} ${locale === "th" ? styles.videoPromptAnnotationThai : ""}`} aria-hidden="true" />
                </div>
                <label className={styles.videoPromptInputLabel}>
                  <textarea className={styles.videoPromptTextarea} value={script} onChange={(event) => setScript(event.target.value)} placeholder={scriptSupported ? t("create.video.people.scriptPlaceholder") : t("create.video.people.performancePlaceholder")} maxLength={2000} />
                </label>
                <div className={styles.videoPromptMeta}>
                  <span>{t("create.video.common.maximumCharacters", { count: 2000 })}</span>
                  <span>{script.length.toLocaleString()} / 2,000</span>
                </div>
              </>
            ) : (
              <PeopleSectionTitle number="2">{scriptSupported ? t("create.video.common.script") : !isLipsync && promptSupported ? t("create.video.common.performanceDirection") : t("create.video.common.prompt")}</PeopleSectionTitle>
            )}
            {actingDirectionSupported ? (
              <label className={styles.peopleFieldLabel}>
                {t("create.video.people.actingDirection")} <small>({t("create.video.common.optional")})</small>
                <textarea value={actingDirection} onChange={(event) => setActingDirection(event.target.value)} placeholder={t("create.video.people.actingPlaceholder")} />
              </label>
            ) : null}
            {promptSupported ? <PromptOptimizerToggle enabled={promptOptimizerEnabled} onChange={setPromptOptimizerEnabled} /> : null}
            {negativePromptSupported ? (
              <label className={styles.peopleFieldLabel}>
                {t("create.video.common.negativePrompt")} <small>({t("create.video.common.optional")})</small>
                <input value={negativePrompt} onChange={(event) => setNegativePrompt(event.target.value)} placeholder={t("create.video.people.negativePlaceholder")} />
              </label>
            ) : null}
          </section>
        ) : null}
        {audioSectionVisible ? (
          <section className={styles.panel}>
          <PeopleSectionTitle number={audioStep}>{isLipsync ? t("create.video.common.syncAudio") : t("create.video.common.voiceAudio")}</PeopleSectionTitle>
            {voiceProperty ? <PeopleSchemaField name={voiceProperty[0]} property={voiceProperty[1]} value={voiceValue} required={requiredProperties.has(voiceProperty[0])} labelOverride={t("create.video.common.voice")} onChange={setVoiceValue} /> : null}
            {audioSupported ? (
              <>
                <button type="button" className={styles.peopleAudioUpload} onClick={() => audioInputRef.current?.click()}>
                  <Mic2 size={20} />
                   <strong>{audioFile ? t("create.video.common.replaceAudioFile") : t("create.video.common.uploadAudioFile")}</strong>
                   <small>{requiredAudioInput ? t("create.video.common.requiredForModel") : t("create.video.common.optional")} · {t("create.video.common.audioFormats")}</small>
                </button>
                <input ref={audioInputRef} type="file" accept="audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/*" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleAudioFile(file); event.currentTarget.value = ""; }} />
                 {audioFile ? <div className={styles.peopleAudioFile}><span>{audioFile.name}</span><button type="button" onClick={removeAudioFile} aria-label={t("create.video.common.removeAudioFile")}><X size={13} /></button></div> : null}
              </>
            ) : null}
          </section>
        ) : null}
      </div>
      <div className={styles.centerColumn}>
        <section className={`${styles.previewPanel} ${styles.videoPreviewPanel}`}>
          <div className={styles.videoPreview}>
            <VideoPreviewLiveBadge />
            {generationStatus === "uploading" || generationStatus === "processing" ? (
              <div className={styles.videoGeneratingPreview} aria-busy="true">
                <WandSparkles size={26} />
                <strong>{generationStatus === "uploading" ? t("create.video.common.preparingVideo") : t("create.video.common.generatingVideo")}</strong>
                <span>{notice ?? t("create.video.people.animatingCharacter")}</span>
                <div className={styles.videoGenerationProgress}><i style={{ width: `${generationProgress || 12}%` }} /></div>
                <small>{generationProgress ? t("create.video.common.percentComplete", { percent: generationProgress }) : t("create.video.common.working")}</small>
              </div>
            ) : displayedVideoUrl ? (
              <EosVideoPlayer key={displayedVideoUrl} src={displayedVideoUrl} className={`${styles.generatedVideoPlayer} ${styles.peopleGeneratedVideoPlayer}`} mediaFrameClassName={styles.videoPreviewMediaFrame} ariaLabel={`${t("create.video.common.generatedVideo")} ${workspaceLabel}`} />
            ) : selectedModelOption?.previewUrl ? (
              <ModelPreviewMedia url={selectedModelOption.previewUrl} type={selectedModelOption.previewType} alt={`${selectedModelOption.displayName} model preview`} className={`${styles.generatedVideoPlayer} ${styles.peopleGeneratedVideoPlayer}`} frameClassName={styles.videoPreviewMediaFrame} />
            ) : (
              <VideoPreviewPlaceholder />
            )}
            {displayedVideoUrl ? <VideoPreviewOverlayActions videoUrl={displayedVideoUrl} /> : null}
          </div>
        </section>
        <VideoResultLibrary
          feature={workspaceFeature}
          currentVideoUrl={finalVideoUrl}
          currentSourceGenerationId={generationId}
          selectedVideoUrl={displayedVideoUrl}
          refreshKey={libraryRefreshKey}
          onVideoSelect={(url) => setPreviewVideoUrl(url)}
        />
      </div>
      <aside className={styles.settings}>
        <PeopleSectionTitle number={settingsStep}>{t("create.video.common.settings")}</PeopleSectionTitle>
        <label className="mb-2 flex items-center gap-1 text-[10px] font-bold">{t("create.video.common.model")} <InfoTooltip content={t("create.video.common.info.model")} size={11} /></label>
        <VideoModelDropdown
          models={models}
          value={selectedModel}
          loading={modelsLoading}
          ariaLabel={t("create.video.common.modelOptions", { feature: workspaceLabel })}
          placeholder={t("create.video.common.noFeatureModel", { feature: workspaceLabel })}
          onChange={setSelectedModel}
        />
        <p className={styles.selectedModelRole}>{t(peopleModelRoleKey(selectedModelOption, isLipsync))}</p>
        {modelsError ? <p className={styles.settingsError}>{modelsError}</p> : null}
        {durationProperty ? <PeopleSchemaField name={durationProperty[0]} property={durationProperty[1]} value={durationValue} required={requiredProperties.has(durationProperty[0])} labelOverride={t("create.video.common.duration")} onChange={setDurationValue} /> : null}
        {resolutionProperty ? <PeopleSchemaField name={resolutionProperty[0]} property={resolutionProperty[1]} value={resolutionValue} required={requiredProperties.has(resolutionProperty[0])} labelOverride={t("create.video.common.resolution")} onChange={setResolutionValue} /> : null}
        {aspectRatioProperty ? <PeopleSchemaField name={aspectRatioProperty[0]} property={aspectRatioProperty[1]} value={aspectRatioValue} required={requiredProperties.has(aspectRatioProperty[0])} labelOverride={t("create.video.common.aspectRatio")} onChange={setAspectRatioValue} /> : null}
        {modelParameterEntries.length ? <div className={styles.sceneModelParams}><div className={styles.sceneModelParamsTitle}>{t("create.video.common.modelParameters")}</div>{modelParameterEntries.map(([name, property]) => <PeopleSchemaField key={name} name={name} property={property} value={modelParams[name]} required={requiredProperties.has(name)} onChange={(value) => setModelParams((current) => { const next = { ...current }; if (value === undefined || value === "") delete next[name]; else next[name] = value; return next; })} />)}</div> : null}
        <VideoCreditEstimate featureLabel={workspaceLabel} duration={displayDuration} estimate={videoCreditEstimate} emptyLoading={modelsLoading} emptyMessage={modelsLoading ? t("create.video.common.loadingModels", { feature: workspaceLabel }) : validationMessage ?? t("create.video.common.pricingUnavailable")}>
          {!isComplete ? <p className={styles.settingsError} role="status">{modelsLoading ? t("create.video.common.loadingModels", { feature: workspaceLabel }) : validationMessage}</p> : null}
          {generationError ? <p className={styles.settingsError} role="alert">{generationError}</p> : null}
          <button type="button" className={styles.generate} onClick={() => void handleGenerate()} disabled={!isComplete || pricingBusy || generationStatus === "uploading" || generationStatus === "processing"}>{pricingBusy ? <LoaderCircle size={18} className={styles.creditSpinner} /> : <WandSparkles size={18} />} {generationStatus === "uploading" || generationStatus === "processing" ? t("create.video.common.generating") : mediaUploadInProgress ? t("create.video.common.uploading") : videoCreditEstimate.loading ? t("create.video.common.calculatingPrice") : t("create.video.common.generateVideo")}</button>
        </VideoCreditEstimate>
        {notice ? <p className={styles.peopleNotice}>{notice}</p> : null}
      </aside>
    </div>
  );
}

export function LipsyncWorkspace() {
  return <PeopleVideoWorkspace variant="lipsync" />;
}
