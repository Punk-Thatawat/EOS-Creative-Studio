"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronRight, Play } from "lucide-react";
import { listGenerationHistory, type GenerationHistoryItem } from "@/lib/api/generations";
import styles from "./video-generation-page.module.css";
import { EosCutButton } from "./eos-cut-button";
import { useLocale } from "@/lib/i18n/locale-provider";

type VideoResultLibraryProps = {
  feature: string;
  currentVideoUrl: string | null;
  currentSourceGenerationId?: string | null;
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

function VideoGalleryThumbnail({ url, playSize = 14 }: { url: string; playSize?: number }) {
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");

  return (
    <span className={styles.videoGalleryThumb}>
      <video
        src={url}
        muted
        playsInline
        preload="auto"
        controls={false}
        disablePictureInPicture
        disableRemotePlayback
        tabIndex={-1}
        aria-hidden="true"
        onLoadedData={() => setLoadState("ready")}
        onError={() => setLoadState("error")}
      />
      {loadState !== "ready" ? (
        <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", padding: 4, background: "#11192366", color: "#fff", fontSize: 7, fontWeight: 800, textAlign: "center", pointerEvents: "none" }} aria-hidden="true">
          {loadState === "loading" ? "กำลังโหลด…" : "กดเพื่อดู"}
        </span>
      ) : null}
      <span className={styles.videoGalleryPlay}><Play size={playSize} fill="currentColor" /></span>
    </span>
  );
}

export function VideoResultLibrary({ feature, currentVideoUrl, currentSourceGenerationId, selectedVideoUrl, refreshKey = 0, onVideoSelect }: VideoResultLibraryProps) {
  const { t } = useLocale();
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
          const message = reason instanceof Error ? reason.message : "";
          if (active) setError(/please sign in/i.test(message) ? t("create.video.common.historySignIn") : message || t("create.video.common.loadingHistory"));
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [feature, refreshKey, t]);

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
  const selectedHistoryItem = selectedVideoUrl ? items.find((item) => item.url === selectedVideoUrl) : undefined;
  const selectedSourceGenerationId = selectedHistoryItem?.id
    ?? (selectedVideoUrl === currentVideoUrl ? currentSourceGenerationId : null)
    ?? (!selectedVideoUrl ? currentSourceGenerationId ?? items[0]?.id : null);

  return (
    <section className={styles.videoResultLibrary} aria-label={t("create.video.common.videoResults")}>
      <EosCutButton sourceGenerationId={selectedSourceGenerationId} />
      <div className={styles.previewViewTabs} role="tablist" aria-label={t("create.video.common.videoPreviewViews")}>
        <button type="button" role="tab" aria-selected={view === "latest"} className={view === "latest" ? styles.previewViewTabActive : undefined} onClick={selectLatest}>{t("create.video.common.latestResult")}</button>
        <button type="button" role="tab" aria-selected={view === "library"} className={view === "library" ? styles.previewViewTabActive : undefined} onClick={() => setView("library")}>{t("create.video.common.videoLibrary")}</button>
      </div>
      <div className={styles.videoGalleryGrid}>
        <div className={styles.videoGalleryColumn}>
          <div className={styles.videoGalleryHeading}><h3>{t("create.video.common.currentVideo")}</h3></div>
          <div className={styles.videoCurrentGallery}>
            {latestVideoUrl ? (
              <button type="button" className={styles.videoCurrentCard} onClick={selectLatest} aria-label={t("create.video.common.latestVideo")} aria-pressed={view === "latest" && selectedVideoUrl === latestVideoUrl}>
                <VideoGalleryThumbnail key={latestVideoUrl} url={latestVideoUrl} />
                <span className={styles.videoGalleryStatus}>{t("create.video.common.latestVideo")}</span>
              </button>
            ) : (
              <div className={styles.videoGalleryEmpty}>{t("create.video.common.latestVideoEmpty")}</div>
            )}
          </div>
        </div>
        <div className={`${styles.videoGalleryColumn} ${styles.videoRecentColumn}`}>
          <div className={styles.videoGalleryHeading}>
            <h3>{t("create.video.common.recentVideos")}</h3>
            <button type="button" onClick={() => setView("library")}>{t("create.video.common.viewHistory")}</button>
          </div>
          <div className={styles.videoRecentGallery}>
            <div className={styles.videoRecentRow} ref={recentRowRef}>
              {loading ? <div className={styles.videoGalleryEmpty}>{t("create.video.common.loadingHistory")}</div> : error ? <div className={`${styles.videoGalleryEmpty} ${styles.videoGalleryError}`} role="alert">{error}</div> : items.length ? items.map((item) => (
                <button key={item.id} type="button" className={`${styles.videoRecentCard} ${selectedVideoUrl === item.url && view === "library" ? styles.videoRecentCardSelected : ""}`} onClick={() => { setView("library"); onVideoSelect(item.url, "library"); }} aria-label={t("create.video.common.latestVideo")} aria-pressed={selectedVideoUrl === item.url && view === "library"}>
                  <VideoGalleryThumbnail key={item.url} url={item.url} playSize={13} />
                </button>
              )) : <div className={styles.videoGalleryEmpty}>{t("create.video.common.noVideos")}</div>}
            </div>
            {items.length > 3 ? <button type="button" className={styles.videoGalleryNext} onClick={() => recentRowRef.current?.scrollBy({ left: 290, behavior: "smooth" })} aria-label={t("create.video.common.nextRecentVideos")}><ChevronRight size={18} /></button> : null}
          </div>
        </div>
      </div>
    </section>
  );
}
