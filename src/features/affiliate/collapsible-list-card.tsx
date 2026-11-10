"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useLocale } from "@/lib/i18n/locale-provider";
import styles from "./affiliate-page.module.css";

/**
 * A card that shows its newest row and opens to show all of them. With one row or none there is nothing more to open, so the
 * arrow is left out. `empty` is the line shown when there are no rows.
 */
export function CollapsibleListCard({ icon, title, rows, empty }: { icon: ReactNode; title: string; rows: { key: string; node: ReactNode }[]; empty: string }) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const listId = useId();
  const expandable = rows.length > 1;
  const shown = open ? rows : rows.slice(0, 1);

  return (
    <Card className={`${styles.card} ${styles.collapsible}`}>
      <div className={styles.collapsibleHead}>
        <span className={styles.titleIcon} aria-hidden="true">{icon}</span>
        <h2 className={styles.collapsibleTitle}>{title}</h2>
        {expandable ? (
          <button
            type="button"
            className={`${styles.chevron} ${open ? styles.chevronOpen : ""}`}
            aria-expanded={open}
            aria-controls={listId}
            aria-label={open ? t("affiliate.page.showLess") : t("affiliate.page.showAll", { count: rows.length })}
            onClick={() => setOpen((value) => !value)}
          >
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        ) : null}
      </div>
      {rows.length === 0 ? (
        <p className={styles.collapsibleEmpty}>{empty}</p>
      ) : (
        <ul className={styles.collapsibleList} id={listId}>
          {shown.map((row) => (
            <li key={row.key}>{row.node}</li>
          ))}
        </ul>
      )}
    </Card>
  );
}
