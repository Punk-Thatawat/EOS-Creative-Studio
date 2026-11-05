"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type MouseEvent as ReactMouseEvent } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, AudioLines, Check, ChevronDown, ChevronLeft, ChevronRight, CloudUpload, GripVertical, LoaderCircle, LockKeyhole, Pause, Pencil, Play, Plus, Sparkles, Video, WandSparkles, X } from "lucide-react";
import Link from "next/link";
import { EosVideoPlayer } from "@/components/media/eos-video-player";
import { CreatorWorkspaceLayout } from "@/components/create/creator-workspace-layout";
import { Dropdown } from "@/components/ui/dropdown";
import { SearchInput } from "@/components/ui/search-input";
import { InfoTooltip } from "@/features/create/components/info-tooltip";
import { ImageTutorialButton } from "@/features/create/image-generation/components/image-tutorial-button";
import { useLocale } from "@/lib/i18n/locale-provider";
import { getAccountScopedStorageKey } from "@/lib/generation-progress-storage";
import { createTextToSpeech, getAudioCreditBalance, listAudioModels, listAudioVoices, quoteTextToSpeechScenes, type AudioCreditQuote, type AudioModel, type AudioVoice } from "@/lib/api/audio";
import { listGenerationModels, type GenerationModelOption } from "@/lib/api/generation-models";
import { uploadPeopleMedia } from "@/lib/api/people-video-generations";
import { analyzePresenterVisualDirections, composePresenterVideo, createVideoStoryboard, getVideoStoryboardStatus, quoteVideoStoryboard, type VideoStoryboardResponse, type VideoStoryboardStatus } from "@/lib/api/video-generations";
import { emitGenerationCompleted, emitGenerationRequestFailed, emitGenerationRequestFinished, emitGenerationStarted, emitGenerationSubmitting } from "@/lib/generation-progress-events";
import { formatGenerationError, generationErrorFromStatus } from "@/lib/api/generation-errors";
import { emitCreditBalanceChanged, requestCreditBalanceSync } from "@/lib/credits/credit-events";
import { VideoPreviewLiveBadge, VideoPreviewOverlayActions, VideoPreviewPlaceholder } from "../video-preview-placeholder";
import { presenterDirectionForChunk } from "./presenter-visual-plan";
import { loadPresenterHistory, presenterHistoryKey, presenterPreviewUrl } from "./presenter-history";
import { fetchHistory, type HistoryItem } from "@/lib/api/history";
import videoPreviewStyles from "../video-generation-page.module.css";
import styles from "./ai-presenter-page.module.css";

const sampleScript = "Welcome to EOS Creative Studio. Turn your ideas into stories, and your stories into impact.";
const voicePreviewScripts = {
  en: sampleScript,
  th: "นี่คือตัวอย่างเสียงภาษาไทยสำหรับตรวจสอบโทนเสียงและคุณภาพการพูด",
} as const;
const supportedPresenterImageTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
const supportedSceneMediaTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
const maxSceneMediaTotalBytes = 60 * 1024 * 1024;
const maxSceneDurationSeconds = 15;
const maxPresenterOptions = 8;
const maxSceneDirectionLength = 800;
const sceneTemplateOptions = ["Intro", "Key Message", "Product Highlight", "CTA"] as const;
const aiPresenterDraftStorageKey = "eos.generation.ai-presenter-draft.v1";
const aiPresenterDraftMediaDatabase = "eos.generation.ai-presenter-media.v1";
const toneOptions = [
  { label: "Corporate", thaiLabel: "ทางการ", value: "Premium" },
  { label: "Friendly", thaiLabel: "เป็นมิตร", value: "Friendly" },
  { label: "Confident", thaiLabel: "มั่นใจ", value: "Dramatic" },
  { label: "Energetic", thaiLabel: "มีพลัง", value: "Energetic" },
] as const;
const aspectOptions = ["16:9", "9:16", "1:1"] as const;

type SourceMedia = { id: string; file?: File; fileName: string; previewUrl: string; kind: "image" | "video"; remoteUrl?: string; uploading: boolean; error?: string };
type SceneMedia = { file?: File; fileName: string; previewUrl: string; kind: "image" | "video"; remoteUrl?: string };
type AudioSceneSegment = { file: File; startSeconds: number; endSeconds: number; durationSeconds: number };
type AudioVideoChunk = AudioSceneSegment & { sceneIndex: number };
type SpeechPreview = { key: string; blob: Blob; url: string; durationSeconds: number; sceneAudio: AudioSceneSegment[]; videoChunks: AudioVideoChunk[]; remoteUrl?: string };
type PresenterVisualMode = "presenter" | "scene-only";
type PresenterScene = { id: string; title: string; script: string; direction: string; visualMode?: PresenterVisualMode; durationSeconds?: number; presenterId?: string; voiceId?: string; media?: SceneMedia; mediaError?: string };
type SavedAiPresenterScene = Omit<PresenterScene, "media" | "mediaError"> & { media?: { fileName: string; kind: SceneMedia["kind"]; remoteUrl?: string; hasFile: boolean } | null };
type SavedPresenterMedia = { id: string; fileName: string; kind: SourceMedia["kind"]; remoteUrl?: string; hasFile: boolean };
type SavedAiPresenterDraft = {
  version: 1;
  fullScript?: string;
  fullScriptPending?: boolean;
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
  const effectiveLanguage = /[\u0e00-\u0e7f]/.test(text) ? "th" : language;
  const spokenUnits = effectiveLanguage === "th" ? text.replace(/\s/g, "").length / 12 : effectiveLanguage === "ja" ? text.replace(/\s/g, "").length / 6 * 2.45 : text.split(/\s+/).length;
  return Math.max(3, Math.ceil(spokenUnits / (effectiveLanguage === "th" ? 1 : 2.45)));
}

function estimatedDuration(script: string, language: string, voicePace = 1): number {
  return Math.max(3, Math.ceil(baselineDuration(script, language) * voicePace));
}

function voicePaceForSample(sampleDuration: number | undefined, voiceId: string, language: string): number {
  if (!sampleDuration || !voiceId) return 1;
  return Math.max(0.65, Math.min(1.8, sampleDuration / baselineDuration(voicePreviewScripts[language === "th" ? "th" : "en"], language)));
}

function resolveSceneVoice(scene: PresenterScene, voices: AudioVoice[], defaultVoice: string): string {
  return scene.voiceId && voices.some((voice) => voice.key === scene.voiceId) ? scene.voiceId : defaultVoice;
}

function sceneDuration(scene: PresenterScene, language: string, voicePace = 1): number {
  return scene.script.trim() ? estimatedDuration(scene.script, language, voicePace) : 0;
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

function splitAudioForVideo(context: BaseAudioContext, audio: AudioBuffer, sceneIndex: number, sceneStart: number): AudioVideoChunk[] {
  const rate = audio.sampleRate;
  const chunks: AudioVideoChunk[] = [];
  let start = 0;
  while (start < audio.length) {
    const remaining = audio.length - start;
    let end = audio.length;
    if (remaining > maxSceneDurationSeconds * rate) {
      // Keep cuts below the provider limit and avoid a very short final part.
      const partsLeft = Math.ceil(remaining / (14 * rate));
      const target = start + Math.floor(remaining / partsLeft);
      const radius = Math.floor(rate);
      const windowSize = Math.max(1, Math.floor(rate * 0.02));
      const channels = Array.from({ length: audio.numberOfChannels }, (_, index) => audio.getChannelData(index));
      let best = target;
      let bestEnergy = Infinity;
      for (let position = Math.max(start + 4 * rate, target - radius); position <= Math.min(target + radius, start + maxSceneDurationSeconds * rate, audio.length - 4 * rate); position += windowSize) {
        let energy = 0;
        for (const channel of channels) for (let i = position; i < Math.min(position + windowSize, channel.length); i += 1) energy += (channel[i] ?? 0) ** 2;
        if (energy < bestEnergy) { bestEnergy = energy; best = position; }
      }
      end = Math.min(audio.length, Math.floor(best));
    }
    const piece = context.createBuffer(audio.numberOfChannels, end - start, rate);
    for (let channel = 0; channel < audio.numberOfChannels; channel += 1) piece.copyToChannel(audio.getChannelData(channel).subarray(start, end), channel);
    chunks.push({ sceneIndex, file: new File([encodeMonoWav(piece)], `presenter-${sceneIndex + 1}-${chunks.length + 1}.wav`, { type: "audio/wav" }), startSeconds: sceneStart + start / rate, endSeconds: sceneStart + end / rate, durationSeconds: (end - start) / rate });
    start = end;
  }
  return chunks;
}

async function combineSceneAudio(blobs: Blob[]): Promise<{ blob: Blob; segments: AudioSceneSegment[]; videoChunks: AudioVideoChunk[]; durationSeconds: number }> {
  if (blobs.length === 0) throw new Error("Every scene needs its own generated voice track");
  const audioContext = new AudioContext();
  try {
    const decodedAudio = await Promise.all(blobs.map((blob) => blob.arrayBuffer().then((data) => audioContext.decodeAudioData(data))));
    const audioBuffers = decodedAudio;
    const sampleRate = audioContext.sampleRate;
    const segments: AudioSceneSegment[] = [];
    const videoChunks: AudioVideoChunk[] = [];
    let cursorSeconds = 0;
    for (const [index, audio] of audioBuffers.entries()) {
      const durationSeconds = audio.duration;
      const endSeconds = cursorSeconds + durationSeconds;
      videoChunks.push(...splitAudioForVideo(audioContext, audio, index, cursorSeconds));
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
    return { blob: encodeMonoWav(combined), segments, videoChunks, durationSeconds: cursorSeconds };
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

function presenterPrompt(script: string, direction: string, hasSceneBackground = false, visualMode: PresenterVisualMode = "presenter", partialAudio = false, continueFromFrame = false): string {
  const sceneDirection = continueFromFrame
    ? visualMode === "scene-only"
      ? "Continue the scene visible in the supplied starting frame without adding the separately selected presenter."
      : "Continue the presenter and setting visible in the supplied starting frame; keep the reference person's identity and do not restart an earlier action."
    : visualMode === "scene-only"
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
  const speechDirection = partialAudio
    ? "Use only the words spoken in the provided reference audio for this segment. Do not repeat or invent any other words."
    : `Use only the provided narration and speak only these words: "${script.trim()}"`;
  const continuity = continueFromFrame ? "Continue directly from the supplied starting frame, preserving the presenter's position, appearance, background, lighting, and camera framing." : "";
  return `${performanceDirection} ${sceneDirection} ${continuity} ${speechDirection} ${visualDirection}`;
}

function presenterSceneVisualInput(scene: PresenterScene, presenterImageUrl: string, sceneImageUrl?: string, partialAudio = false, continueFromFrame = false) {
  const visualMode = scene.visualMode ?? "presenter";
  if (visualMode === "scene-only") {
    const image = sceneImageUrl ?? presenterImageUrl;
    return {
      storyboardImage: image,
      referenceImages: image ? [image] : [],
      prompt: presenterPrompt(scene.script, scene.direction, Boolean(sceneImageUrl), visualMode, partialAudio, continueFromFrame),
    };
  }
  return {
    storyboardImage: sceneImageUrl ?? presenterImageUrl,
    referenceImages: presenterImageUrl ? [presenterImageUrl] : [],
    prompt: presenterPrompt(scene.script, scene.direction, Boolean(sceneImageUrl), visualMode, partialAudio, continueFromFrame),
  };
}

function isElevenLabsSpeechModel(model: AudioModel): boolean {
  const key = model.key.trim().toLowerCase();
  return key === "eleven_v4" || key === "elevenlabs/eleven-v4";
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
  const [fullScript, setFullScript] = useState("");
  const [fullScriptPending, setFullScriptPending] = useState(false);
  const [splitError, setSplitError] = useState("");
  const [activeSceneId, setActiveSceneId] = useState("scene-1");
  const [isAddSceneOpen, setIsAddSceneOpen] = useState(false);
  const [editingSceneId, setEditingSceneId] = useState<string | null>(null);
  const [confirmSceneDelete, setConfirmSceneDelete] = useState(false);
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
  const [presenterHistory, setPresenterHistory] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState(false);
  const [historyRevision, setHistoryRevision] = useState(0);
  const [previewView, setPreviewView] = useState<"scene" | "latest" | "library">("scene");
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const historyRowRef = useRef<HTMLDivElement>(null);
  const [historyScroll, setHistoryScroll] = useState({ left: false, right: false });
  const [generationError, setGenerationError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    async function loadHistory() {
      setHistoryLoading(true);
      setHistoryError(false);
      try {
        const found = await loadPresenterHistory(fetchHistory, controller.signal);
        if (!controller.signal.aborted) setPresenterHistory(found);
      } catch {
        if (!controller.signal.aborted) setHistoryError(true);
      } finally {
        if (!controller.signal.aborted) setHistoryLoading(false);
      }
    }
    void loadHistory();
    return () => controller.abort();
  }, [historyRevision]);

  useEffect(() => {
    const refreshOnFocus = () => { if (document.visibilityState === "visible") setHistoryRevision((value) => value + 1); };
    document.addEventListener("visibilitychange", refreshOnFocus);
    return () => document.removeEventListener("visibilitychange", refreshOnFocus);
  }, []);

  const updateHistoryScroll = useCallback(() => {
    const row = historyRowRef.current;
    if (!row) return;
    setHistoryScroll({ left: row.scrollLeft > 1, right: row.scrollLeft + row.clientWidth < row.scrollWidth - 1 });
  }, []);
  useEffect(() => {
    const row = historyRowRef.current;
    if (!row) return;
    updateHistoryScroll();
    const observer = new ResizeObserver(updateHistoryScroll);
    observer.observe(row);
    return () => observer.disconnect();
  }, [presenterHistory.length, historyLoading, historyError, updateHistoryScroll]);

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
    if (scene.media?.kind === "video") return false;
    if (scene.visualMode === "scene-only" && scene.media?.kind === "image") {
      return Boolean(scene.media.remoteUrl) && !scene.mediaError;
    }
    return Boolean(presenter?.remoteUrl) && !presenter?.uploading && !presenter?.error;
  });
  const missingSceneVisual = scenes.find((scene) => scene.visualMode === "scene-only" && !scene.media);
  const unsupportedSceneVideo = scenes.find((scene) => scene.media?.kind === "video");
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
  const otherSceneTextLength = scenes.reduce((length, scene) => scene.id === activeScene?.id ? length : length + scene.script.length, 0) + Math.max(0, scenes.length - 1) * 2;
  const activeSceneMaxLength = Math.max(activeScene?.script.length ?? 0, 5000 - otherSceneTextLength);
  const canAddScene = script.length + 2 <= 5000;

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
        );
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
        if (typeof draft.fullScript === "string") setFullScript(draft.fullScript);
        setFullScriptPending(Boolean(draft.fullScriptPending));
        setActiveSceneId(typeof draft.activeSceneId === "string" && restoredScenes.some((scene) => scene.id === draft.activeSceneId) ? draft.activeSceneId : restoredScenes[0]!.id);
        if (typeof draft.tone === "string" && toneOptions.some((option) => option.value === draft.tone)) setTone(draft.tone as (typeof toneOptions)[number]["value"]);
        if (typeof draft.language === "string") setLanguage(draft.language);
        if (typeof draft.pronunciation === "string") setPronunciation(draft.pronunciation);
        if (typeof draft.selectedReferenceVideoModel === "string") setSelectedReferenceVideoModel(draft.selectedReferenceVideoModel);
        if (typeof draft.selectedAudioModel === "string" && ["eleven_v4", "elevenlabs/eleven-v4"].includes(draft.selectedAudioModel.toLowerCase())) setSelectedAudioModel(draft.selectedAudioModel);
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
      fullScript,
      fullScriptPending,
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
  }, [draftRestoreComplete, scenes, activeSceneId, tone, language, pronunciation, sourceMedia, presenterOptions, selectedReferenceVideoModel, selectedAudioModel, selectedVoice, aspect, fullScript, fullScriptPending]);

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
    void Promise.allSettled([listGenerationModels("ai-presenter"), listAudioModels("aiPresenter")]).then(([videoResult, audioResult]) => {
      if (!active) return;
      const errors: string[] = [];
      if (videoResult.status === "fulfilled") {
        const models = videoResult.value.filter((model) => model.enabled);
        setReferenceVideoModels(models);
        setSelectedReferenceVideoModel(models.find((model) => model.isDefault && modelSupports(model, undefined))?.model ?? models.find((model) => modelSupports(model, undefined))?.model ?? "");
      } else errors.push(isThai ? "โหลดโมเดลวิดีโอไม่สำเร็จ" : "Could not load presenter video models");
      if (audioResult.status === "fulfilled") {
        const models = audioResult.value.filter(isElevenLabsSpeechModel);
        const selectedModel = models.find((model) => model.isActive) ?? models[0];
        setSelectedAudioModel((current) => models.some((model) => model.key === current) ? current : selectedModel?.key ?? "");
        if (!models.length) errors.push(isThai ? "กรุณาตั้งค่า Eleven v4 ใน Admin > AI Presenter" : "Configure Eleven v4 in Admin > AI Presenter");
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
    void listAudioVoices(selectedAudioModel, "aiPresenter").then((items) => {
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
    if (!draftRestoreComplete || catalogLoading) return;
    const configured = availableReferenceVideoModels.find((model) => model.isDefault)?.model ?? availableReferenceVideoModels[0]?.model ?? "";
    if (!availableReferenceVideoModels.some((model) => model.model === selectedReferenceVideoModel)) setSelectedReferenceVideoModel(configured);
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
        feature: "aiPresenter",
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
    if (!allSceneVisualsReady || missingSceneVisual || !selectedVideoModel || !script.trim()) return null;
    const estimatedChunks = sceneTimeline.flatMap(({ scene, start, end }, index) => {
      const duration = end - start;
      const count = Math.max(1, Math.ceil(duration / 14));
      return Array.from({ length: count }, (_, partIndex) => ({ scene, index, partIndex, count, duration: Math.min(maxSceneDurationSeconds, generatedClipDuration(duration / count)) }));
    });
    return {
      model: selectedVideoModel.model,
      mode: "flexible" as const,
      generationMode: "ai-presenter" as const,
      audioMode: "none" as const,
      duration: estimatedChunks.reduce((total, chunk) => total + chunk.duration, 0),
      aspectRatio: aspect,
      scenes: estimatedChunks.map(({ scene, index, partIndex, count, duration }) => {
        const presenterImageUrl = scenePresenters[index]?.remoteUrl ?? "";
        const sceneImageUrl = scene.media?.kind === "image" ? scene.media.remoteUrl : undefined;
        return {
          ...presenterSceneVisualInput(scene, presenterImageUrl, sceneImageUrl, count > 1, partIndex > 0),
          startFrameSource: partIndex === 0 ? "manual" as const : "previous_last_frame" as const,
          duration,
        };
      }),
    };
  }, [allSceneVisualsReady, missingSceneVisual, scenePresenters, selectedVideoModel, script, sceneTimeline, aspect]);
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
    setPreviewView("scene");
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
    setPreviewView("scene");
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
      updateActiveScene({ mediaError: isThai ? "เลือกไฟล์ภาพ PNG, JPG หรือ WEBP" : "Choose a PNG, JPG, or WEBP image." });
      return;
    }
    const maxMegabytes = 10;
    const maxBytes = maxMegabytes * 1024 * 1024;
    if (!file.size) {
      updateActiveScene({ mediaError: isThai ? "ไฟล์ว่างเปล่า เลือกไฟล์ใหม่อีกครั้ง" : "This file is empty. Choose another file." });
      return;
    }
    if (file.size > maxBytes) {
      updateActiveScene({ mediaError: isThai ? `ไฟล์ภาพต้องมีขนาดไม่เกิน ${maxMegabytes} MB` : `The image must be ${maxMegabytes} MB or smaller.` });
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
      media: { file, fileName: file.name, previewUrl, kind: "image" },
      mediaError: undefined,
    });
    if (activeScene.visualMode === "scene-only") uploadSceneImage(activeScene.id, file);
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

  const openAddScene = () => {
    if (!canAddScene || isLocked) return;
    setConfirmSceneDelete(false);
    setEditingSceneId(null);
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

  const openEditScene = (scene: PresenterScene) => {
    if (isLocked) return;
    setConfirmSceneDelete(false);
    setPreviewView("scene");
    setActiveSceneId(scene.id);
    setEditingSceneId(scene.id);
    setNewSceneTitle(scene.title);
    setNewSceneVisualMode(scene.visualMode ?? "presenter");
    setNewSceneScript(scene.script);
    setNewSceneDirection(scene.direction);
    setNewScenePresenterId(scene.presenterId ?? "");
    setNewSceneVoiceId(scene.voiceId ?? "");
    setNewSceneMedia(scene.media ?? null);
    setNewSceneMediaError("");
    setNewSceneError("");
    setIsAddSceneOpen(true);
  };

  const closeAddScene = useCallback(() => {
    if (newSceneMedia?.previewUrl.startsWith("blob:") && !scenes.some((scene) => scene.media?.previewUrl === newSceneMedia.previewUrl)) URL.revokeObjectURL(newSceneMedia.previewUrl);
    setIsAddSceneOpen(false);
    setConfirmSceneDelete(false);
    setNewSceneMedia(null);
    setNewSceneMediaError("");
    setNewSceneError("");
    window.setTimeout(() => addSceneButtonRef.current?.focus(), 0);
  }, [newSceneMedia, scenes]);

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
      setNewSceneMediaError(isThai ? "เลือกไฟล์ภาพ PNG, JPG หรือ WEBP" : "Choose a PNG, JPG, or WEBP image.");
      return;
    }
    const maxMegabytes = 10;
    if (!file.size) {
      setNewSceneMediaError(isThai ? "ไฟล์ว่างเปล่า เลือกไฟล์ใหม่อีกครั้ง" : "This file is empty. Choose another file.");
      return;
    }
    if (file.size > maxMegabytes * 1024 * 1024) {
      setNewSceneMediaError(isThai ? `ไฟล์ภาพต้องมีขนาดไม่เกิน ${maxMegabytes} MB` : `The image must be ${maxMegabytes} MB or smaller.`);
      return;
    }
    const otherSceneMediaBytes = scenes.reduce((total, scene) => total + (scene.id === editingSceneId ? 0 : scene.media?.file?.size ?? 0), 0);
    if (otherSceneMediaBytes + file.size > maxSceneMediaTotalBytes) {
      setNewSceneMediaError(isThai ? "สื่อของทุกซีนรวมกันต้องไม่เกิน 60 MB" : "Scene media must total 60 MB or less.");
      return;
    }
    if (newSceneMedia?.previewUrl.startsWith("blob:") && !scenes.some((scene) => scene.media?.previewUrl === newSceneMedia.previewUrl)) URL.revokeObjectURL(newSceneMedia.previewUrl);
    setNewSceneMedia({ file, fileName: file.name, previewUrl: URL.createObjectURL(file), kind: "image" });
    setNewSceneMediaError("");
  };

  const createScene = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if ((!editingSceneId && !canAddScene) || isLocked) return;
    const cleanTitle = newSceneTitle.trim();
    const cleanScript = newSceneScript.trim();
    if (newSceneMedia?.kind === "video") {
      setNewSceneError(isThai ? "ซีนนี้มีวิดีโอจากแบบร่างเดิม กรุณาเปลี่ยนเป็นรูปภาพหรือนำออก" : "This scene contains a video from an older draft. Replace it with an image or remove it.");
      return;
    }
    if (newSceneVisualMode === "scene-only" && !newSceneMedia) {
      setNewSceneError(isThai ? "ซีนที่ไม่ใช้พรีเซนเตอร์ต้องมีภาพฉากหรือสินค้า" : "A scene without a presenter needs a scene or product image.");
      return;
    }
    if (!cleanTitle || !cleanScript) {
      setNewSceneError(isThai ? "กรอกชื่อฉากและบทพูดก่อนเพิ่มฉาก" : "Enter a scene title and spoken lines before adding the scene.");
      return;
    }
    const otherScripts = scenes.filter((scene) => scene.id !== editingSceneId).map((scene) => scene.script);
    const totalScriptLength = [...otherScripts, cleanScript].join("\n\n").trim().length;
    if (totalScriptLength > 5000) {
      setNewSceneError(isThai ? `บทพูดรวมได้ไม่เกิน 5,000 ตัวอักษร (เหลือ ${Math.max(0, 5000 - script.length - (script ? 2 : 0))})` : `All scene scripts are limited to 5,000 characters (${Math.max(0, 5000 - script.length - (script ? 2 : 0))} remaining).`);
      return;
    }
    const id = editingSceneId ?? crypto.randomUUID();
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
    if (editingSceneId) {
      const oldUrl = sceneMediaUrlsRef.current.get(id);
      if (oldUrl && oldUrl !== newSceneMedia?.previewUrl) URL.revokeObjectURL(oldUrl);
      sceneUploadControllersRef.current.get(id)?.abort();
      sceneUploadControllersRef.current.delete(id);
      sceneMediaUrlsRef.current.delete(id);
    }
    if (newSceneMedia?.previewUrl.startsWith("blob:")) sceneMediaUrlsRef.current.set(id, newSceneMedia.previewUrl);
    setScenes((current) => editingSceneId ? current.map((item) => item.id === id ? { ...item, ...scene, media: newSceneMedia ?? undefined, mediaError: undefined } : item) : [...current, scene]);
    if (newSceneVisualMode === "scene-only" && newSceneMedia?.kind === "image" && newSceneMedia.file && !newSceneMedia.remoteUrl) uploadSceneImage(id, newSceneMedia.file);
    setActiveSceneId(id);
    setPreviewView("scene");
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
          feature: "aiPresenter",
          text: scene.script.trim(), voice: sceneVoiceIds[index] ?? selectedVoice, modelId: selectedAudioModel, outputFormat: "mp3", languageCode: language,
          tone, speed: 1, pronunciationHint: pronunciation.trim() || undefined, idempotencyKey: crypto.randomUUID(),
        }, signal);
        generatedAudio = true;
        sceneBlobs.push(result.blob);
      }
      const combined = await combineSceneAudio(sceneBlobs);
      const url = URL.createObjectURL(combined.blob);
      const next: SpeechPreview = { key: speechKey, blob: combined.blob, url, durationSeconds: combined.durationSeconds, sceneAudio: combined.segments, videoChunks: combined.videoChunks };
      setSpeech((current) => { if (current) URL.revokeObjectURL(current.url); return next; });
      return next;
    } finally {
      if (generatedAudio) syncCurrentCreditBalance();
    }
  };

  const handleGenerateVideo = async () => {
    if (fullScriptPending || !allSceneVisualsReady || !script.trim() || !allScenesHaveScript || !allScenesHaveVoice || !selectedVideoModel || isGenerating || creditPreflightBusy) return;
    if (missingSceneVisual) {
      setGenerationError(isThai
        ? `${missingSceneVisual.title} ตั้งเป็นซีนไม่ใช้พรีเซนเตอร์ กรุณาเพิ่มภาพฉากหรือสินค้า`
        : `${missingSceneVisual.title} is set to use scene media without the selected presenter. Add a scene or product image first.`);
      return;
    }
    const missingSceneVideo = scenes.find((scene) => scene.media?.kind === "video" && !scene.media.file);
    if (missingSceneVideo) {
      setGenerationError(isThai ? `ไม่พบไฟล์วิดีโอของ ${missingSceneVideo.title} กรุณาอัปโหลดซีนนี้อีกครั้ง` : `The video file for ${missingSceneVideo.title} is missing. Upload it again.`);
      return;
    }
    if (scenes.some((scene, index) => index >= 6 && scene.media?.kind === "video")) {
      setGenerationError(isThai ? "วิดีโอประกอบรองรับเฉพาะ 6 ซีนแรก กรุณาเปลี่ยนสื่อก่อนสร้าง" : "Video cutaways are supported only in the first six scenes. Change the scene media before generating.");
      return;
    }
    if (!videoQuoteInput) {
      setGenerationError(isThai ? "ยังประเมินเครดิตวิดีโอไม่ได้ กรุณาตรวจภาพพรีเซนเตอร์และโมเดล" : "Video pricing is unavailable. Check the presenter image and model, then try again.");
      return;
    }
    let hasEnoughCredits = false;
    let preflightVideoCost = 0;
    setCreditPreflightBusy(true);
    setGenerationError("");
    setNotice(isThai ? "กำลังตรวจเครดิตเสียงและวิดีโอรวม…" : "Checking the combined speech and video credits…");
    try {
      const [freshSpeechQuote, freshVideoQuote, freshBalance] = await Promise.all([
        quoteTextToSpeechScenes({
          feature: "aiPresenter",
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
      preflightVideoCost = freshVideoCost;
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
      const directionsToAnalyze = scenes.filter((scene) => scene.direction.trim()).map((scene) => ({ id: scene.id, direction: scene.direction.trim() }));
      const directionPlans = new Map<string, { opening: string; continuation: string }>();
      if (directionsToAnalyze.length) {
        setNotice(isThai ? "AI กำลังวิเคราะห์รายละเอียดภาพของแต่ละซีน…" : "AI is planning the visual direction for each scene…");
        const analysis = await analyzePresenterVisualDirections(directionsToAnalyze, controller.signal);
        if (controller.signal.aborted) return;
        if (!Array.isArray(analysis.scenes) || analysis.scenes.length !== directionsToAnalyze.length) throw new Error(isThai ? "วิเคราะห์รายละเอียดภาพไม่ครบ กรุณาลองใหม่" : "Scene direction analysis is incomplete. Please try again.");
        for (const plan of analysis.scenes) {
          if (!directionsToAnalyze.some((scene) => scene.id === plan.id) || directionPlans.has(plan.id) || !plan.opening?.trim() || !plan.continuation?.trim()) throw new Error(isThai ? "ผลวิเคราะห์รายละเอียดภาพไม่ถูกต้อง กรุณาลองใหม่" : "Scene direction analysis is invalid. Please try again.");
          directionPlans.set(plan.id, plan);
        }
      }
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
      const videoChunks = current.videoChunks;
      if (!videoChunks.length || videoChunks.some((chunk) => chunk.durationSeconds > maxSceneDurationSeconds)) throw new Error("Invalid presenter audio segments");
      const requestedSceneDurations = videoChunks.map((segment) => generatedClipDuration(segment.durationSeconds));
      const plannedScenes = videoChunks.map(({ sceneIndex }, index) => {
        const scene = sceneTimeline[sceneIndex]!.scene;
        const partialAudio = videoChunks.filter((chunk) => chunk.sceneIndex === sceneIndex).length > 1;
        const continuation = index > 0 && videoChunks[index - 1]?.sceneIndex === sceneIndex;
        const visualPlan = directionPlans.get(scene.id);
        const direction = presenterDirectionForChunk(scene.direction, visualPlan, continuation);
        return {
          ...presenterSceneVisualInput({ ...scene, direction }, scenePresenters[sceneIndex]?.remoteUrl ?? "", sceneBackgroundUrls.get(scene.id), partialAudio, continuation),
          startFrameSource: continuation ? "previous_last_frame" as const : "manual" as const,
          duration: requestedSceneDurations[index],
        };
      });
      const actualVideoQuoteInput = {
        ...videoQuoteInput,
        duration: requestedSceneDurations.reduce((total, item) => total + item, 0),
        scenes: plannedScenes,
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
      if (actualVideoCost > preflightVideoCost && !window.confirm(isThai ? `เสียงที่สร้างแล้วอาจถูกหักเครดิตไปแล้ว ราคาวิดีโอจากเสียงจริงคือ ${actualVideoCost.toLocaleString()} เครดิต มากกว่าที่ประเมิน ${preflightVideoCost.toLocaleString()} เครดิต ต้องการสร้างวิดีโอต่อหรือไม่?` : `Speech may already have been charged. Video costs ${actualVideoCost.toLocaleString()} credits instead of the estimated ${preflightVideoCost.toLocaleString()}. Continue?`)) { setGenerationStatus("idle"); setNotice(""); return; }
      for (const [index, segment] of videoChunks.entries()) {
        setNotice(isThai ? `กำลังเตรียมเสียงช่วงที่ ${index + 1}/${videoChunks.length}…` : `Preparing audio segment ${index + 1}/${videoChunks.length}…`);
        audioUrls.push(await uploadPeopleMedia(segment.file, controller.signal));
        if (controller.signal.aborted) return;
      }
      setGenerationStatus("processing");
      setNotice(isThai ? "กำลังสร้างวิดีโอ…" : "Generating video…");
      const created = await createVideoStoryboard({
        model: selectedVideoModel.model,
        mode: "flexible",
        generationMode: "ai-presenter",
        duration: requestedSceneDurations.reduce((total, item) => total + item, 0),
        aspectRatio: aspect,
        audioMode: "none",
        scenes: plannedScenes.map((scene, index) => ({
          ...scene,
          audioUrl: audioUrls[index],
          referenceAudioDuration: videoChunks[index]!.durationSeconds,
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

      const scenesWithMedia = sceneTimeline.flatMap(({ scene }, sceneIndex) => {
        const { startSeconds, endSeconds } = audioSegments[sceneIndex]!;
        const media = scene.media;
        return media?.kind === "video" && media.file ? [{ sceneIndex, startSeconds, endSeconds, file: media.file }] : [];
      });
      let resultVideoUrl = videoUrl;
      {
        try {
          setGenerationProgress(98);
          setNotice(isThai ? "กำลังต่อวิดีโอและจัดเสียงต้นฉบับให้ตรงแต่ละช่วง…" : "Joining video segments and aligning the original narration…");
          const composed = await composePresenterVideo(storyboardId, scenesWithMedia, current.blob, videoChunks.map((chunk) => chunk.durationSeconds), controller.signal);
          resultVideoUrl = composed.url;
        } catch (error) {
          if (controller.signal.aborted) throw error;
          throw new Error(formatGenerationError(error, isThai
            ? "สร้างวิดีโอแล้ว แต่รวมภาพฉากเข้ากับวิดีโอไม่สำเร็จ"
            : "The video scenes were generated, but their visuals could not be joined to the video."));
        }
      }

      setFinalVideoUrl(resultVideoUrl);
      setPreviewView("latest");
      setSelectedHistoryId(null);
      setHistoryRevision((value) => value + 1);
      setGenerationProgress(100);
      setGenerationStatus("completed");
      setNotice(isThai ? "วิดีโอพร้อมแล้ว พร้อมเสียงบรรยายต้นฉบับ" : "Your presenter video is ready with the original narration.");
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
  const selectedHistoryVideo = selectedHistoryId ? presenterHistory.find((item) => presenterHistoryKey(item) === selectedHistoryId) : presenterHistory[0];
  const latestVideoUrl = finalVideoUrl || presenterHistory[0]?.outputUrl || "";
  const displayedVideoUrl = presenterPreviewUrl(previewView, finalVideoUrl, presenterHistory, selectedHistoryId);
  const canGenerate = Boolean(!fullScriptPending && allSceneVisualsReady && !missingSceneVisual && script.trim() && allScenesHaveScript && allScenesHaveVoice && selectedVideoModel && !isGenerating && !creditPreflightBusy && !catalogLoading && !voiceLoading);
  const sceneDurationsForEstimate = sceneTimeline.map(({ start, end }) => Math.max(1, Math.ceil(end - start)));
  const hasUniformSceneDurations = sceneDurationsForEstimate.every((sceneDuration) => sceneDuration === sceneDurationsForEstimate[0]);
  const estimateDescription = hasUniformSceneDurations
    ? `${scenes.length} ${isThai ? "ซีน" : "scenes"} × ${sceneDurationsForEstimate[0] ?? 0} ${isThai ? "วินาที" : "seconds"}`
    : `${scenes.length} ${isThai ? "ซีน · รวม" : "scenes · total"} ${Math.ceil(duration)} ${isThai ? "วินาที" : "seconds"}`;
  const generationHint = catalogLoading || voiceLoading || creditBalanceLoading || speechQuoteLoading || videoQuoteLoading
    ? (isThai ? "กำลังตรวจโมเดล เสียง และเครดิต…" : "Checking models, voice, and credits…")
    : fullScriptPending
      ? (isThai ? "นำบทที่ค้างไว้ไปใช้กับซีนก่อนสร้าง" : "Apply the saved script to a scene before generating")
    : !selectedVideoModel
        ? (isThai ? "เลือกโมเดลวิดีโอก่อนสร้าง" : "Choose a video model before generating")
        : unsupportedSceneVideo
          ? (isThai ? `${unsupportedSceneVideo.title}: เปลี่ยนวิดีโอประกอบเดิมเป็นรูปภาพหรือนำออก` : `${unsupportedSceneVideo.title}: replace the old scene video with an image or remove it`)
        : missingSceneVisual
          ? (isThai ? `${missingSceneVisual.title}: เพิ่มภาพฉากหรือสินค้า` : `${missingSceneVisual.title}: add a scene or product image`)
        : !allSceneVisualsReady
          ? (presenterOptions.some((presenter) => presenter.uploading)
            ? (isThai ? "กำลังอัปโหลดพรีเซนเตอร์…" : "Uploading presenter…")
            : (isThai ? "เพิ่มและเลือกภาพพรีเซนเตอร์ หรือเพิ่มสื่อให้ซีนที่ไม่ใช้พรีเซนเตอร์" : "Add and select a presenter, or add media for scenes without one"))
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
    <div className={`${styles.page} ai-presenter-studio-page`}>
      <header className="studio-hero-frame" aria-label="GEN AI PRESENTER">
        <picture>
          <source media="(max-width: 767.98px)" srcSet="/generated-assets/studio-heroes-v4/create-ai-presenter-mobile.webp" />
          <Image src="/generated-assets/studio-heroes-v4/create-ai-presenter-desktop.webp" alt="GEN AI PRESENTER — Your presence, your story" width={2400} height={435} priority sizes="100vw" />
        </picture>
      </header>

      <CreatorWorkspaceLayout
        className={styles.workspace}
        tabs={
          <nav className={styles.modeTabs} aria-label={isThai ? "เครื่องมือ AI Presenter" : "AI Presenter tools"}>
            <span className={styles.modeTab} aria-current="page"><Video size={16} aria-hidden="true" />Presenter Video</span>
          </nav>
        }
        left={
          <section className={styles.scriptPanel} aria-labelledby="presenter-script-heading">
            <div className={styles.tutorialTop}><ImageTutorialButton feature="ai-presenter" featureName={isThai ? "พรีเซนเตอร์ AI" : "AI Presenter"} /></div>
            <div className={styles.panelTitle}>
              <div><span className={styles.stepNumber}>1.</span><h2 id="presenter-script-heading">{isThai ? "พรีเซนเตอร์และบทพูด" : "PRESENTER & SCRIPT"}</h2></div>
            </div>
            <p className={styles.panelDescription}>{isThai ? "เพิ่มพรีเซนเตอร์ แล้วเขียนบทพูดของแต่ละซีน" : "Add a presenter and write the script for each scene."}</p>
            <div className={styles.presenterPicker}>
              <input ref={sourceInputRef} className={styles.hiddenInput} type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={(event) => void handleSourceChange(event)} disabled={isLocked || presenterOptions.length >= maxPresenterOptions || presenterOptions.some((presenter) => presenter.uploading)} />
              <div className={styles.sectionHeading}>
                <h3>{isThai ? "พรีเซนเตอร์ของคุณ" : "Your Presenter"}</h3>
                <span className={styles.presenterCount}>{presenterOptions.length} / {maxPresenterOptions}</span>
              </div>
              <p className={styles.fieldDescription}>{isThai ? "เพิ่มภาพ แล้วเลือกพรีเซนเตอร์หลักสำหรับวิดีโอ" : "Add images, then choose the default presenter for your video."}</p>
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
                        {sourceMedia?.id === presenter.id && !presenter.uploading && !presenter.error ? <small className={styles.presenterSelected}><Check size={11} aria-hidden="true" />{isThai ? "เลือกแล้ว" : "Selected"}</small> : null}
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
                  <strong>{isThai ? "เพิ่มรูป" : "Add image"}</strong>
                  <small>{isThai ? "เลือกได้หลายรูป" : "Select multiple"}</small>
                </button>
              </div>
            </div>
            {fullScriptPending && fullScript.trim() ? <div className={styles.fullScriptPanel}>
              <label htmlFor="presenter-saved-script" className={styles.formLabel}>{isThai ? "บทที่ค้างไว้จากแบบเดิม" : "Saved script from the previous editor"}</label>
              <p className={styles.fieldDescription}>{isThai ? "คัดลอกบทนี้ไปยังซีนที่ต้องการก่อนสร้าง" : "Copy this script into the desired scene before generating."}</p>
              <textarea id="presenter-saved-script" className={styles.fullScriptInput} value={fullScript} onChange={(event) => setFullScript(event.target.value)} maxLength={5000} />
              <button type="button" className={styles.splitButton} onClick={() => { if (!activeScene || !window.confirm(isThai ? "แทนบทในซีนที่เลือกด้วยบทที่ค้างไว้?" : "Replace the selected scene's script with the saved script?")) return; if (fullScript.length > activeSceneMaxLength) { setSplitError(isThai ? "บทพูดรวมทุกซีนต้องไม่เกิน 5,000 ตัวอักษร" : "The combined scene scripts cannot exceed 5,000 characters."); return; } setScenes((current) => current.map((scene) => scene.id === activeScene.id ? { ...scene, script: fullScript } : scene)); setFullScriptPending(false); setSplitError(""); }}>{isThai ? "ใช้บทนี้กับซีนที่เลือก" : "Use this script in the selected scene"}</button>
              {splitError ? <p className={styles.splitWarning} role="alert">{splitError}</p> : null}
            </div> : null}
            {activeScene ? <div className={styles.fullScriptPanel}>
              <label htmlFor="presenter-scene-script" className={styles.formLabel}>{isThai ? `บทพูด · ${activeScene.title}` : `Script · ${activeScene.title}`}</label>
              <p className={styles.fieldDescription}>{isThai ? "พิมพ์บทพูดของซีนนี้ ระบบจะจัดการเสียงช่วงยาวให้เบื้องหลัง" : "Enter this scene's script. Longer audio is handled automatically."}</p>
              <textarea id="presenter-scene-script" className={styles.fullScriptInput} value={activeScene.script} onChange={(event) => setScenes((current) => current.map((scene) => scene.id === activeScene.id ? { ...scene, script: event.target.value } : scene))} maxLength={activeSceneMaxLength} disabled={isLocked} placeholder={isThai ? "พิมพ์บทพูดของซีนนี้" : "Enter this scene's spoken script"} />
              <div className={styles.fullScriptMeta}><span>{isThai ? "บทพูดรวมทุกซีน" : "All scenes"}</span><span>{script.length.toLocaleString()} / 5,000</span></div>
            </div> : null}
            {scenes.length === 1 && scenes[0]?.script === sampleScript ? <p className={styles.sampleNotice}>{isThai ? "Intro มีบทตัวอย่างอยู่ เปลี่ยนข้อความด้านบนได้เลย" : "Intro contains sample text. You can edit it above."}</p> : null}
            <div className={styles.formGroup}>
              <div className={styles.formLabel}><span>{isThai ? "โทนเสียง" : "Speech tone"}</span></div>
              <div className={styles.chipRow}>{toneOptions.map((option) => <button type="button" key={option.value} className={`${styles.toneChip} ${tone === option.value ? styles.toneChipActive : ""}`} onClick={() => setTone(option.value)} disabled={isLocked} aria-pressed={tone === option.value}>{isThai ? option.thaiLabel : option.label}</button>)}</div>
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

          </section>
        }
        preview={
          <section className={styles.previewPanel} aria-labelledby="presenter-preview-heading">
            <div className={styles.panelTitle}>
              <div><span className={styles.stepNumber}>2.</span><h2 id="presenter-preview-heading">{isThai ? "ตัวอย่างวิดีโอ" : "VIDEO PREVIEW"}</h2></div>
              {finalVideoUrl || !activeScene?.media ? (
                <span className={`${styles.previewBadge} ${finalVideoUrl ? styles.previewReady : ""}`}>
                  <span />{finalVideoUrl ? (isThai ? "วิดีโอที่สร้างแล้ว" : "GENERATED") : activeScene?.visualMode === "scene-only" ? (isThai ? "ใช้สื่อของซีน" : "SCENE MEDIA") : (isThai ? "ตัวอย่างพรีเซนเตอร์" : "PRESENTER SOURCE")}
                </span>
              ) : null}
            </div>
            <div className={styles.previewSectionHeading}><strong>{isThai ? "ตัวอย่าง" : "Preview"}</strong><span>{previewView === "scene" ? (isThai ? "แสดงภาพของซีนที่เลือก" : "Shows the selected scene") : (isThai ? "วิดีโอที่สร้างแล้ว" : "Generated video")}</span></div>
            <div className={`${styles.videoFrame} ${!isGenerating && !displayedVideoUrl && (previewView !== "scene" || (!activeScene?.media && (activeScene?.visualMode === "scene-only" || !activeScenePresenter))) ? styles.videoFrameEmpty : ""}`}>
              <VideoPreviewLiveBadge />
              {isGenerating ? (
                <div className={videoPreviewStyles.videoGeneratingPreview} aria-busy="true">
                  <WandSparkles size={26} />
                  <strong>{generationStatus === "uploading" ? (isThai ? "กำลังเตรียมไฟล์" : "Preparing files") : (isThai ? "กำลังสร้างวิดีโอ" : "Generating video")}</strong>
                  <span>{notice ?? (isThai ? "กำลังส่งภาพและเสียงอ้างอิงให้ MiniMax" : "Sending the image and audio reference to MiniMax.")}</span>
                  <div className={videoPreviewStyles.videoGenerationProgress}><i style={{ width: `${Math.max(8, generationProgress)}%` }} /></div>
                  <small>{isThai ? `เสร็จแล้ว ${generationProgress}%` : `${generationProgress}% complete`}</small>
                </div>
              ) : displayedVideoUrl ? (
                <EosVideoPlayer
                  key={`player:${displayedVideoUrl}`}
                  src={displayedVideoUrl}
                  className={`${videoPreviewStyles.generatedVideoPlayer} ${videoPreviewStyles.peopleGeneratedVideoPlayer}`}
                  mediaFrameClassName={videoPreviewStyles.videoPreviewMediaFrame}
                  ariaLabel={isThai ? "วิดีโอพรีเซนเตอร์ที่สร้างแล้ว" : "Generated presenter video"}
                />
              ) : previewView !== "scene" ? (
                <VideoPreviewPlaceholder showActions={false} />
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
              {displayedVideoUrl && !isGenerating ? <VideoPreviewOverlayActions key={`actions:${displayedVideoUrl}`} videoUrl={displayedVideoUrl} /> : null}
            </div>
            <section className={styles.presenterHistory} aria-label={isThai ? "ประวัติวิดีโอพรีเซนเตอร์" : "Presenter video history"}>
              <div className={videoPreviewStyles.previewViewTabs} role="tablist" aria-label={isThai ? "มุมมองตัวอย่างวิดีโอ" : "Video preview views"}>
                <button type="button" role="tab" aria-selected={previewView === "scene"} className={previewView === "scene" ? videoPreviewStyles.previewViewTabActive : undefined} onClick={() => setPreviewView("scene")} disabled={isGenerating}>{isThai ? "ซีนปัจจุบัน" : "Current scene"}</button>
                <button type="button" role="tab" aria-selected={previewView === "latest"} className={previewView === "latest" ? videoPreviewStyles.previewViewTabActive : undefined} onClick={() => setPreviewView("latest")} disabled={isGenerating}>{isThai ? "ผลลัพธ์ล่าสุด" : "Latest result"}</button>
                <button type="button" role="tab" aria-selected={previewView === "library"} className={previewView === "library" ? videoPreviewStyles.previewViewTabActive : undefined} onClick={() => setPreviewView("library")} disabled={isGenerating}>{isThai ? "คลังวิดีโอ" : "Video library"}</button>
              </div>
              <div className={videoPreviewStyles.videoGalleryGrid}>
                <div className={videoPreviewStyles.videoGalleryColumn}>
                  <div className={videoPreviewStyles.videoGalleryHeading}><h3>{isThai ? "วิดีโอล่าสุด" : "Latest video"}</h3></div>
                  <div className={videoPreviewStyles.videoCurrentGallery}>
                    {latestVideoUrl ? <button type="button" className={videoPreviewStyles.videoCurrentCard} onClick={() => setPreviewView("latest")} aria-pressed={previewView === "latest"} disabled={isGenerating}>
                      <span className={videoPreviewStyles.videoGalleryThumb}><video src={latestVideoUrl} muted playsInline preload="metadata" controls={false} disablePictureInPicture disableRemotePlayback tabIndex={-1} aria-hidden="true" /><span className={videoPreviewStyles.videoGalleryPlay}><Play size={14} fill="currentColor" /></span></span>
                      <span className={videoPreviewStyles.videoGalleryStatus}>{isThai ? "วิดีโอที่สร้างล่าสุด" : "Latest generated video"}</span>
                    </button> : <div className={videoPreviewStyles.videoGalleryEmpty}>{historyLoading ? (isThai ? "กำลังโหลดประวัติ…" : "Loading history…") : (isThai ? "ยังไม่มีวิดีโอที่สร้าง" : "No generated videos yet")}</div>}
                  </div>
                </div>
                <div className={`${videoPreviewStyles.videoGalleryColumn} ${videoPreviewStyles.videoRecentColumn}`}>
                  <div className={videoPreviewStyles.videoGalleryHeading}><h3>{isThai ? "วิดีโอล่าสุด" : "Recent videos"}</h3><Link href="/history?type=video" className={styles.historyLink}>{isThai ? "ดูประวัติ" : "View history"}</Link></div>
                  <div className={videoPreviewStyles.videoRecentGallery}>
                    <div className={videoPreviewStyles.videoRecentRow} ref={historyRowRef} onScroll={updateHistoryScroll}>
                      {historyLoading && !presenterHistory.length ? <div className={videoPreviewStyles.videoGalleryEmpty}>{isThai ? "กำลังโหลดประวัติ…" : "Loading history…"}</div> : historyError ? <div className={`${videoPreviewStyles.videoGalleryEmpty} ${videoPreviewStyles.videoGalleryError}`} role="alert">{isThai ? "โหลดประวัติไม่สำเร็จ" : "Could not load history"} <button type="button" onClick={() => setHistoryRevision((value) => value + 1)}>{isThai ? "ลองอีกครั้ง" : "Retry"}</button></div> : presenterHistory.length ? presenterHistory.map((item) => {
                        const selected = previewView === "library" && selectedHistoryVideo !== undefined && presenterHistoryKey(selectedHistoryVideo) === presenterHistoryKey(item);
                        const date = new Date(item.createdAt).toLocaleString(isThai ? "th-TH" : "en-US");
                        return <button key={presenterHistoryKey(item)} type="button" className={`${videoPreviewStyles.videoRecentCard} ${selected ? videoPreviewStyles.videoRecentCardSelected : ""}`} onClick={() => { setSelectedHistoryId(presenterHistoryKey(item)); setPreviewView("library"); }} aria-label={isThai ? `เปิดวิดีโอพรีเซนเตอร์ ${date}` : `Open presenter video ${date}`} aria-pressed={selected} disabled={isGenerating}>
                          <span className={videoPreviewStyles.videoGalleryThumb}><video src={item.outputUrl} muted playsInline preload="metadata" controls={false} disablePictureInPicture disableRemotePlayback tabIndex={-1} aria-hidden="true" /><span className={videoPreviewStyles.videoGalleryPlay}><Play size={13} fill="currentColor" /></span></span>
                        </button>;
                      }) : <div className={videoPreviewStyles.videoGalleryEmpty}>{isThai ? "ยังไม่มีประวัติวิดีโอพรีเซนเตอร์" : "No presenter videos yet"}</div>}
                    </div>
                    {historyScroll.left || historyScroll.right ? <>
                      <button type="button" className={videoPreviewStyles.videoGalleryPrev} onClick={() => historyRowRef.current?.scrollBy({ left: -290, behavior: "smooth" })} aria-label={isThai ? "เลื่อนประวัติกลับ" : "Previous videos"} disabled={!historyScroll.left}><ChevronLeft size={18} /></button>
                      <button type="button" className={videoPreviewStyles.videoGalleryNext} onClick={() => historyRowRef.current?.scrollBy({ left: 290, behavior: "smooth" })} aria-label={isThai ? "เลื่อนประวัติต่อ" : "Next videos"} disabled={!historyScroll.right}><ChevronRight size={18} /></button>
                    </> : null}
                  </div>
                </div>
              </div>
            </section>
            <section className={styles.presenterTimeline} aria-label={isThai ? "ไทม์ไลน์ฉาก" : "Scene timeline"}>
              <div className={styles.timelineHeader}>
                <div className={styles.sectionHeading}>
                  <h3>{isThai ? "ไทม์ไลน์ฉาก" : "Scene Timeline"}</h3>
                  <span className={styles.sceneCount}>{scenes.length} {isThai ? "ซีน" : "scenes"}</span>
                </div>
                <button type="button" className={styles.textButton} onClick={() => setIsReorderingScenes((current) => !current)} disabled={isLocked || scenes.length < 2} aria-pressed={isReorderingScenes}>
                  {isReorderingScenes ? (isThai ? "เสร็จสิ้น" : "Done") : (isThai ? "เรียงฉากใหม่" : "Reorder Scenes")}
                </button>
              </div>
              {isReorderingScenes ? <p className={styles.timelineNote}>{isThai ? "ลากฉากเพื่อเปลี่ยนลำดับ" : "Drag scenes to change their order."}</p> : null}
              <div className={styles.sceneTimeline}>
                {sceneTimeline.map(({ scene }, index) => (
                  <div key={scene.id} className={styles.sceneItem} draggable={isReorderingScenes}
                    onDragStart={(event) => { if (!isReorderingScenes) return; event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", scene.id); }}
                    onDragOver={(event) => { if (isReorderingScenes) { event.preventDefault(); event.dataTransfer.dropEffect = "move"; } }}
                    onDrop={(event) => { if (!isReorderingScenes) return; event.preventDefault(); reorderScenes(event.dataTransfer.getData("text/plain"), scene.id); }}>
                    <div className={`${styles.sceneCard} ${activeSceneId === scene.id ? styles.sceneCardActive : ""}`}>
                      <button type="button" className={styles.sceneSelect} onClick={() => { setActiveSceneId(scene.id); setPreviewView("scene"); }} aria-pressed={activeSceneId === scene.id} disabled={isLocked}>
                        <span className={styles.sceneImage}>
                          {scene.media?.previewUrl && scene.media.kind === "image" ? <Image src={scene.media.previewUrl} alt="" fill unoptimized sizes="46px" /> : scene.media?.previewUrl && scene.media.kind === "video" ? <video src={scene.media.previewUrl} muted playsInline autoPlay loop /> : <Video size={16} />}
                        </span>
                        <span className={styles.sceneCopy}><span className={styles.sceneTitleRow}><strong>{scene.title || `${isThai ? "ฉาก" : "Scene"} ${index + 1}`}</strong></span></span>
                      </button>
                      {isReorderingScenes ? <span className={styles.sceneMore}><GripVertical size={13} /></span> : <button type="button" className={styles.sceneMore} onClick={() => openEditScene(scene)} aria-label={isThai ? `แก้ไขซีน ${index + 1}` : `Edit scene ${index + 1}`} title={isThai ? "แก้ไขซีน" : "Edit scene"} disabled={isLocked}><Pencil size={12} /></button>}
                    </div>
                    {index < scenes.length - 1 ? <ArrowRight className={styles.sceneArrow} size={13} /> : null}
                  </div>
                ))}
                <button ref={addSceneButtonRef} type="button" className={styles.addScene} onClick={openAddScene} disabled={!canAddScene || isLocked}>
                  <Plus size={18} /><span>{isThai ? "เพิ่มฉาก" : "Add Scene"}</span>
                </button>
              </div>
            </section>
            {generationError ? <div className={styles.errorCard} role="alert">{generationError}</div> : null}
          </section>
        }
        right={
          <aside className={styles.settingsPanel} aria-labelledby="presenter-settings-heading">
            <div className={styles.panelTitle}><div><span className={styles.stepNumber}>3.</span><h2 id="presenter-settings-heading">{isThai ? "ตั้งค่าและสร้าง" : "SETTINGS & CREATE"}</h2></div><Sparkles size={15} className={styles.settingsSparkle} /></div>
            <p className={styles.panelDescription}>{isThai ? "เลือกเสียงและรูปแบบ ก่อนตรวจเครดิต" : "Choose the voice and format, then review the credit estimate."}</p>

            <div className={styles.settingCard}>
              <span className={styles.settingLabel}>{isThai ? "โมเดลสร้างวิดีโอ" : "Presenter video model"} <InfoTooltip content={t("create.video.common.info.model")} size={12} /></span>
              <Dropdown
                value={selectedReferenceVideoModel}
                options={availableReferenceVideoModels.map((model) => ({ value: model.model, label: model.displayName, preserveLabel: true }))}
                onChange={setSelectedReferenceVideoModel}
                triggerLabel={<span className={styles.settingModelValue}><Video size={14} /><span>{availableReferenceVideoModels.find((model) => model.model === selectedReferenceVideoModel)?.displayName ?? (isThai ? "เลือกโมเดล" : "Select a model")}</span></span>}
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
              <span className={styles.settingLabel}>{isThai ? "เสียงเริ่มต้น" : "Default voice"}</span>
              <PresenterVoicePicker
                key={`default:${selectedAudioModel}`}
                voices={voices}
                value={selectedVoice}
                onChange={setSelectedVoice}
                disabled={voiceLoading || !voices.length || isLocked}
                loading={voiceLoading}
                isThai={isThai}
              />
              <p className={styles.fieldDescription}>{isThai ? "ใช้กับทุกซีนที่ไม่ได้เลือกเสียงเฉพาะ" : "Used for scenes without their own voice selection."}</p>
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
              <div className={styles.settingLabel}>{isThai ? "สัดส่วนวิดีโอ" : "Video format"} <InfoTooltip content={t("create.video.common.info.aspectRatio")} size={12} /></div>
              <div className={styles.formatChoices}>{(supportedRatios.length ? supportedRatios : aspectOptions).map((value) => <button key={value} type="button" className={`${styles.formatOption} ${aspect === value ? styles.formatOptionActive : ""}`} onClick={() => setAspect(value as (typeof aspectOptions)[number])} aria-pressed={aspect === value} disabled={isLocked}><span className={`${styles.formatShape} ${value === "9:16" ? styles.formatPortrait : value === "1:1" ? styles.formatSquare : ""}`} /><strong>{value}</strong><small>{value === "16:9" ? (isThai ? "แนวนอน" : "Landscape") : value === "9:16" ? (isThai ? "แนวตั้ง" : "Portrait") : (isThai ? "จัตุรัส" : "Square")}</small></button>)}</div>
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
        }
      />

      {isAddSceneOpen && typeof document !== "undefined" ? createPortal(
        <div className={styles.sceneModalBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeAddScene(); }}>
          <section className={styles.sceneModal} role="dialog" aria-modal="true" aria-labelledby="add-scene-dialog-title" aria-describedby="add-scene-dialog-description">
            <form onSubmit={createScene}>
              <header className={styles.sceneModalHeader}>
                <div>
                  <span className={styles.sceneModalEyebrow}>{isThai ? `ซีน ${editingSceneId ? scenes.findIndex((scene) => scene.id === editingSceneId) + 1 : scenes.length + 1}` : `SCENE ${editingSceneId ? scenes.findIndex((scene) => scene.id === editingSceneId) + 1 : scenes.length + 1}`}</span>
                  <h2 id="add-scene-dialog-title">{editingSceneId ? (isThai ? "แก้ไขซีน" : "Edit scene") : (isThai ? "เพิ่มฉากใหม่" : "Add a new scene")}</h2>
                  <p id="add-scene-dialog-description">{isThai ? "ตั้งค่าภาพและเสียง ใส่บทพูดก่อนเพิ่มลงในไทม์ไลน์" : "Set the visuals and voice, then add spoken lines to the timeline."}</p>
                </div>
                <button type="button" className={styles.sceneModalClose} onClick={closeAddScene} aria-label={isThai ? "ปิดหน้าต่าง" : "Close dialog"}><X size={18} /></button>
              </header>

              <div className={styles.sceneModalBody}>
                {!editingSceneId ? <div className={styles.sceneTemplatePicker}>
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
                </div> : null}

                <label className={styles.sceneModalField}>
                  <span>{isThai ? "ชื่อฉาก" : "Scene title"}<small>{isThai ? "ใช้ระบุฉากในไทม์ไลน์" : "Shown on the timeline"}</small></span>
                  <input autoFocus value={newSceneTitle} onChange={(event) => { setNewSceneTitle(event.target.value.slice(0, 40)); setNewSceneError(""); }} maxLength={40} placeholder={isThai ? "เช่น แนะนำสินค้า" : "e.g. Product introduction"} />
                </label>

                <label className={styles.sceneModalField}>
                  <span>{isThai ? "บทพูด" : "Spoken lines"}<small>{isThai ? "เสียงของซีนนี้จะอ่านข้อความนี้" : "This scene’s voice will speak this text"}</small></span>
                  <textarea value={newSceneScript} onChange={(event) => { setNewSceneScript(event.target.value); setNewSceneError(""); }} maxLength={Math.max(0, 5000 - scenes.filter((scene) => scene.id !== editingSceneId).map((scene) => scene.script).join("\n\n").length - (scenes.length > (editingSceneId ? 1 : 0) ? 2 : 0))} rows={4} placeholder={sceneScriptPlaceholder(newSceneTitle, isThai)} required />
                  <small className={styles.sceneModalCounter}>{isThai ? "เวลาประมาณ" : "Estimated"} {estimatedDuration(newSceneScript, language, voicePaceForSample(voiceSampleDurations[JSON.stringify([selectedAudioModel, newSceneVoiceId || selectedVoice])], newSceneVoiceId || selectedVoice, language))} {isThai ? "วินาที · ตรวจเสียงจริงอีกครั้งหลังสร้าง" : "seconds · checked again after generating audio"}</small>
                </label>

                <div className={styles.sceneModalField}>
                  <span id="scene-visual-mode-label">{isThai ? "รูปแบบซีน" : "Scene type"}<small>{isThai ? "เลือกภาพที่จะแสดงในซีนนี้" : "Choose what to show in this scene"}</small></span>
                  <div className={styles.sceneVisualModes} role="group" aria-labelledby="scene-visual-mode-label">
                    <button type="button" className={`${styles.sceneVisualMode} ${newSceneVisualMode === "presenter" ? styles.sceneVisualModeActive : ""}`} aria-pressed={newSceneVisualMode === "presenter"} onClick={() => { setNewSceneVisualMode("presenter"); setNewSceneError(""); }} disabled={isLocked}>
                      <strong>{isThai ? "พรีเซนเตอร์" : "Presenter"}</strong>
                      <small>{isThai ? "แสดงพรีเซนเตอร์พูด" : "Show the presenter speaking"}</small>
                    </button>
                    <button type="button" className={`${styles.sceneVisualMode} ${newSceneVisualMode === "scene-only" ? styles.sceneVisualModeActive : ""}`} aria-pressed={newSceneVisualMode === "scene-only"} onClick={() => { setNewSceneVisualMode("scene-only"); setNewSceneError(""); }} disabled={isLocked}>
                      <strong>{isThai ? "สินค้า" : "Product"}</strong>
                      <small>{isThai ? "แสดงภาพพร้อมเสียงบรรยาย" : "Show an image with narration"}</small>
                    </button>
                  </div>
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
                      {!presenterOptions.length ? <button type="button" className={styles.sceneAddPresenter} onClick={() => sourceInputRef.current?.click()} disabled={isLocked}><Plus size={14} />{isThai ? "เพิ่มรูปพรีเซนเตอร์" : "Add a presenter image"}</button> : null}
                    </>
                  )}
                </div>

                <div className={styles.sceneModalField}>
                  <span>{isThai ? "เสียงของซีนนี้" : "Voice for this scene"}<small>{isThai ? "เปลี่ยนเฉพาะซีนนี้ได้" : "Override the default for this scene"}</small></span>
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

                <details className={styles.advancedSettings}>
                <summary>{isThai ? "รายละเอียดภาพเพิ่มเติม" : "Additional visual direction"}</summary>
                <label className={styles.sceneModalField}>
                  <span>{isThai ? "รายละเอียดภาพ / คำสั่งฉาก" : "Visual direction"}<small>{isThai ? "ไม่บังคับ · ไม่อ่านออกเสียง · AI ช่วยวางแผนภาพช่วงต่อเนื่อง รวมในราคาวิดีโอ" : "Optional · not spoken · AI plans continuity as part of the video price"}</small></span>
                  <textarea value={newSceneDirection} onChange={(event) => setNewSceneDirection(event.target.value.slice(0, maxSceneDirectionLength))} maxLength={maxSceneDirectionLength} rows={2} placeholder={isThai ? "เช่น ภาพระยะใกล้สินค้า ฉากสว่าง โทนอุ่น" : "e.g. Close-up product shot, bright warm setting"} />
                </label>
                </details>

                <div className={styles.sceneModalField}>
                  <span>{isThai ? "ภาพประกอบฉาก" : "Scene image"}<small>{newSceneVisualMode === "scene-only" ? (isThai ? "จำเป็นเมื่อไม่ใช้พรีเซนเตอร์ที่เลือก" : "Required when the selected presenter is not used") : (isThai ? "ไม่บังคับ · เพิ่มหรือเปลี่ยนภายหลังได้" : "Optional · you can add or replace it later")}</small></span>
                  <input ref={addSceneMediaInputRef} className={styles.hiddenInput} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleNewSceneMediaChange} />
                  {newSceneMedia ? (
                    <div className={styles.newSceneMediaCard}>
                      <span className={styles.newSceneMediaPreview}>{newSceneMedia.kind === "image" ? <Image src={newSceneMedia.previewUrl} alt="" fill unoptimized sizes="72px" /> : <video src={newSceneMedia.previewUrl} muted playsInline autoPlay loop />}</span>
                      <span className={styles.newSceneMediaInfo}><strong>{newSceneMedia.fileName}</strong><small>{newSceneMedia.kind === "video" ? (isThai ? "วิดีโอคั่นซีน" : "Video cutaway") : (isThai ? "ภาพฉาก" : "Scene image")}</small></span>
                      <button type="button" onClick={() => addSceneMediaInputRef.current?.click()} aria-label={isThai ? "เปลี่ยนสื่อฉาก" : "Replace scene media"}><CloudUpload size={15} /></button>
                      <button type="button" onClick={() => { if (newSceneMedia.previewUrl.startsWith("blob:") && !scenes.some((scene) => scene.media?.previewUrl === newSceneMedia.previewUrl)) URL.revokeObjectURL(newSceneMedia.previewUrl); setNewSceneMedia(null); setNewSceneMediaError(""); }} aria-label={isThai ? "นำสื่อฉากออก" : "Remove scene media"}><X size={15} /></button>
                    </div>
                  ) : (
                    <button type="button" className={styles.newSceneMediaUpload} onClick={() => addSceneMediaInputRef.current?.click()}>
                      <CloudUpload size={19} />
                      <strong>{isThai ? "เลือกรูปภาพ" : "Choose an image"}</strong>
                      <small>{isThai ? "PNG, JPG, WEBP · ไม่เกิน 10 MB" : "PNG, JPG, WEBP · up to 10 MB"}</small>
                    </button>
                  )}
                  {newSceneMediaError ? <p className={styles.sceneModalError} role="alert">{newSceneMediaError}</p> : null}
                </div>
                {newSceneError ? <p className={styles.sceneModalError} role="alert">{newSceneError}</p> : null}
              </div>

              <footer className={styles.sceneModalFooter}>
                {confirmSceneDelete ? <div className={styles.sceneDeleteConfirm} role="alert"><span>{isThai ? "ลบซีนนี้พร้อมบทและสื่อ?" : "Delete this scene and its media?"}</span><button type="button" onClick={() => setConfirmSceneDelete(false)}>{isThai ? "กลับ" : "Back"}</button><button type="button" onClick={() => { if (editingSceneId) { removeScene(editingSceneId); closeAddScene(); } }} disabled={isLocked}>{isThai ? "ยืนยันลบ" : "Confirm delete"}</button></div> : <>
                {editingSceneId && scenes.length > 1 ? <button type="button" className={styles.sceneModalDelete} onClick={() => setConfirmSceneDelete(true)} disabled={isLocked}>{isThai ? "ลบซีน" : "Delete scene"}</button> : null}
                <button type="button" className={styles.sceneModalCancel} onClick={closeAddScene}>{isThai ? "ยกเลิก" : "Cancel"}</button>
                <button type="submit" className={styles.sceneModalSubmit} disabled={!newSceneTitle.trim() || !newSceneScript.trim() || (newSceneVisualMode === "scene-only" && !newSceneMedia) || (!editingSceneId && !canAddScene) || isLocked}>
                  {editingSceneId ? (isThai ? "บันทึกซีน" : "Save scene") : <><Plus size={16} />{isThai ? "เพิ่มฉากเข้าไทม์ไลน์" : "Add scene to timeline"}</>}
                </button>
                </>}
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
    ...presenters.flatMap((presenter, index) => presenter.id === defaultPresenter?.id ? [] : [{
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
    }]),
  ];

  return (
    <Dropdown
      value={value === defaultPresenter?.id ? "" : value}
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
  const [previewErrorKey, setPreviewErrorKey] = useState<string | null>(null);
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
      event.preventDefault();
      event.stopPropagation();
      audioRef.current?.pause();
      setPlayingVoiceKey(null);
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape, true);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape, true);
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
    setPreviewErrorKey(null);
    setPlayingVoiceKey(voice.key);
    void audio.play().catch(() => { setPlayingVoiceKey(null); setPreviewErrorKey(voice.key); });
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
        {selectedVoice?.imageUrl ? <span className={styles.voiceAvatar}><Image src={selectedVoice.imageUrl} alt="" fill unoptimized sizes="36px" /></span> : <AudioLines size={15} aria-hidden="true" />}
        <span className={styles.voicePickerValue}>
          <strong>{loading ? (isThai ? "กำลังโหลดเสียง…" : "Loading voices…") : selectedVoice?.name ?? (isThai ? "เลือกเสียง" : "Select a voice")}</strong>
        </span>
        <ChevronDown size={15} className={open ? styles.voicePickerChevronOpen : undefined} aria-hidden="true" />
      </button>
      {open ? (
        <div className={styles.voicePickerMenu} role="dialog" aria-label={isThai ? "เสียงพรีเซนเตอร์" : "Presenter voices"}>
          <SearchInput
            className={styles.voicePickerSearch}
            size="compact"
            autoFocus
            value={searchTerm}
            onValueChange={setSearchTerm}
            placeholder={isThai ? "ค้นหาเสียง" : "Search voices"}
            aria-label={isThai ? "ค้นหาเสียง" : "Search voices"}
          />
          <div className={styles.voicePickerList}>
            {matchingVoices.length ? matchingVoices.map((voice) => {
              const isSelected = voice.key === value;
              const isPlaying = playingVoiceKey === voice.key;
              return (
                <div key={voice.key} className={`${styles.voicePickerOption} ${isSelected ? styles.voicePickerOptionSelected : ""}`}>
                  <button type="button" className={styles.voicePickerChoose} onClick={() => chooseVoice(voice)} aria-pressed={isSelected}>
                    {voice.imageUrl ? <span className={styles.voiceAvatar}><Image src={voice.imageUrl} alt="" fill unoptimized sizes="36px" /></span> : <span className={styles.voiceAvatarFallback}><AudioLines size={15} aria-hidden="true" /></span>}
                    <span className={styles.voicePickerOptionCopy}>
                      <strong>{voice.name}</strong>
                      <small>{voice.description || (isThai ? "เสียง AI" : "AI voice")}</small>
                      {!voice.previewUrl ? <small className={styles.voicePreviewUnavailable}>{isThai ? "ยังไม่มีเสียงตัวอย่าง" : "No preview available"}</small> : previewErrorKey === voice.key ? <small className={styles.voicePreviewUnavailable}>{isThai ? "เล่นตัวอย่างไม่ได้ ลองอีกครั้ง" : "Could not play preview. Try again."}</small> : null}
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
          <audio ref={audioRef} preload="none" onEnded={() => setPlayingVoiceKey(null)} onError={() => { if (playingVoiceKey) setPreviewErrorKey(playingVoiceKey); setPlayingVoiceKey(null); }} />
        </div>
      ) : null}
    </div>
  );
}
