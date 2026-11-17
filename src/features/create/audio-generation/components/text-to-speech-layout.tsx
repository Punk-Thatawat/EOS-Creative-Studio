import { promptMaxLength } from "@/lib/prompt-limits";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  History,
  LockKeyhole,
  Mic2,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Sparkles,
  Trash2,
  Volume2,
  WandSparkles,
} from "lucide-react";
import { InfoTooltip } from "@/features/create/components/info-tooltip";
import { ClearValuesButton } from "@/features/create/components/clear-values-button";
import {
  ImageTutorialButton,
} from "@/features/create/image-generation/components/image-tutorial-button";
import { Dropdown } from "@/components/ui/dropdown";
import { type MiniMaxSpeechEmotion } from "./audio-generation.types";
import {
  MINIMAX_LANGUAGE_BOOST_OPTIONS,
  VOICE_PAGE_SIZE,
  toneKeys,
  tones,
  voiceImages,
} from "./audio-generation.constants";
import {
  formatAudioHistoryDate,
  formatCreditAmount,
  supportsMiniMaxSpeechTuning,
} from "./audio-generation.helpers";
import { FieldLabel, PreviewWaveform, SelectField } from "./audio-shared-parts";
import Image from "next/image";
import styles from "./audio-generation-page.module.css";
import type { AudioGeneration } from "./use-audio-generation";

export function TextToSpeechLayout({ audio }: { audio: AudioGeneration }) {
  const {
    setActiveTab,
    prompt,
    setPrompt,
    tone,
    setTone,
    voiceMode,
    setVoiceMode,
    language,
    setLanguage,
    pronunciation,
    setPronunciation,
    setSelectedModel,
    availableModels,
    modelLoadState,
    selectedVoice,
    setSelectedVoice,
    voiceLoadState,
    voiceError,
    canScrollVoicesLeft,
    canScrollVoicesRight,
    format,
    setFormat,
    speed,
    setSpeed,
    pitch,
    setPitch,
    synthVolume,
    setSynthVolume,
    speechEmotion,
    setSpeechEmotion,
    englishNormalization,
    setEnglishNormalization,
    ttsLanguageBoost,
    setTtsLanguageBoost,
    ttsSampleRate,
    setTtsSampleRate,
    ttsBitrate,
    setTtsBitrate,
    ttsChannel,
    setTtsChannel,
    isPlaying,
    setIsPlaying,
    progress,
    setProgress,
    audioUrl,
    historyLoadingId,
    duration,
    setDuration,
    currentTime,
    setCurrentTime,
    volume,
    setVolume,
    creditEstimate,
    creditEstimateLoading,
    creditEstimateError,
    audioScenes,
    setAudioScenes,
    errorMessage,
    previewingVoiceKey,
    previewLoadingKey,
    setPendingHistoryDelete,
    setHistoryDeleteOpen,
    isModelLockedToClonedVoice,
    selectableModels,
    selectedModel,
    audioRef,
    voicePreviewAudioRef,
    durationRef,
    voiceRowRef,
    voiceScrollUserMovedRef,
    updatePreviewingVoiceKey,
    loadVoices,
    scrollVoices,
    handleVoicePreviewClick,
    syncAudioDuration,
    carouselVoices,
    voicePages,
    carouselLoadState,
    historyRows,
    isSceneMode,
    hasIncompleteScene,
    isGenerating,
    clearValues,
    generationValidationMessage,
    formatTime,
    handleGenerate,
    handleGenerateScenes,
    selectHistoryItem,
    togglePlayback,
    downloadAudio,
    seekBy,
    locale,
    t,
  } = audio;

  return (
      <div className={styles.audioGrid}>
        <section className={styles.scriptPanel} aria-label={t("create.audio.a11y.scriptPanel")}>
          <div className={styles.audioPromptTopActions}>
            <ImageTutorialButton feature="textToSpeech" featureName="Text to Speech" />
            <ClearValuesButton onClick={clearValues} />
          </div>
          <div className={styles.voiceModePanel}>
            <div className={styles.voiceModeHeading}>
              <h2>{t("create.audio.voiceMode.label")}</h2>
              <InfoTooltip content={t("create.audio.info.voiceMode")} size={11} />
            </div>
            <Dropdown
              value={voiceMode}
              onChange={(value) => setVoiceMode(value as "tone" | "cloned")}
              options={[
                { value: "tone", label: t("create.audio.voiceMode.tone") },
                { value: "cloned", label: t("create.audio.voiceMode.cloned") },
              ]}
              ariaLabel={t("create.audio.voiceMode.label")}
              triggerClassName="h-[38px] min-h-0 rounded-lg border-[#dfe2e7] px-[11px] text-[11px] font-normal"
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
              <button
                type="button"
                className={styles.voiceCloneLink}
                onClick={() => setActiveTab("Voice Clone")}
              >
                {t("create.audio.voiceMode.cloneNewLink")}
              </button>
            ) : null}
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
            <div className={styles.selectField}>
              <FieldLabel>{t("create.audio.pronunciationHints")}</FieldLabel>
              <input
                value={pronunciation}
                onChange={(event) => setPronunciation(event.target.value)}
                placeholder={"e.g. EOS as “อี-โอ-เอส”"}
                aria-label={t("create.audio.pronunciationHints")}
              />
            </div>
          </div>
        </section>

        <section className={styles.centerColumn} aria-label={t("create.audio.a11y.centerColumn")}>
          <div className={`${styles.sectionBlock} ${styles.voiceSection}`}>
            <div className={styles.sectionHeading}>
              <h2>{voiceMode === "cloned" ? t("create.audio.clone.savedVoices") : t("create.audio.voiceSpeaker")} <InfoTooltip content={t("create.audio.info.voiceSpeaker")} size={11} /></h2>
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
                {carouselLoadState === "loading" ? (
                  <div className={styles.voiceState} role="status">
                    {t("create.audio.loadingVoices")}
                  </div>
                ) : null}
                {carouselLoadState === "error" ? (
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
                {carouselLoadState === "ready" && carouselVoices.length === 0 ? (
                  <div className={`${styles.voiceState} ${voiceMode === "cloned" ? styles.voiceStateEmpty : ""}`}>
                    {voiceMode === "cloned" ? (
                      <>
                        <span>{t("create.audio.clone.noSavedVoices")}</span>
                        <button
                          type="button"
                          className={styles.voiceCloneLink}
                          onClick={() => setActiveTab("Voice Clone")}
                        >
                          {t("create.audio.voiceMode.cloneNewLink")}
                        </button>
                      </>
                    ) : (
                      t("create.audio.noVoices")
                    )}
                  </div>
                ) : null}
                {carouselLoadState === "ready"
                  ? voicePages.map((page, pageIndex) => (
                      <div className={styles.voicePage} key={`voice-page-${pageIndex}`}>
                        {page.map((voice, index) => (
                          <div
                            className={`${styles.voiceCardWrap} ${selectedVoice === voice.key ? styles.voiceCardWrapActive : ""} ${voiceMode === "cloned" && !voice.imageUrl ? styles.voiceCardWrapCompact : ""}`}
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
                              {voiceMode === "cloned" && !voice.imageUrl ? null : (
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
                              )}
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
                              disabled={voiceMode === "cloned" ? previewLoadingKey !== null : !voice.previewUrl}
                              aria-label={
                                voiceMode === "cloned" || voice.previewUrl
                                  ? previewingVoiceKey === voice.key
                                    ? `หยุดตัวอย่างเสียง ${voice.name}`
                                    : `ฟังตัวอย่างเสียง ${voice.name}`
                                  : `ยังไม่มีตัวอย่างเสียง ${voice.name}`
                              }
                              title={voiceMode === "cloned" || voice.previewUrl ? "ฟังตัวอย่างเสียง" : "ยังไม่มีตัวอย่างเสียง"}
                            >
                              {previewLoadingKey === voice.key ? (
                                <span className={styles.voicePreviewSpinner} />
                              ) : previewingVoiceKey === voice.key ? (
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
            onEnded={() => updatePreviewingVoiceKey(null)}
            onError={() => updatePreviewingVoiceKey(null)}
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
            </div>
          ) : null}

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
                          onClick={() => {
                            setVoiceMode("cloned");
                            setSelectedVoice(row.voice.voiceId);
                          }}
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
                  const item = row.item;
                  return (
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

        <aside className={styles.settingsPanel} aria-label={t("create.audio.a11y.settingsPanel")}>
          <div className={`${styles.settingsTitle} flex-wrap gap-2`}>
            <h2>{t("create.audio.settings")}</h2>
            <WandSparkles size={22} />
          </div>
          <div className={styles.settingBlock}>
            <FieldLabel>{t("create.audio.voiceModel")}</FieldLabel>
            {selectableModels.length > 1 && !isModelLockedToClonedVoice ? (
              <Dropdown
                value={selectedModel}
                options={selectableModels.map((model) => ({ value: model.key, label: model.name }))}
                onChange={setSelectedModel}
                ariaLabel={t("create.audio.voiceModel")}
                triggerClassName="h-[38px] min-h-0 rounded-lg border-[#dfe2e7] px-[11px] text-[11px] font-normal"
              />
            ) : (
              <div className={styles.fixedVoiceModel}>
                {availableModels.find((model) => model.key === selectedModel)?.name ??
                  selectableModels[0]?.name ??
                  (modelLoadState === "loading"
                    ? (locale === "th" ? "กำลังโหลดโมเดล..." : "Loading model...")
                    : t("create.audio.validation.noModel"))}
              </div>
            )}
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
          {!['eleven_v4', 'elevenlabs/eleven-v4'].includes(selectedModel.toLowerCase()) && <div className={styles.settingBlock}>
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
          </div>}
          {supportsMiniMaxSpeechTuning(selectedModel) ? (
            <>
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
                <SelectField
                  label={t("create.audio.clone.emotion")}
                  value={speechEmotion}
                  onChange={(value) => setSpeechEmotion(value as MiniMaxSpeechEmotion | "")}
                  options={[
                    { value: "", label: t("create.audio.emotionAuto") },
                    { value: "neutral", label: t("create.audio.clone.emotionNeutral") },
                    { value: "happy", label: t("create.audio.clone.emotionHappy") },
                    { value: "sad", label: t("create.audio.clone.emotionSad") },
                    { value: "angry", label: t("create.audio.clone.emotionAngry") },
                    { value: "fearful", label: t("create.audio.clone.emotionFearful") },
                    { value: "disgusted", label: t("create.audio.clone.emotionDisgusted") },
                    { value: "surprised", label: t("create.audio.clone.emotionSurprised") },
                  ]}
                />
              </div>
              <div className={styles.settingBlock}>
                <div className={styles.musicHeader}>
                  <FieldLabel>{t("create.audio.clone.englishNormalization")}</FieldLabel>
                  <button
                    type="button"
                    className={englishNormalization ? styles.toggleOn : styles.toggleOff}
                    onClick={() => setEnglishNormalization((current) => !current)}
                    aria-label={t("create.audio.clone.englishNormalization")}
                    aria-pressed={englishNormalization}
                  >
                    <span />
                  </button>
                </div>
              </div>
              <div className={styles.settingBlock}>
                <SelectField
                  label={t("create.audio.language")}
                  value={ttsLanguageBoost}
                  onChange={(value) => setTtsLanguageBoost(value as "Thai" | "English")}
                  options={MINIMAX_LANGUAGE_BOOST_OPTIONS}
                />
              </div>
              <div className={styles.settingBlock}>
                <SelectField
                  label={t("create.audio.clone.sampleRate")}
                  value={ttsSampleRate}
                  onChange={setTtsSampleRate}
                  options={[
                    { value: "", label: t("create.audio.defaultOption") },
                    ...["8000", "16000", "22050", "24000", "32000", "44100"].map((value) => ({ value, label: `${value} Hz` })),
                  ]}
                />
              </div>
              <div className={styles.settingBlock}>
                <SelectField
                  label={t("create.audio.clone.bitrate")}
                  value={ttsBitrate}
                  onChange={setTtsBitrate}
                  options={[
                    { value: "", label: t("create.audio.defaultOption") },
                    ...["32000", "64000", "128000", "256000"].map((value) => ({ value, label: `${Number(value) / 1000} kbps` })),
                  ]}
                />
              </div>
              <div className={styles.settingBlock}>
                <SelectField
                  label={t("create.audio.clone.channel")}
                  value={ttsChannel}
                  onChange={(value) => setTtsChannel(value as "" | "1" | "2")}
                  options={[
                    { value: "", label: t("create.audio.defaultOption") },
                    { value: "1", label: t("create.audio.clone.channelMono") },
                    { value: "2", label: t("create.audio.clone.channelStereo") },
                  ]}
                />
              </div>
            </>
          ) : null}
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
            {errorMessage ? (
              <p className={styles.generationValidation} role="alert">
                {errorMessage}
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
  );
}
