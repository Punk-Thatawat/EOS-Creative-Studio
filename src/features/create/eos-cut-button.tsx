import { ArrowUpRight, Scissors } from "lucide-react";
import styles from "./video-generation-page.module.css";

/** The generation ID is the sourceGenerationId used by EOS CUT's import contract. */
export function EosCutButton({ sourceGenerationId }: { sourceGenerationId?: string | null }) {
  const href = sourceGenerationId
    ? `https://cut.eoslabs.tech/projects?importSceneSet=${encodeURIComponent(sourceGenerationId)}`
    : "https://cut.eoslabs.tech/projects";

  return (
    <div className={styles.videoPreviewActions}>
      <a href={href} target="_blank" rel="noopener noreferrer" className={styles.editInEosCutButton}
        title={sourceGenerationId ? "นำเข้าผลงานใน EOS CUT (เปิดแท็บใหม่)" : "เปิดหน้าโปรเจกต์ EOS CUT (เปิดแท็บใหม่ ยังไม่นำเข้าวิดีโออัตโนมัติ)"}>
        <span className={styles.eosCutIcon}><Scissors size={17} aria-hidden="true" /></span>
        <span>แก้ไขใน EOS CUT</span>
        <ArrowUpRight size={17} aria-hidden="true" />
      </a>
    </div>
  );
}
