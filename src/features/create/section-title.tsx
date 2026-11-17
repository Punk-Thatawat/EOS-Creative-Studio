import { type ReactNode } from "react";
import styles from "./video-generation-page.module.css";

export function SectionTitle({
  number,
  children,
  action,
}: {
  number?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className={styles.sectionTitle}>
      <h2>
        {number ? `${number}. ` : ""}
        {children}
      </h2>
      {action}
    </div>
  );
}
