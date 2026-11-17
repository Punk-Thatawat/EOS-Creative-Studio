import { CloudUpload, Link2, X } from "lucide-react";
import { promptMaxLength } from "@/lib/prompt-limits";
import { Dropdown } from "@/components/ui/dropdown";
import { DurationControl } from "./components/duration-control";
import { translateVideoSchemaOption } from "./video-schema-copy";
import { PromptOptimizerToggle } from "./image-generation/components/prompt-optimizer-toggle";
import { generationModeCopyKeys } from "./video-generation.constants";
import { parseSchemaEnumValue } from "./video-schema-helpers";
import Image from "next/image";
import styles from "./video-generation-page.module.css";
import type { VideoGenerationPageState } from "./use-video-generation-page";

export function SceneModal({ videoGen }: { videoGen: VideoGenerationPageState }) {
  const {
    promptOptimizerEnabled,
    setPromptOptimizerEnabled,
    generationMode,
    videoMode,
    editingSceneIndex,
    sceneImage,
    sceneStartFrameSource,
    setSceneStartFrameSource,
    scenePrompt,
    setScenePrompt,
    sceneDuration,
    setSceneDuration,
    sceneModelParams,
    setSceneModelParams,
    sceneError,
    setSceneError,
    isSceneImageDragging,
    setIsSceneImageDragging,
    localizedParameterLabel,
    sceneInputRef,
    requiredProperties,
    durationProperty,
    modelParameterEntries,
    handleSceneImageFile,
    handleSceneImageDrop,
    selectedVideoMode,
    closeSceneModal,
    clearSceneModalImage,
    saveScene,
    canSaveScene,
    t,
  } = videoGen;

  return (
    <div
      className={styles.sceneModalBackdrop}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeSceneModal();
      }}
    >
      <div
        className={styles.sceneModal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="scene-modal-title"
      >
        <div className={styles.sceneModalHeader}>
          <div>
            <h2 id="scene-modal-title">{editingSceneIndex === null ? t("create.video.common.addSceneTitle") : t("create.video.common.editSceneTitle", { number: editingSceneIndex + 1 })}</h2>
            <p>
              {videoMode === "continuous"
                ? t("create.video.common.scenePromptHintContinuous")
                : videoMode === "flexible"
                  ? t("create.video.common.scenePromptHintFlexible")
                  : t("create.video.common.scenePromptHintStoryboard")}
            </p>
          </div>
          <button
            type="button"
            className={styles.sceneModalClose}
            onClick={closeSceneModal}
            aria-label={editingSceneIndex === null ? t("create.video.common.closeAddScene") : t("create.video.common.closeEditScene")}
          >
            <X size={18} />
          </button>
        </div>
        <div className={`${styles.sceneModalMode} ${styles[`sceneModalMode${selectedVideoMode.label}`]}`}>
          <strong>{t("create.video.common.modeSuffix", { mode: t(generationModeCopyKeys[videoMode].labelKey) })}</strong>
          <span>
            {videoMode === "storyboard"
              ? t("create.video.common.sceneStartsOwnImage")
              : videoMode === "continuous"
                ? t("create.video.common.sceneStartsPreviousFrame")
                : t("create.video.common.sceneStartsNewOrPrevious")}
          </span>
        </div>
        {sceneError ? (
          <div className={styles.sceneModalError}>{sceneError}</div>
        ) : null}
        <div className={styles.sceneModalUpload}>
              {sceneStartFrameSource === "manual" && sceneImage ? (
                <div className={styles.sceneModalImagePreview}>
              <Image
                src={sceneImage}
                alt={t("create.video.common.newSceneImage")}
                fill
                unoptimized
                className="object-cover"
                onError={clearSceneModalImage}
              />
                  {generationMode !== "single-image" ? (
                    <div className={styles.sceneModalImageActions}>
                      <button
                        type="button"
                        onClick={() => sceneInputRef.current?.click()}
                      >
                        {t("create.video.common.replace")}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          clearSceneModalImage();
                        }}
                      >
                        {t("create.video.common.remove")}
                      </button>
                    </div>
                  ) : null}
            </div>
          ) : sceneStartFrameSource === "previous_last_frame" ? (
            <div className={styles.sceneModalPreviousFrame}>
              <Link2 size={22} />
              <strong>{t("create.video.common.previousSceneFrame")}</strong>
              <small>{t("create.video.common.sceneContinuesAutomatically")}</small>
            </div>
          ) : (
            <button
              type="button"
              className={`${styles.sceneModalUploadButton} ${isSceneImageDragging ? styles.uploadDragging : ""}`}
              onClick={() => sceneInputRef.current?.click()}
              onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; setIsSceneImageDragging(true); }}
              onDragLeave={() => setIsSceneImageDragging(false)}
              onDrop={handleSceneImageDrop}
            >
              <CloudUpload size={24} />
              <strong>{t("create.video.common.uploadSceneImage")}</strong>
              <small>{t("create.video.common.pngFormats")}</small>
            </button>
          )}
          <input
            ref={sceneInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleSceneImageFile(file);
              event.currentTarget.value = "";
            }}
          />
        </div>
        {videoMode === "flexible" ? (
          <div className={styles.sceneModalSourceField}>
            <div className={styles.sceneModalSourceHeader}>
              <span>{t("create.video.common.startFrame")}</span>
              <small>{t("create.video.common.chooseSceneStart")}</small>
            </div>
            <div className={styles.sceneModalSourceOptions}>
              <button
                type="button"
                className={
                  sceneStartFrameSource === "manual"
                    ? styles.sceneModalSourceSelected
                    : undefined
                }
                onClick={() => {
                  setSceneStartFrameSource("manual");
                  setSceneError(null);
                }}
              >
                <strong>{t("create.video.common.newImage")}</strong>
                <small>{t("create.video.common.uploadNewStartFrame")}</small>
              </button>
              <button
                type="button"
                className={
                  sceneStartFrameSource === "previous_last_frame"
                    ? styles.sceneModalSourceSelected
                    : undefined
                }
                onClick={() => {
                  setSceneStartFrameSource("previous_last_frame");
                  clearSceneModalImage();
                  setSceneError(null);
                }}
              >
                <strong>{t("create.video.common.previousFrame")}</strong>
                <small>{t("create.video.common.continueFromSceneBefore")}</small>
              </button>
            </div>
          </div>
        ) : null}
        {videoMode === "continuous" ? (
          <div className={styles.sceneModalPreviousNote}>
            <Link2 size={13} /> {t("create.video.common.thisSceneUsesPreviousFrame")}
          </div>
        ) : null}
        <label className={styles.sceneModalField}>
          <span className={styles.sceneModalFieldHeader}>
            <span>{t("create.video.common.prompt")} <b>*</b></span>
            <small>{scenePrompt.length.toLocaleString()} / {promptMaxLength.toLocaleString()}</small>
          </span>
          <textarea
            value={scenePrompt}
            onChange={(event) => setScenePrompt(event.target.value)}
            placeholder={t("create.video.common.scenePromptPlaceholder")}
            maxLength={promptMaxLength}
          />
        </label>
        {generationMode === "single-image" ? <PromptOptimizerToggle enabled={promptOptimizerEnabled} onChange={setPromptOptimizerEnabled} /> : null}
        {durationProperty ? (
          <DurationControl
            property={durationProperty[1]}
            value={sceneDuration}
            required={requiredProperties.has(durationProperty[0])}
            info={t("create.video.common.info.duration")}
            onChange={setSceneDuration}
            variant="scene"
          />
        ) : null}
        {modelParameterEntries.length ? (
          <div className={styles.sceneModelParams}>
             <div className={styles.sceneModelParamsTitle}>{t("create.video.common.modelParameters")}</div>
            {modelParameterEntries.map(([name, property]) => {
              const value = sceneModelParams[name];
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
                      onChange={(nextValue) => setSceneModelParams((current) => ({ ...current, [name]: parseSchemaEnumValue(nextValue, property) }))}
                      ariaLabel={label}
                      placeholder={`${t("create.video.common.selectPrefix")} ${label.toLowerCase()}`}
                      className={styles.dynamicDropdown}
                      triggerClassName={styles.dynamicSelect}
                      menuClassName={styles.dynamicDropdownMenu}
                      optionClassName={styles.dynamicDropdownOption}
                    />
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
                      onClick={() => setSceneModelParams((current) => ({ ...current, [name]: !Boolean(value) }))}
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
                      onChange={(event) => setSceneModelParams((current) => ({ ...current, [name]: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) }))}
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
                      onChange={(event) => setSceneModelParams((current) => ({ ...current, [name]: event.target.value === "" ? undefined : Number(event.target.value) }))}
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
                    onChange={(event) => setSceneModelParams((current) => ({ ...current, [name]: event.target.value }))}
                    aria-required={isRequired}
                  />
                </label>
              );
            })}
          </div>
        ) : null}
        <div className={styles.sceneModalActions}>
          <button
            type="button"
            className={styles.sceneModalCancel}
            onClick={closeSceneModal}
          >
            {t("create.video.common.cancel")}
          </button>
          <button
            type="button"
            className={styles.sceneModalSave}
            onClick={saveScene}
            disabled={!canSaveScene}
          >
            {editingSceneIndex === null ? t("create.video.common.saveScene") : t("create.video.common.saveChanges")}
          </button>
        </div>
      </div>
    </div>
  );
}
