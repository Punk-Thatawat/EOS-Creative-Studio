import { CloudUpload, ImageIcon, Link2, X } from "lucide-react";
import { promptMaxLength } from "@/lib/prompt-limits";
import { Dropdown } from "@/components/ui/dropdown";
import { InfoTooltip } from "./components/info-tooltip";
import { PromptOptimizerToggle } from "./image-generation/components/prompt-optimizer-toggle";
import { ImageTutorialButton } from "./image-generation/components/image-tutorial-button";
import { ClearValuesButton } from "@/features/create/components/clear-values-button";
import { type GenerationMode } from "./video-generation.types";
import {
  generationModeCopyKeys,
  generationModeOptions,
  referenceImageRoles,
} from "./video-generation.constants";
import { isStorylinePromptMode } from "./video-mode-helpers";
import { SectionTitle } from "./section-title";
import Image from "next/image";
import styles from "./video-generation-page.module.css";
import type { VideoGenerationPageState } from "./use-video-generation-page";

export function VideoLeftPanel({ videoGen }: { videoGen: VideoGenerationPageState }) {
  const {
    storyboardSlices,
    storyboardGridLabel,
    storyboardQualityNote,
    storyboardSplitting,
    prompt,
    setPrompt,
    promptOptimizerEnabled,
    setPromptOptimizerEnabled,
    negativePrompt,
    setNegativePrompt,
    generationMode,
    continuationInfo,
    referenceImageSlots,
    setStoryboardScenes,
    isSourceImageDragging,
    referenceImageInputRefs,
    sourceInputRef,
    supportsReferenceImages,
    uploadSource,
    handleSourceImageDragOver,
    handleSourceImageDragLeave,
    handleSourceImageDrop,
    clearSource,
    addReferenceImage,
    removeReferenceImage,
    selectGenerationMode,
    sourcePreviewImage,
    hasNativeExtend,
    hasCurrentStoryboardSlices,
    isGeneratingVideo,
    clearValues,
    locale,
    t,
  } = videoGen;

  return (
    <div className={styles.leftColumn}>
      <div className={styles.videoTopActionsPanel}>
        <div className={styles.videoPromptTopActions}>
          <ImageTutorialButton
            feature="image-to-video"
            featureName="Image to Video"
            mode={generationMode}
          />
          <ClearValuesButton onClick={clearValues} disabled={isGeneratingVideo} />
        </div>
      </div>
      <section className={styles.panel}>
        <section
          className={styles.videoModePanel}
          aria-labelledby="video-mode-title"
        >
          <div className={styles.videoModeHeading}>
            <h2 id="video-mode-title">{t("create.video.common.generationMode")}</h2>
            <InfoTooltip content={t("create.video.common.info.generationMode")} size={11} />
          </div>
          <Dropdown
            value={generationMode}
            options={generationModeOptions.map((option) => {
              const copyKeys = generationModeCopyKeys[option.value];
              return {
                value: option.value,
                label: (
                  <>
                    <strong>{t(copyKeys.labelKey)}</strong>
                    <small>{t(copyKeys.descriptionKey)}</small>
                  </>
                ),
              };
            })}
            ariaLabel={t("create.video.common.generationModeOptions")}
            onChange={(nextMode) => selectGenerationMode(nextMode as GenerationMode)}
            className={`${styles.modelDropdown} ${styles.generationModeDropdown}`}
            triggerClassName={styles.modelDropdownTrigger}
            menuClassName={styles.modelDropdownMenu}
            optionClassName={styles.generationModeDropdownOption}
          />
          {generationMode === "single-image" ? (
            <div className={`${styles.sequenceNotice} ${styles.sequenceNoticeNative}`}>
              <ImageIcon size={13} />
               <span>{t("create.video.common.storyboardSheetNotice")}</span>
            </div>
          ) : null}
          {generationMode === "continuous" ? (
            <div className={`${styles.sequenceNotice} ${hasNativeExtend ? styles.sequenceNoticeNative : styles.sequenceNoticeWarning}`}>
              <Link2 size={13} />
              <span>{hasNativeExtend
                 ? t("create.video.common.nativeExtendNotice")
                 : t("create.video.common.noNativeExtendNotice")}</span>
            </div>
          ) : null}
          {continuationInfo ? (
            <div className={styles.continuationResult}>
               <strong>{continuationInfo.nativeExtend ? t("create.video.common.nativeExtend") : t("create.video.generationModes.continuous")}</strong>
               <span>{continuationInfo.strategy ?? t("create.video.common.backendContinuation")}</span>
               <small>{continuationInfo.seamless === true ? t("create.video.common.seamlessContinuation") : t("create.video.common.hardCutContinuation")}</small>
            </div>
          ) : null}
        </section>
      </section>
      <section className={`${styles.panel} ${styles.promptPanel} ${styles.videoPromptPanel}`}>
        <div className={styles.videoPromptHeading}>
          <h2>{isStorylinePromptMode(generationMode) ? t("create.video.common.mainStoryline") : t("create.video.common.prompt")} <small>({t("create.video.common.required")})</small></h2>
          <span className={`${styles.videoPromptAnnotation} ${locale === "th" ? styles.videoPromptAnnotationThai : ""}`} aria-hidden="true" />
        </div>
        {isStorylinePromptMode(generationMode) ? <p className={styles.sourceModeNote}>{t("create.video.common.mainStorylineHint")}</p> : null}
        <label className={styles.videoPromptInputLabel}>
          <textarea
            className={styles.videoPromptTextarea}
            value={prompt}
            onChange={(event) => {
              const value = event.target.value;
              setPrompt(value);
              setStoryboardScenes((current) => current.map((scene, index) => (
                !isStorylinePromptMode(generationMode) && index === 0 ? { ...scene, prompt: value } : scene
              )));
            }}
             placeholder={t("create.video.common.describeVideo")}
            maxLength={promptMaxLength}
            required
            aria-required="true"
          />
        </label>
        <div className={styles.videoPromptMeta}>
           <span>{t("create.video.common.maximumCharacters", { count: promptMaxLength })}</span>
          <span>{prompt.length.toLocaleString()} / {promptMaxLength.toLocaleString()}</span>
        </div>
        <PromptOptimizerToggle enabled={promptOptimizerEnabled} onChange={setPromptOptimizerEnabled} />
        <label className="block text-[10px] font-bold">
           {t("create.video.common.negativePrompt")} <small>({t("create.video.common.optional")})</small>
          <input
            value={negativePrompt}
            onChange={(event) => setNegativePrompt(event.target.value)}
            placeholder={t("create.video.common.negativePromptPlaceholder")}
          />
        </label>
        {generationMode === "reference-to-video" || generationMode === "single-image" ? (
             <div className={styles.referenceInputs} aria-label={t("create.video.common.referenceImages")}>
            <div className={styles.referenceInputsHeading}>
               <span>{t("create.video.common.referenceImages")} {generationMode === "reference-to-video" ? <b>*</b> : null}</span>
            </div>
            <div className={styles.referenceMediaField}>
              {supportsReferenceImages ? (
                <div className={styles.referenceRoleGrid}>
                  {referenceImageRoles.map((role) => {
                    const slot = referenceImageSlots[role.key];
                    return (
                      <div
                        className={styles.referenceRoleField}
                        key={role.key}
                        title={t(role.descriptionKey)}
                        aria-label={`${t(role.labelKey)}: ${t(role.descriptionKey)}`}
                      >
                        <div className={styles.referenceMediaLabel}>
                          <span>{t(role.labelKey)}</span>
                               <small>{t(role.descriptionKey)}</small>
                        </div>
                        {slot ? (
                          <div className={styles.referenceRolePreview}>
                            <Image
                              src={slot.url}
                              alt={t(role.labelKey)}
                              width={112}
                              height={78}
                              unoptimized
                              className="h-full w-full object-cover"
                            />
                            <button
                              type="button"
                              onClick={() => removeReferenceImage(role.key)}
                              aria-label={`${t("create.video.common.remove")} ${t(role.labelKey)}`}
                              title={`${t("create.video.common.remove")} ${t(role.labelKey)}`}
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className={styles.referenceRoleUpload}
                            onClick={() => referenceImageInputRefs.current[role.key]?.click()}
                            aria-label={`${t("create.video.common.uploadImage")} ${t(role.labelKey)}`}
                          >
                            <CloudUpload size={17} />
                             <strong>{t("create.video.common.uploadImage")}</strong>
                             <small>{t("create.video.common.pngFormats")}</small>
                          </button>
                        )}
                        <input
                          ref={(element) => {
                            referenceImageInputRefs.current[role.key] = element;
                          }}
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          className="hidden"
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file) void addReferenceImage(role.key, file);
                            event.currentTarget.value = "";
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className={styles.sceneRequirement}>{t("create.video.common.unsupportedReferenceImages")}</p>
              )}
            </div>
          </div>
        ) : null}
      </section>
      {generationMode !== "reference-to-video" && generationMode !== "multi-scene" ? <section className={`${styles.panel} ${generationMode === "single-image" ? styles.storyboardImagePanel : ""}`}>
         <SectionTitle number="2">{t("create.video.common.source")}</SectionTitle>
        <label className="mb-2 block text-[10px] font-bold">
           {t("create.video.common.startFrame")} <small>({t("create.video.common.required")})</small>
        </label>
        {sourcePreviewImage ? (
          <div className={styles.sourcePreview}>
            <Image
              src={sourcePreviewImage}
              alt={t("create.video.common.uploadedStartFrameAlt")}
              fill
              unoptimized
              className={generationMode === "single-image" ? "object-contain" : "object-cover"}
            />
            <div className={styles.sourceImageActions}>
               <button type="button" onClick={() => sourceInputRef.current?.click()}>{t("create.video.common.replaceSource")}</button>
               <button type="button" onClick={clearSource}>{t("create.video.common.removeSource")}</button>
            </div>
          </div>
        ) : (
          <label
            className={`${styles.upload} ${isSourceImageDragging ? styles.uploadDragging : ""}`}
            onDragEnter={handleSourceImageDragOver}
            onDragOver={handleSourceImageDragOver}
            onDragLeave={handleSourceImageDragLeave}
            onDrop={handleSourceImageDrop}
          >
            <CloudUpload size={22} />
            <span className={styles.uploadCopy}>
               <strong>{t("create.video.common.uploadImage")}</strong>
               <small>{t("create.video.common.pngFormats")}</small>
            </span>
            <input
              ref={sourceInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void uploadSource(file);
                event.currentTarget.value = "";
              }}
            />
          </label>
        )}
        {sourcePreviewImage ? (
          <input
            ref={sourceInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void uploadSource(file);
              event.currentTarget.value = "";
            }}
          />
        ) : null}
        {generationMode === "single-image" ? (
          <>
             <p className={styles.sourceModeNote}>{t("create.video.common.sourceModeNote")}</p>
            {sourcePreviewImage ? (
              <div className={styles.storyboardSplitSummary} aria-live="polite">
                <div className={styles.storyboardSplitHeader}>
                   <strong>{storyboardSplitting ? t("create.video.common.detectingStoryboardGrid") : hasCurrentStoryboardSlices ? storyboardGridLabel ?? t("create.video.common.uploadStoryboardSheet") : t("create.video.common.preparingStoryboardScenes")}</strong>
                   <small>{storyboardSplitting ? t("create.video.common.preparingSceneImages") : hasCurrentStoryboardSlices && storyboardSlices.length > 0 ? t("create.video.common.eachPanelScene") : t("create.video.common.clearGutters")}</small>
                  {storyboardQualityNote ? <small className={styles.storyboardQualityNote} role="status">{storyboardQualityNote}</small> : null}
                </div>
                {hasCurrentStoryboardSlices && storyboardSlices.length > 0 ? (
                  <div className={styles.storyboardSliceRow}>
                    {storyboardSlices.map((slice, index) => (
                      <div key={slice.id} className={styles.storyboardSlice}>
                        <Image src={slice.image} alt={t("create.video.common.storyboardSceneAlt", { number: index + 1 })} fill unoptimized />
                        <span>{index + 1}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </>
        ) : null}
      </section> : null}
    </div>
  );
}
