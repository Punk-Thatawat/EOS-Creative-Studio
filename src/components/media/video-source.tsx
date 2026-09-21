"use client";

import { EosVideoPlayer } from "./eos-video-player";
import { getVideoEmbedUrl } from "@/lib/media/video-embed";

export function VideoSource({
  src,
  className = "",
  mediaFrameClassName,
  mediaFrameStyle,
  autoPlay = false,
  muted = true,
  onEnded,
  ariaLabel = "Video preview",
}: {
  src: string;
  className?: string;
  mediaFrameClassName?: string;
  mediaFrameStyle?: React.CSSProperties;
  autoPlay?: boolean;
  muted?: boolean;
  onEnded?: () => void;
  ariaLabel?: string;
}) {
  const embedUrl = getVideoEmbedUrl(src);
  if (embedUrl)
    return (
      <div className={`relative aspect-video w-full overflow-hidden bg-black ${className}`}>
        <iframe
          src={`${embedUrl}${autoPlay ? "&autoplay=1&mute=1" : ""}`}
          title={ariaLabel}
          className="absolute inset-0 h-full w-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
    );
  return (
    <EosVideoPlayer
      src={src}
      autoPlay={autoPlay}
      muted={muted}
      onEnded={onEnded}
      mediaFrameClassName={mediaFrameClassName}
      mediaFrameStyle={mediaFrameStyle}
      className={className}
      ariaLabel={ariaLabel}
    />
  );
}
