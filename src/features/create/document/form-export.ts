import type { FormBlock, FormField } from "@/lib/api/document-form";
import { exportDocumentOcr, type OcrExportBlock } from "@/lib/api/document-ocr";
import type { TranslationKey } from "@/lib/i18n/dictionary";
import { downloadBlob, downloadGeneratedFile, type Translate } from "./ocr-download";

const K = (key: string) => `create.document.${key}` as TranslationKey;

export type FormExportFormat = "docx" | "pdf" | "txt" | "json" | "csv";

/** A field the AI was less sure of than this is marked "check" in the list and the exports. */
export const LOW_CONFIDENCE = 0.75;

const percent = (confidence: number) => `${Math.round(confidence * 100)}%`;

export function formToText(fields: FormField[]): string {
  return fields.map((field) => `${field.label}: ${field.value}`).join("\n");
}

function csvCell(value: string): string {
  // Spreadsheets run text that starts with = + - @ as a formula, so a form that says "=1+1" must not.
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** Excel opens a UTF-8 CSV correctly only with a byte order mark, which Thai needs. */
export function formToCsv(fields: FormField[], t: Translate): string {
  const header = [t(K("form.csv.label")), t(K("form.csv.value")), t(K("form.csv.confidence"))].map(csvCell).join(",");
  const rows = fields.map((field) => [field.label, field.value, percent(field.confidence)].map(csvCell).join(","));
  return `﻿${[header, ...rows].join("\r\n")}`;
}

export function formToJson(fields: FormField[]): string {
  return JSON.stringify(fields.map(({ label, value, type, confidence }) => ({ label, value, type, confidence })), null, 2);
}

/**
 * The text of one page as the OCR read it, as paragraphs. Blocks that sit on the same line are joined, lines go top to
 * bottom, and a gap taller than a line starts a new paragraph.
 */
export function pageParagraphs(blocks: FormBlock[], page: number): string[] {
  const onPage = blocks.filter((block) => block.page === page && block.text.trim()).sort((a, b) => a.top - b.top || a.left - b.left);
  const lines: Array<{ top: number; bottom: number; parts: FormBlock[] }> = [];
  for (const block of onPage) {
    const line = lines[lines.length - 1];
    const middle = (block.top + block.bottom) / 2;
    // On the same line when its middle falls within the line already started.
    if (line && middle >= line.top && middle <= line.bottom) {
      line.parts.push(block);
      line.top = Math.min(line.top, block.top);
      line.bottom = Math.max(line.bottom, block.bottom);
    } else {
      lines.push({ top: block.top, bottom: block.bottom, parts: [block] });
    }
  }
  const paragraphs: string[][] = [];
  let previous: (typeof lines)[number] | undefined;
  for (const line of lines) {
    const text = line.parts.sort((a, b) => a.left - b.left).map((part) => part.text.trim()).join(" ");
    const height = line.bottom - line.top;
    if (!previous || line.top - previous.bottom > height) paragraphs.push([text]);
    else paragraphs[paragraphs.length - 1]!.push(text);
    previous = line;
  }
  return paragraphs.map((lines) => lines.join("\n"));
}

/** Where the fields go in a file: after the pages of the form itself when those are known. */
type FormExportSource = { blocks?: FormBlock[] | undefined; pages?: number | undefined };

export function formBlocks(fields: FormField[], t: Translate, source: FormExportSource = {}): OcrExportBlock[] {
  const checks = fields.filter((field) => field.confidence < LOW_CONFIDENCE && field.value);
  const pageCount = source.pages ?? 0;
  const pages: OcrExportBlock[] = [];
  if (source.blocks?.length) {
    for (let page = 1; page <= Math.max(1, pageCount); page += 1) {
      const paragraphs = pageParagraphs(source.blocks, page);
      if (!paragraphs.length) continue;
      if (pageCount > 1) pages.push({ type: "heading", text: t(K("form.export.page"), { n: page }) });
      pages.push(...paragraphs.map((text) => ({ type: "paragraph" as const, text })));
    }
  }
  return [
    ...pages,
    ...(pages.length ? [{ type: "heading" as const, text: t(K("form.export.fields")) }] : []),
    { type: "fields", rows: fields.map((field) => ({ label: field.label, value: field.value || "—" })) },
    ...(checks.length ? [{ type: "paragraph" as const, text: t(K("form.export.check"), { fields: checks.map((field) => field.label).join(", ") }) }] : []),
  ];
}

/** The whole form as plain text: every page, then the fields. */
function formToFullText(fields: FormField[], t: Translate, source: FormExportSource): string {
  const blocks = formBlocks(fields, t, source);
  return blocks.map((block) => (block.type === "fields" ? formToText(fields) : block.type === "table" ? "" : block.text)).filter(Boolean).join("\n\n");
}

/** Saves the (possibly edited) fields, after the text of every page when the form is still on screen. Word and PDF are drawn by the backend from the same outline, free. Throws if it fails. */
export async function downloadFormResult(options: { fields: FormField[]; fileName: string; format: FormExportFormat; t: Translate; blocks?: FormBlock[] | undefined; pages?: number | undefined }): Promise<void> {
  const { fields, fileName, format, t } = options;
  const source = { blocks: options.blocks, pages: options.pages };
  const baseName = fileName.replace(/\.[^.]+$/, "") || "form";
  if (format === "json") return downloadBlob(`${baseName}.json`, new Blob([formToJson(fields)], { type: "application/json" }));
  if (format === "txt") return downloadBlob(`${baseName}.txt`, new Blob([formToFullText(fields, t, source)], { type: "text/plain;charset=utf-8" }));
  if (format === "csv") return downloadBlob(`${baseName}.csv`, new Blob([formToCsv(fields, t)], { type: "text/csv;charset=utf-8" }));
  downloadGeneratedFile(await exportDocumentOcr({ format, filename: baseName, title: baseName, blocks: formBlocks(fields, t, source) }));
}
