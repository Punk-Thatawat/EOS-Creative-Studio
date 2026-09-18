"use client";

import { Scissors } from "lucide-react";
import { useLocale } from "@/lib/i18n/locale-provider";
import styles from "./video-generation-page.module.css";

/** The generation ID is the sourceGenerationId used by EOS CUT's import contract. */
export function EosCutButton({ sourceGenerationId }: { sourceGenerationId?: string | null }) {
  const { t } = useLocale();
  const href = sourceGenerationId
    ? `https://cut.eoslabs.tech/projects?importSceneSet=${encodeURIComponent(sourceGenerationId)}`
    : "https://cut.eoslabs.tech/projects";

  return (
    <div className={styles.videoPreviewActions}>
      <a href={href} target="_blank" rel="noopener noreferrer" className={styles.editInEosCutButton}
        title={sourceGenerationId ? t("create.video.common.editInEosCutImport") : t("create.video.common.editInEosCutOpen")}>
        <span className={styles.eosCutIcon}><Scissors size={17} aria-hidden="true" /></span>
        <span>{t("create.video.common.editInEosCut")}</span>
      </a>
    </div>
  );
}
