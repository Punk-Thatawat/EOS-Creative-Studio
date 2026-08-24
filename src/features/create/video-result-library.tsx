"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronRight, Play } from "lucide-react";
import { listGenerationHistory, type GenerationHistoryItem } from "@/lib/api/generations";
import styles from "./video-generation-page.module.css";

type VideoResultLibraryProps = {
  feature: string;
  currentVideoUrl: string | null;
  selectedVideoUrl: string | null;
  refreshKey?: number;
  onVideoSelect: (url: string, view: "latest" | "library") => void;
};

function historyVideoUrl(item: GenerationHistoryItem): string | null {
  const url = item.output?.find((output) => typeof output.url === "string" && output.url)?.url;
  if (typeof url === "string") return url;
  return typeof item.finalVideoUrl === "string" && item.finalVideoUrl
    ? item.finalVideoUrl
    : typeof item.videoUrl === "string" && item.videoUrl
      ? item.videoUrl
      : null;
}

function completedHistory(items: GenerationHistoryItem[]): Array<{ id: string; url: string }> {
  return items
    .filter((item) => item.status === "completed")
    .map((item) => ({ id: item.id, url: historyVideoUrl(item) }))
    .filter((item): item is { id: string; url: string } => Boolean(item.url));
}

export function VideoResultLibrary({ feature, currentVideoUrl, selectedVideoUrl, refreshKey = 0, onVideoSelect }: VideoResultLibraryProps) {
  const [items, setItems] = useState<Array<{ id: string; url: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"latest" | "library">("latest");
  const recentRowRef = useRef<HTMLDivElement | null>(null);
  const autoSelectedLatestRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    const timeoutId = window.setTimeout(() => {
      if (!active) return;
      setLoading(true);
      setError(null);
      // History belongs to the signed-in account. Do not scope it to the last
      // workspace stored by another generation tab, otherwise switching tabs
      // can hide previously completed videos.
      void listGenerationHistory(undefined, feature)
        .then((history) => {
          if (active) setItems(completedHistory(history));
        })
        .catch((reason: unknown) => {
          if (active) setError(reason instanceof Error ? reason.message : "Unable to load video history");
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [feature, refreshKey]);

  useEffect(() => {
    const latest = items[0];
    if (!latest || currentVideoUrl || selectedVideoUrl || view !== "latest") return;
    if (autoSelectedLatestRef.current === `${feature}:${latest.id}`) return;
    autoSelectedLatestRef.current = `${feature}:${latest.id}`;
    onVideoSelect(latest.url, "latest");
  }, [currentVideoUrl, feature, items, onVideoSelect, selectedVideoUrl, view]);

  const selectLatest = () => {
    const latestVideoUrl = currentVideoUrl ?? selectedVideoUrl ?? items[0]?.url ?? null;
    if (!latestVideoUrl) return;
    setView("latest");
    onVideoSelect(latestVideoUrl, "latest");
  };

  const latestVideoUrl = currentVideoUrl ?? selectedVideoUrl ?? items[0]?.url ?? null;

  return (
    <section className={styles.videoResultLibrary} aria-label="Video results">
      <div className={styles.previewViewTabs} role="tablist" aria-label="Video result views">
        <button type="button" role="tab" aria-selected={view === "latest"} className={view === "latest" ? styles.previewViewTabActive : undefined} onClick={selectLatest}>Latest result</button>
        <button type="button" role="tab" aria-selected={view === "library"} className={view === "library" ? styles.previewViewTabActive : undefined} onClick={() => setView("library")}>Video library</button>
      </div>
      <div className={styles.videoGalleryGrid}>
        <div className={styles.videoGalleryColumn}>
          <div className={styles.videoGalleryHeading}><h3>CURRENT VIDEO</h3></div>
          <div className={styles.videoCurrentGallery}>
            {latestVideoUrl ? (
              <button type="button" className={styles.videoCurrentCard} onClick={selectLatest} aria-label="Show latest generated video" aria-pressed={view === "latest" && selectedVideoUrl === latestVideoUrl}>
                <span className={styles.videoGalleryThumb}><video src={latestVideoUrl} muted playsInline preload="metadata" controls={false} disablePictureInPicture disableRemotePlayback tabIndex={-1} aria-hidden="true" /><span className={styles.videoGalleryPlay}><Play size={14} fill="currentColor" /></span></span>
                <span className={styles.videoGalleryStatus}>Latest generated video</span>
              </button>
            ) : (
              <div className={styles.videoGalleryEmpty}>Latest generated video will appear here.</div>
            )}
          </div>
        </div>
        <div className={`${styles.videoGalleryColumn} ${styles.videoRecentColumn}`}>
          <div className={styles.videoGalleryHeading}>
            <h3>RECENT VIDEOS</h3>
            <button type="button" onClick={() => setView("library")}>View history</button>
          </div>
          <div className={styles.videoRecentGallery}>
            <div className={styles.videoRecentRow} ref={recentRowRef}>
              {loading ? <div className={styles.videoGalleryEmpty}>Loading video history…</div> : error ? <div className={`${styles.videoGalleryEmpty} ${styles.videoGalleryError}`} role="alert">{error}</div> : items.length ? items.map((item) => (
                <button key={item.id} type="button" className={`${styles.videoRecentCard} ${selectedVideoUrl === item.url && view === "library" ? styles.videoRecentCardSelected : ""}`} onClick={() => { setView("library"); onVideoSelect(item.url, "library"); }} aria-label="Open recent generated video" aria-pressed={selectedVideoUrl === item.url && view === "library"}>
                  <span className={styles.videoGalleryThumb}><video src={item.url} muted playsInline preload="metadata" controls={false} disablePictureInPicture disableRemotePlayback tabIndex={-1} aria-hidden="true" /><span className={styles.videoGalleryPlay}><Play size={13} fill="currentColor" /></span></span>
                </button>
              )) : <div className={styles.videoGalleryEmpty}>No generated videos yet.</div>}
            </div>
            {items.length > 3 ? <button type="button" className={styles.videoGalleryNext} onClick={() => recentRowRef.current?.scrollBy({ left: 290, behavior: "smooth" })} aria-label="Next recent videos"><ChevronRight size={18} /></button> : null}
          </div>
        </div>
      </div>
    </section>
  );
}
