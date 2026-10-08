"use client";

import { Clock, Download, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import {
  clearDocumentOcrHistory,
  deleteDocumentOcrHistoryItem,
  getDocumentOcrHistory,
  listDocumentOcrHistory,
  type DocumentOcrResult,
  type OcrHistoryItem,
  type OcrHistoryPage,
  type OcrOutputFormat,
} from "@/lib/api/document-ocr";
import type { TranslationKey } from "@/lib/i18n/dictionary";
import { useLocale } from "@/lib/i18n/locale-provider";
import { downloadOcrResult } from "./ocr-download";
import { OCR_DOCUMENT_TYPE_OPTIONS } from "./ocr-document-types";
import styles from "./document-generation-page.module.css";

const K = (key: string) => `create.document.${key}` as TranslationKey;
const PAGE_SIZE = 20;
const DOWNLOAD_FORMATS: ReadonlyArray<{ id: OcrOutputFormat; label: string }> = [
  { id: "docx", label: "DOCX" },
  { id: "pdf", label: "PDF" },
  { id: "txt", label: "TXT" },
  { id: "json", label: "JSON" },
];

/**
 * Every document the user has read with Gen Document, all 13 types together, newest first and not split by type. Only
 * extracted results are kept (never the file), they expire on their own, and a result can be reopened here or deleted.
 */
export function OcrHistoryPanel({ refreshKey, onOpen }: { refreshKey: number; onOpen: (result: DocumentOcrResult, item: OcrHistoryItem) => void }) {
  const { locale, t } = useLocale();
  const [page, setPage] = useState<OcrHistoryPage | null>(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | "all" | null>(null);
  const [downloadFor, setDownloadFor] = useState<string | null>(null);

  // (Re)load the first page whenever the panel opens or a new document has just been saved.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const first = await listDocumentOcrHistory({ limit: PAGE_SIZE, offset: 0 });
        if (cancelled) return;
        setPage(first);
        setError("");
      } catch {
        if (!cancelled) setError(t(K("ocr.history.loadFailed")));
      }
    })();
    return () => { cancelled = true; };
    // `t` only changes with the language; the list itself must not reload for that.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const loadMore = async () => {
    if (!page) return;
    try {
      const next = await listDocumentOcrHistory({ limit: PAGE_SIZE, offset: page.items.length });
      setPage({ ...next, items: [...page.items, ...next.items] });
    } catch {
      setError(t(K("ocr.history.loadFailed")));
    }
  };

  const open = async (item: OcrHistoryItem) => {
    if (busyId) return;
    setBusyId(item.id);
    setError("");
    try {
      const { result } = await getDocumentOcrHistory(item.id);
      onOpen(result, item);
    } catch {
      setError(t(K("ocr.history.openFailed")));
    } finally {
      setBusyId(null);
    }
  };

  /**
   * Saves a past result in the chosen format. The file iApp once produced is not kept, so Word / PDF are drawn again
   * from the stored result (free), exactly like the Export button on a fresh result.
   */
  const download = async (item: OcrHistoryItem, format: OcrOutputFormat) => {
    if (busyId) return;
    setDownloadFor(null);
    setBusyId(item.id);
    setError("");
    try {
      const { result: stored } = await getDocumentOcrHistory(item.id);
      const result = { ...stored };
      delete result.file;
      await downloadOcrResult({ result, fileName: item.fileName, format, preferStyled: !!result.styledText?.length, locale, t });
    } catch {
      setError(t(K("ocr.exportFailed")));
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (item: OcrHistoryItem) => {
    setBusyId(item.id);
    setConfirming(null);
    try {
      await deleteDocumentOcrHistoryItem(item.id);
      setPage((current) => (current ? { ...current, items: current.items.filter((entry) => entry.id !== item.id), total: Math.max(0, current.total - 1) } : current));
    } catch {
      setError(t(K("ocr.history.deleteFailed")));
    } finally {
      setBusyId(null);
    }
  };

  const clearAll = async () => {
    setConfirming(null);
    try {
      await clearDocumentOcrHistory();
      setPage((current) => (current ? { ...current, items: [], total: 0 } : current));
    } catch {
      setError(t(K("ocr.history.deleteFailed")));
    }
  };

  const date = (value: string) => new Date(value).toLocaleString(locale === "th" ? "th-TH" : "en-US", { dateStyle: "medium", timeStyle: "short" });

  if (!page && !error) return <p className={styles.ocrMissing} role="status">{t(K("ocr.history.loading"))}</p>;

  return (
    <div className={styles.ocrResult}>
      <div className={styles.ocrHistoryBar}>
        <span>{page ? t(K("ocr.history.summary"), { total: page.total, days: page.retentionDays }) : ""}</span>
        {page && page.total > 0 && (
          confirming === "all" ? (
            <span className={styles.ocrHistoryConfirm}>
              {t(K("ocr.history.confirmClear"), { total: page.total })}
              <button type="button" onClick={() => void clearAll()}>{t(K("ocr.history.confirm"))}</button>
              <button type="button" onClick={() => setConfirming(null)}>{t(K("ocr.history.cancel"))}</button>
            </span>
          ) : (
            <button type="button" className={styles.ocrHistoryClear} onClick={() => setConfirming("all")}>{t(K("ocr.history.clearAll"))}</button>
          )
        )}
      </div>
      <p className={styles.ocrRawHint}>{t(K("ocr.history.privacy"))}</p>
      {error && <div className={styles.ocrNotice} role="alert">{error}</div>}

      {page && page.items.length === 0 && !error && <p className={styles.ocrMissing}>{t(K("ocr.history.empty"))}</p>}

      <ul className={styles.ocrHistoryList}>
        {page?.items.map((item) => {
          const Icon = OCR_DOCUMENT_TYPE_OPTIONS.find((option) => option.id === item.documentType)?.icon ?? Clock;
          const meta = [
            t(K(`ocr.type.${item.documentType}`)),
            t(K("ocr.history.pages"), { n: item.pages }),
            ...(item.fieldCount !== undefined ? [t(K("ocr.history.fields"), { n: item.fieldCount })] : []),
            t(K("ocr.history.credits"), { n: item.creditsUsed }),
          ].join(" · ");
          return (
            <li key={item.id} className={styles.ocrHistoryItem}>
              <button type="button" className={styles.ocrHistoryOpen} disabled={busyId === item.id} onClick={() => void open(item)} title={t(K("ocr.history.open"))}>
                <span className={styles.ocrHistoryIcon}><Icon size={18} aria-hidden="true" /></span>
                <span className={styles.ocrHistoryText}>
                  <strong>{item.fileName}</strong>
                  <small>{meta}</small>
                  <small>{date(item.createdAt)} · {t(K("ocr.history.expires"), { date: date(item.expiresAt) })}</small>
                </span>
              </button>
              {confirming === item.id ? (
                <span className={styles.ocrHistoryConfirm}>
                  <button type="button" onClick={() => void remove(item)}>{t(K("ocr.history.confirm"))}</button>
                  <button type="button" onClick={() => setConfirming(null)}>{t(K("ocr.history.cancel"))}</button>
                </span>
              ) : downloadFor === item.id ? (
                <span className={styles.ocrHistoryFormats}>
                  {t(K("ocr.history.downloadAs"))}
                  {DOWNLOAD_FORMATS.map((format) => (
                    <button key={format.id} type="button" onClick={() => void download(item, format.id)}>{format.label}</button>
                  ))}
                  <button type="button" aria-label={t(K("ocr.history.cancel"))} onClick={() => setDownloadFor(null)}>×</button>
                </span>
              ) : (
                <span className={styles.ocrHistoryActions}>
                  <button type="button" className={styles.ocrHistoryDownload} aria-label={t(K("ocr.history.download"))} title={t(K("ocr.history.download"))} disabled={busyId === item.id} onClick={() => setDownloadFor(item.id)}>
                    <Download size={15} aria-hidden="true" />
                  </button>
                  <button type="button" className={styles.ocrHistoryDelete} aria-label={t(K("ocr.history.delete"))} title={t(K("ocr.history.delete"))} disabled={busyId === item.id} onClick={() => setConfirming(item.id)}>
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                </span>
              )}
            </li>
          );
        })}
      </ul>

      {page && page.items.length < page.total && (
        <button type="button" className={styles.ocrHistoryMore} onClick={() => void loadMore()}>{t(K("ocr.history.loadMore"))}</button>
      )}
    </div>
  );
}
