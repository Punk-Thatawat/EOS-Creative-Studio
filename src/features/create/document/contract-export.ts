import { exportDocumentOcr, type OcrExportBlock, type OcrOutputFormat } from "@/lib/api/document-ocr";
import type { ContractReview } from "@/lib/api/document-contract";
import type { TranslationKey } from "@/lib/i18n/dictionary";
import { downloadBlob, downloadGeneratedFile, type Translate } from "./ocr-download";

const K = (key: string) => `create.document.${key}` as TranslationKey;

function clauseRows(risk: ContractReview["risks"][number], t: Translate) {
  return [
    ...(risk.clause ? [{ label: t(K("contract.view.clause")), value: risk.clause }] : []),
    { label: t(K("contract.view.why")), value: risk.explanation },
    ...(risk.suggestion ? [{ label: t(K("contract.view.suggestion")), value: risk.suggestion }] : []),
  ];
}

export function contractToText(review: ContractReview, t: Translate): string {
  const lines = [review.title, review.contractType, "", review.summary];
  if (review.keyFacts.length) lines.push("", t(K("contract.view.facts")), ...review.keyFacts.map((fact) => `- ${fact.label}: ${fact.value}`));
  lines.push("", t(K("contract.view.risks")));
  if (!review.risks.length) lines.push(t(K("contract.view.noRisks")));
  for (const [index, risk] of review.risks.entries()) {
    lines.push("", `${index + 1}. [${t(K(`contract.severity.${risk.severity}`))}] ${risk.title}`, ...clauseRows(risk, t).map((row) => `   ${row.label}: ${row.value}`));
  }
  lines.push("", t(K("contract.disclaimer")));
  return lines.filter((line, index, all) => !(line === "" && all[index - 1] === "")).join("\n");
}

export function contractBlocks(review: ContractReview, t: Translate): OcrExportBlock[] {
  const blocks: OcrExportBlock[] = [];
  if (review.summary) blocks.push({ type: "paragraph", text: review.summary });
  if (review.keyFacts.length) blocks.push({ type: "heading", text: t(K("contract.view.facts")) }, { type: "fields", rows: review.keyFacts.map((fact) => ({ label: fact.label, value: fact.value })) });
  blocks.push({ type: "heading", text: t(K("contract.view.risks")) });
  if (!review.risks.length) blocks.push({ type: "paragraph", text: t(K("contract.view.noRisks")) });
  for (const risk of review.risks) {
    blocks.push({ type: "heading", text: `[${t(K(`contract.severity.${risk.severity}`))}] ${risk.title}` }, { type: "fields", rows: clauseRows(risk, t) });
  }
  blocks.push({ type: "paragraph", text: t(K("contract.disclaimer")) });
  return blocks;
}

/** Saves the review as Word / PDF (drawn by the backend, free) or as TXT / JSON built here. Throws if it fails. */
export async function downloadContractReview(options: { review: ContractReview; fileName: string; format: OcrOutputFormat; t: Translate }): Promise<void> {
  const { review, fileName, format, t } = options;
  const baseName = `${fileName.replace(/\.[^.]+$/, "") || "contract"}-review`;
  if (format === "json") return downloadBlob(`${baseName}.json`, new Blob([JSON.stringify(review, null, 2)], { type: "application/json" }));
  if (format === "txt") return downloadBlob(`${baseName}.txt`, new Blob([contractToText(review, t)], { type: "text/plain;charset=utf-8" }));
  downloadGeneratedFile(await exportDocumentOcr({
    format,
    filename: baseName,
    title: review.title,
    ...(review.contractType ? { subtitle: review.contractType } : {}),
    blocks: contractBlocks(review, t),
  }));
}
