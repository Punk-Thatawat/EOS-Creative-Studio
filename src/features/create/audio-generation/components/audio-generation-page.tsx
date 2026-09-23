"use client";
import { useTemplateSettings } from "@/features/templates/use-template-settings";
import { useTemplatePrompt } from "@/features/templates/use-template-prompt";
import { promptMaxLength } from "@/lib/prompt-limits";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import {
  AudioLines,
  AudioWaveform,
  Check,
  Clapperboard,
  ChevronLeft,
  ChevronRight,
  CloudUpload,
  Copy,
  Download,
  History,
  LockKeyhole,
  Mic2,
  Pause,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  RotateCw,
  Settings2,
  Smile,
  Sparkles,
  Star,
  Trash2,
  Volume2,
  WandSparkles,
  Waves,
  Zap,
} from "lucide-react";
import styles from "./audio-generation-page.module.css";
import { MobileModeDropdown } from "@/features/create/components/mobile-mode-dropdown";
import { InfoTooltip } from "@/features/create/components/info-tooltip";
import { ClearValuesButton } from "@/features/create/components/clear-values-button";
import { CreatorWorkspaceLayout } from "@/components/create/creator-workspace-layout";
import { ImageTutorialButton } from "@/features/create/image-generation/components/image-tutorial-button";
import { useLocale } from "@/lib/i18n/locale-provider";
import { Dropdown, type DropdownOption } from "@/components/ui/dropdown";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createDialogue,
  cleanupAudio,
  createSoundEffects,
  createTextToSpeech,
  createTextToSpeechScenes,
  createVideoSoundEffect,
  createVoiceClone,
  deleteAudioHistory,
  deleteVoiceClone,
  fetchAudioHistoryAudio,
  listAudioBackgroundMusic,
  listAudioHistory,
  listAudioModels,
  listAudioVoices,
  listVoiceClones,
  previewAudioVoice,
  previewVoiceClone,
  quoteDialogue,
  quoteSoundEffects,
  quoteTextToSpeech,
  quoteTextToSpeechScenes,
  quoteVoiceClone,
  saveAudioHistory,
  type AudioBackgroundMusic,
  type AudioCreditQuote,
  type AudioHistoryEntry,
  type AudioModel,
  type AudioVoice,
  type SaveAudioHistoryInput,
  type SoundEffectsQuote,
  type SoundEffectVariant,
  type TextToSpeechResponse,
  type VoiceCloneListItem,
  type VoiceCloneQuote,
} from "@/lib/api/audio";

const audioModes = ["Text to Speech", "Podcast & Dialogue", "Voice Clone", "Sound Effects", "Audio Cleanup"] as const;
void audioModes; // kept for its type + as the full mode list to restore once the hotfix above is reverted
type AudioTab = (typeof audioModes)[number];
const MIN_PODCAST_SPEAKERS = 2;

// Open close Tab Sound
// const visibleTabs: readonly AudioTab[] = ["Text to Speech"];
const visibleTabs: readonly AudioTab[] = audioModes;
const AUDIO_TAB_STORAGE_KEY = "eos.audio.active-tab";

const audioTabKeys = {
  "Text to Speech": "create.audio.tabs.textToSpeech",
  "Podcast & Dialogue": "create.audio.tabs.podcastDialogue",
  "Voice Clone": "create.audio.tabs.voiceClone",
  "Sound Effects": "create.audio.tabs.soundEffects",
  "Audio Cleanup": "create.audio.tabs.audioCleanup",
} as const;
const audioModeIcons = {
  "Text to Speech": AudioLines,
  "Podcast & Dialogue": AudioWaveform,
  "Voice Clone": Mic2,
  "Sound Effects": Waves,
  "Audio Cleanup": WandSparkles,
} as const;

const tones = [
  { label: "Energetic", icon: Zap },
  { label: "Friendly", icon: Smile },
  { label: "Premium", icon: Star },
  { label: "Dramatic", icon: Clapperboard },
] as const;

const toneKeys = {
  Energetic: "create.audio.tones.energetic",
  Friendly: "create.audio.tones.friendly",
  Premium: "create.audio.tones.premium",
  Dramatic: "create.audio.tones.dramatic",
} as const;

const voiceImages = [
  "/generated-assets/audio-ui/audio-voice-female-warm.png",
  "/generated-assets/audio-ui/audio-voice-male-bold.png",
  "/generated-assets/audio-ui/audio-voice-youthful.png",
  "/generated-assets/audio-ui/audio-voice-corporate.png",
  "/generated-assets/audio-ui/audio-voice-podcast-host.png",
] as const;

const waveformBars = Array.from({ length: 88 }, (_, index) =>
  Math.round(24 + Math.abs(Math.sin(index * 0.37)) * 48 + Math.abs(Math.sin(index * 0.91)) * 20),
);

type AudioHistoryItem = Omit<AudioHistoryEntry, "url"> & { url: string; localUrl?: boolean; persisted?: boolean };
const AUDIO_HISTORY_LIMIT = 10;
const VOICE_PAGE_SIZE = 8;
type SaveHistoryCallback = (input: SaveAudioHistoryInput) => Promise<AudioHistoryEntry | null>;
type AudioScene = { id: string; title: string; durationSeconds: number; text: string; voice: string };
type PodcastSpeaker = { id: string; role: string; name: string; voice: string; image: string };
type PodcastSpeakerDraft = Pick<PodcastSpeaker, "role" | "name" | "voice">;
type PodcastLine = { id: string; speakerId: string; text: string };

const DEFAULT_AUDIO_PROMPT =
  "ขอแนะนำ EOS Creative Studio — แพลตฟอร์มครบวงจรสำหรับสร้างสรรค์ สื่อสาร และสร้างความประทับใจ ตั้งแต่ภาพที่โดดเด่นไปจนถึงเสียงที่ทรงพลัง เราช่วยให้ไอเดียของคุณส่งถึงใจและเชื่อมต่อได้ลึกกว่าเดิม";
const defaultAudioScenes: AudioScene[] = [
  { id: "01", title: "ฉากที่ 1", durationSeconds: 12, text: DEFAULT_AUDIO_PROMPT, voice: "" },
];
const VOICE_CLONE_MODEL_ID = "wavespeed-ai/omnivoice/voice-clone";
const MINIMAX_LANGUAGE_BOOST_OPTIONS: DropdownOption[] = [
  { value: "Thai", label: "ภาษาไทย" },
  { value: "English", label: "English" },
];

const VOICE_CLONE_MODEL_OPTIONS: DropdownOption[] = [
  { value: VOICE_CLONE_MODEL_ID, label: "WaveSpeed · OmniVoice" },
  { value: "minimax/speech-2.8-hd", label: "MiniMax · Speech 2.8 HD" },
  { value: "minimax/voice-clone", label: "MiniMax · Voice Clone" },
];
const SFX_MODEL_OPTIONS: DropdownOption[] = [
  { value: "text", label: "WaveSpeed · Sonilo Text-to-SFX" },
  { value: "video", label: "WaveSpeed · Sonilo Video-to-SFX" },
];

const podcastSpeakerTones = ["orange", "blue", "green", "purple", "pink"] as const;
const defaultPodcastSpeakers: PodcastSpeaker[] = [
  { id: "host", role: "พิธีกร", name: "ณัฐพงษ์", voice: "เสียงหญิงนุ่ม", image: voiceImages[0] },
  { id: "guest-1", role: "แขกรับเชิญ 1", name: "สุพิชฌาย์", voice: "เสียงหญิงสดใส", image: voiceImages[2] },
  { id: "guest-2", role: "แขกรับเชิญ 2", name: "ธนกฤต", voice: "เสียงชายหนักแน่น", image: voiceImages[1] },
  { id: "co-host", role: "ผู้ร่วมดำเนินรายการ", name: "พิมพ์ชนก", voice: "เสียงพิธีกรพอดแคสต์", image: voiceImages[4] },
];
const defaultPodcastLines: PodcastLine[] = [
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

function formatSceneSeconds(seconds: number): string {
  const safeSeconds = Math.max(0, Math.round(seconds));
  return `${String(Math.floor(safeSeconds / 60)).padStart(2, "0")}:${String(safeSeconds % 60).padStart(2, "0")}`;
}

function formatCreditAmount(value: number): string {
  return value.toLocaleString("th-TH", { maximumFractionDigits: 2 });
}

function formatAudioHistoryDate(value: string, locale: "th" | "en"): string {
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

function createAudioIdempotencyKey(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function FieldLabel({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className={styles.fieldLabel}>
      <span>{children}</span>
      {hint ? <small>{hint}</small> : null}
    </div>
  );
}

function SelectField({
  label,
  options,
  value,
  onChange,
  disabled = false,
  loading = false,
}: {
  label: string;
  options: readonly DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <label className={styles.selectField}>
      <FieldLabel>{label}</FieldLabel>
      <Dropdown
        value={value}
        options={options}
        onChange={onChange}
        disabled={disabled}
        loading={loading}
        ariaLabel={label}
        triggerClassName="h-[38px] min-h-0 rounded-lg border-[#dfe2e7] px-[11px] text-[11px] font-normal"
      />
    </label>
  );
}

function PodcastConfirmationDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={styles.podcastConfirmDialog}>
        <DialogHeader className={styles.podcastConfirmHeader}>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className={styles.podcastConfirmFooter}>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            ยกเลิก
          </Button>
          <Button type="button" variant="destructive" className={styles.podcastConfirmDeleteButton} onClick={onConfirm}>
            ลบ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PreviewWaveform({
  audioUrl,
  progress,
  isPlaying,
}: {
  audioUrl: string | null;
  progress: number;
  isPlaying: boolean;
}) {
  const { t } = useLocale();
  const safeProgress = Math.min(100, Math.max(0, progress));
  return (
    <div
      className={`${styles.waveform} ${isPlaying ? styles.waveformPlaying : ""}`}
      aria-label={t("create.audio.a11y.waveform")}
    >
      <div className={styles.waveformBars} aria-hidden="true">
        {waveformBars.map((height, index) => {
          const barProgress = (index / Math.max(1, waveformBars.length - 1)) * 100;
          return (
            <span
              key={`${height}-${index}`}
              className={`${styles.waveformBar} ${audioUrl && barProgress <= safeProgress ? styles.waveformBarPlayed : ""}`}
              style={{
                height: `${height}%`,
                animationDelay: `${(index % 12) * -75}ms`,
                animationDuration: `${0.86 + (index % 5) * 0.08}s`,
              }}
            />
          );
        })}
      </div>
      {audioUrl ? (
        <span className={styles.waveformPlayhead} style={{ left: `${safeProgress}%` }} aria-hidden="true" />
      ) : null}
    </div>
  );
}

function CleanupAudioPlayer({ src, label }: { src: string | null; label: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(78);
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  useEffect(() => {
    audioRef.current?.pause();
    const timer = window.setTimeout(() => {
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [src]);

  const togglePlayback = async () => {
    if (!audioRef.current || !src) return;
    if (audioRef.current.paused) {
      await audioRef.current.play().catch(() => undefined);
    } else {
      audioRef.current.pause();
    }
  };

  return (
    <div className={styles.cleanupPlayer} aria-label={label}>
      <button
        type="button"
        className={styles.podcastPlayButton}
        onClick={() => void togglePlayback()}
        disabled={!src}
        aria-label={isPlaying ? "หยุดเสียงชั่วคราว" : "เล่นเสียง"}
      >
        {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
      </button>
      <div className={styles.podcastWaveformWrap}>
        <PreviewWaveform audioUrl={src} progress={progress} isPlaying={isPlaying} />
        <div className={styles.podcastAudioMeta}>
          <span>
            {formatSceneSeconds(currentTime)} / {formatSceneSeconds(duration)}
          </span>
          <input
            type="range"
            min="0"
            max="100"
            value={progress}
            onChange={(event) => {
              const nextProgress = Number(event.target.value);
              if (audioRef.current && duration > 0) audioRef.current.currentTime = (nextProgress / 100) * duration;
            }}
            aria-label="ตำแหน่งเสียง"
            disabled={!src || duration <= 0}
          />
        </div>
      </div>
      <Volume2 size={16} className={styles.podcastVolumeIcon} aria-hidden="true" />
      <input
        className={styles.podcastVolumeSlider}
        type="range"
        min="0"
        max="100"
        value={volume}
        onChange={(event) => {
          const nextVolume = Number(event.target.value);
          setVolume(nextVolume);
          if (audioRef.current) audioRef.current.volume = nextVolume / 100;
        }}
        aria-label="ระดับเสียง"
      />
      <audio
        ref={audioRef}
        className={styles.podcastNativeAudio}
        src={src ?? undefined}
        preload="metadata"
        onLoadedMetadata={(event) => {
          setDuration(event.currentTarget.duration);
          event.currentTarget.volume = volume / 100;
        }}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(duration);
        }}
      />
    </div>
  );
}

function AlternateHeading({
  eyebrow,
  title,
  description,
  icon,
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon: ReactNode;
}) {
  return (
    <div className={styles.alternateHeading}>
      <div>
        <span>{eyebrow}</span>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <div className={styles.alternateHeadingIcon}>{icon}</div>
    </div>
  );
}

function AltWaveform({ label = "LIVE PREVIEW" }: { label?: string }) {
  return (
    <div className={styles.altWaveform}>
      <Image src="/generated-assets/audio-ui/audio-waveform.png" alt="" fill unoptimized sizes="700px" />
      <span>{label}</span>
    </div>
  );
}

function PodcastDialogueLayout({ onHistorySaved }: { onHistorySaved?: SaveHistoryCallback }) {
  const { locale, t } = useLocale();
  const [speakers, setSpeakers] = useState(defaultPodcastSpeakers);
  const [lines, setLines] = useState(defaultPodcastLines);
  const [activeSpeakerId, setActiveSpeakerId] = useState(defaultPodcastSpeakers[0]!.id);
  const [speakingStyle, setSpeakingStyle] = useState<"Interview" | "Roundtable" | "Storytelling">("Interview");
  const [language, setLanguage] = useState("Thai (ไทย)");
  const [outputFormat, setOutputFormat] = useState<"mp3" | "wav" | "ogg">("mp3");
  const [speed, setSpeed] = useState(1);
  const [backgroundMusic, setBackgroundMusic] = useState(false);
  const [backgroundMusicPreset, setBackgroundMusicPreset] = useState("");
  const [backgroundMusicPresets, setBackgroundMusicPresets] = useState<AudioBackgroundMusic[]>([]);
  const [backgroundMusicLoading, setBackgroundMusicLoading] = useState(true);
  const [normalizeAudio, setNormalizeAudio] = useState(true);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "generating" | "ready" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [podcastHistory, setPodcastHistory] = useState<AudioHistoryItem[]>([]);
  const [podcastHistoryLoadingId, setPodcastHistoryLoadingId] = useState<string | null>(null);
  const [pendingPodcastHistoryDelete, setPendingPodcastHistoryDelete] = useState<AudioHistoryItem | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [previewProgress, setPreviewProgress] = useState(0);
  const [previewCurrentTime, setPreviewCurrentTime] = useState(0);
  const [previewDuration, setPreviewDuration] = useState(0);
  const [volume, setVolume] = useState(72);
  const [creditEstimate, setCreditEstimate] = useState<AudioCreditQuote | null>(null);
  const [creditEstimateLoading, setCreditEstimateLoading] = useState(false);
  const [creditEstimateError, setCreditEstimateError] = useState<string | null>(null);
  const [availableVoices, setAvailableVoices] = useState<AudioVoice[]>([]);
  const [voicesLoading, setVoicesLoading] = useState(true);
  // Tracked but not yet surfaced in the UI — voicesLoading/the voice list itself
  // stand in for now; wire this up if a dedicated error message is wanted.
  const [voicesError, setVoicesError] = useState<string | null>(null);
  void voicesError;
  const [previewingVoiceKey, setPreviewingVoiceKey] = useState<string | null>(null);
  const [previewLoadingVoiceKey, setPreviewLoadingVoiceKey] = useState<string | null>(null);
  const [voicePreviewError, setVoicePreviewError] = useState<string | null>(null);
  const [speakerDialogOpen, setSpeakerDialogOpen] = useState(false);
  const [speakerDeleteConfirmOpen, setSpeakerDeleteConfirmOpen] = useState(false);
  const [editingSpeakerId, setEditingSpeakerId] = useState<string | null>(null);
  const [speakerDraft, setSpeakerDraft] = useState<PodcastSpeakerDraft>({ role: "", name: "", voice: "" });
  const [speakerFormError, setSpeakerFormError] = useState<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement>(null);
  const voicePreviewAudioRef = useRef<HTMLAudioElement | null>(null);
  const voicePreviewObjectUrlsRef = useRef<string[]>([]);
  const podcastHistoryRef = useRef<AudioHistoryItem[]>([]);

  const totalDuration = lines.reduce((total, line) => total + estimatePodcastLineSeconds(line.text), 0);
  // Keep the visible count identical to the trimmed text sent in episodeScript
  // and count Unicode characters rather than UTF-16 code units.
  const dialogueCharacterCount = lines.reduce((total, line) => total + Array.from(line.text.trim()).length, 0);
  const dialogueCharacterLimit = 2000;
  const episodeScript = lines
    .map(
      (line) => `${speakers.find((speaker) => speaker.id === line.speakerId)?.role ?? "Speaker"}: ${line.text.trim()}`,
    )
    .filter((line) => line.split(": ")[1]?.trim())
    .join("\n");
  useEffect(
    () => () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      voicePreviewAudioRef.current?.pause();
    },
    [audioUrl],
  );

  useEffect(
    () => () => {
      voicePreviewAudioRef.current?.pause();
      voicePreviewObjectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    },
    [],
  );

  useEffect(() => {
    let active = true;
    void listAudioHistory({ feature: "dialogue", limit: AUDIO_HISTORY_LIMIT })
      .then((items) => {
        if (!active) return;
        const history = items.map((item) => ({
          ...item,
          url: item.url ?? item.audioUrl ?? item.downloadUrl ?? "",
          localUrl: false,
          persisted: true,
        }));
        podcastHistoryRef.current = history;
        setPodcastHistory(history);
      })
      .catch(() => undefined);
    return () => {
      active = false;
      podcastHistoryRef.current
        .filter((item) => item.localUrl && item.url)
        .forEach((item) => URL.revokeObjectURL(item.url));
    };
  }, []);

  const podcastCreditQuoteInput =
    episodeScript.trim() && speakers.length >= MIN_PODCAST_SPEAKERS
      ? {
          script: episodeScript,
          speakers: speakers.map(({ role, voice }) => ({ name: role, voice })),
          conversationStyle: speakingStyle,
          languageCode: language.startsWith("Thai") ? "th" : "en",
          emotion: 0.64,
          pauseSeconds: 0.4,
          autoDirect: true,
          outputFormat,
          backgroundMusicEnabled: backgroundMusic,
          ...(backgroundMusicPreset ? { backgroundMusicKey: backgroundMusicPreset } : {}),
          normalizeAudio,
        }
      : null;
  const podcastCreditQuoteKey = JSON.stringify(podcastCreditQuoteInput);

  useEffect(() => {
    let active = true;
    if (podcastCreditQuoteKey === "null") {
      const resetTimer = window.setTimeout(() => {
        if (!active) return;
        setCreditEstimate(null);
        setCreditEstimateError(null);
        setCreditEstimateLoading(false);
      }, 0);
      return () => {
        active = false;
        window.clearTimeout(resetTimer);
      };
    }
    const timer = window.setTimeout(() => {
      setCreditEstimateLoading(true);
      setCreditEstimateError(null);
      const request = JSON.parse(podcastCreditQuoteKey) as Parameters<typeof quoteDialogue>[0];
      void quoteDialogue(request)
        .then((quote) => {
          if (!active) return;
          setCreditEstimate(quote);
        })
        .catch((cause: unknown) => {
          if (!active) return;
          setCreditEstimate(null);
          setCreditEstimateError(cause instanceof Error ? cause.message : "Pricing unavailable");
        })
        .finally(() => {
          if (active) setCreditEstimateLoading(false);
        });
    }, 350);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [podcastCreditQuoteKey]);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      if (!active) return;
      setVoicesLoading(true);
      setVoicesError(null);
      void listAudioVoices(undefined, "podcastDialogue")
        .then((voices) => {
          if (!active) return;
          const hydratedVoices = voices.map((voice) => ({ ...voice }));
          setAvailableVoices(hydratedVoices);
          setSpeakers((current) =>
            current.map((speaker, index) => {
              const configuredVoice = hydratedVoices.find(
                (voice) => voice.key === speaker.voice || voice.name === speaker.voice,
              );
              const nextVoice = configuredVoice ?? hydratedVoices[index % hydratedVoices.length];
              return nextVoice
                ? { ...speaker, voice: nextVoice.key, image: nextVoice.imageUrl ?? "" }
                : { ...speaker, image: "" };
            }),
          );
        })
        .catch((cause: unknown) => {
          if (!active) return;
          setVoicesError(cause instanceof Error ? cause.message : "โหลดรายการเสียงไม่สำเร็จ");
          setSpeakers((current) => current.map((speaker) => ({ ...speaker, image: "" })));
        })
        .finally(() => {
          if (active) setVoicesLoading(false);
        });
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      if (!active) return;
      setBackgroundMusicLoading(true);
      void listAudioBackgroundMusic()
        .then((presets) => {
          if (!active) return;
          setBackgroundMusicPresets(presets);
          setBackgroundMusicPreset((current) =>
            presets.some((preset) => preset.key === current) ? current : (presets[0]?.key ?? ""),
          );
        })
        .catch(() => {
          if (!active) return;
          setBackgroundMusicPresets([]);
          setBackgroundMusicPreset("");
        })
        .finally(() => {
          if (active) setBackgroundMusicLoading(false);
        });
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, []);

  const handleGenerate = async () => {
    if (!episodeScript.trim()) return;
    if (speakers.length < MIN_PODCAST_SPEAKERS) {
      setError("Podcast ต้องมีผู้พูดอย่างน้อย 2 คน");
      setStatus("error");
      return;
    }
    if (dialogueCharacterCount > dialogueCharacterLimit) {
      setError(`บทสนทนายาวเกิน ${dialogueCharacterLimit.toLocaleString()} ตัวอักษร กรุณาแบ่งเป็นตอนย่อยก่อนสร้าง`);
      setStatus("error");
      return;
    }
    // Do not keep showing the previous result while a new episode is being
    // generated. The preview should appear only when this generation finishes.
    previewAudioRef.current?.pause();
    setIsPlaying(false);
    setAudioUrl((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return null;
    });
    setPreviewProgress(0);
    setPreviewCurrentTime(0);
    setPreviewDuration(0);
    setStatus("generating");
    setError(null);
    try {
      const result = await createDialogue({
        script: episodeScript,
        speakers: speakers.map(({ role, voice }) => ({ name: role, voice })),
        conversationStyle: speakingStyle,
        languageCode: language.startsWith("Thai") ? "th" : "en",
        emotion: 0.64,
        pauseSeconds: 0.4,
        autoDirect: true,
        outputFormat,
        backgroundMusicEnabled: backgroundMusic,
        ...(backgroundMusicPreset ? { backgroundMusicKey: backgroundMusicPreset } : {}),
        normalizeAudio,
        idempotencyKey: createAudioIdempotencyKey(),
      });
      const nextUrl = URL.createObjectURL(result.blob);
      setAudioUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return nextUrl;
      });
      const savedHistory = await onHistorySaved?.({
        audio: result.blob,
        feature: "dialogue",
        label: "Podcast Episode 01",
        outputFormat,
        metadata: {
          speakingStyle,
          speakerCount: `${speakers.length} Speakers`,
          language,
          backgroundMusic,
          backgroundMusicPreset,
          normalizeAudio,
          speed,
        },
      });
      if (savedHistory) {
        const historyItem: AudioHistoryItem = {
          ...savedHistory,
          url: savedHistory.url ?? savedHistory.audioUrl ?? savedHistory.downloadUrl ?? "",
          localUrl: false,
          persisted: true,
        };
        const nextHistory = [historyItem, ...podcastHistoryRef.current].slice(0, AUDIO_HISTORY_LIMIT);
        podcastHistoryRef.current = nextHistory;
        setPodcastHistory(nextHistory);
      }
      setStatus("ready");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Podcast generation failed");
      setStatus("error");
    }
  };

  const openSpeakerDialog = (speaker?: PodcastSpeaker) => {
    const nextNumber = speakers.length + 1;
    const fallbackVoice =
      availableVoices[nextNumber % Math.max(1, availableVoices.length)]?.key ??
      (nextNumber % 2 === 0 ? t("create.audio.podcast.voiceMaleBold") : t("create.audio.podcast.voiceFemaleWarm"));
    setEditingSpeakerId(speaker?.id ?? null);
    setSpeakerDraft(
      speaker
        ? { role: speaker.role, name: speaker.name, voice: speaker.voice }
        : {
            role: t("create.audio.podcast.roleGuest", { index: nextNumber - 1 }),
            name: t("create.audio.podcast.newSpeaker", { index: nextNumber }),
            voice: fallbackVoice,
          },
    );
    setSpeakerFormError(null);
    setSpeakerDialogOpen(true);
  };

  const saveSpeaker = () => {
    const role = speakerDraft.role.trim();
    const name = speakerDraft.name.trim();
    const voice = speakerDraft.voice.trim();
    if (!role || !name || !voice) {
      setSpeakerFormError("กรุณากรอกบทบาท ชื่อ และเลือกเสียงให้ครบ");
      return;
    }
    const selectedVoice = availableVoices.find((item) => item.key === voice || item.name === voice);
    const image = selectedVoice?.imageUrl ?? "";
    const nextSpeaker: PodcastSpeaker = {
      id: editingSpeakerId ?? `speaker-${Date.now()}`,
      role,
      name,
      voice: selectedVoice?.key ?? voice,
      image,
    };
    setSpeakers((current) =>
      editingSpeakerId
        ? current.map((item) => (item.id === editingSpeakerId ? nextSpeaker : item))
        : [...current, nextSpeaker],
    );
    setActiveSpeakerId(nextSpeaker.id);
    setSpeakerDialogOpen(false);
    setSpeakerFormError(null);
  };

  const requestRemoveSpeaker = () => {
    if (!editingSpeakerId) return;
    if (speakers.length <= MIN_PODCAST_SPEAKERS) {
      setSpeakerFormError("Podcast ต้องมีผู้พูดอย่างน้อย 2 คน");
      return;
    }
    setSpeakerDeleteConfirmOpen(true);
  };

  const confirmRemoveSpeaker = () => {
    if (!editingSpeakerId) return;
    const nextSpeakers = speakers.filter((speaker) => speaker.id !== editingSpeakerId);
    const fallbackSpeaker = nextSpeakers[0];
    if (!fallbackSpeaker) {
      setSpeakerDeleteConfirmOpen(false);
      return;
    }
    setSpeakers(nextSpeakers);
    setLines((current) =>
      current.map((line) => (line.speakerId === editingSpeakerId ? { ...line, speakerId: fallbackSpeaker.id } : line)),
    );
    setActiveSpeakerId((current) => (current === editingSpeakerId ? fallbackSpeaker.id : current));
    setSpeakerDeleteConfirmOpen(false);
    setSpeakerDialogOpen(false);
    setSpeakerFormError(null);
  };

  const addLine = () =>
    setLines((current) => [
      ...current,
      {
        id: `line-${Date.now()}`,
        speakerId: activeSpeakerId || speakers[0]!.id,
        text: "เพิ่มบทพูดสำหรับบรรทัดนี้",
      },
    ]);
  const updateLine = (id: string, changes: Partial<PodcastLine>) =>
    setLines((current) => current.map((line) => (line.id === id ? { ...line, ...changes } : line)));
  const duplicateLine = (line: PodcastLine) =>
    setLines((current) => {
      const index = current.findIndex((item) => item.id === line.id);
      const copy = { ...line, id: `line-${Date.now()}` };
      return [...current.slice(0, index + 1), copy, ...current.slice(index + 1)];
    });
  const removeLine = (id: string) =>
    setLines((current) => (current.length > 1 ? current.filter((line) => line.id !== id) : current));
  const toggleVoicePreview = async (voice: AudioVoice) => {
    const audio = voicePreviewAudioRef.current ?? new Audio();
    voicePreviewAudioRef.current = audio;
    if (previewingVoiceKey === voice.key && !audio.paused) {
      audio.pause();
      setPreviewingVoiceKey(null);
      return;
    }
    audio.pause();
    setVoicePreviewError(null);
    setPreviewLoadingVoiceKey(voice.key);
    try {
      let previewUrl = voice.previewUrl;
      if (!previewUrl) {
        const result = await previewAudioVoice(voice.key, {
          text: "สวัสดีค่ะ นี่คือตัวอย่างเสียงสำหรับพอดแคสต์ของ EOS Creative Studio",
        });
        previewUrl = URL.createObjectURL(result.blob);
        voicePreviewObjectUrlsRef.current.push(previewUrl);
        setAvailableVoices((current) =>
          current.map((item) => (item.key === voice.key ? { ...item, previewUrl } : item)),
        );
      }
      // Imperative playback control on a cached Audio() element (also paused by an
      // unmount-only cleanup effect above) — not a render-phase mutation.
      // eslint-disable-next-line react-hooks/immutability
      audio.src = previewUrl;
      audio.onended = () => setPreviewingVoiceKey(null);
      setPreviewingVoiceKey(voice.key);
      await audio.play();
    } catch (cause) {
      setPreviewingVoiceKey(null);
      setVoicePreviewError(cause instanceof Error ? cause.message : "ฟังตัวอย่างเสียงไม่สำเร็จ");
    } finally {
      setPreviewLoadingVoiceKey(null);
    }
  };
  const draftVoice = availableVoices.find(
    (voice) => voice.key === speakerDraft.voice || voice.name === speakerDraft.voice,
  );
  const togglePreview = async () => {
    if (!audioUrl) {
      await handleGenerate();
      return;
    }
    const audio = previewAudioRef.current;
    if (!audio) return;
    if (audio.paused) await audio.play();
    else audio.pause();
  };
  const downloadAudio = () => {
    if (!audioUrl) return;
    const link = document.createElement("a");
    link.href = audioUrl;
    link.download = `podcast-episode-01.${outputFormat}`;
    link.click();
  };

  const playPodcastHistory = async (item: AudioHistoryItem) => {
    const audio = previewAudioRef.current;
    if (item.url && item.url === audioUrl && audio) {
      if (audio.paused) await audio.play().catch(() => undefined);
      else audio.pause();
      return;
    }
    setPodcastHistoryLoadingId(item.id);
    setError(null);
    try {
      let nextUrl = item.url;
      if (!nextUrl) {
        const result = await fetchAudioHistoryAudio(item.id);
        nextUrl = URL.createObjectURL(result.blob);
        const nextHistory = podcastHistoryRef.current.map((historyItem) =>
          historyItem.id === item.id ? { ...historyItem, url: nextUrl, localUrl: true } : historyItem,
        );
        podcastHistoryRef.current = nextHistory;
        setPodcastHistory(nextHistory);
      }
      setAudioUrl(nextUrl);
      setPreviewProgress(0);
      setPreviewCurrentTime(0);
      setPreviewDuration(0);
      setStatus("ready");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load saved podcast");
    } finally {
      setPodcastHistoryLoadingId(null);
    }
  };

  const removePodcastHistory = (item: AudioHistoryItem) => {
    setPendingPodcastHistoryDelete(item);
  };

  const confirmRemovePodcastHistory = () => {
    const item = pendingPodcastHistoryDelete;
    if (!item) return;
    setPendingPodcastHistoryDelete(null);
    const removeFromView = () => {
      if (item.localUrl && item.url) URL.revokeObjectURL(item.url);
      const nextHistory = podcastHistoryRef.current.filter((historyItem) => historyItem.id !== item.id);
      podcastHistoryRef.current = nextHistory;
      setPodcastHistory(nextHistory);
      if (item.url && item.url === audioUrl) {
        previewAudioRef.current?.pause();
        setAudioUrl(null);
        setPreviewProgress(0);
        setPreviewCurrentTime(0);
        setPreviewDuration(0);
        setIsPlaying(false);
        setStatus("idle");
      }
    };
    if (!item.persisted) {
      removeFromView();
      return;
    }
    void deleteAudioHistory(item.id)
      .then(removeFromView)
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "Unable to delete saved podcast");
      });
  };

  return (
    <div className={styles.podcastLayout}>
      <main className={styles.podcastMainColumn}>
        <section className={styles.podcastHeaderSection}>
          <div className={styles.podcastTitleGroup}>
            <div className={styles.podcastTitleIcon}>
              <Sparkles size={21} />
            </div>
            <div>
              <span className={styles.podcastEyebrow}>{t("create.audio.podcast.eyebrow")}</span>
              <h1>{t("create.audio.podcast.title")}</h1>
              <p>{t("create.audio.podcast.subtitle")}</p>
            </div>
          </div>
        </section>

        <section className={styles.podcastSection} aria-label={t("create.audio.podcast.a11y.speakers")}>
          <div className={styles.podcastSectionHeader}>
            <h2>{t("create.audio.podcast.speakers")}</h2>
            <span>{t("create.audio.podcast.peopleCount", { count: speakers.length })}</span>
          </div>
          <div className={styles.podcastSpeakerRow}>
            {speakers.map((speaker, index) => (
              <div className={styles.podcastSpeakerCardWrap} key={speaker.id}>
                <button
                  type="button"
                  className={`${styles.podcastSpeakerCard} ${activeSpeakerId === speaker.id ? styles.podcastSpeakerCardActive : ""}`}
                  onClick={() => setActiveSpeakerId(speaker.id)}
                  aria-pressed={activeSpeakerId === speaker.id}
                >
                  <span className={styles.podcastSpeakerAvatar}>
                    {!voicesLoading && speaker.image ? (
                      <Image src={speaker.image} alt="" fill unoptimized sizes="54px" />
                    ) : null}
                  </span>
                  <span className={styles.podcastSpeakerCopy}>
                    <small>{speaker.role}</small>
                    <strong>{speaker.name}</strong>
                    <em>
                      {availableVoices.find((voice) => voice.key === speaker.voice || voice.name === speaker.voice)
                        ?.name ?? speaker.voice}
                    </em>
                  </span>
                  <i data-tone={podcastSpeakerTones[index % podcastSpeakerTones.length]} />
                </button>
                <button
                  type="button"
                  className={styles.podcastSpeakerEditButton}
                  onClick={(event) => {
                    event.stopPropagation();
                    openSpeakerDialog(speaker);
                  }}
                  aria-label={`แก้ไขผู้พูด ${speaker.name}`}
                >
                  <Pencil size={11} />
                </button>
              </div>
            ))}
            <button type="button" className={styles.podcastAddSpeakerCard} onClick={() => openSpeakerDialog()}>
              <Plus size={18} />
              <span>{t("create.audio.podcast.addSpeaker")}</span>
            </button>
          </div>
        </section>

        <section className={styles.podcastSection} aria-label={t("create.audio.podcast.a11y.dialogue")}>
          <div className={styles.podcastSectionHeader}>
            <h2>{t("create.audio.podcast.dialogue")}</h2>
            <span>
              {t("create.audio.podcast.lineCount", { count: lines.length })} · {formatSceneSeconds(totalDuration)} ·{" "}
              {dialogueCharacterCount.toLocaleString()} / {dialogueCharacterLimit.toLocaleString()} ตัวอักษร
            </span>
          </div>
          <div className={styles.podcastLineList}>
            {lines.map((line, index) => {
              const speaker = speakers.find((item) => item.id === line.speakerId) ?? speakers[0]!;
              const speakerIndex = Math.max(
                0,
                speakers.findIndex((item) => item.id === speaker.id),
              );
              const speakerTone = podcastSpeakerTones[speakerIndex % podcastSpeakerTones.length];
              const start = lines
                .slice(0, index)
                .reduce((total, item) => total + estimatePodcastLineSeconds(item.text), 0);
              return (
                <div
                  className={`${styles.podcastLineRow} ${index === 0 ? styles.podcastLineRowActive : ""}`}
                  key={line.id}
                >
                  <span className={styles.podcastLineAvatar}>
                    {!voicesLoading && speaker.image ? (
                      <Image src={speaker.image} alt="" fill unoptimized sizes="34px" />
                    ) : null}
                  </span>
                  <time>{formatSceneSeconds(start)}</time>
                  <div className={styles.podcastLineSpeakerDropdown} data-tone={speakerTone}>
                    <Dropdown
                      value={line.speakerId}
                      options={speakers.map((option, optionIndex) => ({
                        value: option.id,
                        label: (
                          <span className={styles.podcastLineSpeakerLabel}>
                            <span
                              className={styles.podcastSpeakerDot}
                              data-tone={podcastSpeakerTones[optionIndex % podcastSpeakerTones.length]}
                              aria-hidden="true"
                            />
                            {option.role}
                          </span>
                        ),
                      }))}
                      onChange={(value) => updateLine(line.id, { speakerId: value })}
                      ariaLabel={`เลือกผู้พูดสำหรับบรรทัดที่ ${index + 1}`}
                      className={styles.podcastLineSpeakerDropdownControl}
                      triggerClassName={styles.podcastLineSpeakerTrigger}
                      menuClassName={styles.podcastLineSpeakerMenu}
                      optionClassName={styles.podcastLineSpeakerOption}
                      menuPosition="fixed"
                    />
                  </div>
                  <input
                    className={styles.podcastLineInput}
                    value={line.text}
                    onChange={(event) => updateLine(line.id, { text: event.target.value })}
                    aria-label={t("create.audio.podcast.a11y.line", { index: index + 1 })}
                  />
                  <button
                    type="button"
                    className={`${styles.podcastLineAction} ${styles.podcastLineCopyAction}`}
                    onClick={() => duplicateLine(line)}
                    aria-label={t("create.audio.podcast.a11y.duplicateLine", { index: index + 1 })}
                  >
                    <Copy size={15} />
                  </button>
                  <button
                    type="button"
                    className={styles.podcastLineActionDanger}
                    onClick={() => removeLine(line.id)}
                    disabled={lines.length <= 1}
                    aria-label={t("create.audio.podcast.a11y.deleteLine", { index: index + 1 })}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              );
            })}
          </div>
          <button type="button" className={styles.podcastAddLine} onClick={addLine}>
            <Plus size={15} /> {t("create.audio.podcast.addNextLine")}
          </button>
          {dialogueCharacterCount > dialogueCharacterLimit ? (
            <p className={styles.podcastCharacterWarning} role="alert">
              บทสนทนายาวเกิน {dialogueCharacterLimit.toLocaleString()} ตัวอักษร กรุณาแบ่งเป็นตอนย่อยก่อนสร้าง
            </p>
          ) : null}
        </section>

        {(status === "ready" && audioUrl) || status === "error" ? (
          <section className={styles.podcastPreviewCard} aria-label={t("create.audio.podcast.a11y.preview")}>
            <div className={styles.podcastSectionHeader}>
              <h2>
                {t("create.audio.podcast.audioPreview")} <span className={styles.podcastBeta}>Beta</span>
              </h2>
              <div className={styles.podcastPreviewActions}>
                {status === "error" ? (
                  <button type="button" className={styles.podcastToolbarButton} onClick={() => void handleGenerate()}>
                    <RotateCcw size={15} /> ลองอีกครั้ง
                  </button>
                ) : null}
                <button
                  type="button"
                  className={styles.podcastToolbarButton}
                  onClick={downloadAudio}
                  disabled={!audioUrl}
                >
                  <Download size={15} /> {t("create.audio.download")}
                </button>
              </div>
            </div>
            <div className={styles.podcastAudioPlayer}>
              <button type="button" className={styles.podcastPlayButton} onClick={() => void togglePreview()}>
                <span>
                  {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
                </span>
              </button>
              <div className={styles.podcastWaveformWrap}>
                <PreviewWaveform audioUrl={audioUrl} progress={previewProgress} isPlaying={isPlaying} />
                <div className={styles.podcastAudioMeta}>
                  <span>
                    {formatSceneSeconds(previewCurrentTime)} / {formatSceneSeconds(previewDuration || totalDuration)}
                  </span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={previewProgress}
                    onChange={(event) => {
                      const nextProgress = Number(event.target.value);
                      setPreviewProgress(nextProgress);
                      if (previewAudioRef.current && previewDuration)
                        previewAudioRef.current.currentTime = (nextProgress / 100) * previewDuration;
                    }}
                    aria-label={t("create.audio.a11y.audioProgress")}
                    disabled={!audioUrl}
                  />
                </div>
              </div>
              <Volume2 size={16} className={styles.podcastVolumeIcon} />
              <input
                className={styles.podcastVolumeSlider}
                type="range"
                min="0"
                max="100"
                value={volume}
                onChange={(event) => {
                  const nextVolume = Number(event.target.value);
                  setVolume(nextVolume);
                  if (previewAudioRef.current) previewAudioRef.current.volume = nextVolume / 100;
                }}
                aria-label={t("create.audio.a11y.volume")}
              />
              <audio
                ref={previewAudioRef}
                src={audioUrl ?? undefined}
                preload="metadata"
                onLoadedMetadata={(event) => {
                  setPreviewDuration(event.currentTarget.duration);
                  event.currentTarget.volume = volume / 100;
                }}
                onTimeUpdate={(event) => {
                  const current = event.currentTarget.currentTime;
                  const duration = event.currentTarget.duration || previewDuration;
                  setPreviewCurrentTime(current);
                  setPreviewProgress(duration ? (current / duration) * 100 : 0);
                }}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => {
                  setIsPlaying(false);
                  setPreviewProgress(100);
                }}
              />
            </div>
            {status === "error" || error ? (
              <p className={styles.podcastError} role="alert">
                {error}
              </p>
            ) : null}
          </section>
        ) : null}

        <section className={styles.historyPanel} aria-label={t("create.audio.a11y.historyPanel")}>
          <div className={styles.sectionHeading}>
            <h2>
              <History size={13} /> {t("create.audio.generationHistory")}
            </h2>
            <span className={styles.timelineHint}>
              {podcastHistory.length
                ? podcastHistory.length === 1
                  ? t("create.audio.resultCountOne")
                  : t("create.audio.resultCountMany", { count: podcastHistory.length })
                : t("create.audio.noResults")}
            </span>
          </div>
          {podcastHistory.length ? (
            <div className={styles.historyList}>
              {podcastHistory.map((item) => (
                <div
                  key={item.id}
                  className={item.url === audioUrl ? styles.historyItemRowActive : styles.historyItemRow}
                >
                  <button
                    type="button"
                    className={item.url === audioUrl ? styles.historyItemActive : styles.historyItem}
                    onClick={() => void playPodcastHistory(item)}
                    disabled={podcastHistoryLoadingId === item.id}
                    aria-busy={podcastHistoryLoadingId === item.id}
                  >
                    <span className={podcastHistoryLoadingId === item.id ? styles.historyLoading : styles.historyPlay}>
                      {podcastHistoryLoadingId === item.id ? null : isPlaying && item.url === audioUrl ? (
                        <Pause size={13} fill="currentColor" />
                      ) : (
                        <Play size={13} fill="currentColor" />
                      )}
                    </span>
                    <span className={styles.historyCopy}>
                      <strong>{item.label}</strong>
                      <small>{formatAudioHistoryDate(item.createdAt, locale)}</small>
                    </span>
                    <span className={styles.historyCurrent}>
                      {item.url === audioUrl ? t("create.audio.historyCurrent") : t("create.audio.historyPlay")}
                    </span>
                  </button>
                  <button
                    type="button"
                    className={styles.historyDelete}
                    aria-label={t("create.audio.a11y.deleteItem", { label: item.label })}
                    onClick={() => removePodcastHistory(item)}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.historyEmpty}>
              <History size={15} />
              <span>{t("create.audio.historyEmpty")}</span>
            </div>
          )}
        </section>
      </main>

      <aside className={styles.podcastSettingsCard} aria-label={t("create.audio.podcast.a11y.settings")}>
        <div className={styles.podcastSettingsHeader}>
          <h2>{t("create.audio.podcast.settings")}</h2>
          <AudioWaveform size={18} />
        </div>
        <div className={styles.podcastSettingGroup}>
          <span className={styles.podcastFieldLabel}>{t("create.audio.podcast.outputFormat")}</span>
          <div className={styles.podcastFormatRow}>
            {(["mp3", "wav", "ogg"] as const).map((format) => (
              <button
                type="button"
                key={format}
                className={outputFormat === format ? styles.podcastFormatActive : styles.podcastFormatButton}
                onClick={() => setOutputFormat(format)}
              >
                {format.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <div className={styles.podcastSelectField}>
          <span className={styles.podcastFieldLabel}>{t("create.audio.podcast.language")}</span>
          <Dropdown
            value={language}
            options={[
              { value: "Thai (ไทย)", label: "Thai (ไทย)" },
              { value: "English (US)", label: "English (US)" },
              { value: "English (UK)", label: "English (UK)" },
            ]}
            onChange={setLanguage}
            ariaLabel={t("create.audio.podcast.language")}
            className={styles.podcastDropdown}
            triggerClassName={styles.podcastDropdownTrigger}
            menuClassName={styles.podcastDropdownMenu}
            optionClassName={styles.podcastDropdownOption}
          />
        </div>
        <div className={styles.podcastSelectField}>
          <span className={styles.podcastFieldLabel}>{t("create.audio.podcast.speakingStyle")}</span>
          <Dropdown
            value={speakingStyle}
            options={[
              { value: "Interview", label: t("create.audio.podcast.styleConversational") },
              { value: "Roundtable", label: t("create.audio.podcast.styleRoundtable") },
              { value: "Storytelling", label: t("create.audio.podcast.styleStorytelling") },
            ]}
            onChange={(value) => setSpeakingStyle(value as typeof speakingStyle)}
            ariaLabel={t("create.audio.podcast.speakingStyle")}
            className={styles.podcastDropdown}
            triggerClassName={styles.podcastDropdownTrigger}
            menuClassName={styles.podcastDropdownMenu}
            optionClassName={styles.podcastDropdownOption}
          />
        </div>
        <div className={styles.podcastSettingGroup}>
          <div className={styles.podcastSpeedHeader}>
            <span className={styles.podcastFieldLabel}>{t("create.audio.podcast.pacing")}</span>
            <b>{speed.toFixed(2)}x</b>
          </div>
          <input
            className={styles.podcastSpeedSlider}
            type="range"
            min="0.5"
            max="2"
            step="0.05"
            value={speed}
            onChange={(event) => setSpeed(Number(event.target.value))}
          />
          <div className={styles.podcastSpeedLabels}>
            <span>0.5x</span>
            <span>1x</span>
            <span>1.5x</span>
            <span>2x</span>
          </div>
        </div>
        <div className={styles.podcastToggleGroup}>
          <label>
            <span>
              <strong>{t("create.audio.podcast.normalizeAudio")}</strong>
              <small>ปรับระดับเสียงให้สม่ำเสมอ</small>
            </span>
            <button
              type="button"
              className={normalizeAudio ? styles.podcastToggleOn : styles.podcastToggleOff}
              onClick={() => setNormalizeAudio((current) => !current)}
              aria-pressed={normalizeAudio}
            >
              <i />
            </button>
          </label>
          <label>
            <span>
              <strong>{t("create.audio.podcast.backgroundMusic")}</strong>
              <small>เพิ่มเพลงประกอบระหว่างบทพูด</small>
            </span>
            <button
              type="button"
              className={backgroundMusic ? styles.podcastToggleOn : styles.podcastToggleOff}
              onClick={() => setBackgroundMusic((current) => !current)}
              aria-pressed={backgroundMusic}
              disabled={backgroundMusicLoading || backgroundMusicPresets.length === 0}
            >
              <i />
            </button>
          </label>
          {backgroundMusic ? (
            <div className={styles.podcastMusicSelectField}>
              <span className={styles.podcastFieldLabel}>เพลงประกอบ</span>
              <Dropdown
                value={backgroundMusicPreset}
                options={backgroundMusicPresets.map((preset) => ({ value: preset.key, label: preset.name }))}
                onChange={setBackgroundMusicPreset}
                ariaLabel="เพลงประกอบ"
                disabled={backgroundMusicLoading || backgroundMusicPresets.length === 0}
                loading={backgroundMusicLoading}
                placeholder={backgroundMusicLoading ? "กำลังโหลดเพลง…" : "ยังไม่มีเพลงที่ใช้งานได้"}
                className={styles.podcastDropdown}
                triggerClassName={styles.podcastMusicDropdownTrigger}
                menuClassName={styles.podcastDropdownMenu}
                optionClassName={styles.podcastDropdownOption}
              />
            </div>
          ) : null}
        </div>
        <div data-mobile-action-dock className={styles.mobileActionDock}>
          <div className={styles.creditEstimate} title={creditEstimateError ?? undefined}>
            <div className={styles.creditEstimateHeader}>
              <strong>
                {t("create.audio.estimatedCredits")}{" "}
                <InfoTooltip content={t("create.audio.info.estimatedCredits")} size={11} />
              </strong>
              <b>
                {creditEstimateLoading
                  ? t("create.audio.calculating")
                  : creditEstimate
                    ? t("create.audio.creditsAmount", { amount: formatCreditAmount(creditEstimate.creditCost) })
                    : "—"}
              </b>
            </div>
            <p className={styles.creditEstimateCount}>{t("create.audio.audioCount")}</p>
          </div>
          <button
            type="button"
            className={styles.generateButton}
            onClick={() => void handleGenerate()}
            disabled={
              status === "generating" ||
              speakers.length < MIN_PODCAST_SPEAKERS ||
              !episodeScript.trim() ||
              creditEstimateLoading ||
              !creditEstimate
            }
          >
            {status === "generating" ? t("create.audio.generating") : t("create.audio.generateAudio")}{" "}
            <Sparkles size={17} />
          </button>
          <p className={styles.podcastSecurityNote}>
            <LockKeyhole size={11} /> {t("create.audio.privateSecure")}
          </p>
        </div>
      </aside>
      <Dialog
        open={speakerDialogOpen}
        onOpenChange={(open) => {
          setSpeakerDialogOpen(open);
          if (!open) setSpeakerFormError(null);
        }}
      >
        <DialogContent className={styles.podcastSpeakerDialog}>
          <DialogHeader className={styles.podcastSpeakerDialogHeader}>
            <DialogTitle>{editingSpeakerId ? "แก้ไขผู้พูด" : "เพิ่มผู้พูด"}</DialogTitle>
            <DialogDescription>กำหนดบทบาท ชื่อ และเสียงสำหรับบทสนทนา</DialogDescription>
          </DialogHeader>
          <div className={styles.podcastSpeakerForm}>
            <label>
              <span>บทบาท / ประเภทผู้พูด</span>
              <input
                value={speakerDraft.role}
                onChange={(event) => setSpeakerDraft((current) => ({ ...current, role: event.target.value }))}
                placeholder="เช่น แขกรับเชิญ, ผู้เชี่ยวชาญ"
                maxLength={80}
                autoFocus
              />
            </label>
            <label>
              <span>ชื่อผู้พูด</span>
              <input
                value={speakerDraft.name}
                onChange={(event) => setSpeakerDraft((current) => ({ ...current, name: event.target.value }))}
                placeholder="เช่น คุณสมชาย"
                maxLength={80}
              />
            </label>
            <div>
              <span>เสียง</span>
              <Dropdown
                value={speakerDraft.voice}
                options={availableVoices.map((voice) => ({ value: voice.key, label: voice.name }))}
                onChange={(value) => setSpeakerDraft((current) => ({ ...current, voice: value }))}
                ariaLabel="เสียงผู้พูด"
                disabled={voicesLoading || availableVoices.length === 0}
                loading={voicesLoading}
                placeholder={voicesLoading ? "กำลังโหลดเสียง…" : "ยังไม่มีเสียงให้เลือก"}
                className={styles.podcastSpeakerDialogDropdown}
                triggerClassName={styles.podcastSpeakerDialogDropdownTrigger}
                menuClassName={styles.podcastDropdownMenu}
                optionClassName={styles.podcastDropdownOption}
                menuPosition="fixed"
              />
            </div>
            <div className={styles.podcastSpeakerDialogPreview}>
              <span className={styles.podcastSpeakerDialogVoiceImage}>
                {draftVoice?.imageUrl ? <Image src={draftVoice.imageUrl} alt="" fill unoptimized sizes="34px" /> : null}
              </span>
              <span className={styles.podcastSpeakerDialogVoiceCopy}>
                <strong>{draftVoice?.name ?? "ยังไม่ได้เลือกเสียง"}</strong>
                <small>{draftVoice?.description || "เลือกเสียงเพื่อฟังตัวอย่าง"}</small>
              </span>
              <button
                type="button"
                className={styles.podcastVoicePreviewButton}
                onClick={() => draftVoice && void toggleVoicePreview(draftVoice)}
                disabled={!draftVoice || voicesLoading || previewLoadingVoiceKey === draftVoice?.key}
              >
                {previewingVoiceKey === draftVoice?.key ? <Pause size={14} /> : <Play size={14} fill="currentColor" />}
                {previewLoadingVoiceKey === draftVoice?.key
                  ? "กำลังโหลด"
                  : previewingVoiceKey === draftVoice?.key
                    ? "หยุด"
                    : "Preview"}
              </button>
            </div>
            {voicePreviewError ? (
              <p className={styles.podcastSpeakerFormError} role="alert">
                {voicePreviewError}
              </p>
            ) : null}
            {speakerFormError ? (
              <p className={styles.podcastSpeakerFormError} role="alert">
                {speakerFormError}
              </p>
            ) : null}
          </div>
          <DialogFooter className={styles.podcastSpeakerDialogFooter}>
            {editingSpeakerId ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className={styles.podcastSpeakerDialogDeleteButton}
                onClick={requestRemoveSpeaker}
              >
                <Trash2 size={14} /> ลบผู้พูด
              </Button>
            ) : null}
            <Button type="button" variant="ghost" onClick={() => setSpeakerDialogOpen(false)}>
              ยกเลิก
            </Button>
            <Button type="button" className={styles.podcastSpeakerDialogSaveButton} onClick={saveSpeaker}>
              บันทึกผู้พูด
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <PodcastConfirmationDialog
        open={speakerDeleteConfirmOpen}
        onOpenChange={setSpeakerDeleteConfirmOpen}
        title="ลบผู้พูดนี้หรือไม่?"
        description={`ผู้พูด “${speakerDraft.name || speakerDraft.role}” จะถูกลบออกจากบทสนทนา และบรรทัดของผู้พูดนี้จะย้ายไปยังผู้พูดคนแรก`}
        onConfirm={confirmRemoveSpeaker}
      />
      <PodcastConfirmationDialog
        open={Boolean(pendingPodcastHistoryDelete)}
        onOpenChange={(open) => {
          if (!open) setPendingPodcastHistoryDelete(null);
        }}
        title="ลบประวัติการสร้างหรือไม่?"
        description={`“${pendingPodcastHistoryDelete?.label ?? "รายการนี้"}” จะถูกลบออกจากประวัติการสร้างและกู้คืนไม่ได้`}
        onConfirm={confirmRemovePodcastHistory}
      />
    </div>
  );
}

function estimatePodcastLineSeconds(text: string): number {
  return Math.max(1, Math.round((text.trim().length / 18) * 10) / 10);
}

function VoiceCloneLayout({ onHistorySaved }: { onHistorySaved?: SaveHistoryCallback }) {
  const { t } = useLocale();
  const [sampleReady, setSampleReady] = useState(false);
  const [sampleFile, setSampleFile] = useState<File | null>(null);
  const [voiceName, setVoiceName] = useState("");
  const [character, setCharacter] = useState("Natural");
  const [consent, setConsent] = useState(true);
  const [voiceId, setVoiceId] = useState<string | null>(null);
  const [testPhrase, setTestPhrase] = useState("นี่คือตัวอย่างเสียงภาษาไทยสำหรับตรวจสอบโทนเสียงและคุณภาพการพูด");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "creating" | "ready" | "previewing" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [isSampleDragging, setIsSampleDragging] = useState(false);
  const [referenceText, setReferenceText] = useState("");
  const [speed, setSpeed] = useState(1);
  const [pitch, setPitch] = useState(0);
  const [synthVolume, setSynthVolume] = useState(1);
  const [emotion, setEmotion] = useState("neutral");
  const [language, setLanguage] = useState("Thai");
  const [pronunciation, setPronunciation] = useState("");
  const [accuracy, setAccuracy] = useState(0.7);
  const [needNoiseReduction, setNeedNoiseReduction] = useState(false);
  const [needVolumeNormalization, setNeedVolumeNormalization] = useState(true);
  const [englishNormalization, setEnglishNormalization] = useState(false);
  const [sampleRate, setSampleRate] = useState("32000");
  const [bitrate, setBitrate] = useState("128000");
  const [channel, setChannel] = useState("1");
  const [outputFormat, setOutputFormat] = useState<"mp3" | "wav" | "ogg">("mp3");
  const [previewModel, setPreviewModel] = useState(VOICE_CLONE_MODEL_ID);
  const [savedVoices, setSavedVoices] = useState<VoiceCloneListItem[]>([]);
  const [deleteConfirmVoice, setDeleteConfirmVoice] = useState<VoiceCloneListItem | null>(null);
  const [creditQuote, setCreditQuote] = useState<VoiceCloneQuote | null>(null);
  const [creditQuoteLoading, setCreditQuoteLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(80);
  const sampleInputRef = useRef<HTMLInputElement>(null);
  const previewAudioRef = useRef<HTMLAudioElement>(null);
  const durationRef = useRef(0);

  useEffect(
    () => () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    },
    [audioUrl],
  );

  useEffect(() => {
    if (!audioUrl) return undefined;
    const timer = window.setTimeout(() => {
      void previewAudioRef.current
        ?.play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [audioUrl]);

  const refreshSavedVoices = useCallback(async () => {
    try {
      const result = await listVoiceClones();
      setSavedVoices(result.voices);
    } catch {
      // Saved-voices list is a convenience; ignore load failures silently.
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void refreshSavedVoices(), 0);
    return () => window.clearTimeout(timer);
  }, [refreshSavedVoices]);

  useEffect(() => {
    let active = true;
    const text = testPhrase.trim();
    if (!text) {
      const resetTimer = window.setTimeout(() => {
        if (!active) return;
        setCreditQuote(null);
        setCreditQuoteLoading(false);
      }, 0);
      return () => {
        active = false;
        window.clearTimeout(resetTimer);
      };
    }
    const timer = window.setTimeout(() => {
      setCreditQuoteLoading(true);
      void quoteVoiceClone(text)
        .then((quote) => {
          if (active) setCreditQuote(quote);
        })
        .catch(() => {
          if (active) setCreditQuote(null);
        })
        .finally(() => {
          if (active) setCreditQuoteLoading(false);
        });
    }, 400);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [testPhrase]);

  const translateError = (message: string): string => {
    const known: Record<string, string> = {
      "Voice clone not found": t("create.audio.clone.error.notFound"),
      "Voice permission confirmation is required": t("create.audio.clone.error.noConsent"),
      "At least one voice sample is required": t("create.audio.clone.error.noSample"),
      "Voice samples must be valid audio files": t("create.audio.clone.error.invalidFile"),
      "Voice Clone is not routed to WaveSpeed": t("create.audio.clone.error.notConfigured"),
    };
    return known[message] ?? `${t("create.audio.clone.error.generic")}: ${message}`;
  };

  const handleSample = (file: File | undefined) => {
    if (!file) return;
    setSampleFile(file);
    setSampleReady(true);
    setVoiceId(null);
    setStatus("idle");
  };
  const handleSampleDrop = (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    setIsSampleDragging(false);
    handleSample(event.dataTransfer.files?.[0]);
  };

  const handleCreate = async () => {
    if (!sampleFile) {
      setError(t("create.audio.clone.error.noSample"));
      setStatus("error");
      return;
    }
    if (!consent) {
      setError(t("create.audio.clone.error.noConsent"));
      setStatus("error");
      return;
    }
    setStatus("creating");
    setError(null);
    try {
      const result = await createVoiceClone({
        name: voiceName,
        character,
        consentConfirmed: consent,
        files: [sampleFile],
        referenceText: referenceText.trim() || undefined,
      });
      setVoiceId(result.voiceId);
      setStatus("ready");
      void refreshSavedVoices();
    } catch (cause) {
      setError(cause instanceof Error ? translateError(cause.message) : t("create.audio.clone.error.createFailed"));
      setStatus("error");
    }
  };

  const handlePreview = async () => {
    if (!voiceId) {
      setError(t("create.audio.clone.error.noVoiceSelected"));
      setStatus("error");
      return;
    }
    setStatus("previewing");
    setError(null);
    try {
      const result = await previewVoiceClone(voiceId, {
        text: testPhrase,
        outputFormat,
        speed,
        modelId: previewModel,
        ...(previewModel === "minimax/speech-2.8-hd"
          ? {
              pitch,
              volume: synthVolume,
              emotion,
              languageBoost: language,
              englishNormalization,
              sampleRate: Number(sampleRate),
              bitrate: Number(bitrate),
              channel,
            }
          : {}),
        ...(previewModel === "minimax/voice-clone"
          ? {
              accuracy,
              needNoiseReduction,
              needVolumeNormalization,
              languageBoost: language,
            }
          : {}),
        ...(pronunciation.trim() ? { pronunciationHint: pronunciation.trim() } : {}),
      });
      const nextUrl = URL.createObjectURL(result.blob);
      setAudioUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return nextUrl;
      });
      durationRef.current = 0;
      setDuration(0);
      setCurrentTime(0);
      setProgress(0);
      setIsPlaying(false);
      void onHistorySaved?.({
        audio: result.blob,
        feature: "voice-clone",
        label: `${voiceName} preview`,
        outputFormat,
        voice: voiceId,
        metadata: { character },
      });
      setStatus("ready");
    } catch (cause) {
      setError(cause instanceof Error ? translateError(cause.message) : t("create.audio.clone.error.previewFailed"));
      setStatus("error");
    }
  };

  const downloadPreview = () => {
    if (!audioUrl) return;
    const link = document.createElement("a");
    link.href = audioUrl;
    link.download = `${voiceName || "voice-clone"}-preview.${outputFormat}`;
    link.click();
  };

  const togglePlayback = () => {
    const audio = previewAudioRef.current;
    if (!audioUrl || !audio) return;
    if (audio.paused)
      void audio
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    else {
      audio.pause();
      setIsPlaying(false);
    }
  };

  const seekBy = (amount: number) => {
    if (!previewAudioRef.current) return;
    const audioDuration = durationRef.current || duration;
    previewAudioRef.current.currentTime = Math.max(
      0,
      Math.min(audioDuration, previewAudioRef.current.currentTime + amount),
    );
  };

  const syncAudioDuration = (audio: HTMLAudioElement) => {
    const nextDuration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0;
    if (!nextDuration) return;
    durationRef.current = nextDuration;
    setDuration(nextDuration);
    const nextTime = Number.isFinite(audio.currentTime) ? Math.min(audio.currentTime, nextDuration) : 0;
    setCurrentTime(nextTime);
    setProgress(Math.min(100, (nextTime / nextDuration) * 100));
  };

  const handleSelectSavedVoice = (item: VoiceCloneListItem) => {
    if (voiceId === item.voiceId) {
      setVoiceId(null);
      setVoiceName("");
      setStatus("idle");
      setError(null);
      return;
    }
    setVoiceId(item.voiceId);
    setVoiceName(item.name);
    if (item.character) setCharacter(item.character);
    setStatus("ready");
    setError(null);
  };

  const handleDeleteSavedVoice = async (item: VoiceCloneListItem) => {
    try {
      await deleteVoiceClone(item.voiceId);
      if (voiceId === item.voiceId) setVoiceId(null);
      void refreshSavedVoices();
    } catch (cause) {
      setError(cause instanceof Error ? translateError(cause.message) : t("create.audio.clone.error.deleteFailed"));
      setStatus("error");
    } finally {
      setDeleteConfirmVoice(null);
    }
  };

  return (
    <div className={styles.alternateLayout}>
      <section className={`${styles.alternatePanel} ${styles.alternateFormPanel}`}>
        <AlternateHeading
          eyebrow={t("create.audio.clone.eyebrow")}
          title={t("create.audio.clone.title")}
          description={t("create.audio.clone.description")}
          icon={<WandSparkles size={24} />}
        />
        <input
          ref={sampleInputRef}
          hidden
          type="file"
          accept="audio/wav,audio/mpeg,audio/ogg,audio/*"
          onChange={(event) => handleSample(event.target.files?.[0])}
        />
        <button
          type="button"
          className={`${styles.cloneDropzone} ${sampleReady ? styles.cloneDropzoneReady : ""} ${isSampleDragging ? styles.cloneDropzoneDragging : ""}`}
          onClick={() => sampleInputRef.current?.click()}
          onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = "copy";
            setIsSampleDragging(true);
          }}
          onDragLeave={() => setIsSampleDragging(false)}
          onDrop={handleSampleDrop}
        >
          <span className={styles.cloneIcon}>
            <CloudUpload size={23} />
          </span>
          <strong>{sampleReady ? t("create.audio.clone.sampleReady") : t("create.audio.clone.dropSample")}</strong>
          <small>
            {sampleReady
              ? t("create.audio.clone.readyToUpload", { name: sampleFile?.name ?? "sample-voice.wav" })
              : t("create.audio.clone.sampleHint")}
          </small>
          <em>{sampleReady ? t("create.audio.clone.clickToReplace") : t("create.audio.clone.browseFiles")}</em>
        </button>
        <label className={styles.altTextField}>
          <span>{t("create.audio.clone.voiceName")}</span>
          <input value={voiceName} onChange={(event) => setVoiceName(event.target.value)} />
        </label>
        <div className={styles.altFieldGroup}>
          <span className={styles.altFieldLabel}>{t("create.audio.clone.voiceCharacter")}</span>
          <div className={styles.altChoiceRow}>
            {(
              [
                ["Natural", "create.audio.clone.characterNatural"],
                ["Cinematic", "create.audio.clone.characterCinematic"],
                ["Expressive", "create.audio.clone.characterExpressive"],
              ] as const
            ).map(([item, labelKey]) => (
              <button
                type="button"
                key={item}
                className={character === item ? styles.altChoiceActive : styles.altChoice}
                onClick={() => setCharacter(item)}
              >
                {t(labelKey)}
              </button>
            ))}
          </div>
        </div>
        <label className={styles.altTextField}>
          <span>{t("create.audio.clone.referenceText")}</span>
          <input
            value={referenceText}
            onChange={(event) => setReferenceText(event.target.value)}
            placeholder={t("create.audio.clone.referenceTextPlaceholder")}
          />
        </label>
        <label className={styles.altConsent}>
          <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />{" "}
          {t("create.audio.clone.consent")}
        </label>
        <section className={styles.historyPanel}>
          <div className={styles.sectionHeading}>
            <h2>
              <Mic2 size={13} /> {t("create.audio.clone.savedVoices")}
            </h2>
            <span className={styles.timelineHint}>
              {savedVoices.length
                ? savedVoices.length === 1
                  ? t("create.audio.resultCountOne")
                  : t("create.audio.resultCountMany", { count: savedVoices.length })
                : t("create.audio.noResults")}
            </span>
          </div>
          {savedVoices.length ? (
            <div className={styles.historyList}>
              {savedVoices.map((item) => (
                <div
                  key={item.id}
                  className={item.voiceId === voiceId ? styles.historyItemRowActive : styles.historyItemRow}
                >
                  <button
                    type="button"
                    className={item.voiceId === voiceId ? styles.historyItemActive : styles.historyItem}
                    onClick={() => handleSelectSavedVoice(item)}
                  >
                    <span className={styles.historyPlay}>
                      <Mic2 size={13} />
                    </span>
                    <span className={styles.historyCopy}>
                      <strong>{item.name}</strong>
                      <small>{item.character || t("create.audio.clone.characterNatural")}</small>
                    </span>
                    <span className={`${styles.historyCurrent} ${styles.savedVoiceStatus}`}>
                      {item.voiceId === voiceId
                        ? t("create.audio.clone.voiceSelected")
                        : t("create.audio.clone.selectVoice")}
                    </span>
                  </button>
                  <button
                    type="button"
                    className={styles.historyDelete}
                    onClick={() => setDeleteConfirmVoice(item)}
                    aria-label={t("create.audio.clone.deleteVoice", { name: item.name })}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.historyEmpty}>
              <Mic2 size={15} />
              <span>{t("create.audio.noResults")}</span>
            </div>
          )}
        </section>
      </section>

      <section className={`${styles.alternatePanel} ${styles.alternateCenterPanel}`}>
        <div className={styles.altPanelHeader}>
          <div>
            <span className={styles.altEyebrow}>{t("create.audio.clone.voicePreview")}</span>
            <h2>{t("create.audio.clone.playground")}</h2>
          </div>
          <span className={styles.altStatus}>
            <span /> {voiceId ? t("create.audio.clone.voiceReady") : t("create.audio.clone.sampleLoaded")}
          </span>
        </div>
        {status === "error" && error ? (
          <p className={styles.podcastError} role="alert">
            {error}
          </p>
        ) : null}
        <div className={styles.clonePreviewCard}>
          <div className={styles.clonePortrait}>
            <Mic2 size={25} />
            <span>EOS</span>
          </div>
          <div>
            <strong>{voiceName}</strong>
            <small>{character}</small>
            <div className={styles.cloneMeta}>
              <span>{t("create.audio.clone.toneWarm")}</span>
              <span>{t("create.audio.clone.toneClear")}</span>
              <span>{t("create.audio.clone.toneStudio")}</span>
            </div>
          </div>
          <button
            type="button"
            className={styles.altRoundButton}
            onClick={() => void handlePreview()}
            disabled={!voiceId || status === "previewing"}
          >
            <Play size={17} fill="currentColor" />
          </button>
        </div>
        {audioUrl ? (
          <div className={styles.previewPanel}>
            <div className={styles.previewHeader}>
              <h2>{t("create.audio.preview")}</h2>
              <div className={styles.previewActions}>
                <button type="button" className={styles.outlineAction} onClick={downloadPreview}>
                  <Download size={15} /> {t("create.audio.download")}
                </button>
              </div>
            </div>
            <PreviewWaveform audioUrl={audioUrl} progress={progress} isPlaying={isPlaying} />
            <div className={styles.playerRow}>
              <button
                type="button"
                className={styles.playButton}
                onClick={togglePlayback}
                aria-label={t(isPlaying ? "create.audio.a11y.pause" : "create.audio.a11y.play")}
              >
                {isPlaying ? <span className={styles.pauseGlyph} /> : <Play size={20} fill="currentColor" />}
              </button>
              <button
                type="button"
                className={styles.skipButton}
                onClick={() => seekBy(-10)}
                aria-label={t("create.audio.a11y.rewind10")}
              >
                <RotateCcw size={17} />
                <small>10</small>
              </button>
              <button
                type="button"
                className={styles.skipButton}
                onClick={() => seekBy(10)}
                aria-label={t("create.audio.a11y.forward10")}
              >
                <RotateCw size={17} />
                <small>10</small>
              </button>
              <span className={styles.timeLabel}>
                {formatSceneSeconds(currentTime)} / {formatSceneSeconds(duration)}
              </span>
              <input
                className={styles.scrubber}
                type="range"
                min="0"
                max="100"
                value={progress}
                onChange={(event) => {
                  const nextProgress = Number(event.target.value);
                  const audioDuration = durationRef.current || duration;
                  setProgress(nextProgress);
                  if (previewAudioRef.current && audioDuration)
                    previewAudioRef.current.currentTime = (nextProgress / 100) * audioDuration;
                }}
                aria-label={t("create.audio.a11y.audioProgress")}
              />
              <Volume2 size={17} className={styles.volumeIcon} />
              <input
                className={styles.volumeSlider}
                type="range"
                min="0"
                max="100"
                value={volume}
                onChange={(event) => {
                  const nextVolume = Number(event.target.value);
                  setVolume(nextVolume);
                  if (previewAudioRef.current) previewAudioRef.current.volume = nextVolume / 100;
                }}
                aria-label={t("create.audio.a11y.volume")}
              />
            </div>
            <audio
              ref={previewAudioRef}
              src={audioUrl}
              preload="metadata"
              onLoadedMetadata={(event) => {
                syncAudioDuration(event.currentTarget);
                event.currentTarget.volume = volume / 100;
              }}
              onDurationChange={(event) => syncAudioDuration(event.currentTarget)}
              onTimeUpdate={(event) => {
                const nextTime = event.currentTarget.currentTime;
                const nextDuration =
                  durationRef.current ||
                  (Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0);
                if (nextDuration > 0 && durationRef.current !== nextDuration) {
                  durationRef.current = nextDuration;
                  setDuration(nextDuration);
                }
                setCurrentTime(nextTime);
                setProgress(nextDuration ? Math.min(100, (nextTime / nextDuration) * 100) : 0);
              }}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={(event) => {
                const endDuration = durationRef.current || event.currentTarget.duration;
                setIsPlaying(false);
                if (Number.isFinite(endDuration) && endDuration > 0) {
                  durationRef.current = endDuration;
                  setDuration(endDuration);
                  setCurrentTime(endDuration);
                }
                setProgress(100);
              }}
            />
          </div>
        ) : (
          <AltWaveform label={t("create.audio.clone.voiceSample")} />
        )}
        <label className={styles.altTextField}>
          <span>{t("create.audio.clone.testPhrase")}</span>
          <textarea value={testPhrase} onChange={(event) => setTestPhrase(event.target.value)} maxLength={2000} />
        </label>
        <div className={styles.altActionRow}>
          <button
            type="button"
            className={styles.altPrimaryButton}
            onClick={() => void handlePreview()}
            disabled={!voiceId || status === "previewing"}
          >
            <Play size={15} fill="currentColor" />{" "}
            {status === "previewing"
              ? t("create.audio.clone.generatingPreview")
              : t("create.audio.clone.playTestPhrase")}
          </button>
          <button
            type="button"
            className={styles.altSecondaryButton}
            onClick={() => void handleCreate()}
            disabled={status === "creating" || !sampleFile}
          >
            {status === "creating" ? t("create.audio.clone.creating") : t("create.audio.clone.saveVoice")}
          </button>
        </div>
      </section>

      <aside className={styles.alternateSettings}>
        <div className={styles.altPanelHeader}>
          <h2>{t("create.audio.clone.settings")}</h2>
          <Settings2 size={20} />
        </div>
        <label className={styles.altField}>
          <span>{t("create.audio.clone.model")}</span>
          <Dropdown
            value={previewModel}
            options={VOICE_CLONE_MODEL_OPTIONS}
            onChange={setPreviewModel}
            ariaLabel={t("create.audio.clone.model")}
            menuPosition="fixed"
          />
        </label>
        <div className={styles.altSettingBlock}>
          <div className={styles.altSettingHeading}>
            <span>{t("create.audio.clone.speed")}</span>
            <b>{speed.toFixed(2)}x</b>
          </div>
          <input
            className={styles.altRange}
            type="range"
            min="0.5"
            max="2"
            step="0.05"
            value={speed}
            onChange={(event) => setSpeed(Number(event.target.value))}
          />
        </div>
        {previewModel === "minimax/voice-clone" ? (
          <>
            <div className={styles.altSettingBlock}>
              <div className={styles.altSettingHeading}>
                <span>{t("create.audio.clone.accuracy")}</span>
                <b>{accuracy.toFixed(2)}</b>
              </div>
              <input
                className={styles.altRange}
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={accuracy}
                onChange={(event) => setAccuracy(Number(event.target.value))}
              />
            </div>
            <label className={styles.altToggleRow}>
              <span>{t("create.audio.clone.noiseReduction")}</span>
              <button
                type="button"
                className={needNoiseReduction ? styles.altToggleOn : styles.altToggleOff}
                onClick={() => setNeedNoiseReduction((current) => !current)}
                aria-pressed={needNoiseReduction}
              >
                <span />
              </button>
            </label>
            <label className={styles.altToggleRow}>
              <span>{t("create.audio.clone.volumeNormalization")}</span>
              <button
                type="button"
                className={needVolumeNormalization ? styles.altToggleOn : styles.altToggleOff}
                onClick={() => setNeedVolumeNormalization((current) => !current)}
                aria-pressed={needVolumeNormalization}
              >
                <span />
              </button>
            </label>
            <label className={styles.altField}>
              <span>{t("create.audio.language")}</span>
              <Dropdown
                value={language}
                options={MINIMAX_LANGUAGE_BOOST_OPTIONS}
                onChange={setLanguage}
                ariaLabel={t("create.audio.language")}
                menuPosition="fixed"
              />
            </label>
          </>
        ) : null}
        {previewModel === "minimax/speech-2.8-hd" ? (
          <>
            <div className={styles.altSettingBlock}>
              <div className={styles.altSettingHeading}>
                <span>{t("create.audio.pitch")}</span>
                <b>{pitch}</b>
              </div>
              <input
                className={styles.altRange}
                type="range"
                min="-12"
                max="12"
                step="1"
                value={pitch}
                onChange={(event) => setPitch(Number(event.target.value))}
              />
            </div>
            <div className={styles.altSettingBlock}>
              <div className={styles.altSettingHeading}>
                <span>{t("create.audio.synthVolume")}</span>
                <b>{synthVolume.toFixed(1)}x</b>
              </div>
              <input
                className={styles.altRange}
                type="range"
                min="0.5"
                max="10"
                step="0.5"
                value={synthVolume}
                onChange={(event) => setSynthVolume(Number(event.target.value))}
              />
            </div>
            <label className={styles.altField}>
              <span>{t("create.audio.clone.emotion")}</span>
              <Dropdown
                value={emotion}
                options={[
                  { value: "happy", label: t("create.audio.clone.emotionHappy") },
                  { value: "sad", label: t("create.audio.clone.emotionSad") },
                  { value: "angry", label: t("create.audio.clone.emotionAngry") },
                  { value: "fearful", label: t("create.audio.clone.emotionFearful") },
                  { value: "disgusted", label: t("create.audio.clone.emotionDisgusted") },
                  { value: "surprised", label: t("create.audio.clone.emotionSurprised") },
                  { value: "neutral", label: t("create.audio.clone.emotionNeutral") },
                ]}
                onChange={setEmotion}
                ariaLabel={t("create.audio.clone.emotion")}
                menuPosition="fixed"
              />
            </label>
            <label className={styles.altField}>
              <span>{t("create.audio.language")}</span>
              <Dropdown
                value={language}
                options={MINIMAX_LANGUAGE_BOOST_OPTIONS}
                onChange={setLanguage}
                ariaLabel={t("create.audio.language")}
                menuPosition="fixed"
              />
            </label>
            <label className={styles.altField}>
              <span>{t("create.audio.pronunciationHints")}</span>
              <input
                value={pronunciation}
                onChange={(event) => setPronunciation(event.target.value)}
                placeholder={"e.g. EOS as “อี-โอ-เอส”"}
              />
            </label>
            <label className={styles.altToggleRow}>
              <span>{t("create.audio.clone.englishNormalization")}</span>
              <button
                type="button"
                className={englishNormalization ? styles.altToggleOn : styles.altToggleOff}
                onClick={() => setEnglishNormalization((current) => !current)}
                aria-pressed={englishNormalization}
              >
                <span />
              </button>
            </label>
            <label className={styles.altField}>
              <span>{t("create.audio.clone.sampleRate")}</span>
              <Dropdown
                value={sampleRate}
                options={["8000", "16000", "22050", "24000", "32000", "44100"].map((value) => ({
                  value,
                  label: `${Number(value).toLocaleString()} Hz`,
                }))}
                onChange={setSampleRate}
                ariaLabel={t("create.audio.clone.sampleRate")}
                menuPosition="fixed"
              />
            </label>
            <label className={styles.altField}>
              <span>{t("create.audio.clone.bitrate")}</span>
              <Dropdown
                value={bitrate}
                options={["32000", "64000", "128000", "256000"].map((value) => ({
                  value,
                  label: `${Number(value) / 1000} kbps`,
                }))}
                onChange={setBitrate}
                ariaLabel={t("create.audio.clone.bitrate")}
                menuPosition="fixed"
              />
            </label>
            <label className={styles.altField}>
              <span>{t("create.audio.clone.channel")}</span>
              <Dropdown
                value={channel}
                options={[
                  { value: "1", label: t("create.audio.clone.channelMono") },
                  { value: "2", label: t("create.audio.clone.channelStereo") },
                ]}
                onChange={setChannel}
                ariaLabel={t("create.audio.clone.channel")}
                menuPosition="fixed"
              />
            </label>
          </>
        ) : null}
        <div className={styles.altSettingBlock}>
          <span className={styles.altFieldLabel}>{t("create.audio.clone.outputFormat")}</span>
          <div className={styles.altFormatGrid}>
            {(["mp3", "wav", "ogg"] as const).map((format) => (
              <button
                type="button"
                key={format}
                className={outputFormat === format ? styles.altFormatActive : styles.altFormat}
                onClick={() => setOutputFormat(format)}
              >
                {format.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <div data-mobile-action-dock className={styles.mobileActionDock}>
          <div className={styles.creditEstimate}>
            <div className={styles.creditEstimateHeader}>
              <strong>
                {t("create.audio.estimatedCredits")}{" "}
                <InfoTooltip content={t("create.audio.info.estimatedCredits")} size={11} />
              </strong>
              <b>
                {creditQuoteLoading
                  ? t("create.audio.calculating")
                  : creditQuote
                    ? t("create.audio.creditsAmount", { amount: formatCreditAmount(creditQuote.creditCost) })
                    : "—"}
              </b>
            </div>
            <p className={styles.creditEstimateCount}>{t("create.audio.audioCount")}</p>
          </div>
          <button
            type="button"
            className={styles.altGenerateButton}
            onClick={() => void handleCreate()}
            disabled={status === "creating" || !sampleFile}
          >
            {status === "creating" ? t("create.audio.clone.creatingButton") : t("create.audio.clone.createVoice")}{" "}
            <Sparkles size={16} />
          </button>
        </div>
      </aside>
      <Dialog
        open={deleteConfirmVoice !== null}
        onOpenChange={(next) => {
          if (!next) setDeleteConfirmVoice(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("create.audio.clone.deleteVoice.title")}</DialogTitle>
            <DialogDescription>
              {t("create.audio.clone.deleteVoice.body", { name: deleteConfirmVoice?.name ?? "" })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="ghost" size="sm" onClick={() => setDeleteConfirmVoice(null)}>
              {t("create.audio.clone.deleteVoice.cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => {
                if (deleteConfirmVoice) void handleDeleteSavedVoice(deleteConfirmVoice);
              }}
            >
              <Trash2 size={15} /> {t("create.audio.clone.deleteVoice.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SoundEffectsLayout({ onHistorySaved }: { onHistorySaved?: SaveHistoryCallback }) {
  const { t } = useLocale();
  const [sourceMode, setSourceMode] = useState<"text" | "video">("text");
  const [effectType, setEffectType] = useState("Cinematic");
  const [description, setDescription] = useState(() => t("create.audio.sfx.defaultDescription"));
  const [effectDuration, setEffectDuration] = useState(4);
  const [variationCount, setVariationCount] = useState(4);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoDescription, setVideoDescription] = useState("");
  const [outputFormat, setOutputFormat] = useState<"mp3" | "wav" | "ogg">("mp3");
  const [variants, setVariants] = useState<SoundEffectVariant[]>([]);
  const [audioUrls, setAudioUrls] = useState<Record<number, string>>({});
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [status, setStatus] = useState<"idle" | "generating" | "ready" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackDuration, setPlaybackDuration] = useState(0);
  const [volume, setVolume] = useState(80);
  const [creditQuote, setCreditQuote] = useState<SoundEffectsQuote | null>(null);
  const [creditQuoteLoading, setCreditQuoteLoading] = useState(false);
  const audioUrlsRef = useRef<Record<number, string>>({});
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const durationRef = useRef(0);

  useEffect(
    () => () => {
      previewAudioRef.current?.pause();
      Object.values(audioUrlsRef.current).forEach((url) => URL.revokeObjectURL(url));
    },
    [],
  );

  useEffect(() => {
    let active = true;
    if (sourceMode !== "text") {
      const resetTimer = window.setTimeout(() => {
        if (!active) return;
        setCreditQuote(null);
        setCreditQuoteLoading(false);
      }, 0);
      return () => {
        active = false;
        window.clearTimeout(resetTimer);
      };
    }
    const timer = window.setTimeout(() => {
      setCreditQuoteLoading(true);
      void quoteSoundEffects({ durationSeconds: effectDuration, variationCount })
        .then((quote) => {
          if (active) setCreditQuote(quote);
        })
        .catch(() => {
          if (active) setCreditQuote(null);
        })
        .finally(() => {
          if (active) setCreditQuoteLoading(false);
        });
    }, 400);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [sourceMode, effectDuration, variationCount]);

  const handleGenerate = async () => {
    setStatus("generating");
    setError(null);
    try {
      let nextVariants: SoundEffectVariant[];
      let nextUrls: Record<number, string> = {};
      if (sourceMode === "video") {
        if (!videoFile) {
          setError(t("create.audio.sfx.error.noVideo"));
          setStatus("error");
          return;
        }
        const result = await createVideoSoundEffect({
          video: videoFile,
          description: videoDescription.trim() || undefined,
          outputFormat,
        });
        nextUrls = { 1: URL.createObjectURL(result.blob) };
        nextVariants = [{ index: 1, audioBase64: "", contentType: result.contentType, outputFormat }];
        void onHistorySaved?.({
          audio: result.blob,
          feature: "sound-effects",
          label: t("create.audio.sfx.videoLabel"),
          outputFormat,
          metadata: { videoDescription, source: "video" },
        });
      } else {
        nextVariants = await createSoundEffects({
          description,
          category: effectType,
          durationSeconds: effectDuration,
          variationCount,
          outputFormat,
        });
        nextVariants.forEach((variant) => {
          const binary = Uint8Array.from(atob(variant.audioBase64), (character) => character.charCodeAt(0));
          const blob = new Blob([binary.buffer as ArrayBuffer], { type: variant.contentType });
          nextUrls[variant.index] = URL.createObjectURL(blob);
          void onHistorySaved?.({
            audio: blob,
            feature: "sound-effects",
            label: `${effectType} variation ${variant.index}`,
            outputFormat,
            metadata: { description, durationSeconds: effectDuration, variation: variant.index },
          });
        });
      }
      previewAudioRef.current?.pause();
      Object.values(audioUrlsRef.current).forEach((url) => URL.revokeObjectURL(url));
      audioUrlsRef.current = nextUrls;
      setVariants(nextVariants);
      setAudioUrls(nextUrls);
      setSelectedIndex(nextVariants[0]?.index ?? 0);
      durationRef.current = 0;
      setPlaybackDuration(0);
      setCurrentTime(0);
      setProgress(0);
      setIsPlaying(false);
      setStatus("ready");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sound effect generation failed");
      setStatus("error");
    }
  };

  const togglePlayback = () => {
    const audio = previewAudioRef.current;
    if (!selectedUrl || !audio) return;
    if (audio.paused)
      void audio
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    else {
      audio.pause();
      setIsPlaying(false);
    }
  };

  const seekBy = (amount: number) => {
    if (!previewAudioRef.current) return;
    const audioDuration = durationRef.current || playbackDuration;
    previewAudioRef.current.currentTime = Math.max(
      0,
      Math.min(audioDuration, previewAudioRef.current.currentTime + amount),
    );
  };

  const syncPlaybackDuration = (audio: HTMLAudioElement) => {
    const nextDuration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0;
    if (!nextDuration) return;
    durationRef.current = nextDuration;
    setPlaybackDuration(nextDuration);
    const nextTime = Number.isFinite(audio.currentTime) ? Math.min(audio.currentTime, nextDuration) : 0;
    setCurrentTime(nextTime);
    setProgress(Math.min(100, (nextTime / nextDuration) * 100));
  };

  const selectedUrl = audioUrls[selectedIndex];
  const downloadSelected = () => {
    if (!selectedUrl) return;
    const link = document.createElement("a");
    link.href = selectedUrl;
    link.download = `sound-effect-${selectedIndex}.${outputFormat}`;
    link.click();
  };

  return (
    <div className={styles.alternateLayout}>
      <section className={`${styles.alternatePanel} ${styles.alternateFormPanel}`}>
        <AlternateHeading
          eyebrow={t("create.audio.sfx.eyebrow")}
          title={t("create.audio.sfx.title")}
          description={t("create.audio.sfx.description")}
          icon={<AudioLines size={24} />}
        />
        <div className={`${styles.altFieldGroup} ${styles.sfxSourceGroup}`}>
          <span className={styles.altFieldLabel}>{t("create.audio.sfx.source")}</span>
          <div className={styles.altChoiceRow}>
            <button
              type="button"
              className={sourceMode === "text" ? styles.altChoiceActive : styles.altChoice}
              onClick={() => setSourceMode("text")}
            >
              {t("create.audio.sfx.fromText")}
            </button>
            <button
              type="button"
              className={sourceMode === "video" ? styles.altChoiceActive : styles.altChoice}
              onClick={() => setSourceMode("video")}
            >
              {t("create.audio.sfx.fromVideo")}
            </button>
          </div>
        </div>
        {sourceMode === "text" ? (
          <>
            <label className={styles.altTextField}>
              <span>{t("create.audio.sfx.soundDescription")}</span>
              <textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={2000} />
            </label>
            <div className={styles.altFieldGroup}>
              <span className={styles.altFieldLabel}>{t("create.audio.sfx.effectCategory")}</span>
              <div className={styles.altChoiceRow}>
                {(
                  [
                    ["Cinematic", "create.audio.sfx.categoryCinematic"],
                    ["Nature", "create.audio.sfx.categoryNature"],
                    ["UI / Tech", "create.audio.sfx.categoryUi"],
                    ["Impact", "create.audio.sfx.categoryImpact"],
                  ] as const
                ).map(([item, labelKey]) => (
                  <button
                    type="button"
                    key={item}
                    className={effectType === item ? styles.altChoiceActive : styles.altChoice}
                    onClick={() => setEffectType(item)}
                  >
                    {t(labelKey)}
                  </button>
                ))}
              </div>
            </div>
            <div className={styles.altTwoFields}>
              <label className={styles.altField}>
                <span>{t("create.audio.sfx.duration")}</span>
                <Dropdown
                  value={String(effectDuration)}
                  onChange={(value) => setEffectDuration(Number(value))}
                  ariaLabel={t("create.audio.sfx.duration")}
                  menuPosition="fixed"
                  options={[2, 4, 8].map((seconds) => ({
                    value: String(seconds),
                    label: t("create.audio.sfx.seconds", { count: String(seconds).padStart(2, "0") }),
                  }))}
                />
              </label>
              <label className={styles.altField}>
                <span>{t("create.audio.sfx.variations")}</span>
                <Dropdown
                  value={String(variationCount)}
                  onChange={(value) => setVariationCount(Number(value))}
                  ariaLabel={t("create.audio.sfx.variations")}
                  menuPosition="fixed"
                  options={[1, 2, 4].map((amount) => ({
                    value: String(amount),
                    label: t("create.audio.sfx.variationOptions", { count: amount }),
                  }))}
                />
              </label>
            </div>
          </>
        ) : (
          <>
            <input
              ref={videoInputRef}
              hidden
              type="file"
              accept="video/mp4,video/quicktime,video/webm,video/x-m4v,image/gif,video/*"
              onChange={(event) => setVideoFile(event.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              className={`${styles.cloneDropzone} ${videoFile ? styles.cloneDropzoneReady : ""}`}
              onClick={() => videoInputRef.current?.click()}
            >
              <span className={styles.cloneIcon}>
                <CloudUpload size={23} />
              </span>
              <strong>{videoFile ? t("create.audio.sfx.videoReady") : t("create.audio.sfx.dropVideo")}</strong>
              <small>{videoFile ? videoFile.name : t("create.audio.sfx.videoHint")}</small>
            </button>
            <label className={styles.altTextField}>
              <span>{t("create.audio.sfx.videoDescription")}</span>
              <textarea
                value={videoDescription}
                onChange={(event) => setVideoDescription(event.target.value)}
                maxLength={2000}
                placeholder={t("create.audio.sfx.videoDescriptionPlaceholder")}
              />
            </label>
          </>
        )}
      </section>

      <section className={`${styles.alternatePanel} ${styles.alternateCenterPanel}`}>
        <div className={styles.altPanelHeader}>
          <div>
            <span className={styles.altEyebrow}>
              {t("create.audio.sfx.variationsLabel", {
                count: variants.length || (sourceMode === "video" ? 1 : variationCount),
              })}
            </span>
            <h2>{t("create.audio.sfx.soundPreview")}</h2>
          </div>
          <span className={styles.altStatus}>
            <span /> {status === "generating" ? t("create.audio.sfx.generatingStatus") : t("create.audio.sfx.ready")}
          </span>
        </div>
        {status === "error" && error ? (
          <p className={styles.podcastError} role="alert">
            {error}
          </p>
        ) : null}
        {selectedUrl ? (
          <>
            <PreviewWaveform audioUrl={selectedUrl} progress={progress} isPlaying={isPlaying} />
            <div className={styles.playerRow}>
              <button
                type="button"
                className={styles.playButton}
                onClick={togglePlayback}
                aria-label={t(isPlaying ? "create.audio.a11y.pause" : "create.audio.a11y.play")}
              >
                {isPlaying ? <span className={styles.pauseGlyph} /> : <Play size={20} fill="currentColor" />}
              </button>
              <button
                type="button"
                className={styles.skipButton}
                onClick={() => seekBy(-10)}
                aria-label={t("create.audio.a11y.rewind10")}
              >
                <RotateCcw size={17} />
                <small>10</small>
              </button>
              <button
                type="button"
                className={styles.skipButton}
                onClick={() => seekBy(10)}
                aria-label={t("create.audio.a11y.forward10")}
              >
                <RotateCw size={17} />
                <small>10</small>
              </button>
              <span className={styles.timeLabel}>
                {formatSceneSeconds(currentTime)} / {formatSceneSeconds(playbackDuration)}
              </span>
              <input
                className={styles.scrubber}
                type="range"
                min="0"
                max="100"
                value={progress}
                onChange={(event) => {
                  const nextProgress = Number(event.target.value);
                  const audioDuration = durationRef.current || playbackDuration;
                  setProgress(nextProgress);
                  if (previewAudioRef.current && audioDuration)
                    previewAudioRef.current.currentTime = (nextProgress / 100) * audioDuration;
                }}
                aria-label={t("create.audio.a11y.audioProgress")}
              />
              <Volume2 size={17} className={styles.volumeIcon} />
              <input
                className={styles.volumeSlider}
                type="range"
                min="0"
                max="100"
                value={volume}
                onChange={(event) => {
                  const nextVolume = Number(event.target.value);
                  setVolume(nextVolume);
                  if (previewAudioRef.current) previewAudioRef.current.volume = nextVolume / 100;
                }}
                aria-label={t("create.audio.a11y.volume")}
              />
            </div>
            <audio
              ref={previewAudioRef}
              src={selectedUrl}
              preload="metadata"
              onLoadedMetadata={(event) => {
                syncPlaybackDuration(event.currentTarget);
                event.currentTarget.volume = volume / 100;
              }}
              onDurationChange={(event) => syncPlaybackDuration(event.currentTarget)}
              onTimeUpdate={(event) => {
                const nextTime = event.currentTarget.currentTime;
                const nextDuration =
                  durationRef.current ||
                  (Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0);
                if (nextDuration > 0 && durationRef.current !== nextDuration) {
                  durationRef.current = nextDuration;
                  setPlaybackDuration(nextDuration);
                }
                setCurrentTime(nextTime);
                setProgress(nextDuration ? Math.min(100, (nextTime / nextDuration) * 100) : 0);
              }}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={(event) => {
                const endDuration = durationRef.current || event.currentTarget.duration;
                setIsPlaying(false);
                if (Number.isFinite(endDuration) && endDuration > 0) {
                  durationRef.current = endDuration;
                  setPlaybackDuration(endDuration);
                  setCurrentTime(endDuration);
                }
                setProgress(100);
              }}
            />
          </>
        ) : (
          <AltWaveform label={t("create.audio.sfx.waveformLabel")} />
        )}
        {sourceMode === "text" ? (
          <div className={styles.effectVariationGrid}>
            {variants.map((variant) => (
              <button
                type="button"
                key={variant.index}
                className={selectedIndex === variant.index ? styles.effectCardActive : styles.effectCard}
                onClick={() => setSelectedIndex(variant.index)}
              >
                <span className={styles.effectMiniWave} />
                <strong>{t("create.audio.sfx.variationNumber", { index: variant.index })}</strong>
                <small>{effectDuration.toString().padStart(2, "0")}s</small>
                <Play size={12} fill="currentColor" />
              </button>
            ))}
          </div>
        ) : null}
        <div className={styles.altActionRow}>
          <button type="button" className={styles.altPrimaryButton} onClick={downloadSelected} disabled={!selectedUrl}>
            <Download size={15} /> {t("create.audio.sfx.downloadSelected")}
          </button>
          <button
            type="button"
            className={styles.altSecondaryButton}
            onClick={() => void handleGenerate()}
            disabled={status === "generating"}
          >
            {t("create.audio.sfx.regenerate")}
          </button>
        </div>
      </section>

      <aside className={styles.alternateSettings}>
        <div className={styles.altPanelHeader}>
          <h2>{t("create.audio.sfx.settings")}</h2>
          <Settings2 size={20} />
        </div>
        <label className={styles.altField}>
          <span>{t("create.audio.sfx.model")}</span>
          <Dropdown
            value={sourceMode}
            options={SFX_MODEL_OPTIONS}
            onChange={(value) => setSourceMode(value as "text" | "video")}
            ariaLabel={t("create.audio.sfx.model")}
            menuPosition="fixed"
          />
        </label>
        <div className={styles.altSettingBlock}>
          <span className={styles.altFieldLabel}>{t("create.audio.sfx.outputFormat")}</span>
          <div className={styles.altFormatGrid}>
            {(["mp3", "wav", "ogg"] as const).map((format) => (
              <button
                type="button"
                key={format}
                className={outputFormat === format ? styles.altFormatActive : styles.altFormat}
                onClick={() => setOutputFormat(format)}
              >
                {format.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <div data-mobile-action-dock className={styles.mobileActionDock}>
          <div className={styles.creditEstimate}>
            <div className={styles.creditEstimateHeader}>
              <strong>
                {t("create.audio.estimatedCredits")}{" "}
                <InfoTooltip content={t("create.audio.info.estimatedCredits")} size={11} />
              </strong>
              <b>
                {sourceMode === "video"
                  ? "—"
                  : creditQuoteLoading
                    ? t("create.audio.calculating")
                    : creditQuote
                      ? t("create.audio.creditsAmount", { amount: formatCreditAmount(creditQuote.creditCost) })
                      : "—"}
              </b>
            </div>
            <p className={styles.creditEstimateCount}>
              {sourceMode === "video"
                ? t("create.audio.sfx.videoLabel")
                : t("create.audio.sfx.variationsLabel", { count: variationCount })}
            </p>
          </div>
          <button
            type="button"
            className={styles.altGenerateButton}
            onClick={() => void handleGenerate()}
            disabled={status === "generating" || (sourceMode === "video" ? !videoFile : !description.trim())}
          >
            {status === "generating" ? t("create.audio.sfx.generatingButton") : t("create.audio.sfx.generate")}{" "}
            <Sparkles size={16} />
          </button>
        </div>
      </aside>
    </div>
  );
}

function formatAudioFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AudioCleanupLayout() {
  const { t } = useLocale();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [cleanedUrl, setCleanedUrl] = useState<string | null>(null);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [status, setStatus] = useState<"empty" | "ready" | "processing" | "done">("empty");
  const [error, setError] = useState<string | null>(null);
  const [options, setOptions] = useState({
    noiseReduction: true,
    voiceClarity: true,
    removeReverb: false,
    normalizeLoudness: true,
    preserveTone: true,
  });
  const [outputFormat, setOutputFormat] = useState<"mp3" | "wav" | "ogg">("mp3");

  useEffect(() => {
    if (!file) {
      const timer = window.setTimeout(() => setSourceUrl(null), 0);
      return () => window.clearTimeout(timer);
    }
    const url = URL.createObjectURL(file);
    const timer = window.setTimeout(() => setSourceUrl(url), 0);
    return () => {
      window.clearTimeout(timer);
      URL.revokeObjectURL(url);
    };
  }, [file]);

  useEffect(() => {
    return () => {
      if (cleanedUrl) URL.revokeObjectURL(cleanedUrl);
    };
  }, [cleanedUrl]);

  const setSelectedFile = (nextFile: File | undefined) => {
    if (!nextFile) return;
    if (!nextFile.type.startsWith("audio/")) {
      setError(t("create.audio.cleanup.audioOnly"));
      return;
    }
    if (nextFile.size > 50 * 1024 * 1024) {
      setError(t("create.audio.cleanup.fileTooLarge"));
      return;
    }
    setFile(nextFile);
    setCleanedUrl(null);
    setDurationSeconds(0);
    setStatus("ready");
    setError(null);

    const preview = document.createElement("audio");
    const previewUrl = URL.createObjectURL(nextFile);
    preview.preload = "metadata";
    preview.onloadedmetadata = () => {
      setDurationSeconds(Number.isFinite(preview.duration) ? preview.duration : 0);
      URL.revokeObjectURL(previewUrl);
    };
    preview.onerror = () => URL.revokeObjectURL(previewUrl);
    preview.src = previewUrl;
  };

  const handleCleanup = async () => {
    if (!file) {
      setError(t("create.audio.cleanup.selectFile"));
      return;
    }
    if (!options.noiseReduction && !options.voiceClarity && !options.removeReverb && !options.normalizeLoudness) {
      setError(t("create.audio.cleanup.selectTool"));
      return;
    }
    setStatus("processing");
    setError(null);
    try {
      const result = await cleanupAudio({ audio: file, ...options, outputFormat });
      setCleanedUrl(URL.createObjectURL(result.blob));
      setStatus("done");
    } catch (cleanupError) {
      setStatus("ready");
      setError(cleanupError instanceof Error ? cleanupError.message : t("create.audio.cleanup.processError"));
    }
  };

  const toggleOption = (key: keyof typeof options) => {
    setOptions((current) => ({ ...current, [key]: !current[key] }));
    setCleanedUrl(null);
    if (status === "done") setStatus("ready");
  };

  const formattedDuration = durationSeconds > 0 ? formatSceneSeconds(durationSeconds) : "—";
  const optionRows = [
    {
      key: "noiseReduction" as const,
      label: t("create.audio.cleanup.noiseReduction"),
      hint: t("create.audio.cleanup.noiseReductionHint"),
      provider: "ElevenLabs",
    },
    {
      key: "voiceClarity" as const,
      label: t("create.audio.cleanup.voiceClarity"),
      hint: t("create.audio.cleanup.voiceClarityHint"),
      provider: "ElevenLabs",
    },
    {
      key: "removeReverb" as const,
      label: t("create.audio.cleanup.removeReverb"),
      hint: t("create.audio.cleanup.removeReverbHint"),
      provider: t("create.audio.cleanup.internalProcessor"),
    },
    {
      key: "normalizeLoudness" as const,
      label: t("create.audio.cleanup.normalizeLoudness"),
      hint: t("create.audio.cleanup.normalizeLoudnessHint"),
      provider: t("create.audio.cleanup.internalProcessor"),
    },
  ];

  return (
    <div className={`${styles.alternateLayout} ${styles.cleanupLayout}`}>
      <section className={`${styles.alternatePanel} ${styles.alternateFormPanel} ${styles.cleanupSourcePanel}`}>
        <AlternateHeading
          eyebrow={t("create.audio.cleanup.eyebrow")}
          title={t("create.audio.cleanup.title")}
          description={t("create.audio.cleanup.description")}
          icon={<Waves size={24} />}
        />
        <input
          ref={inputRef}
          className={styles.cleanupHiddenInput}
          type="file"
          accept="audio/*"
          onChange={(event) => {
            setSelectedFile(event.target.files?.[0]);
            event.currentTarget.value = "";
          }}
        />
        <button
          type="button"
          className={`${styles.cleanupDropzone} ${file ? styles.cleanupDropzoneReady : ""}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            setSelectedFile(event.dataTransfer.files?.[0]);
          }}
        >
          <span className={styles.cleanupFileIcon}>
            <CloudUpload size={21} />
          </span>
          {file ? (
            <span className={styles.cleanupFileCopy}>
              <strong>{file.name}</strong>
              <small>
                {file.type.split("/")[1]?.toUpperCase() ?? "AUDIO"} · {formattedDuration} ·{" "}
                {formatAudioFileSize(file.size)}
              </small>
            </span>
          ) : (
            <span className={styles.cleanupFileCopy}>
              <strong>{t("create.audio.cleanup.uploadTitle")}</strong>
              <small>{t("create.audio.cleanup.uploadHint")}</small>
            </span>
          )}
          {file ? <Check size={17} /> : <Plus size={18} />}
        </button>
        {file ? (
          <button type="button" className={styles.cleanupReplaceButton} onClick={() => inputRef.current?.click()}>
            <RotateCcw size={14} /> {t("create.audio.cleanup.replaceFile")}
          </button>
        ) : null}
        <div className={styles.cleanupSourceNote}>
          <LockKeyhole size={12} /> {t("create.audio.cleanup.privateNote")}
        </div>
        {error ? (
          <p className={styles.cleanupError} role="alert">
            {error}
          </p>
        ) : null}
      </section>

      <section className={`${styles.alternatePanel} ${styles.alternateCenterPanel} ${styles.cleanupPreviewPanel}`}>
        <div className={styles.altPanelHeader}>
          <div>
            <span className={styles.altEyebrow}>{t("create.audio.cleanup.previewEyebrow")}</span>
            <h2>{t("create.audio.cleanup.beforeAfter")}</h2>
          </div>
          <span className={`${styles.cleanupStatus} ${status === "done" ? styles.cleanupStatusReady : ""}`}>
            <span />{" "}
            {status === "processing"
              ? t("create.audio.cleanup.processing")
              : status === "done"
                ? t("create.audio.cleanup.ready")
                : t("create.audio.cleanup.previewWaiting")}
          </span>
        </div>
        <div className={styles.cleanupPreviewGrid}>
          <div className={styles.cleanupPreviewCard}>
            <div className={styles.cleanupPreviewLabel}>
              <span>{t("create.audio.cleanup.original")}</span>
              <small>{file ? formattedDuration : "—"}</small>
            </div>
            <CleanupAudioPlayer src={sourceUrl} label={t("create.audio.cleanup.original")} />
          </div>
          <div className={`${styles.cleanupPreviewCard} ${styles.cleanupPreviewCardAfter}`}>
            <div className={styles.cleanupPreviewLabel}>
              <span>{t("create.audio.cleanup.cleaned")}</span>
              <small>{cleanedUrl ? outputFormat.toUpperCase() : "—"}</small>
            </div>
            <CleanupAudioPlayer src={cleanedUrl} label={t("create.audio.cleanup.cleaned")} />
          </div>
        </div>
        {cleanedUrl ? (
          <div className={styles.cleanupResultActions}>
            <span>
              <Check size={14} /> {t("create.audio.cleanup.resultReady")}
            </span>
            <a className={styles.cleanupDownloadButton} href={cleanedUrl} download={`cleaned-audio.${outputFormat}`}>
              <Download size={14} /> {t("create.audio.cleanup.download")}
            </a>
          </div>
        ) : (
          <div className={styles.cleanupPreviewHint}>
            <WandSparkles size={14} /> {t("create.audio.cleanup.previewHint")}
          </div>
        )}
      </section>

      <aside className={`${styles.alternateSettings} ${styles.cleanupSettingsPanel}`}>
        <div className={styles.altPanelHeader}>
          <div>
            <span className={styles.altEyebrow}>{t("create.audio.cleanup.tools")}</span>
            <h2>{t("create.audio.cleanup.settings")}</h2>
          </div>
          <Settings2 size={20} />
        </div>
        <div className={styles.cleanupToolList}>
          {optionRows.map((option) => (
            <label
              className={`${styles.cleanupToolCard} ${options[option.key] ? styles.cleanupToolCardActive : ""}`}
              key={option.key}
            >
              <input type="checkbox" checked={options[option.key]} onChange={() => toggleOption(option.key)} />
              <span className={styles.cleanupToolCopy}>
                <strong>{option.label}</strong>
                <small>{option.hint}</small>
              </span>
              <em>{option.provider}</em>
            </label>
          ))}
        </div>
        <label className={styles.cleanupToneToggle}>
          <span>
            <strong>{t("create.audio.cleanup.preserveTone")}</strong>
            <small>{t("create.audio.cleanup.preserveToneHint")}</small>
          </span>
          <input type="checkbox" checked={options.preserveTone} onChange={() => toggleOption("preserveTone")} />
        </label>
        <label className={styles.cleanupFormatField}>
          <span>{t("create.audio.cleanup.outputFormat")}</span>
          <select value={outputFormat} onChange={(event) => setOutputFormat(event.target.value as typeof outputFormat)}>
            <option value="mp3">MP3</option>
            <option value="wav">WAV</option>
            <option value="ogg">OGG</option>
          </select>
        </label>
        <div data-mobile-action-dock className={styles.mobileActionDock}>
          <div className={styles.creditEstimate}>
            <div className={styles.creditEstimateHeader}>
              <strong>
                {t("create.audio.estimatedCredits")}{" "}
                <InfoTooltip content={t("create.audio.info.estimatedCredits")} size={11} />
              </strong>
              <b>—</b>
            </div>
            <p className={styles.creditEstimateCount}>
              {file ? t("create.audio.audioCount") : t("create.audio.cleanup.waiting")}
            </p>
          </div>
          <button
            type="button"
            className={styles.generateButton}
            disabled={!file || status === "processing"}
            onClick={() => void handleCleanup()}
          >
            {status === "processing" ? t("create.audio.cleanup.processingAction") : t("create.audio.cleanup.clean")}{" "}
            <Sparkles size={17} />
          </button>
          <p className={styles.securityNote}>
            <LockKeyhole size={11} /> {t("create.audio.privateSecure")}
          </p>
        </div>
      </aside>
    </div>
  );
}

export function AudioGenerationPage() {
  const { locale, t } = useLocale();
  const [activeTab, setActiveTab] = useState<AudioTab>("Text to Speech");
  const [prompt, setPrompt] = useState(DEFAULT_AUDIO_PROMPT);
  const [tone, setTone] = useState<"Energetic" | "Friendly" | "Premium" | "Dramatic" | "">("");
  const [voiceMode, setVoiceMode] = useState<"tone" | "cloned">("tone");
  const [savedVoices, setSavedVoices] = useState<VoiceCloneListItem[]>([]);
  const [language, setLanguage] = useState("Thai");
  const [pronunciation, setPronunciation] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [availableModels, setAvailableModels] = useState<AudioModel[]>([]);
  const [modelLoadState, setModelLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [selectedVoice, setSelectedVoice] = useState("");
  const [availableVoices, setAvailableVoices] = useState<AudioVoice[]>([]);
  const [voiceLoadState, setVoiceLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [canScrollVoicesLeft, setCanScrollVoicesLeft] = useState(false);
  const [canScrollVoicesRight, setCanScrollVoicesRight] = useState(false);
  const [format, setFormat] = useState("MP3");
  const [speed, setSpeed] = useState(0.95);
  const [pitch, setPitch] = useState(0);
  const [synthVolume, setSynthVolume] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioHistory, setAudioHistory] = useState<AudioHistoryItem[]>([]);
  const [historyLoadingId, setHistoryLoadingId] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(78);
  const [backgroundMusic, setBackgroundMusic] = useState(false);
  const [backgroundMusicPreset, setBackgroundMusicPreset] = useState("");
  const [backgroundMusicPresets, setBackgroundMusicPresets] = useState<AudioBackgroundMusic[]>([]);
  const [backgroundMusicLoadState, setBackgroundMusicLoadState] = useState<"loading" | "ready" | "error">("ready");
  const [creditEstimate, setCreditEstimate] = useState<AudioCreditQuote | null>(null);
  const [creditEstimateLoading, setCreditEstimateLoading] = useState(false);
  const [creditEstimateError, setCreditEstimateError] = useState<string | null>(null);
  const [audioScenes, setAudioScenes] = useState<AudioScene[]>(defaultAudioScenes);
  // selectedSceneId/selectedScene/sceneError are kept in sync (see addAudioScene,
  // handleGenerateScenes below) but not yet read back by the UI — no scene-list
  // selection highlighting or scene-specific error message is wired up yet.
  const [selectedSceneId, setSelectedSceneId] = useState(defaultAudioScenes[0]!.id);
  void selectedSceneId;
  const [sceneGenerationStatus, setSceneGenerationStatus] = useState<"idle" | "generating" | "complete" | "error">(
    "idle",
  );
  const [sceneError, setSceneError] = useState<string | null>(null);
  void sceneError;
  const [status, setStatus] = useState<"idle" | "generating" | "complete" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedScene, setSelectedScene] = useState("01");
  void selectedScene;
  const audioRef = useRef<HTMLAudioElement>(null);
  const voicePreviewAudioRef = useRef<HTMLAudioElement>(null);
  const durationRef = useRef(0);
  const playbackFrameRef = useRef<number | null>(null);
  const voiceRowRef = useRef<HTMLDivElement>(null);
  const voiceScrollTargetRef = useRef(0);
  const voiceScrollUserMovedRef = useRef(false);
  const audioHistoryRef = useRef<AudioHistoryItem[]>([]);
  const historySequenceRef = useRef(0);
  // Mirrors savedVoices so loadVoices (deps: []) can tell a cloned voice_id
  // apart from a stale preset selection without re-running on every refresh.
  const savedVoicesRef = useRef<VoiceCloneListItem[]>([]);
  const [previewingVoiceKey, setPreviewingVoiceKey] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const savedTab = window.localStorage.getItem(AUDIO_TAB_STORAGE_KEY);
        if (savedTab && visibleTabs.includes(savedTab as AudioTab)) setActiveTab(savedTab as AudioTab);
      } catch {
        // Ignore storage restrictions and keep the default tab.
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const changeActiveTab = (tab: AudioTab) => {
    setActiveTab(tab);
    try {
      window.localStorage.setItem(AUDIO_TAB_STORAGE_KEY, tab);
    } catch {
      // Ignore storage restrictions; the tab still changes for this session.
    }
  };

  useTemplatePrompt("audio", (value) => {
    setPrompt(value);
    setAudioScenes((current) => current.map((scene, index) => (index === 0 ? { ...scene, text: value } : scene)));
  });

  useEffect(() => {
    return () => {
      audioHistoryRef.current.filter((item) => item.localUrl).forEach((item) => URL.revokeObjectURL(item.url));
    };
  }, []);

  useEffect(() => {
    if (activeTab !== "Text to Speech" || !backgroundMusic || backgroundMusicPresets.length > 0) return undefined;
    let cancelled = false;
    void listAudioBackgroundMusic()
      .then((items) => {
        if (cancelled) return;
        setBackgroundMusicPresets(items);
        setBackgroundMusicPreset((current) =>
          items.some((preset) => preset.key === current) ? current : (items[0]?.key ?? ""),
        );
        setBackgroundMusicLoadState("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setBackgroundMusicPresets([]);
        setBackgroundMusicPreset("");
        setBackgroundMusicLoadState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [activeTab, backgroundMusic, backgroundMusicPresets.length]);

  useEffect(() => {
    if (activeTab !== "Text to Speech") return undefined;
    let cancelled = false;
    const timer = window.setTimeout(
      () =>
        void listAudioHistory({ limit: AUDIO_HISTORY_LIMIT })
          .then((items) => {
            if (cancelled) return;
            const history = items.map((item) => ({
              ...item,
              url: item.url ?? item.audioUrl ?? item.downloadUrl ?? "",
              localUrl: false,
              persisted: true,
            }));
            audioHistoryRef.current = history;
            setAudioHistory(history);
          })
          .catch(() => undefined),
      600,
    );
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [activeTab]);

  const loadModels = useCallback(async () => {
    setModelLoadState("loading");
    try {
      const items = await listAudioModels("textToSpeech");
      setAvailableModels(items);
      setSelectedModel((current) =>
        items.some((model) => model.key === current)
          ? current
          : (items.find((model) => model.isActive)?.key ?? items[0]?.key ?? ""),
      );
      setModelLoadState("ready");
    } catch {
      setAvailableModels([]);
      setModelLoadState("error");
    }
  }, []);

  const loadVoices = useCallback(async (modelId?: string) => {
    voicePreviewAudioRef.current?.pause();
    setPreviewingVoiceKey(null);
    setVoiceLoadState("loading");
    setVoiceError(null);
    try {
      const items = await listAudioVoices(modelId, "textToSpeech");
      setAvailableVoices(items);
      setSelectedVoice((current) => {
        const isPreset = items.some((voice) => voice.key === current);
        const isClonedVoice = savedVoicesRef.current.some((item) => item.providerVoiceId === current);
        return isPreset || isClonedVoice ? current : (items[0]?.key ?? "");
      });
      setVoiceLoadState("ready");
    } catch (error) {
      setAvailableVoices([]);
      setSelectedVoice("");
      setVoiceLoadState("error");
      setVoiceError(error instanceof Error ? error.message : "Unable to load voices");
    }
  }, []);

  const toggleBackgroundMusic = () => {
    if (backgroundMusic) {
      setBackgroundMusic(false);
      return;
    }
    if (backgroundMusicPresets.length === 0) setBackgroundMusicLoadState("loading");
    setBackgroundMusic(true);
  };

  useEffect(() => {
    if (activeTab !== "Text to Speech") return undefined;
    const timer = window.setTimeout(() => void loadModels(), 0);
    return () => window.clearTimeout(timer);
  }, [activeTab, loadModels]);

  useEffect(() => {
    if (activeTab !== "Text to Speech") return undefined;
    const timer = window.setTimeout(() => void loadVoices(selectedModel || undefined), 0);
    return () => window.clearTimeout(timer);
  }, [activeTab, loadVoices, selectedModel]);

  const refreshSavedVoices = useCallback(async () => {
    try {
      const result = await listVoiceClones();
      savedVoicesRef.current = result.voices;
      setSavedVoices(result.voices);
    } catch {
      // Saved-voices list is a convenience; ignore load failures silently.
    }
  }, []);

  useEffect(() => {
    if (activeTab !== "Text to Speech") return undefined;
    const timer = window.setTimeout(() => void refreshSavedVoices(), 0);
    return () => window.clearTimeout(timer);
  }, [activeTab, refreshSavedVoices]);

  useEffect(() => {
    if (!availableVoices.length) return;
    // Voice metadata arrives asynchronously; reconcile persisted scene voices
    // after the external catalog has loaded.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAudioScenes((current) =>
      current.map((scene, index) =>
        availableVoices.some((voice) => voice.key === scene.voice)
          ? scene
          : { ...scene, voice: availableVoices[index % availableVoices.length]!.key },
      ),
    );
  }, [availableVoices]);

  const updateVoiceScrollButtons = useCallback(() => {
    const row = voiceRowRef.current;
    if (!row) return;
    const maxScrollLeft = Math.max(0, row.scrollWidth - row.clientWidth);
    const currentScrollLeft = Math.min(maxScrollLeft, Math.max(0, row.scrollLeft));
    voiceScrollTargetRef.current = currentScrollLeft;
    setCanScrollVoicesLeft(voiceScrollUserMovedRef.current && currentScrollLeft > 1);
    setCanScrollVoicesRight(maxScrollLeft - currentScrollLeft > 1);
  }, []);

  const scrollVoices = (direction: -1 | 1) => {
    const row = voiceRowRef.current;
    if (!row) return;
    const maxScrollLeft = Math.max(0, row.scrollWidth - row.clientWidth);
    const currentTarget = Math.min(maxScrollLeft, Math.max(0, voiceScrollTargetRef.current));
    const nextTarget = Math.min(maxScrollLeft, Math.max(0, currentTarget + direction * Math.max(row.clientWidth, 180)));
    voiceScrollTargetRef.current = nextTarget;
    if (direction > 0 && nextTarget > 1) voiceScrollUserMovedRef.current = true;
    if (direction < 0 && nextTarget <= 1) voiceScrollUserMovedRef.current = false;
    row.scrollTo({ left: nextTarget, behavior: "smooth" });
    setCanScrollVoicesLeft(voiceScrollUserMovedRef.current && nextTarget > 1);
    setCanScrollVoicesRight(maxScrollLeft - nextTarget > 1);
    window.setTimeout(updateVoiceScrollButtons, 450);
  };

  useEffect(() => {
    const row = voiceRowRef.current;
    if (!row) return;
    // A model switch or async voice refresh can preserve the old horizontal
    // offset. Always start the newly loaded catalog at page one; the left
    // control should only become visible after the user moves right.
    row.scrollLeft = 0;
    voiceScrollTargetRef.current = 0;
    voiceScrollUserMovedRef.current = false;
    setCanScrollVoicesLeft(false);
    updateVoiceScrollButtons();
    row.addEventListener("scroll", updateVoiceScrollButtons, { passive: true });
    const resizeObserver = new ResizeObserver(updateVoiceScrollButtons);
    resizeObserver.observe(row);
    return () => {
      row.removeEventListener("scroll", updateVoiceScrollButtons);
      resizeObserver.disconnect();
    };
  }, [availableVoices.length, selectedModel, voiceLoadState, updateVoiceScrollButtons]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed;
  }, [speed, audioUrl]);

  useEffect(
    () => () => {
      voicePreviewAudioRef.current?.pause();
    },
    [],
  );

  const toggleVoicePreview = useCallback(
    (voice: AudioVoice) => {
      const audio = voicePreviewAudioRef.current;
      if (!audio || !voice.previewUrl) return;
      if (previewingVoiceKey === voice.key && !audio.paused) {
        audio.pause();
        audio.currentTime = 0;
        setPreviewingVoiceKey(null);
        return;
      }
      audio.pause();
      audio.src = voice.previewUrl;
      audio.currentTime = 0;
      setPreviewingVoiceKey(voice.key);
      void audio.play().catch(() => setPreviewingVoiceKey(null));
    },
    [previewingVoiceKey],
  );

  const handleVoicePreviewClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const voice = availableVoices.find((item) => item.key === event.currentTarget.dataset.voiceKey);
      if (voice) toggleVoicePreview(voice);
    },
    [availableVoices, toggleVoicePreview],
  );

  const syncAudioDuration = useCallback((audio: HTMLAudioElement) => {
    const nextDuration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0;
    if (!nextDuration) return;
    durationRef.current = nextDuration;
    setDuration(nextDuration);
    const nextTime = Number.isFinite(audio.currentTime) ? Math.min(audio.currentTime, nextDuration) : 0;
    setCurrentTime(nextTime);
    setProgress(Math.min(100, (nextTime / nextDuration) * 100));
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    durationRef.current = 0;
    if (!audioUrl) return;
    if (!audio) return;
    if (audio.readyState >= 1) syncAudioDuration(audio);
    else audio.load();
  }, [audioUrl, syncAudioDuration]);

  useEffect(() => {
    if (!isPlaying) {
      if (playbackFrameRef.current !== null) window.cancelAnimationFrame(playbackFrameRef.current);
      playbackFrameRef.current = null;
      return;
    }
    const updatePlaybackFrame = () => {
      const audio = audioRef.current;
      if (!audio || audio.paused) {
        playbackFrameRef.current = null;
        return;
      }
      const nextTime = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
      const nextDuration = durationRef.current || (Number.isFinite(audio.duration) ? audio.duration : 0);
      if (nextDuration > 0 && durationRef.current !== nextDuration) {
        durationRef.current = nextDuration;
        setDuration(nextDuration);
      }
      setCurrentTime(nextTime);
      setProgress(nextDuration ? Math.min(100, (nextTime / nextDuration) * 100) : 0);
      playbackFrameRef.current = window.requestAnimationFrame(updatePlaybackFrame);
    };
    playbackFrameRef.current = window.requestAnimationFrame(updatePlaybackFrame);
    return () => {
      if (playbackFrameRef.current !== null) window.cancelAnimationFrame(playbackFrameRef.current);
      playbackFrameRef.current = null;
    };
  }, [isPlaying]);

  const voicePages = Array.from({ length: Math.ceil(availableVoices.length / VOICE_PAGE_SIZE) }, (_, pageIndex) =>
    availableVoices.slice(pageIndex * VOICE_PAGE_SIZE, pageIndex * VOICE_PAGE_SIZE + VOICE_PAGE_SIZE),
  );
  const isSceneMode = activeTab === "Podcast & Dialogue" && audioScenes.length > 0;
  const hasIncompleteScene = audioScenes.some((scene) => !scene.text.trim() || !scene.voice.trim());
  const isGenerating = status === "generating" || sceneGenerationStatus === "generating";
  const clearValues = () => {
    audioRef.current?.pause();
    voicePreviewAudioRef.current?.pause();
    setPrompt("");
    setTone("");
    setVoiceMode("tone");
    setLanguage("Thai");
    setPronunciation("");
    setSelectedModel(availableModels.find((model) => model.isActive)?.key ?? availableModels[0]?.key ?? "");
    setSelectedVoice(availableVoices[0]?.key ?? "");
    setFormat("MP3");
    setSpeed(0.95);
    setPitch(0);
    setSynthVolume(1);
    setBackgroundMusic(false);
    setBackgroundMusicPreset(backgroundMusicPresets[0]?.key ?? "");
    setAudioScenes(defaultAudioScenes.map((scene) => ({ ...scene, text: "", voice: availableVoices[0]?.key ?? "" })));
    setSelectedSceneId(defaultAudioScenes[0]!.id);
    setSelectedScene(defaultAudioScenes[0]!.id);
    setAudioUrl(null);
    setIsPlaying(false);
    setProgress(0);
    setDuration(0);
    setCurrentTime(0);
    durationRef.current = 0;
    setVolume(78);
    setHistoryLoadingId(null);
    setPreviewingVoiceKey(null);
    setCreditEstimate(null);
    setCreditEstimateError(null);
    setErrorMessage(null);
    setSceneError(null);
    setStatus("idle");
    setSceneGenerationStatus("idle");
  };
  const generationValidationMessage = isSceneMode
    ? hasIncompleteScene
      ? t("create.audio.validation.completeScenes")
      : null
    : !prompt.trim()
      ? t("create.audio.validation.addScript")
      : voiceLoadState === "ready" && !selectedVoice
        ? t("create.audio.validation.selectVoice")
        : null;
  const creditQuoteRequest =
    selectedModel && (isSceneMode ? !hasIncompleteScene : Boolean(prompt.trim() && selectedVoice))
      ? isSceneMode
        ? {
            type: "scenes" as const,
            input: {
              scenes: audioScenes.map(({ title, text, voice }) => ({ title, text, voice })),
              modelId: selectedModel,
              outputFormat: format.toLowerCase() as "mp3" | "wav" | "ogg",
              languageCode: language === "Thai" ? "th" : language === "Japanese" ? "ja" : "en",
              ...(tone ? { tone } : {}),
              speed,
              pronunciationHint: pronunciation.trim() || undefined,
              pauseSeconds: 0.25,
              backgroundMusicEnabled: backgroundMusic && Boolean(backgroundMusicPreset),
              backgroundMusicKey: backgroundMusicPreset || undefined,
            },
          }
        : {
            type: "single" as const,
            input: {
              text: prompt,
              voice: selectedVoice,
              modelId: selectedModel,
              outputFormat: format.toLowerCase() as "mp3" | "wav" | "ogg",
              languageCode: language === "Thai" ? "th" : language === "Japanese" ? "ja" : "en",
              ...(tone ? { tone } : {}),
              speed,
              pronunciationHint: pronunciation.trim() || undefined,
              backgroundMusicEnabled: backgroundMusic && Boolean(backgroundMusicPreset),
              backgroundMusicKey: backgroundMusicPreset || undefined,
            },
          }
      : null;
  const creditQuoteKey = JSON.stringify(creditQuoteRequest);

  useEffect(() => {
    let active = true;
    const request =
      creditQuoteKey === "null" ? null : (JSON.parse(creditQuoteKey) as NonNullable<typeof creditQuoteRequest>);
    if (!request) {
      const resetTimer = window.setTimeout(() => {
        if (!active) return;
        setCreditEstimate(null);
        setCreditEstimateError(null);
        setCreditEstimateLoading(false);
      }, 0);
      return () => {
        active = false;
        window.clearTimeout(resetTimer);
      };
    }
    const timer = window.setTimeout(() => {
      setCreditEstimateLoading(true);
      setCreditEstimateError(null);
      const quotePromise =
        request.type === "scenes" ? quoteTextToSpeechScenes(request.input) : quoteTextToSpeech(request.input);
      void quotePromise
        .then((quote) => {
          if (!active) return;
          setCreditEstimate(quote);
        })
        .catch((error: unknown) => {
          if (!active) return;
          setCreditEstimate(null);
          setCreditEstimateError(error instanceof Error ? error.message : "Pricing unavailable");
        })
        .finally(() => {
          if (active) setCreditEstimateLoading(false);
        });
    }, 450);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [creditQuoteKey]);

  const addAudioScene = () => {
    if (audioScenes.length >= 20) return;
    const nextNumber = audioScenes.reduce((highest, scene) => Math.max(highest, Number(scene.id) || 0), 0) + 1;
    const nextScene: AudioScene = {
      id: String(nextNumber).padStart(2, "0"),
      title: t("create.audio.scenes.sceneNumber", { index: nextNumber }),
      durationSeconds: 6,
      text: audioScenes.length === 0 ? prompt : "",
      voice: selectedVoice || availableVoices[0]?.key || "",
    };
    setAudioScenes((current) => [...current, nextScene]);
    setSelectedSceneId(nextScene.id);
    setSceneGenerationStatus("idle");
    setSceneError(null);
  };
  // Not wired to a button yet — multi-scene TTS has no "add scene" UI hook.
  void addAudioScene;

  const formatTime = (seconds: number) => {
    if (!Number.isFinite(seconds) || seconds <= 0) return "00:00";
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
  };

  const appendHistory = (item: AudioHistoryItem) => {
    const nextHistory = [item, ...audioHistoryRef.current];
    const removedItems = nextHistory.slice(AUDIO_HISTORY_LIMIT);
    removedItems.filter((removed) => removed.localUrl).forEach((removed) => URL.revokeObjectURL(removed.url));
    const limitedHistory = nextHistory.slice(0, AUDIO_HISTORY_LIMIT);
    audioHistoryRef.current = limitedHistory;
    setAudioHistory(limitedHistory);
  };

  const persistGeneratedAudio = async (input: SaveAudioHistoryInput): Promise<AudioHistoryEntry | null> => {
    try {
      const saved = await saveAudioHistory(input);
      appendHistory({
        ...saved,
        url: saved.url ?? saved.audioUrl ?? saved.downloadUrl ?? "",
        localUrl: false,
        persisted: true,
      });
      return saved;
    } catch {
      // Generation preview remains available when persistent history storage is unavailable.
      return null;
    }
  };

  const setGeneratedAudioResult = (
    result: TextToSpeechResponse,
    label: string,
    voice: string,
    metadata: Record<string, unknown> = {},
  ) => {
    const nextUrl = URL.createObjectURL(result.blob);
    audioRef.current?.pause();
    historySequenceRef.current += 1;
    const localHistoryItem: AudioHistoryItem = {
      id: `${Date.now()}-${historySequenceRef.current}`,
      url: nextUrl,
      label,
      createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      feature: "tts",
      provider: "wavespeed",
      outputFormat: format.toLowerCase() as "mp3" | "wav" | "ogg",
      mimeType: result.contentType,
      sizeBytes: result.blob.size,
      metadata,
      voice,
      localUrl: true,
      persisted: false,
    };
    const historyItem = result.localHistoryId
      ? { ...localHistoryItem, id: result.localHistoryId, persisted: true }
      : localHistoryItem;
    appendHistory(historyItem);
    setAudioUrl(nextUrl);
    setCurrentTime(0);
    durationRef.current = 0;
    setDuration(0);
    setProgress(0);
    setIsPlaying(false);
  };

  const handleGenerate = async () => {
    setStatus("generating");
    setErrorMessage(null);
    try {
      const result = await createTextToSpeech({
        text: prompt,
        voice: selectedVoice,
        modelId: selectedModel,
        outputFormat: format.toLowerCase() as "mp3" | "wav" | "ogg",
        languageCode: language === "Thai" ? "th" : language === "Japanese" ? "ja" : "en",
        ...(voiceMode === "tone" && tone ? { tone } : {}),
        speed,
        pitch,
        volume: synthVolume,
        pronunciationHint: pronunciation.trim() || undefined,
        backgroundMusicEnabled: backgroundMusic && Boolean(backgroundMusicPreset),
        backgroundMusicKey: backgroundMusicPreset || undefined,
        idempotencyKey: createAudioIdempotencyKey(),
      });
      setGeneratedAudioResult(result, `Generation ${historySequenceRef.current + 1}`, selectedVoice);
      setStatus("complete");
    } catch (error) {
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Audio generation failed");
    }
  };

  const handleGenerateScenes = async () => {
    const scenesToGenerate = audioScenes;
    if (!selectedModel || !availableVoices.length) {
      setSceneError("เลือก Voice Model และ Voice ก่อน Generate");
      setSceneGenerationStatus("error");
      return;
    }
    if (scenesToGenerate.some((scene) => !scene.text.trim())) {
      setSceneError("กรุณาใส่ข้อความให้ทุก Scene");
      setSceneGenerationStatus("error");
      return;
    }
    if (scenesToGenerate.some((scene) => !scene.voice.trim())) {
      setSceneError("กรุณาเลือก Voice ให้ทุก Scene");
      setSceneGenerationStatus("error");
      return;
    }
    if (!scenesToGenerate.length) {
      setSceneError("กรุณาใส่ข้อความอย่างน้อย 1 Scene");
      setSceneGenerationStatus("error");
      return;
    }
    setSceneGenerationStatus("generating");
    setStatus("generating");
    setSceneError(null);
    setErrorMessage(null);
    try {
      const result = await createTextToSpeechScenes({
        scenes: scenesToGenerate.map(({ title, text, voice }) => ({ title, text, voice })),
        modelId: selectedModel,
        outputFormat: format.toLowerCase() as "mp3" | "wav" | "ogg",
        languageCode: language === "Thai" ? "th" : language === "Japanese" ? "ja" : "en",
        ...(voiceMode === "tone" && tone ? { tone } : {}),
        speed,
        pitch,
        volume: synthVolume,
        pronunciationHint: pronunciation.trim() || undefined,
        pauseSeconds: 0.25,
        backgroundMusicEnabled: backgroundMusic && Boolean(backgroundMusicPreset),
        backgroundMusicKey: backgroundMusicPreset || undefined,
        idempotencyKey: createAudioIdempotencyKey(),
      });
      setGeneratedAudioResult(result, `Scenes · ${scenesToGenerate.length} scenes`, scenesToGenerate[0]!.voice, {
        sceneCount: scenesToGenerate.length,
      });
      setSceneGenerationStatus("complete");
      setStatus("complete");
    } catch (error) {
      setSceneGenerationStatus("error");
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Scene generation failed");
      setSceneError(error instanceof Error ? error.message : "Scene generation failed");
    }
  };

  const playHistoryUrl = (nextUrl: string) => {
    setAudioUrl(nextUrl);
    const audio = audioRef.current;
    if (!audio) {
      setHistoryLoadingId(null);
      return;
    }
    audio.src = nextUrl;
    audio.load();
    void audio
      .play()
      .then(() => {
        setIsPlaying(true);
        setHistoryLoadingId(null);
      })
      .catch(() => {
        setIsPlaying(false);
        setHistoryLoadingId(null);
      });
  };

  const selectHistoryItem = (item: AudioHistoryItem) => {
    if (!item.id) return;
    const audio = audioRef.current;
    const isCurrentItem = Boolean(item.url && item.url === audioUrl);
    if (isCurrentItem && audio) {
      setHistoryLoadingId(null);
      if (audio.paused) {
        if (audio.ended || (durationRef.current > 0 && audio.currentTime >= durationRef.current)) audio.currentTime = 0;
        void audio
          .play()
          .then(() => setIsPlaying(true))
          .catch(() => setIsPlaying(false));
      } else {
        audio.pause();
        setIsPlaying(false);
      }
      return;
    }
    setHistoryLoadingId(item.id);
    audio?.pause();
    setCurrentTime(0);
    durationRef.current = 0;
    setDuration(0);
    setProgress(0);
    setIsPlaying(false);
    setErrorMessage(null);
    if (item.url) {
      playHistoryUrl(item.url);
      return;
    }
    void fetchAudioHistoryAudio(item.id)
      .then((result) => {
        const nextUrl = URL.createObjectURL(result.blob);
        const nextHistory = audioHistoryRef.current.map((historyItem) =>
          historyItem.id === item.id ? { ...historyItem, url: nextUrl, localUrl: true } : historyItem,
        );
        audioHistoryRef.current = nextHistory;
        setAudioHistory(nextHistory);
        playHistoryUrl(nextUrl);
      })
      .catch((error) => {
        setHistoryLoadingId(null);
        setErrorMessage(error instanceof Error ? error.message : "Unable to load saved audio");
      });
  };

  /* Two pieces of state, not one: `open` drives the close animation while the
     pending item has to outlive it, or the copy blanks out mid-fade. */
  const [pendingHistoryDelete, setPendingHistoryDelete] = useState<AudioHistoryItem | null>(null);
  const [historyDeleteOpen, setHistoryDeleteOpen] = useState(false);

  const removeHistoryItem = (item: AudioHistoryItem) => {
    const removeFromView = () => {
      if (item.localUrl && item.url) URL.revokeObjectURL(item.url);
      const nextHistory = audioHistoryRef.current.filter((historyItem) => historyItem.id !== item.id);
      audioHistoryRef.current = nextHistory;
      setAudioHistory(nextHistory);
      if (audioUrl === item.url) {
        audioRef.current?.pause();
        setAudioUrl(null);
        setCurrentTime(0);
        durationRef.current = 0;
        setDuration(0);
        setProgress(0);
        setIsPlaying(false);
        setStatus("idle");
      }
    };
    if (!item.persisted) {
      removeFromView();
      return;
    }
    void deleteAudioHistory(item.id)
      .then(removeFromView)
      .catch((error) => {
        setErrorMessage(error instanceof Error ? error.message : "Unable to delete saved audio");
      });
  };

  const togglePlayback = () => {
    const audio = audioRef.current;
    if (!audioUrl || !audio) return;
    if (audio.paused)
      void audio
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    else {
      audio.pause();
      setIsPlaying(false);
    }
  };

  const downloadAudio = () => {
    if (!audioUrl) return;
    const link = document.createElement("a");
    link.href = audioUrl;
    link.download = `eos-audio-${Date.now()}.${format.toLowerCase()}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const seekBy = (amount: number) => {
    if (!audioRef.current) return;
    const audioDuration = durationRef.current || duration;
    audioRef.current.currentTime = Math.max(0, Math.min(audioDuration, audioRef.current.currentTime + amount));
  };

  useTemplateSettings("audio", {
    ready: modelLoadState === "ready" && voiceLoadState === "ready",
    model: selectedModel,
    models: availableModels.map((m) => m.key),
    setModel: setSelectedModel,
    apply: (s, p) => {
      setPrompt(p);
      setAudioScenes((current) => current.map((scene, i) => (i === 0 ? { ...scene, text: p } : scene)));
      if (typeof s.voice === "string") {
        if (availableVoices.some((v) => v.key === s.voice)) setSelectedVoice(s.voice);
        else {
          setSelectedVoice("");
          window.alert("เสียงในเทมเพลตไม่พร้อมใช้ กรุณาเลือกเสียงใหม่ก่อนสร้าง");
        }
      }
      if (typeof s.outputFormat === "string") setFormat(s.outputFormat.toUpperCase());
      if (typeof s.speed === "number") setSpeed(s.speed);
      if (typeof s.tone === "string" && tones.some(({ label }) => label === s.tone))
        setTone(s.tone as Exclude<typeof tone, "">);
      if (typeof s.languageCode === "string")
        setLanguage(s.languageCode === "th" ? "Thai" : s.languageCode === "ja" ? "Japanese" : "English (US)");
      if (typeof s.pronunciationHint === "string") setPronunciation(s.pronunciationHint);
    },
  });
  return (
    <div className={`${styles.audioPage} audio-studio-page`}>
      <section className={`studio-hero-frame ${styles.heroBanner}`} aria-label={t("create.audio.a11y.hero")}>
        <picture>
          <source
            media="(max-width: 767.98px)"
            srcSet="/generated-assets/studio-heroes-v4/create-audio-mobile-v2.webp"
          />
          <Image
            src="/generated-assets/studio-heroes-v4/create-audio-desktop-v2.webp"
            alt="Gen Audio — AI audio generation studio"
            width={2400}
            height={435}
            priority
            sizes="100vw"
          />
        </picture>
      </section>

      <CreatorWorkspaceLayout
        tabs={
          <nav className={styles.featureTabs} aria-label={t("create.audio.tools")}>
            {visibleTabs.map((label) => {
              const TabIcon = audioModeIcons[label];
              return (
                <button
                  key={label}
                  type="button"
                  className={activeTab === label ? styles.tabActive : styles.tab}
                  onClick={() => changeActiveTab(label)}
                  aria-pressed={activeTab === label}
                >
                  <TabIcon size={16} aria-hidden="true" />
                  {t(audioTabKeys[label])}
                </button>
              );
            })}
          </nav>
        }
        mobileTabs={
          <MobileModeDropdown
            menuId="audio-mode-menu"
            value={activeTab}
            options={visibleTabs.map((label) => ({
              value: label,
              label: t(audioTabKeys[label]),
              icon: audioModeIcons[label],
            }))}
            ariaLabel={t("create.audio.tools")}
            currentModeLabel={t("create.mode.current")}
            switchModeLabel={t("create.mode.switch")}
            otherModesLabel={t("create.mode.other")}
            onChange={changeActiveTab}
          />
        }
        content={
          <>
            {activeTab === "Text to Speech" ? (
              <div className={styles.audioGrid}>
                <section className={styles.scriptPanel} aria-label={t("create.audio.a11y.scriptPanel")}>
                  <div className={styles.audioPromptTopActions}>
                    <ImageTutorialButton feature="textToSpeech" featureName="Text to Speech" />
                    <ClearValuesButton onClick={clearValues} disabled={isGenerating} />
                  </div>
                  <div className={styles.panelHeading}>
                    <h2>
                      <span>1</span> {t("create.audio.scriptPrompt")}
                    </h2>
                    <InfoTooltip content={t("create.audio.info.script")} size={14} />
                  </div>
                  <div className={styles.promptBox}>
                    <textarea
                      aria-label={t("create.audio.a11y.scriptInput")}
                      value={prompt}
                      onChange={(event) => {
                        const value = event.target.value;
                        setPrompt(value);
                        setAudioScenes((current) =>
                          current.map((scene) => (scene.id === "01" ? { ...scene, text: value } : scene)),
                        );
                      }}
                      maxLength={promptMaxLength}
                    />
                    <div className={styles.promptMeta}>
                      <span>
                        {prompt.length.toLocaleString()} / {promptMaxLength.toLocaleString()}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setPrompt("");
                          setAudioScenes((current) =>
                            current.map((scene) => (scene.id === "01" ? { ...scene, text: "" } : scene)),
                          );
                        }}
                      >
                        {t("create.audio.clear")} <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  <div className={styles.inputSection}>
                    <SelectField
                      label={t("create.audio.voiceMode.label")}
                      value={voiceMode}
                      onChange={(value) => setVoiceMode(value as "tone" | "cloned")}
                      options={[
                        { value: "tone", label: t("create.audio.voiceMode.tone") },
                        { value: "cloned", label: t("create.audio.voiceMode.cloned") },
                      ]}
                    />

                    {voiceMode === "tone" ? (
                      <div className={styles.chipRow}>
                        {tones.map(({ label, icon: ToneIcon }) => (
                          <button
                            type="button"
                            key={label}
                            className={tone === label ? styles.toneActive : styles.toneButton}
                            onClick={() => setTone((current) => (current === label ? "" : label))}
                            aria-pressed={tone === label}
                          >
                            <ToneIcon size={12} />
                            {t(toneKeys[label])}
                          </button>
                        ))}
                      </div>
                    ) : null}

                    {voiceMode === "cloned" ? (
                      <section className={styles.historyPanel}>
                        <div className={styles.sectionHeading}>
                          <h2>
                            <Mic2 size={13} /> {t("create.audio.clone.savedVoices")}
                          </h2>
                          <span className={styles.timelineHint}>
                            {savedVoices.length
                              ? savedVoices.length === 1
                                ? t("create.audio.resultCountOne")
                                : t("create.audio.resultCountMany", { count: savedVoices.length })
                              : t("create.audio.noResults")}
                          </span>
                        </div>
                        {savedVoices.length ? (
                          <div className={styles.historyList}>
                            {savedVoices.map((item) => (
                              <div
                                key={item.id}
                                className={
                                  selectedVoice === item.providerVoiceId
                                    ? styles.historyItemRowActive
                                    : styles.historyItemRow
                                }
                              >
                                <button
                                  type="button"
                                  className={
                                    selectedVoice === item.providerVoiceId
                                      ? styles.historyItemActive
                                      : styles.historyItem
                                  }
                                  onClick={() => item.providerVoiceId && setSelectedVoice(item.providerVoiceId)}
                                  disabled={!item.providerVoiceId}
                                >
                                  <span className={styles.historyPlay}>
                                    <Mic2 size={13} />
                                  </span>
                                  <span className={styles.historyCopy}>
                                    <strong>{item.name}</strong>
                                    <small>{item.character || t("create.audio.clone.characterNatural")}</small>
                                  </span>
                                  <span className={styles.historyCurrent}>
                                    {!item.providerVoiceId
                                      ? t("create.audio.voiceMode.notReady")
                                      : selectedVoice === item.providerVoiceId
                                        ? t("create.audio.clone.voiceSelected")
                                        : t("create.audio.clone.selectVoice")}
                                  </span>
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className={styles.historyEmpty}>
                            <Mic2 size={15} />
                            <span>{t("create.audio.noResults")}</span>
                          </div>
                        )}
                        <button
                          type="button"
                          className={styles.voiceCloneLink}
                          onClick={() => setActiveTab("Voice Clone")}
                        >
                          {t("create.audio.voiceMode.cloneNewLink")}
                        </button>
                      </section>
                    ) : null}
                  </div>

                  <div className={styles.twoColumnFields}>
                    <SelectField
                      label={t("create.audio.language")}
                      value={language}
                      onChange={setLanguage}
                      options={[
                        { value: "Thai", label: "ภาษาไทย" },
                        { value: "English (US)", label: "English (US)" },
                      ]}
                    />
                    <label className={styles.selectField}>
                      <FieldLabel>{t("create.audio.pronunciationHints")}</FieldLabel>
                      <input
                        value={pronunciation}
                        onChange={(event) => setPronunciation(event.target.value)}
                        placeholder={"e.g. EOS as “อี-โอ-เอส”"}
                      />
                    </label>
                  </div>
                </section>

                <section className={styles.centerColumn} aria-label={t("create.audio.a11y.centerColumn")}>
                  <div className={`${styles.sectionBlock} ${styles.voiceSection}`}>
                    <div className={styles.sectionHeading}>
                      <h2>{t("create.audio.voiceSpeaker")}</h2>
                    </div>
                    <div className={styles.voiceCarousel}>
                      {canScrollVoicesLeft ? (
                        <button
                          type="button"
                          className={`${styles.voiceCarouselButton} ${styles.voiceCarouselButtonLeft}`}
                          onClick={() => scrollVoices(-1)}
                          aria-label="เลื่อน Voice ไปทางซ้าย"
                          aria-controls="audio-voice-carousel"
                        >
                          <ChevronLeft size={16} />
                        </button>
                      ) : null}
                      <div
                        ref={voiceRowRef}
                        id="audio-voice-carousel"
                        className={styles.voiceRow}
                        onWheel={() => {
                          voiceScrollUserMovedRef.current = true;
                        }}
                        onTouchMove={() => {
                          voiceScrollUserMovedRef.current = true;
                        }}
                      >
                        {voiceLoadState === "loading" ? (
                          <div className={styles.voiceState} role="status">
                            {t("create.audio.loadingVoices")}
                          </div>
                        ) : null}
                        {voiceLoadState === "error" ? (
                          <div className={styles.voiceStateError} role="alert">
                            <span>{voiceError ?? t("create.audio.voicesError")}</span>
                            <button
                              type="button"
                              className={styles.voiceRetry}
                              onClick={() => void loadVoices(selectedModel || undefined)}
                            >
                              {t("create.audio.tryAgain")}
                            </button>
                          </div>
                        ) : null}
                        {voiceLoadState === "ready" && availableVoices.length === 0 ? (
                          <div className={styles.voiceState}>{t("create.audio.noVoices")}</div>
                        ) : null}
                        {voiceLoadState === "ready"
                          ? voicePages.map((page, pageIndex) => (
                              <div className={styles.voicePage} key={`voice-page-${pageIndex}`}>
                                {page.map((voice, index) => (
                                  <div
                                    className={`${styles.voiceCardWrap} ${selectedVoice === voice.key ? styles.voiceCardWrapActive : ""}`}
                                    key={voice.key}
                                  >
                                    <button
                                      type="button"
                                      className={
                                        selectedVoice === voice.key ? styles.voiceCardActive : styles.voiceCard
                                      }
                                      onClick={() => setSelectedVoice(voice.key)}
                                      aria-pressed={selectedVoice === voice.key}
                                    >
                                      <div className={styles.voiceImage}>
                                        <Image
                                          src={
                                            voice.imageUrl ||
                                            voiceImages[(pageIndex * VOICE_PAGE_SIZE + index) % voiceImages.length]
                                          }
                                          alt=""
                                          fill
                                          unoptimized
                                          sizes="60px"
                                        />
                                      </div>
                                      <strong>{voice.name}</strong>
                                      <small>{voice.description || t("create.audio.voiceFallback")}</small>
                                      {selectedVoice === voice.key ? (
                                        <Check size={14} className={styles.voiceCheck} />
                                      ) : null}
                                    </button>
                                    <button
                                      type="button"
                                      data-voice-key={voice.key}
                                      className={`${styles.voicePreviewButton} ${previewingVoiceKey === voice.key ? styles.voicePreviewButtonActive : ""}`}
                                      onClick={handleVoicePreviewClick}
                                      disabled={!voice.previewUrl}
                                      aria-label={
                                        voice.previewUrl
                                          ? previewingVoiceKey === voice.key
                                            ? `หยุดตัวอย่างเสียง ${voice.name}`
                                            : `ฟังตัวอย่างเสียง ${voice.name}`
                                          : `ยังไม่มีตัวอย่างเสียง ${voice.name}`
                                      }
                                      title={voice.previewUrl ? "ฟังตัวอย่างเสียง" : "ยังไม่มีตัวอย่างเสียง"}
                                    >
                                      {previewingVoiceKey === voice.key ? (
                                        <span className={styles.voicePauseGlyph} />
                                      ) : (
                                        <Play size={11} fill="currentColor" />
                                      )}
                                    </button>
                                  </div>
                                ))}
                              </div>
                            ))
                          : null}
                      </div>
                      {canScrollVoicesRight ? (
                        <button
                          type="button"
                          className={`${styles.voiceCarouselButton} ${styles.voiceCarouselButtonRight}`}
                          onClick={() => scrollVoices(1)}
                          aria-label="เลื่อน Voice ไปทางขวา"
                          aria-controls="audio-voice-carousel"
                        >
                          <ChevronRight size={16} />
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <audio
                    ref={voicePreviewAudioRef}
                    className={styles.hiddenAudio}
                    preload="none"
                    onEnded={() => setPreviewingVoiceKey(null)}
                    onError={() => setPreviewingVoiceKey(null)}
                    aria-hidden="true"
                  />

                  {audioUrl ? (
                    <div className={styles.previewPanel}>
                      <div className={styles.previewHeader}>
                        <h2>{t("create.audio.preview")}</h2>
                        <div className={styles.previewActions}>
                          <button
                            type="button"
                            className={styles.outlineAction}
                            onClick={downloadAudio}
                            disabled={!audioUrl}
                          >
                            <Download size={15} /> {t("create.audio.download")}
                          </button>
                        </div>
                      </div>
                      <PreviewWaveform audioUrl={audioUrl} progress={progress} isPlaying={isPlaying} />
                      <div className={styles.playerRow}>
                        <button
                          type="button"
                          className={styles.playButton}
                          onClick={togglePlayback}
                          aria-label={t(isPlaying ? "create.audio.a11y.pause" : "create.audio.a11y.play")}
                          disabled={!audioUrl}
                        >
                          {isPlaying ? <span className={styles.pauseGlyph} /> : <Play size={20} fill="currentColor" />}
                        </button>
                        <button
                          type="button"
                          className={styles.skipButton}
                          onClick={() => seekBy(-10)}
                          aria-label={t("create.audio.a11y.rewind10")}
                          disabled={!audioUrl}
                        >
                          <RotateCcw size={17} />
                          <small>10</small>
                        </button>
                        <button
                          type="button"
                          className={styles.skipButton}
                          onClick={() => seekBy(10)}
                          aria-label={t("create.audio.a11y.forward10")}
                          disabled={!audioUrl}
                        >
                          <RotateCw size={17} />
                          <small>10</small>
                        </button>
                        <span className={styles.timeLabel}>
                          {formatTime(currentTime)} / {formatTime(duration)}
                        </span>
                        <input
                          className={styles.scrubber}
                          type="range"
                          min="0"
                          max="100"
                          value={progress}
                          onChange={(event) => {
                            const nextProgress = Number(event.target.value);
                            const audioDuration = durationRef.current || duration;
                            setProgress(nextProgress);
                            if (audioRef.current && audioDuration)
                              audioRef.current.currentTime = (nextProgress / 100) * audioDuration;
                          }}
                          aria-label={t("create.audio.a11y.audioProgress")}
                          disabled={!audioUrl}
                        />
                        <Volume2 size={17} className={styles.volumeIcon} />
                        <input
                          className={styles.volumeSlider}
                          type="range"
                          min="0"
                          max="100"
                          value={volume}
                          onChange={(event) => {
                            const nextVolume = Number(event.target.value);
                            setVolume(nextVolume);
                            if (audioRef.current) audioRef.current.volume = nextVolume / 100;
                          }}
                          aria-label={t("create.audio.a11y.volume")}
                        />
                      </div>
                      <audio
                        ref={audioRef}
                        src={audioUrl ?? undefined}
                        preload="metadata"
                        onLoadedMetadata={(event) => {
                          syncAudioDuration(event.currentTarget);
                          event.currentTarget.volume = volume / 100;
                          event.currentTarget.playbackRate = speed;
                        }}
                        onDurationChange={(event) => syncAudioDuration(event.currentTarget)}
                        onTimeUpdate={(event) => {
                          const nextTime = event.currentTarget.currentTime;
                          const nextDuration =
                            durationRef.current ||
                            (Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0);
                          if (nextDuration > 0 && durationRef.current !== nextDuration) {
                            durationRef.current = nextDuration;
                            setDuration(nextDuration);
                          }
                          setCurrentTime(nextTime);
                          setProgress(nextDuration ? Math.min(100, (nextTime / nextDuration) * 100) : 0);
                        }}
                        onPlay={() => setIsPlaying(true)}
                        onPause={() => setIsPlaying(false)}
                        onEnded={(event) => {
                          const endDuration = durationRef.current || event.currentTarget.duration;
                          setIsPlaying(false);
                          if (Number.isFinite(endDuration) && endDuration > 0) {
                            durationRef.current = endDuration;
                            setDuration(endDuration);
                            setCurrentTime(endDuration);
                          }
                          setProgress(100);
                        }}
                      />
                      {errorMessage ? (
                        <p className={styles.securityNote} role="alert">
                          {errorMessage}
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  <section className={styles.historyPanel} aria-label={t("create.audio.a11y.historyPanel")}>
                    <div className={styles.sectionHeading}>
                      <h2>
                        <History size={13} /> {t("create.audio.generationHistory")}
                      </h2>
                      <span className={styles.timelineHint}>
                        {audioHistory.length
                          ? audioHistory.length === 1
                            ? t("create.audio.resultCountOne")
                            : t("create.audio.resultCountMany", { count: audioHistory.length })
                          : t("create.audio.noResults")}
                      </span>
                    </div>
                    {audioHistory.length ? (
                      <div className={styles.historyList}>
                        {audioHistory.map((item) => (
                          <div
                            key={item.id}
                            className={item.url === audioUrl ? styles.historyItemRowActive : styles.historyItemRow}
                          >
                            <button
                              type="button"
                              className={item.url === audioUrl ? styles.historyItemActive : styles.historyItem}
                              onClick={() => selectHistoryItem(item)}
                              disabled={historyLoadingId === item.id}
                              aria-busy={historyLoadingId === item.id}
                            >
                              <span
                                className={historyLoadingId === item.id ? styles.historyLoading : styles.historyPlay}
                              >
                                {historyLoadingId === item.id ? null : isPlaying && item.url === audioUrl ? (
                                  <Pause size={13} fill="currentColor" />
                                ) : (
                                  <Play size={13} fill="currentColor" />
                                )}
                              </span>
                              <span className={styles.historyCopy}>
                                <strong>{item.label}</strong>
                                <small>{formatAudioHistoryDate(item.createdAt, locale)}</small>
                              </span>
                              <span className={styles.historyCurrent}>
                                {item.url === audioUrl
                                  ? t("create.audio.historyCurrent")
                                  : t("create.audio.historyPlay")}
                              </span>
                            </button>
                            <button
                              type="button"
                              className={styles.historyDelete}
                              aria-label={t("create.audio.a11y.deleteItem", { label: item.label })}
                              onClick={() => {
                                setPendingHistoryDelete(item);
                                setHistoryDeleteOpen(true);
                              }}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className={styles.historyEmpty}>
                        <History size={15} />
                        <span>{t("create.audio.historyEmpty")}</span>
                      </div>
                    )}
                  </section>
                </section>

                <aside className={styles.settingsPanel} aria-label={t("create.audio.a11y.settingsPanel")}>
                  <div className={`${styles.settingsTitle} flex-wrap gap-2`}>
                    <h2>{t("create.audio.settings")}</h2>
                    <WandSparkles size={22} />
                  </div>
                  <div className={styles.settingBlock}>
                    <SelectField
                      label={t("create.audio.voiceModel")}
                      value={selectedModel}
                      onChange={(modelId) => {
                        setSelectedModel(modelId);
                        setSelectedVoice("");
                      }}
                      disabled={modelLoadState !== "ready" || availableModels.length === 0}
                      loading={modelLoadState === "loading"}
                      options={availableModels.map((model) => ({
                        value: model.key,
                        label: model.name,
                        preserveLabel: true,
                      }))}
                    />
                  </div>
                  <div className={styles.settingBlock}>
                    <FieldLabel>{t("create.audio.outputFormat")}</FieldLabel>
                    <div className={styles.formatRow}>
                      {["MP3", "WAV", "OGG"].map((item) => (
                        <button
                          type="button"
                          key={item}
                          className={format === item ? styles.formatActive : styles.formatButton}
                          onClick={() => setFormat(item)}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className={styles.settingBlock}>
                    <div className={styles.speedHeader}>
                      <FieldLabel>{t("create.audio.speechSpeed")}</FieldLabel>
                      <strong>{speed.toFixed(2)}x</strong>
                    </div>
                    <input
                      className={styles.speedSlider}
                      type="range"
                      min="0.5"
                      max="2"
                      step="0.05"
                      value={speed}
                      onChange={(event) => setSpeed(Number(event.target.value))}
                    />
                    <div className={styles.rangeLabels}>
                      <span>0.5x</span>
                      <span>1x</span>
                      <span>2x</span>
                    </div>
                  </div>
                  <div className={styles.settingBlock}>
                    <div className={styles.speedHeader}>
                      <FieldLabel>{t("create.audio.pitch")}</FieldLabel>
                      <strong>{pitch}</strong>
                    </div>
                    <input
                      className={styles.speedSlider}
                      type="range"
                      min="-12"
                      max="12"
                      step="1"
                      value={pitch}
                      onChange={(event) => setPitch(Number(event.target.value))}
                    />
                    <div className={styles.rangeLabels}>
                      <span>-12</span>
                      <span>0</span>
                      <span>12</span>
                    </div>
                  </div>
                  <div className={styles.settingBlock}>
                    <div className={styles.speedHeader}>
                      <FieldLabel>{t("create.audio.synthVolume")}</FieldLabel>
                      <strong>{synthVolume.toFixed(1)}x</strong>
                    </div>
                    <input
                      className={styles.speedSlider}
                      type="range"
                      min="0.5"
                      max="10"
                      step="0.5"
                      value={synthVolume}
                      onChange={(event) => setSynthVolume(Number(event.target.value))}
                    />
                    <div className={styles.rangeLabels}>
                      <span>0.5x</span>
                      <span>1x</span>
                      <span>10x</span>
                    </div>
                  </div>
                  <div className={styles.settingBlock}>
                    <div className={styles.musicHeader}>
                      <FieldLabel>{t("create.audio.autoBackgroundMusic")}</FieldLabel>
                      <button
                        type="button"
                        className={backgroundMusic ? styles.toggleOn : styles.toggleOff}
                        onClick={toggleBackgroundMusic}
                        aria-pressed={backgroundMusic}
                        disabled={backgroundMusicLoadState === "loading"}
                      >
                        <span />
                      </button>
                    </div>
                    {backgroundMusic ? (
                      <SelectField
                        label=""
                        value={backgroundMusicPreset}
                        onChange={setBackgroundMusicPreset}
                        disabled={backgroundMusicLoadState !== "ready" || backgroundMusicPresets.length === 0}
                        loading={backgroundMusicLoadState === "loading"}
                        options={backgroundMusicPresets.map((preset) => ({ value: preset.key, label: preset.name }))}
                      />
                    ) : null}
                  </div>
                  <div data-mobile-action-dock className={styles.mobileActionDock}>
                    <div className={styles.creditEstimate} title={creditEstimateError ?? undefined}>
                      <div className={styles.creditEstimateHeader}>
                        <strong>
                          {t("create.audio.estimatedCredits")}{" "}
                          <InfoTooltip content={t("create.audio.info.estimatedCredits")} size={11} />
                        </strong>
                        <b>
                          {creditEstimateLoading || modelLoadState === "loading" || voiceLoadState === "loading"
                            ? t("create.audio.calculating")
                            : creditEstimate
                              ? t("create.audio.creditsAmount", {
                                  amount: formatCreditAmount(creditEstimate.creditCost),
                                })
                              : "—"}
                        </b>
                      </div>
                      <p className={styles.creditEstimateCount}>
                        {isSceneMode
                          ? audioScenes.length === 1
                            ? t("create.audio.sceneCountOne")
                            : t("create.audio.sceneCountMany", { count: audioScenes.length })
                          : t("create.audio.audioCount")}
                      </p>
                    </div>
                    {generationValidationMessage ? (
                      <p className={styles.generationValidation} role="status">
                        {generationValidationMessage}
                      </p>
                    ) : null}
                    <button
                      type="button"
                      className={styles.generateButton}
                      onClick={() => void (isSceneMode ? handleGenerateScenes() : handleGenerate())}
                      disabled={
                        isGenerating ||
                        !selectedModel ||
                        voiceLoadState !== "ready" ||
                        (isSceneMode ? hasIncompleteScene : !prompt.trim() || !selectedVoice)
                      }
                    >
                      {isGenerating ? (
                        <>
                          <span className={styles.spinner} /> {t("create.audio.generating")}
                        </>
                      ) : (
                        <>
                          {t("create.audio.generateAudio")} <Sparkles size={17} />
                        </>
                      )}
                    </button>
                    <p className={styles.securityNote}>
                      <LockKeyhole size={11} /> {t("create.audio.privateSecure")}
                    </p>
                  </div>
                </aside>
              </div>
            ) : activeTab === "Podcast & Dialogue" ? (
              <PodcastDialogueLayout onHistorySaved={persistGeneratedAudio} />
            ) : activeTab === "Voice Clone" ? (
              <VoiceCloneLayout onHistorySaved={persistGeneratedAudio} />
            ) : activeTab === "Sound Effects" ? (
              <SoundEffectsLayout onHistorySaved={persistGeneratedAudio} />
            ) : (
              <AudioCleanupLayout />
            )}
          </>
        }
      />
      <Dialog
        open={historyDeleteOpen}
        onOpenChange={(next) => {
          if (!next) setHistoryDeleteOpen(false);
        }}
        onOpenChangeComplete={(next) => {
          if (!next) setPendingHistoryDelete(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("create.audio.deleteHistory.title")}</DialogTitle>
            <DialogDescription>
              {t("create.audio.deleteHistory.body", { label: pendingHistoryDelete?.label ?? "" })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="ghost" size="sm" onClick={() => setHistoryDeleteOpen(false)}>
              {t("create.audio.deleteHistory.cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => {
                if (pendingHistoryDelete) removeHistoryItem(pendingHistoryDelete);
                setHistoryDeleteOpen(false);
              }}
            >
              <Trash2 size={15} /> {t("create.audio.deleteHistory.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
