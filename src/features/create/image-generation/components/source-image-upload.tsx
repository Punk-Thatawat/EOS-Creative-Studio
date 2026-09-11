import { useEffect, useRef, useState } from "react";
import { AlertCircle, CloudUpload, ImagePlus, Trash2, Upload } from "lucide-react";
import type { PendingImageUpload } from "@/lib/media/deferred-upload";
import { imageUploadHint, type ImageUploadConstraints, validateMediaFile } from "@/lib/media/upload-validation";
import { cx } from "../styles";

/* These URLs can be local object URLs or temporary provider-hosted URLs. */
/* eslint-disable @next/next/no-img-element */


type SourceImageUploadProps = {
  imageUrl: string | null;
  onImageChange: (imageUrl: string) => void;
  onClear: () => void;
  imageUrls?: string[];
  onImagesChange?: (imageUrls: string[]) => void;
  maxImages?: number;
  purpose?: "content" | "style-reference" | "background-reference";
  feature: "image-to-image" | "ai-style-transfer" | "background-removal" | "upscale" | "extend-image";
  workspaceId?: string | null;
  imageConstraints?: ImageUploadConstraints;
  disabled?: boolean;
  onPendingImageChange?: (file: File | null, previewUrl: string | null) => void;
  onPendingImagesChange?: (items: PendingImageUpload[]) => void;
  onPendingImageRemove?: (previewUrl: string) => void;
  onPendingImagesClear?: () => void;
};

function SingleSourceImageUpload({ imageUrl, onImageChange, onClear, imageConstraints, disabled = false, onPendingImageChange }: SourceImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const [isRemoteImageLoaded, setIsRemoteImageLoaded] = useState(Boolean(imageUrl));
  const [error, setError] = useState<string | null>(null);
  const previousImageUrlRef = useRef(imageUrl);

  useEffect(() => () => {
    if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
  }, [localPreviewUrl]);

  useEffect(() => {
    if (imageUrl === previousImageUrlRef.current) return;
    previousImageUrlRef.current = imageUrl;
    setIsRemoteImageLoaded(false);
    if (imageUrl && !imageUrl.startsWith("blob:") && localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
  }, [imageUrl, localPreviewUrl]);

  const readImageFile = async (file: File) => {
    setError(null);
    const validationError = await validateMediaFile(file, "image", imageConstraints);
    if (validationError) {
      setError(validationError);
      return;
    }

    const nextPreviewUrl = URL.createObjectURL(file);
    setLocalPreviewUrl(nextPreviewUrl);
    setIsRemoteImageLoaded(true);
    onPendingImageChange?.(file, nextPreviewUrl);
    onImageChange(nextPreviewUrl);
  };

  const chooseFile = () => {
    if (!disabled) inputRef.current?.click();
  };
  const handleDrop = (event: React.DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setDragging(false);
    if (disabled) return;
    const file = event.dataTransfer.files[0];
    if (file) void readImageFile(file);
  };

  const hasPreviewImage = Boolean(imageUrl || localPreviewUrl);
  const visibleLocalPreviewUrl = imageUrl && !imageUrl.startsWith("blob:") ? null : localPreviewUrl;
  const handleRemoteImageLoad = () => {
    if (!imageUrl) return;
    setIsRemoteImageLoaded(true);
  };
  const handleRemoteImageError = () => {
    if (imageUrl && !imageUrl.startsWith("blob:")) setError("The selected image preview is temporarily unavailable. Please try again.");
  };
  const handleClear = () => {
    setLocalPreviewUrl(null);
    setIsRemoteImageLoaded(false);
    onPendingImageChange?.(null, null);
    onClear();
  };

  return <div className={cx("gen-source-upload-wrap")}>
    <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void readImageFile(file); event.currentTarget.value = ""; }} />
    {hasPreviewImage ? <div className={cx("gen-source-preview")}>
      {imageUrl && <img src={imageUrl} alt={visibleLocalPreviewUrl ? "" : "Uploaded source image"} aria-hidden={Boolean(visibleLocalPreviewUrl)} className={cx("gen-source-preview-image", "is-remote-preview", isRemoteImageLoaded && "is-visible")} onLoad={handleRemoteImageLoad} onError={handleRemoteImageError} />}
      {visibleLocalPreviewUrl && <img src={visibleLocalPreviewUrl} alt="Local preview of selected source image" className={cx("gen-source-preview-image", "is-local-preview")} />}
      {imageUrl && <div className={cx("gen-source-actions")}>
        <button type="button" onClick={chooseFile} aria-label="Replace source image" title="Replace source image"><Upload size={14} /> Replace</button>
        <button type="button" onClick={handleClear} aria-label="Remove source image" title="Remove source image"><Trash2 size={14} /> Remove</button>
      </div>}
    </div> : <button type="button" className={cx("gen-upload", dragging && "is-dragging")} onClick={chooseFile} onDragOver={(event) => { if (disabled) return; event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={handleDrop} disabled={disabled}>
      <CloudUpload size={20} />
      <strong>Choose image</strong>
      <small>Uploads when you generate · PNG / JPG / WEBP{imageUploadHint(imageConstraints)}</small>
    </button>}
    {disabled && !hasPreviewImage && <p className={cx("gen-upload-helper", "is-disabled")}>This model does not support content image input.</p>}
    {error && <p className={cx("gen-upload-error")} role="alert"><AlertCircle size={12} /> {error}</p>}
  </div>;
}

function MultipleSourceImageUpload({ imageUrls, onImagesChange, onClear, imageConstraints, maxImages = 8, disabled = false, onPendingImagesChange, onPendingImageRemove, onPendingImagesClear }: SourceImageUploadProps & { imageUrls: string[]; onImagesChange: (imageUrls: string[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previewUrlsRef = useRef(new Set<string>());
  const canAddMore = imageUrls.length < maxImages;

  useEffect(() => () => previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url)), []);
  useEffect(() => {
    for (const previewUrl of previewUrlsRef.current) {
      if (!imageUrls.includes(previewUrl)) {
        URL.revokeObjectURL(previewUrl);
        previewUrlsRef.current.delete(previewUrl);
      }
    }
  }, [imageUrls]);

  const readImageFiles = async (files: File[]) => {
    if (disabled || files.length === 0) return;
    setError(null);
    const remaining = Math.max(0, maxImages - imageUrls.length);
    if (remaining === 0) {
      setError(`This model accepts up to ${maxImages} images.`);
      return;
    }
    const selectedFiles = files.slice(0, remaining);
    const validationErrors = await Promise.all(selectedFiles.map((file) => validateMediaFile(file, "image", imageConstraints)));
    const invalidFile = validationErrors.find(Boolean);
    if (invalidFile) {
      setError(invalidFile);
      return;
    }

    const previews = selectedFiles.map((file) => URL.createObjectURL(file));
    previews.forEach((previewUrl) => previewUrlsRef.current.add(previewUrl));
    onImagesChange([...imageUrls, ...previews]);
    onPendingImagesChange?.(selectedFiles.map((file, index) => ({ file, previewUrl: previews[index] })));
  };

  const chooseFile = () => {
    if (!disabled && canAddMore) inputRef.current?.click();
  };
  const handleDrop = (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    setDragging(false);
    void readImageFiles(Array.from(event.dataTransfer.files));
  };
  const removeImage = (index: number) => {
    const removedUrl = imageUrls[index];
    if (removedUrl && previewUrlsRef.current.has(removedUrl)) {
      URL.revokeObjectURL(removedUrl);
      previewUrlsRef.current.delete(removedUrl);
      onPendingImageRemove?.(removedUrl);
    }
    const next = imageUrls.filter((_, imageIndex) => imageIndex !== index);
    if (next.length === 0) {
      onPendingImagesClear?.();
      onClear();
    }
    else onImagesChange(next);
  };

  return <div className={cx("gen-source-upload-wrap")}>
    <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(event) => { void readImageFiles(Array.from(event.target.files ?? [])); event.currentTarget.value = ""; }} />
    {(imageUrls.length > 0) ? <div className={cx("gen-multi-source-preview")} onDragOver={(event) => { if (!disabled && canAddMore) { event.preventDefault(); setDragging(true); } }} onDragLeave={() => setDragging(false)} onDrop={handleDrop}>
      <div className={cx("gen-multi-source-grid")}>{imageUrls.map((url, index) => <div className={cx("gen-multi-source-item")} key={url}><img src={url} alt={`Selected source image ${index + 1}`} /><button type="button" onClick={() => removeImage(index)} aria-label={`Remove source image ${index + 1}`}><Trash2 size={12} /></button></div>)}</div>
      {canAddMore && <button type="button" className={cx("gen-multi-source-add")} onClick={chooseFile} disabled={disabled}><ImagePlus size={14} /> Add images</button>}
    </div> : <button type="button" className={cx("gen-upload", dragging && "is-dragging")} onClick={chooseFile} onDragOver={(event) => { if (!disabled && canAddMore) { event.preventDefault(); setDragging(true); } }} onDragLeave={() => setDragging(false)} onDrop={handleDrop} disabled={disabled || !canAddMore}>
      <CloudUpload size={20} />
      <strong>Choose images</strong>
      <small>Uploads when you generate · Up to {maxImages} images{imageUploadHint(imageConstraints)} each</small>
    </button>}
    {disabled && imageUrls.length === 0 && <p className={cx("gen-upload-helper", "is-disabled")}>This model accepts one source image only.</p>}
    {error && <p className={cx("gen-upload-error")} role="alert"><AlertCircle size={12} /> {error}</p>}
  </div>;
}

export function SourceImageUpload(props: SourceImageUploadProps) {
  if (props.imageUrls && props.onImagesChange) return <MultipleSourceImageUpload {...props} imageUrls={props.imageUrls} onImagesChange={props.onImagesChange} />;
  return <SingleSourceImageUpload {...props} />;
}
