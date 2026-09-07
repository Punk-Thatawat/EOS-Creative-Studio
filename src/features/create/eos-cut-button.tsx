import { ArrowUpRight, Scissors } from "lucide-react";
import styles from "./video-generation-page.module.css";

/** Only storyboard IDs are supported by the scene-set import contract. */
export function EosCutButton({ storyboardId }: { storyboardId?: string | null }) {
  const href = storyboardId
    ? `https://cut.eoslabs.tech/projects?importSceneSet=${encodeURIComponent(storyboardId)}`
    : "https://cut.eoslabs.tech/projects";

  return (
    <div className={styles.videoPreviewActions}>
      <a href={href} target="_blank" rel="noopener noreferrer" className={styles.editInEosCutButton}
        title={storyboardId ? "นำเข้าผลงานใน EOS CUT (เปิดแท็บใหม่)" : "เปิดหน้าโปรเจกต์ EOS CUT (เปิดแท็บใหม่ ยังไม่นำเข้าวิดีโออัตโนมัติ)"}>
        <span className={styles.eosCutIcon}><Scissors size={17} aria-hidden="true" /></span>
        <span>แก้ไขใน EOS CUT</span>
        <ArrowUpRight size={17} aria-hidden="true" />
      </a>
    </div>
  );
}
