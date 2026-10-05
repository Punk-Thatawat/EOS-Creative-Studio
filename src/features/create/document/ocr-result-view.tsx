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

function FieldValue({ name, value, locale }: { name: string; value: unknown; locale: Locale }) {
  if (isEmpty(value)) return <span className={styles.ocrEmpty}>—</span>;
  if (Array.isArray(value)) {
    if (value.every((item) => !isRecord(item) && !Array.isArray(item))) {
      return <ul className={styles.ocrList}>{value.map((item, index) => <li key={`${index}-${String(item)}`}>{formatPrimitive(item, name, locale)}</li>)}</ul>;
    }
    if (value.every(isRecord)) {
      const columns = [...new Set(value.flatMap((row) => Object.keys(row)))];
      return (
        <div className={styles.ocrTableWrap}>
          <table className={styles.ocrTable}>
            <thead><tr>{columns.map((column) => <th key={column}>{fieldLabel(column, locale)}</th>)}</tr></thead>
            <tbody>
              {value.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {columns.map((column) => <td key={column}><FieldValue name={column} value={row[column]} locale={locale} /></td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    return <div className={styles.ocrNested}>{value.map((item, index) => <FieldValue key={index} name={name} value={item} locale={locale} />)}</div>;
  }
  if (isRecord(value)) {
    return (
      <dl className={styles.ocrNested}>
        {Object.entries(value).map(([key, child]) => (
          <Fragment key={key}>
            <dt>{fieldLabel(key, locale)}</dt>
            <dd><FieldValue name={key} value={child} locale={locale} /></dd>
          </Fragment>
        ))}
      </dl>
    );
  }
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
        result.documents.map((doc, index) => (
          <section className={styles.ocrCard} key={index}>
            {result.documents.length > 1 && <h4>{t(K("ocr.documentN"), { n: index + 1 })}</h4>}
            <dl className={styles.ocrFields}>
              {Object.entries(doc.fields).map(([key, value]) => (
                <Fragment key={key}>
                  <dt>
                    {fieldLabel(key, locale)}
                    {showConfidence && <ConfidenceBadge score={doc.confidence?.[key]} label={t(K("ocr.confidenceLabel"))} />}
                  </dt>
                  <dd><FieldValue name={key} value={value} locale={locale} /></dd>
                </Fragment>
              ))}
            </dl>
            {doc.raw !== undefined && doc.raw !== null && (
              <details className={styles.ocrRaw}>
                <summary>{t(K("ocr.rawText"))}</summary>
                <pre>{typeof doc.raw === "string" ? doc.raw : JSON.stringify(doc.raw, null, 2)}</pre>
              </details>
            )}
          </section>
        ))
      )}
    </div>
  );
}
