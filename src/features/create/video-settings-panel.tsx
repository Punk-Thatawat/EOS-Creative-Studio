import { CloudUpload, LockKeyhole, Mic2, WandSparkles, X } from "lucide-react";
import { Dropdown } from "@/components/ui/dropdown";
import { DurationControl } from "./components/duration-control";
import { translateVideoSchemaDescription, translateVideoSchemaOption } from "./video-schema-copy";
import { VideoModelDropdown } from "./video-model-dropdown";
import { InfoTooltip } from "./components/info-tooltip";
import { referenceImageParameterAliases } from "./video-generation.constants";
import { findModelInputParameter, parseSchemaEnumValue } from "./video-schema-helpers";
import { SectionTitle } from "./section-title";
import styles from "./video-generation-page.module.css";
import type { VideoGenerationPageState } from "./use-video-generation-page";

export function VideoSettingsPanel({ videoGen }: { videoGen: VideoGenerationPageState }) {
  const {
    duration,
    resolution,
    setResolution,
    aspectRatio,
    setAspectRatio,
    autoSound,
    setAutoSound,
    audioFile,
    setAudioFile,
    postAudioSfxEnabled,
    setPostAudioSfxEnabled,
    postAudioMusicEnabled,
    setPostAudioMusicEnabled,
    generationMode,
    models,
    selectedModel,
    setSelectedModel,
    modelsLoading,
    setModelsLoading,
    modelsError,
    setModelsError,
    setModelLoadRetry,
    modelParams,
    generationStatus,
    generationProgress,
    generationError,
    creditEstimateLoading,
    creditEstimateError,
    detectedImageAspectRatio,
    storyboardHasMixedAspectRatios,
    isAudioDragging,
    setIsAudioDragging,
    localizedParameterLabel,
    audioInputRef,
    requiredProperties,
    durationProperty,
    resolutionProperty,
    aspectRatioOptions,
    supportsAspectRatio,
    canSelectAspectRatio,
    audioProperty,
    audioInputMode,
    supportsPostAudioSfx,
    supportsPostAudioMusic,
    showPostAudioOptions,
    postAudioMode,
    settingsModelParameterEntries,
    updateDuration,
    updateModelParam,
    handleAudioFile,
    handleAudioDrop,
    clearFrameReferences,
    clearReferenceImageSlots,
    generationScenes,
    shouldAutoUpscaleStoryboard,
    estimateDescription,
    totalCreditEstimate,
    formattedCreditEstimate,
    isGeneratingVideo,
    videoValidationMessage,
    canGenerate,
    handleGenerate,
    t,
  } = videoGen;

  return (
    <aside className={styles.settings}>
        <SectionTitle number="3">{t("create.video.common.settings")}</SectionTitle>
      <label className="mb-2 flex items-center gap-1 text-[10px] font-bold">
         {t("create.video.common.model")} <InfoTooltip content={t("create.video.common.info.model")} size={11} />
      </label>
      <VideoModelDropdown
        models={models}
        value={selectedModel}
        loading={modelsLoading}
         ariaLabel={t("create.video.common.modelOptions", { feature: t("create.video.tabs.imageToVideo") })}
        onChange={(nextModel) => {
          const option = models.find((item) => item.model === nextModel);
          if (option) {
            const optionReferenceParameter = findModelInputParameter(
              option,
              option.capabilities.referenceImagesParameter,
              referenceImageParameterAliases,
            );
            if (!optionReferenceParameter) {
              clearFrameReferences();
              clearReferenceImageSlots();
            }
          }
          setSelectedModel(nextModel);
        }}
      />
      {modelsError ? (
        <p className={styles.settingsError} role="alert">
          {modelsError}
          <button type="button" className={styles.modelRetryButton} onClick={() => {
            setModelsError(null);
            setModelsLoading(true);
            setModelLoadRetry((current) => current + 1);
          }}>
            {t("create.video.common.retry")}
          </button>
        </p>
      ) : null}
      {generationMode !== "single-image" && durationProperty ? (
        <DurationControl
          property={durationProperty[1]}
          value={duration}
          required={requiredProperties.has(durationProperty[0])}
          info={t("create.video.common.info.duration")}
          onChange={updateDuration}
        />
      ) : null}
      {resolutionProperty ? (
        <div className={styles.settingBlock}>
           <div className={styles.settingLabel}>{t("create.video.common.resolution")} <InfoTooltip content={t("create.video.common.info.resolution")} size={11} /></div>
          <Dropdown
            value={resolution}
            options={(resolutionProperty[1].enum ?? []).map((value) => ({
              value: String(value),
              label: String(value),
            }))}
             ariaLabel={t("create.video.common.resolutionOptions")}
             placeholder={t("create.video.common.selectResolution")}
            onChange={setResolution}
            className={styles.modelDropdown}
            triggerClassName={`${styles.modelDropdownTrigger} ${styles.resolutionDropdownTrigger}`}
            menuClassName={`${styles.modelDropdownMenu} ${styles.resolutionDropdownMenu}`}
            optionClassName={styles.resolutionDropdownOption}
          />
        </div>
      ) : null}
      {supportsAspectRatio && aspectRatioOptions.length > 0 ? (
        <div className={styles.settingBlock}>
          <div className={styles.settingLabel}>
             {t("create.video.common.aspectRatio")} <InfoTooltip content={t("create.video.common.info.aspectRatio")} size={11} />
            {storyboardHasMixedAspectRatios
               ? <small className={styles.autoAspectRatioHint}>{t("create.video.common.perScene")}</small>
              : !canSelectAspectRatio && detectedImageAspectRatio !== null
                 ? <small className={styles.autoAspectRatioHint}>{t("create.video.common.autoFromImage")}</small>
                : null}
          </div>
          <div className={styles.ratios}>
            {aspectRatioOptions.map((ratio) => {
              return (
                <button
                  type="button"
                  className={aspectRatio === ratio ? styles.ratioSelected : ""}
                  onClick={() => setAspectRatio(ratio)}
                  disabled={storyboardHasMixedAspectRatios}
                  title={storyboardHasMixedAspectRatios
                     ? t("create.video.common.eachSceneAspectRatio")
                    : !canSelectAspectRatio && detectedImageAspectRatio !== null
                       ? t("create.video.common.detectedAspectRatio")
                       : t("create.video.common.useRatio", { ratio })}
                  key={ratio}
                >
                  <i className={ratio === "1:1" ? styles.square : Number(ratio.split(":")[0]) < Number(ratio.split(":")[1]) ? styles.portrait : styles.landscape} />
                  {ratio}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
      {audioProperty && !audioInputMode ? (
        <div className={styles.toggleRow}>
           <span className={styles.fieldLabelWithInfo}>{t("create.video.common.audio")} <InfoTooltip content={t("create.video.common.info.generateAudio")} size={11} /></span>
          <button
            type="button"
            className={styles.toggle}
            aria-pressed={autoSound}
            onClick={() => setAutoSound((value) => !value)}
          >
            <i />
          </button>
        </div>
      ) : null}
      {audioInputMode && generationMode !== "reference-to-video" ? (
        <div className={styles.audioReferenceField}>
           <div className={styles.settingLabel}><span>{t("create.video.common.audioReference")}</span><small>{t("create.video.common.optional")}</small></div>
           {audioFile ? <div className={styles.peopleNotice}><Mic2 size={13} /> {audioFile.name}<button type="button" onClick={() => setAudioFile(null)} aria-label={t("create.video.common.removeAudio")}><X size={13} /></button></div> : <button type="button" className={`${styles.upload} ${isAudioDragging ? styles.uploadDragging : ""}`} onClick={() => audioInputRef.current?.click()} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; setIsAudioDragging(true); }} onDragLeave={() => setIsAudioDragging(false)} onDrop={handleAudioDrop}><CloudUpload size={18} /><strong>{t("create.video.common.uploadAudioReference")}</strong><small>{t("create.video.common.audioFormats")}</small></button>}
          <input ref={audioInputRef} type="file" accept="audio/mpeg,audio/wav,audio/x-wav,audio/mp4" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleAudioFile(file); event.currentTarget.value = ""; }} />
        </div>
      ) : null}
      {showPostAudioOptions ? (
        <div className={styles.postAudioCard}>
           <div className={styles.settingLabel}><span>{t("create.video.common.addAudioAfterVideo")}</span><small>{t("create.video.common.optional")}</small></div>
           <div className={styles.postAudioOptions} role="group" aria-label={t("create.video.common.addAudioAfterVideo")}>
            {supportsPostAudioSfx ? <div className={styles.toggleRow}>
               <span className={styles.fieldLabelWithInfo}>{t("create.video.common.videoToSfx")} <InfoTooltip content={t("create.video.common.info.videoToSfx")} size={11} /></span>
              <button
                type="button"
                className={`${styles.toggle} ${postAudioSfxEnabled ? "" : styles.toggleOff}`}
                onClick={() => setPostAudioSfxEnabled((value) => !value)}
                aria-pressed={postAudioSfxEnabled}
                 aria-label={t("create.video.common.enableVideoToSfx")}
              >
                <i />
              </button>
            </div> : null}
            {supportsPostAudioMusic ? <div className={styles.toggleRow}>
               <span className={styles.fieldLabelWithInfo}>{t("create.video.common.videoToMusic")} <InfoTooltip content={t("create.video.common.info.videoToMusic")} size={11} /></span>
              <button
                type="button"
                className={`${styles.toggle} ${postAudioMusicEnabled ? "" : styles.toggleOff}`}
                onClick={() => setPostAudioMusicEnabled((value) => !value)}
                aria-pressed={postAudioMusicEnabled}
                 aria-label={t("create.video.common.enableVideoToMusic")}
              >
                <i />
              </button>
            </div> : null}
          </div>
          {postAudioMode !== "none" ? (
             <small className={styles.postAudioHint}>{t("create.video.common.postAudioHint")}</small>
          ) : null}
        </div>
      ) : null}
      {settingsModelParameterEntries.map(([name, property]) => {
        const value = modelParams[name];
        const isRequired = requiredProperties.has(name);
        const label = localizedParameterLabel(name, property.title);
        if (property.enum?.length) {
          return (
            <label className={styles.dynamicField} key={name}>
              <span>{label}{isRequired ? <b>*</b> : null}</span>
              <Dropdown
                value={value === undefined ? "" : String(value)}
                options={[
                  ...(!isRequired ? [{ value: "", label: `${t("create.video.common.selectPrefix")} ${label.toLowerCase()}` }] : []),
                  ...property.enum.map((option) => ({ value: String(option), label: translateVideoSchemaOption(option, t) })),
                ]}
                onChange={(nextValue) => updateModelParam(name, parseSchemaEnumValue(nextValue, property))}
                ariaLabel={label}
                placeholder={`${t("create.video.common.selectPrefix")} ${label.toLowerCase()}`}
                className={styles.dynamicDropdown}
                triggerClassName={styles.dynamicSelect}
                menuClassName={styles.dynamicDropdownMenu}
                optionClassName={styles.dynamicDropdownOption}
              />
              {translateVideoSchemaDescription(property.description, t) ? <small>{translateVideoSchemaDescription(property.description, t)}</small> : null}
            </label>
          );
        }
        if (property.type === "boolean") {
          return (
            <div className={styles.toggleRow} key={name}>
              {label}{isRequired ? <b>*</b> : null}
              <button
                type="button"
                className={styles.toggle}
                aria-pressed={Boolean(value)}
                onClick={() => updateModelParam(name, !Boolean(value))}
              ><i /></button>
            </div>
          );
        }
        if (property.type === "array") {
          return (
            <label className={styles.dynamicField} key={name}>
              <span>{label}{isRequired ? <b>*</b> : null}</span>
              <input
                className={styles.dynamicInput}
                value={Array.isArray(value) ? value.join(", ") : ""}
                placeholder={t("create.video.common.addValues")}
                onChange={(event) => updateModelParam(name, event.target.value.split(",").map((item) => item.trim()).filter(Boolean))}
                aria-required={isRequired}
              />
            </label>
          );
        }
        if (property.type === "integer" || property.type === "number") {
          return (
            <label className={styles.dynamicField} key={name}>
              <span>{label}{isRequired ? <b>*</b> : null}</span>
              <input
                className={styles.dynamicInput}
                type="number"
                min={property.minimum}
                max={property.maximum}
                step={property.step ?? (property.type === "integer" ? 1 : 0.01)}
                value={value === undefined ? "" : String(value)}
                onChange={(event) => updateModelParam(name, event.target.value === "" ? undefined : Number(event.target.value))}
                aria-required={isRequired}
              />
            </label>
          );
        }
        return (
          <label className={styles.dynamicField} key={name}>
            <span>{label}{isRequired ? <b>*</b> : null}</span>
            <input
              className={styles.dynamicInput}
              type="text"
              value={value === undefined ? "" : String(value)}
              onChange={(event) => updateModelParam(name, event.target.value)}
              aria-required={isRequired}
            />
          </label>
        );
      })}
      <div data-mobile-action-dock className={styles.estimateBlock}>
        <div className={styles.estimate} title={creditEstimateError ?? undefined}>
          <div>
             {t("create.video.common.estimatedCredits")} <InfoTooltip content={t("create.video.common.info.estimatedCredits")} size={11} />
          </div>
          <span>
            {estimateDescription}
            <strong>{creditEstimateLoading || totalCreditEstimate === null ? formattedCreditEstimate : `= ${formattedCreditEstimate}`}</strong>
          </span>
          {shouldAutoUpscaleStoryboard ? (
            <small className={styles.autoUpscaleNote}>
               {t("create.video.extend.autoUpscaleNote", { count: generationScenes.length })}
            </small>
          ) : null}
        </div>
        {!isGeneratingVideo && videoValidationMessage ? <p className={styles.settingsError} role="status">{videoValidationMessage}</p> : null}
        {generationError ? <p className={styles.settingsError} role="alert">{generationError}</p> : null}
        <button
          type="button"
          className={styles.generate}
          onClick={handleGenerate}
          disabled={!canGenerate}
        >
           <WandSparkles size={18} /> {generationStatus === "uploading" || generationStatus === "processing" ? t("create.video.common.generating") : t("create.video.common.generateVideo")}
        </button>
        <p className={styles.privateNote}>
           <LockKeyhole size={12} /> {t("create.settings.privateSecure")}
        </p>
      </div>
      {generationProgress.total > 0 && (generationStatus === "uploading" || generationStatus === "processing" || generationStatus === "completed") ? (
         <p className={styles.generationProgress}>{t("create.video.common.scenesComplete", { completed: generationProgress.completed, total: generationProgress.total })}</p>
      ) : null}
    </aside>
  );
}
