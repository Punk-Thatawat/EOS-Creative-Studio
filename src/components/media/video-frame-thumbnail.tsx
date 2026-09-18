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
 * headers required for canvas capture. Do not set crossOrigin on the visible
 * element: a CDN without ACAO would make the media itself fail to decode and
 * leave the card black before the canvas fallback gets a chance to render.
 */
export function VideoFrameThumbnail({ src, alt, className, poster, fallback }: VideoFrameThumbnailProps) {
  const containerRef = useRef<HTMLSpanElement>(null);
  const captureVideoRef = useRef<HTMLVideoElement>(null);
  const captureStarted = useRef(false);
  const [frameUrl, setFrameUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [isNearViewport, setIsNearViewport] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof IntersectionObserver === "undefined") {
      setIsNearViewport(true);
      return undefined;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      setIsNearViewport(true);
      observer.disconnect();
    }, { rootMargin: "120px 0px" });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isNearViewport) return undefined;
    const video = captureVideoRef.current;
    if (!video) return undefined;
    captureStarted.current = false;
    let active = true;
    let objectUrl: string | null = null;

    const capture = () => {
      if (!active || captureStarted.current || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video.videoWidth || !video.videoHeight) return;
      captureStarted.current = true;
      const scale = Math.min(1, 480 / Math.max(video.videoWidth, video.videoHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) return;
      try {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
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
      if (video.currentTime !== 0) video.currentTime = 0;
      capture();
    };

    const revealFirstFrame = () => {
      // Some browsers keep a poster-less, paused video black until playback
      // has started once. Muted playback is allowed without user interaction;
      // pause immediately after the first decoded frame so cards stay still.
      void video.play().then(() => {
        video.pause();
        video.currentTime = 0;
        capture();
      }).catch(loadFirstFrame);
    };

    video.addEventListener("loadeddata", revealFirstFrame);
    video.addEventListener("seeked", capture);
    video.load();
    return () => {
      active = false;
      video.removeEventListener("loadeddata", revealFirstFrame);
      video.removeEventListener("seeked", capture);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [isNearViewport, src]);

  if (frameUrl) return <img src={frameUrl} alt={alt} className={className} loading="lazy" />;
  if (failed && fallback) return <>{fallback}</>;
  if (failed) return <span className={className}>ไม่พบภาพตัวอย่าง</span>;
  if (!isNearViewport) return <span ref={containerRef} className={className} aria-label={alt} />;

  return <video
      ref={captureVideoRef}
      src={src}
      poster={poster}
      className={className}
      preload="metadata"
      muted
      playsInline
      aria-label={alt}
      onError={() => setFailed(true)}
    />;
}
