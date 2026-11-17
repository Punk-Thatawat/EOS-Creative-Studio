import { useEffect, useRef, useState } from "react";
import {
  CloudUpload,
  Download,
  History,
  LockKeyhole,
  Mic2,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Settings2,
  Sparkles,
  Trash2,
  Volume2,
  WandSparkles,
} from "lucide-react";
import { InfoTooltip } from "@/features/create/components/info-tooltip";
import { useLocale } from "@/lib/i18n/locale-provider";
import { Dropdown } from "@/components/ui/dropdown";
import {
  createVoiceClone,
  deleteAudioHistory,
  fetchAudioHistoryAudio,
  listAudioHistory,
  listVoiceClones,
  previewVoiceClone,
  quoteVoiceClone,
  type AudioHistoryEntry,
  type VoiceCloneListItem,
  type VoiceCloneQuote,
} from "@/lib/api/audio";
import styles from "./audio-generation-page.module.css";
import { type SaveHistoryCallback } from "./audio-generation.types";
import {
  AUDIO_HISTORY_LIMIT,
  CLONE_HISTORY_SPEECH_SCAN_LIMIT,
  MINIMAX_LANGUAGE_BOOST_OPTIONS,
  VOICE_CLONE_MODEL_ID,
  VOICE_CLONE_MODEL_OPTIONS,
} from "./audio-generation.constants";
import {
  failAudioProgress,
  finishAudioProgress,
  formatAudioHistoryDate,
  formatCreditAmount,
  formatSceneSeconds,
  startAudioProgress,
} from "./audio-generation.helpers";
import {
  AltWaveform,
  AlternateHeading,
  AudioSettingLabel,
  PreviewWaveform,
} from "./audio-shared-parts";
import { PodcastConfirmationDialog } from "./podcast-parts";

export function VoiceCloneLayout({
  onHistorySaved,
  onOpenInTextToSpeech,
}: {
  onHistorySaved?: SaveHistoryCallback;
  /** Opens the Text to Speech tab on the cloned-voice list, with this voice selected when it is given. */
  onOpenInTextToSpeech?: (voiceId?: string | null) => void;
}) {
  const { locale, t } = useLocale();
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
  const [cloneHistory, setCloneHistory] = useState<AudioHistoryEntry[]>([]);
  const [cloneVoices, setCloneVoices] = useState<VoiceCloneListItem[]>([]);
  const [activeCloneHistoryId, setActiveCloneHistoryId] = useState<string | null>(null);
  const [cloneHistoryLoadingId, setCloneHistoryLoadingId] = useState<string | null>(null);
  const [pendingCloneHistoryDelete, setPendingCloneHistoryDelete] = useState<AudioHistoryEntry | null>(null);
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

  useEffect(() => {
    let active = true;
    void Promise.all([
      listAudioHistory({ feature: "voice-clone", limit: AUDIO_HISTORY_LIMIT }),
      listVoiceClones()
        .then((result) => result.voices)
        .catch(() => [] as VoiceCloneListItem[]),
      // Speech made with a cloned voice is saved as Text to Speech, so scan it for entries that used one of the clones.
      listAudioHistory({ feature: "tts", limit: CLONE_HISTORY_SPEECH_SCAN_LIMIT }).catch(
        () => [] as AudioHistoryEntry[],
      ),
    ])
      .then(([previews, voices, speech]) => {
        if (!active) return;
        const cloneIds = new Set(voices.map((voice) => voice.voiceId));
        const speechWithClones = speech.filter((item) => Boolean(item.voice) && cloneIds.has(item.voice as string));
        const merged = [...previews, ...speechWithClones].filter(
          (entry, index, all) => all.findIndex((other) => other.id === entry.id) === index,
        );
        merged.sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
        setCloneHistory(merged.slice(0, AUDIO_HISTORY_LIMIT));
        setCloneVoices(voices);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

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
      void quoteVoiceClone(text, previewModel)
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
  }, [testPhrase, previewModel]);

  const translateError = (message: string): string => {
    const known: Record<string, string> = {
      "Voice clone not found": t("create.audio.clone.error.notFound"),
      "Voice permission confirmation is required": t("create.audio.clone.error.noConsent"),
      "At least one voice sample is required": t("create.audio.clone.error.noSample"),
      "Voice samples must be valid audio files": t("create.audio.clone.error.invalidFile"),
      "Voice Clone is not routed to WaveSpeed": t("create.audio.clone.error.notConfigured"),
      "Insufficient credits": t("create.audio.error.insufficientCredits"),
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
    const requestId = startAudioProgress("audio-voice-clone");
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
      finishAudioProgress("audio-voice-clone", requestId);
      onOpenInTextToSpeech?.(result.voiceId);
    } catch (cause) {
      failAudioProgress("audio-voice-clone", requestId);
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
    const requestId = startAudioProgress("audio-voice-clone");
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
      setActiveCloneHistoryId(null);
      void onHistorySaved?.({
        audio: result.blob,
        feature: "voice-clone",
        label: `${voiceName} preview`,
        outputFormat,
        voice: voiceId,
        metadata: { character },
      })?.then((saved) => {
        if (!saved) return;
        setCloneHistory((current) =>
          [saved, ...current.filter((entry) => entry.id !== saved.id)].slice(0, AUDIO_HISTORY_LIMIT),
        );
        setActiveCloneHistoryId(saved.id);
      });
      setStatus("ready");
      finishAudioProgress("audio-voice-clone", requestId);
    } catch (cause) {
      failAudioProgress("audio-voice-clone", requestId);
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

  const playCloneHistory = async (item: AudioHistoryEntry) => {
    if (item.id === activeCloneHistoryId && audioUrl) {
      togglePlayback();
      return;
    }
    setCloneHistoryLoadingId(item.id);
    setError(null);
    try {
      const result = await fetchAudioHistoryAudio(item.id);
      durationRef.current = 0;
      setDuration(0);
      setCurrentTime(0);
      setProgress(0);
      setIsPlaying(false);
      setAudioUrl(URL.createObjectURL(result.blob));
      setActiveCloneHistoryId(item.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("create.audio.clone.error.previewFailed"));
      setStatus("error");
    } finally {
      setCloneHistoryLoadingId(null);
    }
  };

  // A history entry belongs to the voice it was made with, so picking one continues in Text to Speech with that voice.
  const openCloneHistory = (item: AudioHistoryEntry) => {
    if (onOpenInTextToSpeech) onOpenInTextToSpeech(item.voice);
    else void playCloneHistory(item);
  };

  const confirmRemoveCloneHistory = () => {
    const item = pendingCloneHistoryDelete;
    if (!item) return;
    setPendingCloneHistoryDelete(null);
    void deleteAudioHistory(item.id)
      .then(() => {
        setCloneHistory((current) => current.filter((entry) => entry.id !== item.id));
        if (item.id === activeCloneHistoryId) {
          previewAudioRef.current?.pause();
          setAudioUrl(null);
          setActiveCloneHistoryId(null);
          setProgress(0);
          setCurrentTime(0);
          setDuration(0);
          setIsPlaying(false);
        }
      })
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : t("create.audio.clone.error.deleteFailed"));
        setStatus("error");
      });
  };

  // The list shows what was made with cloning (previews and speech) together with the newest voices, newest first.
  const historyRows = [
    ...cloneHistory.map((entry) => ({ kind: "entry" as const, key: entry.id, createdAt: entry.createdAt, entry })),
    ...cloneVoices.slice(0, AUDIO_HISTORY_LIMIT).map((voice) => ({
      kind: "voice" as const,
      key: `voice:${voice.voiceId}`,
      createdAt: voice.createdAt,
      voice,
    })),
  ].sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));

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
          <span className={styles.altFieldLabel}><AudioSettingLabel label={t("create.audio.clone.voiceCharacter")} /></span>
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
        <section className={styles.historyPanel} aria-label={t("create.audio.a11y.historyPanel")}>
          <div className={styles.sectionHeading}>
            <h2>
              <History size={13} /> {t("create.audio.generationHistory")}
            </h2>
            <span className={styles.timelineHint}>
              {historyRows.length
                ? historyRows.length === 1
                  ? t("create.audio.resultCountOne")
                  : t("create.audio.resultCountMany", { count: historyRows.length })
                : t("create.audio.noResults")}
            </span>
          </div>
          {historyRows.length ? (
            <div className={styles.historyList}>
              {historyRows.map((row) => {
                if (row.kind === "voice") {
                  const voiceLabel = row.voice.name.trim() || t("create.audio.clone.unnamedVoice");
                  return (
                    <div key={row.key} className={styles.historyItemRow}>
                      <button
                        type="button"
                        className={styles.historyItem}
                        onClick={() => onOpenInTextToSpeech?.(row.voice.voiceId)}
                        disabled={!onOpenInTextToSpeech}
                      >
                        <span className={styles.historyPlay}>
                          <Mic2 size={13} />
                        </span>
                        <span className={styles.historyCopy}>
                          <strong>{voiceLabel}</strong>
                          <small>{formatAudioHistoryDate(row.voice.createdAt, locale)}</small>
                        </span>
                        <span className={styles.historyCurrent}>{t("create.audio.clone.historyVoice")}</span>
                      </button>
                    </div>
                  );
                }
                const item = row.entry;
                const isActive = item.id === activeCloneHistoryId;
                return (
                  <div key={item.id} className={isActive ? styles.historyItemRowActive : styles.historyItemRow}>
                    <button
                      type="button"
                      className={isActive ? styles.historyItemActive : styles.historyItem}
                      onClick={() => openCloneHistory(item)}
                      disabled={cloneHistoryLoadingId === item.id}
                      aria-busy={cloneHistoryLoadingId === item.id}
                    >
                      <span className={cloneHistoryLoadingId === item.id ? styles.historyLoading : styles.historyPlay}>
                        {cloneHistoryLoadingId === item.id ? null : isActive && isPlaying ? (
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
                        {isActive ? t("create.audio.historyCurrent") : t("create.audio.historyPlay")}
                      </span>
                    </button>
                    <button
                      type="button"
                      className={styles.historyDelete}
                      aria-label={t("create.audio.a11y.deleteItem", { label: item.label })}
                      onClick={() => setPendingCloneHistoryDelete(item)}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={styles.historyEmpty}>
              <History size={15} />
              <span>{t("create.audio.historyEmpty")}</span>
            </div>
          )}
        </section>
      </section>

      <aside className={styles.alternateSettings}>
        <div className={styles.altPanelHeader}>
          <h2>{t("create.audio.clone.settings")}</h2>
          <Settings2 size={20} />
        </div>
        <div className={styles.altField}>
          <span><AudioSettingLabel label={t("create.audio.clone.model")} /></span>
          <Dropdown
            value={previewModel}
            options={VOICE_CLONE_MODEL_OPTIONS}
            onChange={setPreviewModel}
            ariaLabel={t("create.audio.clone.model")}
            optionClassName={styles.cloneDropdownOption}
            menuPosition="fixed"
          />
        </div>
        <div className={styles.altSettingBlock}>
          <div className={styles.altSettingHeading}>
            <span><AudioSettingLabel label={t("create.audio.clone.speed")} /></span>
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
                <span><AudioSettingLabel label={t("create.audio.clone.accuracy")} /></span>
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
            <div className={styles.altToggleRow}>
              <span><AudioSettingLabel label={t("create.audio.clone.noiseReduction")} /></span>
              <button
                type="button"
                className={needNoiseReduction ? styles.altToggleOn : styles.altToggleOff}
                onClick={() => setNeedNoiseReduction((current) => !current)}
                aria-label={t("create.audio.clone.noiseReduction")}
                aria-pressed={needNoiseReduction}
              >
                <span />
              </button>
            </div>
            <div className={styles.altToggleRow}>
              <span><AudioSettingLabel label={t("create.audio.clone.volumeNormalization")} /></span>
              <button
                type="button"
                className={needVolumeNormalization ? styles.altToggleOn : styles.altToggleOff}
                onClick={() => setNeedVolumeNormalization((current) => !current)}
                aria-label={t("create.audio.clone.volumeNormalization")}
                aria-pressed={needVolumeNormalization}
              >
                <span />
              </button>
            </div>
            <div className={styles.altField}>
              <span><AudioSettingLabel label={t("create.audio.language")} /></span>
              <Dropdown
                value={language}
                options={MINIMAX_LANGUAGE_BOOST_OPTIONS}
                onChange={setLanguage}
                ariaLabel={t("create.audio.language")}
                optionClassName={styles.cloneDropdownOption}
                menuPosition="fixed"
              />
            </div>
          </>
        ) : null}
        {previewModel === "minimax/speech-2.8-hd" ? (
          <>
            <div className={styles.altSettingBlock}>
              <div className={styles.altSettingHeading}>
                <span><AudioSettingLabel label={t("create.audio.pitch")} /></span>
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
                <span><AudioSettingLabel label={t("create.audio.synthVolume")} /></span>
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
            <div className={styles.altField}>
              <span><AudioSettingLabel label={t("create.audio.clone.emotion")} /></span>
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
                optionClassName={styles.cloneDropdownOption}
                menuPosition="fixed"
              />
            </div>
            <div className={styles.altField}>
              <span><AudioSettingLabel label={t("create.audio.language")} /></span>
              <Dropdown
                value={language}
                options={MINIMAX_LANGUAGE_BOOST_OPTIONS}
                onChange={setLanguage}
                ariaLabel={t("create.audio.language")}
                optionClassName={styles.cloneDropdownOption}
                menuPosition="fixed"
              />
            </div>
            <label className={styles.altField}>
              <span>{t("create.audio.pronunciationHints")}</span>
              <input
                value={pronunciation}
                onChange={(event) => setPronunciation(event.target.value)}
                placeholder={"e.g. EOS as “อี-โอ-เอส”"}
              />
            </label>
            <div className={styles.altToggleRow}>
              <span><AudioSettingLabel label={t("create.audio.clone.englishNormalization")} /></span>
              <button
                type="button"
                className={englishNormalization ? styles.altToggleOn : styles.altToggleOff}
                onClick={() => setEnglishNormalization((current) => !current)}
                aria-label={t("create.audio.clone.englishNormalization")}
                aria-pressed={englishNormalization}
              >
                <span />
              </button>
            </div>
            <div className={styles.altField}>
              <span><AudioSettingLabel label={t("create.audio.clone.sampleRate")} /></span>
              <Dropdown
                value={sampleRate}
                options={["8000", "16000", "22050", "24000", "32000", "44100"].map((value) => ({
                  value,
                  label: `${Number(value).toLocaleString()} Hz`,
                }))}
                onChange={setSampleRate}
                ariaLabel={t("create.audio.clone.sampleRate")}
                optionClassName={styles.cloneDropdownOption}
                menuPosition="fixed"
              />
            </div>
            <div className={styles.altField}>
              <span><AudioSettingLabel label={t("create.audio.clone.bitrate")} /></span>
              <Dropdown
                value={bitrate}
                options={["32000", "64000", "128000", "256000"].map((value) => ({
                  value,
                  label: `${Number(value) / 1000} kbps`,
                }))}
                onChange={setBitrate}
                ariaLabel={t("create.audio.clone.bitrate")}
                optionClassName={styles.cloneDropdownOption}
                menuPosition="fixed"
              />
            </div>
            <div className={styles.altField}>
              <span><AudioSettingLabel label={t("create.audio.clone.channel")} /></span>
              <Dropdown
                value={channel}
                options={[
                  { value: "1", label: t("create.audio.clone.channelMono") },
                  { value: "2", label: t("create.audio.clone.channelStereo") },
                ]}
                onChange={setChannel}
                ariaLabel={t("create.audio.clone.channel")}
                optionClassName={styles.cloneDropdownOption}
                menuPosition="fixed"
              />
            </div>
          </>
        ) : null}
        <div className={styles.altSettingBlock}>
          <span className={styles.altFieldLabel}><AudioSettingLabel label={t("create.audio.clone.outputFormat")} /></span>
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
          <p className={styles.securityNote}>
            <LockKeyhole size={11} /> {t("create.audio.privateSecure")}
          </p>
        </div>
      </aside>
      <PodcastConfirmationDialog
        open={Boolean(pendingCloneHistoryDelete)}
        onOpenChange={(open) => {
          if (!open) setPendingCloneHistoryDelete(null);
        }}
        title="ลบประวัติการสร้างหรือไม่?"
        description={`“${pendingCloneHistoryDelete?.label ?? "รายการนี้"}” จะถูกลบออกจากประวัติการสร้างและกู้คืนไม่ได้`}
        onConfirm={confirmRemoveCloneHistory}
      />
    </div>
  );
}
