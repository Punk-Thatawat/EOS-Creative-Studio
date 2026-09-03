"use client";

type ModelPreviewMediaProps = {
  url: string;
  type?: "image" | "video" | null;
  alt: string;
  className?: string;
  onAspectRatioChange?: (aspectRatio: string) => void;
};

/* Provider preview URLs are already public/signed media, so render them directly. */
/* eslint-disable @next/next/no-img-element */
export function ModelPreviewMedia({ url, type = "image", alt, className, onAspectRatioChange }: ModelPreviewMediaProps) {
  if (type === "video") {
    return <video
      src={url}
      muted
      autoPlay
      loop
      playsInline
      className={className}
      aria-label={alt}
      onLoadedMetadata={(event) => {
        if (event.currentTarget.videoWidth && event.currentTarget.videoHeight) {
          onAspectRatioChange?.(`${event.currentTarget.videoWidth} / ${event.currentTarget.videoHeight}`);
        }
      }}
    />;
  }

  return <img
    src={url}
    alt={alt}
    className={className}
    onLoad={(event) => {
      if (event.currentTarget.naturalWidth && event.currentTarget.naturalHeight) {
        onAspectRatioChange?.(`${event.currentTarget.naturalWidth} / ${event.currentTarget.naturalHeight}`);
      }
    }}
  />;
}
