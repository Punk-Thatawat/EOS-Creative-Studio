"use client";

import { LocateFixed, PenLine } from "lucide-react";
import { useState } from "react";
import type { FormField } from "@/lib/api/document-form";
import type { TranslationKey } from "@/lib/i18n/dictionary";
import { useLocale } from "@/lib/i18n/locale-provider";
import { LOW_CONFIDENCE } from "./form-export";
import styles from "./form-results-view.module.css";

const K = (key: string) => `create.document.${key}` as TranslationKey;

type ResultsLayout = "form" | "list";

/**
 * The fields read from a form, each with its value to correct and how sure the AI was. They are laid out like a form
 * (a sheet of fields, boxes to tick, a box to sign) or as a plain list, whichever the person prefers. A number that
 * matches the box on the form can be clicked to jump to it (when the form is still on screen).
 */
export function FormResultsView({
  fields,
  selectedId,
  onSelect,
  onChange,
  onLocate,
  title,
}: {
  fields: FormField[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onChange: (id: string, value: string) => void;
  /** Present only while the form itself is on screen. */
  onLocate?: (id: string) => void;
  /** Printed at the top of the sheet: the form's file name. */
  title?: string;
}) {
  const { t } = useLocale();
  const [layout, setLayout] = useState<ResultsLayout>("form");
  const toCheck = fields.filter((field) => field.confidence < LOW_CONFIDENCE).length;

  if (!fields.length) return <p className={styles.empty}>{t(K("form.results.empty"))}</p>;

  const number = (field: FormField, index: number) => {
    const placed = field.boxes.length > 0 && !!onLocate;
    return placed ? (
      <button type="button" className={styles.number} title={t(K("form.results.locate"))} aria-label={`${t(K("form.results.locate"))}: ${field.label}`} onClick={(event) => { event.stopPropagation(); onLocate?.(field.id); }}>
        {index + 1}
      </button>
    ) : (
      <span className={styles.number} aria-hidden="true">{index + 1}</span>
    );
  };
  const pill = (field: FormField) => {
    const low = field.confidence < LOW_CONFIDENCE;
    return (
      <span className={`${styles.pill} ${low ? styles.warn : styles.ok}`} title={t(K("form.results.confidence"))}>
        {Math.round(field.confidence * 100)}%{low ? ` ${t(K("form.confidence.check"))}` : ""}
      </span>
    );
  };

  return (
    <div className={styles.view}>
      <div className={styles.summary}>
        <span>{t(K("form.results.summary"), { total: fields.length })}</span>
        {toCheck > 0 && <span className={styles.toCheck}>{t(K("form.results.check"), { n: toCheck })}</span>}
        <div className={styles.layoutSwitch} role="group" aria-label={t(K("form.results.layout"))}>
          {(["form", "list"] as const).map((value) => (
            <button key={value} type="button" aria-pressed={layout === value} className={layout === value ? styles.layoutOn : undefined} onClick={() => setLayout(value)}>
              {t(K(`form.results.layout.${value}`))}
            </button>
          ))}
        </div>
      </div>

      {layout === "list" ? (
        <ol className={styles.list}>
          {fields.map((field, index) => {
            const placed = field.boxes.length > 0 && !!onLocate;
            return (
              <li key={field.id} className={`${styles.row} ${selectedId === field.id ? styles.rowSelected : ""}`} onClick={() => onSelect(field.id)}>
                {number(field, index)}
                <label className={styles.body}>
                  <span className={styles.label}>{field.label}</span>
                  <input className={styles.input} value={field.value} placeholder="—" aria-label={field.label} onFocus={() => onSelect(field.id)} onChange={(event) => onChange(field.id, event.target.value)} />
                </label>
                {pill(field)}
                {placed && <LocateFixed className={styles.locateIcon} size={14} aria-hidden="true" />}
              </li>
            );
          })}
        </ol>
      ) : (
        <div className={styles.sheet}>
          {title && <h4 className={styles.sheetTitle}>{title}</h4>}
          <div className={styles.sheetGrid}>
            {fields.map((field, index) => {
              const low = field.confidence < LOW_CONFIDENCE;
              const ticked = field.value.trim() !== "";
              const edit = (className: string) => (
                <input className={className} value={field.value} placeholder="—" aria-label={field.label} onFocus={() => onSelect(field.id)} onChange={(event) => onChange(field.id, event.target.value)} />
              );
              // Plain fields can hold a sentence, so they wrap onto more lines; the short ones (a tick, a signature) stay a single line.
              const editText = (
                <div className={styles.lineBox} data-value={field.value}>
                  <textarea className={styles.line} rows={1} value={field.value} placeholder="—" aria-label={field.label} onFocus={() => onSelect(field.id)} onChange={(event) => onChange(field.id, event.target.value)} />
                </div>
              );
              return (
                <div key={field.id} className={`${styles.cell} ${field.type === "signature" ? styles.cellWide : ""} ${low ? styles.cellLow : ""} ${selectedId === field.id ? styles.cellSelected : ""}`} onClick={() => onSelect(field.id)}>
                  <div className={styles.cellHead}>
                    {number(field, index)}
                    <span className={styles.cellLabel}>{field.label}</span>
                    {pill(field)}
                  </div>
                  {field.type === "checkbox" ? (
                    <div className={styles.checkRow}>
                      <button type="button" role="checkbox" aria-checked={ticked} aria-label={field.label} className={`${styles.checkBox} ${ticked ? styles.checkBoxOn : ""}`} onClick={() => { onSelect(field.id); onChange(field.id, ticked ? "" : "✓"); }}>
                        {ticked ? "✓" : ""}
                      </button>
                      {edit(styles.line)}
                    </div>
                  ) : field.type === "signature" ? (
                    <div className={styles.signBox}>
                      <PenLine size={14} aria-hidden="true" />
                      {edit(styles.signInput)}
                    </div>
                  ) : (
                    editText
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
      {onLocate && <p className={styles.hint}>{t(K("form.results.hint"))}</p>}
    </div>
  );
}
