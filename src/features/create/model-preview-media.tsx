"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { EosVideoPlayer } from "@/components/media/eos-video-player";
import { YouTubeVideoEmbed } from "@/components/media/youtube-video-embed";
import { isYouTubeVideoUrl } from "@/lib/media/youtube";

type ModelPreviewMediaProps = {
  url: string;
  type?: "image" | "video" | null;
  alt: string;
  className?: string;
  frameClassName?: string;
  frameStyle?: CSSProperties;
  onAspectRatioChange?: (aspectRatio: string) => void;
  autoPlay?: boolean;
};

/* Provider preview URLs are already public/signed media, so render them directly. */
/* eslint-disable @next/next/no-img-element */
export function ModelPreviewMedia({ url, type = "image", alt, className, frameClassName, frameStyle, onAspectRatioChange, autoPlay = false }: ModelPreviewMediaProps) {
  const [mediaAspectRatio, setMediaAspectRatio] = useState("16 / 9");
  const handleAspectRatioChange = (width: number, height: number) => {
    const nextAspectRatio = `${width} / ${height}`;
    setMediaAspectRatio(nextAspectRatio);
    onAspectRatioChange?.(nextAspectRatio);
  };

  const frame = (media: ReactNode) => frameClassName
    ? <div className={frameClassName} style={{ aspectRatio: mediaAspectRatio, ...frameStyle }}>{media}</div>
    : media;

  if (isYouTubeVideoUrl(url)) {
    return <YouTubeVideoEmbed
      key={url}
      url={url}
      title={alt}
      className={className}
      frameClassName={frameClassName}
      frameStyle={frameStyle}
      autoPlay={autoPlay}
      muted={autoPlay}
    />;
  }

  if (type === "video") {
    return <EosVideoPlayer
      key={url}
      src={url}
      className={className}
      autoPlay={autoPlay}
      mediaFrameClassName={frameClassName}
      mediaFrameStyle={frameStyle}
      ariaLabel={alt}
      onAspectRatioChange={onAspectRatioChange}
    />;
  }

  return frame(<img
    src={url}
    alt={alt}
    className={className}
    onLoad={(event) => {
      if (event.currentTarget.naturalWidth && event.currentTarget.naturalHeight) {
        handleAspectRatioChange(event.currentTarget.naturalWidth, event.currentTarget.naturalHeight);
      }
    }}
  />);
}
