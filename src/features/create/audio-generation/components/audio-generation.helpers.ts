import {
  emitGenerationRequestFailed,
  emitGenerationRequestFinished,
  emitGenerationSubmitting,
} from "@/lib/generation-progress-events";
import { type AudioModel, type AudioVoice } from "@/lib/api/audio";
import {
  ELEVENLABS_TEXT_TO_SPEECH_MODEL_KEYS,
  MINIMAX_TEXT_TO_SPEECH_MODEL_KEYS,
  podcastVoiceAvatarEntries,
} from "./audio-generation.constants";

export function getPodcastVoiceAvatar(voice: AudioVoice | null | undefined): string | null {
  if (!voice) return null;
  const identity = `${voice.key} ${voice.name}`.toLowerCase();
  return voice.imageUrl || podcastVoiceAvatarEntries.find(([name]) => identity.includes(name))?.[1] || null;
}

export function supportsMiniMaxSpeechTuning(modelId: string): boolean {
  return /^minimax(?:\/|_)speech[-_]/i.test(modelId.trim());
}

/**
 * Use Eleven v4 for preset voices and retain MiniMax for cloned voices.
 * Both supported Eleven v4 keys represent the same model, so select only one.
 */
export function pickTextToSpeechModels(items: AudioModel[]): AudioModel[] {
  const v4Models = items.filter((model) => ELEVENLABS_TEXT_TO_SPEECH_MODEL_KEYS.includes(model.key.toLowerCase()));
  const v4 = v4Models.find((model) => model.isActive) ?? v4Models[0];
  const cloneModel = items.find((model) => MINIMAX_TEXT_TO_SPEECH_MODEL_KEYS.includes(model.key.toLowerCase()));
  return [v4, cloneModel].filter((model): model is AudioModel => model !== undefined);
}

export function formatSceneSeconds(seconds: number): string {
  const safeSeconds = Math.max(0, Math.round(seconds));
  return `${String(Math.floor(safeSeconds / 60)).padStart(2, "0")}:${String(safeSeconds % 60).padStart(2, "0")}`;
}

export function formatCreditAmount(value: number): string {
  return value.toLocaleString("th-TH", { maximumFractionDigits: 2 });
}

export function formatAudioHistoryDate(value: string, locale: "th" | "en"): string {
  const raw = value.trim();
  // Locally-created entries intentionally use a time-only label until they
  // are persisted. Keep that compact display instead of parsing it as a date.
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(raw)) return raw;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function createAudioIdempotencyKey(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function startAudioProgress(feature: string): string {
  const requestId = createAudioIdempotencyKey();
  emitGenerationSubmitting({ feature, requestId });
  return requestId;
}

export function finishAudioProgress(feature: string, requestId: string): void {
  emitGenerationRequestFinished({ feature, requestId });
}

export function failAudioProgress(feature: string, requestId: string): void {
  emitGenerationRequestFailed({ feature, requestId });
}

export function estimatePodcastLineSeconds(text: string): number {
  return Math.max(1, Math.round((text.trim().length / 18) * 10) / 10);
}

export function formatAudioFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
