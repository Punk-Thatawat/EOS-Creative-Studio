import { exportDocumentOcr, type DocumentOcrResult, type OcrOutputFormat } from "@/lib/api/document-ocr";
import type { Locale, TranslationKey } from "@/lib/i18n/dictionary";
import { buildOcrExport } from "./ocr-export";
import { valueToLines } from "./ocr-format";

const K = (key: string) => `create.document.${key}` as TranslationKey;

export type Translate = (key: TranslationKey, params?: Record<string, string | number>) => string;

export function ocrResultToText(result: DocumentOcrResult, locale: Locale, t: Translate, preferStyled = false): string {
  if (result.layout?.length) {
    return result.layout
      .map((page) => `${t(K("ocr.pageN"), { n: page.page })}\n${page.components.map((component) => component.text).join("\n\n")}`)
      .join("\n\n");
  }
  const pages = preferStyled && result.styledText?.length ? result.styledText : result.text;
  if (pages.length) {
    return pages.map((page, index) => (pages.length > 1 ? `${t(K("ocr.pageN"), { n: index + 1 })}\n${page}` : page)).join("\n\n");
  }
  return result.documents
    .map((doc, index) => {
      const heading = result.documents.length > 1 ? `${t(K("ocr.documentN"), { n: index + 1 })}\n` : "";
      return heading + valueToLines(doc.fields, "", locale, 0).join("\n");
    })
    .join("\n\n");
}

export function ocrResultToJson(result: DocumentOcrResult): string {
  const { text, documents, layout, ...meta } = result;
  return JSON.stringify({
    ...meta,
    ...(text.length ? { text } : {}),
    ...(layout?.length ? { layout } : {}),
    ...(documents.length ? { documents } : {}),
  }, null, 2);
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function downloadGeneratedFile(file: NonNullable<DocumentOcrResult["file"]>) {
  const bytes = Uint8Array.from(atob(file.base64), (character) => character.charCodeAt(0));
  downloadBlob(file.filename, new Blob([bytes], { type: file.mimeType }));
}

/**
 * Saves the result in the chosen format. TXT and JSON are built here; Word and PDF are drawn by the backend from
 * a labelled outline of the result (free). A file iApp already generated is simply saved. Throws if the export fails.
 */
export async function downloadOcrResult(options: {
  result: DocumentOcrResult;
  fileName: string;
  format: OcrOutputFormat;
  preferStyled: boolean;
  locale: Locale;
  t: Translate;
}): Promise<void> {
  const { result, fileName, format, preferStyled, locale, t } = options;
  if (result.file) return downloadGeneratedFile(result.file);
  const baseName = fileName.replace(/\.[^.]+$/, "") || "document";
  if (format === "json") return downloadBlob(`${baseName}.json`, new Blob([ocrResultToJson(result)], { type: "application/json" }));
  if (format === "txt") return downloadBlob(`${baseName}.txt`, new Blob([ocrResultToText(result, locale, t, preferStyled)], { type: "text/plain;charset=utf-8" }));
  const outline = buildOcrExport(result, fileName, locale, t, preferStyled);
  downloadGeneratedFile(await exportDocumentOcr({ format, filename: fileName || "document", ...outline }));
}
