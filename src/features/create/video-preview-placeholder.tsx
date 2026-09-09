"use client";

import Image from "next/image";
import { useState } from "react";
import { Download, Heart, ImageIcon } from "lucide-react";
import { useLocale } from "@/lib/i18n/locale-provider";
import styles from "./video-generation-page.module.css";

type VideoPreviewPlaceholderProps = {
  showActions?: boolean;
};

type VideoPreviewOverlayActionsProps = {
  videoUrl: string | null;
};

export function VideoPreviewOverlayActions({ videoUrl }: VideoPreviewOverlayActionsProps) {
  const { t } = useLocale();
  const [isFavorite, setIsFavorite] = useState(false);

  const downloadVideo = async () => {
    if (!videoUrl) return;
    try {
      const response = await fetch(videoUrl);
      if (!response.ok) throw new Error("Unable to download video");
      const blobUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = "eos-generated-video.mp4";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch {
      window.open(videoUrl, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div className={styles.videoPreviewOverlayActions}>
      <button type="button" onClick={() => void downloadVideo()} disabled={!videoUrl} aria-label={t("create.video.common.downloadVideo")} title={t("create.video.common.downloadVideo")}>
        <Download size={16} />
      </button>
      <button type="button" onClick={() => setIsFavorite((favorite) => !favorite)} disabled={!videoUrl} aria-label={t("create.video.common.favoriteVideo")} title={t("create.video.common.favoriteVideo")} className={isFavorite ? styles.videoFavoriteActive : undefined}>
        <Heart size={16} fill={isFavorite ? "currentColor" : "none"} />
      </button>
    </div>
  );
}

export function VideoPreviewLiveBadge() {
  const { t } = useLocale();
  return <Image src="/generated-assets/preview-live.png" alt={t("create.preview")} width={1536} height={1024} className={styles.videoPreviewLiveBadge} />;
}

/** Shared empty state for every video-generation preview. */
export function VideoPreviewPlaceholder({ showActions = true }: VideoPreviewPlaceholderProps) {
  const { t } = useLocale();
  return (
    <div className={styles.videoPreviewPlaceholder} aria-label={t("create.video.common.videoPreview")}>
      <div className={styles.videoPreviewPlaceholderContent}>
        <ImageIcon size={30} />
        <strong>{t("create.video.common.previewVideoLabel")}</strong>
      </div>
      {showActions ? <VideoPreviewOverlayActions videoUrl={null} /> : null}
    </div>
  );
}
