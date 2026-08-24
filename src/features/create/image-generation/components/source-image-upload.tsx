import { useEffect, useRef, useState } from "react";
import { AlertCircle, CloudUpload, ImagePlus, LoaderCircle, Trash2, Upload } from "lucide-react";
import { uploadImageAsset } from "@/lib/api/storage";
import { friendlyUploadError, imageUploadHint, type ImageUploadConstraints, validateMediaFile } from "@/lib/media/upload-validation";
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
};

function SingleSourceImageUpload({ imageUrl, onImageChange, onClear, purpose = "content", feature, workspaceId, imageConstraints, disabled = false }: SourceImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const [isRemoteImageLoaded, setIsRemoteImageLoaded] = useState(Boolean(imageUrl));
  const [error, setError] = useState<string | null>(null);
  const previousImageUrlRef = useRef(imageUrl);
  const pendingRemoteImageUrlRef = useRef<string | null>(null);

  useEffect(() => () => {
    if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
  }, [localPreviewUrl]);

  useEffect(() => {
    if (imageUrl === previousImageUrlRef.current) return;
    previousImageUrlRef.current = imageUrl;
    setIsRemoteImageLoaded(false);
  }, [imageUrl]);

  const readImageFile = async (file: File) => {
    setError(null);
    const validationError = await validateMediaFile(file, "image", imageConstraints);
    if (validationError) {
      setError(validationError);
      return;
    }

    const nextPreviewUrl = URL.createObjectURL(file);
    setLocalPreviewUrl(nextPreviewUrl);
    setIsRemoteImageLoaded(Boolean(imageUrl));
    pendingRemoteImageUrlRef.current = null;
    setIsUploading(true);
    void uploadImageAsset(file, { purpose, feature, workspaceId }).then((providerUrl) => {
      pendingRemoteImageUrlRef.current = providerUrl;
      onImageChange(providerUrl);
    }).catch((uploadError) => {
      setError(friendlyUploadError(uploadError, "We could not upload this image. Please try again."));
      setLocalPreviewUrl(null);
    }).finally(() => setIsUploading(false));
  };

  const chooseFile = () => {
    if (!disabled && !isUploading) inputRef.current?.click();
  };
  const handleDrop = (event: React.DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setDragging(false);
    if (disabled || isUploading) return;
    const file = event.dataTransfer.files[0];
    if (file) void readImageFile(file);
  };

  const hasPreviewImage = Boolean(imageUrl || localPreviewUrl);
  const handleRemoteImageLoad = () => {
    if (!imageUrl) return;
    setIsRemoteImageLoaded(true);
    if (pendingRemoteImageUrlRef.current === imageUrl) {
      pendingRemoteImageUrlRef.current = null;
      setLocalPreviewUrl(null);
    }
  };
  const handleRemoteImageError = () => {
    if (pendingRemoteImageUrlRef.current === imageUrl) {
      setError("The uploaded image preview is temporarily unavailable. Please try again.");
    }
  };
  const handleClear = () => {
    pendingRemoteImageUrlRef.current = null;
    setLocalPreviewUrl(null);
    setIsRemoteImageLoaded(false);
    onClear();
  };

  return <div className={cx("gen-source-upload-wrap")}>
    <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void readImageFile(file); event.currentTarget.value = ""; }} />
    {hasPreviewImage ? <div className={cx("gen-source-preview", isUploading && "is-uploading")}>
      {imageUrl && <img src={imageUrl} alt={localPreviewUrl ? "" : "Uploaded source image"} aria-hidden={Boolean(localPreviewUrl)} className={cx("gen-source-preview-image", "is-remote-preview", isRemoteImageLoaded && "is-visible")} onLoad={handleRemoteImageLoad} onError={handleRemoteImageError} />}
      {localPreviewUrl && <img src={localPreviewUrl} alt="Local preview of uploaded source image" className={cx("gen-source-preview-image", "is-local-preview")} />}
      {isUploading && <div className={cx("gen-source-uploading-overlay")}><span className={cx("gen-upload-status-icon")}><CloudUpload size={19} strokeWidth={1.9} /><LoaderCircle size={28} strokeWidth={1.4} className={cx("gen-generating-icon", "gen-upload-status-spinner")} /></span><span>Uploading securely...</span></div>}
      {imageUrl && !isUploading && <div className={cx("gen-source-actions")}>
        <button type="button" onClick={chooseFile} aria-label="Replace source image" title="Replace source image"><Upload size={14} /> Replace</button>
        <button type="button" onClick={handleClear} aria-label="Remove source image" title="Remove source image"><Trash2 size={14} /> Remove</button>
      </div>}
    </div> : <button type="button" className={cx("gen-upload", dragging && "is-dragging", isUploading && "is-uploading")} onClick={chooseFile} onDragOver={(event) => { if (disabled || isUploading) return; event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={handleDrop} disabled={disabled || isUploading}>
      {isUploading ? <LoaderCircle size={20} className={cx("gen-generating-icon")} /> : <CloudUpload size={20} />}
      <strong>{isUploading ? "Uploading image" : "Upload Image"}</strong>
      <small>{isUploading ? "Please wait" : `PNG / JPG / WEBP${imageUploadHint(imageConstraints)}`}</small>
    </button>}
    {disabled && !hasPreviewImage && <p className={cx("gen-upload-helper", "is-disabled")}>This model does not support content image input.</p>}
    {error && <p className={cx("gen-upload-error")} role="alert"><AlertCircle size={12} /> {error}</p>}
  </div>;
}

function MultipleSourceImageUpload({ imageUrls, onImagesChange, onClear, purpose = "content", feature, workspaceId, imageConstraints, maxImages = 8, disabled = false }: SourceImageUploadProps & { imageUrls: string[]; onImagesChange: (imageUrls: string[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [localPreviewUrls, setLocalPreviewUrls] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const canAddMore = imageUrls.length + localPreviewUrls.length < maxImages;

  useEffect(() => () => localPreviewUrls.forEach((url) => URL.revokeObjectURL(url)), [localPreviewUrls]);

  const readImageFiles = async (files: File[]) => {
    if (disabled || isUploading || files.length === 0) return;
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
    setLocalPreviewUrls(previews);
    setIsUploading(true);
    void Promise.all(selectedFiles.map((file) => uploadImageAsset(file, { purpose, feature, workspaceId }))).then((uploadedUrls) => {
      onImagesChange([...imageUrls, ...uploadedUrls]);
      previews.forEach((url) => URL.revokeObjectURL(url));
      setLocalPreviewUrls([]);
    }).catch((uploadError) => {
      setError(friendlyUploadError(uploadError, "We could not upload these images. Please try again."));
      previews.forEach((url) => URL.revokeObjectURL(url));
      setLocalPreviewUrls([]);
    }).finally(() => setIsUploading(false));
  };

  const chooseFile = () => {
    if (!disabled && !isUploading && canAddMore) inputRef.current?.click();
  };
  const handleDrop = (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    setDragging(false);
    void readImageFiles(Array.from(event.dataTransfer.files));
  };
  const removeImage = (index: number) => {
    const next = imageUrls.filter((_, imageIndex) => imageIndex !== index);
    if (next.length === 0) onClear();
    else onImagesChange(next);
  };

  return <div className={cx("gen-source-upload-wrap")}>
    <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(event) => { void readImageFiles(Array.from(event.target.files ?? [])); event.currentTarget.value = ""; }} />
    {(imageUrls.length > 0 || localPreviewUrls.length > 0) ? <div className={cx("gen-multi-source-preview", isUploading && "is-uploading")} onDragOver={(event) => { if (!disabled && canAddMore) { event.preventDefault(); setDragging(true); } }} onDragLeave={() => setDragging(false)} onDrop={handleDrop}>
      <div className={cx("gen-multi-source-grid")}>{imageUrls.map((url, index) => <div className={cx("gen-multi-source-item")} key={url}><img src={url} alt={`Uploaded source image ${index + 1}`} /><button type="button" onClick={() => removeImage(index)} aria-label={`Remove source image ${index + 1}`}><Trash2 size={12} /></button></div>)}{localPreviewUrls.map((url, index) => <div className={cx("gen-multi-source-item", "is-local")} key={url}><img src={url} alt={`Uploading source image ${imageUrls.length + index + 1}`} /></div>)}</div>
      {isUploading && <div className={cx("gen-source-uploading-overlay")}><span className={cx("gen-upload-status-icon")}><CloudUpload size={19} strokeWidth={1.9} /><LoaderCircle size={28} strokeWidth={1.4} className={cx("gen-generating-icon", "gen-upload-status-spinner")} /></span><span>Uploading securely...</span></div>}
      {!isUploading && canAddMore && <button type="button" className={cx("gen-multi-source-add")} onClick={chooseFile} disabled={disabled}><ImagePlus size={14} /> Add images</button>}
    </div> : <button type="button" className={cx("gen-upload", dragging && "is-dragging", isUploading && "is-uploading")} onClick={chooseFile} onDragOver={(event) => { if (!disabled && canAddMore) { event.preventDefault(); setDragging(true); } }} onDragLeave={() => setDragging(false)} onDrop={handleDrop} disabled={disabled || isUploading || !canAddMore}>
      {isUploading ? <LoaderCircle size={20} className={cx("gen-generating-icon")} /> : <CloudUpload size={20} />}
      <strong>{isUploading ? "Uploading images" : "Upload images"}</strong>
      <small>Up to {maxImages} images{imageUploadHint(imageConstraints)} each</small>
    </button>}
    {disabled && imageUrls.length === 0 && <p className={cx("gen-upload-helper", "is-disabled")}>This model accepts one source image only.</p>}
    {error && <p className={cx("gen-upload-error")} role="alert"><AlertCircle size={12} /> {error}</p>}
  </div>;
}

export function SourceImageUpload(props: SourceImageUploadProps) {
  if (props.imageUrls && props.onImagesChange) return <MultipleSourceImageUpload {...props} imageUrls={props.imageUrls} onImagesChange={props.onImagesChange} />;
  return <SingleSourceImageUpload {...props} />;
}
