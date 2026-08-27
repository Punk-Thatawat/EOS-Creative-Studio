"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, CloudUpload, Info, Plus, X } from "lucide-react";
import { EosVideoPlayer } from "@/components/media/eos-video-player";
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
import { VideoPreviewOverlayActions, VideoPreviewPlaceholder } from "./video-preview-placeholder";
import { emitGenerationStarted } from "@/lib/generation-progress-events";
import { validateMediaFile } from "@/lib/media/upload-validation";
import { useVideoCreditEstimate, VideoCreditEstimate } from "./components/video-credit-estimate";
import styles from "./video-generation-page.module.css";
import { modelTier, modelTierClass } from "./model-tier";

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

type VideoAsset = { url: string; file: File; name: string };
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

function labelFor(name: string): string {
  return name.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
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
  const label = property.title ?? labelFor(name);
  if (property.enum?.length) return <label className={styles.dynamicField}><span>{label}{required ? <b>*</b> : null}</span><select className={styles.dynamicSelect} value={value === undefined ? "" : String(value)} onChange={(event) => onChange(parseValue(event.target.value, property))} aria-required={required}>{!required ? <option value="">Auto</option> : null}{property.enum.map((option) => <option key={String(option)} value={String(option)}>{String(option)}</option>)}</select>{property.description ? <small>{property.description}</small> : null}</label>;
  if (property.type === "boolean") return <div className={styles.toggleRow}>{label}{required ? <b>*</b> : null}<button type="button" className={styles.toggle} aria-pressed={Boolean(value)} onClick={() => onChange(!Boolean(value))}><i /></button></div>;
  const numeric = property.type === "integer" || property.type === "number";
  return <label className={styles.dynamicField}><span>{label}{required ? <b>*</b> : null}</span><input className={styles.dynamicInput} type={numeric ? "number" : "text"} value={value === undefined ? "" : String(value)} min={property.minimum} max={property.maximum} step={property.step ?? (property.type === "integer" ? 1 : "any")} onChange={(event) => onChange(parseValue(event.target.value, property))} aria-required={required} />{property.description ? <small>{property.description}</small> : null}</label>;
}

function responseStatus(payload: ExtendVideoGenerationResponse): ExtendVideoGenerationStatus {
  return { ...payload, status: payload.status ?? "queued" } as ExtendVideoGenerationStatus;
}

export function ExtendVideoWorkspace() {
  const [models, setModels] = useState<GenerationModelOption[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [modelsLoading, setModelsLoading] = useState(true);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [sourceVideo, setSourceVideo] = useState<VideoAsset | null>(null);
  const [audio, setAudio] = useState<VideoAsset | null>(null);
  const [prompt, setPrompt] = useState("");
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
  const [submitAttempted, setSubmitAttempted] = useState(false);
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
    }).catch((reason: unknown) => { if (active) setModelsError(reason instanceof Error ? reason.message : "Unable to load Extend Video models"); }).finally(() => { if (active) setModelsLoading(false); });
    return () => { active = false; };
  }, []);

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
    setSubmitAttempted(false);
  };

  const missingParameter = modelParameterEntries.find(([name]) => required.has(name) && !hasValue(modelParams[name]));
  const isComplete = Boolean(!modelsLoading && selectedModel && sourceVideo && prompt.trim() && (!videoParameter || sourceVideo) && (!promptParameter || prompt.trim()) && (!resolutionProperty || !required.has(resolutionProperty[0]) || hasValue(resolution)) && (!durationProperty || !required.has(durationProperty[0]) || hasValue(duration)) && !missingParameter);
  const validationMessage = !selectedModel ? "Select an Extend Video model." : !sourceVideo ? "Upload a source video." : !prompt.trim() ? "Prompt is required." : missingParameter ? `${labelFor(missingParameter[0])} is required for this model.` : null;

  const handleGenerate = async () => {
    setSubmitAttempted(true);
    if (!isComplete || !sourceVideo) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setError(null); setNotice(null); setFinalVideoUrl(null); setPreviewVideoUrl(null); setProgress(0); setState("uploading");
    try {
      setNotice("Uploading source video…");
      const sourceVideoUrl = await uploadPeopleMedia(sourceVideo.file, controller.signal, selected?.capabilities.uploadConstraints);
      let audioUrl: string | undefined;
      if (audio && audioParameter) { setNotice("Uploading audio…"); audioUrl = await uploadPeopleMedia(audio.file, controller.signal, selected?.capabilities.uploadConstraints); }
      const request: Parameters<typeof createExtendVideoGeneration>[0] = { model: selectedModel, sourceVideo: sourceVideoUrl, prompt: prompt.trim() };
      if (negativePrompt.trim()) request.negativePrompt = negativePrompt.trim();
      if (audioUrl) request.audioUrl = audioUrl;
      if (duration !== undefined) request.duration = duration;
      if (hasValue(resolution)) request.resolution = String(resolution);
      if (Object.keys(modelParams).length) request.modelParams = modelParams;
      setState("processing"); setNotice("Submitting Extend Video generation…");
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
          setProgress(currentProgress); setNotice(`Extending video… ${currentProgress}%`);
          if (["completed", "failed", "cancelled"].includes(status.status)) break;
          await new Promise<void>((resolve, reject) => { const timeout = window.setTimeout(resolve, 2200); controller.signal.addEventListener("abort", () => { window.clearTimeout(timeout); reject(new DOMException("Generation cancelled", "AbortError")); }, { once: true }); });
        }
      }
      if (status.status !== "completed") throw new Error(status.errorMessage ?? `Extend Video generation ${status.status}`);
      const url = outputUrl(status);
      if (!url) throw new Error("Extend Video completed without an output URL");
      setFinalVideoUrl(url); setPreviewVideoUrl(url); setProgress(100); setState("completed"); setLibraryRefreshKey((value) => value + 1); setNotice("Video ready");
    } catch (reason: unknown) {
      if (controller.signal.aborted) return;
      setState("failed"); setNotice(null); setError(reason instanceof Error ? reason.message : "Unable to extend video");
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  };

  const handleCancel = async () => {
    const id = generationId;
    if (id) await cancelExtendVideoGeneration(id).catch(() => undefined);
    abortRef.current?.abort();
    setState("cancelled"); setNotice("Generation cancelled");
  };

  const displayedVideoUrl = previewVideoUrl ?? finalVideoUrl;
  const videoCreditEstimate = useVideoCreditEstimate(selectedModel ? {
    feature: "extend-video",
    model: selectedModel,
    prompt: prompt.trim() || undefined,
    negativePrompt: negativePrompt.trim() || undefined,
    duration,
    resolution,
    modelParams,
  } : null);
  return <div className={styles.columns}>
    <div className={styles.leftColumn}>
      <section className={styles.panel}><section className={styles.videoModePanel} aria-labelledby="extend-video-title"><div className={styles.videoModeHeading}><h2 id="extend-video-title">EXTEND VIDEO</h2><Info size={11} /></div><p className={styles.textVideoDescription}>Continue an existing video with a new prompt-guided segment.</p></section></section>
      <section className={styles.panel}><div className={styles.sectionTitle}><h2>1. SOURCE VIDEO</h2></div><div className={`${styles.peopleSourcePreview} ${!sourceVideo ? styles.peopleSourceUploadEmpty : ""}`}>{sourceVideo ? <div className={styles.peopleSourceMedia}><video src={sourceVideo.url} muted playsInline controls={false} /><button type="button" onClick={() => setSourceVideo(null)} aria-label="Remove source video"><X size={14} /></button></div> : <button type="button" className={styles.upload} onClick={() => sourceInputRef.current?.click()}><CloudUpload size={23} /><strong>Upload Video</strong><small>MP4 / WEBM</small></button>}</div><input ref={sourceInputRef} type="file" accept="video/mp4,video/webm" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void setAsset(file, "video"); event.currentTarget.value = ""; }} /></section>
      <section className={styles.panel}><div className={styles.sectionTitle}><h2>2. PROMPT</h2></div><label className={styles.peopleFieldLabel}>Describe the continuation <small>(Required)</small><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Continue the camera movement naturally, keep the same subject, lighting, and style…" /></label><span className={styles.counter}>{prompt.length} / 4000</span><label className={styles.peopleFieldLabel}>Negative Prompt <small>(Optional)</small><input value={negativePrompt} onChange={(event) => setNegativePrompt(event.target.value)} placeholder="blurry, jump cut, flicker, distorted subject" /></label></section>
      {audioParameter ? <section className={styles.panel}><div className={styles.sectionTitle}><h2>3. OPTIONAL AUDIO</h2></div>{audio ? <div className={styles.peopleNotice}>{audio.name}<button type="button" onClick={() => setAudio(null)} aria-label="Remove audio"><X size={13} /></button></div> : <button type="button" className={styles.upload} onClick={() => audioInputRef.current?.click()}><CloudUpload size={20} /><strong>Upload audio reference</strong><small>MP3 / WAV / M4A</small></button>}<input ref={audioInputRef} type="file" accept="audio/mpeg,audio/wav,audio/x-wav,audio/mp4" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void setAsset(file, "audio"); event.currentTarget.value = ""; }} /></section> : null}
    </div>
    <div className={styles.centerColumn}><section className={styles.previewPanel}><div className={styles.sectionTitle}><h2>PREVIEW</h2></div><div className={styles.videoPreview}>{isGenerating ? <div className={styles.videoGeneratingPreview} aria-busy="true"><Plus size={26} /><strong>{state === "uploading" ? "PREPARING VIDEO" : "EXTENDING VIDEO"}</strong><span>{notice ?? "Working…"}</span><div className={styles.videoGenerationProgress}><i style={{ width: `${progress || 12}%` }} /></div><small>{progress ? `${progress}% complete` : "Waiting for provider…"}</small></div> : displayedVideoUrl ? <EosVideoPlayer src={displayedVideoUrl} className={`${styles.generatedVideoPlayer} ${styles.motionGeneratedVideoPlayer}`} ariaLabel="Extended video preview" /> : <VideoPreviewPlaceholder />}{displayedVideoUrl ? <VideoPreviewOverlayActions videoUrl={displayedVideoUrl} /> : null}</div></section><VideoResultLibrary feature="extend-video" currentVideoUrl={finalVideoUrl} selectedVideoUrl={displayedVideoUrl} refreshKey={libraryRefreshKey} onVideoSelect={(url) => setPreviewVideoUrl(url)} /></div>
    <aside className={styles.settings}><div className={styles.sectionTitle}><h2>4. SETTINGS</h2></div><label className="mb-2 flex items-center gap-1 text-[10px] font-bold">Model <Info size={11} /></label><div className={styles.modelDropdown}><button type="button" className={styles.modelDropdownTrigger} aria-haspopup="listbox" aria-expanded={modelMenuOpen} disabled={modelsLoading || models.length === 0} onClick={() => setModelMenuOpen((open) => !open)}><span><strong>{modelsLoading ? "Loading Extend Video models…" : selected?.displayName ?? "No Extend Video model"}</strong><span className={styles.modelProviderRow}>{selected ? <b className={`${styles.modelTierBadge} ${styles[modelTierClass(modelTier(selected, Math.max(0, models.findIndex((item) => item.model === selectedModel))))]}`}>{modelTier(selected, Math.max(0, models.findIndex((item) => item.model === selectedModel)))}</b> : null}</span></span><ChevronDown size={17} /></button>{modelMenuOpen ? <div className={styles.modelDropdownMenu} role="listbox" aria-label="Extend Video model options">{models.map((option, index) => <button key={option.model} type="button" role="option" aria-selected={option.model === selectedModel} onClick={() => { setSelectedModel(option.model); setModelMenuOpen(false); }}><span><strong>{option.displayName}</strong><span className={styles.modelProviderRow}><b className={`${styles.modelTierBadge} ${styles[modelTierClass(modelTier(option, index))]}`}>{modelTier(option, index)}</b></span></span></button>)}</div> : null}</div>{modelsError ? <p className={styles.settingsError}>{modelsError}</p> : null}{resolutionProperty ? <SchemaField name={resolutionProperty[0]} property={resolutionProperty[1]} value={resolution} required={required.has(resolutionProperty[0])} onChange={setResolution} /> : null}{durationProperty ? <div className={styles.settingBlock}><div className={styles.settingLabel}><span>{durationProperty[1].title ?? "Duration"}</span><strong>{duration ?? "Auto"} sec</strong></div><input type="range" min={durationProperty[1].minimum ?? 2} max={durationProperty[1].maximum ?? 15} step={durationProperty[1].step ?? 1} value={duration ?? durationProperty[1].minimum ?? 2} onChange={(event) => setDuration(Number(event.target.value))} aria-label="Duration" /><div className={styles.rangeLabels}><span>{durationProperty[1].minimum ?? 2}s</span><span>{durationProperty[1].maximum ?? 15}s</span></div></div> : null}{modelParameterEntries.length ? <div className={styles.sceneModelParams}><div className={styles.sceneModelParamsTitle}>MODEL PARAMETERS</div>{modelParameterEntries.map(([name, property]) => <SchemaField key={name} name={name} property={property} value={modelParams[name]} required={required.has(name)} onChange={(value) => setModelParams((current) => ({ ...current, [name]: value }))} />)}</div> : null}<VideoCreditEstimate featureLabel="Extend Video" duration={duration} estimate={videoCreditEstimate}>{isGenerating ? <button type="button" className={styles.textVideoCancel} onClick={() => void handleCancel()}>Cancel generation</button> : null}<button type="button" className={styles.generate} onClick={() => void handleGenerate()} disabled={!isComplete || isGenerating}><Plus size={18} /> {isGenerating ? "GENERATING…" : "EXTEND VIDEO"}</button></VideoCreditEstimate>{submitAttempted && !isComplete ? <p className={styles.settingsError}>{modelsLoading ? "Loading Extend Video models…" : validationMessage}</p> : null}{error ? <p className={styles.settingsError}>{error}</p> : null}{notice && !isGenerating ? <p className={styles.peopleNotice}>{notice}</p> : null}</aside>
  </div>;
}
