import { AlertTriangle } from "lucide-react";
import styles from "./video-generation-page.module.css";
import type { VideoGenerationPageState } from "./use-video-generation-page";

export function DeleteSceneDialog({ videoGen }: { videoGen: VideoGenerationPageState }) {
  const {
    deleteSceneIndex,
    closeDeleteSceneDialog,
    confirmDeleteScene,
    t,
  } = videoGen;

  // The page only renders this section when the value is set; the guard narrows its type.
  if (deleteSceneIndex === null) return null;

  return (
    <div
      className={styles.confirmModalBackdrop}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeDeleteSceneDialog();
      }}
    >
      <div
        className={styles.confirmModal}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-scene-title"
        aria-describedby="delete-scene-description"
      >
        <div className={styles.confirmModalIcon} aria-hidden="true">
          <AlertTriangle size={20} />
        </div>
        <div className={styles.confirmModalCopy}>
        <h2 id="delete-scene-title">{t("create.video.common.deleteSceneConfirm", { number: deleteSceneIndex + 1 })}</h2>
          <p id="delete-scene-description">
            {t("create.video.common.deleteSceneDescription")}
          </p>
        </div>
        <div className={styles.confirmModalActions}>
          <button
            type="button"
            className={styles.confirmModalCancel}
            onClick={closeDeleteSceneDialog}
            autoFocus
          >
            {t("create.video.common.cancel")}
          </button>
          <button
            type="button"
            className={styles.confirmModalDelete}
            onClick={confirmDeleteScene}
          >
            {t("create.video.common.deleteScene")}
          </button>
        </div>
      </div>
    </div>
  );
}
