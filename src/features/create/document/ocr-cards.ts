import type { DocumentOcrResult } from "@/lib/api/document-ocr";
import type { Locale, TranslationKey } from "@/lib/i18n/dictionary";
import { fieldLabel, normalizeFieldKey } from "./ocr-field-labels";
import { formatPrimitive, isEmpty, isRecord } from "./ocr-format";

const K = (key: string) => `create.document.${key}` as TranslationKey;

type Translate = (key: TranslationKey, params?: Record<string, string | number>) => string;

export type OcrCard = {
  /** Which card it fills: summary, key fields, tables, translated version, notes. */
  slot: "summary" | "keyFields" | "table" | "translated" | "notes";
  title: string;
  lines: string[];
  /** The card has nothing to report; shown in a quieter colour. */
  muted?: boolean;
};

/** Fields worth surfacing first, in order, whatever the document type calls them. */
const PREFERRED_KEYS = [
  "name", "fullname", "companyname", "issuername", "customername", "provider", "bankname", "jobtitle", "licenseplate",
  "invoicedate", "invoicenumber", "invoiceid", "accountnumber", "documentnumber", "registrationnumber",
  "grandtotal", "totalamount", "totalcurrentbill", "newbalancepayment", "totaltax", "duedate", "email",
];
const MAX_KEY_FIELDS = 4;
const LOW_CONFIDENCE = 0.7;

function topFields(result: DocumentOcrResult): Record<string, unknown> {
  return result.documents[0]?.fields ?? {};
}

function isPlain(value: unknown): boolean {
  return !isRecord(value) && !Array.isArray(value);
}

function keyFieldLines(fields: Record<string, unknown>, locale: Locale): string[] {
  const entries = Object.entries(fields).filter(([, value]) => !isEmpty(value) && isPlain(value));
  const picked: Array<[string, unknown]> = [];
  for (const preferred of PREFERRED_KEYS) {
    const match = entries.find(([key]) => normalizeFieldKey(key) === preferred);
    if (match && !picked.includes(match)) picked.push(match);
  }
  for (const entry of entries) if (picked.length < MAX_KEY_FIELDS && !picked.includes(entry)) picked.push(entry);
  return picked.slice(0, MAX_KEY_FIELDS).map(([key, value]) => `${fieldLabel(key, locale)}: ${formatPrimitive(value, key, locale)}`);
}

/** Every list of records (line items, transactions, education…) found in the fields, with its row count. */
function findTables(value: unknown, label: string, locale: Locale, depth = 0): Array<{ name: string; rows: number }> {
  if (Array.isArray(value) && value.length > 0 && value.every(isRecord)) return [{ name: label, rows: value.length }];
  if (isRecord(value) && depth < 3) {
    return Object.entries(value).flatMap(([key, child]) => findTables(child, fieldLabel(key, locale), locale, depth + 1));
  }
  return [];
}

function averageConfidence(result: DocumentOcrResult): number | undefined {
  const scores = Object.values(result.documents[0]?.confidence ?? {}).filter((score): score is number => typeof score === "number" && score > 0);
  if (!scores.length) return undefined;
  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}

/**
 * The five cards under the preview, filled from the extracted result itself. Nothing here calls an AI: every line
 * is read straight from what OCR returned (or derived from its confidence scores).
 */
export function buildOcrCards(result: DocumentOcrResult, locale: Locale, t: Translate): OcrCard[] {
  const typeName = t(K(`ocr.type.${result.documentType}`));
  const fields = topFields(result);
  const isStructured = result.documents.length > 0;
  const cards: OcrCard[] = [];

  // ---- summary
  const summary: string[] = [];
  if (result.file) {
    summary.push(t(K("cards.fileReady"), { name: result.file.filename }));
  } else if (isStructured) {
    const found = Object.values(fields).filter((value) => !isEmpty(value)).length;
    summary.push(t(K("cards.summaryStructured"), { type: typeName, pages: result.pages, fields: found }));
    const average = averageConfidence(result);
    if (average !== undefined) summary.push(t(K("cards.avgConfidence"), { value: Math.round(average * 100) }));
  } else if (result.layout?.length) {
    const blocks = result.layout.reduce((sum, page) => sum + page.components.length, 0);
    summary.push(t(K("cards.summaryLayout"), { type: typeName, pages: result.pages, blocks }));
  } else {
    const text = result.text.join("\n").trim();
    summary.push(t(K("cards.summaryText"), { type: typeName, pages: result.pages, chars: text.length }));
    if (text) summary.push(text.replace(/\s+/g, " ").slice(0, 140));
  }
  cards.push({ slot: "summary", title: t(K("output.summary")), lines: summary });

  // ---- key fields
  const keyLines = isStructured ? keyFieldLines(fields, locale) : [];
  cards.push({
    slot: "keyFields",
    title: t(K("output.keyFields")),
    lines: keyLines.length ? keyLines : [t(K(result.file || !isStructured ? "cards.keyFieldsTextOnly" : "cards.keyFieldsNone"))],
    muted: !keyLines.length,
  });

  // ---- tables
  const tables = isStructured ? Object.entries(fields).flatMap(([key, value]) => findTables(value, fieldLabel(key, locale), locale)) : [];
  cards.push({
    slot: "table",
    title: t(K("output.table")),
    lines: tables.length ? tables.slice(0, 4).map((table) => t(K("cards.tableRows"), { name: table.name, rows: table.rows })) : [t(K("cards.tablesNone"))],
    muted: !tables.length,
  });

  // ---- translated / rewritten version
  if (result.styledText?.length) {
    cards.push({
      slot: "translated",
      title: t(K("cards.rewrittenTitle")),
      lines: [result.styledText.join(" ").replace(/\s+/g, " ").slice(0, 160)],
    });
  } else {
    cards.push({
      slot: "translated",
      title: t(K("output.translated")),
      lines: [t(K(result.styleFailed ? "ocr.styleFailed" : result.documentType === "general" ? "cards.translationHint" : "cards.translationNone"))],
      muted: true,
    });
  }

  // ---- notes: a CV's own evaluation when iApp gave one, otherwise what to double-check
  const evaluation = fields.evaluation;
  const evaluationSummary = isRecord(evaluation) && typeof evaluation.executiveSummary === "string" ? evaluation.executiveSummary.trim() : "";
  if (evaluationSummary) {
    cards.push({ slot: "notes", title: t(K("output.notes")), lines: [evaluationSummary.slice(0, 200)] });
  } else {
    const confidence = result.documents[0]?.confidence ?? {};
    const doubtful = Object.entries(confidence)
      .filter(([, score]) => typeof score === "number" && score > 0 && score < LOW_CONFIDENCE)
      .map(([key]) => fieldLabel(key, locale));
    const lines = doubtful.length
      ? [t(K("cards.recheck"), { fields: doubtful.slice(0, 4).join(", ") })]
      : [t(K(isStructured && Object.keys(confidence).length ? "cards.allConfident" : "cards.ocrCaution"))];
    cards.push({ slot: "notes", title: t(K("cards.notesTitle")), lines });
  }
  return cards;
}
