import { useEffect, useRef, useState } from "react";
import {
  Download,
  History,
  LockKeyhole,
  Music2,
  Pause,
  Play,
  Settings2,
  Sparkles,
} from "lucide-react";
import { InfoTooltip } from "@/features/create/components/info-tooltip";
import { useLocale } from "@/lib/i18n/locale-provider";
import {
  createTextToMusic,
  fetchAudioHistoryAudio,
  listAudioHistory,
  quoteTextToMusic,
  type AudioHistoryEntry,
} from "@/lib/api/audio";
import styles from "./audio-generation-page.module.css";
import { AUDIO_HISTORY_LIMIT } from "./audio-generation.constants";
import {
  failAudioProgress,
  finishAudioProgress,
  formatAudioHistoryDate,
  formatCreditAmount,
  formatSceneSeconds,
  startAudioProgress,
} from "./audio-generation.helpers";
import { AlternateHeading, AudioSettingLabel, PreviewWaveform } from "./audio-shared-parts";

export function TextToMusicLayout() {
  const { t, locale } = useLocale();
  const [prompt, setPrompt] = useState("");
  const [durationInput, setDurationInput] = useState("30");
  const duration = Number(durationInput);
  const validDuration = /^\d+$/.test(durationInput) && Number.isInteger(duration) && duration >= 10 && duration <= 360;
  const [quote, setQuote] = useState<{ duration: number; cost: number } | null>(null);
  const [quoteFailed, setQuoteFailed] = useState(false);
  const [quoteRetry, setQuoteRetry] = useState(0);
  const [status, setStatus] = useState<"idle" | "generating" | "ready" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [history, setHistory] = useState<AudioHistoryEntry[]>([]);
  const [historyError, setHistoryError] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFormat, setPreviewFormat] = useState("mp3");
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const mounted = useRef(false);
  const currentQuote = validDuration && quote?.duration === duration ? quote : null;

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; audioRef.current?.pause(); if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current); };
  }, []);
  useEffect(() => {
    let active = true;
    void listAudioHistory({ feature: "text-to-music", limit: AUDIO_HISTORY_LIMIT }).then((items) => {
      if (active) { setHistory(items); setHistoryError(false); }
    }).catch(() => { if (active) setHistoryError(true); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!validDuration) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setQuoteFailed(false);
      void quoteTextToMusic(duration, controller.signal).then((result) => {
        if (!controller.signal.aborted) setQuote({ duration, cost: result.creditCost });
      }).catch(() => { if (!controller.signal.aborted) { setQuote(null); setQuoteFailed(true); } });
    }, 350);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [duration, validDuration, quoteRetry]);

  const showAudio = (blob: Blob, contentType: string) => {
    audioRef.current?.pause();
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(blob);
    objectUrlRef.current = url;
    setPreviewUrl(url);
    setPreviewFormat(contentType.includes("wav") ? "wav" : contentType.includes("ogg") ? "ogg" : "mp3");
    setPlaying(false); setTime(0); setAudioDuration(0);
  };
  const generate = async () => {
    if (!prompt.trim() || !validDuration || !currentQuote || status === "generating") return;
    const requestId = startAudioProgress("audio-text-to-music");
    setStatus("generating"); setError(null); setNotice(null);
    try {
      const result = await createTextToMusic({ prompt: prompt.trim(), durationSeconds: duration });
      finishAudioProgress("audio-text-to-music", requestId);
      if (!mounted.current) return;
      showAudio(result.blob, result.contentType);
      setStatus("ready");
      if (!result.localHistoryId) setNotice(t("create.audio.music.historySaveError"));
      void listAudioHistory({ feature: "text-to-music", limit: AUDIO_HISTORY_LIMIT }).then((items) => {
        if (mounted.current) { setHistory(items); setHistoryError(false); }
      }).catch(() => { if (mounted.current) setHistoryError(true); });
    } catch (cause) {
      failAudioProgress("audio-text-to-music", requestId);
      if (mounted.current) { setStatus("error"); setError(cause instanceof Error && cause.message === "Insufficient credits" ? t("create.audio.error.insufficientCredits") : cause instanceof Error ? cause.message : t("create.audio.music.quoteError")); }
    }
  };
  const openHistory = async (item: AudioHistoryEntry) => {
    try { const result = await fetchAudioHistoryAudio(item.id); if (mounted.current) { showAudio(result.blob, result.contentType); setError(null); setNotice(null); } }
    catch { if (mounted.current) setError(t("create.audio.music.historyError")); }
  };
  const download = () => {
    if (!previewUrl) return;
    const link = document.createElement("a"); link.href = previewUrl; link.download = `text-to-music.${previewFormat}`; link.click();
  };
  const progress = audioDuration > 0 ? Math.min(100, (time / audioDuration) * 100) : 0;

  return (
    <div className={styles.alternateLayout}>
      <section className={`${styles.alternatePanel} ${styles.alternateFormPanel}`}>
        <AlternateHeading eyebrow={t("create.audio.music.eyebrow")} title={t("create.audio.music.title")} description={t("create.audio.music.description")} icon={<Music2 size={24} />} />
        <label className={styles.altTextField}>
          <span>{t("create.audio.music.prompt")}</span>
          <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} maxLength={2000} disabled={status === "generating"} placeholder={t("create.audio.music.placeholder")} />
        </label>
        <p className={styles.musicPromptCount}>{prompt.length.toLocaleString()} / 2,000</p>
      </section>
      <section className={`${styles.alternatePanel} ${styles.alternateCenterPanel}`}>
        <div className={styles.altPanelHeader}><div><span className={styles.altEyebrow}>{t("create.audio.music.eyebrow")}</span><h2>{t("create.audio.music.preview")}</h2></div></div>
        {error && <p className={styles.podcastError} role="alert">{error}</p>}
        {notice && <p className={styles.podcastError} role="status">{notice}</p>}
        <PreviewWaveform audioUrl={previewUrl} progress={progress} isPlaying={playing} />
        {previewUrl ? <>
          <div className={styles.playerRow}>
            <button type="button" className={styles.playButton} aria-label={t(playing ? "create.audio.a11y.pause" : "create.audio.a11y.play")} onClick={() => { const audio = audioRef.current; if (audio) { if (audio.paused) void audio.play().catch(() => setPlaying(false)); else audio.pause(); } }}>{playing ? <Pause size={20} /> : <Play size={20} fill="currentColor" />}</button>
            <span className={styles.timeLabel}>{formatSceneSeconds(time)} / {formatSceneSeconds(audioDuration)}</span>
            <input className={styles.scrubber} type="range" min="0" max="100" value={progress} aria-label={t("create.audio.a11y.audioProgress")} onChange={(event) => { if (audioRef.current && audioDuration) audioRef.current.currentTime = Number(event.target.value) / 100 * audioDuration; }} />
          </div>
          <audio ref={audioRef} src={previewUrl} preload="metadata" onLoadedMetadata={(event) => setAudioDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)} onTimeUpdate={(event) => setTime(event.currentTarget.currentTime)} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} />
        </> : <p className={styles.musicEmpty}>{t("create.audio.music.empty")}</p>}
        <div className={styles.altActionRow}><button type="button" className={styles.altPrimaryButton} disabled={!previewUrl} onClick={download}><Download size={15} />{t("create.audio.music.download")}</button></div>
        <div className={styles.musicHistory}>
          <h3><History size={15} />{t("create.audio.music.history")}</h3>
          {historyError && <p className={styles.podcastError} role="status">{t("create.audio.music.historyError")}</p>}
          <div className={styles.historyList}>{history.length ? history.map((item) => <button type="button" key={item.id} className={styles.historyItem} onClick={() => void openHistory(item)}><Play size={14} /><span className={styles.musicHistoryLabel}>{item.label}</span><small>{formatAudioHistoryDate(item.createdAt, locale)}</small></button>) : <div className={styles.historyEmpty}>{t("create.audio.music.historyEmpty")}</div>}</div>
        </div>
      </section>
      <aside className={styles.alternateSettings}>
        <div className={styles.altPanelHeader}><h2>{t("create.audio.settings")}</h2><Settings2 size={20} /></div>
        <div className={`${styles.altField} ${styles.musicModelField}`}><span><AudioSettingLabel label={t("create.audio.music.model")} /></span><div className={styles.musicModel}>Sonilo Text-to-Music</div></div>
        <label className={styles.altField}><span>{t("create.audio.music.duration")} <InfoTooltip content={t("create.audio.info.musicDuration")} size={11} /></span><input className={styles.musicDurationInput} type="number" min="10" max="360" step="1" value={durationInput} disabled={status === "generating"} onChange={(event) => setDurationInput(event.target.value)} aria-invalid={!validDuration} /></label>
        <p className={validDuration ? styles.musicHint : styles.podcastError}>{t(validDuration ? "create.audio.music.durationHint" : "create.audio.music.invalidDuration")}</p>
        <div data-mobile-action-dock className={styles.mobileActionDock}>
          <div className={styles.creditEstimate}><div className={styles.creditEstimateHeader}><strong>{t("create.audio.estimatedCredits")} <InfoTooltip content={t("create.audio.info.estimatedCredits")} size={11} /></strong><b>{currentQuote ? t("create.audio.creditsAmount", { amount: formatCreditAmount(currentQuote.cost) }) : quoteFailed ? t("create.audio.music.quoteError") : validDuration ? t("create.audio.calculating") : ""}</b></div></div>
          {quoteFailed && <button type="button" className={styles.altSecondaryButton} onClick={() => setQuoteRetry((value) => value + 1)}>{t("create.audio.music.tryAgain")}</button>}
          <button type="button" className={styles.altGenerateButton} onClick={() => void generate()} disabled={!prompt.trim() || !validDuration || !currentQuote || status === "generating"}>{t(status === "generating" ? "create.audio.music.generating" : "create.audio.music.generate")} <Sparkles size={16} /></button>
          <p className={styles.securityNote}><LockKeyhole size={11} /> {t("create.audio.privateSecure")}</p>
        </div>
      </aside>
    </div>
  );
}
