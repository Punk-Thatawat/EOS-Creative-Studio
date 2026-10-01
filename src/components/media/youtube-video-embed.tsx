import type { CSSProperties } from "react";
import { getYouTubeEmbedUrl } from "@/lib/media/youtube";

export function YouTubeVideoEmbed({
  url,
  title,
  className,
  frameClassName,
  frameStyle,
  autoPlay = false,
  muted = false,
}: {
  url: string;
  title: string;
  className?: string;
  frameClassName?: string;
  frameStyle?: CSSProperties;
  autoPlay?: boolean;
  muted?: boolean;
}) {
  const src = getYouTubeEmbedUrl(url, { autoPlay, muted });
  if (!src) return null;

  const iframe = <iframe
    src={src}
    title={title}
    className="absolute inset-0 block h-full w-full border-0"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
    referrerPolicy="strict-origin-when-cross-origin"
    allowFullScreen
  />;

  return frameClassName
    ? <div className={className}><div className={frameClassName} style={{ aspectRatio: "16 / 9", ...frameStyle }}>{iframe}</div></div>
    : <div className={className} style={{ position: "relative", aspectRatio: "16 / 9", ...frameStyle }}>{iframe}</div>;
}
