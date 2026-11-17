import { useCallback, useEffect, useRef, useState } from "react";
import {
  AudioWaveform,
  Copy,
  Download,
  History,
  LockKeyhole,
  Pause,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  Volume2,
} from "lucide-react";
import { InfoTooltip } from "@/features/create/components/info-tooltip";
import { useLocale } from "@/lib/i18n/locale-provider";
import { Dropdown } from "@/components/ui/dropdown";
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
  deleteAudioHistory,
  fetchAudioHistoryAudio,
  listAudioBackgroundMusic,
  listAudioHistory,
  listAudioVoices,
  previewAudioVoice,
  quoteDialogue,
  type AudioBackgroundMusic,
  type AudioCreditQuote,
  type AudioVoice,
  type DialogueEmotionTag,
  type SaveAudioHistoryInput,
} from "@/lib/api/audio";
import Image from "next/image";
import styles from "./audio-generation-page.module.css";
import {
  type AudioHistoryItem,
  type PodcastLine,
  type PodcastSpeaker,
  type PodcastSpeakerDraft,
  type SaveHistoryCallback,
} from "./audio-generation.types";
import {
  AUDIO_HISTORY_LIMIT,
  MIN_PODCAST_SPEAKERS,
  defaultPodcastLines,
  defaultPodcastSpeakers,
  podcastSpeakerTones,
} from "./audio-generation.constants";
import {
  createAudioIdempotencyKey,
  estimatePodcastLineSeconds,
  failAudioProgress,
  finishAudioProgress,
  formatAudioHistoryDate,
  formatCreditAmount,
  formatSceneSeconds,
  getPodcastVoiceAvatar,
  startAudioProgress,
} from "./audio-generation.helpers";
import { PreviewWaveform } from "./audio-shared-parts";
import {
  AutoGrowPodcastLineInput,
  PodcastConfirmationDialog,
  PodcastVoicePicker,
} from "./podcast-parts";

export function PodcastDialogueLayout({ onHistorySaved }: { onHistorySaved?: SaveHistoryCallback }) {
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
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "generating" | "ready" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [podcastHistory, setPodcastHistory] = useState<AudioHistoryItem[]>([]);
  const [podcastHistoryLoadingId, setPodcastHistoryLoadingId] = useState<string | null>(null);
  const [podcastHistorySavingId, setPodcastHistorySavingId] = useState<string | null>(null);
  const [podcastHistorySaveFailed, setPodcastHistorySaveFailed] = useState(false);
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
  const [pendingLineDeleteId, setPendingLineDeleteId] = useState<string | null>(null);
  const [editingSpeakerId, setEditingSpeakerId] = useState<string | null>(null);
  const [speakerDraft, setSpeakerDraft] = useState<PodcastSpeakerDraft>({ role: "", name: "", voice: "" });
  const [speakerFormError, setSpeakerFormError] = useState<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement>(null);
  const pendingPodcastHistoryPlaybackRef = useRef(false);
  const voicePreviewAudioRef = useRef<HTMLAudioElement | null>(null);
  const voicePreviewObjectUrlsRef = useRef<string[]>([]);
  const voicePreviewRequestRef = useRef(0);
  const podcastHistoryRef = useRef<AudioHistoryItem[]>([]);
  const podcastHistoryPlaybackRequestRef = useRef(0);
  const pendingPodcastHistorySavesRef = useRef(new Map<string, SaveAudioHistoryInput>());

  const totalDuration = lines.reduce((total, line) => total + estimatePodcastLineSeconds(line.text), 0);
  // Keep the visible count identical to the trimmed text sent in episodeScript
  // and count Unicode characters rather than UTF-16 code units.
  const dialogueCharacterCount = lines.reduce((total, line) => total + Array.from(line.text.trim()).length, 0);
  const dialogueCharacterLimit = 2000;
  const spokenLines = lines.filter((line) => line.text.trim());
  const episodeScript = spokenLines
    .map((line) => `${speakers.find((speaker) => speaker.id === line.speakerId)?.role ?? "Speaker"}: ${line.text.trim()}`)
    .join("\n");
  const episodeEmotionTags = spokenLines.map((line) => line.emotionTag ?? "natural");
  useEffect(
    () => () => {
      voicePreviewAudioRef.current?.pause();
      podcastHistoryPlaybackRequestRef.current += 1;
      podcastHistoryRef.current
        .filter((item) => item.localUrl && item.url)
        .forEach((item) => URL.revokeObjectURL(item.url));
    },
    [],
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
        const savedHistory = items.map((item) => ({
          ...item,
          url: item.url ?? item.audioUrl ?? item.downloadUrl ?? "",
          localUrl: false,
          persisted: true,
        }));
        const localHistory = podcastHistoryRef.current.filter((item) => !item.persisted);
        const history = [...localHistory, ...savedHistory].slice(0, AUDIO_HISTORY_LIMIT);
        podcastHistoryRef.current = history;
        setPodcastHistory(history);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const podcastCreditQuoteInput =
    episodeScript.trim() && speakers.length >= MIN_PODCAST_SPEAKERS
      ? {
          script: episodeScript,
          speakers: speakers.map(({ role, voice }) => ({ name: role, voice })),
          conversationStyle: speakingStyle,
          languageCode: language.startsWith("Thai") ? "th" : "en",
          emotionTags: episodeEmotionTags,
          pauseSeconds: 0.4,
          autoDirect: true,
          outputFormat,
          backgroundMusicEnabled: backgroundMusic,
          ...(backgroundMusicPreset ? { backgroundMusicKey: backgroundMusicPreset } : {}),
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
                ? { ...speaker, voice: nextVoice.key, image: getPodcastVoiceAvatar(nextVoice) ?? "" }
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

  const savePodcastHistoryItem = async (itemId: string, input: SaveAudioHistoryInput) => {
    if (!onHistorySaved) {
      setPodcastHistorySaveFailed(true);
      return;
    }
    setPodcastHistorySavingId(itemId);
    try {
      const saved = await onHistorySaved(input);
      if (!saved) {
        setPodcastHistorySaveFailed(true);
        return;
      }
      pendingPodcastHistorySavesRef.current.delete(itemId);
      const localItem = podcastHistoryRef.current.find((item) => item.id === itemId);
      const historyItem: AudioHistoryItem = {
        ...saved,
        url: localItem?.url ?? saved.url ?? saved.audioUrl ?? saved.downloadUrl ?? "",
        localUrl: localItem?.localUrl ?? false,
        persisted: true,
      };
      const nextHistory = podcastHistoryRef.current
        .map((item) => (item.id === itemId ? historyItem : item))
        .slice(0, AUDIO_HISTORY_LIMIT);
      podcastHistoryRef.current = nextHistory;
      setPodcastHistory(nextHistory);
      setPodcastHistorySaveFailed(nextHistory.some((item) => !item.persisted));
    } catch (cause) {
      console.warn("Unable to save podcast audio history", cause);
      setPodcastHistorySaveFailed(true);
    } finally {
      setPodcastHistorySavingId(null);
    }
  };

  const retrySavePodcastHistory = (item: AudioHistoryItem) => {
    const input = pendingPodcastHistorySavesRef.current.get(item.id);
    if (input) void savePodcastHistoryItem(item.id, input);
  };

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
    setAudioUrl(null);
    setPreviewProgress(0);
    setPreviewCurrentTime(0);
    setPreviewDuration(0);
    setStatus("generating");
    setError(null);
    const requestId = startAudioProgress("audio-podcast");
    try {
      const result = await createDialogue({
        script: episodeScript,
        speakers: speakers.map(({ role, voice }) => ({ name: role, voice })),
        conversationStyle: speakingStyle,
        languageCode: language.startsWith("Thai") ? "th" : "en",
        ...(creditEstimate?.provider === "wavespeed" ? { emotion: 0.64 } : {}),
        emotionTags: episodeEmotionTags,
        pauseSeconds: 0.4,
        autoDirect: true,
        outputFormat,
        backgroundMusicEnabled: backgroundMusic,
        ...(backgroundMusicPreset ? { backgroundMusicKey: backgroundMusicPreset } : {}),
        idempotencyKey: createAudioIdempotencyKey(),
      });
      const nextUrl = URL.createObjectURL(result.blob);
      setAudioUrl(nextUrl);
      const historyInput: SaveAudioHistoryInput = {
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
          speed,
        },
      };
      const localHistoryId = `podcast-local-${Date.now()}`;
      const localHistoryItem: AudioHistoryItem = {
        id: localHistoryId,
        feature: "dialogue",
        label: historyInput.label,
        provider: "wavespeed",
        outputFormat,
        mimeType: result.blob.type || "audio/mpeg",
        sizeBytes: result.blob.size,
        createdAt: new Date().toISOString(),
        metadata: historyInput.metadata ?? {},
        url: nextUrl,
        localUrl: true,
        persisted: false,
      };
      pendingPodcastHistorySavesRef.current.set(localHistoryId, historyInput);
      const allHistory = [localHistoryItem, ...podcastHistoryRef.current];
      allHistory.slice(AUDIO_HISTORY_LIMIT).forEach((item) => {
        pendingPodcastHistorySavesRef.current.delete(item.id);
        if (item.localUrl && item.url) URL.revokeObjectURL(item.url);
      });
      const nextHistory = allHistory.slice(0, AUDIO_HISTORY_LIMIT);
      podcastHistoryRef.current = nextHistory;
      setPodcastHistory(nextHistory);
      setPodcastHistorySaveFailed(false);
      await savePodcastHistoryItem(localHistoryId, historyInput);
      setStatus("ready");
      finishAudioProgress("audio-podcast", requestId);
    } catch (cause) {
      failAudioProgress("audio-podcast", requestId);
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
    const image = getPodcastVoiceAvatar(selectedVoice) ?? "";
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
  const stopPodcastVoicePreview = useCallback(() => {
    voicePreviewRequestRef.current += 1;
    voicePreviewAudioRef.current?.pause();
    setPreviewingVoiceKey(null);
    setPreviewLoadingVoiceKey(null);
  }, []);
  const toggleVoicePreview = async (voice: AudioVoice) => {
    const audio = voicePreviewAudioRef.current ?? new Audio();
    voicePreviewAudioRef.current = audio;
    if (previewingVoiceKey === voice.key && !audio.paused) {
      audio.pause();
      setPreviewingVoiceKey(null);
      return;
    }
    audio.pause();
    const request = ++voicePreviewRequestRef.current;
    setVoicePreviewError(null);
    setPreviewLoadingVoiceKey(voice.key);
    try {
      let previewUrl = voice.previewUrl;
      if (!previewUrl) {
        const result = await previewAudioVoice(voice.key, {
          text: "สวัสดีค่ะ นี่คือตัวอย่างเสียงสำหรับพอดแคสต์ของ EOS Creative Studio",
        });
        if (request !== voicePreviewRequestRef.current) return;
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
      if (request !== voicePreviewRequestRef.current) return;
      setPreviewingVoiceKey(null);
      setVoicePreviewError(cause instanceof Error ? cause.message : "ฟังตัวอย่างเสียงไม่สำเร็จ");
    } finally {
      if (request === voicePreviewRequestRef.current) setPreviewLoadingVoiceKey(null);
    }
  };
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

  useEffect(() => {
    if (!audioUrl || status !== "ready" || !pendingPodcastHistoryPlaybackRef.current) return;
    pendingPodcastHistoryPlaybackRef.current = false;
    void previewAudioRef.current?.play().catch(() => setIsPlaying(false));
  }, [audioUrl, status]);

  const playPodcastHistory = async (item: AudioHistoryItem) => {
    const requestId = ++podcastHistoryPlaybackRequestRef.current;
    const audio = previewAudioRef.current;
    if (item.url && item.url === audioUrl && audio) {
      setPodcastHistoryLoadingId(null);
      if (audio.paused) await audio.play().catch(() => undefined);
      else audio.pause();
      return;
    }
    setPodcastHistoryLoadingId(item.id);
    setError(null);
    try {
      let nextUrl = item.url;
      if (!nextUrl || (item.persisted && !item.localUrl)) {
        const result = await fetchAudioHistoryAudio(item.id);
        if (requestId !== podcastHistoryPlaybackRequestRef.current) return;
        nextUrl = URL.createObjectURL(result.blob);
        const nextHistory = podcastHistoryRef.current.map((historyItem) =>
          historyItem.id === item.id ? { ...historyItem, url: nextUrl, localUrl: true } : historyItem,
        );
        podcastHistoryRef.current = nextHistory;
        setPodcastHistory(nextHistory);
      }
      pendingPodcastHistoryPlaybackRef.current = true;
      setAudioUrl(nextUrl);
      setPreviewProgress(0);
      setPreviewCurrentTime(0);
      setPreviewDuration(0);
      setStatus("ready");
    } catch (cause) {
      if (requestId === podcastHistoryPlaybackRequestRef.current) setError(cause instanceof Error ? cause.message : "Unable to load saved podcast");
    } finally {
      if (requestId === podcastHistoryPlaybackRequestRef.current) setPodcastHistoryLoadingId(null);
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
      pendingPodcastHistorySavesRef.current.delete(item.id);
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
                  className={[
                    styles.podcastLineRow,
                    index === 0 ? styles.podcastLineRowActive : "",
                    creditEstimate?.provider === "elevenlabs" ? styles.podcastLineRowWithEmotion : "",
                  ].filter(Boolean).join(" ")}
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
                  <AutoGrowPodcastLineInput
                    value={line.text}
                    onChange={(text) => updateLine(line.id, { text })}
                    ariaLabel={t("create.audio.podcast.a11y.line", { index: index + 1 })}
                  />
                  {creditEstimate?.provider === "elevenlabs" ? (
                    <div className={styles.podcastLineEmotionDropdown}>
                      <Dropdown
                        value={line.emotionTag ?? "natural"}
                        options={[
                          { value: "natural", label: t("create.audio.podcast.emotionNatural") },
                          { value: "happy", label: t("create.audio.podcast.emotionCheerful") },
                          { value: "excited", label: t("create.audio.podcast.emotionExcited") },
                          { value: "calm", label: t("create.audio.podcast.emotionCalm") },
                          { value: "sad", label: t("create.audio.podcast.emotionSad") },
                          { value: "serious", label: t("create.audio.podcast.emotionSerious") },
                          { value: "whispering", label: t("create.audio.podcast.emotionWhispering") },
                          { value: "angry", label: t("create.audio.podcast.emotionAngry") },
                        ]}
                        onChange={(value) =>
                          updateLine(line.id, {
                            emotionTag: value === "natural" ? undefined : (value as DialogueEmotionTag),
                          })
                        }
                        ariaLabel={`${t("create.audio.podcast.emotion")} — ${t("create.audio.podcast.a11y.line", { index: index + 1 })}`}
                        className={styles.podcastLineEmotionControl}
                        triggerClassName={styles.podcastLineEmotionTrigger}
                        menuClassName={styles.podcastDropdownMenu}
                        optionClassName={styles.podcastDropdownOption}
                      />
                    </div>
                  ) : null}
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
                    onClick={() => setPendingLineDeleteId(line.id)}
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
                  {!item.persisted ? (
                    <button
                      type="button"
                      className={styles.historyRetry}
                      aria-label={t("create.audio.saveToHistory")}
                      title={t("create.audio.saveToHistory")}
                      onClick={() => retrySavePodcastHistory(item)}
                      disabled={podcastHistorySavingId === item.id}
                    >
                      {podcastHistorySavingId === item.id ? (
                        <span className={styles.historyLoading} />
                      ) : (
                        <RotateCcw size={13} />
                      )}
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.historyEmpty}>
              <History size={15} />
              <span>{t("create.audio.historyEmpty")}</span>
            </div>
          )}
          {podcastHistorySaveFailed ? (
            <p className={styles.historySaveWarning} role="status">
              {t("create.audio.historySaveFailed")}
            </p>
          ) : null}
        </section>
      </main>

      <aside className={styles.podcastSettingsCard} aria-label={t("create.audio.podcast.a11y.settings")}>
        <div className={styles.podcastSettingsHeader}>
          <h2>{t("create.audio.podcast.settings")}</h2>
          <AudioWaveform size={18} />
        </div>
        <div className={styles.podcastSettingGroup}>
          <span className={styles.podcastFieldLabel}>{t("create.audio.podcast.outputFormat")} <InfoTooltip content={t("create.audio.info.format")} size={11} /></span>
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
          <span className={styles.podcastFieldLabel}>{t("create.audio.podcast.language")} <InfoTooltip content={t("create.audio.info.language")} size={11} /></span>
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
          <span className={styles.podcastFieldLabel}>{t("create.audio.podcast.speakingStyle")} <InfoTooltip content={t("create.audio.info.speakingStyle")} size={11} /></span>
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
            <span className={styles.podcastFieldLabel}>{t("create.audio.podcast.pacing")} <InfoTooltip content={t("create.audio.info.speed")} size={11} /></span>
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
            aria-label={t("create.audio.podcast.pacing")}
          />
          <div className={styles.podcastSpeedLabels}>
            <span>0.5x</span>
            <span>1x</span>
            <span>1.5x</span>
            <span>2x</span>
          </div>
        </div>
        <div className={styles.podcastToggleGroup}>
          <div className={styles.podcastToggleRow}>
            <span>
              <strong>{t("create.audio.podcast.backgroundMusic")} <InfoTooltip content={t("create.audio.info.podcastBackgroundMusic")} size={11} /></strong>
              <small>เพิ่มเพลงประกอบระหว่างบทพูด</small>
            </span>
            <button
              type="button"
              className={backgroundMusic ? styles.podcastToggleOn : styles.podcastToggleOff}
              onClick={() => setBackgroundMusic((current) => !current)}
              aria-label={t("create.audio.podcast.backgroundMusic")}
              aria-pressed={backgroundMusic}
              disabled={backgroundMusicLoading || backgroundMusicPresets.length === 0}
            >
              <i />
            </button>
          </div>
          {backgroundMusic ? (
            <div className={styles.podcastMusicSelectField}>
              <span className={styles.podcastFieldLabel}>{t("create.audio.podcast.backgroundMusic")} <InfoTooltip content={t("create.audio.info.podcastMusicPreset")} size={11} /></span>
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
          if (!open) { setSpeakerFormError(null); stopPodcastVoicePreview(); }
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
              <PodcastVoicePicker
                value={speakerDraft.voice}
                voices={availableVoices}
                onChange={(value) => setSpeakerDraft((current) => ({ ...current, voice: value }))}
                loading={voicesLoading}
                playingKey={previewingVoiceKey}
                loadingKey={previewLoadingVoiceKey}
                onPreview={(voice) => void toggleVoicePreview(voice)}
                onClose={stopPodcastVoicePreview}
              />
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
        open={pendingLineDeleteId !== null}
        onOpenChange={(open) => {
          if (!open) setPendingLineDeleteId(null);
        }}
        title={t("create.audio.podcast.deleteLine.title")}
        description={t("create.audio.podcast.deleteLine.description")}
        onConfirm={() => {
          if (pendingLineDeleteId !== null) removeLine(pendingLineDeleteId);
          setPendingLineDeleteId(null);
        }}
      />
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
