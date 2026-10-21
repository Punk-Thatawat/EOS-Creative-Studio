"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { ArrowRight, AudioLines, Check, ChevronDown, CloudUpload, Copy, GripVertical, LoaderCircle, LockKeyhole, MoreHorizontal, Plus, Sparkles, Video, WandSparkles, X } from "lucide-react";
import { EosVideoPlayer } from "@/components/media/eos-video-player";
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
const defaultPresenterImage = "/ai-presenter/presenter-mouth-open.png";
const supportedPresenterImageTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
const supportedSceneMediaTypes = new Set(["image/png", "image/jpeg", "image/webp", "video/mp4", "video/webm"]);
const maxSceneMediaTotalBytes = 60 * 1024 * 1024;
const maxSceneDurationSeconds = 15;
const sceneSpeechWarningSeconds = 13;
const maxSceneDirectionLength = 800;
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

type SourceMedia = { file?: File; fileName: string; previewUrl: string; kind: "image" | "video"; remoteUrl?: string; defaultAsset?: string; uploading: boolean; error?: string };
type SceneMedia = { file?: File; fileName: string; previewUrl: string; kind: "image" | "video"; remoteUrl?: string };
type AudioSceneSegment = { file: File; startSeconds: number; endSeconds: number; durationSeconds: number };
type SpeechPreview = { key: string; blob: Blob; url: string; durationSeconds: number; sceneAudio: AudioSceneSegment[]; remoteUrl?: string };
type PresenterScene = { id: string; title: string; script: string; direction: string; durationSeconds?: number; media?: SceneMedia; mediaError?: string };
type SavedAiPresenterScene = Omit<PresenterScene, "media" | "mediaError"> & { media?: { fileName: string; kind: SceneMedia["kind"]; remoteUrl?: string; hasFile: boolean } | null };
type SavedAiPresenterDraft = {
  version: 1;
  scenes: SavedAiPresenterScene[];
  activeSceneId: string;
  tone: string;
  language: string;
  pronunciation: string;
  sourceMedia: { fileName: string; kind: SourceMedia["kind"]; remoteUrl?: string; defaultAsset?: string; hasFile: boolean } | null;
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

const presenterOptions = [
  { id: "eos-host", name: "EOS Host", style: "Corporate", image: defaultPresenterImage, objectPosition: "center 28%" },
  { id: "news-host", name: "News Host", style: "Studio", image: "/generated-icons-v2/jobs/ai-presenter-video.png", objectPosition: "center 24%" },
  { id: "office-host", name: "Office Host", style: "Business", image: "/generated-icons-v2/projects/ai-presenter.png", objectPosition: "64% 40%" },
  { id: "training-host", name: "Training Host", style: "Training", image: "/generated-icons-v2/templates/training-video.png", objectPosition: "43% 25%" },
] as const;

function baselineDuration(script: string, language: string): number {
  const text = script.trim();
  if (!text) return 3;
  const spokenUnits = language === "th" ? text.replace(/\s/g, "").length / 12 : text.split(/\s+/).length;
  return Math.max(3, Math.min(60, Math.ceil(spokenUnits / (language === "th" ? 1 : 2.45))));
}

function estimatedDuration(script: string, language: string, voicePace = 1): number {
  return Math.max(3, Math.min(60, Math.ceil(baselineDuration(script, language) * voicePace)));
}

function sceneDuration(scene: PresenterScene, language: string, voicePace = 1): number {
  return scene.durationSeconds ?? (scene.script.trim() ? estimatedDuration(scene.script, language, voicePace) : 0);
}

function generatedClipDuration(referenceAudioDuration: number): number {
  return Math.max(4, Math.ceil(referenceAudioDuration));
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

function presenterPrompt(script: string, direction: string, hasSceneBackground = false): string {
  const sceneDirection = hasSceneBackground
    ? "Use the scene image as the background and preserve its setting, composition, and visible product. Add the person from the separate presenter reference image naturally into this scene; do not replace the scene image with the presenter reference."
    : "Keep the same person and outfit as the presenter reference image.";
  const visualDirection = direction.trim()
    ? `Follow these visual directions only; do not say them aloud: ${direction.trim()}`
    : "Use subtle natural head movement and keep the camera steady.";
  return `A professional on-camera presenter speaks naturally to the viewer. ${sceneDirection} Match facial expression, mouth movement, and timing to the provided reference audio. Speak only these words: "${script.trim()}" ${visualDirection}`;
}

function isElevenLabsSpeechModel(model: AudioModel): boolean {
  const key = model.key.trim().toLowerCase();
  return key.startsWith("elevenlabs/") || elevenLabsModelAliases.has(key);
}

export function AiPresenterPage() {
  const { locale } = useLocale();
  const isThai = locale === "th";
  const sourceInputRef = useRef<HTMLInputElement>(null);
  const sceneMediaInputRef = useRef<HTMLInputElement>(null);
  const sceneMediaUrlsRef = useRef(new Map<string, string>());
  const draftSaveQueueRef = useRef(Promise.resolve());
  const draftSaveRevisionRef = useRef(0);
  const persistedDraftFilesRef = useRef(new Map<string, File>());
  const knownDraftMediaIdsRef = useRef(new Set<string>());
  const uploadControllerRef = useRef<AbortController | null>(null);
  const generationControllerRef = useRef<AbortController | null>(null);
  const [draftRestoreComplete, setDraftRestoreComplete] = useState(false);
  const [scenes, setScenes] = useState<PresenterScene[]>([{ id: "scene-1", title: "Intro", script: sampleScript, direction: "" }]);
  const [activeSceneId, setActiveSceneId] = useState("scene-1");
  const [showAllPresenters, setShowAllPresenters] = useState(false);
  const [isReorderingScenes, setIsReorderingScenes] = useState(false);
  const [tone, setTone] = useState<(typeof toneOptions)[number]["value"]>("Premium");
  const [language, setLanguage] = useState("en");
  const [pronunciation, setPronunciation] = useState("");
  const [sourceMedia, setSourceMedia] = useState<SourceMedia | null>({
    fileName: "AI Presenter reference.png",
    previewUrl: defaultPresenterImage,
    kind: "image",
    defaultAsset: defaultPresenterImage,
    uploading: false,
  });
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
  const [voiceSample, setVoiceSample] = useState<{ key: string; durationSeconds: number } | null>(null);
  const [generationStatus, setGenerationStatus] = useState<"idle" | "uploading" | "processing" | "completed" | "failed">("idle");
  const [generationProgress, setGenerationProgress] = useState(0);
  const [finalVideoUrl, setFinalVideoUrl] = useState("");
  const [generationError, setGenerationError] = useState("");
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState(false);

  const script = useMemo(() => scenes.map((scene) => scene.script).join("\n\n").trim(), [scenes]);
  const activeScene = scenes.find((scene) => scene.id === activeSceneId) ?? scenes[0];
  const allScenesHaveScript = scenes.every((scene) => Boolean(scene.script.trim()));
  const selectedVoiceInfo = voices.find((voice) => voice.key === selectedVoice);
  const voiceSampleKey = JSON.stringify([selectedAudioModel, selectedVoice]);
  const sampleDuration = voiceSample?.key === voiceSampleKey ? voiceSample.durationSeconds : null;
  const voicePace = sampleDuration
    ? Math.max(0.65, Math.min(1.8, sampleDuration / baselineDuration(voicePreviewScripts[language === "th" ? "th" : "en"], language)))
    : 1;
  const speechKey = JSON.stringify([scenes.map((scene) => scene.script.trim()), selectedVoice, selectedAudioModel, language, tone, pronunciation.trim()]);
  const currentSpeech = speech?.key === speechKey ? speech : null;
  const activeSceneIndex = activeScene ? scenes.findIndex((scene) => scene.id === activeScene.id) : -1;
  const activeSceneAudioDuration = activeSceneIndex >= 0 ? currentSpeech?.sceneAudio[activeSceneIndex]?.durationSeconds : undefined;
  const activeSceneSpeechDuration = activeSceneAudioDuration ?? (activeScene?.script.trim() ? estimatedDuration(activeScene.script, language, voicePace) : null);
  const activeSceneSpeechOverLimit = activeSceneSpeechDuration !== null && activeSceneSpeechDuration !== undefined && activeSceneSpeechDuration > maxSceneDurationSeconds;
  const activeSceneSpeechNearLimit = activeSceneSpeechDuration !== null && activeSceneSpeechDuration !== undefined && activeSceneSpeechDuration >= sceneSpeechWarningSeconds;
  const sceneTimeline = useMemo(() => {
    let elapsedSeconds = 0;
    return scenes.map((scene, index) => {
      const start = elapsedSeconds;
      const durationSeconds = currentSpeech?.sceneAudio[index]?.durationSeconds ?? sceneDuration(scene, language, voicePace);
      elapsedSeconds += durationSeconds;
      return { scene, start, end: elapsedSeconds };
    });
  }, [currentSpeech, language, scenes, voicePace]);
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
            durationSeconds: Number.isFinite(scene.durationSeconds) ? scene.durationSeconds : undefined,
            media: scene.media ? { file: file ?? undefined, fileName: scene.media.fileName, kind: scene.media.kind, previewUrl, remoteUrl: scene.media.remoteUrl } : undefined,
            mediaError: scene.media?.hasFile && !file && !scene.media.remoteUrl
              ? "draft-media-missing"
              : undefined,
          } satisfies PresenterScene;
        }));
        const savedSource = draft.sourceMedia;
        const sourceFile = savedSource?.hasFile ? await readAiPresenterDraftFile("source").catch(() => null) : null;
        if (cancelled) {
          restoredScenes.forEach((scene) => { if (scene.media?.previewUrl.startsWith("blob:")) URL.revokeObjectURL(scene.media.previewUrl); });
          if (sourceFile) URL.revokeObjectURL(URL.createObjectURL(sourceFile));
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
        if (savedSource === null) setSourceMedia(null);
        else if (savedSource && (savedSource.fileName || savedSource.remoteUrl || savedSource.defaultAsset)) {
          const previewUrl = sourceFile ? URL.createObjectURL(sourceFile) : savedSource.remoteUrl ?? savedSource.defaultAsset ?? defaultPresenterImage;
          if (sourceFile) {
            persistedDraftFilesRef.current.set("source", sourceFile);
            knownDraftMediaIdsRef.current.add("source");
          }
          setSourceMedia({
            file: sourceFile ?? undefined,
            fileName: savedSource.fileName,
            previewUrl,
            kind: savedSource.kind === "video" ? "video" : "image",
            remoteUrl: savedSource.remoteUrl,
            defaultAsset: savedSource.defaultAsset,
            uploading: false,
            error: savedSource.hasFile && !sourceFile && !savedSource.remoteUrl && !savedSource.defaultAsset
              ? "draft-media-missing"
              : undefined,
          });
        }
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
      fileEntries.push(["source", source.file]);
      nextMediaIds.add("source");
    }
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
        durationSeconds: scene.durationSeconds,
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
        fileName: source.fileName,
        kind: source.kind,
        remoteUrl: source.remoteUrl,
        defaultAsset: source.defaultAsset,
        hasFile: Boolean(source.file || (source.error && !source.remoteUrl && !source.defaultAsset)),
      } : null,
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
  }, [draftRestoreComplete, scenes, activeSceneId, tone, language, pronunciation, sourceMedia, selectedReferenceVideoModel, selectedAudioModel, selectedVoice, aspect]);

  const availableAudioModels = useMemo(() => audioModels.filter(isElevenLabsSpeechModel), [audioModels]);
  const availableReferenceVideoModels = useMemo(
    () => referenceVideoModels.filter((model) => model.enabled && modelSupports(model, sourceMedia?.kind)),
    [referenceVideoModels, sourceMedia?.kind],
  );
  const selectedVideoModel = availableReferenceVideoModels.find((model) => model.model === selectedReferenceVideoModel);
  const duration = currentSpeech?.durationSeconds ?? estimatedDuration(script, language, voicePace);
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
    void listAudioVoices(selectedAudioModel, "textToSpeech").then((items) => {
      if (!active) return;
      setVoices(items);
      setSelectedVoice((current) => items.some((voice) => voice.key === current) ? current : (items[0]?.key ?? ""));
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
    const ready = Boolean(script.trim() && allScenesHaveScript && selectedVoice && selectedAudioModel);
    if (!draftRestoreComplete || !ready) {
      setSpeechQuote(null);
      setSpeechQuoteLoading(false);
      return () => { active = false; controller.abort(); };
    }
    setSpeechQuoteLoading(true);
    const timer = window.setTimeout(() => {
      void quoteTextToSpeechScenes({
        scenes: scenes.map((scene) => ({ title: scene.title, text: scene.script.trim(), voice: selectedVoice })),
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
  }, [draftRestoreComplete, script, scenes, allScenesHaveScript, selectedVoice, selectedAudioModel, language, tone, pronunciation]);

  useEffect(() => {
    const previewUrl = sourceMedia?.previewUrl;
    return () => { if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl); };
  }, [sourceMedia?.previewUrl]);

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
  }, [speechKey, selectedReferenceVideoModel, aspect, sourceMedia?.remoteUrl]);

  const videoQuoteInput = useMemo(() => {
    const presenterImageUrl = sourceMedia?.remoteUrl ?? sourceMedia?.defaultAsset;
    if (!presenterImageUrl || !selectedVideoModel || !script.trim() || sceneReferenceAudioTooLong) return null;
    return {
      model: selectedVideoModel.model,
      mode: "storyboard" as const,
      generationMode: "ai-presenter" as const,
      audioMode: "none" as const,
      duration: sceneTimeline.reduce((total, { start, end }) => total + generatedClipDuration(end - start), 0),
      aspectRatio: aspect,
      scenes: sceneTimeline.map(({ scene, start, end }) => ({
        storyboardImage: presenterImageUrl,
        referenceImages: [presenterImageUrl],
        startFrameSource: "manual" as const,
        prompt: presenterPrompt(scene.script, scene.direction, scene.media?.kind === "image"),
        duration: Math.min(maxSceneDurationSeconds, generatedClipDuration(end - start)),
      })),
    };
  }, [sourceMedia, selectedVideoModel, script, sceneTimeline, sceneReferenceAudioTooLong, aspect]);
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
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!supportedPresenterImageTypes.has(file.type.toLowerCase())) {
      setGenerationError(isThai ? "ต้นแบบพรีเซนเตอร์ต้องเป็นภาพ PNG, JPG หรือ WEBP" : "Choose a PNG, JPG, or WEBP presenter image.");
      return;
    }
    uploadControllerRef.current?.abort();
    const controller = new AbortController();
    uploadControllerRef.current = controller;
    const previewUrl = URL.createObjectURL(file);
    const next: SourceMedia = { file, fileName: file.name, previewUrl, kind: file.type.startsWith("video/") ? "video" : "image", uploading: true };
    setSourceMedia(next);
    setFinalVideoUrl("");
    setGenerationError("");
    try {
      const remoteUrl = await uploadPeopleMedia(file, controller.signal, selectedVideoModel?.capabilities.uploadConstraints);
      if (controller.signal.aborted) return;
      setSourceMedia((current) => current?.file === file ? { ...current, remoteUrl, uploading: false } : current);
    } catch (error) {
      if (controller.signal.aborted) return;
      setSourceMedia((current) => current?.file === file ? { ...current, uploading: false, error: error instanceof Error ? error.message : "Media upload failed" } : current);
    }
  };

  const handleRemoveSource = () => {
    uploadControllerRef.current?.abort();
    if (sourceMedia?.previewUrl.startsWith("blob:")) URL.revokeObjectURL(sourceMedia.previewUrl);
    setSourceMedia(null);
    setFinalVideoUrl("");
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
  };

  const handleRemoveSceneMedia = () => {
    if (!activeScene) return;
    const previewUrl = sceneMediaUrlsRef.current.get(activeScene.id);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    sceneMediaUrlsRef.current.delete(activeScene.id);
    updateActiveScene({ media: undefined, mediaError: undefined });
  };

  const choosePresenter = (presenter: (typeof presenterOptions)[number]) => {
    uploadControllerRef.current?.abort();
    setSourceMedia({
      fileName: `${presenter.name}.png`,
      previewUrl: presenter.image,
      kind: "image",
      defaultAsset: presenter.image,
      uploading: false,
    });
    setFinalVideoUrl("");
    setGenerationError("");
    setNotice("");
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

  const addScene = () => {
    if (!canAddScene) return;
    const id = crypto.randomUUID();
    setScenes((current) => [...current, { id, title: `Scene ${current.length + 1}`, script: "", direction: "" }]);
    setActiveSceneId(id);
    setFinalVideoUrl("");
    setGenerationError("");
  };

  const removeScene = (sceneId: string) => {
    if (scenes.length <= 1) return;
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
          text: scene.script.trim(), voice: selectedVoice, modelId: selectedAudioModel, outputFormat: "mp3", languageCode: language,
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
    const presenterMedia = sourceMedia;
    if (!presenterMedia || (!presenterMedia.remoteUrl && !presenterMedia.defaultAsset && !presenterMedia.file) || !script.trim() || !allScenesHaveScript || !selectedVideoModel || !selectedVoice || presenterMedia.uploading || presenterMedia.error || isGenerating || creditPreflightBusy) return;
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
          scenes: scenes.map((scene) => ({ title: scene.title, text: scene.script.trim(), voice: selectedVoice })),
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
      let sourceUrl = presenterMedia.remoteUrl;
      const defaultPresenterAsset = presenterMedia.defaultAsset;
      if (!sourceUrl && presenterMedia.file) {
        setNotice(isThai ? "กำลังอัปโหลดภาพพรีเซนเตอร์…" : "Uploading the presenter image…");
        const presenterFile = presenterMedia.file;
        const uploadedPresenterUrl = await uploadPeopleMedia(presenterFile, controller.signal, selectedVideoModel.capabilities.uploadConstraints);
        if (controller.signal.aborted) return;
        sourceUrl = uploadedPresenterUrl;
        setSourceMedia((current) => current && current.file === presenterFile ? { ...current, remoteUrl: uploadedPresenterUrl, uploading: false, error: undefined } : current);
      }
      if (!sourceUrl && defaultPresenterAsset) {
        setNotice(isThai ? "กำลังเตรียมภาพพรีเซนเตอร์…" : "Preparing the presenter image…");
        const imageResponse = await fetch(defaultPresenterAsset, { signal: controller.signal });
        if (!imageResponse.ok) throw new Error("Could not load the presenter image");
        const imageBlob = await imageResponse.blob();
        const imageFile = new File([imageBlob], presenterMedia.fileName, { type: imageBlob.type || "image/png" });
        const uploadedPresenterUrl = await uploadPeopleMedia(imageFile, controller.signal, selectedVideoModel.capabilities.uploadConstraints);
        if (controller.signal.aborted) return;
        sourceUrl = uploadedPresenterUrl;
        setSourceMedia((current) => current?.defaultAsset === defaultPresenterAsset ? { ...current, remoteUrl: uploadedPresenterUrl, error: undefined } : current);
      }
      if (!sourceUrl) throw new Error("Presenter image is not ready");
      const presenterImageUrl = sourceUrl;

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
          storyboardImage: sceneBackgroundUrls.get(scene.id) ?? presenterImageUrl,
          referenceImages: [presenterImageUrl],
          prompt: presenterPrompt(scene.script, scene.direction, sceneBackgroundUrls.has(scene.id)),
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
          storyboardImage: sceneBackgroundUrls.get(scene.id) ?? presenterImageUrl,
          referenceImages: [presenterImageUrl],
          startFrameSource: "manual" as const,
          prompt: presenterPrompt(scene.script, scene.direction, sceneBackgroundUrls.has(scene.id)),
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

  const handleCopyScript = async () => {
    try {
      await navigator.clipboard.writeText(script);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setNotice(isThai ? "คัดลอกข้อความไม่ได้ในเบราว์เซอร์นี้" : "Clipboard access is unavailable in this browser.");
    }
  };

  const supportedRatios = selectedVideoModel?.capabilities.supportedRatios?.filter((value) => aspectOptions.some((ratio) => ratio === value)) ?? [];
  const canGenerate = Boolean(sourceMedia && (sourceMedia.remoteUrl || sourceMedia.defaultAsset) && !sourceMedia.error && script.trim() && allScenesHaveScript && !sceneReferenceAudioTooLong && selectedVideoModel && selectedVoice && !sourceMedia.uploading && !isGenerating && !creditPreflightBusy && !catalogLoading && !voiceLoading);

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

      <div className={styles.prototypeNotice} role="status">
        <span className={styles.prototypeDot} />
        {isThai ? "แนบภาพหรือวิดีโอสินค้าแยกตามซีนได้ · เสียง ElevenLabs จะเป็นเสียงสุดท้าย ส่วนเสียงอ้างอิงช่วยกำกับการแสดงของพรีเซนเตอร์" : "Attach product images or videos to scenes. The final audio stays on ElevenLabs; the reference guides the presenter's performance."}
      </div>

      <section className={styles.workspace} aria-label={isThai ? "พื้นที่สร้าง AI Presenter" : "AI Presenter workspace"}>
        <nav className={styles.modeTabs} aria-label={isThai ? "โหมด AI Presenter" : "AI Presenter modes"}>
          <span className={`${styles.modeTab} ${styles.modeTabActive}`}><Video size={16} /><span>Presenter Video</span></span>
          <span className={styles.mvpTag}>{isThai ? "สคริปต์หลายฉาก" : "Multi-scene script"}</span>
        </nav>

        <div className={styles.workspaceGrid}>
          <section className={styles.scriptPanel} aria-labelledby="presenter-script-heading">
            <div className={styles.panelTitle}>
              <div><span className={styles.stepNumber}>1.</span><h2 id="presenter-script-heading">SCRIPT / CONTENT</h2></div>
              <button type="button" className={styles.iconButton} aria-label={isThai ? "คัดลอกสคริปต์" : "Copy script"} onClick={() => void handleCopyScript()} title={copied ? "Copied" : "Copy script"}>{copied ? <Check size={15} /> : <Copy size={15} />}</button>
            </div>
            <p className={styles.panelHint}>{isThai ? "กรอกบทพูดและคำสั่งฉากแยกกัน เพื่อไม่ให้ ElevenLabs อ่านคำสั่งออกเสียง" : "Keep spoken lines and visual directions separate so ElevenLabs never reads the directions aloud."}</p>
            <label className={styles.formGroup}>
              <span className={styles.formLabel}>{isThai ? "ชื่อฉาก" : "Scene title"}</span>
              <input className={styles.textInput} value={activeScene?.title ?? ""} onChange={(event) => updateActiveScene({ title: event.target.value.slice(0, 40) })} maxLength={40} disabled={isLocked} />
            </label>
            <div className={styles.sceneDurationControl}>
              <label className={styles.sceneDurationField}>
                <span className={styles.formLabel}>{isThai ? "ความยาวฉากที่เลือก" : "Selected scene duration"}</span>
                <span className={styles.sceneDurationInputWrap}>
                  <input
                    type="number"
                    min={1}
                    max={maxSceneDurationSeconds}
                    step={1}
                    value={activeScene?.durationSeconds ?? (activeScene ? estimatedDuration(activeScene.script, language, voicePace) : 3)}
                    onChange={(event) => updateActiveSceneDuration(event.target.value)}
                    disabled={isLocked}
                    aria-label={isThai ? "ความยาวฉากเป็นวินาที" : "Scene duration in seconds"}
                  />
                  <span>{isThai ? "วินาที" : "sec"}</span>
                </span>
              </label>
              <div className={styles.sceneDurationMeta}>
                <small>{activeScene?.durationSeconds !== undefined ? (isThai ? "กำหนดเอง" : "Custom") : (isThai ? "อัตโนมัติตามบทพูด" : "Auto from script")}</small>
                {activeScene?.durationSeconds !== undefined ? <button type="button" onClick={resetActiveSceneDuration} disabled={isLocked}>{isThai ? "อัตโนมัติ" : "Auto"}</button> : null}
              </div>
            </div>
            <p className={styles.sceneDurationHint}>{isThai ? "เสียงพูดแต่ละซีนสร้างแยกกัน และต้องยาวไม่เกิน 15 วินาที ก่อนนำมาต่อเป็นแทร็กเดียว" : "Each scene gets its own speech clip, up to 15 seconds, then the clips are joined into one soundtrack."}</p>
            <div className={`${styles.sceneFieldCard} ${styles.spokenSceneField}`}>
              <div className={styles.sceneFieldHeader}>
                <span className={`${styles.sceneFieldIcon} ${styles.spokenSceneIcon}`}><AudioLines size={15} /></span>
                <span className={styles.sceneFieldTitle}><strong>{isThai ? "บทพูด" : "Spoken lines"}</strong><small>{isThai ? "ส่งให้ ElevenLabs อ่านและซิงก์ปาก" : "Sent to ElevenLabs and used for lip sync"}</small></span>
                <span className={`${styles.sceneFieldBadge} ${styles.spokenSceneBadge}`}>{isThai ? "อ่านออกเสียง" : "Spoken"}</span>
              </div>
              <textarea className={styles.scriptInput} value={activeScene?.script ?? ""} onChange={(event) => updateActiveScene({ script: event.target.value.slice(0, activeSceneMaxLength) })} maxLength={activeSceneMaxLength} disabled={isLocked} placeholder={isThai ? "พิมพ์เฉพาะประโยคที่ต้องการให้พรีเซนเตอร์พูด" : "Write only the words you want the presenter to say"} aria-label={isThai ? "บทพูดของซีนนี้ ส่งให้ ElevenLabs อ่าน" : "Spoken lines for this scene, sent to ElevenLabs"} />
              <div className={styles.characterCount}>{script.length.toLocaleString()} / 5,000 {isThai ? "ตัวอักษรบทพูดรวม" : "total spoken characters"}</div>
              {activeSceneSpeechDuration !== null && activeSceneSpeechDuration !== undefined ? (
                <p className={styles.speechDurationStatus} data-warning={activeSceneSpeechNearLimit ? "true" : undefined} data-over={activeSceneSpeechOverLimit ? "true" : undefined}>
                  {activeSceneAudioDuration !== undefined
                    ? (isThai ? `เสียงจริง ${activeSceneAudioDuration.toFixed(2)} วินาที` : `Actual audio ${activeSceneAudioDuration.toFixed(2)} sec`)
                    : (isThai ? `บทนี้ประมาณ ${activeSceneSpeechDuration} วินาที` : `Estimated from text: ${activeSceneSpeechDuration} sec`)}
                  {activeSceneSpeechOverLimit
                    ? (isThai ? " · คาดว่าเกิน 15 วินาที แนะนำแบ่งตรงจบประโยค" : " · Likely over 15 sec. Split at a sentence boundary.")
                    : activeSceneSpeechNearLimit
                      ? (isThai ? " · ใกล้ขีดจำกัด 15 วินาที เผื่อจังหวะพูดไว้ด้วย" : " · Near the 15-second limit; allow room for pauses.")
                      : (isThai ? " · จำกัด 15 วินาทีต่อซีน" : " · 15-second limit per scene")}
                </p>
              ) : null}
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
            {!allScenesHaveScript ? <p className={styles.formError}>{isThai ? "เพิ่มบทพูดให้ครบทุกฉากก่อนสร้างเสียงและวิดีโอ" : "Add script to every scene before generating speech and video."}</p> : null}

            <div className={styles.formGroup}>
              <div className={styles.formLabel}><span>{isThai ? "โทนเสียง" : "Speech tone"}</span></div>
              <div className={styles.chipRow}>{toneOptions.map((option) => <button type="button" key={option.value} className={`${styles.toneChip} ${tone === option.value ? styles.toneChipActive : ""}`} onClick={() => setTone(option.value)} disabled={isLocked} aria-pressed={tone === option.value}>{option.label}</button>)}</div>
            </div>

            <div className={styles.twoFields}>
              <label className={styles.formGroup}>
                <span className={styles.formLabel}>{isThai ? "ภาษา" : "Language"}</span>
                <span className={styles.selectWrap}><select value={language} onChange={(event) => setLanguage(event.target.value)} disabled={isLocked}><option value="en">English</option><option value="th">ไทย</option><option value="ja">日本語</option></select><ChevronDown size={14} /></span>
              </label>
              <label className={styles.formGroup}>
                <span className={styles.formLabel}>{isThai ? "คำอ่านเพิ่มเติม" : "Pronunciation hints"}</span>
                <input className={styles.textInput} value={pronunciation} onChange={(event) => setPronunciation(event.target.value)} placeholder={isThai ? "ชื่อแบรนด์หรือคำย่อ" : "Brand names, acronyms"} disabled={isLocked} />
              </label>
            </div>

            <div className={styles.formGroup}>
              <div className={styles.formLabel}>{isThai ? "ภาพต้นแบบพรีเซนเตอร์" : "Presenter source image or video"}</div>
              <input ref={sourceInputRef} className={styles.hiddenInput} type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void handleSourceChange(event)} disabled={isLocked} />
              {sourceMedia ? (
                <div className={styles.sourceFileCard}>
                  {sourceMedia.kind === "image" ? <span className={styles.sourceThumb}><Image src={sourceMedia.previewUrl} alt={sourceMedia.fileName} fill unoptimized sizes="80px" loading="eager" /></span> : <video src={sourceMedia.previewUrl} muted playsInline />}
                  <div><strong>{sourceMedia.fileName}</strong><small>{sourceMedia.uploading ? (isThai ? "กำลังอัปโหลด…" : "Uploading…") : sourceMedia.error === "draft-media-missing" ? (isThai ? "ไม่พบไฟล์เดิม กรุณาอัปโหลดใหม่" : "Original file is missing. Upload it again.") : sourceMedia.error ? sourceMedia.error : sourceMedia.remoteUrl ? (isThai ? "อัปโหลดพร้อมแล้ว" : "Upload ready") : sourceMedia.defaultAsset ? (isThai ? "พร้อมอัปโหลดเมื่อกดสร้าง" : "Ready to upload when you generate") : ""}</small></div>
                  <button type="button" onClick={handleRemoveSource} disabled={isLocked} aria-label={isThai ? "นำไฟล์ออก" : "Remove source media"}><X size={15} /></button>
                </div>
              ) : (
                <button type="button" className={styles.uploadBox} onClick={() => sourceInputRef.current?.click()} disabled={isLocked}><CloudUpload size={19} /><span>{isThai ? "เลือกรูปพรีเซนเตอร์" : "Choose a presenter image"}</span><small>PNG, JPG, WEBP</small></button>
              )}
              {sourceMedia?.error ? <button type="button" className={styles.retryUpload} onClick={() => sourceInputRef.current?.click()}>{isThai ? "ลองอัปโหลดใหม่" : "Choose another file"}</button> : null}
              <p className={styles.sceneMediaHint}>{isThai ? "ใช้เป็นต้นแบบพรีเซนเตอร์ ไม่ได้เพิ่มเป็นภาพของซีนอัตโนมัติ" : "Used as the presenter source; not automatically assigned as a scene visual."}</p>
            </div>

            <div className={styles.formGroup}>
              <div className={styles.formLabel}>
                <span>{isThai ? "ภาพฉาก / สินค้า / วิดีโอประกอบ" : "Scene background, product, or video"}</span>
                <span className={styles.optionalTag}>{isThai ? "ไม่บังคับ" : "OPTIONAL"}</span>
              </div>
              <input ref={sceneMediaInputRef} className={styles.hiddenInput} type="file" accept="image/png,image/jpeg,image/webp,video/mp4,video/webm" onChange={handleSceneMediaChange} disabled={isLocked} />
              {activeScene?.media ? (
                <div className={styles.sceneMediaCard}>
                  <span className={styles.sceneMediaThumb}>
                    {activeScene.media.previewUrl ? activeScene.media.kind === "image" ? <Image src={activeScene.media.previewUrl} alt="" fill unoptimized sizes="48px" /> : <video src={activeScene.media.previewUrl} muted playsInline autoPlay loop /> : <CloudUpload size={16} />}
                  </span>
                  <span className={styles.sceneMediaDetails}><strong>{activeScene.media.fileName}</strong><small>{activeScene.mediaError === "draft-media-missing" ? (isThai ? "ไม่พบไฟล์เดิม กรุณาอัปโหลดใหม่" : "Original file is missing. Upload it again.") : isThai ? (activeScene.media.kind === "video" ? "วิดีโอคั่นซีน" : "ฉากตั้งต้น · ใช้พรีเซนเตอร์ที่เลือก") : (activeScene.media.kind === "video" ? "Video cutaway" : "Scene start frame · selected presenter")}</small></span>
                  <button type="button" onClick={() => sceneMediaInputRef.current?.click()} disabled={isLocked} aria-label={isThai ? "เปลี่ยนสื่อซีน" : "Replace scene media"} title={isThai ? "เปลี่ยนสื่อ" : "Replace media"}><CloudUpload size={14} /></button>
                  <button type="button" onClick={handleRemoveSceneMedia} disabled={isLocked} aria-label={isThai ? "นำสื่อซีนออก" : "Remove scene media"} title={isThai ? "นำสื่อออก" : "Remove media"}><X size={14} /></button>
                </div>
              ) : (
                <button type="button" className={styles.sceneMediaUpload} onClick={() => sceneMediaInputRef.current?.click()} disabled={isLocked}>
                  <CloudUpload size={18} />
                  <span>{isThai ? "เพิ่มภาพฉากหรือสินค้า / วิดีโอคั่น" : "Add a scene or product image / video cutaway"}</span>
                  <small>{isThai ? "ภาพไม่เกิน 10 MB · วิดีโอไม่เกิน 25 MB · รวมทุกซีนไม่เกิน 60 MB" : "Images up to 10 MB · videos up to 25 MB · 60 MB total"}</small>
                </button>
              )}
              {activeScene?.mediaError ? <p className={styles.formError}>{activeScene.mediaError === "draft-media-missing" ? (isThai ? "ไม่พบไฟล์เดิม กรุณาอัปโหลดใหม่" : "Original file is missing. Upload it again.") : activeScene.mediaError}</p> : null}
              <p className={styles.sceneMediaHint}>{activeScene?.media?.kind === "image"
                ? (isThai ? "ภาพนิ่งจะเป็นฉากของซีน และระบบจะสร้างพรีเซนเตอร์ที่เลือกไว้ให้ปรากฏในฉากนั้น" : "The image becomes this scene’s background, with your selected presenter generated into it.")
                : activeScene?.media?.kind === "video"
                  ? (isThai ? "วิดีโอจะแสดงเป็นภาพคั่นแทนพรีเซนเตอร์ในซีนนี้ โดยเสียงพูดเล่นต่อเนื่อง" : "The video plays as a cutaway in place of the presenter while speech continues.")
                  : (isThai ? "เพิ่มภาพฉากหรือสินค้าเพื่อให้พรีเซนเตอร์ที่เลือกปรากฏอยู่ในฉากนั้น หรือเพิ่มวิดีโอเพื่อใช้เป็นภาพคั่น" : "Add a background or product image to place your selected presenter in that scene, or add a video cutaway.")}</p>
            </div>
          </section>

          <section className={styles.previewPanel} aria-labelledby="presenter-preview-heading">
            <div className={styles.panelTitle}><div><span className={styles.stepNumber}>2.</span><h2 id="presenter-preview-heading">PREVIEW</h2></div><span className={`${styles.previewBadge} ${finalVideoUrl ? styles.previewReady : ""}`}><span />{finalVideoUrl ? (isThai ? "วิดีโอที่สร้างแล้ว" : "GENERATED") : activeScene?.media ? (isThai ? "ตัวอย่างสื่อซีน" : "SCENE VISUAL") : (isThai ? "ตัวอย่างพรีเซนเตอร์" : "PRESENTER SOURCE")}</span></div>
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
              ) : sourceMedia?.kind === "video" ? (
                <EosVideoPlayer
                  key={sourceMedia.previewUrl}
                  src={sourceMedia.previewUrl}
                  muted
                  className={`${videoPreviewStyles.generatedVideoPlayer} ${videoPreviewStyles.peopleGeneratedVideoPlayer}`}
                  mediaFrameClassName={videoPreviewStyles.videoPreviewMediaFrame}
                  ariaLabel={isThai ? "วิดีโอต้นแบบ" : "Presenter source video"}
                />
              ) : sourceMedia?.kind === "image" ? (
                <Image src={sourceMedia.previewUrl} alt={isThai ? "ภาพต้นแบบพรีเซนเตอร์" : "Presenter source image"} fill unoptimized sizes="(max-width: 760px) 100vw, 60vw" className={styles.sourcePreviewImage} />
              ) : (
                <VideoPreviewPlaceholder showActions={false} />
              )}
              {finalVideoUrl && !isGenerating ? <VideoPreviewOverlayActions videoUrl={finalVideoUrl} /> : null}
              {finalVideoUrl ? <span className={styles.videoWatermark}>EOS CREATIVE STUDIO</span> : null}
            </div>
            <div className={styles.presenterPicker}>
              <div className={styles.sectionHeading}>
                <h3>{isThai ? "เลือกพรีเซนเตอร์ / อวาตาร์" : "Choose Presenter / Avatar"}</h3>
                <button type="button" className={styles.textButton} onClick={() => setShowAllPresenters(true)} disabled={isLocked}>{isThai ? "เปลี่ยนพรีเซนเตอร์" : "Change Presenter"}</button>
              </div>
              <div className={styles.presenterList}>
                {presenterOptions.slice(0, showAllPresenters ? presenterOptions.length : 3).map((presenter) => {
                  const isSelected = sourceMedia?.defaultAsset === presenter.image;
                  return (
                    <button
                      type="button"
                      key={presenter.id}
                      className={`${styles.presenterCard} ${isSelected ? styles.presenterCardActive : ""}`}
                      onClick={() => choosePresenter(presenter)}
                      disabled={isLocked}
                      aria-pressed={isSelected}
                      title={`${presenter.name} · ${presenter.style}`}
                    >
                      <span className={styles.presenterImage}><Image src={presenter.image} alt={presenter.name} fill unoptimized sizes="49px" style={{ objectPosition: presenter.objectPosition }} /></span>
                      <strong>{presenter.name}</strong>
                      <small>{presenter.style}</small>
                      {isSelected ? <span className={styles.presenterCheck}><Check size={9} /></span> : null}
                    </button>
                  );
                })}
                <button type="button" className={`${styles.presenterCard} ${styles.morePresenter}`} onClick={() => setShowAllPresenters((expanded) => !expanded)} disabled={isLocked} aria-expanded={showAllPresenters}>
                  <MoreHorizontal size={18} />
                  <strong>{showAllPresenters ? (isThai ? "น้อยลง" : "Less") : (isThai ? "เพิ่มเติม" : "More")}</strong>
                </button>
                {showAllPresenters ? (
                  <button type="button" className={`${styles.presenterCard} ${styles.morePresenter}`} onClick={() => sourceInputRef.current?.click()} disabled={isLocked}>
                    <CloudUpload size={17} />
                    <strong>{isThai ? "อัปโหลด" : "Upload"}</strong>
                    <small>{isThai ? "รูปภาพ" : "Photo"}</small>
                  </button>
                ) : null}
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
            <p className={styles.timelineNote}>{isReorderingScenes ? (isThai ? "ลากฉากเพื่อเปลี่ยนลำดับ" : "Drag scenes to change their order.") : (isThai ? "เวลาบนการ์ดประเมินจากบทก่อนสร้างเสียง และจะแสดงเวลาจริงหลังสร้างเสียง แต่ละซีนจำกัด 15 วินาที" : "Scene times are estimated from text before speech generation and show actual duration afterward. Each scene is limited to 15 seconds.")}</p>
            <div className={styles.sceneTimeline} aria-label={isThai ? "ไทม์ไลน์ฉาก" : "Scene timeline"}>
              {sceneTimeline.map(({ scene, start, end }, index) => {
                const audioDuration = currentSpeech?.sceneAudio[index]?.durationSeconds;
                const estimatedSpeechDuration = scene.script.trim() ? estimatedDuration(scene.script, language, voicePace) : null;
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
                        {scene.media?.previewUrl && scene.media.kind === "image" ? <Image src={scene.media.previewUrl} alt="" fill unoptimized sizes="46px" /> : scene.media?.previewUrl && scene.media.kind === "video" ? <video src={scene.media.previewUrl} muted playsInline autoPlay loop /> : <Video size={16} />}
                      </span>
                      <span className={styles.sceneCopy}>
                        <strong>{scene.title || `${isThai ? "ฉาก" : "Scene"} ${index + 1}`}</strong>
                        <small>{formatTimelineTime(start)} – {formatTimelineTime(end)}</small>
                        {speechDuration !== null && speechDuration !== undefined ? <small className={styles.sceneSpeechDuration} data-warning={speechNearLimit ? "true" : undefined} data-over={speechOverLimit ? "true" : undefined}>{audioDuration !== undefined ? `${isThai ? "เสียงจริง" : "Actual"} ${audioDuration.toFixed(1)}s` : `${isThai ? "ประมาณ" : "Est."} ${speechDuration}s`}</small> : null}
                        <em>{scene.script.trim() || (isThai ? "เพิ่มบทพูดในฉากนี้" : "Add script for this scene")}</em>
                      </span>
                    </button>
                    {isReorderingScenes ? <span className={styles.sceneMore}><GripVertical size={13} /></span> : scenes.length > 1 ? <button type="button" className={styles.sceneMore} onClick={() => removeScene(scene.id)} aria-label={isThai ? `ลบฉาก ${index + 1}` : `Remove scene ${index + 1}`} title={isThai ? "ลบฉาก" : "Remove scene"} disabled={isLocked}><X size={12} /></button> : <span className={styles.sceneMore}><MoreHorizontal size={14} /></span>}
                  </div>
                  {index < scenes.length - 1 ? <ArrowRight className={styles.sceneArrow} size={13} /> : null}
                </div>
                );
              })}
              <button type="button" className={styles.addScene} onClick={addScene} disabled={!canAddScene || isLocked}>
                <Plus size={15} />
                <span>{isThai ? "เพิ่มฉาก" : "Add Scene"}</span>
              </button>
            </div>
            {currentSpeech ? <div className={styles.speechPreview}><div><AudioLines size={15} /><strong>{isThai ? "เสียงพูดที่สร้างแยกตามซีนแล้ว" : "Speech generated per scene"}</strong><span>{Math.ceil(currentSpeech.durationSeconds)}s</span></div><audio controls src={currentSpeech.url} /></div> : null}
            {generationError ? <div className={styles.errorCard} role="alert">{generationError}</div> : null}
            {notice ? <p className={styles.statusNote} role="status">{notice}</p> : null}
          </section>

          <aside className={styles.settingsPanel} aria-labelledby="presenter-settings-heading">
            <div className={styles.panelTitle}><div><span className={styles.stepNumber}>3.</span><h2 id="presenter-settings-heading">SETTINGS</h2></div><Sparkles size={15} className={styles.settingsSparkle} /></div>

            <label className={styles.settingCard}>
              <span className={styles.settingLabel}>{isThai ? "โมเดลสร้างวิดีโอ" : "Presenter video model"}</span>
              <span className={styles.settingSelect}><Video size={14} /><select value={selectedReferenceVideoModel} onChange={(event) => setSelectedReferenceVideoModel(event.target.value)} disabled={catalogLoading || isLocked}><option value="">{catalogLoading ? (isThai ? "กำลังโหลดโมเดล…" : "Loading models…") : (isThai ? "เลือกโมเดล" : "Select a model")}</option>{availableReferenceVideoModels.map((model) => <option key={model.model} value={model.model}>{model.displayName}</option>)}</select><ChevronDown size={14} /></span>
            </label>
            <label className={styles.settingCard}>
              <span className={styles.settingLabel}>{isThai ? "โมเดลเสียงพูด (ElevenLabs)" : "Speech model (ElevenLabs)"}</span>
              <span className={styles.selectWrap}><select value={selectedAudioModel} onChange={(event) => setSelectedAudioModel(event.target.value)} disabled={catalogLoading || isLocked}>{availableAudioModels.map((model) => <option key={model.key} value={model.key}>{model.name}</option>)}</select><ChevronDown size={14} /></span>
            </label>
            <label className={styles.settingCard}>
              <span className={styles.settingLabel}>{isThai ? "เสียงพรีเซนเตอร์" : "Presenter voice"}</span>
              <span className={styles.selectWrap}><select value={selectedVoice} onChange={(event) => setSelectedVoice(event.target.value)} disabled={voiceLoading || !voices.length || isLocked}><option value="">{voiceLoading ? (isThai ? "กำลังโหลดเสียง…" : "Loading voices…") : (isThai ? "เลือกเสียง" : "Select a voice")}</option>{voices.map((voice) => <option key={voice.key} value={voice.key}>{voice.name}</option>)}</select><ChevronDown size={14} /></span>
            </label>
            {selectedVoiceInfo?.previewUrl ? (
              <div className={styles.voiceSampleCard}>
                <div><AudioLines size={14} /><strong>{isThai ? "ตัวอย่างเสียงฟรี" : "Free voice sample"}</strong><span>{sampleDuration ? `${Math.ceil(sampleDuration)}s` : (isThai ? "กำลังอ่านความยาว…" : "Reading duration…")}</span></div>
                <audio
                  key={`${selectedAudioModel}:${selectedVoiceInfo.key}`}
                  controls
                  preload="metadata"
                  src={selectedVoiceInfo.previewUrl}
                  aria-label={isThai ? `ตัวอย่างเสียง ${selectedVoiceInfo.name}` : `${selectedVoiceInfo.name} voice sample`}
                  onLoadedMetadata={(event) => {
                    const measuredDuration = event.currentTarget.duration;
                    if (Number.isFinite(measuredDuration) && measuredDuration > 0) setVoiceSample({ key: JSON.stringify([selectedAudioModel, selectedVoiceInfo.key]), durationSeconds: measuredDuration });
                  }}
                />
                <small>{isThai ? "ประเมินจังหวะโดยเทียบกับบทตัวอย่างมาตรฐาน ความยาวจริงอาจต่างตามบทและการอ่าน" : "Pacing is estimated against a standard sample script; the actual duration may vary by script and delivery."}</small>
              </div>
            ) : (
              <p className={styles.voiceSampleMissing}>{isThai ? "เสียงนี้ไม่มีไฟล์ตัวอย่าง ใช้ความเร็วพูดมาตรฐานในการประเมิน" : "No sample is configured for this voice; duration uses a standard speaking pace."}</p>
            )}
            <div className={styles.settingCard}>
              <div className={styles.settingLabel}>{isThai ? "สัดส่วนวิดีโอ" : "Video format"}</div>
              <div className={styles.formatChoices}>{(supportedRatios.length ? supportedRatios : aspectOptions).map((value) => <button key={value} type="button" className={`${styles.formatOption} ${aspect === value ? styles.formatOptionActive : ""}`} onClick={() => setAspect(value as (typeof aspectOptions)[number])} disabled={isLocked}><span className={`${styles.formatShape} ${value === "9:16" ? styles.formatPortrait : value === "1:1" ? styles.formatSquare : ""}`} /><strong>{value}</strong><small>{value === "16:9" ? "Landscape" : value === "9:16" ? "Portrait" : "Square"}</small></button>)}</div>
            </div>

            <div className={styles.estimateCard}>
              <div><strong>{isThai ? "เครดิตโดยประมาณ" : "Estimated credits"}</strong><span className={styles.estimateIcon}><Sparkles size={18} /></span></div>
              <div className={styles.estimateLine}><span>{isThai ? "เสียงพูด" : "Speech"}</span><b>{speechQuoteLoading ? "…" : speechQuote ? speechQuote.creditCost.toLocaleString() : "—"}</b></div>
              <div className={styles.estimateLine}><span>{isThai ? "วิดีโอ" : "Video"}</span><b>{videoQuoteLoading ? "…" : videoCreditCost === null ? "—" : videoCreditCost.toLocaleString()}</b></div>
              <b className={styles.estimateTotal}>{estimatedCredits === null ? "—" : estimatedCredits.toLocaleString()} <small>{isThai ? "เครดิตรวม" : "credits total"}</small></b>
              <div className={styles.estimateLine}><span>{isThai ? "เครดิตคงเหลือ" : "Available balance"}</span><b>{creditBalanceLoading ? "…" : creditBalance === null ? "—" : creditBalance.toLocaleString()}</b></div>
              <div className={styles.estimateLine}><span>{isThai ? (currentSpeech ? "ต้องใช้เพิ่มก่อนสร้าง" : "ต้องมีขั้นต่ำ") : (currentSpeech ? "Needed to continue" : "Needed before generation")}</span><b>{requiredCreditCost === null ? "—" : requiredCreditCost.toLocaleString()}</b></div>
              <span className={styles.creditStatus} data-insufficient={!creditBalanceLoading && creditBalance !== null && requiredCreditCost !== null && !creditsSufficient ? "true" : undefined}>
                {creditBalanceLoading || requiredCreditCost === null
                  ? (isThai ? "กำลังตรวจราคาและยอดเครดิต…" : "Checking prices and credit balance…")
                  : creditBalance === null
                    ? (isThai ? "ตรวจยอดเครดิตไม่ได้ จึงยังเริ่มสร้างไม่ได้" : "Could not verify your balance, so generation is blocked.")
                    : creditsSufficient
                      ? (isThai ? "เครดิตพอสำหรับงานที่กำลังจะสร้าง" : "Balance covers the remaining generation steps.")
                      : (isThai ? "เครดิตไม่พอ กรุณาเติมก่อนสร้าง" : "Not enough credits. Add credits before generating.")}
              </span>
              <span>{isThai ? `ความยาวประมาณ ${duration} วินาที · คิดเครดิตแยกตามงาน` : `About ${duration} seconds · each step is charged separately`}</span>
            </div>
            {sceneReferenceAudioTooLong ? <p className={styles.formError} role="status">{overlongSceneAudioIndex >= 0 && currentSpeech ? (isThai ? `ซีน ${overlongSceneAudioIndex + 1} มีเสียงจริง ${currentSpeech.sceneAudio[overlongSceneAudioIndex]?.durationSeconds.toFixed(2)} วินาที เกิน 15 วินาที กรุณาแบ่งบทของซีนนี้เป็นซีนเพิ่ม` : `Scene ${overlongSceneAudioIndex + 1} is ${currentSpeech.sceneAudio[overlongSceneAudioIndex]?.durationSeconds.toFixed(2)} seconds long, over the 15-second limit. Split this scene's script into additional scenes.`) : (isThai ? "เสียงอ้างอิงแต่ละซีนต้องไม่เกิน 15 วินาที ถ้าบทซีนยาวกว่านี้ให้แบ่งเป็นซีนเพิ่ม" : "Each scene's reference audio must be 15 seconds or less. Split longer scene scripts into additional scenes.")}</p> : null}
            <p className={styles.creditNote}>{isThai ? "การฟังตัวอย่างไม่เสียเครดิต · สร้างเสียงตามบทเมื่อกดสร้างพรีเซนเตอร์เท่านั้น" : "Listening to the sample is free. Script audio is generated only when you create the presenter."}</p>
            <button type="button" className={styles.generateButton} onClick={() => void handleGenerateVideo()} disabled={!canGenerate}>
              {isGenerating || creditPreflightBusy ? <LoaderCircle size={17} className={styles.spin} /> : <Sparkles size={17} />}{creditPreflightBusy ? (isThai ? "กำลังตรวจเครดิต…" : "Checking credits…") : isGenerating ? (isThai ? "กำลังสร้างวิดีโอ…" : "Generating video…") : (isThai ? "สร้างพรีเซนเตอร์" : "Generate presenter")}
            </button>
            {catalogError ? <p className={styles.formError}>{catalogError}</p> : null}
            {!catalogLoading && !availableReferenceVideoModels.length ? <p className={styles.formError}>{isThai ? "ยังไม่มีโมเดล AI Presenter ที่รองรับภาพและเสียงอ้างอิง กรุณาตั้งค่าโมเดลที่ Admin > AI Presenter > Presenter Video" : "No AI Presenter model is configured with image and audio reference inputs. Configure it in Admin > AI Presenter > Presenter Video."}</p> : null}
            {!voiceLoading && selectedAudioModel && !voices.length ? <p className={styles.formError}>{isThai ? "ไม่พบเสียงที่ใช้งานได้ในโมเดลนี้" : "No available voices for this speech model."}</p> : null}
            <p className={styles.securityNote}><LockKeyhole size={12} /> {isThai ? "สคริปต์และไฟล์จะส่งไปยังผู้ให้บริการเพื่อสร้างงาน" : "Your script and media are sent to generation providers."}</p>
          </aside>
        </div>
      </section>

      <section className={styles.bottomShelf} aria-label={isThai ? "ขั้นตอนการสร้าง" : "Generation workflow"}>
        <div className={styles.workflowStep}><span>01</span><div><strong>{isThai ? "อัปโหลดต้นแบบ" : "Upload source image"}</strong><small>{isThai ? "ใช้รูปภาพพรีเซนเตอร์ที่คุณมีสิทธิ์ใช้งาน" : "Use a presenter image you have rights to use."}</small></div></div>
        <div className={styles.workflowStep}><span>02</span><div><strong>{isThai ? "ฟังตัวอย่างเสียงฟรี" : "Preview the voice for free"}</strong><small>{isThai ? "ใช้ไฟล์ตัวอย่างของเสียงที่เลือกช่วยประเมินความยาวบท" : "Use the selected voice sample as a guide for the script duration estimate."}</small></div></div>
        <div className={styles.workflowStep}><span>03</span><div><strong>{isThai ? "ตรวจเครดิตแล้วสร้าง" : "Check credits and create"}</strong><small>{isThai ? "ตรวจราคารวมก่อนสร้างเสียงพูดและวิดีโอจริง" : "Check the full cost before generating speech and video."}</small></div></div>
      </section>
    </div>
  );
}
