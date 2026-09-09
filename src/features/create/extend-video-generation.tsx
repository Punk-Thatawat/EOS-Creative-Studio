"use client";
import { useTemplateSettings } from "@/features/templates/use-template-settings";
import { useTemplatePrompt } from "@/features/templates/use-template-prompt";

import { useEffect, useRef, useState } from "react";
import { Dropdown } from "@/components/ui/dropdown";
import { CloudUpload, Info, Plus, X } from "lucide-react";
import { EosVideoPlayer } from "@/components/media/eos-video-player";
import { ModelPreviewMedia } from "./model-preview-media";
import { listGenerationModels, type GenerationModelOption } from "@/lib/api/generation-models";
import { uploadPeopleMedia } from "@/lib/api/people-video-generations";
import {
  cancelExtendVideoGeneration,
  createExtendVideoGeneration,
  getExtendVideoGenerationStatus,
  type ExtendVideoGenerationResponse,
  type ExtendVideoGenerationStatus,
} from "@/lib/api/extend-video-generations";
import { VideoResultLibrary } from "./video-result-library";
import { VideoPreviewLiveBadge, VideoPreviewOverlayActions, VideoPreviewPlaceholder } from "./video-preview-placeholder";
import { emitGenerationStarted } from "@/lib/generation-progress-events";
import { validateMediaFile } from "@/lib/media/upload-validation";
import { useVideoCreditEstimate, VideoCreditEstimate } from "./components/video-credit-estimate";
import styles from "./video-generation-page.module.css";
import { VideoModelDropdown } from "./video-model-dropdown";
import { PromptOptimizerToggle } from "./image-generation/components/prompt-optimizer-toggle";
import { ImageTutorialButton } from "./image-generation/components/image-tutorial-button";
import { formatGenerationError, generationErrorFromStatus } from "@/lib/api/generation-errors";
import { useLocale } from "@/lib/i18n/locale-provider";
import { translateVideoSchemaDescription, translateVideoSchemaLabel, translateVideoSchemaOption } from "./video-schema-copy";

type SchemaProperty = {
  type?: string;
  title?: string;
  description?: string;
  default?: unknown;
  enum?: unknown[];
  minimum?: number;
  maximum?: number;
  step?: number;
};

type VideoAsset = { url: string; file?: File; name: string };
type GenerationState = "idle" | "uploading" | "processing" | "completed" | "failed" | "cancelled";

const coreParameterNames = new Set([
  "video", "video_url", "videoUrl", "input_video", "inputVideo", "source_video", "sourceVideo",
  "prompt", "negative_prompt", "negativePrompt", "audio", "audio_url", "audioUrl", "duration", "resolution",
  "aspect_ratio", "aspectRatio", "enable_prompt_expansion", "enablePromptExpansion", "seed", "count", "model",
]);

function schemaProperties(model: GenerationModelOption | undefined): Record<string, SchemaProperty> {
  const properties = (model?.capabilities.apiSchema?.request_schema?.properties ?? {}) as Record<string, SchemaProperty>;
  if (Object.keys(properties).length) return properties;
  return Object.fromEntries((model?.capabilities.parameters ?? []).map((name) => [name, { type: "string" }]));
}

function schemaRequired(model: GenerationModelOption | undefined): Set<string> {
  return new Set(model?.capabilities.apiSchema?.request_schema?.required ?? model?.capabilities.requiredParameters ?? []);
}

function schemaDefault(property: SchemaProperty | undefined): unknown {
  if (!property) return undefined;
  if (property.default !== undefined) return property.default;
  if (property.enum?.length) return property.enum[0];
  if (property.type === "boolean") return false;
  return undefined;
}

function parseValue(raw: string, property: SchemaProperty): unknown {
  if (property.enum) return property.enum.find((value) => String(value) === raw) ?? raw;
  if (property.type === "integer") return raw === "" ? undefined : Number.parseInt(raw, 10);
  if (property.type === "number") return raw === "" ? undefined : Number(raw);
  if (property.type === "boolean") return raw === "true";
  return raw === "" ? undefined : raw;
}

function hasValue(value: unknown): boolean {
  return value !== undefined && value !== null && value !== "";
}

function outputUrl(payload: ExtendVideoGenerationResponse | ExtendVideoGenerationStatus): string | null {
  const output = Array.isArray(payload.output) ? payload.output : [];
  const url = output.find((item) => typeof item.url === "string" && item.url)?.url;
  return typeof url === "string" ? url : null;
}

function progressOf(payload: ExtendVideoGenerationStatus, fallback: number): number {
  if (typeof payload.progress === "number") return Math.round(Math.max(0, Math.min(100, payload.progress <= 1 ? payload.progress * 100 : payload.progress)));
  return payload.status === "completed" ? 100 : fallback;
}

function SchemaField({ name, property, value, required, onChange }: { name: string; property: SchemaProperty; value: unknown; required: boolean; onChange: (value: unknown) => void }) {
  const { t } = useLocale();
  const label = translateVideoSchemaLabel(name, property.title, t);
  const description = translateVideoSchemaDescription(property.description, t);
  if (property.enum?.length) return <label className={styles.dynamicField}><span>{label}{required ? <b>*</b> : null}</span><Dropdown value={value === undefined ? "" : String(value)} options={[...(!required ? [{ value: "", label: t("create.video.common.auto") }] : []), ...property.enum.map((option) => ({ value: String(option), label: translateVideoSchemaOption(option, t) }))]} onChange={(nextValue) => onChange(parseValue(nextValue, property))} ariaLabel={label} placeholder={t("create.video.common.auto")} className={styles.dynamicDropdown} triggerClassName={styles.dynamicSelect} menuClassName={styles.dynamicDropdownMenu} optionClassName={styles.dynamicDropdownOption} />{description ? <small>{description}</small> : null}</label>;
  if (property.type === "boolean") return <div className={styles.toggleRow}>{label}{required ? <b>*</b> : null}<button type="button" className={styles.toggle} aria-pressed={Boolean(value)} onClick={() => onChange(!Boolean(value))}><i /></button></div>;
  const numeric = property.type === "integer" || property.type === "number";
  return <label className={styles.dynamicField}><span>{label}{required ? <b>*</b> : null}</span><input className={styles.dynamicInput} type={numeric ? "number" : "text"} value={value === undefined ? "" : String(value)} min={property.minimum} max={property.maximum} step={property.step ?? (property.type === "integer" ? 1 : "any")} onChange={(event) => onChange(parseValue(event.target.value, property))} aria-required={required} />{description ? <small>{description}</small> : null}</label>;
}

function responseStatus(payload: ExtendVideoGenerationResponse): ExtendVideoGenerationStatus {
  return { ...payload, status: payload.status ?? "queued" } as ExtendVideoGenerationStatus;
}

export function ExtendVideoWorkspace() {
  const { locale, t } = useLocale();
  const [models, setModels] = useState<GenerationModelOption[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [modelsLoading, setModelsLoading] = useState(true);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [sourceVideo, setSourceVideo] = useState<VideoAsset | null>(null);
  const [audio, setAudio] = useState<VideoAsset | null>(null);
  const [prompt, setPrompt] = useState("");
  useTemplatePrompt("video", setPrompt);
  const [promptOptimizerEnabled, setPromptOptimizerEnabled] = useState(false);
  const [negativePrompt, setNegativePrompt] = useState("");
  const [duration, setDuration] = useState<number | undefined>(undefined);
  const [resolution, setResolution] = useState<unknown>(undefined);
  const [modelParams, setModelParams] = useState<Record<string, unknown>>({});
  const [state, setState] = useState<GenerationState>("idle");
  const [progress, setProgress] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null);
  const [previewVideoUrl, setPreviewVideoUrl] = useState<string | null>(null);
  const [libraryRefreshKey, setLibraryRefreshKey] = useState(0);
  const [generationId, setGenerationId] = useState<string | null>(null);
  const sourceInputRef = useRef<HTMLInputElement | null>(null);
  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const selected = models.find((item) => item.model === selectedModel);
  const properties = schemaProperties(selected);
  const required = schemaRequired(selected);
  const resolutionProperty = Object.entries(properties).find(([name]) => ["resolution", "output_resolution"].includes(name));
  const durationProperty = Object.entries(properties).find(([name]) => ["duration", "video_duration"].includes(name));
  const modelParameterEntries = Object.entries(properties).filter(([name]) => !coreParameterNames.has(name));
  const videoParameter = selected?.capabilities.videoParameter;
  const promptParameter = selected?.capabilities.promptParameter;
  const audioParameter = selected?.capabilities.audioParameter;
  const isGenerating = state === "uploading" || state === "processing";

  useEffect(() => {
    let active = true;
    listGenerationModels("extend-video").then((items) => {
      if (!active) return;
      const enabled = items.filter((item) => item.enabled);
      setModels(enabled);
      setSelectedModel((current) => enabled.some((item) => item.model === current) ? current : enabled.find((item) => item.isDefault)?.model ?? enabled[0]?.model ?? "");
    }).catch((reason: unknown) => { if (active) setModelsError(reason instanceof Error ? reason.message : t("create.video.common.loadingFeatureModels", { feature: t("create.video.tabs.extendVideo") })); }).finally(() => { if (active) setModelsLoading(false); });
    return () => { active = false; };
  }, [t]);

  useEffect(() => () => abortRef.current?.abort(), []);
  useEffect(() => () => { if (sourceVideo?.url.startsWith("blob:")) URL.revokeObjectURL(sourceVideo.url); }, [sourceVideo]);
  useEffect(() => () => { if (audio?.url.startsWith("blob:")) URL.revokeObjectURL(audio.url); }, [audio]);

  useEffect(() => {
    if (!selectedModel) return;
    const nextProperties = schemaProperties(models.find((item) => item.model === selectedModel));
    const nextResolution = Object.entries(nextProperties).find(([name]) => ["resolution", "output_resolution"].includes(name));
    const nextDuration = Object.entries(nextProperties).find(([name]) => ["duration", "video_duration"].includes(name));
    const nextParams: Record<string, unknown> = {};
    for (const [name, property] of Object.entries(nextProperties)) {
      if (coreParameterNames.has(name)) continue;
      const value = schemaDefault(property);
      if (value !== undefined) nextParams[name] = value;
    }
    const fallbackDuration = nextDuration?.[1].default ?? nextDuration?.[1].minimum;
    const timeoutId = window.setTimeout(() => {
      setResolution(schemaDefault(nextResolution?.[1]));
      setDuration(typeof fallbackDuration === "number" ? fallbackDuration : undefined);
      setModelParams(nextParams);
      setError(null);
      setNotice(null);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [models, selectedModel]);

  const setAsset = async (file: File, kind: "video" | "audio") => {
    const validationError = await validateMediaFile(file, kind, selected?.capabilities.uploadConstraints);
    if (validationError) {
      setError(validationError);
      return;
    }
    const asset = { file, name: file.name, url: URL.createObjectURL(file) };
    if (kind === "video") setSourceVideo(asset); else setAudio(asset);
  };

  const missingParameter = modelParameterEntries.find(([name]) => required.has(name) && !hasValue(modelParams[name]));
  const isComplete = Boolean(!modelsLoading && selectedModel && sourceVideo && prompt.trim() && (!videoParameter || sourceVideo) && (!promptParameter || prompt.trim()) && (!resolutionProperty || !required.has(resolutionProperty[0]) || hasValue(resolution)) && (!durationProperty || !required.has(durationProperty[0]) || hasValue(duration)) && !missingParameter);
  const validationMessage = !selectedModel ? t("create.video.common.selectFeatureModel", { feature: t("create.video.tabs.extendVideo") }) : !sourceVideo ? t("create.video.common.uploadSourceVideo") : !prompt.trim() ? t("create.video.common.promptRequired") : missingParameter ? t("create.video.common.parameterRequired", { parameter: translateVideoSchemaLabel(missingParameter[0], missingParameter[1].title, t) }) : null;

  const handleGenerate = async () => {
    if (!isComplete || !sourceVideo) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setError(null); setNotice(null); setFinalVideoUrl(null); setPreviewVideoUrl(null); setGenerationId(null); setProgress(0); setState("uploading");
    try {
       setNotice(t("create.video.common.uploadingSourceVideo"));
      const sourceVideoUrl = sourceVideo.file ? await uploadPeopleMedia(sourceVideo.file, controller.signal, selected?.capabilities.uploadConstraints) : sourceVideo.url;
      let audioUrl: string | undefined;
       if (audio && audioParameter) { setNotice(t("create.video.common.uploadingAudioReference")); audioUrl = audio.file ? await uploadPeopleMedia(audio.file, controller.signal, selected?.capabilities.uploadConstraints) : audio.url; }
      const request: Parameters<typeof createExtendVideoGeneration>[0] = { model: selectedModel, sourceVideo: sourceVideoUrl, prompt: prompt.trim() };
      if (promptOptimizerEnabled) request.promptOptimizerEnabled = true;
      if (negativePrompt.trim()) request.negativePrompt = negativePrompt.trim();
      if (audioUrl) request.audioUrl = audioUrl;
      if (duration !== undefined) request.duration = duration;
      if (hasValue(resolution)) request.resolution = String(resolution);
      if (Object.keys(modelParams).length) request.modelParams = modelParams;
       setState("processing"); setNotice(t("create.video.extend.submitting"));
      const created = await createExtendVideoGeneration(request, controller.signal);
      const id = created.generationId ?? created.id;
      setGenerationId(id ?? null);
      if (created.workspaceId) window.sessionStorage.setItem("eos.generation.workspace-id", created.workspaceId);
      const pollUrl = created.pollUrl ?? (id ? `/generations/${encodeURIComponent(id)}/status` : "");
      if (id && pollUrl) emitGenerationStarted({ feature: "extend-video", generationId: id, pollUrl, workspaceId: created.workspaceId, model: selectedModel, status: created.status === "processing" ? "processing" : "queued" });
      let status = responseStatus(created);
      let currentProgress = 0;
      if (status.status !== "completed" && status.status !== "failed" && status.status !== "cancelled") {
        if (!pollUrl) throw new Error("Extend Video request did not return a polling URL");
        while (true) {
          status = await getExtendVideoGenerationStatus(pollUrl, controller.signal);
          currentProgress = progressOf(status, currentProgress);
           setProgress(currentProgress); setNotice(t("create.video.common.generatingFeatureProgress", { feature: t("create.video.tabs.extendVideo"), percent: currentProgress }));
          if (["completed", "failed", "cancelled"].includes(status.status)) break;
          await new Promise<void>((resolve, reject) => { const timeout = window.setTimeout(resolve, 2200); controller.signal.addEventListener("abort", () => { window.clearTimeout(timeout); reject(new DOMException("Generation cancelled", "AbortError")); }, { once: true }); });
        }
      }
      if (status.status !== "completed") throw generationErrorFromStatus(status, `Extend Video generation ${status.status}`);
      const url = outputUrl(status);
      if (!url) throw new Error("Extend Video completed without an output URL");
       setFinalVideoUrl(url); setPreviewVideoUrl(url); setProgress(100); setState("completed"); setLibraryRefreshKey((value) => value + 1); setNotice(t("create.video.common.videoReady"));
    } catch (reason: unknown) {
      if (controller.signal.aborted) return;
       setState("failed"); setNotice(null); setError(formatGenerationError(reason, t("create.video.extend.generateError")));
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  };

  const handleCancel = async () => {
    const id = generationId;
    if (id) await cancelExtendVideoGeneration(id).catch(() => undefined);
    abortRef.current?.abort();
     setState("cancelled"); setNotice(t("create.video.extend.cancelled"));
  };

  const displayedVideoUrl = previewVideoUrl ?? finalVideoUrl;
  const videoCreditEstimate = useVideoCreditEstimate(selectedModel ? {
    feature: "extend-video",
    model: selectedModel,
    prompt: prompt.trim() || undefined,
    negativePrompt: negativePrompt.trim() || undefined,
    duration,
    resolution,
    promptOptimizerEnabled,
    modelParams,
  } : null);
  useTemplateSettings('video',{ready:!modelsLoading,model:selectedModel,models:models.map(m=>m.model),setModel:setSelectedModel,apply:(s,p)=>{
    setPrompt(p); if(typeof s.duration==='number')setDuration(s.duration);if(s.resolution!==undefined)setResolution(s.resolution);
    if(typeof s.sourceVideo==='string')setSourceVideo({url:s.sourceVideo,name:'Template video'});
    if(typeof s.audioUrl==='string')setAudio({url:s.audioUrl,name:'Template audio'});
    setNegativePrompt(typeof s.negativePrompt==='string'?s.negativePrompt:'');
    setModelParams(s.modelParams&&typeof s.modelParams==='object'?s.modelParams as Record<string,unknown>:{});
  }});
  return <div className={styles.columns}>
    <div className={styles.leftColumn}>
      <section className={styles.panel}><section className={styles.videoModePanel} aria-labelledby="extend-video-title"><div className={styles.videoModeTutorial}><ImageTutorialButton feature="extend-video" featureName={t("create.video.tabs.extendVideo")} /></div><div className={styles.videoModeHeading}><h2 id="extend-video-title">{t("create.video.extend.title")}</h2><Info size={11} /></div><p className={styles.textVideoDescription}>{t("create.video.extend.description")}</p></section></section>
      <section className={styles.panel}><div className={styles.sectionTitle}><h2>1. {t("create.video.common.sourceVideo")}</h2></div><div className={`${styles.peopleSourcePreview} ${!sourceVideo ? styles.peopleSourceUploadEmpty : ""}`}>{sourceVideo ? <div className={styles.peopleSourceMedia}><video src={sourceVideo.url} muted playsInline controls={false} /><button type="button" onClick={() => setSourceVideo(null)} aria-label={t("create.video.common.removeSourceVideo")}><X size={14} /></button></div> : <button type="button" className={styles.upload} onClick={() => sourceInputRef.current?.click()}><CloudUpload size={23} /><strong>{t("create.video.common.uploadVideo")}</strong><small>{t("create.video.common.videoFormats")}</small></button>}</div><input ref={sourceInputRef} type="file" accept="video/mp4,video/webm" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void setAsset(file, "video"); event.currentTarget.value = ""; }} /></section>
      <section className={`${styles.panel} ${styles.videoPromptPanel}`}>
        <div className={styles.videoPromptHeading}>
          <h2>{t("create.video.common.prompt")} <small>({t("create.video.common.required")})</small></h2>
          <span className={`${styles.videoPromptAnnotation} ${locale === "th" ? styles.videoPromptAnnotationThai : ""}`} aria-hidden="true" />
        </div>
        <label className={styles.videoPromptInputLabel}>
          <textarea className={styles.videoPromptTextarea} value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder={t("create.video.extend.promptPlaceholder")} maxLength={4000} required aria-required="true" />
        </label>
        <div className={styles.videoPromptMeta}>
          <span>{t("create.video.common.maximumCharacters", { count: 4000 })}</span>
          <span>{prompt.length.toLocaleString()} / 4,000</span>
        </div>
        <PromptOptimizerToggle enabled={promptOptimizerEnabled} onChange={setPromptOptimizerEnabled} />
        <label className={styles.peopleFieldLabel}>{t("create.video.common.negativePrompt")} <small>({t("create.video.common.optional")})</small><input value={negativePrompt} onChange={(event) => setNegativePrompt(event.target.value)} placeholder={t("create.video.extend.negativePlaceholder")} /></label>
      </section>
      {audioParameter ? <section className={styles.panel}><div className={styles.sectionTitle}><h2>3. {t("create.video.common.optionalAudio")}</h2></div>{audio ? <div className={styles.peopleNotice}>{audio.name}<button type="button" onClick={() => setAudio(null)} aria-label={t("create.video.common.removeAudio")}><X size={13} /></button></div> : <button type="button" className={styles.upload} onClick={() => audioInputRef.current?.click()}><CloudUpload size={20} /><strong>{t("create.video.common.uploadAudioReference")}</strong><small>{t("create.video.common.audioFormats")}</small></button>}<input ref={audioInputRef} type="file" accept="audio/mpeg,audio/wav,audio/x-wav,audio/mp4" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void setAsset(file, "audio"); event.currentTarget.value = ""; }} /></section> : null}
    </div>
      <div className={styles.centerColumn}><section className={`${styles.previewPanel} ${styles.videoPreviewPanel}`}><div className={styles.videoPreview}><VideoPreviewLiveBadge />{isGenerating ? <div className={styles.videoGeneratingPreview} aria-busy="true"><Plus size={26} /><strong>{state === "uploading" ? t("create.video.common.preparingVideo") : t("create.video.common.generatingVideo")}</strong><span>{notice ?? t("create.video.extend.generatingNotice")}</span><div className={styles.videoGenerationProgress}><i style={{ width: `${progress || 12}%` }} /></div><small>{progress ? t("create.video.common.percentComplete", { percent: progress }) : t("create.video.common.working")}</small></div> : displayedVideoUrl ? <EosVideoPlayer src={displayedVideoUrl} className={`${styles.generatedVideoPlayer} ${styles.motionGeneratedVideoPlayer}`} mediaFrameClassName={styles.videoPreviewMediaFrame} ariaLabel={t("create.video.common.generatedVideo")} /> : selected?.previewUrl ? <ModelPreviewMedia url={selected.previewUrl} type={selected.previewType} alt={`${selected.displayName} model preview`} className={`${styles.generatedVideoPlayer} ${styles.motionGeneratedVideoPlayer}`} frameClassName={styles.videoPreviewMediaFrame} /> : <VideoPreviewPlaceholder />}{displayedVideoUrl ? <VideoPreviewOverlayActions videoUrl={displayedVideoUrl} /> : null}</div></section><VideoResultLibrary feature="extend-video" currentVideoUrl={finalVideoUrl} currentSourceGenerationId={generationId} selectedVideoUrl={displayedVideoUrl} refreshKey={libraryRefreshKey} onVideoSelect={(url) => setPreviewVideoUrl(url)} /></div>
     <aside className={styles.settings}><div className={styles.sectionTitle}><h2>4. {t("create.video.common.settings")}</h2></div><label className="mb-2 flex items-center gap-1 text-[10px] font-bold">{t("create.video.common.model")} <Info size={11} /></label><VideoModelDropdown models={models} value={selectedModel} loading={modelsLoading} ariaLabel={t("create.video.common.modelOptions", { feature: t("create.video.tabs.extendVideo") })} placeholder={t("create.video.common.noFeatureModel", { feature: t("create.video.tabs.extendVideo") })} onChange={setSelectedModel} />{modelsError ? <p className={styles.settingsError}>{modelsError}</p> : null}{resolutionProperty ? <SchemaField name={resolutionProperty[0]} property={resolutionProperty[1]} value={resolution} required={required.has(resolutionProperty[0])} onChange={setResolution} /> : null}{durationProperty ? <div className={styles.settingBlock}><div className={styles.settingLabel}><span>{t("create.video.common.duration")}</span><strong>{duration ?? t("create.video.common.auto")} {t("create.video.common.seconds")}</strong></div><input type="range" min={durationProperty[1].minimum ?? 2} max={durationProperty[1].maximum ?? 15} step={durationProperty[1].step ?? 1} value={duration ?? durationProperty[1].minimum ?? 2} onChange={(event) => setDuration(Number(event.target.value))} aria-label={t("create.video.common.duration")} /><div className={styles.rangeLabels}><span>{durationProperty[1].minimum ?? 2}{t("create.video.common.secondsShort")}</span><span>{durationProperty[1].maximum ?? 15}{t("create.video.common.secondsShort")}</span></div></div> : null}{modelParameterEntries.length ? <div className={styles.sceneModelParams}><div className={styles.sceneModelParamsTitle}>{t("create.video.common.modelParameters")}</div>{modelParameterEntries.map(([name, property]) => <SchemaField key={name} name={name} property={property} value={modelParams[name]} required={required.has(name)} onChange={(value) => setModelParams((current) => ({ ...current, [name]: value }))} />)}</div> : null}<VideoCreditEstimate featureLabel={t("create.video.tabs.extendVideo")} duration={duration} estimate={videoCreditEstimate}>{!isGenerating ? <p className={styles.settingsError} role="status">{modelsLoading ? t("create.video.common.loadingModels", { feature: t("create.video.tabs.extendVideo") }) : validationMessage}</p> : null}{error ? <p className={styles.settingsError} role="alert">{error}</p> : null}{isGenerating ? <button type="button" className={styles.textVideoCancel} onClick={() => void handleCancel()}>{t("create.video.common.cancelGenerationSentence")}</button> : null}<button type="button" className={styles.generate} onClick={() => void handleGenerate()} disabled={!isComplete || isGenerating}><Plus size={18} /> {isGenerating ? t("create.video.common.generating") : t("create.video.extend.title")}</button></VideoCreditEstimate>{notice && !isGenerating ? <p className={styles.peopleNotice}>{notice}</p> : null}</aside>
  </div>;
}
