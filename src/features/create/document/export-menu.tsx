"use client";

import { Download, FileText } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { OcrOutputFormat } from "@/lib/api/document-ocr";
import type { TranslationKey } from "@/lib/i18n/dictionary";
import { useLocale } from "@/lib/i18n/locale-provider";
import styles from "./document-feature-generation-page.module.css";

const K = (key: string) => `create.document.${key}` as TranslationKey;
const DEFAULT_FORMATS: ReadonlyArray<{ id: OcrOutputFormat; label: string }> = [
  { id: "docx", label: "DOCX" },
  { id: "pdf", label: "PDF" },
  { id: "txt", label: "TXT" },
  { id: "json", label: "JSON" },
];

/**
 * The "Export" button of the preview toolbar: always clickable, it opens an "Export as" menu with one card per file
 * format. What a card does is up to the caller (download a result, or remember the choice before there is one).
 */
export function ExportMenu<F extends string = OcrOutputFormat>({
  hasResult,
  busy,
  active,
  isUnavailable,
  hint,
  onPick,
  formats = DEFAULT_FORMATS as unknown as ReadonlyArray<{ id: F; label: string }>,
}: {
  hasResult: boolean;
  busy: boolean;
  /** The format to highlight, if the menu is also a way of choosing one. */
  active?: F;
  isUnavailable?: (format: F) => boolean;
  /** Explains what the menu can do while there is nothing to export yet. */
  hint: string;
  onPick: (format: F) => void;
  /** The cards to offer; DOCX, PDF, TXT and JSON unless a tool exports something else too. */
  formats?: ReadonlyArray<{ id: F; label: string }>;
}) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: Event) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <span className={styles.exportMenuWrap} ref={ref}>
      <button
        type="button"
        className={`${styles.toolbarButton} ${open ? styles.toolbarButtonActive : ""}`}
        aria-label={t(K("preview.export"))}
        aria-haspopup="menu"
        aria-expanded={open}
        title={hasResult ? t(K("ocr.tool.exportHint")) : t(K("ocr.tool.needResult"))}
        disabled={busy}
        onClick={() => setOpen((value) => !value)}
      >
        <Download size={13} aria-hidden="true" />
        <span className={styles.toolbarLabel}>{busy ? t(K("ocr.exporting")) : t(K("preview.export"))}</span>
      </button>
      {open && (
        <div className={styles.exportMenu} role="menu" aria-label={t(K("ocr.exportAs"))}>
          <small>{t(K("ocr.exportAs"))}</small>
          <div className={styles.exportChoices}>
            {formats.map((format) => (
              <button
                key={format.id}
                type="button"
                role="menuitemradio"
                aria-checked={active === format.id}
                disabled={isUnavailable?.(format.id) ?? false}
                className={`${styles.formatCard} ${styles.formatButton} ${active === format.id ? styles.formatCardActive : ""}`}
                title={t(K(`ocr.exportAs.${format.id}`))}
                onClick={() => {
                  setOpen(false);
                  onPick(format.id);
                }}
              >
                <FileText size={18} aria-hidden="true" />
                <span>{format.label}</span>
              </button>
            ))}
          </div>
          {!hasResult && (
            <p className={styles.exportMenuHint} role="status">
              {hint}
            </p>
          )}
        </div>
      )}
    </span>
  );
}
