import {
  type AudioHistoryEntry,
  type DialogueEmotionTag,
  type SaveAudioHistoryInput,
} from "@/lib/api/audio";

export type AudioTab = "Text to Speech" | "Podcast & Dialogue" | "Voice Clone" | "Sound Effects" | "Text to Music" | "Audio Cleanup";

export type MiniMaxSpeechEmotion = "happy" | "sad" | "angry" | "fearful" | "disgusted" | "surprised" | "neutral";

export type AudioHistoryItem = Omit<AudioHistoryEntry, "url"> & { url: string; localUrl?: boolean; persisted?: boolean };

export type SaveHistoryCallback = (input: SaveAudioHistoryInput) => Promise<AudioHistoryEntry | null>;

export type AudioScene = { id: string; title: string; durationSeconds: number; text: string; voice: string };

export type PodcastSpeaker = { id: string; role: string; name: string; voice: string; image: string };

export type PodcastSpeakerDraft = Pick<PodcastSpeaker, "role" | "name" | "voice">;

export type PodcastLine = { id: string; speakerId: string; text: string; emotionTag?: DialogueEmotionTag };
