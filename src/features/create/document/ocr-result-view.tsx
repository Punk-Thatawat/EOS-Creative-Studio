"use client";

import { Check, Copy, Download, FileText } from "lucide-react";
import { Fragment, useState } from "react";
import type { DocumentOcrResult, OcrOutputFormat } from "@/lib/api/document-ocr";
import type { Locale, TranslationKey } from "@/lib/i18n/dictionary";
import { useLocale } from "@/lib/i18n/locale-provider";
import { downloadGeneratedFile, downloadOcrResult, ocrResultToText } from "./ocr-download";
import { fieldLabel } from "./ocr-field-labels";
import { formatPrimitive, isEmpty, isRecord } from "./ocr-format";
import styles from "./document-generation-page.module.css";

const K = (key: string) => `create.document.${key}` as TranslationKey;

function confidenceTone(score: number): string {
  if (score >= 0.9) return styles.ocrConfidenceHigh;
  if (score >= 0.7) return styles.ocrConfidenceMid;
  return styles.ocrConfidenceLow;
}

function ConfidenceBadge({ score, label }: { score: unknown; label: string }) {
  if (typeof score !== "number" || !Number.isFinite(score)) return null;
  return <span className={`${styles.ocrConfidence} ${confidenceTone(score)}`} title={label}>{Math.round(score * 100)}%</span>;
}

/** A list of short items reads best as chips; sentences read best as bullets. */
const SHORT_ITEM = 40;
/** A table only works when every cell is short; anything longer is shown as one card per row. */
const SHORT_CELL = 40;

function isPlain(value: unknown): boolean {
  return !isRecord(value) && !Array.isArray(value);
}

function isPlainList(value: unknown): value is unknown[] {
  return Array.isArray(value) && value.length > 0 && value.every(isPlain);
}

function plainLength(value: unknown): number {
  return typeof value === "string" ? value.length : String(value ?? "").length;
}

/** Fields shown together in one summary card: single values and short lists. Everything else gets its own card. */
function isSimpleValue(value: unknown): boolean {
  if (isEmpty(value) || isPlain(value)) return true;
  return isPlainList(value) && value.length <= 3 && value.every((item) => plainLength(item) <= SHORT_ITEM);
}

function RecordFields({ value, locale }: { value: Record<string, unknown>; locale: Locale }) {
  return (
    <dl className={styles.ocrDl}>
      {Object.entries(value).map(([key, child]) => {
        // Nested objects and long lists take the full width under their label, so every level keeps its room
        // instead of squeezing the next one into a sliver.
        const full = !isSimpleValue(child);
        return (
          <Fragment key={key}>
            <dt className={full ? styles.ocrFull : undefined}>{fieldLabel(key, locale)}</dt>
            <dd className={full ? styles.ocrFull : undefined}><FieldValue name={key} value={child} locale={locale} /></dd>
          </Fragment>
        );
      })}
    </dl>
  );
}

function FieldValue({ name, value, locale }: { name: string; value: unknown; locale: Locale }) {
  if (isEmpty(value)) return <span className={styles.ocrEmpty}>—</span>;

  if (Array.isArray(value)) {
    if (isPlainList(value)) {
      const short = value.every((item) => plainLength(item) <= SHORT_ITEM);
      return short
        ? <ul className={styles.ocrList}>{value.map((item, index) => <li key={`${index}-${String(item)}`}>{formatPrimitive(item, name, locale)}</li>)}</ul>
        : <ul className={styles.ocrBullets}>{value.map((item, index) => <li key={`${index}-${String(item)}`}>{formatPrimitive(item, name, locale)}</li>)}</ul>;
    }
    if (value.every(isRecord)) {
      const columns = [...new Set(value.flatMap((row) => Object.keys(row)))];
      const tabular = columns.length <= 6 && value.every((row) => columns.every((column) => {
        const cell = row[column];
        return isEmpty(cell) || (isPlain(cell) && plainLength(cell) <= SHORT_CELL);
      }));
      if (tabular) {
        return (
          <div className={styles.ocrTableWrap}>
            <table className={styles.ocrTable}>
              <thead><tr>{columns.map((column) => <th key={column}>{fieldLabel(column, locale)}</th>)}</tr></thead>
              <tbody>
                {value.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {columns.map((column) => <td key={column}>{formatPrimitive(row[column], column, locale)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      return (
        <div className={styles.ocrItems}>
          {value.map((row, rowIndex) => (
            <article className={styles.ocrItem} key={rowIndex}><RecordFields value={row} locale={locale} /></article>
          ))}
        </div>
      );
    }
    return <div className={styles.ocrItems}>{value.map((item, index) => <FieldValue key={index} name={name} value={item} locale={locale} />)}</div>;
  }

  if (isRecord(value)) return <div className={styles.ocrIndent}><RecordFields value={value} locale={locale} /></div>;
  return <span className={styles.ocrValue}>{formatPrimitive(value, name, locale)}</span>;
}

export function OcrResultView({ result, fileName, showConfidence, exportFormat, showStyled, onShowStyledChange }: {
  result: DocumentOcrResult;
  fileName: string;
  showConfidence: boolean;
  exportFormat: OcrOutputFormat;
  showStyled: boolean;
  onShowStyledChange: (value: boolean) => void;
}) {
  const { locale, t } = useLocale();
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportFailed, setExportFailed] = useState(false);
  const styledAvailable = !!result.styledText?.length;
  const preferStyled = styledAvailable && showStyled;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(ocrResultToText(result, locale, t, preferStyled));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const download = async () => {
    // Word and PDF are drawn by the backend from a labelled outline of the result; nothing is charged for them.
    setExporting(true);
    setExportFailed(false);
    try {
      await downloadOcrResult({ result, fileName, format: exportFormat, preferStyled, locale, t });
    } catch {
      setExportFailed(true);
    } finally {
      setExporting(false);
    }
  };
  const exportLabel = { txt: K("ocr.exportTxt"), json: K("ocr.exportJson"), docx: K("ocr.exportDocx"), pdf: K("ocr.exportPdf") }[exportFormat];

  return (
    <div className={styles.ocrResult}>
      {result.file ? (
        <section className={`${styles.ocrCard} ${styles.ocrFileCard}`}>
          <FileText size={28} aria-hidden="true" />
          <div>
            <strong>{result.file.filename}</strong>
            <span>{t(K("ocr.fileReady"))}</span>
          </div>
          <button type="button" onClick={() => downloadGeneratedFile(result.file!)}>
            <Download size={14} aria-hidden="true" />{t(K("ocr.download"))}
          </button>
        </section>
      ) : null}
      {!result.file && <div className={styles.ocrResultBar}>
        <strong>{t(K(`ocr.type.${result.documentType}`))}</strong>
        <div className={styles.ocrActions}>
          <button type="button" onClick={() => void copy()}>
            {copied ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
            {copied ? t(K("ocr.copied")) : t(K("ocr.copy"))}
          </button>
          <button type="button" disabled={exporting} onClick={() => void download()}>
            <Download size={13} aria-hidden="true" />{exporting ? t(K("ocr.exporting")) : t(exportLabel)}
          </button>
        </div>
      </div>}

      {exportFailed && <div className={styles.ocrNotice} role="alert">{t(K("ocr.exportFailed"))}</div>}
      {result.styleFailed && <div className={styles.ocrNotice} role="status">{t(K("ocr.styleFailed"))}</div>}
      {styledAvailable && (
        <div className={styles.ocrTabs} role="tablist">
          <button type="button" role="tab" aria-selected={showStyled} className={showStyled ? styles.ocrTabActive : ""} onClick={() => onShowStyledChange(true)}>{t(K("ocr.styledTab"))}</button>
          <button type="button" role="tab" aria-selected={!showStyled} className={!showStyled ? styles.ocrTabActive : ""} onClick={() => onShowStyledChange(false)}>{t(K("ocr.originalTab"))}</button>
        </div>
      )}

      {result.layout && result.layout.length > 0 ? (
        result.layout.map((page) => (
          <section className={styles.ocrCard} key={page.page}>
            <h4>{t(K("ocr.pageN"), { n: page.page })}</h4>
            <ol className={styles.ocrBlocks}>
              {page.components.map((component, index) => (
                <li key={`${index}-${component.box.top}-${component.box.left}`}>
                  <span className={styles.ocrBlockType}>{component.type}</span>
                  <pre className={styles.ocrText}>{component.text}</pre>
                </li>
              ))}
            </ol>
          </section>
        ))
      ) : result.text.length > 0 ? (
        (preferStyled ? result.styledText ?? result.text : result.text).map((page, index, pages) => (
          <section className={styles.ocrCard} key={index}>
            {pages.length > 1 && <h4>{t(K("ocr.pageN"), { n: index + 1 })}</h4>}
            <pre className={styles.ocrText}>{page}</pre>
          </section>
        ))
      ) : (
        result.documents.map((doc, index) => {
          const entries = Object.entries(doc.fields);
          // Fields iApp found nothing for are listed in one line at the end instead of taking up rows and cards.
          const missing = entries.filter(([, value]) => isEmpty(value));
          const present = entries.filter(([, value]) => !isEmpty(value));
          const simple = present.filter(([, value]) => isSimpleValue(value));
          const sections = present.filter(([, value]) => !isSimpleValue(value));
          const badge = (key: string) => (showConfidence ? <ConfidenceBadge score={doc.confidence?.[key]} label={t(K("ocr.confidenceLabel"))} /> : null);
          return (
            <Fragment key={index}>
              {result.documents.length > 1 && <h4 className={styles.ocrDocumentHeading}>{t(K("ocr.documentN"), { n: index + 1 })}</h4>}
              {simple.length > 0 && (
                <section className={styles.ocrCard}>
                  <dl className={styles.ocrFields}>
                    {simple.map(([key, value]) => (
                      <Fragment key={key}>
                        <dt>{fieldLabel(key, locale)}{badge(key)}</dt>
                        <dd><FieldValue name={key} value={value} locale={locale} /></dd>
                      </Fragment>
                    ))}
                  </dl>
                </section>
              )}
              {sections.map(([key, value]) => (
                <section className={styles.ocrCard} key={key}>
                  <h4 className={styles.ocrSectionTitle}>{fieldLabel(key, locale)}{badge(key)}</h4>
                  <FieldValue name={key} value={value} locale={locale} />
                </section>
              ))}
              {missing.length > 0 && <p className={styles.ocrMissing}>{t(K("ocr.notFound"), { fields: missing.map(([key]) => fieldLabel(key, locale)).join(", ") })}</p>}
              {doc.raw !== undefined && doc.raw !== null && (
                <details className={`${styles.ocrCard} ${styles.ocrRaw}`}>
                  <summary>{t(K("ocr.rawText"))}</summary>
                  <pre>{typeof doc.raw === "string" ? doc.raw : JSON.stringify(doc.raw, null, 2)}</pre>
                </details>
              )}
            </Fragment>
          );
        })
      )}
    </div>
  );
}
