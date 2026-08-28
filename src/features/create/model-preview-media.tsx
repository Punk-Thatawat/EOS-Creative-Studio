"use client";

type ModelPreviewMediaProps = {
  url: string;
  type?: "image" | "video" | null;
  alt: string;
  className?: string;
};

/* Provider preview URLs are already public/signed media, so render them directly. */
/* eslint-disable @next/next/no-img-element */
export function ModelPreviewMedia({ url, type = "image", alt, className }: ModelPreviewMediaProps) {
  if (type === "video") {
    return <video src={url} muted autoPlay loop playsInline className={className} aria-label={alt} />;
  }

  return <img src={url} alt={alt} className={className} />;
}
