import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import styles from "./creator-workspace-layout.module.css";

type CreatorWorkspaceLayoutProps = {
  tabs: ReactNode;
  mobileTabs?: ReactNode;
  notice?: ReactNode;
  left?: ReactNode;
  preview?: ReactNode;
  right?: ReactNode;
  content?: ReactNode;
  className?: string;
};

/** Shared shell for the Image, Video, and Audio creation workspaces. */
export function CreatorWorkspaceLayout({
  tabs,
  mobileTabs,
  notice,
  left,
  preview,
  right,
  content,
  className,
}: CreatorWorkspaceLayoutProps) {
  const hasColumns = left !== undefined || preview !== undefined || right !== undefined;

  return (
    <section className={cn(styles.shell, className)}>
      {notice ? <div className={styles.notice}>{notice}</div> : null}
      <div className={styles.tabs}>{tabs}</div>
      {mobileTabs ? <div className={styles.mobileTabs}>{mobileTabs}</div> : null}
      {hasColumns ? (
        <div className={styles.columns}>
          <aside className={styles.left}>{left}</aside>
          <main className={styles.preview}>{preview}</main>
          <aside className={styles.right}>{right}</aside>
        </div>
      ) : (
        <div className={styles.content}>{content}</div>
      )}
    </section>
  );
}
