import Image from "next/image";
import { useRouter } from "next/navigation";
import { type CSSProperties, type ReactNode, type RefObject, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Eraser, Expand, Heart, MousePointer2, Paintbrush, Trash2, X } from "lucide-react";
import type { GenerationStatus } from "@/lib/api/generations";
import { useLocale } from "@/lib/i18n/locale-provider";
import { type BackgroundMode, type BackgroundPreviewMode, type ExtendAmount, type ExtendDirection, type ImageGenerationTab, type MaskTool } from "../config";
import { cx } from "../styles";
import { ImagePlaceholder } from "./image-generation-ui";
import { MaskEditor } from "./mask-editor";

/* The provider returns signed CDN URLs, so Next Image cannot optimize these without a fixed remote host. */
/* eslint-disable @next/next/no-img-element */

const imageExtensionByMimeType: Record<string, string> = {
  "image/avif": "avif",
  "image/gif": "gif",
  "image/jpg": "jpg",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const supportedImageExtensions = new Set(["avif", "gif", "jpg", "jpeg", "png", "webp"]);

function getImageExtension(blob: Blob, sourceUrl: string, outputMimeType?: string): string {
  const outputMimeExtension = outputMimeType
    ? imageExtensionByMimeType[outputMimeType.toLowerCase().split(";", 1)[0]]
    : undefined;
  if (outputMimeExtension) return outputMimeExtension;

  const blobMimeExtension = imageExtensionByMimeType[blob.type.toLowerCase().split(";", 1)[0]];
  if (blobMimeExtension) return blobMimeExtension;

  try {
    const pathname = new URL(sourceUrl, window.location.href).pathname;
    const urlExtension = pathname.split(".").pop()?.toLowerCase();
    if (urlExtension && supportedImageExtensions.has(urlExtension)) return urlExtension === "jpeg" ? "jpg" : urlExtension;
  } catch {
    // Use a safe image extension when the provider URL is not a valid URL.
  }

  return "png";
}

function PreviewSurface({ image, alt, placeholderLabel, isLoading = false, generated = false, showLiveBadge = true, actionAvailable = Boolean(image), isFavorite, onDownload, onToggleFavorite, onOpenImage, onImageError, onImageLoad, showActions = true, className, backgroundColor, style, children }: { image: string | null; alt: string; placeholderLabel: string; isLoading?: boolean; generated?: boolean; showLiveBadge?: boolean; actionAvailable?: boolean; isFavorite: boolean; onDownload: () => void; onToggleFavorite: () => void; onOpenImage: () => void; onImageError?: () => void; onImageLoad?: () => void; showActions?: boolean; className?: string; backgroundColor?: string; style?: CSSProperties; children?: ReactNode }) {
  const { t } = useLocale();
  return <div className={cx("gen-preview-image", generated && "is-generated", isLoading && "is-preview-loading", className)} style={{ ...style, ...(backgroundColor ? { backgroundColor } : {}) }} aria-busy={isLoading}>
    {isLoading ? <ImagePlaceholder className={cx("is-loading")} label={placeholderLabel} /> : image ? <img src={image} alt={alt} className={cx("gen-generated-image")} onError={onImageError} onLoad={onImageLoad} /> : <ImagePlaceholder label={placeholderLabel} />}
    {showLiveBadge && <Image src="/generated-assets/preview-live.png" alt="Preview live" width={1536} height={1024} className={cx("gen-live-badge")} />}
    {showActions && <div className={cx("gen-image-actions")}><button type="button" aria-label={t("create.image.preview.download")} title={t("create.image.preview.download")} onClick={onDownload} disabled={!actionAvailable}><Download size={16} /></button><button type="button" aria-label={t("create.image.preview.favorite")} title={t("create.image.preview.favorite")} className={isFavorite ? cx("is-favorite") : undefined} onClick={onToggleFavorite} disabled={!actionAvailable}><Heart size={16} fill={isFavorite ? "currentColor" : "none"} /></button><button type="button" aria-label={t("create.image.preview.fullscreen")} title={t("create.image.preview.fullscreen")} onClick={onOpenImage} disabled={!actionAvailable}><Expand size={16} /></button></div>}
    {children}
  </div>;
}
/* Legacy background preview markup is kept inert while all tabs use PreviewSurface.
/*

    <div className={cx("gen-background-preview-tabs")} role="tablist" aria-label={t("create.image.preview.tabsAria")}><button type="button" role="tab" aria-selected={mode === "before"} className={cx(mode === "before" && "is-selected")} onClick={() => onModeChange("before")}>{t("create.image.preview.before")}</button><button type="button" role="tab" aria-selected={mode === "after"} className={cx(mode === "after" && "is-selected")} onClick={() => onModeChange("after")}>{t("create.image.preview.after")}</button><button type="button" role="tab" aria-selected={mode === "mask"} className={cx(mode === "mask" && "is-selected")} onClick={() => onModeChange("mask")}>{backgroundMode === "remove" ? "Edit Mask" : "View Mask"}</button><span>{isMaskEditing ? "White removes · black keeps" : backgroundMode === "solid" && transparent ? "Transparent canvas" : "Live preview"}</span></div>
*/
function extendSourceShare(amount: ExtendAmount): number {
  if (amount === "25%") return 80;
  if (amount === "100%") return 50;
  return 200 / 3;
}

function imageRatioValue(ratio: string): number {
  const [width, height] = ratio.split(":").map(Number);
  return width > 0 && height > 0 ? width / height : 16 / 9;
}

function ExtendPreview({ sourceImage, resultImage, modelPreviewUrl, aspectRatio, direction, amount, isFavorite, isLoading, placeholderLabel, onDownload, onToggleFavorite, onOpenImage, onImageError, onImageLoad }: { sourceImage: string | null; resultImage: string | null; modelPreviewUrl?: string | null; aspectRatio: string; direction: ExtendDirection; amount: ExtendAmount; isFavorite: boolean; isLoading: boolean; placeholderLabel: string; onDownload: () => void; onToggleFavorite: () => void; onOpenImage: () => void; onImageError: () => void; onImageLoad: () => void }) {
  const { t } = useLocale();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [sourceAspectRatio, setSourceAspectRatio] = useState<number | null>(null);
  const hasResult = Boolean(resultImage);
  // An uploaded image is the source of truth for the extend composition. A
  // model preview is useful only before the user has supplied a source image.
  const hasModelPreview = !hasResult && !sourceImage && Boolean(modelPreviewUrl);
  const hasSourceComposition = !hasResult && !hasModelPreview && Boolean(sourceImage) && !isLoading;
  useEffect(() => {
    if (!hasSourceComposition) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const updateCanvasSize = () => {
      const { width, height } = canvas.getBoundingClientRect();
      if (!width || !height) return;
      setCanvasSize((current) => current.width === width && current.height === height ? current : { width, height });
    };
    const frame = window.requestAnimationFrame(updateCanvasSize);
    const observer = new ResizeObserver(updateCanvasSize);
    observer.observe(canvas);
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [hasSourceComposition]);

  const sourceShare = extendSourceShare(amount);
  const compositionRatio = imageRatioValue(aspectRatio);
  const compositionWidth = canvasSize.width && canvasSize.height ? Math.min(canvasSize.width, canvasSize.height * compositionRatio) : 0;
  const compositionHeight = compositionWidth > 0 ? compositionWidth / compositionRatio : 0;
  const compositionStyle: CSSProperties = {
    ...(compositionWidth > 0 ? { width: `${compositionWidth}px`, height: `${compositionHeight}px` } : {}),
    aspectRatio: `${compositionRatio} / 1`,
    "--gen-extend-source-share": `${sourceShare}%`,
    "--gen-extend-new-share": `${100 - sourceShare}%`,
    "--gen-extend-source-ratio": `${sourceAspectRatio ?? 1}`,
  } as CSSProperties;
  return <PreviewSurface image={hasResult ? resultImage : hasModelPreview ? modelPreviewUrl ?? null : null} alt={hasResult ? "Extended image" : hasModelPreview ? "Model preview" : "Source image preview"} placeholderLabel={placeholderLabel} isLoading={isLoading} generated={hasResult} actionAvailable={hasResult} isFavorite={isFavorite} onDownload={onDownload} onToggleFavorite={onToggleFavorite} onOpenImage={onOpenImage} onImageError={onImageError} onImageLoad={onImageLoad} style={{ aspectRatio: `${compositionRatio} / 1` }} className={cx("gen-extend-preview", hasSourceComposition && "has-source-composition")}>
    {hasSourceComposition && <div ref={canvasRef} className={cx("gen-extend-canvas")}><div className={cx("gen-extend-composition", `is-${direction}`)} style={compositionStyle}><div className={cx("gen-extend-zone")} aria-hidden="true" /><div className={cx("gen-extend-source-frame")}><img src={sourceImage!} alt={t("create.image.preview.sourceAlt")} className={cx("gen-extend-source")} onLoad={(event) => { const { naturalWidth, naturalHeight } = event.currentTarget; if (naturalWidth && naturalHeight) setSourceAspectRatio(naturalWidth / naturalHeight); }} /></div></div></div>}
  </PreviewSurface>;
}

export function PreviewPanel({ activeTab, generated, generatedImageUrls, generationCompletedCount, generationStatus, generationTotalCount, isGenerating, isLoadingRecent, recentError, recentGenerationUrls, imageMimeTypes, selectedRecentImageUrl, selectedVariation, previewDisplayMode, onPreviewDisplayModeChange, sourceImage, previewRatio, modelPreviewUrl = null, modelPreviewType = null, backgroundMask = null, backgroundMode = "remove", backgroundColor = "#ffffff", backgroundTransparent = true, maskTool, brushSize, extendDirection = "right", extendAmount = "50%", onBackgroundMaskChange, onMaskToolChange, onBrushSizeChange, onRecentSelect, onVariationSelect, onRefreshRecent }: { activeTab: ImageGenerationTab; generated: boolean; generatedImageUrls: string[]; generationCompletedCount: number; generationStatus: GenerationStatus; generationTotalCount: number; isGenerating: boolean; isLoadingRecent: boolean; recentError: string | null; recentGenerationUrls: string[]; imageMimeTypes: Record<string, string>; selectedRecentImageUrl: string | null; selectedVariation: number; previewDisplayMode: "current" | "gallery" | "model"; onPreviewDisplayModeChange: (mode: "current" | "gallery" | "model") => void; sourceImage: string | null; previewRatio: string; modelPreviewUrl?: string | null; modelPreviewType?: "image" | "video" | null; backgroundMask?: string | null; backgroundMode?: BackgroundMode; backgroundColor?: string; backgroundTransparent?: boolean; maskTool: MaskTool; brushSize: number; extendDirection?: ExtendDirection; extendAmount?: ExtendAmount; onBackgroundMaskChange: (mask: string | null) => void; onMaskToolChange: (tool: MaskTool) => void; onBrushSizeChange: (size: number) => void; onRecentSelect: (url: string) => void; onVariationSelect: (index: number) => void; onRefreshRecent: () => void }) {
  const { t } = useLocale();
  const router = useRouter();
  const variationRowRef = useRef<HTMLDivElement>(null);
  const recentRowRef = useRef<HTMLDivElement>(null);
  const [variationScrollState, setVariationScrollState] = useState({ canGoBack: false, canGoForward: false });
  const [recentScrollState, setRecentScrollState] = useState({ canGoBack: false, canGoForward: true });
  const [isImagePopupOpen, setIsImagePopupOpen] = useState(false);
  const [popupImages, setPopupImages] = useState<string[]>([]);
  const [popupIndex, setPopupIndex] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [backgroundPreviewMode] = useState<BackgroundPreviewMode>("before");
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [galleryKind, setGalleryKind] = useState<"variation" | "recent">("variation");
  const [maskResetKey, setMaskResetKey] = useState(0);
  const [unavailableImageUrls, setUnavailableImageUrls] = useState<Set<string>>(() => new Set());
  const [imageRetryKey, setImageRetryKey] = useState(0);
  const outputKey = JSON.stringify([activeTab, generatedImageUrls]);
  const [observedOutput, setObservedOutput] = useState({ key: outputKey, status: generationStatus });
  if (observedOutput.key !== outputKey || observedOutput.status !== generationStatus) {
    setObservedOutput({ key: outputKey, status: generationStatus });
    if (generatedImageUrls.length > 0 && (observedOutput.key !== outputKey || generationStatus === "completed")) {
      setIsImagePopupOpen(false);
      setIsCompareOpen(false);
    }
  }

  const retryFailedImages = () => {
    setUnavailableImageUrls(new Set());
    // Remount the image surfaces without changing provider-signed URLs.
    setImageRetryKey((key) => key + 1);
    void onRefreshRecent();
  };

  const markImageUnavailable = (url: string) => {
    setUnavailableImageUrls((current) => {
      if (current.has(url)) return current;
      return new Set(current).add(url);
    });
  };

  const markImageAvailable = (url: string) => {
    setUnavailableImageUrls((current) => {
      if (!current.has(url)) return current;
      const next = new Set(current);
      next.delete(url);
      return next;
    });
  };

  useEffect(() => {
    const knownUrls = new Set([...generatedImageUrls, ...recentGenerationUrls]);
    // Keep image-error state scoped to URLs that are still rendered. This is
    // an intentional synchronization effect for external image load state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUnavailableImageUrls((current) => {
      const next = new Set([...current].filter((url) => knownUrls.has(url)));
      return next.size === current.size ? current : next;
    });
  }, [generatedImageUrls, recentGenerationUrls]);

  const availableVariationSources = generatedImageUrls.filter((url) => !unavailableImageUrls.has(url));
  const primaryImageUrl = availableVariationSources[0] ?? null;
  const selectedRecentUrl = selectedRecentImageUrl && !unavailableImageUrls.has(selectedRecentImageUrl) ? selectedRecentImageUrl : null;
  const selectedVariationUrl = generatedImageUrls[selectedVariation];
  const selectedImageUrl = selectedRecentUrl ?? (selectedVariationUrl && !unavailableImageUrls.has(selectedVariationUrl) ? selectedVariationUrl : primaryImageUrl);
  const isBackgroundPreview = activeTab === "AI Background";
  const isExtendPreview = activeTab === "Extend Image";
  const selectedGalleryImageUrl = galleryImages[galleryIndex] ?? null;
  const galleryImageUrl = selectedGalleryImageUrl && !unavailableImageUrls.has(selectedGalleryImageUrl)
    ? selectedGalleryImageUrl : galleryImages.find((url) => !unavailableImageUrls.has(url)) ?? null;
  const isGalleryView = previewDisplayMode === "gallery" && Boolean(galleryImageUrl);
  const isModelPreviewView = previewDisplayMode === "model";
  const configuredModelPreview = modelPreviewType !== "video" ? modelPreviewUrl : null;
  // A restored draft can have generated URLs before the `generated` flag is
  // hydrated. The selected variation is the source of truth for Preview.
  const canShowBackgroundAfter = isBackgroundPreview && Boolean(selectedImageUrl);
  // Background tools now show the latest result directly; the old Before /
  // After / Mask switcher is intentionally removed from the UI.
  const effectiveBackgroundPreviewMode: BackgroundPreviewMode = isBackgroundPreview
    ? canShowBackgroundAfter ? "after" : "before"
    : canShowBackgroundAfter || backgroundPreviewMode !== "after" ? backgroundPreviewMode : "before";
  const displayedImageUrl = isModelPreviewView ? configuredModelPreview : isGalleryView ? galleryImageUrl : selectedImageUrl;
  const resetMask = () => {
    onBackgroundMaskChange(null);
    setMaskResetKey((key) => key + 1);
  };
  const isPreviewLoading = !isGalleryView && !isModelPreviewView && isGenerating && !selectedImageUrl;
  const variationSources = availableVariationSources;
  const recentPreviewUrls = recentGenerationUrls.filter((url) => !unavailableImageUrls.has(url)).slice(0, 12);
  const hasGallery = variationSources.length > 0 || recentPreviewUrls.length > 0;
  const hasUsableImages = Boolean(selectedImageUrl || variationSources.length || recentPreviewUrls.length);

  useEffect(() => {
    const row = variationRowRef.current;
    if (!row) return;

    const updateScrollState = () => {
      const maxScrollLeft = Math.max(0, row.scrollWidth - row.clientWidth);
      setVariationScrollState({
        canGoBack: row.scrollLeft > 2,
        canGoForward: row.scrollLeft < maxScrollLeft - 2,
      });
    };
    updateScrollState();
    row.addEventListener("scroll", updateScrollState, { passive: true });

    return () => row.removeEventListener("scroll", updateScrollState);
  }, [generatedImageUrls, unavailableImageUrls]);

  useEffect(() => {
    const row = recentRowRef.current;
    if (!row) return;

    const updateScrollState = () => {
      const maxScrollLeft = Math.max(0, row.scrollWidth - row.clientWidth);
      setRecentScrollState({
        canGoBack: row.scrollLeft > 2,
        canGoForward: row.scrollLeft < maxScrollLeft - 2,
      });
    };
    updateScrollState();
    row.addEventListener("scroll", updateScrollState, { passive: true });

    return () => row.removeEventListener("scroll", updateScrollState);
  }, [recentGenerationUrls, unavailableImageUrls]);

  useEffect(() => {
    if (!isImagePopupOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsImagePopupOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isImagePopupOpen]);

  const getGalleryPageStep = (row: HTMLDivElement) => {
    const firstItem = row.querySelector<HTMLElement>("button");
    if (!firstItem) return row.clientWidth;

    const styles = window.getComputedStyle(row);
    const gap = Number.parseFloat(styles.columnGap || styles.gap || "0") || 0;
    const itemStep = firstItem.getBoundingClientRect().width + gap;
    const visibleItemCount = Math.max(1, Math.floor((row.clientWidth + gap) / itemStep));
    return visibleItemCount * itemStep;
  };

  const scrollGallery = (rowRef: RefObject<HTMLDivElement | null>, direction: 1 | -1) => {
    const row = rowRef.current;
    if (!row) return;

    row.scrollBy({ left: getGalleryPageStep(row) * direction, behavior: "smooth" });
  };

  const scrollRecentGenerations = (direction: 1 | -1) => {
    const row = recentRowRef.current;
    if (!row) return;

    row.scrollBy({ left: getGalleryPageStep(row) * direction, behavior: "smooth" });
  };

  const scrollVariations = (direction: 1 | -1) => scrollGallery(variationRowRef, direction);
  const previewStatus = generationStatus === "queued" || generationStatus === "processing" ? `${generationStatus.toUpperCase()} · ${generationCompletedCount}/${generationTotalCount}` : null;
  const sourcePreviewImage = (activeTab === "Image to Image" || activeTab === "AI Style Transfer" || activeTab === "Upscale" || activeTab === "Extend Image") && sourceImage && !generated ? sourceImage : null;
  const genericPreviewImage = selectedImageUrl ?? configuredModelPreview ?? sourcePreviewImage;
  const showingModelPreview = isModelPreviewView || (!isGalleryView && !selectedImageUrl && Boolean(configuredModelPreview) && effectiveBackgroundPreviewMode !== "mask");
  const genericPreviewLabel = previewStatus ?? (generated ? "GENERATION PREVIEW" : showingModelPreview ? "MODEL PREVIEW" : activeTab === "Image to Image" || activeTab === "AI Style Transfer" || activeTab === "Upscale" || activeTab === "Extend Image" ? "UPLOAD SOURCE IMAGE" : "PREVIEW IMAGE");
  const backgroundPreviewImage = effectiveBackgroundPreviewMode === "before" ? configuredModelPreview ?? sourceImage : effectiveBackgroundPreviewMode === "mask" ? backgroundMask ?? sourceImage ?? configuredModelPreview : selectedImageUrl ?? configuredModelPreview ?? sourceImage;
  const backgroundPreviewLabel = effectiveBackgroundPreviewMode === "before" ? configuredModelPreview ? "Model preview" : "Before background edit" : effectiveBackgroundPreviewMode === "mask" ? "Black and white subject removal mask" : selectedImageUrl ? "After background edit" : configuredModelPreview ? "Model preview" : "Uploaded source image preview";
  const isBackgroundMaskEditing = !isGalleryView && !isModelPreviewView && isBackgroundPreview && backgroundMode === "remove" && effectiveBackgroundPreviewMode === "mask";
  const previewImage = isModelPreviewView ? configuredModelPreview : isGalleryView ? galleryImageUrl : isBackgroundPreview ? (isBackgroundMaskEditing ? null : backgroundPreviewImage) : genericPreviewImage;
  const previewImageLabel = isModelPreviewView ? "Model preview" : isGalleryView ? `${galleryKind === "variation" ? "Variation" : "Recent generation"} preview` : isBackgroundPreview ? backgroundPreviewLabel : selectedImageUrl ? "Generated image" : showingModelPreview ? "Model preview" : "Source image preview";
  const previewPlaceholderLabel = isModelPreviewView ? (configuredModelPreview ? "MODEL PREVIEW" : "NO MODEL PREVIEW CONFIGURED") : isGalleryView ? "GALLERY VIEW" : isBackgroundPreview ? (effectiveBackgroundPreviewMode === "after" ? "GENERATE A BACKGROUND" : effectiveBackgroundPreviewMode === "mask" ? "MASK VIEW" : "UPLOAD SOURCE IMAGE") : isPreviewLoading ? (previewStatus ?? "CREATING PREVIEW") : genericPreviewLabel;
  const previewIsGenerated = isGalleryView ? true : isModelPreviewView ? false : isBackgroundPreview ? Boolean(selectedImageUrl) && effectiveBackgroundPreviewMode === "after" : generated;
  const openDisplayedImage = () => {
    if (!displayedImageUrl) return;
    const candidates = isGalleryView ? galleryImages : selectedRecentUrl ? recentPreviewUrls : variationSources;
    const availableImages = candidates.filter((url) => !unavailableImageUrls.has(url));
    const images = availableImages.includes(displayedImageUrl) ? availableImages : [displayedImageUrl];
    const index = images.indexOf(displayedImageUrl);
    setPopupImages(images);
    setPopupIndex(index);
    setIsImagePopupOpen(true);
  };
  const selectGalleryImage = (images: string[], index: number, kind: "variation" | "recent") => {
    const image = images[index];
    if (!image) return;
    setGalleryImages(images);
    setGalleryIndex(index);
    setGalleryKind(kind);
    onPreviewDisplayModeChange("gallery");
  };
  const selectCurrentImage = (images: string[], index: number, kind: "variation" | "recent") => {
    const image = images[index];
    if (!image) return;
    setGalleryImages(images);
    setGalleryIndex(index);
    setGalleryKind(kind);
    onPreviewDisplayModeChange("current");
  };
  const showGalleryView = () => {
    if (galleryImages.length > 0) {
      onPreviewDisplayModeChange("gallery");
      return;
    }
    if (variationSources.length > 0) selectGalleryImage(variationSources, 0, "variation");
    else if (recentPreviewUrls.length > 0) selectGalleryImage(recentPreviewUrls, 0, "recent");
  };
  const downloadImage = async (imageUrl = displayedImageUrl) => {
    if (!imageUrl) return;

    try {
      const response = await fetch(imageUrl);
      if (!response.ok) throw new Error("Image download failed");
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `eos-generated-image.${getImageExtension(blob, imageUrl, imageMimeTypes[imageUrl])}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch {
      window.open(imageUrl, "_blank", "noopener,noreferrer");
    }
  };
  return <section className={cx("gen-panel", "gen-preview-panel")}>
    {unavailableImageUrls.size > 0 && !hasUsableImages && <div className={cx("gen-gallery-status")} role="status">{t("create.image.preview.loadFailed")} <button type="button" className={cx("gen-inline-action")} onClick={retryFailedImages}>{t("create.image.preview.retry")}</button></div>}
    <div className={cx("gen-panel-title")}><h2>{t("create.image.preview.title")}</h2>{previewStatus ? <span className={cx("gen-generation-status", "gen-preview-status")} role="status" aria-live="polite"><span key={generationStatus}>{previewStatus}</span></span> : null}</div>
    {isBackgroundPreview && isBackgroundMaskEditing && <div className={cx("gen-mask-edit-heading")}><div><h3>{t("create.image.preview.refineMask")}</h3><p>Paint or lasso the area to remove. White removes; black keeps.</p></div><button type="button" className={cx("gen-inline-action")} onClick={resetMask} disabled={!backgroundMask}><Trash2 size={12} /> {t("create.image.preview.resetMask")}</button></div>}
    {isExtendPreview ? <ExtendPreview key={`${imageRetryKey}-${displayedImageUrl ?? "empty"}`} sourceImage={sourceImage} resultImage={isModelPreviewView ? null : displayedImageUrl} modelPreviewUrl={configuredModelPreview} aspectRatio={previewRatio} direction={extendDirection} amount={extendAmount} isFavorite={isFavorite} isLoading={isPreviewLoading} placeholderLabel={isPreviewLoading ? (previewStatus ?? "CREATING PREVIEW") : genericPreviewLabel} onDownload={() => void downloadImage()} onToggleFavorite={() => setIsFavorite((favorite) => !favorite)} onOpenImage={openDisplayedImage} onImageError={() => displayedImageUrl && markImageUnavailable(displayedImageUrl)} onImageLoad={() => displayedImageUrl && markImageAvailable(displayedImageUrl)} /> : <PreviewSurface key={`${imageRetryKey}-${previewImage ?? "empty"}`} image={previewImage} alt={previewImageLabel} placeholderLabel={previewPlaceholderLabel} isLoading={isPreviewLoading} generated={previewIsGenerated} actionAvailable={Boolean(displayedImageUrl) && !isBackgroundMaskEditing && !showingModelPreview} isFavorite={isFavorite} onDownload={() => void downloadImage()} onToggleFavorite={() => setIsFavorite((favorite) => !favorite)} onOpenImage={openDisplayedImage} onImageError={() => previewImage && markImageUnavailable(previewImage)} onImageLoad={() => previewImage && markImageAvailable(previewImage)} showActions={!isBackgroundMaskEditing && !showingModelPreview} className={cx(isBackgroundPreview && "is-background-preview", isBackgroundMaskEditing && "is-background-mask-editing")} backgroundColor={isBackgroundPreview && backgroundMode === "solid" && effectiveBackgroundPreviewMode === "after" && !isGalleryView && !isModelPreviewView ? backgroundColor : undefined}>
      {isBackgroundPreview && <div className={cx("gen-mask-editor-preview", !isBackgroundMaskEditing && "is-hidden")}><MaskEditor imageUrl={sourceImage} tool={maskTool} brushSize={brushSize} resetKey={maskResetKey} onMaskChange={onBackgroundMaskChange} /></div>}
      {isBackgroundPreview && !isBackgroundMaskEditing && effectiveBackgroundPreviewMode === "mask" && sourceImage && !backgroundMask && <div className={cx("gen-mask-preview-overlay")} aria-hidden="true"><span>{t("create.image.preview.maskView")}</span></div>}
      {isBackgroundPreview && effectiveBackgroundPreviewMode === "after" && backgroundTransparent && selectedImageUrl && <span className={cx("gen-transparency-badge")}>{t("create.image.preview.pngTransparent")}</span>}
    </PreviewSurface>}
    {isBackgroundPreview && isBackgroundMaskEditing && <div className={cx("gen-mask-tools", "gen-preview-mask-tools")}><div className={cx("gen-mask-tool-tabs")} role="tablist" aria-label="Mask refinement tool"><button type="button" role="tab" aria-selected={maskTool === "brush"} className={cx(maskTool === "brush" && "is-selected")} onClick={() => onMaskToolChange("brush")}><Paintbrush size={13} /> {t("create.image.preview.brush")}</button><button type="button" role="tab" aria-selected={maskTool === "lasso"} className={cx(maskTool === "lasso" && "is-selected")} onClick={() => onMaskToolChange("lasso")}><MousePointer2 size={13} /> {t("create.image.preview.lasso")}</button><button type="button" role="tab" aria-selected={maskTool === "eraser"} className={cx(maskTool === "eraser" && "is-selected")} onClick={() => onMaskToolChange("eraser")}><Eraser size={13} /> {t("create.image.preview.eraser")}</button></div><label className={cx("gen-brush-size")}><span>{t("create.image.preview.size")} <b>{brushSize}px</b></span><input type="range" min="8" max="120" step="1" value={brushSize} onChange={(event) => onBrushSizeChange(Number(event.target.value))} aria-label={t("create.image.preview.brushSize")} disabled={maskTool === "lasso"} /></label></div>}
    <div className={cx("gen-preview-view-switch")} role="tablist" aria-label={t("create.image.previewViews")}><button type="button" role="tab" aria-selected={!isGalleryView && !isModelPreviewView} className={cx(!isGalleryView && !isModelPreviewView && "is-selected")} onClick={() => onPreviewDisplayModeChange("current")}>{t("create.image.common.latestResult")}</button><button type="button" role="tab" aria-selected={isModelPreviewView} className={cx(isModelPreviewView && "is-selected")} onClick={() => onPreviewDisplayModeChange("model")}>{t("create.image.common.modelPreview")}</button><button type="button" role="tab" aria-selected={isGalleryView} className={cx(isGalleryView && "is-selected")} onClick={showGalleryView} disabled={!hasGallery}>{t("create.image.common.imageLibrary")}</button></div>
    <div className={cx("gen-gallery-grid")}>
      <div className={cx("gen-gallery-column")}>
        <div className={cx("gen-gallery-heading")}><h3>{t("create.image.preview.variations")}</h3></div>
        <div className={cx("gen-variation-gallery")}>
          <div className={cx("gen-thumb-row")} ref={variationRowRef}>
            {variationSources.length ? variationSources.map((src, index) => {
              const originalIndex = generatedImageUrls.indexOf(src);
              return <button type="button" key={src} onClick={() => { selectCurrentImage(variationSources, index, "variation"); onVariationSelect(originalIndex); }} className={selectedVariation === originalIndex ? cx("is-selected") : undefined} aria-label={`Variation ${index + 1}`} aria-pressed={selectedVariation === originalIndex}>
                <img src={src} alt={`Generated variation ${index + 1}`} loading="lazy" decoding="async" className={cx("gen-generated-thumbnail-image")} onError={() => markImageUnavailable(src)} onLoad={() => markImageAvailable(src)} />
              </button>;
            }) : <div className={cx("gen-gallery-status", "gen-variation-status")}>{isGenerating ? "Generating variations..." : "Generated variations will appear here."}</div>}
          </div>
          {variationScrollState.canGoBack && <button type="button" className={cx("gen-gallery-prev")} onClick={() => scrollVariations(-1)} aria-label="Previous variations"><ChevronLeft size={18} /></button>}
          {variationScrollState.canGoForward && <button type="button" className={cx("gen-gallery-next")} onClick={() => scrollVariations(1)} aria-label="Next variations"><ChevronRight size={18} /></button>}
        </div>
      </div>
      <div className={cx("gen-gallery-column", "gen-recent-column")}>
        <div className={cx("gen-gallery-heading")}><h3>RECENT GENERATIONS</h3><button type="button" onClick={() => { void onRefreshRecent(); router.push("/history?type=image"); }}>View history</button></div>
        <div className={cx("gen-recent-gallery")}>
          <div className={cx("gen-thumb-row")} ref={recentRowRef}>
            {isLoadingRecent ? <div className={cx("gen-gallery-status")}>{t("create.image.preview.loadingHistory")}</div> : recentError ? <div className={cx("gen-gallery-status", "is-error")}>{recentError}</div> : recentPreviewUrls.length ? recentPreviewUrls.map((src, index) => <button type="button" key={`${src}-${index}`} onClick={() => { onRecentSelect(src); selectGalleryImage(recentPreviewUrls, index, "recent"); }} className={selectedRecentImageUrl === src ? cx("is-selected") : undefined} aria-label={`Recent generation ${index + 1}`} aria-pressed={selectedRecentImageUrl === src}>
              <img src={src} alt={`Recent generation ${index + 1}`} loading="lazy" decoding="async" className={cx("gen-generated-thumbnail-image")} onError={() => markImageUnavailable(src)} onLoad={() => markImageAvailable(src)} />
            </button>) : <div className={cx("gen-gallery-status")}>No generation history yet.</div>}
          </div>
          {recentScrollState.canGoBack && <button type="button" className={cx("gen-gallery-prev")} onClick={() => scrollRecentGenerations(-1)} aria-label="Previous recent generations"><ChevronLeft size={18} /></button>}
          {recentScrollState.canGoForward && <button type="button" className={cx("gen-gallery-next")} onClick={() => scrollRecentGenerations(1)} aria-label="Next recent generations"><ChevronRight size={18} /></button>}
        </div>
      </div>
    </div>
    {isImagePopupOpen && popupImages[popupIndex] && <div className={cx("gen-image-popup")} role="dialog" aria-modal="true" aria-label={t("create.image.preview.generatedAlt")} onMouseDown={(event) => { if (event.target === event.currentTarget) setIsImagePopupOpen(false); }}>{popupIndex > 0 && <button type="button" className={cx("gen-image-popup-nav", "gen-image-popup-prev")} onClick={() => setPopupIndex((index) => Math.max(0, index - 1))} aria-label={t("create.image.preview.previousImage")}><ChevronLeft size={28} /></button>}<div className={cx("gen-image-popup-content")}><button type="button" className={cx("gen-image-popup-close")} onClick={() => setIsImagePopupOpen(false)} aria-label={t("create.image.preview.closeImage")}><X size={20} /></button><img src={popupImages[popupIndex]} alt={t("create.image.preview.expandedAlt")} /><button type="button" className={cx("gen-image-popup-download")} onClick={() => void downloadImage(popupImages[popupIndex])} aria-label={t("create.image.preview.downloadImage")}><Download size={17} /> {t("create.image.preview.download")}</button></div>{popupIndex < popupImages.length - 1 && <button type="button" className={cx("gen-image-popup-nav", "gen-image-popup-next")} onClick={() => setPopupIndex((index) => Math.min(popupImages.length - 1, index + 1))} aria-label={t("create.image.preview.nextImage")}><ChevronRight size={28} /></button>}</div>}
    {isCompareOpen && selectedImageUrl && sourceImage && <div className={cx("gen-compare-popup")} role="dialog" aria-modal="true" aria-label={t("create.image.preview.compareAria")} onMouseDown={(event) => { if (event.target === event.currentTarget) setIsCompareOpen(false); }}><div className={cx("gen-compare-content")}><button type="button" className={cx("gen-image-popup-close")} onClick={() => setIsCompareOpen(false)} aria-label={t("create.image.preview.closeCompare")}><X size={20} /></button><div><span>{t("create.image.preview.original")}</span><img src={sourceImage} alt={t("create.image.preview.originalAlt")} /></div><div><span>{t("create.image.preview.result")}</span><img src={selectedImageUrl} alt="Generated result" /></div></div></div>}
  </section>;
}
