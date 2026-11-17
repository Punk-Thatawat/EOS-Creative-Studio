import {
  CloudUpload,
  ChevronLeft,
  ChevronRight,
  Download,
  Heart,
  Link2,
  Play,
  Plus,
  Pencil,
  Trash2,
  WandSparkles,
} from "lucide-react";
import { Dropdown } from "@/components/ui/dropdown";
import { EosVideoPlayer } from "@/components/media/eos-video-player";
import { ModelPreviewMedia } from "./model-preview-media";
import { EosCutButton } from "./eos-cut-button";
import { VideoPreviewLiveBadge, VideoPreviewPlaceholder } from "./video-preview-placeholder";
import { type StartFrameSource } from "./video-generation.types";
import { sceneSourceOptions } from "./video-generation.constants";
import { isSingleSceneGenerationMode } from "./video-mode-helpers";
import { formatHistoryDate } from "./video-schema-helpers";
import { SectionTitle } from "./section-title";
import Image from "next/image";
import styles from "./video-generation-page.module.css";
import type { VideoGenerationPageState } from "./use-video-generation-page";

export function VideoPreviewPanel({ videoGen }: { videoGen: VideoGenerationPageState }) {
  const {
    storyboardSlices,
    generationMode,
    videoMode,
    maxStoryboardScenes,
    generationStatus,
    generationProgress,
    isFinalizingVideo,
    previewView,
    setPreviewView,
    setVideoLibraryIndex,
    isVideoFavorite,
    setIsVideoFavorite,
    videoRecentScrollState,
    videoHistory,
    videoHistoryLoading,
    videoHistoryError,
    frameReferences,
    storyboardScenes,
    activeSceneIndex,
    isFrameDragging,
    setIsFrameDragging,
    sceneScrollState,
    router,
    videoRecentRowRef,
    frameInputRef,
    sceneRowRef,
    selectedModelOption,
    supportsReferenceImages,
    referenceModeHasNoModel,
    durationProperty,
    addFrame,
    handleFrameDrop,
    scrollScenes,
    updateSceneSource,
    getSceneSource,
    hasCurrentStoryboardSlices,
    generationScenes,
    sceneLimitReached,
    canAddScene,
    addSceneDisabledReason,
    openSceneModal,
    openEditSceneModal,
    deleteScene,
    isGeneratingVideo,
    safeVideoLibraryIndex,
    latestVideoUrl,
    displayedVideoUrl,
    previewMediaAspectRatio,
    handlePreviewAspectRatioChange,
    displayedStoryboardId,
    downloadDisplayedVideo,
    t,
  } = videoGen;

  return (
    <div className={styles.centerColumn}>
      <section className={`${styles.previewPanel} ${styles.videoPreviewPanel}`}>
         <SectionTitle>{t("create.preview")}</SectionTitle>
        <div className={styles.videoPreview}>
          <VideoPreviewLiveBadge />
          {isGeneratingVideo ? (
            <div className={styles.videoPreviewMediaFrame} style={{ aspectRatio: "16 / 9" }}>
              <div className={styles.videoGeneratingPreview} aria-busy="true">
                <WandSparkles size={26} />
                <strong>{isFinalizingVideo
                  ? t("create.video.common.finalizingVideo")
                  : generationStatus === "uploading" ? t("create.video.common.preparingVideo") : t("create.video.common.generatingVideo")}</strong>
                <span>{isFinalizingVideo
                  ? t("create.video.common.finalizingVideoDetail")
                  : generationStatus === "uploading"
                   ? generationMode === "single-image" ? t("create.video.common.splittingScenes") : t("create.video.common.uploadingSceneAssets")
                   : generationMode === "single-image" ? t("create.video.common.generatingStoryboardScenes") : t("create.video.common.generatingScenesInOrder")}</span>
                <div className={styles.videoGenerationProgress}>
                  <i style={{ width: `${isFinalizingVideo ? 96 : generationProgress.total ? Math.round((generationProgress.completed / generationProgress.total) * 100) : 12}%` }} />
                </div>
                  <small>{isFinalizingVideo
                    ? t("create.video.common.finalizingVideoDetail")
                    : t("create.video.common.scenesComplete", { completed: generationProgress.completed, total: generationProgress.total || generationScenes.length })}</small>
              </div>
            </div>
          ) : previewView === "model" && selectedModelOption?.previewUrl ? (
            <ModelPreviewMedia
              url={selectedModelOption.previewUrl}
              type={selectedModelOption.previewType}
              autoPlay={selectedModelOption.previewType === "video"}
              alt={`${selectedModelOption.displayName} model preview`}
              className={styles.generatedVideoPlayer}
              frameClassName={styles.videoPreviewMediaFrame}
              frameStyle={{ aspectRatio: previewMediaAspectRatio }}
              onAspectRatioChange={handlePreviewAspectRatioChange}
            />
          ) : displayedVideoUrl ? (
            <EosVideoPlayer
              key={displayedVideoUrl}
              src={displayedVideoUrl}
              className={styles.generatedVideoPlayer}
              mediaFrameClassName={styles.videoPreviewMediaFrame}
              mediaFrameStyle={{ aspectRatio: previewMediaAspectRatio }}
              onAspectRatioChange={handlePreviewAspectRatioChange}
              ariaLabel={t("create.video.common.generatedVideo")}
            />
          ) : (
            <div className={styles.videoPreviewMediaFrame} style={{ aspectRatio: previewMediaAspectRatio }}>
              <VideoPreviewPlaceholder showActions={false} />
            </div>
          )}
          {displayedVideoUrl ? <div className={styles.videoPreviewOverlayActions}>
            <button
              type="button"
              onClick={() => void downloadDisplayedVideo()}
              disabled={!displayedVideoUrl}
              aria-label={t("create.video.common.downloadVideo")}
              title={t("create.video.common.downloadVideo")}
            >
              <Download size={16} />
            </button>
            <button
              type="button"
              onClick={() => setIsVideoFavorite((favorite) => !favorite)}
              disabled={!displayedVideoUrl}
              aria-label={t("create.video.common.favoriteVideo")}
              title={t("create.video.common.favoriteVideo")}
              className={isVideoFavorite ? styles.videoFavoriteActive : undefined}
            >
              <Heart size={16} fill={isVideoFavorite ? "currentColor" : "none"} />
            </button>
          </div> : null}
        </div>
        <EosCutButton sourceGenerationId={displayedVideoUrl ? displayedStoryboardId : null} />
        <div className={styles.previewViewTabs} role="tablist" aria-label={t("create.video.common.videoPreviewViews")}>
              <button
                type="button"
                role="tab"
                aria-selected={previewView === "latest"}
                className={previewView === "latest" ? styles.previewViewTabActive : undefined}
                onClick={() => setPreviewView("latest")}
              >
                {t("create.video.common.latestResult")}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={previewView === "model"}
                className={previewView === "model" ? styles.previewViewTabActive : undefined}
                onClick={() => setPreviewView("model")}
              >
                {t("create.video.common.modelPreview")}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={previewView === "library"}
                className={previewView === "library" ? styles.previewViewTabActive : undefined}
                onClick={() => setPreviewView("library")}
              >
                {t("create.video.common.videoLibrary")}
              </button>
        </div>
        <div className={styles.videoGalleryGrid}>
            <div className={styles.videoGalleryColumn}>
              <div className={styles.videoGalleryHeading}>
               <h3>{t("create.video.common.currentVideo")}</h3>
              </div>
              <div className={styles.videoCurrentGallery}>
                {latestVideoUrl ? (
                  <button
                    type="button"
                    className={styles.videoCurrentCard}
                    onClick={() => setPreviewView("latest")}
                     aria-label={t("create.video.common.latestVideo")}
                    aria-pressed={previewView === "latest"}
                  >
                    <span className={styles.videoGalleryThumb}>
                      <video src={latestVideoUrl} muted playsInline preload="metadata" controls={false} disablePictureInPicture disableRemotePlayback tabIndex={-1} aria-hidden="true" />
                      <span className={styles.videoGalleryPlay}><Play size={14} fill="currentColor" /></span>
                    </span>
                     <span className={styles.videoGalleryStatus}>{t("create.video.common.latestVideo")}</span>
                  </button>
                ) : (
                   <div className={styles.videoGalleryEmpty}>{t("create.video.common.latestVideoEmpty")}</div>
                )}
              </div>
            </div>
            <div className={`${styles.videoGalleryColumn} ${styles.videoRecentColumn}`}>
              <div className={styles.videoGalleryHeading}>
                   <h3>{t("create.video.common.recentVideos")}</h3>
                <button
                  type="button"
                  onClick={() => router.push("/history?type=video")}
                >
                   {t("create.video.common.viewHistory")}
                </button>
              </div>
              <div className={styles.videoRecentGallery}>
                <div className={styles.videoRecentRow} ref={videoRecentRowRef}>
                  {videoHistoryLoading && videoHistory.length === 0 ? (
                     <div className={styles.videoGalleryEmpty}>{t("create.video.common.loadingHistory")}</div>
                  ) : videoHistoryError ? (
                    <div className={`${styles.videoGalleryEmpty} ${styles.videoGalleryError}`} role="alert">
                      {videoHistoryError}
                    </div>
                  ) : videoHistory.length > 0 ? (
                    videoHistory.map((item, itemIndex) => {
                      const selected = previewView === "library" && safeVideoLibraryIndex === itemIndex;
                      return (
                        <button
                          key={item.storyboardId}
                          type="button"
                          className={`${styles.videoRecentCard} ${selected ? styles.videoRecentCardSelected : ""}`}
                          onClick={() => {
                            setVideoLibraryIndex(itemIndex);
                            setPreviewView("library");
                          }}
                          aria-label={t("create.video.common.openGeneratedVideo", { date: formatHistoryDate(item.createdAt) })}
                          aria-pressed={selected}
                        >
                          <span className={styles.videoGalleryThumb}>
                            <video src={item.finalVideoUrl} muted playsInline preload="metadata" controls={false} disablePictureInPicture disableRemotePlayback tabIndex={-1} aria-hidden="true" />
                            <span className={styles.videoGalleryPlay}><Play size={13} fill="currentColor" /></span>
                          </span>
                        </button>
                      );
                    })
                  ) : (
                     <div className={styles.videoGalleryEmpty}>{t("create.video.common.noVideos")}</div>
                  )}
                </div>
                {videoHistory.length > 3 ? (
                  <>
                    {videoRecentScrollState.canScrollLeft ? (
                      <button
                        type="button"
                        className={styles.videoGalleryPrev}
                        onClick={() => videoRecentRowRef.current?.scrollBy({ left: -290, behavior: "smooth" })}
                        aria-label={t("create.video.common.previousRecentVideos")}
                      >
                        <ChevronLeft size={18} />
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className={styles.videoGalleryNext}
                      onClick={() => videoRecentRowRef.current?.scrollBy({ left: 290, behavior: "smooth" })}
                      aria-label={t("create.video.common.nextRecentVideos")}
                      disabled={!videoRecentScrollState.canScrollRight}
                    >
                      <ChevronRight size={18} />
                    </button>
                  </>
                ) : null}
              </div>
            </div>
        </div>
      </section>
      {generationMode !== "reference-to-video" && supportsReferenceImages ? (
        <section className={styles.stripSection}>
          <div className={styles.subheading}>
             {t("create.video.common.shotFrameReferences")}
             <small>({t("create.video.common.sharedAcrossScenes")})</small>
          </div>
          {supportsReferenceImages ? (
            <div className={styles.thumbRow}>
              <button
                type="button"
                className={`${styles.addFrame} ${isFrameDragging ? styles.uploadDragging : ""}`}
                onClick={() => frameInputRef.current?.click()}
                onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; setIsFrameDragging(true); }}
                onDragLeave={() => setIsFrameDragging(false)}
                onDrop={handleFrameDrop}
              >
                 <Plus size={16} /> {t("create.video.common.addFrame")}
              </button>
              <input
                ref={frameInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void addFrame(file);
                  event.currentTarget.value = "";
                }}
              />
              {frameReferences.map((src, index) => (
                <div className={styles.thumb} key={src}>
                  <Image
                    src={src}
                    alt={`Reference ${index + 1}`}
                    width={92}
                    height={62}
                    unoptimized
                    className="h-full w-full object-cover"
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className={styles.sceneRequirement}>{referenceModeHasNoModel
              ? t("create.video.common.noReferenceVideoModel")
              : t("create.video.common.unsupportedReferenceImages")}</p>
          )}
        </section>
      ) : null}
      {!isSingleSceneGenerationMode(generationMode) && (generationMode !== "single-image" || (hasCurrentStoryboardSlices && storyboardSlices.length > 0)) ? (
      <section className={styles.stripSection}>
        <div className={styles.subheading}>
          {generationMode === "multi-scene" ? `2. ${t("create.video.common.scenes")}` : t("create.video.common.storyboard")} {generationMode === "single-image" ? <small>({t("create.video.common.autoCreatedFromSheet")})</small> : generationMode === "multi-scene" ? <small>({t("create.video.common.addScenesManually")})</small> : <small>({t("create.video.common.optional")})</small>}
        </div>
        <div className={styles.sceneScroller}>
          <div ref={sceneRowRef} className={styles.sceneRow}>
            {storyboardScenes.map((scene, index) => {
              const source = getSceneSource(scene, index);
              const nextSource =
                index < storyboardScenes.length - 1
                  ? getSceneSource(storyboardScenes[index + 1], index + 1)
                  : null;
              return (
                <div className={styles.sceneFlowItem} key={scene.id}>
                  <article
                    className={`${styles.scene} ${index === activeSceneIndex ? styles.selected : ""}`}
                  >
                    <div className={styles.sceneCardHeader}>
                      <span>{t("create.video.common.scene")} {index + 1}</span>
                      <div className={styles.sceneCardMeta}>
                        {durationProperty ? <small>{scene.duration}{t("create.video.common.secondsShort")}</small> : null}
                        <button
                          type="button"
                          className={styles.sceneEdit}
                          aria-label={`${t("create.video.common.editSceneTitle", { number: index + 1 })}`}
                          title={`${t("create.video.common.editSceneTitle", { number: index + 1 })}`}
                          onClick={() => openEditSceneModal(index)}
                        >
                          <Pencil size={10} />
                        </button>
                        {index > 0 && generationMode !== "single-image" ? (
                          <button
                            type="button"
                            className={styles.sceneDelete}
                            aria-label={`${t("create.video.common.deleteSceneConfirm", { number: index + 1 })}`}
                            title={`${t("create.video.common.deleteSceneConfirm", { number: index + 1 })}`}
                            onClick={() => deleteScene(index)}
                          >
                            <Trash2 size={10} />
                          </button>
                        ) : null}
                      </div>
                    </div>
                    {source === "manual" && scene.image ? (
                      <Image
                        src={scene.image}
                        alt={`Scene ${index + 1}`}
                        width={112}
                        height={58}
                        unoptimized
                        className="h-[58px] w-full object-contain"
                      />
                    ) : source === "manual" ? (
                      <div className={styles.missingFrame}>
                        <CloudUpload size={15} />
                       <span>{t("create.video.common.uploadImage")}</span>
                      </div>
                    ) : (
                      <div className={styles.previousFrame}>
                        <Link2 size={16} />
                       <span>{t("create.video.common.previousFrame")}</span>
                      </div>
                    )}
                    <div className={styles.sceneCardFooter}>
                      {index > 0 && videoMode === "flexible" ? (
                        <Dropdown
                          value={scene.startFrameSource}
                          options={sceneSourceOptions.map((option) => ({
                            ...option,
                            label: option.value === "manual" ? t("create.video.common.newImage") : t("create.video.common.previousFrame"),
                          }))}
                          ariaLabel={`${t("create.video.common.startFrame")} ${t("create.video.common.scene")} ${index + 1}`}
                          onChange={(nextSource) => updateSceneSource(index, nextSource as StartFrameSource)}
                          className={styles.sceneSourceDropdown}
                          triggerClassName={styles.sceneSourceTrigger}
                          menuClassName={styles.sceneSourceMenu}
                          optionClassName={styles.sceneSourceOption}
                          menuPosition="fixed"
                        />
                      ) : (
                        <em className={styles.sceneAutoNote}>
                          {index > 0 && videoMode === "continuous"
                             ? t("create.video.common.autoFromPrevious")
                             : t("create.video.common.startFrame")}
                        </em>
                      )}
                    </div>
                  </article>
                  {nextSource === "previous_last_frame" ? (
                    <div
                      className={styles.sceneConnector}
                      aria-label={`${t("create.video.common.scene")} ${index + 2} ${t("create.video.common.continuesFromPreviousScene", { number: index + 1 })}`}
                    >
                      <Link2 size={14} />
                    </div>
                  ) : null}
                </div>
              );
            })}
            {generationMode !== "single-image" ? (
              <button
                type="button"
                className={styles.addScene}
                onClick={openSceneModal}
                disabled={!canAddScene}
                title={canAddScene ? "Add another scene" : addSceneDisabledReason}
              >
                 <Plus size={16} /> {t("create.video.common.addScene")}
              </button>
            ) : null}
          </div>
           {generationMode !== "single-image" && !canAddScene ? <p className={styles.sceneRequirement}>{sceneLimitReached ? t("create.video.common.sceneLimit", { count: maxStoryboardScenes }) : t("create.video.common.completeSceneBeforeAdd")}</p> : null}
          {sceneScrollState.canScrollLeft ||
          sceneScrollState.canScrollRight ? (
            <>
              {sceneScrollState.canScrollLeft ? (
                <button
                  type="button"
                  className={styles.scenePrev}
                  onClick={() => scrollScenes("left")}
                  aria-label={t("create.video.common.previousStoryboardScenes")}
                >
                  <ChevronLeft size={20} />
                </button>
              ) : null}
              {sceneScrollState.canScrollRight ? (
                <button
                  type="button"
                  className={styles.sceneNext}
                  onClick={() => scrollScenes("right")}
                  aria-label={t("create.video.common.nextStoryboardScenes")}
                >
                  <ChevronRight size={20} />
                </button>
              ) : null}
            </>
          ) : null}
        </div>
      </section>
      ) : null}
    </div>
  );
}
