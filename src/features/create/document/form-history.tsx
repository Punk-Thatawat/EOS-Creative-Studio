"use client";

import { ClipboardList, Download, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import {
  clearFormHistory,
  deleteFormHistoryItem,
  getFormHistory,
  listFormHistory,
  type FormHistoryItem,
  type FormHistoryPage,
  type FormReadResult,
} from "@/lib/api/document-form";
import type { TranslationKey } from "@/lib/i18n/dictionary";
import { useLocale } from "@/lib/i18n/locale-provider";
import { downloadFormResult, type FormExportFormat } from "./form-export";
import styles from "./document-feature-generation-page.module.css";

const K = (key: string) => `create.document.${key}` as TranslationKey;
const PAGE_SIZE = 20;
const DOWNLOAD_FORMATS: ReadonlyArray<{ id: FormExportFormat; label: string }> = [
  { id: "docx", label: "DOCX" },
  { id: "pdf", label: "PDF" },
  { id: "csv", label: "CSV" },
  { id: "txt", label: "TXT" },
  { id: "json", label: "JSON" },
];

/**
 * Every form the user has had read, newest first. Only the fields are kept, unless the changes were saved, which keeps the
 * pages and marks too. They expire on their own, and a reading can be reopened here, downloaded again, or deleted for good.
 */
export function FormHistoryPanel({ refreshKey, onOpen }: { refreshKey: number; onOpen: (result: FormReadResult, item: FormHistoryItem) => void | Promise<void> }) {
  const { locale, t } = useLocale();
  const [page, setPage] = useState<FormHistoryPage | null>(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | "all" | null>(null);
  const [downloadFor, setDownloadFor] = useState<string | null>(null);

  // (Re)load the first page whenever the panel opens or a new form has just been read.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const first = await listFormHistory({ limit: PAGE_SIZE, offset: 0 });
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
      const next = await listFormHistory({ limit: PAGE_SIZE, offset: page.items.length });
      setPage({ ...next, items: [...page.items, ...next.items] });
    } catch {
      setError(t(K("ocr.history.loadFailed")));
    }
  };

  const open = async (item: FormHistoryItem) => {
    if (busyId) return;
    setBusyId(item.id);
    setError("");
    try {
      const { result } = await getFormHistory(item.id);
      await onOpen(result, item);
    } catch {
      setError(t(K("ocr.history.openFailed")));
    } finally {
      setBusyId(null);
    }
  };

  /** The saved fields are drawn again in the chosen format; nothing is read again and no credits are spent. */
  const download = async (item: FormHistoryItem, format: FormExportFormat) => {
    if (busyId) return;
    setDownloadFor(null);
    setBusyId(item.id);
    setError("");
    try {
      const { result } = await getFormHistory(item.id);
      await downloadFormResult({ fields: result.fields, fileName: item.fileName, format, t });
    } catch {
      setError(t(K("ocr.exportFailed")));
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (item: FormHistoryItem) => {
    setBusyId(item.id);
    setConfirming(null);
    try {
      await deleteFormHistoryItem(item.id);
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
      await clearFormHistory();
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
      <p className={styles.ocrRawHint}>{t(K("form.history.privacy"))}</p>
      {error && <div className={styles.ocrNotice} role="alert">{error}</div>}

      {page && page.items.length === 0 && !error && <p className={styles.ocrMissing}>{t(K("form.history.empty"))}</p>}

      <ul className={styles.ocrHistoryList}>
        {page?.items.map((item) => {
          const meta = [
            t(K("ocr.history.pages"), { n: item.pages }),
            t(K("form.history.fields"), { n: item.fieldCount }),
            ...(item.lowConfidenceCount > 0 ? [t(K("form.history.toCheck"), { n: item.lowConfidenceCount })] : []),
            t(K("ocr.history.credits"), { n: item.creditsUsed }),
            ...(item.hasDocument ? [t(K("form.history.saved"))] : []),
          ].join(" · ");
          return (
            <li key={item.id} className={styles.ocrHistoryItem}>
              <button type="button" className={styles.ocrHistoryOpen} disabled={busyId === item.id} onClick={() => void open(item)} title={t(K("form.history.open"))}>
                <span className={styles.ocrHistoryIcon}><ClipboardList size={18} aria-hidden="true" /></span>
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
