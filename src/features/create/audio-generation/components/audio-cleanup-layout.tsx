import { useEffect, useRef, useState } from "react";
import {
  Check,
  CloudUpload,
  Download,
  History,
  LockKeyhole,
  Mic2,
  Play,
  Plus,
  RotateCcw,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  VolumeX,
  WandSparkles,
  Waves,
} from "lucide-react";
import { InfoTooltip } from "@/features/create/components/info-tooltip";
import { useLocale } from "@/lib/i18n/locale-provider";
import { Dropdown } from "@/components/ui/dropdown";
import {
  cleanupAudio,
  deleteAudioHistory,
  fetchAudioHistoryAudio,
  listAudioHistory,
  quoteAudioCleanup,
  type AudioCleanupCreditQuote,
} from "@/lib/api/audio";
import styles from "./audio-generation-page.module.css";
import { type AudioHistoryItem } from "./audio-generation.types";
import { AUDIO_HISTORY_LIMIT } from "./audio-generation.constants";
import {
  failAudioProgress,
  finishAudioProgress,
  formatAudioFileSize,
  formatAudioHistoryDate,
  formatCreditAmount,
  formatSceneSeconds,
  startAudioProgress,
} from "./audio-generation.helpers";
import { AlternateHeading, AudioSettingLabel } from "./audio-shared-parts";
import { PodcastConfirmationDialog } from "./podcast-parts";
import { CleanupAudioPlayer } from "./cleanup-audio-player";

export function AudioCleanupLayout() {
  const { locale, t } = useLocale();
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
  const [creditEstimate, setCreditEstimate] = useState<AudioCleanupCreditQuote | null>(null);
  const [creditEstimateLoading, setCreditEstimateLoading] = useState(false);
  const [creditEstimateError, setCreditEstimateError] = useState<string | null>(null);
  const [cleanupHistory, setCleanupHistory] = useState<AudioHistoryItem[]>([]);
  const [cleanupHistoryLoadingId, setCleanupHistoryLoadingId] = useState<string | null>(null);
  const [cleanupHistoryPlayRequest, setCleanupHistoryPlayRequest] = useState(0);
  const [pendingCleanupHistoryDelete, setPendingCleanupHistoryDelete] = useState<AudioHistoryItem | null>(null);
  const cleanupHistoryRef = useRef<AudioHistoryItem[]>([]);
  const cleanupHistoryPlaybackRequestRef = useRef(0);

  useEffect(() => {
    let active = true;
    void listAudioHistory({ feature: "audio-cleanup", limit: AUDIO_HISTORY_LIMIT })
      .then((items) => {
        if (!active) return;
        const savedHistory = items.map((item) => ({
          ...item,
          url: item.url ?? item.audioUrl ?? item.downloadUrl ?? "",
          localUrl: false,
          persisted: true,
        }));
        const localHistory = cleanupHistoryRef.current.filter((item) => item.localUrl);
        const history = [
          ...localHistory,
          ...savedHistory.filter((item) => !localHistory.some((localItem) => localItem.id === item.id)),
        ].slice(0, AUDIO_HISTORY_LIMIT);
        cleanupHistoryRef.current = history;
        setCleanupHistory(history);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  useEffect(
    () => () => {
      cleanupHistoryPlaybackRequestRef.current += 1;
      cleanupHistoryRef.current
        .filter((item) => item.localUrl && item.url)
        .forEach((item) => URL.revokeObjectURL(item.url));
    },
    [],
  );

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
    if (!file || durationSeconds <= 0) {
      setCreditEstimate(null);
      setCreditEstimateLoading(false);
      setCreditEstimateError(null);
      return;
    }
    const controller = new AbortController();
    setCreditEstimateLoading(true);
    setCreditEstimateError(null);
    void quoteAudioCleanup({ durationSeconds, ...options, outputFormat }, controller.signal)
      .then((quote) => setCreditEstimate(quote))
      .catch((quoteError) => {
        if (controller.signal.aborted) return;
        setCreditEstimate(null);
        setCreditEstimateError(quoteError instanceof Error ? quoteError.message : "Audio cleanup pricing unavailable");
      })
      .finally(() => {
        if (!controller.signal.aborted) setCreditEstimateLoading(false);
      });
    return () => controller.abort();
  }, [durationSeconds, file, options, outputFormat]);

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
    setCreditEstimate(null);
    setCreditEstimateError(null);
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

  const appendCleanupHistory = (item: AudioHistoryItem) => {
    const nextHistory = [item, ...cleanupHistoryRef.current];
    const removedItems = nextHistory.slice(AUDIO_HISTORY_LIMIT);
    removedItems
      .filter((removed) => removed.localUrl && removed.url)
      .forEach((removed) => URL.revokeObjectURL(removed.url));
    const limitedHistory = nextHistory.slice(0, AUDIO_HISTORY_LIMIT);
    cleanupHistoryRef.current = limitedHistory;
    setCleanupHistory(limitedHistory);
  };

  const playCleanupHistory = async (item: AudioHistoryItem) => {
    const requestId = ++cleanupHistoryPlaybackRequestRef.current;
    setCleanupHistoryLoadingId(item.id);
    setError(null);
    try {
      let nextUrl = item.url;
      if (!nextUrl || (item.persisted && !item.localUrl)) {
        const result = await fetchAudioHistoryAudio(item.id);
        if (requestId !== cleanupHistoryPlaybackRequestRef.current) return;
        nextUrl = URL.createObjectURL(result.blob);
        const nextHistory = cleanupHistoryRef.current.map((historyItem) =>
          historyItem.id === item.id ? { ...historyItem, url: nextUrl, localUrl: true } : historyItem,
        );
        cleanupHistoryRef.current = nextHistory;
        setCleanupHistory(nextHistory);
      }
      setCleanedUrl(nextUrl);
      setStatus("done");
      setCleanupHistoryPlayRequest((current) => current + 1);
    } catch (cause) {
      if (requestId === cleanupHistoryPlaybackRequestRef.current) setError(cause instanceof Error ? cause.message : "Unable to load saved audio cleanup");
    } finally {
      if (requestId === cleanupHistoryPlaybackRequestRef.current) setCleanupHistoryLoadingId(null);
    }
  };

  const removeCleanupHistory = (item: AudioHistoryItem) => {
    setPendingCleanupHistoryDelete(item);
  };

  const confirmRemoveCleanupHistory = () => {
    const item = pendingCleanupHistoryDelete;
    if (!item) return;
    setPendingCleanupHistoryDelete(null);

    const removeFromView = () => {
      if (item.localUrl && item.url) URL.revokeObjectURL(item.url);
      const nextHistory = cleanupHistoryRef.current.filter((historyItem) => historyItem.id !== item.id);
      cleanupHistoryRef.current = nextHistory;
      setCleanupHistory(nextHistory);
      if (item.url && item.url === cleanedUrl) {
        setCleanedUrl(null);
        setStatus(file ? "ready" : "empty");
      }
    };

    if (!item.persisted) {
      removeFromView();
      return;
    }
    void deleteAudioHistory(item.id)
      .then(removeFromView)
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "Unable to delete saved audio cleanup");
      });
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
    if (durationSeconds <= 0) {
      setError(t("create.audio.cleanup.selectFile"));
      return;
    }
    const requestId = startAudioProgress("audio-cleanup");
    setStatus("processing");
    setError(null);
    try {
      const result = await cleanupAudio({ audio: file, durationSeconds, ...options, outputFormat });
      const nextUrl = URL.createObjectURL(result.blob);
      const historyItem: AudioHistoryItem = {
        id: result.localHistoryId ?? `audio-cleanup-local-${Date.now()}`,
        feature: "audio-cleanup",
        label: file.name || "Cleaned audio",
        provider: creditEstimate?.provider ?? "internal",
        outputFormat,
        mimeType: result.contentType || file.type || "audio/mpeg",
        sizeBytes: result.blob.size,
        createdAt: new Date().toISOString(),
        durationSeconds,
        metadata: {
          noiseReduction: options.noiseReduction,
          voiceClarity: options.voiceClarity,
          removeReverb: options.removeReverb,
          normalizeLoudness: options.normalizeLoudness,
          preserveTone: options.preserveTone,
          creditCost: creditEstimate?.creditCost,
        },
        url: nextUrl,
        localUrl: true,
        persisted: Boolean(result.localHistoryId),
      };
      appendCleanupHistory(historyItem);
      setCleanedUrl(nextUrl);
      setStatus("done");
      finishAudioProgress("audio-cleanup", requestId);
    } catch (cleanupError) {
      failAudioProgress("audio-cleanup", requestId);
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
    { key: "noiseReduction" as const, label: t("create.audio.cleanup.noiseReduction"), hint: t("create.audio.cleanup.noiseReductionHint"), icon: VolumeX },
    { key: "voiceClarity" as const, label: t("create.audio.cleanup.voiceClarity"), hint: t("create.audio.cleanup.voiceClarityHint"), icon: Mic2 },
    { key: "removeReverb" as const, label: t("create.audio.cleanup.removeReverb"), hint: t("create.audio.cleanup.removeReverbHint"), icon: Waves },
    { key: "normalizeLoudness" as const, label: t("create.audio.cleanup.normalizeLoudness"), hint: t("create.audio.cleanup.normalizeLoudnessHint"), icon: SlidersHorizontal },
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
        <div className={styles.cleanupSourceNote}><LockKeyhole size={12} /> {t("create.audio.cleanup.privateNote")}</div>
        {error ? <p className={styles.cleanupError} role="alert">{error}</p> : null}
        <div className={styles.cleanupFileStats} aria-label="สรุปไฟล์เสียง">
          <div><strong>{formattedDuration}</strong><small>ความยาว</small></div>
          <div><strong>{file ? formatAudioFileSize(file.size) : "—"}</strong><small>ขนาดไฟล์</small></div>
          <div><strong>{file ? file.type.split("/")[1]?.toUpperCase() ?? "AUDIO" : "—"}</strong><small>รูปแบบ</small></div>
        </div>
        <div className={styles.cleanupSourceGuide}>
          <div className={styles.cleanupSourceGuideHeader}>
            <div><span>FILE GUIDE</span><strong>ไฟล์เสียงที่รองรับ</strong></div>
            <span>สูงสุด 50 MB</span>
          </div>
          <div className={styles.cleanupFormatChips} aria-label="รูปแบบไฟล์ที่รองรับ">
            <span>MP3</span><span>WAV</span><span>OGG</span>
          </div>
          <p>อัปโหลดไฟล์เสียงพูดหรือพอดแคสต์ แล้วเลือกเครื่องมือที่ต้องการปรับได้เลย</p>
        </div>
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
              <span>{t("create.audio.preview")}</span>
              <span className={styles.cleanupPreviewLabelActions}>
                <small>{cleanedUrl ? outputFormat.toUpperCase() : "—"}</small>
                {cleanedUrl ? (
                  <a
                    className={styles.cleanupDownload}
                    href={cleanedUrl}
                    download={`cleaned-audio.${outputFormat}`}
                    aria-label={t("create.audio.download")}
                    title={t("create.audio.download")}
                  >
                    <Download size={13} aria-hidden="true" />
                    <span>{t("create.audio.download")}</span>
                  </a>
                ) : null}
              </span>
            </div>
            <CleanupAudioPlayer src={cleanedUrl} label={t("create.audio.cleanup.cleaned")} playRequest={cleanupHistoryPlayRequest} />
          </div>
        </div>
        {!cleanedUrl ? (
          <div className={styles.cleanupPreviewHint}>
            <WandSparkles size={14} /> {t("create.audio.cleanup.previewHint")}
          </div>
        ) : null}
        <section className={styles.historyPanel} aria-label={t("create.audio.a11y.historyPanel")}>
          <div className={styles.sectionHeading}>
            <h2>
              <History size={13} /> {t("create.audio.generationHistory")}
            </h2>
            <span className={styles.timelineHint}>
              {cleanupHistory.length
                ? cleanupHistory.length === 1
                  ? t("create.audio.resultCountOne")
                  : t("create.audio.resultCountMany", { count: cleanupHistory.length })
                : t("create.audio.noResults")}
            </span>
          </div>
          {cleanupHistory.length ? (
            <div className={styles.historyList}>
              {cleanupHistory.map((item) => (
                <div
                  key={item.id}
                  className={item.url === cleanedUrl ? styles.historyItemRowActive : styles.historyItemRow}
                >
                  <button
                    type="button"
                    className={item.url === cleanedUrl ? styles.historyItemActive : styles.historyItem}
                    onClick={() => void playCleanupHistory(item)}
                    disabled={cleanupHistoryLoadingId === item.id}
                    aria-busy={cleanupHistoryLoadingId === item.id}
                  >
                    <span className={cleanupHistoryLoadingId === item.id ? styles.historyLoading : styles.historyPlay}>
                      {cleanupHistoryLoadingId === item.id ? null : <Play size={13} fill="currentColor" />}
                    </span>
                    <span className={styles.historyCopy}>
                      <strong>{item.label}</strong>
                      <small>{formatAudioHistoryDate(item.createdAt, locale)}</small>
                    </span>
                    <span className={styles.historyCurrent}>
                      {item.url === cleanedUrl ? t("create.audio.historyCurrent") : t("create.audio.historyPlay")}
                    </span>
                  </button>
                  <button
                    type="button"
                    className={styles.historyDelete}
                    aria-label={t("create.audio.a11y.deleteItem", { label: item.label })}
                    onClick={() => removeCleanupHistory(item)}
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

      <aside className={`${styles.alternateSettings} ${styles.cleanupSettingsPanel}`}>
        <div className={styles.altPanelHeader}>
          <div>
            <span className={styles.altEyebrow}>{t("create.audio.cleanup.tools")}</span>
            <h2>{t("create.audio.cleanup.settings")}</h2>
          </div>
          <Settings2 size={20} />
        </div>
        <p className={styles.cleanupSettingsHint}>{t("create.audio.cleanup.settingsHint")}</p>
        <div className={styles.cleanupToolList}>
          {optionRows.map((option) => (
            <label className={`${styles.cleanupToolCard} ${options[option.key] ? styles.cleanupToolCardActive : ""}`} key={option.key}>
              <input type="checkbox" checked={options[option.key]} onChange={() => toggleOption(option.key)} aria-label={option.label} />
              <span className={styles.cleanupToolIcon}><option.icon size={18} strokeWidth={2.1} /></span>
              <span className={styles.cleanupToolCopy}>
                <span className={styles.cleanupToolTitleRow}><strong>{option.label}</strong></span>
                <small>{option.hint}</small>
              </span>
              <span className={styles.cleanupToolSwitch} aria-hidden="true"><span /></span>
            </label>
          ))}
        </div>
        <label className={styles.cleanupToneToggle}>
          <input type="checkbox" checked={options.preserveTone} onChange={() => toggleOption("preserveTone")} aria-label={t("create.audio.cleanup.preserveTone")} />
          <span className={styles.cleanupToneIcon}><Sparkles size={16} /></span>
          <span className={styles.cleanupToneCopy}><strong>{t("create.audio.cleanup.preserveTone")}</strong><small>{t("create.audio.cleanup.preserveToneHint")}</small></span>
          <span className={styles.cleanupToolSwitch} aria-hidden="true"><span /></span>
        </label>
        <div className={styles.cleanupFormatField}>
          <span><AudioSettingLabel label={t("create.audio.cleanup.outputFormat")} /></span>
          <Dropdown
            value={outputFormat}
            options={[
              { value: "mp3", label: "MP3" },
              { value: "wav", label: "WAV" },
              { value: "ogg", label: "OGG" },
            ]}
            onChange={(value) => setOutputFormat(value as typeof outputFormat)}
            ariaLabel={t("create.audio.cleanup.outputFormat")}
            className={styles.cleanupFormatDropdown}
            triggerClassName={styles.cleanupFormatTrigger}
            menuPosition="fixed"
          />
        </div>
        <div data-mobile-action-dock className={styles.mobileActionDock}>
          <div className={styles.creditEstimate}>
            <div className={styles.creditEstimateHeader}>
              <strong>{t("create.audio.estimatedCredits")} <InfoTooltip content={t("create.audio.info.estimatedCredits")} size={11} /></strong>
              <b title={creditEstimateError ?? undefined}>
                {creditEstimateLoading
                  ? t("create.audio.calculating")
                  : creditEstimate
                    ? t("create.audio.creditsAmount", { amount: formatCreditAmount(creditEstimate.creditCost) })
                    : "—"}
              </b>
            </div>
            <p className={`${styles.creditEstimateCount} ${!file ? styles.cleanupEstimateWaiting : ""}`}>
              {creditEstimate
                ? `${formattedDuration} · ${creditEstimate.provider === "elevenlabs" ? "ElevenLabs Voice Isolator" : t("create.audio.cleanup.internalProcessor")}`
                : file
                  ? t("create.audio.calculating")
                  : t("create.audio.cleanup.waiting")}
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
      <PodcastConfirmationDialog
        open={Boolean(pendingCleanupHistoryDelete)}
        onOpenChange={(open) => {
          if (!open) setPendingCleanupHistoryDelete(null);
        }}
        title="ลบประวัติการปรับปรุงเสียงหรือไม่?"
        description={`“${pendingCleanupHistoryDelete?.label ?? "รายการนี้"}” จะถูกลบออกจากประวัติการสร้างและกู้คืนไม่ได้`}
        onConfirm={confirmRemoveCleanupHistory}
      />
    </div>
  );
}
