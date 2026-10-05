import type { DocumentOcrResult, OcrExportBlock } from "@/lib/api/document-ocr";
import type { Locale, TranslationKey } from "@/lib/i18n/dictionary";
import { fieldLabel } from "./ocr-field-labels";
import { formatPrimitive, isEmpty, isRecord, valueToLines } from "./ocr-format";

const K = (key: string) => `create.document.${key}` as TranslationKey;

type Translate = (key: TranslationKey, params?: Record<string, string | number>) => string;

function cellText(value: unknown, key: string, locale: Locale): string {
  if (isEmpty(value)) return "";
  if (isRecord(value) || Array.isArray(value)) return valueToLines(value, key, locale, 0).join("\n");
  return formatPrimitive(value, key, locale);
}

/** Turns extracted fields into labelled rows and tables; nested objects become their own headed sections. */
function fieldBlocks(fields: Record<string, unknown>, locale: Locale): OcrExportBlock[] {
  const blocks: OcrExportBlock[] = [];
  let rows: Array<{ label: string; value: string }> = [];
  const flush = () => {
    if (rows.length) blocks.push({ type: "fields", rows });
    rows = [];
  };

  for (const [key, value] of Object.entries(fields)) {
    if (isEmpty(value)) continue;
    const label = fieldLabel(key, locale);
    if (Array.isArray(value) && value.every(isRecord)) {
      flush();
      const columns = [...new Set(value.flatMap((row) => Object.keys(row)))];
      blocks.push({ type: "heading", text: label });
      blocks.push({ type: "table", columns: columns.map((column) => fieldLabel(column, locale)), rows: value.map((row) => columns.map((column) => cellText(row[column], column, locale))) });
    } else if (isRecord(value)) {
      flush();
      blocks.push({ type: "heading", text: label }, ...fieldBlocks(value, locale));
    } else if (Array.isArray(value)) {
      rows.push({ label, value: value.map((item) => cellText(item, key, locale)).filter(Boolean).join(", ") });
    } else {
      rows.push({ label, value: formatPrimitive(value, key, locale) });
    }
  }
  flush();
  return blocks;
}

/** The labelled outline the backend renders into a Word or PDF file. */
export function buildOcrExport(result: DocumentOcrResult, fileName: string, locale: Locale, t: Translate, preferStyled: boolean) {
  const blocks: OcrExportBlock[] = [];

  if (result.layout?.length) {
    for (const page of result.layout) {
      blocks.push({ type: "heading", text: t(K("ocr.pageN"), { n: page.page }) });
      for (const component of page.components) blocks.push({ type: "paragraph", text: component.text });
    }
  } else if (result.text.length) {
    const pages = preferStyled && result.styledText?.length ? result.styledText : result.text;
    pages.forEach((page, index) => {
      if (pages.length > 1) blocks.push({ type: "heading", text: t(K("ocr.pageN"), { n: index + 1 }) });
      blocks.push({ type: "paragraph", text: page });
    });
  } else {
    result.documents.forEach((doc, index) => {
      if (result.documents.length > 1) blocks.push({ type: "heading", text: t(K("ocr.documentN"), { n: index + 1 }) });
      blocks.push(...fieldBlocks(doc.fields, locale));
      if (doc.raw !== undefined && doc.raw !== null) {
        blocks.push({ type: "heading", text: t(K("ocr.rawText")) }, { type: "paragraph", text: typeof doc.raw === "string" ? doc.raw : JSON.stringify(doc.raw, null, 2) });
      }
    });
  }

  const date = new Date().toLocaleDateString(locale === "th" ? "th-TH" : "en-US", { dateStyle: "long" });
  return {
    title: t(K(`ocr.type.${result.documentType}`)),
    subtitle: `${fileName ? `${fileName} · ` : ""}${date}`,
    blocks,
  };
}
