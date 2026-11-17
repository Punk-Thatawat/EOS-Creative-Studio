import { useEffect, useRef, useState } from "react";
import {
  AudioLines,
  CloudUpload,
  Download,
  LockKeyhole,
  Play,
  RotateCcw,
  RotateCw,
  Settings2,
  Sparkles,
  Volume2,
} from "lucide-react";
import { InfoTooltip } from "@/features/create/components/info-tooltip";
import { useLocale } from "@/lib/i18n/locale-provider";
import { Dropdown } from "@/components/ui/dropdown";
import {
  createSoundEffects,
  createVideoSoundEffect,
  quoteSoundEffects,
  quoteVideoSoundEffects,
  type SoundEffectsQuote,
  type SoundEffectVariant,
} from "@/lib/api/audio";
import styles from "./audio-generation-page.module.css";
import { type SaveHistoryCallback } from "./audio-generation.types";
import { SFX_MODEL_OPTIONS } from "./audio-generation.constants";
import {
  failAudioProgress,
  finishAudioProgress,
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

export function SoundEffectsLayout({ onHistorySaved }: { onHistorySaved?: SaveHistoryCallback }) {
  const { t } = useLocale();
  const [sourceMode, setSourceMode] = useState<"text" | "video">("text");
  const [effectType, setEffectType] = useState("Cinematic");
  const [description, setDescription] = useState(() => t("create.audio.sfx.defaultDescription"));
  const [effectDuration, setEffectDuration] = useState(4);
  const [variationCount, setVariationCount] = useState(4);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [videoDurationError, setVideoDurationError] = useState(false);
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
  const [creditQuoteError, setCreditQuoteError] = useState(false);
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
    if (!videoFile) return;
    let active = true;
    let released = false;
    const videoUrl = URL.createObjectURL(videoFile);
    const video = document.createElement("video");
    const releaseVideoUrl = () => {
      if (released) return;
      released = true;
      video.onloadedmetadata = null;
      video.onerror = null;
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(videoUrl);
    };

    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : null;
      if (active) {
        setVideoDuration(duration);
        setVideoDurationError(duration === null);
      }
      releaseVideoUrl();
    };
    video.onerror = () => {
      if (active) {
        setVideoDuration(null);
        setVideoDurationError(true);
      }
      releaseVideoUrl();
    };
    video.src = videoUrl;

    return () => {
      active = false;
      releaseVideoUrl();
    };
  }, [videoFile]);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      setCreditQuote(null);
      setCreditQuoteError(false);
      const quoteRequest = sourceMode === "video"
        ? videoFile && videoDuration !== null && !videoDurationError
          ? quoteVideoSoundEffects(Math.min(180, Math.max(1, Math.ceil(videoDuration))))
          : null
        : quoteSoundEffects({ durationSeconds: effectDuration, variationCount });
      if (!quoteRequest) {
        setCreditQuoteLoading(false);
        return;
      }
      setCreditQuoteLoading(true);
      void quoteRequest
        .then((quote) => {
          if (active) setCreditQuote(quote);
        })
        .catch(() => {
          if (active) {
            setCreditQuote(null);
            setCreditQuoteError(true);
          }
        })
        .finally(() => {
          if (active) setCreditQuoteLoading(false);
        });
    }, sourceMode === "text" ? 400 : 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [sourceMode, effectDuration, variationCount, videoFile, videoDuration, videoDurationError]);

  const handleGenerate = async () => {
    const inputVideoFile = videoFile;
    if (sourceMode === "video" && !inputVideoFile) {
      setError(t("create.audio.sfx.error.noVideo"));
      setStatus("error");
      return;
    }
    const requestId = startAudioProgress("audio-sound-effects");
    setStatus("generating");
    setError(null);
    try {
      let nextVariants: SoundEffectVariant[];
      let nextUrls: Record<number, string> = {};
      if (sourceMode === "video") {
        const result = await createVideoSoundEffect({
          video: inputVideoFile!,
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
      finishAudioProgress("audio-sound-effects", requestId);
    } catch (cause) {
      failAudioProgress("audio-sound-effects", requestId);
      setError(cause instanceof Error ? (cause.message === "Insufficient credits" ? t("create.audio.error.insufficientCredits") : cause.message) : "Sound effect generation failed");
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
          <span className={styles.altFieldLabel}><AudioSettingLabel label={t("create.audio.sfx.source")} /></span>
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
              <span className={styles.altFieldLabel}><AudioSettingLabel label={t("create.audio.sfx.effectCategory")} /></span>
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
              <div className={styles.altField}>
                <span><AudioSettingLabel label={t("create.audio.sfx.duration")} /></span>
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
              </div>
              <div className={styles.altField}>
                <span><AudioSettingLabel label={t("create.audio.sfx.variations")} /></span>
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
              </div>
            </div>
          </>
        ) : (
          <>
            <input
              ref={videoInputRef}
              hidden
              type="file"
              accept="video/mp4,video/quicktime,video/webm,video/x-m4v,image/gif,video/*"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                setVideoFile(file);
                setVideoDuration(null);
                setVideoDurationError(false);
                setCreditQuote(null);
                setCreditQuoteLoading(false);
                setCreditQuoteError(false);
                event.target.value = "";
              }}
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
        <div className={styles.altField}>
          <span>{t("create.audio.sfx.model")} <InfoTooltip content={t("create.audio.info.sfxSource")} size={11} /></span>
          <Dropdown
            value={sourceMode}
            options={SFX_MODEL_OPTIONS}
            onChange={(value) => setSourceMode(value as "text" | "video")}
            ariaLabel={t("create.audio.sfx.model")}
            menuPosition="fixed"
          />
        </div>
        <div className={styles.altSettingBlock}>
          <span className={styles.altFieldLabel}><AudioSettingLabel label={t("create.audio.sfx.outputFormat")} /></span>
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
              <b title={creditQuoteError ? t("create.audio.sfx.videoQuoteUnavailableHint") : undefined}>
                {sourceMode === "video"
                  ? creditQuoteLoading
                    ? t("create.audio.calculating")
                    : creditQuote
                      ? t("create.audio.creditsAmount", { amount: formatCreditAmount(creditQuote.creditCost) })
                      : creditQuoteError
                        ? t("create.audio.sfx.videoQuoteUnavailable")
                        : !videoFile
                          ? t("create.audio.sfx.videoUploadFirst")
                          : videoDurationError
                            ? t("create.audio.sfx.videoDurationUnreadable")
                            : t("create.audio.sfx.videoReadingDuration")
                  : creditQuoteLoading
                    ? t("create.audio.calculating")
                    : creditQuote
                      ? t("create.audio.creditsAmount", { amount: formatCreditAmount(creditQuote.creditCost) })
                      : "—"}
              </b>
            </div>
            <p className={styles.creditEstimateCount}>
              {sourceMode === "video"
                ? creditQuote
                  ? `${formatSceneSeconds(videoDuration ?? 0)} · ${t("create.audio.sfx.videoLabel")}`
                  : creditQuoteError
                    ? t("create.audio.sfx.videoQuoteUnavailableHint")
                    : videoDurationError
                      ? t("create.audio.sfx.videoDurationUnreadableHint")
                      : videoFile
                        ? videoDuration === null
                          ? t("create.audio.sfx.videoReadingDuration")
                          : t("create.audio.calculating")
                        : t("create.audio.sfx.videoEstimateHint")
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
          <p className={styles.securityNote}>
            <LockKeyhole size={11} /> {t("create.audio.privateSecure")}
          </p>
        </div>
      </aside>
    </div>
  );
}
