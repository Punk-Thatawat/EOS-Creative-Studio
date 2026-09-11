/* eslint-disable @next/next/no-img-element */

"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

type VideoFrameThumbnailProps = {
  src: string;
  alt: string;
  className: string;
  poster?: string;
  fallback?: ReactNode;
};

/**
 * Turns the first decoded video frame into a small JPEG thumbnail. The visible
 * video remains as a fallback because some provider CDNs do not expose CORS
 * headers required for canvas capture.
 */
export function VideoFrameThumbnail({ src, alt, className, poster, fallback }: VideoFrameThumbnailProps) {
  const visibleVideoRef = useRef<HTMLVideoElement>(null);
  const captureVideoRef = useRef<HTMLVideoElement>(null);
  const captureStarted = useRef(false);
  const [frameUrl, setFrameUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const captureVideo = captureVideoRef.current;
    if (!captureVideo) return undefined;
    let active = true;
    let objectUrl: string | null = null;

    const capture = () => {
      if (!active || captureStarted.current || captureVideo.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !captureVideo.videoWidth || !captureVideo.videoHeight) return;
      captureStarted.current = true;
      const scale = Math.min(1, 480 / Math.max(captureVideo.videoWidth, captureVideo.videoHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(captureVideo.videoWidth * scale));
      canvas.height = Math.max(1, Math.round(captureVideo.videoHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) return;
      try {
        context.drawImage(captureVideo, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (!active || !blob) return;
          objectUrl = URL.createObjectURL(blob);
          setFrameUrl(objectUrl);
        }, "image/jpeg", 0.84);
      } catch {
        // Keep the visible video as a first-frame fallback when CORS blocks
        // drawing this provider response onto a canvas.
      }
    };
    const loadFirstFrame = () => {
      if (captureVideo.currentTime !== 0) captureVideo.currentTime = 0;
      capture();
    };

    captureVideo.addEventListener("loadeddata", loadFirstFrame);
    captureVideo.addEventListener("seeked", capture);
    captureVideo.load();
    return () => {
      active = false;
      captureVideo.removeEventListener("loadeddata", loadFirstFrame);
      captureVideo.removeEventListener("seeked", capture);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src]);

  if (frameUrl) return <img src={frameUrl} alt={alt} className={className} loading="lazy" />;
  if (failed && fallback) return <>{fallback}</>;
  if (failed) return <span className={className}>ไม่พบภาพตัวอย่าง</span>;

  return <>
    <video
      ref={visibleVideoRef}
      src={src}
      poster={poster}
      className={className}
      preload="metadata"
      muted
      playsInline
      aria-label={alt}
      onError={() => setFailed(true)}
    />
    <video
      ref={captureVideoRef}
      src={src}
      crossOrigin="anonymous"
      preload="auto"
      muted
      playsInline
      tabIndex={-1}
      aria-hidden="true"
      style={{ position: "fixed", left: "-10000px", top: 0, width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
    />
  </>;
}
