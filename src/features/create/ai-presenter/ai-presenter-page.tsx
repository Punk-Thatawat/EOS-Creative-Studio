"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type MouseEvent as ReactMouseEvent } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, AudioLines, Check, ChevronDown, CloudUpload, GripVertical, LoaderCircle, LockKeyhole, Pause, Play, Plus, Search, Sparkles, Video, WandSparkles, X } from "lucide-react";
import { EosVideoPlayer } from "@/components/media/eos-video-player";
import { Dropdown } from "@/components/ui/dropdown";
import { InfoTooltip } from "@/features/create/components/info-tooltip";
import { useLocale } from "@/lib/i18n/locale-provider";
import { getAccountScopedStorageKey } from "@/lib/generation-progress-storage";
import { createTextToSpeech, getAudioCreditBalance, listAudioModels, listAudioVoices, quoteTextToSpeechScenes, type AudioCreditQuote, type AudioModel, type AudioVoice } from "@/lib/api/audio";
import { listGenerationModels, type GenerationModelOption } from "@/lib/api/generation-models";
import { uploadPeopleMedia } from "@/lib/api/people-video-generations";
import { composePresenterVideo, createVideoStoryboard, getVideoStoryboardStatus, quoteVideoStoryboard, type VideoStoryboardResponse, type VideoStoryboardStatus } from "@/lib/api/video-generations";
import { emitGenerationCompleted, emitGenerationRequestFailed, emitGenerationRequestFinished, emitGenerationStarted, emitGenerationSubmitting } from "@/lib/generation-progress-events";
import { formatGenerationError, generationErrorFromStatus } from "@/lib/api/generation-errors";
import { emitCreditBalanceChanged, requestCreditBalanceSync } from "@/lib/credits/credit-events";
import { VideoPreviewLiveBadge, VideoPreviewOverlayActions, VideoPreviewPlaceholder } from "../video-preview-placeholder";
import videoPreviewStyles from "../video-generation-page.module.css";
import styles from "./ai-presenter-page.module.css";

const sampleScript = "Welcome to EOS Creative Studio. Turn your ideas into stories, and your stories into impact.";
const voicePreviewScripts = {
  en: sampleScript,
  th: "นี่คือตัวอย่างเสียงภาษาไทยสำหรับตรวจสอบโทนเสียงและคุณภาพการพูด",
} as const;
const supportedPresenterImageTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
const supportedSceneMediaTypes = new Set(["image/png", "image/jpeg", "image/webp", "video/mp4", "video/webm"]);
const maxSceneMediaTotalBytes = 60 * 1024 * 1024;
const maxSceneDurationSeconds = 15;
const maxPresenterOptions = 8;
const sceneSpeechWarningSeconds = 13;
const maxSceneDirectionLength = 800;
const sceneTemplateOptions = ["Intro", "Key Message", "Product Highlight", "CTA"] as const;
const aiPresenterDraftStorageKey = "eos.generation.ai-presenter-draft.v1";
const aiPresenterDraftMediaDatabase = "eos.generation.ai-presenter-media.v1";
const toneOptions = [
  { label: "Corporate", value: "Premium" },
  { label: "Friendly", value: "Friendly" },
  { label: "Confident", value: "Dramatic" },
  { label: "Energetic", value: "Energetic" },
] as const;
const aspectOptions = ["16:9", "9:16", "1:1"] as const;
const elevenLabsModelAliases = new Set([
  "eleven_multilingual_v2",
  "eleven_flash_v2_5",
  "eleven_turbo_v2_5",
  "eleven_v3",
  "elevenlabs_multilingual_v2",
  "elevenlabs_flash_v2_5",
  "elevenlabs_turbo_v2_5",
  "elevenlabs_v3",
]);

type SourceMedia = { id: string; file?: File; fileName: string; previewUrl: string; kind: "image" | "video"; remoteUrl?: string; uploading: boolean; error?: string };
type SceneMedia = { file?: File; fileName: string; previewUrl: string; kind: "image" | "video"; remoteUrl?: string };
type AudioSceneSegment = { file: File; startSeconds: number; endSeconds: number; durationSeconds: number };
type SpeechPreview = { key: string; blob: Blob; url: string; durationSeconds: number; sceneAudio: AudioSceneSegment[]; remoteUrl?: string };
type PresenterVisualMode = "presenter" | "scene-only";
type PresenterScene = { id: string; title: string; script: string; direction: string; visualMode?: PresenterVisualMode; durationSeconds?: number; presenterId?: string; voiceId?: string; media?: SceneMedia; mediaError?: string };
type SavedAiPresenterScene = Omit<PresenterScene, "media" | "mediaError"> & { media?: { fileName: string; kind: SceneMedia["kind"]; remoteUrl?: string; hasFile: boolean } | null };
type SavedPresenterMedia = { id: string; fileName: string; kind: SourceMedia["kind"]; remoteUrl?: string; hasFile: boolean };
type SavedAiPresenterDraft = {
  version: 1;
  scenes: SavedAiPresenterScene[];
  activeSceneId: string;
  tone: string;
  language: string;
  pronunciation: string;
  sourceMedia: { id?: string; fileName: string; kind: SourceMedia["kind"]; remoteUrl?: string; defaultAsset?: string; hasFile: boolean } | null;
  presenterOptions?: SavedPresenterMedia[];
  selectedReferenceVideoModel: string;
  selectedAudioModel: string;
  selectedVoice: string;
  aspect: string;
};

function aiPresenterMediaStorageKey(mediaId: string): string {
  const sessionKey = getAccountScopedStorageKey(`${aiPresenterDraftStorageKey}.tab`);
  let sessionId = window.sessionStorage.getItem(sessionKey);
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    window.sessionStorage.setItem(sessionKey, sessionId);
  }
  return getAccountScopedStorageKey(`${aiPresenterDraftStorageKey}.media.${sessionId}.${mediaId}`);
}

function openAiPresenterDraftMediaDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is unavailable"));
      return;
    }
    const request = indexedDB.open(aiPresenterDraftMediaDatabase, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains("files")) database.createObjectStore("files");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open presenter draft storage"));
  });
}

async function saveAiPresenterDraftFile(mediaId: string, file: File): Promise<void> {
  const database = await openAiPresenterDraftMediaDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction("files", "readwrite");
      transaction.objectStore("files").put(file, aiPresenterMediaStorageKey(mediaId));
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Could not save presenter draft media"));
      transaction.onabort = () => reject(transaction.error ?? new Error("Presenter draft media save was cancelled"));
    });
  } finally {
    database.close();
  }
}

async function readAiPresenterDraftFile(mediaId: string): Promise<File | null> {
  const database = await openAiPresenterDraftMediaDatabase();
  try {
    return await new Promise<File | null>((resolve, reject) => {
      const request = database.transaction("files", "readonly").objectStore("files").get(aiPresenterMediaStorageKey(mediaId));
      request.onsuccess = () => resolve(request.result instanceof File ? request.result : null);
      request.onerror = () => reject(request.error ?? new Error("Could not restore presenter draft media"));
    });
  } finally {
    database.close();
  }
}

async function deleteAiPresenterDraftFile(mediaId: string): Promise<void> {
  const database = await openAiPresenterDraftMediaDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction("files", "readwrite");
      transaction.objectStore("files").delete(aiPresenterMediaStorageKey(mediaId));
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Could not remove presenter draft media"));
      transaction.onabort = () => reject(transaction.error ?? new Error("Presenter draft media removal was cancelled"));
    });
  } finally {
    database.close();
  }
}

function baselineDuration(script: string, language: string): number {
  const text = script.trim();
  if (!text) return 3;
  const spokenUnits = language === "th" ? text.replace(/\s/g, "").length / 12 : text.split(/\s+/).length;
  return Math.max(3, Math.min(60, Math.ceil(spokenUnits / (language === "th" ? 1 : 2.45))));
}

function estimatedDuration(script: string, language: string, voicePace = 1): number {
  return Math.max(3, Math.min(60, Math.ceil(baselineDuration(script, language) * voicePace)));
}

function voicePaceForSample(sampleDuration: number | undefined, voiceId: string, language: string): number {
  if (!sampleDuration || !voiceId) return 1;
  return Math.max(0.65, Math.min(1.8, sampleDuration / baselineDuration(voicePreviewScripts[language === "th" ? "th" : "en"], language)));
}

function resolveSceneVoice(scene: PresenterScene, voices: AudioVoice[], defaultVoice: string): string {
  return scene.voiceId && voices.some((voice) => voice.key === scene.voiceId) ? scene.voiceId : defaultVoice;
}

function sceneDuration(scene: PresenterScene, language: string, voicePace = 1): number {
  return scene.durationSeconds ?? (scene.script.trim() ? estimatedDuration(scene.script, language, voicePace) : 0);
}

function generatedClipDuration(referenceAudioDuration: number): number {
  return Math.max(4, Math.ceil(referenceAudioDuration));
}

function sceneTemplateDirection(title: string, isThai: boolean): string {
  if (isThai) {
    if (title === "Intro") return "เปิดด้วยพรีเซนเตอร์มองกล้องและเกริ่นให้คนหยุดดู";
    if (title === "Key Message") return "ให้พรีเซนเตอร์อธิบายประเด็นหลักอย่างกระชับ";
    if (title === "Product Highlight") return "ตัดเป็นภาพสินค้า เน้นรายละเอียดหรือวิธีใช้ โดยไม่เพิ่มพรีเซนเตอร์ที่เลือกในซีนนี้";
    if (title === "CTA") return "กลับมาที่พรีเซนเตอร์ สรุปและชวนให้ลงมือทำ";
  } else {
    if (title === "Intro") return "Open with the presenter facing the camera and give viewers a reason to keep watching.";
    if (title === "Key Message") return "Have the presenter explain the main point clearly and briefly.";
    if (title === "Product Highlight") return "Cut to the product and show its details or use without adding the selected presenter to this scene.";
    if (title === "CTA") return "Return to the presenter for a concise close and call to action.";
  }
  return "";
}

function sceneScriptPlaceholder(title: string, isThai: boolean): string {
  if (title === "Intro") return isThai ? "เช่น วันนี้อยากชวนคุณมารู้จัก…" : "Example: Today, let me show you…";
  if (title === "Key Message") return isThai ? "เช่น จุดเด่นที่ทำให้สิ่งนี้แตกต่างคือ…" : "Example: What makes this different is…";
  if (title === "Product Highlight") return isThai ? "เช่น ใช้ง่ายในทุกวันและช่วยให้…" : "Example: It fits easily into your routine and helps…";
  if (title === "CTA") return isThai ? "เช่น ลองดูรายละเอียดเพิ่มเติมได้วันนี้…" : "Example: Explore the details and try it today…";
  return isThai ? "พิมพ์เฉพาะประโยคที่ต้องการให้อ่านออกเสียง…" : "Write only the words that should be spoken…";
}

function formatTimelineTime(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  return `${Math.floor(safeSeconds / 60).toString().padStart(2, "0")}:${(safeSeconds % 60).toString().padStart(2, "0")}`;
}

function outputVideoUrl(status: VideoStoryboardResponse | VideoStoryboardStatus): string | undefined {
  if ("finalVideoUrl" in status && typeof status.finalVideoUrl === "string") return status.finalVideoUrl;
  if ("videoUrl" in status && typeof status.videoUrl === "string") return status.videoUrl;
  const output = "output" in status && Array.isArray(status.output) ? status.output : [];
  const item = output.find((entry) => typeof entry?.url === "string" && entry.url);
  return item?.url;
}

function progressPercent(status: { status?: string; progress?: number }, fallback: number): number {
  if (status.status === "completed") return 100;
  const progress = Number(status.progress);
  if (!Number.isFinite(progress)) return fallback;
  return Math.max(0, Math.min(99, Math.round(progress <= 1 ? progress * 100 : progress)));
}

function encodeMonoWav(audio: AudioBuffer): Blob {
  const samples = audio.length;
  const wav = new ArrayBuffer(44 + samples * 2);
  const view = new DataView(wav);
  const writeAscii = (offset: number, value: string) => { for (let charIndex = 0; charIndex < value.length; charIndex += 1) view.setUint8(offset + charIndex, value.charCodeAt(charIndex)); };
  const sampleRate = audio.sampleRate;
  writeAscii(0, "RIFF"); view.setUint32(4, 36 + samples * 2, true); writeAscii(8, "WAVE");
  writeAscii(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  writeAscii(36, "data"); view.setUint32(40, samples * 2, true);
  const channels = Array.from({ length: audio.numberOfChannels }, (_, channel) => audio.getChannelData(channel));
  for (let sampleIndex = 0; sampleIndex < samples; sampleIndex += 1) {
    const mono = channels.reduce((sum, channel) => sum + (channel[sampleIndex] ?? 0), 0) / channels.length;
    view.setInt16(44 + sampleIndex * 2, Math.max(-1, Math.min(1, mono)) * (mono < 0 ? 0x8000 : 0x7fff), true);
  }
  return new Blob([wav], { type: "audio/wav" });
}

function trimQuietAudioOverhang(context: BaseAudioContext, audio: AudioBuffer, maxDurationSeconds: number): AudioBuffer {
  const maxSamples = Math.floor(maxDurationSeconds * audio.sampleRate);
  const overhangSeconds = (audio.length - maxSamples) / audio.sampleRate;
  if (audio.length <= maxSamples || overhangSeconds > 0.12) return audio;

  const channels = Array.from({ length: audio.numberOfChannels }, (_, channel) => audio.getChannelData(channel));
  const quietTailPeak = channels.reduce((peak, channel) => {
    for (let sampleIndex = maxSamples; sampleIndex < audio.length; sampleIndex += 1) {
      peak = Math.max(peak, Math.abs(channel[sampleIndex] ?? 0));
    }
    return peak;
  }, 0);
  if (quietTailPeak > 0.0025) return audio;

  const trimmed = context.createBuffer(audio.numberOfChannels, maxSamples, audio.sampleRate);
  channels.forEach((channel, index) => trimmed.copyToChannel(channel.subarray(0, maxSamples), index));
  return trimmed;
}

async function combineSceneAudio(blobs: Blob[]): Promise<{ blob: Blob; segments: AudioSceneSegment[]; durationSeconds: number }> {
  if (blobs.length === 0) throw new Error("Every scene needs its own generated voice track");
  const audioContext = new AudioContext();
  try {
    const decodedAudio = await Promise.all(blobs.map((blob) => blob.arrayBuffer().then((data) => audioContext.decodeAudioData(data))));
    const audioBuffers = decodedAudio.map((audio) => trimQuietAudioOverhang(audioContext, audio, maxSceneDurationSeconds));
    const sampleRate = audioContext.sampleRate;
    const segments: AudioSceneSegment[] = [];
    let cursorSeconds = 0;
    for (const [index, audio] of audioBuffers.entries()) {
      const durationSeconds = audio.duration;
      const endSeconds = cursorSeconds + durationSeconds;
      const wav = encodeMonoWav(audio);
      segments.push({
        file: new File([wav], `presenter-scene-${index + 1}.wav`, { type: "audio/wav" }),
        startSeconds: cursorSeconds,
        endSeconds,
        durationSeconds,
      });
      cursorSeconds = endSeconds;
    }
    const totalSamples = Math.max(1, Math.ceil(cursorSeconds * sampleRate));
    const offlineContext = new OfflineAudioContext(1, totalSamples, sampleRate);
    let startSeconds = 0;
    for (const audio of audioBuffers) {
      const source = offlineContext.createBufferSource();
      source.buffer = audio;
      source.connect(offlineContext.destination);
      source.start(startSeconds);
      startSeconds += audio.duration;
    }
    const combined = await offlineContext.startRendering();
    return { blob: encodeMonoWav(combined), segments, durationSeconds: cursorSeconds };
  } finally {
    await audioContext.close().catch(() => undefined);
  }
}

function waitForPoll(signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Generation cancelled", "AbortError"));
      return;
    }
    const timer = window.setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, 2500);
    const onAbort = () => {
      window.clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      reject(new DOMException("Generation cancelled", "AbortError"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function modelSupports(model: GenerationModelOption, kind: SourceMedia["kind"] | undefined): boolean {
  const capabilities = model.capabilities;
  const parameters = capabilities.parameters ?? [];
  if (parameters.length === 0) return false;
  if (kind === "video") return false;
  const hasAudioInput = Boolean(capabilities.audioParameter || capabilities.referenceAudiosParameter);
  const hasPresenterReference = Boolean(capabilities.referenceImagesParameter);
  const hasSceneImageInput = Boolean(capabilities.imageParameter || capabilities.referenceImagesParameter);
  return Boolean(capabilities.promptParameter && hasAudioInput && hasPresenterReference && hasSceneImageInput);
}

function presenterPrompt(script: string, direction: string, hasSceneBackground = false, visualMode: PresenterVisualMode = "presenter"): string {
  const sceneDirection = visualMode === "scene-only"
    ? "Use the supplied scene, product, or B-roll image as the visual source. Preserve any people or characters already present in it, but do not add the separately selected presenter. Keep the scene or product as the focus."
    : hasSceneBackground
      ? "Use the scene image as the background and preserve its setting, composition, and visible product. Add the person from the separate presenter reference image naturally into this scene; do not replace the scene image with the presenter reference."
      : "Keep the same person and outfit as the presenter reference image.";
  const visualDirection = direction.trim()
    ? `Follow these visual directions only; do not say them aloud: ${direction.trim()}`
    : visualMode === "scene-only"
      ? "Use slow, polished product-focused camera movement; keep the product or setting in focus."
      : "Use subtle natural head movement and keep the camera steady.";
  const performanceDirection = visualMode === "scene-only"
    ? "Keep the supplied narration as off-camera voiceover; do not lip-sync any person in the scene."
    : "A professional on-camera presenter speaks naturally to the viewer. Match facial expression, mouth movement, and timing to the provided reference audio.";
  return `${performanceDirection} ${sceneDirection} Use only the provided narration and speak only these words: "${script.trim()}" ${visualDirection}`;
}

function presenterSceneVisualInput(scene: PresenterScene, presenterImageUrl: string, sceneImageUrl?: string) {
  const visualMode = scene.visualMode ?? "presenter";
  if (visualMode === "scene-only") {
    const image = sceneImageUrl ?? presenterImageUrl;
    return {
      storyboardImage: image,
      referenceImages: image ? [image] : [],
      prompt: presenterPrompt(scene.script, scene.direction, Boolean(sceneImageUrl), visualMode),
    };
  }
  return {
    storyboardImage: sceneImageUrl ?? presenterImageUrl,
    referenceImages: presenterImageUrl ? [presenterImageUrl] : [],
    prompt: presenterPrompt(scene.script, scene.direction, Boolean(sceneImageUrl), visualMode),
  };
}

function isElevenLabsSpeechModel(model: AudioModel): boolean {
  const key = model.key.trim().toLowerCase();
  return key.startsWith("elevenlabs/") || elevenLabsModelAliases.has(key);
}

export function AiPresenterPage() {
  const { locale, t } = useLocale();
  const isThai = locale === "th";
  const sourceInputRef = useRef<HTMLInputElement>(null);
  const sceneMediaInputRef = useRef<HTMLInputElement>(null);
  const addSceneMediaInputRef = useRef<HTMLInputElement>(null);
  const addSceneButtonRef = useRef<HTMLButtonElement>(null);
  const sceneUploadControllersRef = useRef(new Map<string, AbortController>());
  const sceneMediaUrlsRef = useRef(new Map<string, string>());
  const presenterMediaUrlsRef = useRef(new Set<string>());
  const draftSaveQueueRef = useRef(Promise.resolve());
  const draftSaveRevisionRef = useRef(0);
  const persistedDraftFilesRef = useRef(new Map<string, File>());
  const knownDraftMediaIdsRef = useRef(new Set<string>());
  const uploadControllerRef = useRef<AbortController | null>(null);
  const generationControllerRef = useRef<AbortController | null>(null);
  const [draftRestoreComplete, setDraftRestoreComplete] = useState(false);
  const [scenes, setScenes] = useState<PresenterScene[]>([{ id: "scene-1", title: "Intro", script: sampleScript, direction: "" }]);
  const [activeSceneId, setActiveSceneId] = useState("scene-1");
  const [isAddSceneOpen, setIsAddSceneOpen] = useState(false);
  const [newSceneTitle, setNewSceneTitle] = useState("");
  const [newSceneVisualMode, setNewSceneVisualMode] = useState<PresenterVisualMode>("presenter");
  const [newSceneScript, setNewSceneScript] = useState("");
  const [newSceneDirection, setNewSceneDirection] = useState("");
  const [newScenePresenterId, setNewScenePresenterId] = useState("");
  const [newSceneVoiceId, setNewSceneVoiceId] = useState("");
  const [newSceneMedia, setNewSceneMedia] = useState<SceneMedia | null>(null);
  const [newSceneMediaError, setNewSceneMediaError] = useState("");
  const [newSceneError, setNewSceneError] = useState("");
  const [isReorderingScenes, setIsReorderingScenes] = useState(false);
  const [tone, setTone] = useState<(typeof toneOptions)[number]["value"]>("Premium");
  const [language, setLanguage] = useState("en");
  const [pronunciation, setPronunciation] = useState("");
  const [sourceMedia, setSourceMedia] = useState<SourceMedia | null>(null);
  const [presenterOptions, setPresenterOptions] = useState<SourceMedia[]>([]);
  const [referenceVideoModels, setReferenceVideoModels] = useState<GenerationModelOption[]>([]);
  const [audioModels, setAudioModels] = useState<AudioModel[]>([]);
  const [voices, setVoices] = useState<AudioVoice[]>([]);
  const [selectedReferenceVideoModel, setSelectedReferenceVideoModel] = useState("");
  const [selectedAudioModel, setSelectedAudioModel] = useState("");
  const [selectedVoice, setSelectedVoice] = useState("");
  const [aspect, setAspect] = useState<(typeof aspectOptions)[number]>("16:9");
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [catalogError, setCatalogError] = useState("");
  const [speechQuote, setSpeechQuote] = useState<AudioCreditQuote | null>(null);
  const [speechQuoteLoading, setSpeechQuoteLoading] = useState(false);
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [creditBalanceLoading, setCreditBalanceLoading] = useState(true);
  const [creditPreflightBusy, setCreditPreflightBusy] = useState(false);
  const [speech, setSpeech] = useState<SpeechPreview | null>(null);
  const [voiceSampleDurations, setVoiceSampleDurations] = useState<Record<string, number>>({});
  const [generationStatus, setGenerationStatus] = useState<"idle" | "uploading" | "processing" | "completed" | "failed">("idle");
  const [generationProgress, setGenerationProgress] = useState(0);
  const [finalVideoUrl, setFinalVideoUrl] = useState("");
  const [generationError, setGenerationError] = useState("");
  const [notice, setNotice] = useState("");

  const script = useMemo(() => scenes.map((scene) => scene.script).join("\n\n").trim(), [scenes]);
  const activeScene = scenes.find((scene) => scene.id === activeSceneId) ?? scenes[0];
  const activeSceneIndex = activeScene ? scenes.findIndex((scene) => scene.id === activeScene.id) : -1;
  const allScenesHaveScript = scenes.every((scene) => Boolean(scene.script.trim()));
  const sceneVoiceIds = useMemo(() => scenes.map((scene) => resolveSceneVoice(scene, voices, selectedVoice)), [scenes, voices, selectedVoice]);
  const scenePresenters = useMemo(() => scenes.map((scene) => scene.presenterId
    ? presenterOptions.find((presenter) => presenter.id === scene.presenterId) ?? sourceMedia
    : sourceMedia), [scenes, presenterOptions, sourceMedia]);
  const allScenesHaveVoice = sceneVoiceIds.length === scenes.length && sceneVoiceIds.every((voiceId) => Boolean(voiceId) && voices.some((voice) => voice.key === voiceId));
  const allSceneVisualsReady = scenePresenters.length === scenes.length && scenes.every((scene, index) => {
    const presenter = scenePresenters[index];
    if (scene.visualMode === "scene-only" && scene.media?.kind === "image") {
      return Boolean(scene.media.remoteUrl) && !scene.mediaError;
    }
    return Boolean(presenter?.remoteUrl) && !presenter?.uploading && !presenter?.error;
  });
  const missingSceneVisual = scenes.find((scene) => scene.visualMode === "scene-only" && !scene.media);
  const activeSceneVoiceId = activeSceneIndex >= 0 ? sceneVoiceIds[activeSceneIndex] ?? selectedVoice : selectedVoice;
  const selectedVoiceInfo = voices.find((voice) => voice.key === activeSceneVoiceId);
  const voiceSampleKey = JSON.stringify([selectedAudioModel, activeSceneVoiceId]);
  const sampleDuration = voiceSampleDurations[voiceSampleKey] ?? null;
  const voicePace = voicePaceForSample(sampleDuration ?? undefined, activeSceneVoiceId, language);
  const speechKey = JSON.stringify([scenes.map((scene) => scene.script.trim()), sceneVoiceIds, selectedAudioModel, language, tone, pronunciation.trim()]);
  const presenterRoutingKey = JSON.stringify(scenes.map((scene) => scene.presenterId ?? ""));
  const currentSpeech = speech?.key === speechKey ? speech : null;
  const activeSceneAudioDuration = activeSceneIndex >= 0 ? currentSpeech?.sceneAudio[activeSceneIndex]?.durationSeconds : undefined;
  const activeSceneSpeechDuration = activeSceneAudioDuration ?? (activeScene?.script.trim() ? estimatedDuration(activeScene.script, language, voicePace) : null);
  const sceneDurationOptions = [
    { value: "auto", label: isThai ? "อัตโนมัติ" : "Auto" },
    ...Array.from({ length: maxSceneDurationSeconds }, (_, index) => {
      const seconds = index + 1;
      return { value: String(seconds), label: isThai ? `${seconds} วินาที` : `${seconds} sec` };
    }),
  ];
  const sceneTimeline = useMemo(() => {
    let elapsedSeconds = 0;
    return scenes.map((scene, index) => {
      const start = elapsedSeconds;
      const voiceId = sceneVoiceIds[index] ?? selectedVoice;
      const sampleKey = JSON.stringify([selectedAudioModel, voiceId]);
      const sceneVoicePace = voicePaceForSample(voiceSampleDurations[sampleKey], voiceId, language);
      const durationSeconds = currentSpeech?.sceneAudio[index]?.durationSeconds ?? sceneDuration(scene, language, sceneVoicePace);
      elapsedSeconds += durationSeconds;
      return { scene, start, end: elapsedSeconds };
    });
  }, [currentSpeech, language, scenes, sceneVoiceIds, selectedAudioModel, selectedVoice, voiceSampleDurations]);
  const sceneTimelineDuration = sceneTimeline.at(-1)?.end ?? 0;
  const overlongSceneAudioIndex = currentSpeech?.sceneAudio.findIndex((segment) => segment.durationSeconds > maxSceneDurationSeconds) ?? -1;
  const sceneReferenceAudioTooLong = overlongSceneAudioIndex >= 0 || sceneTimeline.some(({ start, end }) => end - start > maxSceneDurationSeconds);
  const otherSceneTextLength = scenes.reduce((length, scene) => scene.id === activeScene?.id ? length : length + scene.script.length, 0) + Math.max(0, scenes.length - 1) * 2;
  const activeSceneMaxLength = Math.max(activeScene?.script.length ?? 0, 5000 - otherSceneTextLength);
  const canAddScene = scenes.length < 6 && script.length + 2 <= 5000;

  useEffect(() => {
    let cancelled = false;
    const restoreDraft = async () => {
      try {
        const raw = window.sessionStorage.getItem(getAccountScopedStorageKey(aiPresenterDraftStorageKey));
        if (!raw) return;
        const draft = JSON.parse(raw) as Partial<SavedAiPresenterDraft>;
        if (draft.version !== 1 || !Array.isArray(draft.scenes) || draft.scenes.length === 0) return;
        const savedScenes = draft.scenes.filter((scene): scene is SavedAiPresenterScene =>
          Boolean(scene && typeof scene.id === "string" && typeof scene.title === "string" && typeof scene.script === "string"),
        ).slice(0, 6);
        if (!savedScenes.length) return;

        const restoredScenes = await Promise.all(savedScenes.map(async (scene) => {
          const mediaId = `scene:${scene.id}`;
          const file = scene.media?.hasFile ? await readAiPresenterDraftFile(mediaId).catch(() => null) : null;
          const previewUrl = file ? URL.createObjectURL(file) : scene.media?.remoteUrl ?? "";
          if (file) {
            sceneMediaUrlsRef.current.set(scene.id, previewUrl);
            persistedDraftFilesRef.current.set(mediaId, file);
            knownDraftMediaIdsRef.current.add(mediaId);
          }
          return {
            id: scene.id,
            title: scene.title,
            script: scene.script,
            direction: typeof scene.direction === "string" ? scene.direction : "",
            visualMode: scene.visualMode === "scene-only" ? "scene-only" : "presenter",
            durationSeconds: Number.isFinite(scene.durationSeconds) ? scene.durationSeconds : undefined,
            presenterId: typeof scene.presenterId === "string" ? scene.presenterId : undefined,
            voiceId: typeof scene.voiceId === "string" ? scene.voiceId : undefined,
            media: scene.media ? { file: file ?? undefined, fileName: scene.media.fileName, kind: scene.media.kind, previewUrl, remoteUrl: scene.media.remoteUrl } : undefined,
            mediaError: scene.media?.hasFile && !file && !scene.media.remoteUrl
              ? "draft-media-missing"
              : undefined,
          } satisfies PresenterScene;
        }));
        const savedSource = draft.sourceMedia;
        const savedOptions = Array.isArray(draft.presenterOptions) ? draft.presenterOptions : [];
        const legacySourceId = savedSource?.id ?? "presenter-legacy";
        const optionsToRestore = savedOptions.length
          ? savedOptions
          : savedSource && !savedSource.defaultAsset
            ? [{ id: legacySourceId, fileName: savedSource.fileName, kind: savedSource.kind, remoteUrl: savedSource.remoteUrl, hasFile: savedSource.hasFile }]
            : [];
        const restoredPresenters = await Promise.all(optionsToRestore.map(async (option) => {
          const file = option.hasFile
            ? await readAiPresenterDraftFile(`presenter:${option.id}`).catch(() => null)
              ?? (option.id === legacySourceId ? await readAiPresenterDraftFile("source").catch(() => null) : null)
            : null;
          const previewUrl = file ? URL.createObjectURL(file) : option.remoteUrl ?? "";
          if (file) {
            presenterMediaUrlsRef.current.add(previewUrl);
            persistedDraftFilesRef.current.set(`presenter:${option.id}`, file);
            knownDraftMediaIdsRef.current.add(`presenter:${option.id}`);
            if (!savedOptions.length && option.id === legacySourceId) knownDraftMediaIdsRef.current.add("source");
          }
          return {
            id: option.id,
            file: file ?? undefined,
            fileName: option.fileName,
            previewUrl,
            kind: option.kind === "video" ? "video" : "image",
            remoteUrl: option.remoteUrl,
            uploading: false,
            error: option.hasFile && !file && !option.remoteUrl ? "draft-media-missing" : undefined,
          } satisfies SourceMedia;
        }));
        if (cancelled) {
          restoredScenes.forEach((scene) => { if (scene.media?.previewUrl.startsWith("blob:")) URL.revokeObjectURL(scene.media.previewUrl); });
          restoredPresenters.forEach((presenter) => { if (presenter.previewUrl.startsWith("blob:")) URL.revokeObjectURL(presenter.previewUrl); });
          return;
        }
        setScenes(restoredScenes);
        setActiveSceneId(typeof draft.activeSceneId === "string" && restoredScenes.some((scene) => scene.id === draft.activeSceneId) ? draft.activeSceneId : restoredScenes[0]!.id);
        if (typeof draft.tone === "string" && toneOptions.some((option) => option.value === draft.tone)) setTone(draft.tone as (typeof toneOptions)[number]["value"]);
        if (typeof draft.language === "string") setLanguage(draft.language);
        if (typeof draft.pronunciation === "string") setPronunciation(draft.pronunciation);
        if (typeof draft.selectedReferenceVideoModel === "string") setSelectedReferenceVideoModel(draft.selectedReferenceVideoModel);
        if (typeof draft.selectedAudioModel === "string") setSelectedAudioModel(draft.selectedAudioModel);
        if (typeof draft.selectedVoice === "string") setSelectedVoice(draft.selectedVoice);
        if (typeof draft.aspect === "string" && aspectOptions.some((option) => option === draft.aspect)) setAspect(draft.aspect as (typeof aspectOptions)[number]);
        setPresenterOptions(restoredPresenters);
        const selectedPresenter = restoredPresenters.find((presenter) => presenter.id === savedSource?.id)
          ?? restoredPresenters[0]
          ?? null;
        if (selectedPresenter) setSourceMedia(selectedPresenter);
        else setSourceMedia(null);
      } catch {
        // Keep the default draft if browser storage is unavailable or malformed.
      } finally {
        if (!cancelled) setDraftRestoreComplete(true);
      }
    };
    void restoreDraft();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!draftRestoreComplete) return;
    const source = sourceMedia;
    const fileEntries: Array<[string, File]> = [];
    const nextMediaIds = new Set<string>();
    if (source?.file) {
      fileEntries.push([`presenter:${source.id}`, source.file]);
      nextMediaIds.add(`presenter:${source.id}`);
    }
    const savedPresenterOptions: SavedPresenterMedia[] = presenterOptions.map((presenter) => {
      if (presenter.file) {
        fileEntries.push([`presenter:${presenter.id}`, presenter.file]);
        nextMediaIds.add(`presenter:${presenter.id}`);
      }
      return {
        id: presenter.id,
        fileName: presenter.fileName,
        kind: presenter.kind,
        remoteUrl: presenter.remoteUrl,
        hasFile: Boolean(presenter.file || (presenter.error && !presenter.remoteUrl)),
      };
    });
    const savedScenes: SavedAiPresenterScene[] = scenes.map((scene) => {
      const mediaId = `scene:${scene.id}`;
      if (scene.media?.file) {
        fileEntries.push([mediaId, scene.media.file]);
        nextMediaIds.add(mediaId);
      }
      return {
        id: scene.id,
        title: scene.title,
        script: scene.script,
        direction: scene.direction,
        visualMode: scene.visualMode ?? "presenter",
        durationSeconds: scene.durationSeconds,
        presenterId: scene.presenterId,
        voiceId: scene.voiceId,
        media: scene.media ? {
          fileName: scene.media.fileName,
          kind: scene.media.kind,
          remoteUrl: scene.media.remoteUrl,
          hasFile: Boolean(scene.media.file || scene.mediaError),
        } : null,
      };
    });
    const draft: SavedAiPresenterDraft = {
      version: 1,
      scenes: savedScenes,
      activeSceneId,
      tone,
      language,
      pronunciation,
      sourceMedia: source ? {
        id: source.id,
        fileName: source.fileName,
        kind: source.kind,
        remoteUrl: source.remoteUrl,
        hasFile: Boolean(source.file || (source.error && !source.remoteUrl)),
      } : null,
      presenterOptions: savedPresenterOptions,
      selectedReferenceVideoModel,
      selectedAudioModel,
      selectedVoice,
      aspect,
    };
    const revision = ++draftSaveRevisionRef.current;
    const draftStorageKey = getAccountScopedStorageKey(aiPresenterDraftStorageKey);
    draftSaveQueueRef.current = draftSaveQueueRef.current.catch(() => undefined).then(async () => {
      for (const [mediaId, file] of fileEntries) {
        if (persistedDraftFilesRef.current.get(mediaId) === file) continue;
        try {
          await saveAiPresenterDraftFile(mediaId, file);
          persistedDraftFilesRef.current.set(mediaId, file);
        } catch {
          // Text and settings still persist even when the browser cannot keep a local file.
        }
      }
      for (const mediaId of knownDraftMediaIdsRef.current) {
        if (nextMediaIds.has(mediaId)) continue;
        await deleteAiPresenterDraftFile(mediaId).catch(() => undefined);
        persistedDraftFilesRef.current.delete(mediaId);
      }
      knownDraftMediaIdsRef.current = nextMediaIds;
      if (revision !== draftSaveRevisionRef.current) return;
      try {
        window.sessionStorage.setItem(draftStorageKey, JSON.stringify(draft));
      } catch {
        // Session storage may be disabled or full; IndexedDB remains available for media.
      }
    });
  }, [draftRestoreComplete, scenes, activeSceneId, tone, language, pronunciation, sourceMedia, presenterOptions, selectedReferenceVideoModel, selectedAudioModel, selectedVoice, aspect]);

  const availableAudioModels = useMemo(() => audioModels.filter(isElevenLabsSpeechModel), [audioModels]);
  const availableReferenceVideoModels = useMemo(
    () => referenceVideoModels.filter((model) => model.enabled && modelSupports(model, sourceMedia?.kind)),
    [referenceVideoModels, sourceMedia?.kind],
  );
  const selectedVideoModel = availableReferenceVideoModels.find((model) => model.model === selectedReferenceVideoModel);
  const duration = currentSpeech?.durationSeconds ?? sceneTimelineDuration;
  const isGenerating = generationStatus === "uploading" || generationStatus === "processing";
  const isLocked = isGenerating || creditPreflightBusy;

  useEffect(() => {
    let active = true;
    void Promise.allSettled([listGenerationModels("ai-presenter"), listAudioModels("textToSpeech")]).then(([videoResult, audioResult]) => {
      if (!active) return;
      const errors: string[] = [];
      if (videoResult.status === "fulfilled") {
        const models = videoResult.value.filter((model) => model.enabled);
        setReferenceVideoModels(models);
        setSelectedReferenceVideoModel((current) => models.find((model) => model.model === current && modelSupports(model, undefined))?.model ?? models.find((model) => model.isDefault && modelSupports(model, undefined))?.model ?? models.find((model) => modelSupports(model, undefined))?.model ?? "");
      } else errors.push(isThai ? "โหลดโมเดลวิดีโอไม่สำเร็จ" : "Could not load presenter video models");
      if (audioResult.status === "fulfilled") {
        const models = audioResult.value.filter(isElevenLabsSpeechModel);
        setAudioModels(models);
        const selectedModel = models.find((model) => model.isActive)
          ?? models.find((model) => model.key.toLowerCase() === "eleven_v3")
          ?? models[0];
        setSelectedAudioModel((current) => models.some((model) => model.key === current) ? current : selectedModel?.key ?? "");
        if (!models.length) errors.push(isThai ? "ไม่พบโมเดลเสียง ElevenLabs ที่เปิดใช้งาน" : "No ElevenLabs speech model is available");
      } else errors.push(isThai ? "โหลดโมเดลเสียงไม่สำเร็จ" : "Could not load speech models");
      setCatalogError(errors.join(" · "));
      setCatalogLoading(false);
    });
    return () => { active = false; };
  }, [isThai]);

  useEffect(() => {
    if (!selectedAudioModel) {
      setVoices([]);
      setSelectedVoice("");
      return;
    }
    let active = true;
    setVoiceLoading(true);
    setVoices([]);
    void listAudioVoices(selectedAudioModel, "textToSpeech").then((items) => {
      if (!active) return;
      setVoices(items);
      setSelectedVoice((current) => items.some((voice) => voice.key === current) ? current : (items[0]?.key ?? ""));
      setScenes((current) => current.map((scene) => scene.voiceId && !items.some((voice) => voice.key === scene.voiceId) ? { ...scene, voiceId: undefined } : scene));
      setVoiceLoading(false);
    }).catch(() => {
      if (!active) return;
      setVoices([]);
      setSelectedVoice("");
      setVoiceLoading(false);
    });
    return () => { active = false; };
  }, [selectedAudioModel]);

  useEffect(() => {
    if (!selectedVideoModel) return;
    const ratios = selectedVideoModel.capabilities.supportedRatios ?? [];
    const supported = aspectOptions.filter((value) => ratios.some((ratio) => ratio.toLowerCase() === value.toLowerCase()));
    if (supported.length && !supported.includes(aspect)) setAspect(supported[0]);
  }, [selectedVideoModel, aspect]);

  useEffect(() => {
    if (!draftRestoreComplete || catalogLoading || !selectedReferenceVideoModel) return;
    if (!availableReferenceVideoModels.some((model) => model.model === selectedReferenceVideoModel)) {
      setSelectedReferenceVideoModel(availableReferenceVideoModels.find((model) => model.isDefault)?.model ?? availableReferenceVideoModels[0]?.model ?? "");
    }
  }, [draftRestoreComplete, catalogLoading, availableReferenceVideoModels, selectedReferenceVideoModel]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const ready = Boolean(script.trim() && allScenesHaveScript && allScenesHaveVoice && selectedAudioModel && !voiceLoading);
    if (!draftRestoreComplete || !ready) {
      setSpeechQuote(null);
      setSpeechQuoteLoading(false);
      return () => { active = false; controller.abort(); };
    }
    setSpeechQuoteLoading(true);
    const timer = window.setTimeout(() => {
      void quoteTextToSpeechScenes({
        scenes: scenes.map((scene, index) => ({ title: scene.title, text: scene.script.trim(), voice: sceneVoiceIds[index] ?? selectedVoice })),
        modelId: selectedAudioModel, outputFormat: "mp3", languageCode: language,
        tone, speed: 1, pronunciationHint: pronunciation.trim() || undefined,
      }, controller.signal).then((quote) => {
        if (active) setSpeechQuote(quote);
      }).catch(() => {
        if (active) setSpeechQuote(null);
      }).finally(() => {
        if (active) setSpeechQuoteLoading(false);
      });
    }, 350);
    return () => { active = false; controller.abort(); window.clearTimeout(timer); };
  }, [draftRestoreComplete, script, scenes, sceneVoiceIds, allScenesHaveScript, allScenesHaveVoice, selectedVoice, selectedAudioModel, language, tone, pronunciation, voiceLoading]);

  useEffect(() => {
    return () => {
      for (const previewUrl of presenterMediaUrlsRef.current) URL.revokeObjectURL(previewUrl);
      presenterMediaUrlsRef.current.clear();
    };
  }, []);

  useEffect(() => () => {
    for (const previewUrl of sceneMediaUrlsRef.current.values()) URL.revokeObjectURL(previewUrl);
    sceneMediaUrlsRef.current.clear();
  }, []);

  useEffect(() => {
    const previewUrl = speech?.url;
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); };
  }, [speech?.url]);

  useEffect(() => {
    if (speech && speech.key !== speechKey) {
      URL.revokeObjectURL(speech.url);
      setSpeech(null);
    }
  }, [speech, speechKey]);

  useEffect(() => {
    setFinalVideoUrl("");
    setGenerationError("");
    setNotice("");
    setGenerationStatus((status) => status === "completed" || status === "failed" ? "idle" : status);
  }, [speechKey, selectedReferenceVideoModel, aspect, sourceMedia?.id, sourceMedia?.remoteUrl, presenterRoutingKey]);

  const videoQuoteInput = useMemo(() => {
    if (!allSceneVisualsReady || missingSceneVisual || !selectedVideoModel || !script.trim() || sceneReferenceAudioTooLong) return null;
    return {
      model: selectedVideoModel.model,
      mode: "storyboard" as const,
      generationMode: "ai-presenter" as const,
      audioMode: "none" as const,
      duration: sceneTimeline.reduce((total, { start, end }) => total + generatedClipDuration(end - start), 0),
      aspectRatio: aspect,
      scenes: sceneTimeline.map(({ scene, start, end }, index) => {
        const presenterImageUrl = scenePresenters[index]?.remoteUrl ?? "";
        const sceneImageUrl = scene.media?.kind === "image" ? scene.media.remoteUrl : undefined;
        return {
          ...presenterSceneVisualInput(scene, presenterImageUrl, sceneImageUrl),
          startFrameSource: "manual" as const,
          duration: Math.min(maxSceneDurationSeconds, generatedClipDuration(end - start)),
        };
      }),
    };
  }, [allSceneVisualsReady, missingSceneVisual, scenePresenters, selectedVideoModel, script, sceneTimeline, sceneReferenceAudioTooLong, aspect]);
  const [videoCreditCost, setVideoCreditCost] = useState<number | null>(null);
  const [videoQuoteLoading, setVideoQuoteLoading] = useState(false);
  const estimatedCredits = speechQuote && videoCreditCost !== null
    ? speechQuote.creditCost + videoCreditCost
    : null;
  const requiredCreditCost = videoCreditCost !== null && (currentSpeech || speechQuote !== null)
    ? videoCreditCost + (currentSpeech ? 0 : speechQuote?.creditCost ?? 0)
    : null;
  const creditsSufficient = creditBalance !== null && requiredCreditCost !== null && creditBalance >= requiredCreditCost;
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    if (!videoQuoteInput) {
      setVideoCreditCost(null);
      setVideoQuoteLoading(false);
      return () => { active = false; controller.abort(); };
    }
    setVideoQuoteLoading(true);
    void quoteVideoStoryboard(videoQuoteInput, controller.signal).then((quote) => {
      if (active) setVideoCreditCost(Number.isFinite(Number(quote.totalCreditCost)) ? Number(quote.totalCreditCost) : null);
    }).catch(() => {
      if (active) setVideoCreditCost(null);
    }).finally(() => { if (active) setVideoQuoteLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [videoQuoteInput]);

  useEffect(() => {
    let active = true;
    setCreditBalanceLoading(true);
    void getAudioCreditBalance().then(({ balance }) => {
      if (active) setCreditBalance(balance);
    }).catch(() => {
      if (active) setCreditBalance(null);
    }).finally(() => {
      if (active) setCreditBalanceLoading(false);
    });
    return () => { active = false; };
  }, [requiredCreditCost]);

  const handleSourceChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;
    const validFiles = files.filter((file) => supportedPresenterImageTypes.has(file.type.toLowerCase()));
    if (validFiles.length !== files.length) {
      setGenerationError(isThai ? "ข้ามไฟล์ที่ไม่รองรับ · เลือกภาพ PNG, JPG หรือ WEBP เท่านั้น" : "Unsupported files were skipped. Choose PNG, JPG, or WEBP images.");
    } else {
      setGenerationError("");
    }
    const remaining = Math.max(0, maxPresenterOptions - presenterOptions.length);
    const selectedFiles = validFiles.slice(0, remaining);
    if (selectedFiles.length < validFiles.length) {
      setGenerationError(isThai ? `เพิ่มพรีเซนเตอร์ได้สูงสุด ${maxPresenterOptions} คน` : `You can add up to ${maxPresenterOptions} presenters.`);
    }
    if (!selectedFiles.length) {
      if (!remaining) setGenerationError(isThai ? `มีพรีเซนเตอร์ครบ ${maxPresenterOptions} คนแล้ว` : `You already have ${maxPresenterOptions} presenters.`);
      return;
    }
    uploadControllerRef.current?.abort();
    const controller = new AbortController();
    uploadControllerRef.current = controller;
    const additions = selectedFiles.map((file): SourceMedia => {
      const previewUrl = URL.createObjectURL(file);
      presenterMediaUrlsRef.current.add(previewUrl);
      return { id: crypto.randomUUID(), file, fileName: file.name, previewUrl, kind: "image", uploading: true };
    });
    setPresenterOptions((current) => [...current, ...additions]);
    if (!sourceMedia) setSourceMedia(additions[0] ?? null);
    setFinalVideoUrl("");
    await Promise.all(additions.map(async (presenter) => {
      try {
        const remoteUrl = await uploadPeopleMedia(presenter.file!, controller.signal, selectedVideoModel?.capabilities.uploadConstraints);
        if (controller.signal.aborted) return;
        const updated = { ...presenter, remoteUrl, uploading: false };
        setPresenterOptions((current) => current.map((option) => option.id === presenter.id ? updated : option));
        setSourceMedia((current) => current?.id === presenter.id ? updated : current);
      } catch (error) {
        if (controller.signal.aborted) return;
        const updated = { ...presenter, uploading: false, error: error instanceof Error ? error.message : "Media upload failed" };
        setPresenterOptions((current) => current.map((option) => option.id === presenter.id ? updated : option));
        setSourceMedia((current) => current?.id === presenter.id ? updated : current);
      }
    }));
  };

  const handleSelectPresenter = (presenter: SourceMedia) => {
    setSourceMedia(presenter);
    setFinalVideoUrl("");
    setGenerationError("");
  };

  const handleRemovePresenter = (presenter: SourceMedia) => {
    if (presenter.uploading) return;
    setPresenterOptions((current) => current.filter((option) => option.id !== presenter.id));
    setScenes((current) => current.map((scene) => scene.presenterId === presenter.id ? { ...scene, presenterId: undefined } : scene));
    if (presenter.previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(presenter.previewUrl);
      presenterMediaUrlsRef.current.delete(presenter.previewUrl);
    }
    setSourceMedia((current) => {
      if (current?.id !== presenter.id) return current;
      const replacement = presenterOptions.find((option) => option.id !== presenter.id && !option.error) ?? null;
      return replacement;
    });
    setFinalVideoUrl("");
  };

  const uploadSceneImage = (sceneId: string, file: File) => {
    sceneUploadControllersRef.current.get(sceneId)?.abort();
    const controller = new AbortController();
    sceneUploadControllersRef.current.set(sceneId, controller);
    void uploadPeopleMedia(file, controller.signal, selectedVideoModel?.capabilities.uploadConstraints).then((remoteUrl) => {
      setScenes((current) => current.map((scene) => scene.id === sceneId && scene.media?.file === file
        ? { ...scene, media: { ...scene.media, remoteUrl }, mediaError: undefined }
        : scene));
    }).catch((error) => {
      if (controller.signal.aborted) return;
      setScenes((current) => current.map((scene) => scene.id === sceneId && scene.media?.file === file
        ? { ...scene, mediaError: formatGenerationError(error, isThai ? "อัปโหลดภาพฉากไม่สำเร็จ" : "Could not upload the scene image") }
        : scene));
    }).finally(() => {
      if (sceneUploadControllersRef.current.get(sceneId) === controller) sceneUploadControllersRef.current.delete(sceneId);
    });
  };

  const handleSceneMediaChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !activeScene) return;
    if (!supportedSceneMediaTypes.has(file.type)) {
      updateActiveScene({ mediaError: isThai ? "เลือกไฟล์ภาพหรือวิดีโอที่รองรับ" : "Choose a supported image or video file." });
      return;
    }
    const isVideo = file.type.startsWith("video/");
    const maxMegabytes = isVideo ? 25 : 10;
    const maxBytes = maxMegabytes * 1024 * 1024;
    if (!file.size) {
      updateActiveScene({ mediaError: isThai ? "ไฟล์ว่างเปล่า เลือกไฟล์ใหม่อีกครั้ง" : "This file is empty. Choose another file." });
      return;
    }
    if (file.size > maxBytes) {
      updateActiveScene({ mediaError: isThai ? `ไฟล์${isVideo ? "วิดีโอ" : "ภาพ"}ต้องมีขนาดไม่เกิน ${maxMegabytes} MB` : `The ${isVideo ? "video" : "image"} must be ${maxMegabytes} MB or smaller.` });
      return;
    }
    const otherSceneMediaBytes = scenes.reduce((total, scene) => total + (scene.id === activeScene.id ? 0 : scene.media?.file?.size ?? 0), 0);
    if (otherSceneMediaBytes + file.size > maxSceneMediaTotalBytes) {
      updateActiveScene({ mediaError: isThai ? "สื่อของทุกซีนรวมกันต้องไม่เกิน 60 MB" : "Scene media must total 60 MB or less." });
      return;
    }
    const previousUrl = sceneMediaUrlsRef.current.get(activeScene.id);
    if (previousUrl) URL.revokeObjectURL(previousUrl);
    const previewUrl = URL.createObjectURL(file);
    sceneMediaUrlsRef.current.set(activeScene.id, previewUrl);
    updateActiveScene({
      media: { file, fileName: file.name, previewUrl, kind: isVideo ? "video" : "image" },
      mediaError: undefined,
    });
    if (!isVideo && activeScene.visualMode === "scene-only") uploadSceneImage(activeScene.id, file);
  };

  const handleRemoveSceneMedia = () => {
    if (!activeScene) return;
    sceneUploadControllersRef.current.get(activeScene.id)?.abort();
    sceneUploadControllersRef.current.delete(activeScene.id);
    const previewUrl = sceneMediaUrlsRef.current.get(activeScene.id);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    sceneMediaUrlsRef.current.delete(activeScene.id);
    updateActiveScene({ media: undefined, mediaError: undefined });
  };

  const updateActiveScene = (update: Partial<PresenterScene>) => {
    if (!activeScene) return;
    setScenes((current) => current.map((scene) => scene.id === activeScene.id ? { ...scene, ...update } : scene));
    setFinalVideoUrl("");
    setGenerationError("");
  };

  const updateActiveSceneDuration = (value: string) => {
    if (!value) {
      updateActiveScene({ durationSeconds: undefined });
      return;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return;
    updateActiveScene({ durationSeconds: Math.min(maxSceneDurationSeconds, Math.max(1, Math.round(parsed))) });
  };

  const resetActiveSceneDuration = () => updateActiveScene({ durationSeconds: undefined });

  const openAddScene = () => {
    if (!canAddScene || isLocked) return;
    setNewSceneTitle(`Scene ${scenes.length + 1}`);
    setNewSceneVisualMode("presenter");
    setNewSceneScript("");
    setNewSceneDirection("");
    setNewScenePresenterId("");
    setNewSceneVoiceId("");
    setNewSceneMedia(null);
    setNewSceneMediaError("");
    setNewSceneError("");
    setIsAddSceneOpen(true);
  };

  const closeAddScene = useCallback(() => {
    if (newSceneMedia?.previewUrl.startsWith("blob:")) URL.revokeObjectURL(newSceneMedia.previewUrl);
    setIsAddSceneOpen(false);
    setNewSceneMedia(null);
    setNewSceneMediaError("");
    setNewSceneError("");
    window.setTimeout(() => addSceneButtonRef.current?.focus(), 0);
  }, [newSceneMedia]);

  useEffect(() => {
    if (!isAddSceneOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeAddScene();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isAddSceneOpen, closeAddScene]);

  const handleNewSceneMediaChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!supportedSceneMediaTypes.has(file.type)) {
      setNewSceneMediaError(isThai ? "เลือกไฟล์ภาพหรือวิดีโอที่รองรับ" : "Choose a supported image or video file.");
      return;
    }
    const isVideo = file.type.startsWith("video/");
    const maxMegabytes = isVideo ? 25 : 10;
    if (!file.size) {
      setNewSceneMediaError(isThai ? "ไฟล์ว่างเปล่า เลือกไฟล์ใหม่อีกครั้ง" : "This file is empty. Choose another file.");
      return;
    }
    if (file.size > maxMegabytes * 1024 * 1024) {
      setNewSceneMediaError(isThai ? `ไฟล์${isVideo ? "วิดีโอ" : "ภาพ"}ต้องมีขนาดไม่เกิน ${maxMegabytes} MB` : `The ${isVideo ? "video" : "image"} must be ${maxMegabytes} MB or smaller.`);
      return;
    }
    const otherSceneMediaBytes = scenes.reduce((total, scene) => total + (scene.media?.file?.size ?? 0), 0);
    if (otherSceneMediaBytes + file.size > maxSceneMediaTotalBytes) {
      setNewSceneMediaError(isThai ? "สื่อของทุกซีนรวมกันต้องไม่เกิน 60 MB" : "Scene media must total 60 MB or less.");
      return;
    }
    if (newSceneMedia?.previewUrl.startsWith("blob:")) URL.revokeObjectURL(newSceneMedia.previewUrl);
    setNewSceneMedia({ file, fileName: file.name, previewUrl: URL.createObjectURL(file), kind: isVideo ? "video" : "image" });
    setNewSceneMediaError("");
  };

  const createScene = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canAddScene || isLocked) return;
    const cleanTitle = newSceneTitle.trim();
    const cleanScript = newSceneScript.trim();
    if (newSceneVisualMode === "scene-only" && !newSceneMedia) {
      setNewSceneError(isThai ? "ซีนที่ไม่ใช้พรีเซนเตอร์ต้องมีภาพฉาก สินค้า หรือวิดีโอประกอบ" : "A scene without the selected presenter needs a scene, product, or video asset.");
      return;
    }
    if (!cleanTitle || !cleanScript) {
      setNewSceneError(isThai ? "กรอกชื่อฉากและบทพูดก่อนเพิ่มฉาก" : "Enter a scene title and spoken lines before adding the scene.");
      return;
    }
    const totalScriptLength = script.length + (script ? 2 : 0) + cleanScript.length;
    if (totalScriptLength > 5000) {
      setNewSceneError(isThai ? `บทพูดรวมได้ไม่เกิน 5,000 ตัวอักษร (เหลือ ${Math.max(0, 5000 - script.length - (script ? 2 : 0))})` : `All scene scripts are limited to 5,000 characters (${Math.max(0, 5000 - script.length - (script ? 2 : 0))} remaining).`);
      return;
    }
    const id = crypto.randomUUID();
    const scene: PresenterScene = {
      id,
      title: cleanTitle.slice(0, 40),
      script: cleanScript,
      direction: newSceneDirection.trim().slice(0, maxSceneDirectionLength),
      visualMode: newSceneVisualMode,
      presenterId: newScenePresenterId || undefined,
      voiceId: newSceneVoiceId && newSceneVoiceId !== selectedVoice ? newSceneVoiceId : undefined,
      ...(newSceneMedia ? { media: newSceneMedia } : {}),
    };
    if (newSceneMedia?.previewUrl.startsWith("blob:")) sceneMediaUrlsRef.current.set(id, newSceneMedia.previewUrl);
    setScenes((current) => [...current, scene]);
    if (newSceneVisualMode === "scene-only" && newSceneMedia?.kind === "image" && newSceneMedia.file && !newSceneMedia.remoteUrl) uploadSceneImage(id, newSceneMedia.file);
    setActiveSceneId(id);
    setIsAddSceneOpen(false);
    setNewSceneMedia(null);
    setNewSceneMediaError("");
    setNewSceneError("");
    setFinalVideoUrl("");
    setGenerationError("");
  };

  const removeScene = (sceneId: string) => {
    if (scenes.length <= 1) return;
    sceneUploadControllersRef.current.get(sceneId)?.abort();
    sceneUploadControllersRef.current.delete(sceneId);
    const previewUrl = sceneMediaUrlsRef.current.get(sceneId);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    sceneMediaUrlsRef.current.delete(sceneId);
    const removedIndex = scenes.findIndex((scene) => scene.id === sceneId);
    const nextScenes = scenes.filter((scene) => scene.id !== sceneId);
    setScenes(nextScenes);
    if (activeSceneId === sceneId) setActiveSceneId(nextScenes[Math.max(0, removedIndex - 1)]?.id ?? nextScenes[0]!.id);
    setFinalVideoUrl("");
    setGenerationError("");
  };

  const reorderScenes = (draggedId: string, targetId: string) => {
    if (!draggedId || draggedId === targetId) return;
    setScenes((current) => {
      const fromIndex = current.findIndex((scene) => scene.id === draggedId);
      const toIndex = current.findIndex((scene) => scene.id === targetId);
      if (fromIndex < 0 || toIndex < 0) return current;
      const next = [...current];
      const [draggedScene] = next.splice(fromIndex, 1);
      if (!draggedScene) return current;
      next.splice(toIndex, 0, draggedScene);
      return next;
    });
    setFinalVideoUrl("");
  };

  const syncCurrentCreditBalance = (confirmedDelta?: number) => {
    if (confirmedDelta && confirmedDelta > 0) emitCreditBalanceChanged(confirmedDelta);
    requestCreditBalanceSync(confirmedDelta);
    void getAudioCreditBalance().then(({ balance }) => setCreditBalance(balance)).catch(() => setCreditBalance(null));
  };

  const generateSpeech = async (signal?: AbortSignal): Promise<SpeechPreview> => {
    const sceneBlobs: Blob[] = [];
    let generatedAudio = false;
    try {
      for (const [index, scene] of scenes.entries()) {
        setNotice(isThai ? `กำลังสร้างเสียง ElevenLabs ซีน ${index + 1}/${scenes.length}…` : `Generating ElevenLabs speech for scene ${index + 1}/${scenes.length}…`);
        const result = await createTextToSpeech({
          text: scene.script.trim(), voice: sceneVoiceIds[index] ?? selectedVoice, modelId: selectedAudioModel, outputFormat: "mp3", languageCode: language,
          tone, speed: 1, pronunciationHint: pronunciation.trim() || undefined, idempotencyKey: crypto.randomUUID(),
        }, signal);
        generatedAudio = true;
        sceneBlobs.push(result.blob);
      }
      const combined = await combineSceneAudio(sceneBlobs);
      const url = URL.createObjectURL(combined.blob);
      const next: SpeechPreview = { key: speechKey, blob: combined.blob, url, durationSeconds: combined.durationSeconds, sceneAudio: combined.segments };
      setSpeech((current) => { if (current) URL.revokeObjectURL(current.url); return next; });
      return next;
    } finally {
      if (generatedAudio) syncCurrentCreditBalance();
    }
  };

  const handleGenerateVideo = async () => {
    if (!allSceneVisualsReady || !script.trim() || !allScenesHaveScript || !allScenesHaveVoice || !selectedVideoModel || isGenerating || creditPreflightBusy) return;
    if (missingSceneVisual) {
      setGenerationError(isThai
        ? `${missingSceneVisual.title} ตั้งเป็นซีนไม่ใช้พรีเซนเตอร์ กรุณาเพิ่มภาพฉาก สินค้า หรือวิดีโอประกอบ`
        : `${missingSceneVisual.title} is set to use scene media without the selected presenter. Add a scene image, product image, or video first.`);
      return;
    }
    const missingSceneVideo = scenes.find((scene) => scene.media?.kind === "video" && !scene.media.file);
    if (missingSceneVideo) {
      setGenerationError(isThai ? `ไม่พบไฟล์วิดีโอของ ${missingSceneVideo.title} กรุณาอัปโหลดซีนนี้อีกครั้ง` : `The video file for ${missingSceneVideo.title} is missing. Upload it again.`);
      return;
    }
    if (sceneReferenceAudioTooLong) {
      setGenerationError(isThai
        ? "เสียงอ้างอิงของแต่ละซีนต้องไม่เกิน 15 วินาที กรุณาแบ่งบทพูดออกเป็นซีนเพิ่ม"
        : "Reference audio for each scene must be 15 seconds or less. Split longer scripts into more scenes.");
      return;
    }
    if (!videoQuoteInput) {
      setGenerationError(isThai ? "ยังประเมินเครดิตวิดีโอไม่ได้ กรุณาตรวจภาพพรีเซนเตอร์และโมเดล" : "Video pricing is unavailable. Check the presenter image and model, then try again.");
      return;
    }
    let hasEnoughCredits = false;
    setCreditPreflightBusy(true);
    setGenerationError("");
    setNotice(isThai ? "กำลังตรวจเครดิตเสียงและวิดีโอรวม…" : "Checking the combined speech and video credits…");
    try {
      const [freshSpeechQuote, freshVideoQuote, freshBalance] = await Promise.all([
        quoteTextToSpeechScenes({
          scenes: scenes.map((scene, index) => ({ title: scene.title, text: scene.script.trim(), voice: sceneVoiceIds[index] ?? selectedVoice })),
          modelId: selectedAudioModel,
          outputFormat: "mp3",
          languageCode: language,
          tone,
          speed: 1,
          pronunciationHint: pronunciation.trim() || undefined,
        }),
        quoteVideoStoryboard(videoQuoteInput),
        getAudioCreditBalance(),
      ]);
      const speechCost = Number(freshSpeechQuote.creditCost);
      const freshVideoCost = Number(freshVideoQuote.totalCreditCost);
      if (!Number.isFinite(speechCost) || speechCost < 0 || !Number.isFinite(freshVideoCost) || freshVideoCost < 0) {
        throw new Error(isThai ? "ประเมินเครดิตรวมไม่ได้ กรุณาลองใหม่" : "Could not calculate the full credit cost. Try again.");
      }
      const required = freshVideoCost + (currentSpeech ? 0 : speechCost);
      setSpeechQuote(freshSpeechQuote);
      setVideoCreditCost(freshVideoCost);
      setCreditBalance(freshBalance.balance);
      hasEnoughCredits = freshBalance.balance >= required;
      if (!hasEnoughCredits) {
        const format = (value: number) => value.toLocaleString(isThai ? "th-TH" : "en-US", { maximumFractionDigits: 2 });
        setGenerationError(isThai
          ? `เครดิตไม่พอสำหรับงานทั้งหมด ต้องใช้ ${format(required)} เครดิต แต่มี ${format(freshBalance.balance)} เครดิต กรุณาเติมเครดิตก่อนสร้าง`
          : `Not enough credits for the full job. It needs ${format(required)} credits, but your balance is ${format(freshBalance.balance)}. Add credits before generating.`);
        setNotice("");
      }
    } catch (error) {
      setGenerationError(formatGenerationError(error, isThai ? "ตรวจเครดิตไม่สำเร็จ จึงยังไม่เริ่มสร้าง" : "Credit check failed, so generation has not started."));
      setNotice("");
    } finally {
      setCreditPreflightBusy(false);
    }
    if (!hasEnoughCredits) return;

    const controller = new AbortController();
    generationControllerRef.current = controller;
    const requestId = crypto.randomUUID();
    emitGenerationSubmitting({ feature: "image-to-video", requestId });
    setGenerationError("");
    setFinalVideoUrl("");
    setGenerationProgress(4);
    setGenerationStatus("uploading");
    setNotice(isThai ? "เตรียมไฟล์และเสียงพูด…" : "Preparing your media and voice track…");
    try {
      const sceneBackgroundUrls = new Map<string, string>();
      for (const [index, { scene }] of sceneTimeline.entries()) {
        if (scene.media?.kind !== "image") continue;
        if (scene.media.remoteUrl) {
          sceneBackgroundUrls.set(scene.id, scene.media.remoteUrl);
          continue;
        }
        if (!scene.media.file) throw new Error(`The scene image for ${scene.title} is missing. Upload it again.`);
        setNotice(isThai ? `กำลังอัปโหลดฉากซีน ${index + 1}/${sceneTimeline.length}…` : `Uploading scene ${index + 1}/${sceneTimeline.length} background…`);
        const sceneFile = scene.media.file;
        const sceneBackgroundUrl = await uploadPeopleMedia(sceneFile, controller.signal, selectedVideoModel.capabilities.uploadConstraints);
        if (controller.signal.aborted) return;
        sceneBackgroundUrls.set(scene.id, sceneBackgroundUrl);
        setScenes((current) => current.map((item) => item.id === scene.id && item.media?.file === sceneFile && item.media
          ? { ...item, media: { ...item.media, remoteUrl: sceneBackgroundUrl } }
          : item));
      }

      let current = currentSpeech;
      if (!current) {
        current = await generateSpeech(controller.signal);
        if (controller.signal.aborted) return;
      }
      setNotice(isThai ? "กำลังอัปโหลดเสียงอ้างอิงแยกแต่ละซีน…" : "Uploading each scene's separate audio reference…");
      const audioSegments = current.sceneAudio;
      if (audioSegments.length !== sceneTimeline.length) throw new Error("The generated ElevenLabs tracks do not match the scene list. Generate the speech preview again.");
      const tooLongSegment = audioSegments.find((segment) => segment.durationSeconds > maxSceneDurationSeconds);
      if (tooLongSegment) {
        const index = audioSegments.indexOf(tooLongSegment) + 1;
        throw new Error(isThai
          ? `ซีน ${index} มีเสียงอ้างอิง ${tooLongSegment.durationSeconds.toFixed(2)} วินาที เกิน 15 วินาที กรุณาแบ่งบทเป็นซีนเพิ่ม`
          : `Scene ${index} has ${tooLongSegment.durationSeconds.toFixed(2)} seconds of reference audio. Split it into more scenes so each is 15 seconds or less.`);
      }
      const requestedSceneDurations = audioSegments.map((segment) => generatedClipDuration(segment.durationSeconds));
      const actualVideoQuoteInput = {
        ...videoQuoteInput,
        duration: requestedSceneDurations.reduce((total, item) => total + item, 0),
        scenes: sceneTimeline.map(({ scene }, index) => ({
          ...videoQuoteInput.scenes[index],
          ...presenterSceneVisualInput(scene, scenePresenters[index]?.remoteUrl ?? "", sceneBackgroundUrls.get(scene.id)),
          duration: requestedSceneDurations[index],
        })),
      };
      const [actualVideoQuote, postSpeechBalance] = await Promise.all([
        quoteVideoStoryboard(actualVideoQuoteInput, controller.signal),
        getAudioCreditBalance(),
      ]);
      const actualVideoCost = Number(actualVideoQuote.totalCreditCost);
      if (!Number.isFinite(actualVideoCost) || actualVideoCost < 0) throw new Error(isThai ? "ประเมินเครดิตวิดีโอจากความยาวเสียงจริงไม่ได้" : "Could not price the video using the generated speech duration.");
      setVideoCreditCost(actualVideoCost);
      setCreditBalance(postSpeechBalance.balance);
      if (postSpeechBalance.balance < actualVideoCost) {
        const format = (value: number) => value.toLocaleString(isThai ? "th-TH" : "en-US", { maximumFractionDigits: 2 });
        throw new Error(isThai
          ? `เครดิตคงเหลือไม่พอสร้างวิดีโอ ต้องใช้ ${format(actualVideoCost)} เครดิต แต่เหลือ ${format(postSpeechBalance.balance)} เครดิต`
          : `The remaining balance cannot cover the video. It needs ${format(actualVideoCost)} credits, but only ${format(postSpeechBalance.balance)} remain.`);
      }
      const audioUrls: string[] = [];
      for (const [index, segment] of audioSegments.entries()) {
        setNotice(isThai ? `กำลังอัปโหลดเสียงอ้างอิงซีน ${index + 1}/${audioSegments.length}…` : `Uploading scene ${index + 1}/${audioSegments.length} audio reference…`);
        audioUrls.push(await uploadPeopleMedia(segment.file, controller.signal));
        if (controller.signal.aborted) return;
      }
      setGenerationStatus("processing");
      setNotice(isThai ? `กำลังสร้างวิดีโอ ${scenes.length} ซีน แล้วจะรวมด้วย FFmpeg…` : `Generating ${scenes.length} video scenes, then joining them with FFmpeg…`);
      const created = await createVideoStoryboard({
        model: selectedVideoModel.model,
        mode: "storyboard",
        generationMode: "ai-presenter",
        duration: requestedSceneDurations.reduce((total, item) => total + item, 0),
        aspectRatio: aspect,
        audioMode: "none",
        scenes: sceneTimeline.map(({ scene }, index) => ({
          ...presenterSceneVisualInput(scene, scenePresenters[index]?.remoteUrl ?? "", sceneBackgroundUrls.get(scene.id)),
          startFrameSource: "manual" as const,
          duration: requestedSceneDurations[index],
          audioUrl: audioUrls[index],
          useReferenceAudio: true,
        })),
        idempotencyKey: requestId,
      }, controller.signal);
      const storyboardId = created.storyboardId;
      if (!storyboardId) throw new Error("Presenter video request did not return a storyboard ID");
      syncCurrentCreditBalance(actualVideoCost);
      const pollUrl = created.pollUrl ?? `/api/v1/generations/video/image-to-video/${encodeURIComponent(storyboardId)}/status`;
      emitGenerationStarted({ feature: "image-to-video", requestId, generationId: storyboardId, pollUrl, model: selectedVideoModel.model, status: created.status === "processing" ? "processing" : "queued" });
      let status: VideoStoryboardStatus = { ...created, status: created.status ?? "processing" };
      let lastProgress = 4;
      while (status.status !== "completed" && status.status !== "failed" && status.status !== "cancelled") {
        status = await getVideoStoryboardStatus(storyboardId, controller.signal);
        lastProgress = Math.max(lastProgress, progressPercent(status, Math.min(97, lastProgress + 4)));
        setGenerationProgress(Math.min(97, lastProgress));
        if (status.status === "completed" || status.status === "failed" || status.status === "cancelled") break;
        await waitForPoll(controller.signal);
      }
      if (status.status !== "completed") throw generationErrorFromStatus(status, "Presenter video generation " + status.status);
      const videoUrl = outputVideoUrl(status);
      if (!videoUrl) throw new Error("Presenter video completed without an output URL");

      const scenesWithMedia = audioSegments.flatMap((segment, sceneIndex) => sceneTimeline[sceneIndex]?.scene.media?.kind === "video" && sceneTimeline[sceneIndex]?.scene.media?.file ? [{
        sceneIndex,
        startSeconds: segment.startSeconds,
        endSeconds: segment.endSeconds,
        file: sceneTimeline[sceneIndex]!.scene.media!.file!,
      }] : []);
      let resultVideoUrl = videoUrl;
      try {
        setGenerationProgress(98);
        setNotice(isThai ? "กำลังรวมซีนและใส่เสียง ElevenLabs ต้นฉบับด้วย FFmpeg…" : "Joining the scenes and muxing the original ElevenLabs track with FFmpeg…");
        const composed = await composePresenterVideo(storyboardId, scenesWithMedia, current.blob, controller.signal);
        resultVideoUrl = composed.url;
      } catch (error) {
        if (controller.signal.aborted) throw error;
        throw new Error(formatGenerationError(error, isThai
          ? "สร้างวิดีโอแล้ว แต่รวมซีนหรือใส่เสียง ElevenLabs ไม่สำเร็จ"
          : "The video scenes were generated, but FFmpeg could not join them or attach the exact ElevenLabs track."));
      }

      setFinalVideoUrl(resultVideoUrl);
      setGenerationProgress(100);
      setGenerationStatus("completed");
      setNotice(isThai ? "วิดีโอพร้อมแล้ว ใช้เสียง ElevenLabs ต้นฉบับ" : "Your presenter video is ready with the exact ElevenLabs voice track.");
      emitGenerationCompleted({ feature: "image-to-video", generationId: storyboardId });
    } catch (error) {
      emitGenerationRequestFailed({ feature: "image-to-video", requestId });
      if (controller.signal.aborted) return;
      setGenerationStatus("failed");
      setNotice("");
      setGenerationError(formatGenerationError(error, isThai ? "สร้างวิดีโอไม่สำเร็จ" : "Unable to generate the presenter video"));
    } finally {
      emitGenerationRequestFinished({ feature: "image-to-video", requestId });
      if (generationControllerRef.current === controller) generationControllerRef.current = null;
    }
  };

  const supportedRatios = selectedVideoModel?.capabilities.supportedRatios?.filter((value) => aspectOptions.some((ratio) => ratio === value)) ?? [];
  const activeScenePresenter = scenePresenters[activeSceneIndex] ?? null;
  const sceneVisualModeOptions = [
    { value: "presenter", label: isThai ? "แสดงพรีเซนเตอร์ที่เลือก" : "Show selected presenter" },
    { value: "scene-only", label: isThai ? "ใช้สื่อของซีน · ไม่เพิ่มพรีเซนเตอร์" : "Use scene media · no selected presenter" },
  ] as const;
  const canGenerate = Boolean(allSceneVisualsReady && !missingSceneVisual && script.trim() && allScenesHaveScript && allScenesHaveVoice && !sceneReferenceAudioTooLong && selectedVideoModel && !isGenerating && !creditPreflightBusy && !catalogLoading && !voiceLoading);
  const sceneDurationsForEstimate = sceneTimeline.map(({ start, end }) => Math.max(1, Math.ceil(end - start)));
  const hasUniformSceneDurations = sceneDurationsForEstimate.every((sceneDuration) => sceneDuration === sceneDurationsForEstimate[0]);
  const estimateDescription = hasUniformSceneDurations
    ? `${scenes.length} ${isThai ? "ซีน" : "scenes"} × ${sceneDurationsForEstimate[0] ?? 0} ${isThai ? "วินาที" : "seconds"}`
    : `${scenes.length} ${isThai ? "ซีน · รวม" : "scenes · total"} ${Math.ceil(duration)} ${isThai ? "วินาที" : "seconds"}`;
  const generationHint = catalogLoading || voiceLoading || creditBalanceLoading || speechQuoteLoading || videoQuoteLoading
    ? (isThai ? "กำลังตรวจโมเดล เสียง และเครดิต…" : "Checking models, voice, and credits…")
    : sceneReferenceAudioTooLong
      ? (overlongSceneAudioIndex >= 0 && currentSpeech
        ? (isThai ? `เสียงซีน ${overlongSceneAudioIndex + 1} เกิน 15 วินาที · แบ่งบทพูดซีนนี้ก่อนสร้าง` : `Scene ${overlongSceneAudioIndex + 1} exceeds 15 seconds · split its script before generating`)
        : (isThai ? "เสียงแต่ละซีนต้องไม่เกิน 15 วินาที · แบ่งบทพูดก่อนสร้าง" : "Each scene's audio must be 15 seconds or less · split the script before generating"))
      : !selectedVideoModel
        ? (isThai ? "เลือกโมเดลวิดีโอก่อนสร้าง" : "Choose a video model before generating")
        : missingSceneVisual
          ? (isThai ? `${missingSceneVisual.title}: เพิ่มภาพฉาก สินค้า หรือวิดีโอประกอบ` : `${missingSceneVisual.title}: add a scene, product, or video asset`)
        : !allSceneVisualsReady
          ? (isThai ? "กำลังเตรียมภาพฉาก หรือพรีเซนเตอร์ของซีนนี้" : "Preparing the scene image or presenter reference")
          : !script.trim() || !allScenesHaveScript
            ? (isThai ? "เพิ่มบทพูดก่อนสร้าง" : "Add spoken lines before generating")
            : !allScenesHaveVoice
              ? (isThai ? "เลือกเสียงให้ครบทุกซีนก่อนสร้าง" : "Choose a voice for every scene")
              : creditBalance === null
                ? (isThai ? "ตรวจยอดเครดิตไม่ได้ · ลองอีกครั้งก่อนสร้าง" : "Could not verify credits · try again before generating")
                : requiredCreditCost !== null && !creditsSufficient
                  ? (isThai ? "เครดิตไม่พอ · เติมเครดิตก่อนสร้าง" : "Not enough credits · add credits before generating")
                  : "";

  return (
    <div className={styles.page}>
      <section className={styles.hero} aria-label="AI Presenter">
        <div className={styles.heroArtwork}><Image src="/generated-icons-v2/projects/ai-presenter.png" alt="AI presenter in a modern studio" fill priority sizes="(max-width: 760px) 100vw, 65vw" /></div>
        <div className={styles.heroWash} />
        <div className={styles.heroCopy}>
          <span className={styles.heroEyebrow}><Sparkles size={13} /> AI VIDEO STUDIO</span>
          <h1>GEN AI<br /><span>PRESENTER</span></h1>
          <p>{isThai ? "ใส่สคริปต์ เลือกเสียง แล้วสร้างวิดีโอพรีเซนเตอร์จากภาพของคุณ" : "Add a script, choose a voice, and make a presenter video from your image."}</p>
          <span className={styles.heroPill}><span /> {isThai ? "เชื่อมต่อระบบสร้างจริง" : "Live generation"}</span>
        </div>
        <div className={styles.heroCallout}><AudioLines size={22} /><span>MAKE IT<br /><strong>SPEAK.</strong></span></div>
      </section>

      <section className={styles.workspace} aria-label={isThai ? "พื้นที่สร้าง AI Presenter" : "AI Presenter workspace"}>
        <div className={styles.workspaceGrid}>
          <section className={styles.scriptPanel} aria-labelledby="presenter-script-heading">
            <div className={styles.panelTitle}>
              <div><span className={styles.stepNumber}>1.</span><h2 id="presenter-script-heading">SCRIPT / CONTENT</h2></div>
            </div>
            <div className={styles.sceneBasicsGrid}>
              <label className={`${styles.formGroup} ${styles.sceneTitleField}`}>
                <span className={styles.formLabel}>{isThai ? "ชื่อซีน" : "Scene name"}</span>
                <input className={styles.textInput} value={activeScene?.title ?? ""} onChange={(event) => updateActiveScene({ title: event.target.value.slice(0, 40) })} maxLength={40} disabled={isLocked} />
              </label>
              <div className={styles.sceneDurationControl}>
                <span className={styles.formLabel}>{isThai ? "ความยาว" : "Duration"}</span>
                <Dropdown
                  value={activeScene?.durationSeconds !== undefined ? String(activeScene.durationSeconds) : "auto"}
                  options={sceneDurationOptions}
                  onChange={(value) => value === "auto" ? resetActiveSceneDuration() : updateActiveSceneDuration(value)}
                  ariaLabel={isThai ? "เลือกความยาวฉาก" : "Choose scene duration"}
                  disabled={isLocked}
                  className={styles.sceneDurationDropdown}
                  triggerClassName={styles.sceneDurationDropdownTrigger}
                  menuPosition="fixed"
                />
              </div>
            </div>
            <div className={styles.sceneVisualModeField}>
              <span className={styles.formLabel}>{isThai ? "การแสดงผลในซีนนี้" : "Scene presentation"}</span>
              <Dropdown
                value={activeScene?.visualMode ?? "presenter"}
                options={sceneVisualModeOptions}
                onChange={(value) => {
                  const visualMode = value as PresenterVisualMode;
                  updateActiveScene({ visualMode });
                  if (visualMode === "scene-only" && activeScene?.media?.kind === "image" && activeScene.media.file && !activeScene.media.remoteUrl) uploadSceneImage(activeScene.id, activeScene.media.file);
                }}
                ariaLabel={isThai ? "เลือกการแสดงผลในซีนนี้" : "Choose what appears in this scene"}
                disabled={isLocked}
                className={styles.sceneModeDropdown}
                triggerClassName={styles.sceneModeDropdownTrigger}
                menuClassName={styles.sceneModeDropdownMenu}
                optionClassName={styles.sceneModeDropdownOption}
                menuPosition="fixed"
              />
              {activeScene?.visualMode === "scene-only" ? <small>{isThai ? "เสียงพูดยังเป็นเสียงพากย์ ใช้ภาพ/วิดีโอซีนได้แม้มีคน โดยไม่เพิ่มพรีเซนเตอร์ที่เลือก" : "Narration stays as voiceover. Scene media may include people; the selected presenter will not be added."}</small> : null}
            </div>
            <div className={styles.sceneSpeakerSettings}>
              <div className={styles.sceneChoiceField}>
                <span className={styles.formLabel}>{isThai ? "พรีเซนเตอร์ของซีนนี้" : "Presenter for this scene"}</span>
                {activeScene?.visualMode === "scene-only" ? (
                  <div className={styles.scenePresenterHidden}>{isThai ? "ไม่ใช้พรีเซนเตอร์ที่เลือก" : "Selected presenter not used"}</div>
                ) : (
                  <>
                    <PresenterScenePicker
                      presenters={presenterOptions}
                      defaultPresenter={sourceMedia}
                      value={activeScene?.presenterId ?? ""}
                      onChange={(presenterId) => updateActiveScene({ presenterId: presenterId || undefined })}
                      disabled={isLocked || !presenterOptions.length}
                      isThai={isThai}
                    />
                  </>
                )}
              </div>
              <div className={styles.sceneChoiceField}>
                <PresenterVoicePicker
                  key={`${selectedAudioModel}:${activeScene?.id ?? "scene"}`}
                  voices={voices}
                  value={activeSceneVoiceId}
                  onChange={(voiceId) => updateActiveScene({ voiceId: voiceId === selectedVoice ? undefined : voiceId })}
                  disabled={voiceLoading || !voices.length || isLocked}
                  loading={voiceLoading}
                  isThai={isThai}
                />
              </div>
            </div>
            <div className={`${styles.sceneFieldCard} ${styles.spokenSceneField}`}>
              <div className={styles.sceneFieldHeader}>
                <span className={`${styles.sceneFieldIcon} ${styles.spokenSceneIcon}`}><AudioLines size={15} /></span>
                <span className={styles.sceneFieldTitle}><strong>{isThai ? "บทพูด" : "Spoken lines"}</strong></span>
                <span className={`${styles.sceneFieldBadge} ${styles.spokenSceneBadge}`}>{isThai ? "อ่านออกเสียง" : "Spoken"}</span>
              </div>
              <textarea className={styles.scriptInput} value={activeScene?.script ?? ""} onChange={(event) => updateActiveScene({ script: event.target.value.slice(0, activeSceneMaxLength) })} maxLength={activeSceneMaxLength} disabled={isLocked} placeholder={isThai ? "พิมพ์เฉพาะประโยคที่ต้องการให้อ่านออกเสียง" : "Write only the words you want spoken"} aria-label={isThai ? "บทพูดของซีนนี้ ส่งให้ ElevenLabs อ่าน" : "Spoken lines for this scene, sent to ElevenLabs"} />
              <div className={styles.spokenSceneMetaRow}>
                {activeSceneSpeechDuration !== null && activeSceneSpeechDuration !== undefined ? (
                  <p className={styles.speechDurationStatus} style={{ fontSize: "12px", lineHeight: 1.4 }}>
                    {activeSceneAudioDuration !== undefined
                      ? (isThai ? `เสียงจริง ${activeSceneAudioDuration.toFixed(2)} วินาที` : `Actual audio ${activeSceneAudioDuration.toFixed(2)} sec`)
                      : (isThai ? `ประมาณ ${activeSceneSpeechDuration} วินาที` : `About ${activeSceneSpeechDuration} sec`)}
                  </p>
                ) : <span />}
                <div className={styles.characterCount} style={{ fontSize: "12px", lineHeight: 1.4 }}>{script.length.toLocaleString()} / 5,000 {isThai ? "ตัวอักษรบทพูดรวม" : "total spoken characters"}</div>
              </div>
            </div>
            <div className={`${styles.sceneFieldCard} ${styles.directionSceneField}`}>
              <div className={styles.sceneFieldHeader}>
                <span className={`${styles.sceneFieldIcon} ${styles.directionSceneIcon}`}><Video size={15} /></span>
                <span className={styles.sceneFieldTitle}><strong>{isThai ? "คำสั่งฉาก / ท่าทาง" : "Scene directions"}</strong><small>{isThai ? "ใช้กำกับภาพ การแสดง และสินค้า" : "Guides visuals, acting, and product placement"}</small></span>
                <span className={`${styles.sceneFieldBadge} ${styles.directionSceneBadge}`}>{isThai ? "ไม่อ่านออกเสียง" : "Not spoken"}</span>
              </div>
              <textarea className={styles.directionInput} value={activeScene?.direction ?? ""} onChange={(event) => updateActiveScene({ direction: event.target.value.slice(0, maxSceneDirectionLength) })} maxLength={maxSceneDirectionLength} disabled={isLocked} placeholder={isThai ? "เช่น ยิ้ม มองกล้อง แล้วหยิบขวดสินค้าขึ้นมา โดยคงฉากหลังเดิม" : "Example: Smile at the camera, then lift the product while keeping the same background"} aria-label={isThai ? "คำสั่งภาพและท่าทางของซีนนี้ ไม่ส่งให้ ElevenLabs" : "Visual and acting directions for this scene, not sent to ElevenLabs"} />
              <div className={styles.characterCount}>{activeScene?.direction.length ?? 0} / {maxSceneDirectionLength} {isThai ? "ตัวอักษร · ไม่ถูกนำไปสร้างเสียง" : "characters · excluded from speech"}</div>
            </div>
            <div className={styles.formGroup}>
              <div className={styles.formLabel}><span>{isThai ? "โทนเสียง" : "Speech tone"}</span></div>
              <div className={styles.chipRow}>{toneOptions.map((option) => <button type="button" key={option.value} className={`${styles.toneChip} ${tone === option.value ? styles.toneChipActive : ""}`} onClick={() => setTone(option.value)} disabled={isLocked} aria-pressed={tone === option.value}>{option.label}</button>)}</div>
            </div>

            <div className={styles.twoFields}>
              <div className={styles.formGroup}>
                <span className={styles.formLabel}>{isThai ? "ภาษา" : "Language"}</span>
                <Dropdown
                  value={language}
                  options={[
                    { value: "en", label: "English" },
                    { value: "th", label: "ไทย" },
                    { value: "ja", label: "日本語" },
                  ]}
                  onChange={setLanguage}
                  ariaLabel={isThai ? "เลือกภาษา" : "Choose language"}
                  disabled={isLocked}
                  className={styles.presenterDropdown}
                  triggerClassName={styles.presenterDropdownTrigger}
                  menuClassName={styles.presenterDropdownMenu}
                  optionClassName={styles.presenterDropdownOption}
                  menuPosition="fixed"
                />
              </div>
              <label className={styles.formGroup}>
                <span className={styles.formLabel}>{isThai ? "คำอ่านเพิ่มเติม" : "Pronunciation hints"}</span>
                <input className={styles.textInput} value={pronunciation} onChange={(event) => setPronunciation(event.target.value)} placeholder={isThai ? "ชื่อแบรนด์หรือคำย่อ" : "Brand names, acronyms"} disabled={isLocked} />
              </label>
            </div>

            <div className={styles.formGroup}>
              <div className={styles.formLabel}>
                <span>{isThai ? "ภาพฉาก / สินค้า / วิดีโอประกอบ" : "Scene background, product, or video"}</span>
                <span className={styles.optionalTag}>{activeScene?.visualMode === "scene-only" ? (isThai ? "จำเป็น" : "REQUIRED") : (isThai ? "ไม่บังคับ" : "OPTIONAL")}</span>
              </div>
              <input ref={sceneMediaInputRef} className={styles.hiddenInput} type="file" accept="image/png,image/jpeg,image/webp,video/mp4,video/webm" onChange={handleSceneMediaChange} disabled={isLocked} />
              {activeScene?.media ? (
                <div className={styles.sceneMediaPreviewCard}>
                  <span className={styles.sceneMediaPreview}>
                    {activeScene.media.previewUrl ? activeScene.media.kind === "image" ? <Image src={activeScene.media.previewUrl} alt={activeScene.media.fileName} fill unoptimized sizes="(max-width: 760px) 100vw, 600px" /> : <video src={activeScene.media.previewUrl} muted playsInline autoPlay loop /> : <CloudUpload size={20} />}
                  </span>
                  <div className={styles.sceneMediaActions}>
                    <button type="button" onClick={() => sceneMediaInputRef.current?.click()} disabled={isLocked} aria-label={isThai ? "แทนที่สื่อซีน" : "Replace scene media"} title={isThai ? "แทนที่" : "Replace"}><span>{isThai ? "แทนที่" : "Replace"}</span></button>
                    <button type="button" onClick={handleRemoveSceneMedia} disabled={isLocked} aria-label={isThai ? "ลบสื่อซีน" : "Remove scene media"} title={isThai ? "ลบ" : "Remove"}><span>{isThai ? "ลบ" : "Remove"}</span></button>
                  </div>
                </div>
              ) : (
                <button type="button" className={styles.sceneMediaUpload} onClick={() => sceneMediaInputRef.current?.click()} disabled={isLocked}>
                  <CloudUpload size={18} />
                  <span>{isThai ? "อัปโหลดภาพฉาก / สินค้า / วิดีโอ" : "Upload a scene, product image, or video"}</span>
                  <small>PNG / JPG / WEBP · MP4 / WEBM</small>
                </button>
              )}
              {activeScene?.mediaError ? <p className={styles.formError}>{activeScene.mediaError === "draft-media-missing" ? (isThai ? "ไม่พบไฟล์เดิม กรุณาอัปโหลดใหม่" : "Original file is missing. Upload it again.") : activeScene.mediaError}</p> : null}
            </div>
          </section>

          <section className={styles.previewPanel} aria-labelledby="presenter-preview-heading">
            <div className={styles.panelTitle}>
              <div><span className={styles.stepNumber}>2.</span><h2 id="presenter-preview-heading">PREVIEW</h2></div>
              {finalVideoUrl || !activeScene?.media ? (
                <span className={`${styles.previewBadge} ${finalVideoUrl ? styles.previewReady : ""}`}>
                  <span />{finalVideoUrl ? (isThai ? "วิดีโอที่สร้างแล้ว" : "GENERATED") : activeScene?.visualMode === "scene-only" ? (isThai ? "ใช้สื่อของซีน" : "SCENE MEDIA") : (isThai ? "ตัวอย่างพรีเซนเตอร์" : "PRESENTER SOURCE")}
                </span>
              ) : null}
            </div>
            <div className={styles.videoFrame}>
              <VideoPreviewLiveBadge />
              {isGenerating ? (
                <div className={videoPreviewStyles.videoGeneratingPreview} aria-busy="true">
                  <WandSparkles size={26} />
                  <strong>{generationStatus === "uploading" ? (isThai ? "กำลังเตรียมไฟล์" : "Preparing files") : (isThai ? "กำลังสร้างวิดีโอ" : "Generating video")}</strong>
                  <span>{notice ?? (isThai ? "กำลังส่งภาพและเสียงอ้างอิงให้ MiniMax" : "Sending the image and audio reference to MiniMax.")}</span>
                  <div className={videoPreviewStyles.videoGenerationProgress}><i style={{ width: `${Math.max(8, generationProgress)}%` }} /></div>
                  <small>{isThai ? `เสร็จแล้ว ${generationProgress}%` : `${generationProgress}% complete`}</small>
                </div>
              ) : finalVideoUrl ? (
                <EosVideoPlayer
                  key={finalVideoUrl}
                  src={finalVideoUrl}
                  className={`${videoPreviewStyles.generatedVideoPlayer} ${videoPreviewStyles.peopleGeneratedVideoPlayer}`}
                  mediaFrameClassName={videoPreviewStyles.videoPreviewMediaFrame}
                  ariaLabel={isThai ? "วิดีโอพรีเซนเตอร์ที่สร้างแล้ว" : "Generated presenter video"}
                />
              ) : activeScene?.media?.kind === "video" ? (
                <EosVideoPlayer
                  key={activeScene.media.previewUrl}
                  src={activeScene.media.previewUrl}
                  muted
                  className={`${videoPreviewStyles.generatedVideoPlayer} ${videoPreviewStyles.peopleGeneratedVideoPlayer}`}
                  mediaFrameClassName={videoPreviewStyles.videoPreviewMediaFrame}
                  ariaLabel={isThai ? `ตัวอย่างวิดีโอของซีน ${activeScene.title}` : `Scene visual preview for ${activeScene.title}`}
                />
              ) : activeScene?.media?.kind === "image" ? (
                <Image src={activeScene.media.previewUrl} alt={isThai ? `ภาพประกอบซีน ${activeScene.title}` : `Visual for ${activeScene.title}`} fill unoptimized sizes="(max-width: 760px) 100vw, 60vw" className={styles.sourcePreviewImage} />
              ) : activeScene?.visualMode !== "scene-only" && activeScenePresenter?.kind === "video" ? (
                <EosVideoPlayer
                  key={activeScenePresenter.previewUrl}
                  src={activeScenePresenter.previewUrl}
                  muted
                  className={`${videoPreviewStyles.generatedVideoPlayer} ${videoPreviewStyles.peopleGeneratedVideoPlayer}`}
                  mediaFrameClassName={videoPreviewStyles.videoPreviewMediaFrame}
                  ariaLabel={isThai ? "วิดีโอต้นแบบ" : "Presenter source video"}
                />
              ) : activeScene?.visualMode !== "scene-only" && activeScenePresenter?.kind === "image" ? (
                <Image src={activeScenePresenter.previewUrl} alt={isThai ? `ภาพพรีเซนเตอร์ของซีน ${activeScene?.title ?? ""}` : `Presenter image for ${activeScene?.title ?? "this scene"}`} fill unoptimized sizes="(max-width: 760px) 100vw, 60vw" className={styles.sourcePreviewImage} />
              ) : (
                <VideoPreviewPlaceholder showActions={false} />
              )}
              {finalVideoUrl && !isGenerating ? <VideoPreviewOverlayActions videoUrl={finalVideoUrl} /> : null}
            </div>
            <div className={styles.presenterPicker}>
              <input ref={sourceInputRef} className={styles.hiddenInput} type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={(event) => void handleSourceChange(event)} disabled={isLocked || presenterOptions.length >= maxPresenterOptions || presenterOptions.some((presenter) => presenter.uploading)} />
              <div className={styles.sectionHeading}>
                <h3>{isThai ? "พรีเซนเตอร์ของคุณ" : "Your Presenter"}</h3>
                <span className={styles.presenterCount}>{presenterOptions.length} / {maxPresenterOptions}</span>
              </div>
              <div className={styles.presenterList}>
                {presenterOptions.map((presenter, index) => (
                    <div className={styles.presenterOption} key={presenter.id}>
                      <button
                        type="button"
                        className={`${styles.presenterCard} ${sourceMedia?.id === presenter.id ? styles.presenterCardActive : ""}`}
                        onClick={() => handleSelectPresenter(presenter)}
                        disabled={isLocked}
                        title={presenter.fileName}
                        aria-label={isThai ? `เลือกพรีเซนเตอร์ ${presenter.fileName}` : `Select presenter ${presenter.fileName}`}
                        aria-pressed={sourceMedia?.id === presenter.id}
                      >
                        {presenter.previewUrl && presenter.kind === "image" ? (
                          <span className={styles.presenterImage}><Image src={presenter.previewUrl} alt="" fill unoptimized sizes="56px" /></span>
                        ) : (
                          <span className={styles.presenterUploadPlaceholder}><CloudUpload size={19} /></span>
                        )}
                        <strong>{presenter.uploading ? (isThai ? "กำลังอัปโหลด…" : "Uploading…") : presenter.error ? (isThai ? "อัปโหลดไม่สำเร็จ" : "Upload failed") : `${isThai ? "พรีเซนเตอร์" : "Presenter"} ${index + 1}`}</strong>
                        <small>{sourceMedia?.id === presenter.id ? (isThai ? "เลือกอยู่" : "Selected") : presenter.fileName}</small>
                      </button>
                      <button type="button" className={styles.presenterRemoveButton} onClick={() => handleRemovePresenter(presenter)} disabled={isLocked || presenter.uploading} aria-label={isThai ? `ลบพรีเซนเตอร์ ${presenter.fileName}` : `Remove presenter ${presenter.fileName}`} title={isThai ? "ลบพรีเซนเตอร์" : "Remove presenter"}><X size={12} /></button>
                    </div>
                ))}
                <button
                  type="button"
                  className={styles.presenterAddCard}
                  onClick={() => sourceInputRef.current?.click()}
                  disabled={isLocked || presenterOptions.length >= maxPresenterOptions || presenterOptions.some((presenter) => presenter.uploading)}
                  aria-label={isThai ? "อัปโหลดพรีเซนเตอร์เพิ่ม" : "Upload another presenter"}
                >
                  <span><CloudUpload size={19} /></span>
                  <strong>{isThai ? "เพิ่มพรีเซนเตอร์" : "Add presenter"}</strong>
                  <small>{isThai ? "เลือกได้หลายรูป" : "Select multiple"}</small>
                </button>
              </div>
            </div>
            <div className={styles.timelineHeader}>
              <div className={styles.sectionHeading}>
                <h3>{isThai ? "ไทม์ไลน์ฉาก" : "Scene Timeline"}</h3>
                <span className={styles.sceneCount}>{scenes.length} / 6 · ~{sceneTimelineDuration}s</span>
              </div>
              <button type="button" className={styles.textButton} onClick={() => setIsReorderingScenes((current) => !current)} disabled={isLocked || scenes.length < 2} aria-pressed={isReorderingScenes}>
                {isReorderingScenes ? (isThai ? "เสร็จสิ้น" : "Done") : (isThai ? "เรียงฉากใหม่" : "Reorder Scenes")}
              </button>
            </div>
            {isReorderingScenes ? <p className={styles.timelineNote}>{isThai ? "ลากฉากเพื่อเปลี่ยนลำดับ" : "Drag scenes to change their order."}</p> : null}
            <div className={styles.sceneTimeline} aria-label={isThai ? "ไทม์ไลน์ฉาก" : "Scene timeline"}>
              {sceneTimeline.map(({ scene, start, end }, index) => {
                const audioDuration = currentSpeech?.sceneAudio[index]?.durationSeconds;
                const timelineVoiceId = sceneVoiceIds[index] ?? selectedVoice;
                const timelineVoicePace = voicePaceForSample(voiceSampleDurations[JSON.stringify([selectedAudioModel, timelineVoiceId])], timelineVoiceId, language);
                const estimatedSpeechDuration = scene.script.trim() ? estimatedDuration(scene.script, language, timelineVoicePace) : null;
                const speechDuration = audioDuration ?? estimatedSpeechDuration;
                const speechOverLimit = speechDuration !== null && speechDuration !== undefined && speechDuration > maxSceneDurationSeconds;
                const speechNearLimit = speechDuration !== null && speechDuration !== undefined && speechDuration >= sceneSpeechWarningSeconds;
                return (
                <div
                  key={scene.id}
                  className={styles.sceneItem}
                  draggable={isReorderingScenes}
                  onDragStart={(event) => {
                    if (!isReorderingScenes) return;
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", scene.id);
                  }}
                  onDragOver={(event) => { if (isReorderingScenes) { event.preventDefault(); event.dataTransfer.dropEffect = "move"; } }}
                  onDrop={(event) => {
                    if (!isReorderingScenes) return;
                    event.preventDefault();
                    reorderScenes(event.dataTransfer.getData("text/plain"), scene.id);
                  }}
                >
                  <div className={`${styles.sceneCard} ${activeSceneId === scene.id ? styles.sceneCardActive : ""}`}>
                    <button type="button" className={styles.sceneSelect} onClick={() => setActiveSceneId(scene.id)} aria-pressed={activeSceneId === scene.id} disabled={isLocked}>
                      <span className={styles.sceneImage}>
                        {scene.media?.previewUrl && scene.media.kind === "image" ? <Image src={scene.media.previewUrl} alt="" fill unoptimized sizes="46px" /> : scene.media?.previewUrl && scene.media.kind === "video" ? <video src={scene.media.previewUrl} muted playsInline autoPlay loop /> : scene.visualMode !== "scene-only" && scenePresenters[index]?.previewUrl ? <Image src={scenePresenters[index]!.previewUrl} alt="" fill unoptimized sizes="46px" /> : <Video size={16} />}
                      </span>
                      <span className={styles.sceneCopy}>
                        <strong>{scene.title || `${isThai ? "ฉาก" : "Scene"} ${index + 1}`}</strong>
                        <small>{formatTimelineTime(start)} – {formatTimelineTime(end)}</small>
                        {speechDuration !== null && speechDuration !== undefined ? <small className={styles.sceneSpeechDuration} data-warning={speechNearLimit ? "true" : undefined} data-over={speechOverLimit ? "true" : undefined}>{audioDuration !== undefined ? `${isThai ? "เสียงจริง" : "Actual"} ${audioDuration.toFixed(1)}s` : `${isThai ? "ประมาณ" : "Est."} ${speechDuration}s`}</small> : null}
                      </span>
                    </button>
                    {isReorderingScenes ? <span className={styles.sceneMore}><GripVertical size={13} /></span> : scenes.length > 1 ? <button type="button" className={styles.sceneMore} onClick={() => removeScene(scene.id)} aria-label={isThai ? `ลบฉาก ${index + 1}` : `Remove scene ${index + 1}`} title={isThai ? "ลบฉาก" : "Remove scene"} disabled={isLocked}><X size={12} /></button> : null}
                  </div>
                  {index < scenes.length - 1 ? <ArrowRight className={styles.sceneArrow} size={13} /> : null}
                </div>
                );
              })}
              <button ref={addSceneButtonRef} type="button" className={styles.addScene} onClick={openAddScene} disabled={!canAddScene || isLocked}>
                <Plus size={18} />
                <span>{isThai ? "เพิ่มฉาก" : "Add Scene"}</span>
              </button>
            </div>
            {currentSpeech ? <div className={styles.speechPreview}><div><AudioLines size={15} /><strong>{isThai ? "เสียงพูดที่สร้างแยกตามซีนแล้ว" : "Speech generated per scene"}</strong><span>{Math.ceil(currentSpeech.durationSeconds)}s</span></div><audio controls src={currentSpeech.url} /></div> : null}
            {generationError ? <div className={styles.errorCard} role="alert">{generationError}</div> : null}
            {notice ? <p className={styles.statusNote} role="status">{notice}</p> : null}
          </section>

          <aside className={styles.settingsPanel} aria-labelledby="presenter-settings-heading">
            <div className={styles.panelTitle}><div><span className={styles.stepNumber}>3.</span><h2 id="presenter-settings-heading">SETTINGS</h2></div><Sparkles size={15} className={styles.settingsSparkle} /></div>

            <div className={styles.settingCard}>
              <span className={styles.settingLabel}>{isThai ? "โมเดลสร้างวิดีโอ" : "Presenter video model"}</span>
              <Dropdown
                value={selectedReferenceVideoModel}
                options={availableReferenceVideoModels.map((model) => ({ value: model.model, label: model.displayName, preserveLabel: true }))}
                onChange={setSelectedReferenceVideoModel}
                triggerLabel={(
                  <span className={styles.settingModelValue}>
                    <Video size={14} />
                    <span>{availableReferenceVideoModels.find((model) => model.model === selectedReferenceVideoModel)?.displayName ?? (isThai ? "เลือกโมเดล" : "Select a model")}</span>
                  </span>
                )}
                ariaLabel={isThai ? "เลือกโมเดลสร้างวิดีโอ" : "Choose presenter video model"}
                loading={catalogLoading}
                disabled={catalogLoading || isLocked}
                className={styles.presenterDropdown}
                triggerClassName={styles.presenterDropdownTrigger}
                menuClassName={styles.presenterDropdownMenu}
                optionClassName={styles.presenterDropdownOption}
                menuPosition="fixed"
              />
            </div>
            <div className={styles.settingCard}>
              <span className={styles.settingLabel}>{isThai ? "โมเดลเสียงพูด (ElevenLabs)" : "Speech model (ElevenLabs)"}</span>
              <Dropdown
                value={selectedAudioModel}
                options={availableAudioModels.map((model) => ({ value: model.key, label: model.name, preserveLabel: true }))}
                onChange={setSelectedAudioModel}
                ariaLabel={isThai ? "เลือกโมเดลเสียงพูด" : "Choose speech model"}
                loading={catalogLoading}
                disabled={catalogLoading || isLocked}
                placeholder={isThai ? "เลือกโมเดลเสียงพูด" : "Select a speech model"}
                className={styles.presenterDropdown}
                triggerClassName={styles.presenterDropdownTrigger}
                menuClassName={styles.presenterDropdownMenu}
                optionClassName={styles.presenterDropdownOption}
                menuPosition="fixed"
              />
            </div>
            <div className={styles.settingCard}>
              <div className={styles.settingLabel}>{isThai ? "เสียงเริ่มต้นสำหรับทุกซีน" : "Default voice for scenes"}</div>
              <PresenterVoicePicker
                key={selectedAudioModel}
                voices={voices}
                value={selectedVoice}
                onChange={setSelectedVoice}
                disabled={voiceLoading || !voices.length || isLocked}
                loading={voiceLoading}
                isThai={isThai}
              />
            </div>
            {selectedVoiceInfo?.previewUrl ? (
              <audio
                key={`${selectedAudioModel}:${selectedVoiceInfo.key}`}
                className={styles.voiceSampleMetadata}
                preload="metadata"
                src={selectedVoiceInfo.previewUrl}
                aria-hidden="true"
                tabIndex={-1}
                onLoadedMetadata={(event) => {
                  const measuredDuration = event.currentTarget.duration;
                  if (Number.isFinite(measuredDuration) && measuredDuration > 0) setVoiceSampleDurations((current) => ({ ...current, [voiceSampleKey]: measuredDuration }));
                }}
              />
            ) : null}
            <div className={styles.settingCard}>
              <div className={styles.settingLabel}>{isThai ? "สัดส่วนวิดีโอ" : "Video format"}</div>
              <div className={styles.formatChoices}>{(supportedRatios.length ? supportedRatios : aspectOptions).map((value) => <button key={value} type="button" className={`${styles.formatOption} ${aspect === value ? styles.formatOptionActive : ""}`} onClick={() => setAspect(value as (typeof aspectOptions)[number])} disabled={isLocked}><span className={`${styles.formatShape} ${value === "9:16" ? styles.formatPortrait : value === "1:1" ? styles.formatSquare : ""}`} /><strong>{value}</strong><small>{value === "16:9" ? "Landscape" : value === "9:16" ? "Portrait" : "Square"}</small></button>)}</div>
            </div>

            <div className={styles.estimateBlock}>
              <div className={styles.estimateCard}>
                <div className={styles.estimateHeading}>
                  <strong>{isThai ? "เครดิตโดยประมาณ" : "Estimated credits"}</strong>
                  <InfoTooltip content={isThai ? "เครดิตรวมโดยประมาณสำหรับสร้างเสียงพูดและวิดีโอ ระบบจะตรวจยอดจริงอีกครั้งก่อนเริ่มสร้าง" : "Estimated total credits for speech and video. Your balance is checked again before generation."} size={12} />
                </div>
                <div className={styles.estimateSummary}>
                  <span>{estimateDescription}</span>
                  <strong>{estimatedCredits === null ? "—" : `= ${estimatedCredits.toLocaleString()} ${isThai ? "เครดิต" : "credits"}`}</strong>
                </div>
              </div>
              {generationHint ? <p className={styles.generateHint} role="status">{generationHint}</p> : null}
              <button type="button" className={styles.generateButton} onClick={() => void handleGenerateVideo()} disabled={!canGenerate}>
                {isGenerating || creditPreflightBusy ? <LoaderCircle size={18} className={styles.spin} /> : <WandSparkles size={18} />}{creditPreflightBusy ? (isThai ? "กำลังตรวจเครดิต…" : "Checking credits…") : isGenerating ? (isThai ? "กำลังสร้างวิดีโอ…" : "Generating video…") : (isThai ? "สร้างวิดีโอ" : "Generate video")}
              </button>
              {catalogError ? <p className={styles.formError}>{catalogError}</p> : null}
              {!catalogLoading && !availableReferenceVideoModels.length ? <p className={styles.formError}>{isThai ? "ยังไม่มีโมเดล AI Presenter ที่รองรับภาพและเสียงอ้างอิง กรุณาตั้งค่าโมเดลที่ Admin > AI Presenter > Presenter Video" : "No AI Presenter model is configured with image and audio reference inputs. Configure it in Admin > AI Presenter > Presenter Video."}</p> : null}
              {!voiceLoading && selectedAudioModel && !voices.length ? <p className={styles.formError}>{isThai ? "ไม่พบเสียงที่ใช้งานได้ในโมเดลนี้" : "No available voices for this speech model."}</p> : null}
              <p className={styles.securityNote}><LockKeyhole size={12} /> {t("create.settings.privateSecure")}</p>
            </div>
          </aside>
        </div>
      </section>

      {isAddSceneOpen && typeof document !== "undefined" ? createPortal(
        <div className={styles.sceneModalBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeAddScene(); }}>
          <section className={styles.sceneModal} role="dialog" aria-modal="true" aria-labelledby="add-scene-dialog-title" aria-describedby="add-scene-dialog-description">
            <form onSubmit={createScene}>
              <header className={styles.sceneModalHeader}>
                <div>
                  <span className={styles.sceneModalEyebrow}>{isThai ? `ฉากที่ ${scenes.length + 1} จาก 6` : `SCENE ${scenes.length + 1} OF 6`}</span>
                  <h2 id="add-scene-dialog-title">{isThai ? "เพิ่มฉากใหม่" : "Add a new scene"}</h2>
                  <p id="add-scene-dialog-description">{isThai ? "ตั้งค่าภาพและเสียง ใส่บทพูดก่อนเพิ่มลงในไทม์ไลน์" : "Set the visuals and voice, then add spoken lines to the timeline."}</p>
                </div>
                <button type="button" className={styles.sceneModalClose} onClick={closeAddScene} aria-label={isThai ? "ปิดหน้าต่าง" : "Close dialog"}><X size={18} /></button>
              </header>

              <div className={styles.sceneModalBody}>
                <div className={styles.sceneTemplatePicker}>
                  <div className={styles.sceneTemplateHeading}>
                    <strong>{isThai ? "เลือกช่วงของวิดีโอ" : "Choose a scene type"}</strong>
                    <small>{isThai ? "เลือกเทมเพลตเพื่อเติมชื่อและแนวทางภาพให้ แล้วเขียนบทพูดของซีนนี้" : "Choose a template for the title and visual direction, then write this scene’s spoken lines."}</small>
                  </div>
                  <div className={styles.sceneTemplateOptions}>
                    {sceneTemplateOptions.map((title) => {
                      const selected = newSceneTitle.trim().toLowerCase() === title.toLowerCase();
                      return (
                        <button key={title} type="button" className={`${styles.sceneTemplateOption} ${selected ? styles.sceneTemplateOptionActive : ""}`} onClick={() => { setNewSceneTitle(title); setNewSceneDirection(sceneTemplateDirection(title, isThai)); setNewSceneVisualMode(title === "Product Highlight" ? "scene-only" : "presenter"); setNewSceneError(""); }} aria-pressed={selected}>
                          <strong>{title}</strong>
                          <small>{title === "Product Highlight" ? (isThai ? "สินค้า / B-roll" : "Product / B-roll") : (isThai ? "พรีเซนเตอร์" : "Presenter")}</small>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <label className={styles.sceneModalField}>
                  <span>{isThai ? "ชื่อฉาก" : "Scene title"}<small>{isThai ? "ใช้ระบุฉากในไทม์ไลน์" : "Shown on the timeline"}</small></span>
                  <input autoFocus value={newSceneTitle} onChange={(event) => { setNewSceneTitle(event.target.value.slice(0, 40)); setNewSceneError(""); }} maxLength={40} placeholder={isThai ? "เช่น แนะนำสินค้า" : "e.g. Product introduction"} />
                </label>

                <div className={styles.sceneModalField}>
                  <span>{isThai ? "การแสดงผลในซีนนี้" : "Scene presentation"}</span>
                  <Dropdown
                    value={newSceneVisualMode}
                    options={sceneVisualModeOptions}
                    onChange={(value) => { setNewSceneVisualMode(value as PresenterVisualMode); setNewSceneError(""); }}
                    ariaLabel={isThai ? "เลือกการแสดงผลในซีนนี้" : "Choose what appears in this scene"}
                    className={styles.sceneModeDropdown}
                    triggerClassName={styles.sceneModeDropdownTrigger}
                    menuClassName={styles.sceneModeDropdownMenu}
                    optionClassName={styles.sceneModeDropdownOption}
                    menuPosition="fixed"
                  />
                  {newSceneVisualMode === "scene-only" ? <small className={styles.sceneModeHint}>{isThai ? "เสียงพูดยังเป็นเสียงพากย์ ใช้ภาพ/วิดีโอซีนได้แม้มีคน โดยไม่เพิ่มพรีเซนเตอร์ที่เลือก" : "Narration stays as voiceover. Scene media may include people; the selected presenter will not be added."}</small> : null}
                </div>

                <div className={styles.sceneModalField}>
                  <span>{isThai ? "พรีเซนเตอร์ของซีนนี้" : "Presenter for this scene"}<small>{isThai ? "เลือกเฉพาะซีนนี้ หรือใช้ค่าเริ่มต้น" : "Choose for this scene or use the default"}</small></span>
                  {newSceneVisualMode === "scene-only" ? (
                    <div className={styles.scenePresenterHidden}>{isThai ? "ไม่ใช้พรีเซนเตอร์ที่เลือก" : "Selected presenter not used"}</div>
                  ) : (
                    <>
                      <PresenterScenePicker
                        presenters={presenterOptions}
                        defaultPresenter={sourceMedia}
                        value={newScenePresenterId}
                        onChange={setNewScenePresenterId}
                        disabled={isLocked || !presenterOptions.length}
                        isThai={isThai}
                      />
                    </>
                  )}
                </div>

                <div className={styles.sceneModalField}>
                  <PresenterVoicePicker
                    key={`new-scene:${selectedAudioModel}`}
                    voices={voices}
                    value={newSceneVoiceId || selectedVoice}
                    onChange={(voiceId) => setNewSceneVoiceId(voiceId === selectedVoice ? "" : voiceId)}
                    disabled={voiceLoading || !voices.length || isLocked}
                    loading={voiceLoading}
                    isThai={isThai}
                  />
                </div>

                <label className={styles.sceneModalField}>
                  <span>{isThai ? "บทพูด" : "Spoken lines"}<small>{isThai ? "เสียงของซีนนี้จะอ่านข้อความนี้" : "This scene’s voice will speak this text"}</small></span>
                  <textarea value={newSceneScript} onChange={(event) => { setNewSceneScript(event.target.value); setNewSceneError(""); }} maxLength={Math.max(0, 5000 - script.length - (script ? 2 : 0))} rows={4} placeholder={sceneScriptPlaceholder(newSceneTitle, isThai)} required />
                  <small className={styles.sceneModalCounter}>{newSceneScript.length} / {Math.max(0, 5000 - script.length - (script ? 2 : 0))} {isThai ? "ตัวอักษรที่เหลือในโปรเจกต์" : "characters available in this project"}</small>
                </label>

                <label className={styles.sceneModalField}>
                  <span>{isThai ? "รายละเอียดภาพ / คำสั่งฉาก" : "Visual direction"}<small>{isThai ? "ไม่บังคับ · จะไม่ถูกอ่านออกเสียง" : "Optional · not spoken aloud"}</small></span>
                  <textarea value={newSceneDirection} onChange={(event) => setNewSceneDirection(event.target.value.slice(0, maxSceneDirectionLength))} maxLength={maxSceneDirectionLength} rows={2} placeholder={isThai ? "เช่น ภาพระยะใกล้สินค้า ฉากสว่าง โทนอุ่น" : "e.g. Close-up product shot, bright warm setting"} />
                </label>

                <div className={styles.sceneModalField}>
                  <span>{isThai ? "รูป / วิดีโอประกอบฉาก" : "Scene image or video"}<small>{newSceneVisualMode === "scene-only" ? (isThai ? "จำเป็นเมื่อไม่ใช้พรีเซนเตอร์ที่เลือก" : "Required when the selected presenter is not used") : (isThai ? "ไม่บังคับ · เพิ่มหรือเปลี่ยนภายหลังได้" : "Optional · you can add or replace it later")}</small></span>
                  <input ref={addSceneMediaInputRef} className={styles.hiddenInput} type="file" accept="image/png,image/jpeg,image/webp,video/mp4,video/webm" onChange={handleNewSceneMediaChange} />
                  {newSceneMedia ? (
                    <div className={styles.newSceneMediaCard}>
                      <span className={styles.newSceneMediaPreview}>{newSceneMedia.kind === "image" ? <Image src={newSceneMedia.previewUrl} alt="" fill unoptimized sizes="72px" /> : <video src={newSceneMedia.previewUrl} muted playsInline autoPlay loop />}</span>
                      <span className={styles.newSceneMediaInfo}><strong>{newSceneMedia.fileName}</strong><small>{newSceneMedia.kind === "video" ? (isThai ? "วิดีโอคั่นซีน" : "Video cutaway") : (isThai ? "ภาพฉาก" : "Scene image")}</small></span>
                      <button type="button" onClick={() => addSceneMediaInputRef.current?.click()} aria-label={isThai ? "เปลี่ยนสื่อฉาก" : "Replace scene media"}><CloudUpload size={15} /></button>
                      <button type="button" onClick={() => { if (newSceneMedia.previewUrl.startsWith("blob:")) URL.revokeObjectURL(newSceneMedia.previewUrl); setNewSceneMedia(null); setNewSceneMediaError(""); }} aria-label={isThai ? "นำสื่อฉากออก" : "Remove scene media"}><X size={15} /></button>
                    </div>
                  ) : (
                    <button type="button" className={styles.newSceneMediaUpload} onClick={() => addSceneMediaInputRef.current?.click()}>
                      <CloudUpload size={19} />
                      <strong>{isThai ? "เลือกรูปหรือวิดีโอ" : "Choose an image or video"}</strong>
                      <small>{isThai ? "PNG, JPG, WEBP · MP4/WEBM · ภาพไม่เกิน 10 MB · วิดีโอไม่เกิน 25 MB" : "PNG, JPG, WEBP · MP4/WEBM · images up to 10 MB · videos up to 25 MB"}</small>
                    </button>
                  )}
                  {newSceneMediaError ? <p className={styles.sceneModalError} role="alert">{newSceneMediaError}</p> : null}
                </div>
                {newSceneError ? <p className={styles.sceneModalError} role="alert">{newSceneError}</p> : null}
              </div>

              <footer className={styles.sceneModalFooter}>
                <button type="button" className={styles.sceneModalCancel} onClick={closeAddScene}>{isThai ? "ยกเลิก" : "Cancel"}</button>
                <button type="submit" className={styles.sceneModalSubmit} disabled={!newSceneTitle.trim() || !newSceneScript.trim() || (newSceneVisualMode === "scene-only" && !newSceneMedia) || !canAddScene || isLocked}>
                  <Plus size={16} />{isThai ? "เพิ่มฉากเข้าไทม์ไลน์" : "Add scene to timeline"}
                </button>
              </footer>
            </form>
          </section>
        </div>,
        document.body,
      ) : null}

    </div>
  );
}

type PresenterVoicePickerProps = {
  voices: AudioVoice[];
  value: string;
  onChange: (voiceKey: string) => void;
  disabled: boolean;
  loading: boolean;
  isThai: boolean;
};

type PresenterScenePickerProps = {
  presenters: SourceMedia[];
  defaultPresenter: SourceMedia | null;
  value: string;
  onChange: (presenterId: string) => void;
  disabled: boolean;
  isThai: boolean;
};

function PresenterScenePicker({ presenters, defaultPresenter, value, onChange, disabled, isThai }: PresenterScenePickerProps) {
  const defaultIndex = defaultPresenter ? presenters.findIndex((presenter) => presenter.id === defaultPresenter.id) : -1;
  const defaultName = defaultPresenter
    ? (isThai ? `ค่าเริ่มต้น · พรีเซนเตอร์ ${Math.max(1, defaultIndex + 1)}` : `Default · Presenter ${Math.max(1, defaultIndex + 1)}`)
    : (isThai ? "เลือกพรีเซนเตอร์หลักก่อน" : "Choose a default presenter first");
  const presenterLabel = (presenter: SourceMedia, index: number) => isThai
    ? `พรีเซนเตอร์ ${index + 1}${presenter.uploading ? " · กำลังอัปโหลด" : presenter.error ? " · อัปโหลดไม่สำเร็จ" : ""}`
    : `Presenter ${index + 1}${presenter.uploading ? " · Uploading" : presenter.error ? " · Upload failed" : ""}`;
  const optionContent = (presenter: SourceMedia | null, label: string, description?: string) => (
    <span className={styles.scenePresenterChoice}>
      <span className={styles.scenePresenterThumb}>
        {presenter?.previewUrl
          ? <Image src={presenter.previewUrl} alt="" fill unoptimized sizes="36px" />
          : <Video size={15} aria-hidden="true" />}
      </span>
      <span className={styles.scenePresenterCopy}>
        <strong>{label}</strong>
        {description ? <small>{description}</small> : null}
      </span>
    </span>
  );
  const options = [
    {
      value: "",
      label: optionContent(defaultPresenter, defaultName, isThai ? "ใช้ค่าตั้งต้นของโปรเจกต์" : "Use the project default"),
      disabled: !defaultPresenter,
    },
    ...presenters.map((presenter, index) => ({
      value: presenter.id,
      label: optionContent(
        presenter,
        presenterLabel(presenter, index),
        presenter.uploading
          ? (isThai ? "กำลังอัปโหลดภาพ" : "Uploading image")
          : presenter.error
            ? (isThai ? "อัปโหลดไม่สำเร็จ" : "Upload failed")
            : presenter.id === defaultPresenter?.id
              ? (isThai ? "พรีเซนเตอร์เริ่มต้น" : "Project default")
              : (isThai ? "เลือกใช้กับซีนนี้" : "Select for this scene"),
      ),
      disabled: presenter.uploading || Boolean(presenter.error) || !presenter.remoteUrl,
    })),
  ];

  return (
    <Dropdown
      value={value}
      options={options}
      onChange={onChange}
      ariaLabel={isThai ? "เลือกพรีเซนเตอร์ของซีนนี้" : "Choose presenter for this scene"}
      placeholder={isThai ? "เลือกพรีเซนเตอร์" : "Choose a presenter"}
      disabled={disabled}
      className={styles.scenePresenterPicker}
      triggerClassName={styles.scenePresenterTrigger}
      menuClassName={styles.scenePresenterMenu}
      optionClassName={styles.scenePresenterOption}
      menuPosition="fixed"
    />
  );
}

function PresenterVoicePicker({ voices, value, onChange, disabled, loading, isThai }: PresenterVoicePickerProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [playingVoiceKey, setPlayingVoiceKey] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const selectedVoice = voices.find((voice) => voice.key === value);
  const matchingVoices = voices.filter((voice) => `${voice.name} ${voice.description}`.toLocaleLowerCase().includes(searchTerm.trim().toLocaleLowerCase()));

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      audioRef.current?.pause();
      setPlayingVoiceKey(null);
      setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      audioRef.current?.pause();
      setPlayingVoiceKey(null);
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  useEffect(() => () => audioRef.current?.pause(), []);

  const togglePreview = (voice: AudioVoice, event: ReactMouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const audio = audioRef.current;
    if (!audio || !voice.previewUrl) return;
    if (playingVoiceKey === voice.key && !audio.paused) {
      audio.pause();
      audio.currentTime = 0;
      setPlayingVoiceKey(null);
      return;
    }
    audio.pause();
    audio.currentTime = 0;
    audio.src = voice.previewUrl;
    setPlayingVoiceKey(voice.key);
    void audio.play().catch(() => setPlayingVoiceKey(null));
  };

  const chooseVoice = (voice: AudioVoice) => {
    audioRef.current?.pause();
    setPlayingVoiceKey(null);
    onChange(voice.key);
    setSearchTerm("");
    setOpen(false);
  };

  return (
    <div ref={rootRef} className={styles.voicePickerRoot} data-open={open ? "true" : undefined}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.voicePickerTrigger}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={isThai ? "เลือกเสียงพรีเซนเตอร์" : "Choose presenter voice"}
        onClick={() => {
          if (open) {
            audioRef.current?.pause();
            setPlayingVoiceKey(null);
          }
          setSearchTerm("");
          setOpen((current) => !current);
        }}
      >
        <AudioLines size={15} aria-hidden="true" />
        <span className={styles.voicePickerValue}>
          <strong>{loading ? (isThai ? "กำลังโหลดเสียง…" : "Loading voices…") : selectedVoice?.name ?? (isThai ? "เลือกเสียง" : "Select a voice")}</strong>
        </span>
        <ChevronDown size={15} className={open ? styles.voicePickerChevronOpen : undefined} aria-hidden="true" />
      </button>
      {open ? (
        <div className={styles.voicePickerMenu} role="dialog" aria-label={isThai ? "เสียงพรีเซนเตอร์" : "Presenter voices"}>
          <label className={styles.voicePickerSearch}>
            <Search size={15} aria-hidden="true" />
            <input
              type="search"
              autoFocus
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={isThai ? "ค้นหาเสียง" : "Search voices"}
              aria-label={isThai ? "ค้นหาเสียง" : "Search voices"}
            />
          </label>
          <div className={styles.voicePickerList}>
            {matchingVoices.length ? matchingVoices.map((voice) => {
              const isSelected = voice.key === value;
              const isPlaying = playingVoiceKey === voice.key;
              return (
                <div key={voice.key} className={`${styles.voicePickerOption} ${isSelected ? styles.voicePickerOptionSelected : ""}`}>
                  <button type="button" className={styles.voicePickerChoose} onClick={() => chooseVoice(voice)} aria-pressed={isSelected}>
                    <span className={styles.voicePickerOptionCopy}>
                      <strong>{voice.name}</strong>
                      <small>{voice.description || (isThai ? "เสียง AI" : "AI voice")}</small>
                    </span>
                    {isSelected ? <Check size={16} aria-label={isThai ? "เลือกอยู่" : "Selected"} /> : null}
                  </button>
                  <button
                    type="button"
                    className={`${styles.voicePickerPreview} ${isPlaying ? styles.voicePickerPreviewPlaying : ""}`}
                    onClick={(event) => togglePreview(voice, event)}
                    disabled={!voice.previewUrl}
                    aria-label={voice.previewUrl ? (isPlaying ? (isThai ? `หยุดฟังตัวอย่าง ${voice.name}` : `Pause ${voice.name} preview`) : (isThai ? `ฟังตัวอย่าง ${voice.name}` : `Play ${voice.name} preview`)) : (isThai ? `ไม่มีตัวอย่างเสียง ${voice.name}` : `No preview for ${voice.name}`)}
                    title={voice.previewUrl ? (isPlaying ? (isThai ? "หยุด" : "Pause") : (isThai ? "ฟังตัวอย่าง" : "Play preview")) : (isThai ? "ไม่มีเสียงตัวอย่าง" : "No preview available")}
                  >
                    {isPlaying ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}
                  </button>
                </div>
              );
            }) : (
              <p className={styles.voicePickerEmpty}>{isThai ? "ไม่พบเสียงที่ค้นหา" : "No voices found"}</p>
            )}
          </div>
          <audio ref={audioRef} preload="none" onEnded={() => setPlayingVoiceKey(null)} onError={() => setPlayingVoiceKey(null)} />
        </div>
      ) : null}
    </div>
  );
}
