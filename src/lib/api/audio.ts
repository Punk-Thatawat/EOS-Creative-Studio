import { getApiAccessToken } from "@/lib/auth/access-token";

const configuredBackendUrl = (process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000").replace(/\/+$/, "");
const backendOrigin = configuredBackendUrl.replace(/\/api\/v1$/, "");
const backendApiUrl = `${backendOrigin}/api/v1`;

export type TextToSpeechInput = {
  text: string;
  voice: string;
  modelId?: string;
  outputFormat: "mp3" | "wav" | "ogg";
  languageCode: string;
  tone: "Energetic" | "Friendly" | "Premium" | "Dramatic";
  speed: number;
  backgroundMusicEnabled?: boolean;
  backgroundMusicKey?: string;
  idempotencyKey?: string;
};

export type TextToSpeechSceneInput = { title: string; text: string; voice: string };
export type TextToSpeechScenesInput = {
  scenes: TextToSpeechSceneInput[];
  modelId?: string;
  outputFormat: "mp3" | "wav" | "ogg";
  languageCode: string;
  tone: "Energetic" | "Friendly" | "Premium" | "Dramatic";
  speed: number;
  pauseSeconds?: number;
  backgroundMusicEnabled?: boolean;
  backgroundMusicKey?: string;
  idempotencyKey?: string;
};

export type AudioCreditQuote = {
  provider: "elevenlabs";
  model: string;
  sceneCount: number;
  textCharacters: number;
  creditCost: number;
  speechCredits: number;
  backgroundMusicCredits: number;
  backgroundMusicSource: "disabled" | "admin-audio-url" | "elevenlabs";
  pricingSource: "provider" | "fallback";
};

export type AudioCreditBalance = { balance: number };

export type TextToSpeechResponse = {
  blob: Blob;
  contentType: string;
  historyId?: string;
  localHistoryId?: string;
  providerHistoryId?: string;
};

export type AudioVoice = {
  key: string;
  name: string;
  description: string;
  imageUrl?: string | null;
  previewUrl?: string | null;
};
export type AudioModel = {
  key: string;
  name: string;
  isActive: boolean;
};
export type AudioBackgroundMusic = {
  key: string;
  name: string;
  description: string;
  previewUrl?: string | null;
};
export type AudioFeatureKey = "textToSpeech" | "podcastDialogue" | "voiceClone" | "soundEffects" | "audioCleanup";

export type DialogueSpeakerInput = { name: string; voice: string };
export type DialogueInput = {
  script: string;
  speakers: DialogueSpeakerInput[];
  conversationStyle: "Interview" | "Roundtable" | "Storytelling";
  languageCode: string;
  emotion: number;
  pauseSeconds: number;
  autoDirect: boolean;
  modelId?: string;
  outputFormat: "mp3" | "wav" | "ogg";
};

export type VoiceCloneInput = {
  name: string;
  description?: string;
  character?: string;
  consentConfirmed: boolean;
  files: File[];
};

export type VoiceCloneResponse = { voiceId: string; requiresVerification: boolean; name: string };
export type VoiceListResponse = { voices: Array<Record<string, unknown>>; nextPageToken?: string | null };
export type SoundEffectsInput = {
  description: string;
  category?: string;
  durationSeconds: number;
  variationCount: number;
  intensity: number;
  promptInfluence: number;
  loop: boolean;
  normalizeLoudness: boolean;
  outputFormat: "mp3" | "wav" | "ogg";
};
export type SoundEffectVariant = { index: number; audioBase64: string; contentType: string; outputFormat: "mp3" | "wav" | "ogg" };
export type AudioHistoryFeature = "tts" | "dialogue" | "voice-clone" | "sound-effects" | "audio-cleanup";
export type AudioHistoryEntry = {
  id: string;
  feature: AudioHistoryFeature;
  label: string;
  provider?: string;
  outputFormat: "mp3" | "wav" | "ogg";
  mimeType?: string | null;
  sizeBytes?: number | null;
  url?: string | null;
  audioUrl?: string | null;
  downloadUrl?: string | null;
  historyItemId?: string | null;
  history_item_id?: string | null;
  createdAt: string;
  metadata?: Record<string, unknown> | null;
  voice?: string | null;
  durationSeconds?: number | null;
};
export type SaveAudioHistoryInput = {
  audio: Blob;
  feature: AudioHistoryFeature;
  label: string;
  outputFormat: "mp3" | "wav" | "ogg";
  voice?: string;
  durationSeconds?: number;
  metadata?: Record<string, unknown>;
};

export type AdminAudioVoiceSettings = {
  femaleWarm: string;
  maleBold: string;
  youthful: string;
  corporate: string;
  podcastHost: string;
};
export type AdminAudioVoiceProfile = { id: string; name: string; description: string; imageUrl: string };
export type AdminAudioModelProfile = { voices: AdminAudioVoiceProfile[] };
export type AdminAudioFeatureProfile = { modelId: string; voices: AdminAudioVoiceProfile[]; models: Record<string, AdminAudioModelProfile> };
export type AdminAudioBackgroundMusicPreset = {
  key: string;
  name: string;
  description: string;
  audioUrl?: string;
  prompt: string;
  musicModelId: "music_v1" | "music_v2";
  forceInstrumental: boolean;
  volume: number;
  isActive: boolean;
};

export type AdminAudioProvider = "elevenlabs" | "internal";
export type AdminAudioFeature = "textToSpeech" | "podcastDialogue" | "voiceClone" | "soundEffects" | "audioCleanup";
export type AdminAudioRouting = Record<AdminAudioFeature, AdminAudioProvider>;
export type AdminAudioProviderSettings = {
  elevenlabs: { defaultFormat: "mp3" | "wav" | "ogg"; timeoutMs: number };
  internal: { ffmpegPath: string; maxUploadMb: number; defaultFormat: "mp3" | "wav" | "ogg" };
};

export type AdminAudioSettings = {
  provider: "elevenlabs";
  modelId: string;
  voices: AdminAudioVoiceSettings;
  modelProfiles: Record<string, AdminAudioModelProfile>;
  featureProfiles: Record<AudioFeatureKey, AdminAudioFeatureProfile>;
  backgroundMusicPresets: AdminAudioBackgroundMusicPreset[];
  routing: AdminAudioRouting;
  providerSettings: AdminAudioProviderSettings;
  providerConfigured: boolean;
  updatedAt?: string;
};

export type AdminAudioSettingsPatch = {
  modelId?: string;
  voices?: AdminAudioVoiceSettings;
  modelProfiles?: Record<string, AdminAudioModelProfile>;
  featureProfiles?: Record<AudioFeatureKey, AdminAudioFeatureProfile>;
  backgroundMusicPresets?: AdminAudioBackgroundMusicPreset[];
  routing?: Partial<AdminAudioRouting>;
  elevenlabs?: Partial<AdminAudioProviderSettings["elevenlabs"]>;
  internal?: Partial<AdminAudioProviderSettings["internal"]>;
};

async function adminRequest(path: string, init: RequestInit = {}): Promise<unknown> {
  const accessToken = await getApiAccessToken();
  if (!accessToken) throw new Error("Please sign in as an admin");
  const apiPath = path.startsWith("/api/v1") ? path.slice("/api/v1".length) : path;
  const response = await fetch(`${backendApiUrl}${apiPath}`, {
    ...init,
    headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${accessToken}`, ...(init.headers ?? {}) },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(getErrorMessage(payload));
  return payload;
}

async function userAudioRequest(path: string, init: RequestInit = {}): Promise<Response> {
  const accessToken = await getApiAccessToken();
  if (!accessToken) throw new Error("Please sign in before generating audio");
  const isMultipart = typeof FormData !== "undefined" && init.body instanceof FormData;
  const response = await fetch(`${backendApiUrl}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(isMultipart ? {} : { "Content-Type": "application/json" }),
      Authorization: `Bearer ${accessToken}`,
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(getErrorMessage(payload));
  }
  return response;
}

async function userAudioBlobRequest(path: string, init: RequestInit): Promise<TextToSpeechResponse> {
  const response = await userAudioRequest(path, init);
  const localHistoryId = response.headers.get("x-audio-history-id") ?? undefined;
  const providerHistoryId = response.headers.get("x-elevenlabs-history-id") ?? undefined;
  return {
    blob: await response.blob(),
    contentType: response.headers.get("content-type") ?? "audio/mpeg",
    historyId: localHistoryId ?? providerHistoryId,
    localHistoryId,
    providerHistoryId,
  };
}

function getErrorMessage(payload: unknown): string {
  if (payload && typeof payload === "object" && "message" in payload) {
    const message = payload.message;
    if (typeof message === "string") return message;
    if (Array.isArray(message)) return message.join(", ");
  }
  if (payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string") return payload.error;
  return "Audio generation failed";
}

function normalizeAudioVoice(value: unknown): AudioVoice | null {
  if (!value || typeof value !== "object") return null;
  const voice = value as Record<string, unknown>;
  if (typeof voice.key !== "string" || typeof voice.name !== "string") return null;
  return {
    key: voice.key,
    name: voice.name,
    description: typeof voice.description === "string" ? voice.description : "",
    imageUrl: typeof voice.imageUrl === "string" ? voice.imageUrl : null,
    previewUrl: typeof voice.previewUrl === "string" ? voice.previewUrl : null,
  };
}

function normalizeAudioModel(value: unknown): AudioModel | null {
  if (!value || typeof value !== "object") return null;
  const model = value as Record<string, unknown>;
  if (typeof model.key !== "string" || typeof model.name !== "string") return null;
  return { key: model.key, name: model.name, isActive: model.isActive === true };
}

export async function createTextToSpeech(input: TextToSpeechInput, signal?: AbortSignal): Promise<TextToSpeechResponse> {
  return userAudioBlobRequest("/audio/tts", {
    method: "POST",
    headers: {
      Accept: input.outputFormat === "mp3" ? "audio/mpeg" : input.outputFormat === "wav" ? "audio/wav" : "audio/ogg",
    },
    body: JSON.stringify(input),
    signal,
  });
}

export async function quoteTextToSpeech(input: Omit<TextToSpeechInput, "idempotencyKey">, signal?: AbortSignal): Promise<AudioCreditQuote> {
  const response = await userAudioRequest("/audio/quote", {
    method: "POST",
    headers: { Accept: "application/json" },
    body: JSON.stringify(input),
    signal,
  });
  const payload = await response.json().catch(() => null) as { data?: AudioCreditQuote } | AudioCreditQuote | null;
  if (payload && typeof payload === "object" && "data" in payload && payload.data) return payload.data;
  if (payload && typeof payload === "object" && "creditCost" in payload) return payload as AudioCreditQuote;
  throw new Error("Audio pricing unavailable");
}

export async function createTextToSpeechScenes(input: TextToSpeechScenesInput, signal?: AbortSignal): Promise<TextToSpeechResponse> {
  return userAudioBlobRequest("/audio/tts/scenes", {
    method: "POST",
    headers: {
      Accept: input.outputFormat === "mp3" ? "audio/mpeg" : input.outputFormat === "wav" ? "audio/wav" : "audio/ogg",
    },
    body: JSON.stringify(input),
    signal,
  });
}

export async function quoteTextToSpeechScenes(input: Omit<TextToSpeechScenesInput, "idempotencyKey">, signal?: AbortSignal): Promise<AudioCreditQuote> {
  const response = await userAudioRequest("/audio/tts/scenes/quote", {
    method: "POST",
    headers: { Accept: "application/json" },
    body: JSON.stringify(input),
    signal,
  });
  const payload = await response.json().catch(() => null) as { data?: AudioCreditQuote } | AudioCreditQuote | null;
  if (payload && typeof payload === "object" && "data" in payload && payload.data) return payload.data;
  if (payload && typeof payload === "object" && "creditCost" in payload) return payload as AudioCreditQuote;
  throw new Error("Audio pricing unavailable");
}

export async function getAudioCreditBalance(): Promise<AudioCreditBalance> {
  const response = await userAudioRequest("/users/me/credits", { headers: { Accept: "application/json" } });
  const payload = await response.json().catch(() => null) as { data?: { balance?: unknown } } | { balance?: unknown } | null;
  const data = payload && typeof payload === "object" && "data" in payload ? payload.data : payload;
  const balance = data && typeof data === "object" && "balance" in data ? Number(data.balance) : NaN;
  if (!Number.isFinite(balance)) throw new Error("Credit balance unavailable");
  return { balance };
}

export async function listAudioVoices(modelId?: string, feature?: AudioFeatureKey): Promise<AudioVoice[]> {
  const queryParams = new URLSearchParams();
  if (modelId?.trim()) queryParams.set("modelId", modelId.trim());
  if (feature) queryParams.set("feature", feature);
  const query = queryParams.toString() ? `?${queryParams.toString()}` : "";
  const response = await userAudioRequest(`/audio/voices${query}`, { headers: { Accept: "application/json" } });
  const payload = await response.json().catch(() => null);
  const data = payload && typeof payload === "object" && "data" in payload ? payload.data : payload;
  const voices: unknown[] = data && typeof data === "object" && "voices" in data && Array.isArray(data.voices)
    ? data.voices
    : Array.isArray(data)
      ? data
      : [];

  return voices.map(normalizeAudioVoice).filter((voice): voice is AudioVoice => voice !== null);
}

export async function listAudioModels(feature?: AudioFeatureKey): Promise<AudioModel[]> {
  const query = feature ? `?feature=${encodeURIComponent(feature)}` : "";
  const response = await userAudioRequest(`/audio/models${query}`, { headers: { Accept: "application/json" } });
  const payload = await response.json().catch(() => null);
  const data = payload && typeof payload === "object" && "data" in payload ? payload.data : payload;
  const models: unknown[] = data && typeof data === "object" && "models" in data && Array.isArray(data.models)
    ? data.models
    : Array.isArray(data)
      ? data
      : [];
  return models.map(normalizeAudioModel).filter((model): model is AudioModel => model !== null);
}

export async function listAudioBackgroundMusic(): Promise<AudioBackgroundMusic[]> {
  const response = await userAudioRequest("/audio/background-music", { headers: { Accept: "application/json" } });
  const payload = await response.json().catch(() => null);
  const data = payload && typeof payload === "object" && "data" in payload ? payload.data : payload;
  const presets: unknown[] = data && typeof data === "object" && "presets" in data && Array.isArray(data.presets)
    ? data.presets
    : Array.isArray(data)
      ? data
      : [];
  return presets.map((value): AudioBackgroundMusic | null => {
    if (!value || typeof value !== "object") return null;
    const preset = value as Record<string, unknown>;
    if (typeof preset.key !== "string" || typeof preset.name !== "string") return null;
    return {
      key: preset.key,
      name: preset.name,
      description: typeof preset.description === "string" ? preset.description : "",
      previewUrl: typeof preset.previewUrl === "string" ? preset.previewUrl : null,
    };
  }).filter((preset): preset is AudioBackgroundMusic => preset !== null);
}

export async function createDialogue(input: DialogueInput, signal?: AbortSignal): Promise<TextToSpeechResponse> {
  return userAudioBlobRequest("/audio/dialogue", {
    method: "POST",
    headers: { Accept: input.outputFormat === "mp3" ? "audio/mpeg" : input.outputFormat === "wav" ? "audio/wav" : "audio/ogg" },
    body: JSON.stringify(input),
    signal,
  });
}

export async function createVoiceClone(input: VoiceCloneInput): Promise<VoiceCloneResponse> {
  const form = new FormData();
  form.append("name", input.name);
  form.append("consentConfirmed", String(input.consentConfirmed));
  if (input.description) form.append("description", input.description);
  if (input.character) form.append("character", input.character);
  input.files.forEach((file) => form.append("files[]", file, file.name));
  const response = await userAudioRequest("/audio/voice-clones", { method: "POST", body: form });
  const payload = await response.json() as { data?: VoiceCloneResponse };
  if (!payload.data) throw new Error("Voice clone was not created");
  return payload.data;
}

export async function listVoiceClones(): Promise<VoiceListResponse> {
  const response = await userAudioRequest("/audio/voice-clones");
  const payload = await response.json() as { data?: VoiceListResponse };
  if (!payload.data) throw new Error("Unable to load voices");
  return payload.data;
}

export async function deleteVoiceClone(voiceId: string): Promise<void> {
  await userAudioRequest(`/audio/voice-clones/${encodeURIComponent(voiceId)}`, { method: "DELETE" });
}

export async function previewVoiceClone(voiceId: string, input: { text: string; outputFormat: "mp3" | "wav" | "ogg"; languageCode: string; modelId?: string }, signal?: AbortSignal): Promise<TextToSpeechResponse> {
  return userAudioBlobRequest(`/audio/voice-clones/${encodeURIComponent(voiceId)}/preview`, {
    method: "POST",
    headers: { Accept: input.outputFormat === "mp3" ? "audio/mpeg" : input.outputFormat === "wav" ? "audio/wav" : "audio/ogg" },
    body: JSON.stringify(input),
    signal,
  });
}

export async function createSoundEffects(input: SoundEffectsInput, signal?: AbortSignal): Promise<SoundEffectVariant[]> {
  const response = await userAudioRequest("/audio/sound-effects", { method: "POST", body: JSON.stringify(input), signal });
  const payload = await response.json() as { data?: { variations?: SoundEffectVariant[] } };
  if (!payload.data?.variations) throw new Error("Sound effects were not generated");
  return payload.data.variations;
}

export async function listAudioHistory(input: { feature?: AudioHistoryFeature; limit?: number } = {}): Promise<AudioHistoryEntry[]> {
  const search = new URLSearchParams();
  if (input.feature) search.set("feature", input.feature);
  search.set("limit", String(input.limit ?? 10));
  const response = await userAudioRequest(`/audio/history?${search.toString()}`);
  const payload = await response.json().catch(() => null);
  const data = unwrapAudioHistoryPayload(payload);
  if (Array.isArray(data)) return data.map(normalizeAudioHistoryEntry) as AudioHistoryEntry[];
  if (data && typeof data === "object" && "items" in data && Array.isArray(data.items)) return data.items.map(normalizeAudioHistoryEntry) as AudioHistoryEntry[];
  if (data && typeof data === "object" && "history" in data && Array.isArray(data.history)) return data.history.map(normalizeAudioHistoryEntry) as AudioHistoryEntry[];
  return [];
}

export async function saveAudioHistory(input: SaveAudioHistoryInput): Promise<AudioHistoryEntry> {
  const form = new FormData();
  form.append("audio", input.audio, `audio.${input.outputFormat}`);
  form.append("feature", input.feature);
  form.append("label", input.label);
  form.append("outputFormat", input.outputFormat);
  if (input.voice) form.append("voice", input.voice);
  if (input.durationSeconds !== undefined && input.durationSeconds > 0) form.append("durationSeconds", String(Math.round(input.durationSeconds)));
  if (input.metadata) form.append("metadata", JSON.stringify(input.metadata));
  const response = await userAudioRequest("/audio/history", { method: "POST", body: form });
  const payload = await response.json().catch(() => null);
  const entry = unwrapAudioHistoryEntry(payload);
  if (!entry) throw new Error("Unable to save audio history");
  return entry;
}

export async function getAudioHistory(id: string): Promise<AudioHistoryEntry> {
  const response = await userAudioRequest(`/audio/history/${encodeURIComponent(id)}`, { headers: { Accept: "application/json" } });
  const payload = await response.json().catch(() => null);
  const entry = unwrapAudioHistoryEntry(payload);
  if (!entry) throw new Error("Unable to load audio history item");
  return entry;
}

export async function fetchAudioHistoryAudio(id: string): Promise<TextToSpeechResponse> {
  const isProviderHistory = id.startsWith("elevenlabs:");
  const historyId = isProviderHistory ? id.slice("elevenlabs:".length) : id;
  const path = isProviderHistory
    ? `/audio/provider-history/${encodeURIComponent(historyId)}/audio`
    : `/audio/history/${encodeURIComponent(historyId)}/audio`;
  const response = await userAudioRequest(path, { headers: { Accept: "audio/*, application/json" } });
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.startsWith("audio/") || contentType.includes("octet-stream")) {
    return { blob: await response.blob(), contentType };
  }

  const payload = await response.json().catch(() => null);
  const entry = unwrapAudioHistoryEntry(payload);
  const encodedAudio = getAudioHistoryBase64(payload);
  if (encodedAudio) {
    const binary = Uint8Array.from(atob(encodedAudio), (character) => character.charCodeAt(0));
    const blob = new Blob([binary], { type: entry?.mimeType ?? "audio/mpeg" });
    return { blob, contentType: blob.type };
  }

  const source = entry?.url ?? entry?.audioUrl ?? entry?.downloadUrl;
  if (!source) throw new Error("Audio history item has no playable audio");
  const linkedResponse = await userAudioRequest(toAudioApiPath(source), { headers: { Accept: entry?.mimeType ?? "audio/*" } });
  return { blob: await linkedResponse.blob(), contentType: linkedResponse.headers.get("content-type") ?? entry?.mimeType ?? "audio/mpeg" };
}

export async function deleteAudioHistory(id: string): Promise<void> {
  if (id.startsWith("elevenlabs:")) {
    await userAudioRequest(`/audio/provider-history/${encodeURIComponent(id.slice("elevenlabs:".length))}`, { method: "DELETE" });
    return;
  }
  await userAudioRequest(`/audio/history/${encodeURIComponent(id)}`, { method: "DELETE" });
}

function unwrapAudioHistoryPayload(payload: unknown): unknown {
  if (payload && typeof payload === "object" && "data" in payload) return payload.data;
  return payload;
}

function unwrapAudioHistoryEntry(payload: unknown): AudioHistoryEntry | null {
  const data = unwrapAudioHistoryPayload(payload);
  if (data && typeof data === "object" && "item" in data && data.item && typeof data.item === "object") return data.item as AudioHistoryEntry;
  if (data && typeof data === "object" && "id" in data) return data as AudioHistoryEntry;
  return null;
}

function normalizeAudioHistoryEntry(value: unknown): AudioHistoryEntry {
  const entry = value as AudioHistoryEntry & { historyItemId?: string | null; history_item_id?: string | null };
  if (entry.feature !== "tts") return entry;
  if (entry.id.startsWith("elevenlabs:")) return entry;
  const providerHistoryId = entry.historyItemId ?? entry.history_item_id;
  return providerHistoryId ? { ...entry, id: `elevenlabs:${providerHistoryId}` } : entry;
}

function getAudioHistoryBase64(payload: unknown): string | null {
  const data = unwrapAudioHistoryPayload(payload);
  if (data && typeof data === "object" && "audioBase64" in data && typeof data.audioBase64 === "string") return data.audioBase64;
  return null;
}

function toAudioApiPath(source: string): string {
  if (source.startsWith("http://") || source.startsWith("https://")) {
    const parsed = new URL(source);
    const path = parsed.pathname.startsWith("/api/v1") ? parsed.pathname.slice("/api/v1".length) : parsed.pathname;
    return `${path}${parsed.search}`;
  }
  return source.startsWith("/api/v1") ? source.slice("/api/v1".length) : source.startsWith("/") ? source : `/${source}`;
}

const legacyVoiceNames: Array<{ key: keyof AdminAudioVoiceSettings; name: string; description: string }> = [
  { key: "femaleWarm", name: "Female Warm", description: "Natural, Warm" },
  { key: "maleBold", name: "Male Bold", description: "Deep, Confident" },
  { key: "youthful", name: "Youthful", description: "Bright, Uplifting" },
  { key: "corporate", name: "Corporate", description: "Clear, Professional" },
  { key: "podcastHost", name: "Podcast Host", description: "Conversational" },
];

function legacyAdminVoiceProfiles(voices: AdminAudioVoiceSettings): AdminAudioVoiceProfile[] {
  return legacyVoiceNames.map((item) => ({ id: voices[item.key], name: item.name, description: item.description, imageUrl: "" })).filter((voice) => Boolean(voice.id));
}

function normalizeAdminVoiceProfiles(value: unknown, fallback: AdminAudioVoiceProfile[]): AdminAudioVoiceProfile[] {
  if (Array.isArray(value)) {
    const profiles = value.map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const candidate = item as Record<string, unknown>;
      const id = typeof candidate.id === "string" ? candidate.id.trim() : typeof candidate.voiceId === "string" ? candidate.voiceId.trim() : "";
      if (!id) return null;
      return {
        id,
        name: typeof candidate.name === "string" && candidate.name.trim() ? candidate.name.trim() : `Voice ${index + 1}`,
        description: typeof candidate.description === "string" ? candidate.description.trim() : "",
        imageUrl: typeof candidate.imageUrl === "string" ? candidate.imageUrl.trim() : "",
      };
    }).filter((profile): profile is AdminAudioVoiceProfile => profile !== null);
    return profiles;
  }
  if (value && typeof value === "object") {
    const profiles = Object.entries(value as Record<string, unknown>).map(([key, rawValue], index) => {
      const candidate = rawValue && typeof rawValue === "object" ? rawValue as Record<string, unknown> : {};
      const id = typeof rawValue === "string" ? rawValue.trim() : typeof candidate.id === "string" ? candidate.id.trim() : typeof candidate.voiceId === "string" ? candidate.voiceId.trim() : "";
      if (!id) return null;
      const legacy = legacyVoiceNames.find((item) => item.key === key);
      return { id, name: typeof candidate.name === "string" && candidate.name.trim() ? candidate.name.trim() : legacy?.name ?? (key || `Voice ${index + 1}`), description: typeof candidate.description === "string" ? candidate.description.trim() : legacy?.description ?? "", imageUrl: typeof candidate.imageUrl === "string" ? candidate.imageUrl.trim() : "" };
    }).filter((profile): profile is AdminAudioVoiceProfile => profile !== null);
    return profiles.length ? profiles : fallback;
  }
  return fallback;
}

function legacyAdminVoicesFromProfiles(profiles: AdminAudioVoiceProfile[], fallback: AdminAudioVoiceSettings): AdminAudioVoiceSettings {
  const voices = { ...fallback };
  legacyVoiceNames.forEach((item, index) => { if (profiles[index]?.id) voices[item.key] = profiles[index].id; });
  return voices;
}

const adminFeatureKeys: AudioFeatureKey[] = ["textToSpeech", "podcastDialogue", "voiceClone", "soundEffects", "audioCleanup"];

function normalizeAdminModelProfileMap(
  value: unknown,
  defaults: Record<string, AdminAudioModelProfile>,
  modelProfiles: Record<string, AdminAudioModelProfile>,
  fallbackVoices: AdminAudioVoiceProfile[],
): Record<string, AdminAudioModelProfile> {
  const candidate = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const result: Record<string, AdminAudioModelProfile> = Object.fromEntries(
    Object.entries(defaults).map(([modelId, profile]) => [modelId, { voices: profile.voices.map((voice) => ({ ...voice })) }]),
  );
  Object.entries(candidate).forEach(([rawModelId, rawProfile]) => {
    const modelId = rawModelId.trim();
    if (!modelId) return;
    const profile = rawProfile && typeof rawProfile === "object" && !Array.isArray(rawProfile) ? rawProfile as Record<string, unknown> : {};
    const voiceCandidate = profile.voices && typeof profile.voices === "object" ? profile.voices : profile;
    const baseVoices = result[modelId]?.voices ?? modelProfiles[modelId]?.voices ?? fallbackVoices;
    result[modelId] = { voices: normalizeAdminVoiceProfiles(voiceCandidate, baseVoices) };
  });
  return result;
}

function normalizeAdminFeatureProfiles(value: unknown, modelProfiles: Record<string, AdminAudioModelProfile>, modelId: string, fallbackVoices: AdminAudioVoiceProfile[]): Record<AudioFeatureKey, AdminAudioFeatureProfile> {
  const activeVoices = modelProfiles[modelId]?.voices ?? fallbackVoices;
  const defaults: Record<AudioFeatureKey, AdminAudioFeatureProfile> = {
    textToSpeech: { modelId, voices: activeVoices, models: { [modelId]: { voices: activeVoices } } },
    podcastDialogue: { modelId, voices: activeVoices, models: { [modelId]: { voices: activeVoices } } },
    voiceClone: { modelId, voices: activeVoices, models: { [modelId]: { voices: activeVoices } } },
    soundEffects: { modelId: "eleven_text_to_sound_v2", voices: [], models: { eleven_text_to_sound_v2: { voices: [] } } },
    audioCleanup: { modelId: "internal", voices: [], models: { internal: { voices: [] } } },
  };
  const candidate = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  return Object.fromEntries(adminFeatureKeys.map((key) => {
    const rawProfile = candidate[key];
    const profile = rawProfile && typeof rawProfile === "object" && !Array.isArray(rawProfile) ? rawProfile as Record<string, unknown> : {};
    const selectedModelId = typeof profile.modelId === "string" && profile.modelId.trim() ? profile.modelId.trim() : defaults[key].modelId;
    const models = normalizeAdminModelProfileMap(profile.models, defaults[key].models, modelProfiles, defaults[key].voices);
    const baseVoices = models[selectedModelId]?.voices ?? modelProfiles[selectedModelId]?.voices ?? defaults[key].voices;
    const voices = profile.voices === undefined ? baseVoices : normalizeAdminVoiceProfiles(profile.voices, baseVoices);
    models[selectedModelId] = { voices };
    return [key, { modelId: selectedModelId, voices: models[selectedModelId].voices, models }];
  })) as Record<AudioFeatureKey, AdminAudioFeatureProfile>;
}

function normalizeAdminAudioSettings(value: AdminAudioSettings): AdminAudioSettings {
  const modelId = value.modelId?.trim() || "eleven_multilingual_v2";
  const suppliedProfiles = value.modelProfiles && typeof value.modelProfiles === "object" ? value.modelProfiles : {};
  const fallbackProfiles = legacyAdminVoiceProfiles(value.voices);
  const modelProfiles = Object.keys(suppliedProfiles).length > 0
    ? Object.fromEntries(Object.entries(suppliedProfiles).map(([key, profile]) => [key, { voices: normalizeAdminVoiceProfiles(profile?.voices, fallbackProfiles) }]))
    : { [modelId]: { voices: fallbackProfiles } };
  const voices = legacyAdminVoicesFromProfiles(modelProfiles[modelId]?.voices ?? fallbackProfiles, value.voices);
  const featureProfiles = normalizeAdminFeatureProfiles(value.featureProfiles, modelProfiles, modelId, modelProfiles[modelId]?.voices ?? fallbackProfiles);
  const backgroundMusicPresets = Array.isArray(value.backgroundMusicPresets) ? value.backgroundMusicPresets.map((preset) => ({
    key: typeof preset.key === "string" ? preset.key : "",
    name: typeof preset.name === "string" ? preset.name : "",
    description: typeof preset.description === "string" ? preset.description : "",
    ...(typeof preset.audioUrl === "string" && preset.audioUrl ? { audioUrl: preset.audioUrl } : {}),
    prompt: typeof preset.prompt === "string" ? preset.prompt : "",
    musicModelId: (preset.musicModelId === "music_v2" ? "music_v2" : "music_v1") as "music_v1" | "music_v2",
    forceInstrumental: preset.forceInstrumental !== false,
    volume: typeof preset.volume === "number" && Number.isFinite(preset.volume) ? Math.min(1, Math.max(0, preset.volume)) : 0.15,
    isActive: preset.isActive !== false,
  })) : [];
  return { ...value, modelId, voices, modelProfiles, featureProfiles, backgroundMusicPresets };
}

export async function getAdminAudioSettings(): Promise<AdminAudioSettings> {
  const payload = await adminRequest("/api/v1/admin/audio-settings") as { data?: AdminAudioSettings };
  if (!payload.data) throw new Error("Unable to load audio settings");
  return normalizeAdminAudioSettings(payload.data);
}

export async function updateAdminAudioSettings(input: AdminAudioSettingsPatch): Promise<AdminAudioSettings> {
  const payload = await adminRequest("/api/v1/admin/audio-settings", { method: "PATCH", body: JSON.stringify(input) }) as { data?: AdminAudioSettings };
  if (!payload.data) throw new Error("Unable to save audio settings");
  return normalizeAdminAudioSettings(payload.data);
}

export async function updateAdminAudioRouting(input: Partial<AdminAudioRouting>): Promise<AdminAudioSettings> {
  const payload = await adminRequest("/api/v1/admin/audio-settings/routing", { method: "PATCH", body: JSON.stringify(input) }) as { data?: AdminAudioSettings };
  if (!payload.data) throw new Error("Unable to save audio routing");
  return normalizeAdminAudioSettings(payload.data);
}

export async function updateAdminAudioProvider(provider: "elevenlabs" | "internal", input: AdminAudioSettingsPatch["elevenlabs"] | AdminAudioSettingsPatch["internal"]): Promise<AdminAudioSettings> {
  const payload = await adminRequest(`/api/v1/admin/audio-settings/providers/${provider}`, { method: "PATCH", body: JSON.stringify(input) }) as { data?: AdminAudioSettings };
  if (!payload.data) throw new Error(`Unable to save ${provider} settings`);
  return normalizeAdminAudioSettings(payload.data);
}

export async function testAdminElevenLabsConnection(): Promise<{ provider: "elevenlabs"; ok: boolean; message: string }> {
  const payload = await adminRequest("/api/v1/admin/audio-settings/providers/elevenlabs/test", { method: "POST" }) as { data?: { provider: "elevenlabs"; ok: boolean; message: string } };
  if (!payload.data) throw new Error("Unable to test ElevenLabs connection");
  return payload.data;
}
