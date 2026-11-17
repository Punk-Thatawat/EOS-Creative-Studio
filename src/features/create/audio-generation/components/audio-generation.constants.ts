import {
  AudioLines,
  AudioWaveform,
  Clapperboard,
  Mic2,
  Music2,
  Smile,
  Star,
  WandSparkles,
  Waves,
  Zap,
} from "lucide-react";
import { type TranslationKey } from "@/lib/i18n/dictionary";
import { type DropdownOption } from "@/components/ui/dropdown";
import {
  type AudioScene,
  type AudioTab,
  type PodcastLine,
  type PodcastSpeaker,
} from "./audio-generation.types";

export const MIN_PODCAST_SPEAKERS = 2;

export const podcastVoiceAvatarEntries = [
  ["jessica", "/generated-assets/podcast-voices/jessica.jpg"],
  ["laura", "/generated-assets/podcast-voices/laura.jpg"],
  ["alice", "/generated-assets/podcast-voices/alice.jpg"],
  ["bill", "/generated-assets/podcast-voices/bill.jpg"],
  ["brian", "/generated-assets/podcast-voices/brian.jpg"],
  ["haytham", "/generated-assets/podcast-voices/haytham.jpg"],
  ["amelia", "/generated-assets/podcast-voices/amelia.jpg"],
  ["otto", "/generated-assets/podcast-voices/otto.jpg"],
] as const;

export const visibleTabs: readonly AudioTab[] = [
  "Text to Speech",
  "Podcast & Dialogue",
  "Voice Clone",
  "Sound Effects",
  "Text to Music",
  "Audio Cleanup",
];

// The backend may list Eleven models under either their WaveSpeed-style keys or raw ElevenLabs ids.
export const ELEVENLABS_TEXT_TO_SPEECH_MODEL_KEYS = [
  "eleven_v4",
  "elevenlabs/eleven-v4",
];

export const MINIMAX_TEXT_TO_SPEECH_MODEL_KEYS = ["minimax/speech-2.8-hd"];

export const AUDIO_TAB_STORAGE_KEY = "eos.audio.active-tab";

export const audioTabKeys = {
  "Text to Speech": "create.audio.tabs.textToSpeech",
  "Podcast & Dialogue": "create.audio.tabs.podcastDialogue",
  "Voice Clone": "create.audio.tabs.voiceClone",
  "Sound Effects": "create.audio.tabs.soundEffects",
  "Text to Music": "create.audio.tabs.textToMusic",
  "Audio Cleanup": "create.audio.tabs.audioCleanup",
} as const;

export const audioModeIcons = {
  "Text to Speech": AudioLines,
  "Podcast & Dialogue": AudioWaveform,
  "Voice Clone": Mic2,
  "Sound Effects": Waves,
  "Text to Music": Music2,
  "Audio Cleanup": WandSparkles,
} as const;

export const mobileAudioModeOptions = visibleTabs.map((label) => ({
  value: label,
  label,
  icon: audioModeIcons[label],
}));

export const tones = [
  { label: "Energetic", icon: Zap },
  { label: "Friendly", icon: Smile },
  { label: "Premium", icon: Star },
  { label: "Dramatic", icon: Clapperboard },
] as const;

export const toneKeys = {
  Energetic: "create.audio.tones.energetic",
  Friendly: "create.audio.tones.friendly",
  Premium: "create.audio.tones.premium",
  Dramatic: "create.audio.tones.dramatic",
} as const;

export const voiceImages = [
  "/generated-assets/audio-ui/audio-voice-female-warm.png",
  "/generated-assets/audio-ui/audio-voice-male-bold.png",
  "/generated-assets/audio-ui/audio-voice-youthful.png",
  "/generated-assets/audio-ui/audio-voice-corporate.png",
  "/generated-assets/audio-ui/audio-voice-podcast-host.png",
] as const;

export const waveformBars = Array.from({ length: 88 }, (_, index) =>
  Math.round(24 + Math.abs(Math.sin(index * 0.37)) * 48 + Math.abs(Math.sin(index * 0.91)) * 20),
);

export const AUDIO_HISTORY_LIMIT = 10;

// Most recent Text to Speech entries (the API maximum) scanned for ones made with a cloned voice.
export const CLONE_HISTORY_SPEECH_SCAN_LIMIT = 50;

export const VOICE_PAGE_SIZE = 8;

export const DEFAULT_AUDIO_PROMPT =
  "ขอแนะนำ EOS Creative Studio — แพลตฟอร์มครบวงจรสำหรับสร้างสรรค์ สื่อสาร และสร้างความประทับใจ ตั้งแต่ภาพที่โดดเด่นไปจนถึงเสียงที่ทรงพลัง เราช่วยให้ไอเดียของคุณส่งถึงใจและเชื่อมต่อได้ลึกกว่าเดิม";

export const defaultAudioScenes: AudioScene[] = [
  { id: "01", title: "ฉากที่ 1", durationSeconds: 12, text: DEFAULT_AUDIO_PROMPT, voice: "" },
];

export const VOICE_CLONE_MODEL_ID = "minimax/voice-clone";

export const MINIMAX_LANGUAGE_BOOST_OPTIONS: DropdownOption[] = [
  { value: "Thai", label: "ภาษาไทย" },
  { value: "English", label: "English" },
];

export const VOICE_CLONE_MODEL_OPTIONS: DropdownOption[] = [
  { value: VOICE_CLONE_MODEL_ID, label: "MiniMax · Voice Clone" },
];

export const SFX_MODEL_OPTIONS: DropdownOption[] = [
  { value: "text", label: "WaveSpeed · Sonilo Text-to-SFX" },
  { value: "video", label: "WaveSpeed · Sonilo Video-to-SFX" },
];

export const podcastSpeakerTones = ["orange", "blue", "green", "purple", "pink"] as const;

export const defaultPodcastSpeakers: PodcastSpeaker[] = [
  { id: "host", role: "พิธีกร", name: "ณัฐพงษ์", voice: "เสียงหญิงนุ่ม", image: voiceImages[0] },
  { id: "guest-1", role: "แขกรับเชิญ 1", name: "สุพิชฌาย์", voice: "เสียงหญิงสดใส", image: voiceImages[2] },
  { id: "guest-2", role: "แขกรับเชิญ 2", name: "ธนกฤต", voice: "เสียงชายหนักแน่น", image: voiceImages[1] },
  { id: "co-host", role: "ผู้ร่วมดำเนินรายการ", name: "พิมพ์ชนก", voice: "เสียงพิธีกรพอดแคสต์", image: voiceImages[4] },
];

export const defaultPodcastLines: PodcastLine[] = [
  {
    id: "line-1",
    speakerId: "host",
    text: "สวัสดีครับทุกคน ยินดีต้อนรับเข้าสู่พอดแคสต์เปิดโลก AI สำหรับครีเอเตอร์ครับ",
  },
  {
    id: "line-2",
    speakerId: "guest-1",
    text: "สวัสดีค่ะ วันนี้เราจะมาคุยกันเรื่อง AI ที่ช่วยให้การทำงานคอนเทนต์ง่ายขึ้นค่ะ",
  },
  {
    id: "line-3",
    speakerId: "guest-2",
    text: "ใช่ครับ โดยเฉพาะเครื่องมือที่ช่วยสร้างเสียงและพอดแคสต์อัตโนมัติ",
  },
  {
    id: "line-4",
    speakerId: "co-host",
    text: "เดี๋ยวเรามาเริ่มกันที่พื้นฐานกันก่อนเลยดีกว่าว่า AI ทำงานยังไงบ้างนะคะ",
  },
];

export const audioSettingInfo: ReadonlyArray<readonly [TranslationKey, TranslationKey]> = [
  ["create.audio.voiceModel", "create.audio.info.model"],
  ["create.audio.clone.model", "create.audio.info.model"],
  ["create.audio.outputFormat", "create.audio.info.format"],
  ["create.audio.podcast.outputFormat", "create.audio.info.format"],
  ["create.audio.cleanup.outputFormat", "create.audio.info.format"],
  ["create.audio.clone.outputFormat", "create.audio.info.format"],
  ["create.audio.sfx.outputFormat", "create.audio.info.format"],
  ["create.audio.speechSpeed", "create.audio.info.speed"],
  ["create.audio.clone.speed", "create.audio.info.speed"],
  ["create.audio.podcast.pacing", "create.audio.info.speed"],
  ["create.audio.pitch", "create.audio.info.pitch"],
  ["create.audio.synthVolume", "create.audio.info.volume"],
  ["create.audio.clone.accuracy", "create.audio.info.accuracy"],
  ["create.audio.clone.noiseReduction", "create.audio.info.noiseReduction"],
  ["create.audio.clone.volumeNormalization", "create.audio.info.volumeNormalization"],
  ["create.audio.clone.emotion", "create.audio.info.emotion"],
  ["create.audio.language", "create.audio.info.language"],
  ["create.audio.pronunciationHints", "create.audio.info.pronunciation"],
  ["create.audio.podcast.language", "create.audio.info.language"],
  ["create.audio.music.model", "create.audio.info.model"],
  ["create.audio.clone.sampleRate", "create.audio.info.sampleRate"],
  ["create.audio.clone.bitrate", "create.audio.info.bitrate"],
  ["create.audio.clone.channel", "create.audio.info.channel"],
  ["create.audio.clone.englishNormalization", "create.audio.info.normalization"],
  ["create.audio.podcast.speakingStyle", "create.audio.info.speakingStyle"],
  ["create.audio.clone.voiceCharacter", "create.audio.info.voiceCharacter"],
  ["create.audio.sfx.source", "create.audio.info.sfxSource"],
  ["create.audio.sfx.effectCategory", "create.audio.info.sfxCategory"],
  ["create.audio.sfx.duration", "create.audio.info.sfxDuration"],
  ["create.audio.sfx.variations", "create.audio.info.sfxVariations"],
];
