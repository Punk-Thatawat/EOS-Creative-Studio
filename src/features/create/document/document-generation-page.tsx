"use client";

import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Clock3,
  ChevronDown,
  CloudUpload,
  Download,
  FileCheck2,
  FileText,
  History as HistoryIcon,
  LoaderCircle,
  Languages,
  ListChecks,
  NotebookPen,
  Play,
  Plus,
  RefreshCw,
  ScanText,
  Sparkles,
  Table2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CreatorWorkspaceLayout } from "@/components/create/creator-workspace-layout";
import { Dropdown } from "@/components/ui/dropdown";
import { getDocumentSummaryOptions, summarizeDocument, type DocumentSummary } from "@/lib/api/document-summarize";
import { translateDocument, type DocumentTranslation, type TranslationLanguage } from "@/lib/api/document-translate";
import { fetchHistory, type HistoryItem } from "@/lib/api/history";
import type { TranslationKey } from "@/lib/i18n/dictionary";
import { useLocale } from "@/lib/i18n/locale-provider";
import styles from "./document-generation-page.module.css";

const K = (key: string) => `create.document.${key}` as TranslationKey;

type ModeId = "ocr" | "summarize" | "translate" | "contract" | "report" | "form";
type SummaryPurpose = "general" | "meeting" | "decision" | "report" | "learning";
type SummaryAudience = "general" | "executive" | "team" | "client" | "specialist";
type SummaryStyle = "executive" | "bullets";
type SummaryWorkspaceTab = "latest" | "examples";
type DocumentOutputFormat = "DOCX" | "PDF" | "TXT" | "JSON";
type SourcePageRange = "all" | "first-5" | "first-10" | "first-20";

const documentOutputFormats: DocumentOutputFormat[] = ["DOCX", "PDF", "TXT", "JSON"];
const summaryPurposes: SummaryPurpose[] = ["general", "meeting", "decision", "report", "learning"];
const summaryAudiences: SummaryAudience[] = ["general", "executive", "team", "client", "specialist"];

const summaryContextPattern = /\[\[EOS_SUMMARY_CONTEXT purpose=(general|meeting|decision|report|learning) audience=(general|executive|team|client|specialist) style=(executive|bullets|actions)\]\][\s\S]*?\[\[\/EOS_SUMMARY_CONTEXT\]\]\s*/;

function restoreSummaryContext(prompt: string | undefined, fallbackStyle: "executive" | "bullets") {
  const match = prompt?.match(summaryContextPattern);
  return {
    prompt: prompt?.replace(summaryContextPattern, "").trim() ?? "",
    purpose: (match?.[1] as SummaryPurpose | undefined) ?? "general",
    audience: (match?.[2] as SummaryAudience | undefined) ?? "general",
    style: match?.[3] === "actions" ? "bullets" : (match?.[3] as SummaryStyle | undefined) ?? fallbackStyle,
  };
}

const modes: { id: ModeId; icon: typeof ScanText; available?: boolean }[] = [
  { id: "ocr", icon: ScanText, available: true },
  { id: "summarize", icon: NotebookPen, available: true },
  { id: "translate", icon: Languages, available: true },
  { id: "contract", icon: FileCheck2 },
  { id: "report", icon: BarChart3 },
  { id: "form", icon: ListChecks },
];

function isModeId(value: string | null): value is ModeId {
  return value !== null && modes.some((mode) => mode.id === value && mode.available);
}

const outputs = [
  { key: K("output.summary"), icon: NotebookPen },
  { key: K("output.keyFields"), icon: ListChecks },
  { key: K("output.table"), icon: Table2 },
  { key: K("output.translated"), icon: Languages },
  { key: K("output.notes"), icon: Sparkles },
];

const guides = [
  { title: K("guide.ocr"), detail: K("guide.ocrDetail"), time: "03:21", tone: "orange" },
  { title: K("guide.contract"), detail: K("guide.contractDetail"), time: "04:35", tone: "pink" },
  { title: K("guide.prompt"), detail: K("guide.promptDetail"), time: "05:12", tone: "yellow" },
  { title: K("guide.reports"), detail: K("guide.reportsDetail"), time: "06:08", tone: "blue" },
];

const documentTools = [
  { title: K("tool.ocr"), detail: K("tool.ocrDetail"), icon: ScanText },
  { title: K("tool.contract"), detail: K("tool.contractDetail"), icon: FileCheck2 },
  { title: K("tool.meeting"), detail: K("tool.meetingDetail"), icon: NotebookPen },
  { title: K("tool.report"), detail: K("tool.reportDetail"), icon: BarChart3 },
];

/** Renders a translated string, turning "\n" into line breaks (used by the hero artwork). */
function Lines({ text }: { text: string }) {
  return text.split("\n").map((line, index) => (
    <Fragment key={index}>
      {index > 0 ? <br /> : null}
      {line}
    </Fragment>
  ));
}

function PanelHeading({ step, children }: { step: string; children: string }) {
  return (
    <div className={styles.panelHeading}>
      <span>{step}.</span>
      <h2>{children}</h2>
    </div>
  );
}

function SelectPlaceholder({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.selectField}>
      <span>{label}</span>
      <div className={styles.selectValue}>
        {value}
        <ChevronDown size={14} aria-hidden="true" />
      </div>
    </div>
  );
}

function SelectControl({ label, value, options, onChange }: { label: string; value: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void }) {
  return (
    <div className={styles.selectField}>
      <span>{label}</span>
      <Dropdown
        className={styles.controlDropdown}
        triggerClassName={styles.controlDropdownTrigger}
        menuClassName={styles.controlDropdownMenu}
        optionClassName={styles.controlDropdownOption}
        value={value}
        options={options}
        onChange={onChange}
        ariaLabel={label}
        menuPosition="fixed"
      />
    </div>
  );
}

function formatFileSize(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function historyDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "ไม่ทราบวันที่" : new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character] ?? character);
}

function safeFileName(value: string): string {
  return value.replace(/\.[^/.]+$/, "").replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").trim() || "document-summary";
}

type SummaryExportLabels = { takeawaysHeading: string; actionItems: string; decisions: string; importantDates: string; notes: string };

function summaryText(summary: DocumentSummary, note: string, labels: SummaryExportLabels): string {
  const lines = [summary.title, "", summary.executiveSummary];
  if (summary.sections?.length) {
    for (const section of summary.sections) lines.push("", section.heading, ...section.items.map((item) => `• ${item}`));
  } else if (summary.keyTakeaways.length) {
    lines.push("", labels.takeawaysHeading, ...summary.keyTakeaways.map((item) => `• ${item}`));
  }
  if (summary.actionItems.length) lines.push("", labels.actionItems, ...summary.actionItems.map((item) => `• ${item.task}${item.owner ? ` · ${item.owner}` : ""}${item.dueDate ? ` · ${item.dueDate}` : ""}`));
  if (summary.decisions.length) lines.push("", labels.decisions, ...summary.decisions.map((item) => `• ${item}`));
  if (summary.importantDates.length) lines.push("", labels.importantDates, ...summary.importantDates.map((item) => `• ${item.date} · ${item.event}`));
  if (note.trim()) lines.push("", labels.notes, note.trim());
  return lines.join("\n");
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function concatenateBytes(parts: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function createStoredZip(files: Array<{ name: string; contents: string }>): Blob {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let localOffset = 0;
  for (const file of files) {
    const name = encoder.encode(file.name);
    const contents = encoder.encode(file.contents);
    const checksum = crc32(contents);
    const localHeader = new Uint8Array(30);
    const localView = new DataView(localHeader.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(10, 0, true);
    localView.setUint16(12, 0x21, true);
    localView.setUint32(14, checksum, true);
    localView.setUint32(18, contents.length, true);
    localView.setUint32(22, contents.length, true);
    localView.setUint16(26, name.length, true);
    localParts.push(localHeader, name, contents);

    const centralHeader = new Uint8Array(46);
    const centralView = new DataView(centralHeader.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(12, 0, true);
    centralView.setUint16(14, 0x21, true);
    centralView.setUint32(16, checksum, true);
    centralView.setUint32(20, contents.length, true);
    centralView.setUint32(24, contents.length, true);
    centralView.setUint16(28, name.length, true);
    centralView.setUint32(42, localOffset, true);
    centralParts.push(centralHeader, name);
    localOffset += localHeader.length + name.length + contents.length;
  }
  const centralDirectory = concatenateBytes(centralParts);
  const endRecord = new Uint8Array(22);
  const endView = new DataView(endRecord.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralDirectory.length, true);
  endView.setUint32(16, localOffset, true);
  const zipBytes = concatenateBytes([...localParts, centralDirectory, endRecord]);
  const blobBytes = new ArrayBuffer(zipBytes.length);
  new Uint8Array(blobBytes).set(zipBytes);
  return new Blob([blobBytes], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
}

function createDocxBlob(summary: DocumentSummary, note: string, labels: SummaryExportLabels): Blob {
  const paragraph = (text: string, heading = false) => `<w:p>${heading ? "<w:pPr><w:pStyle w:val=\"Heading1\"/></w:pPr>" : ""}<w:r>${heading ? "<w:rPr><w:b/><w:sz w:val=\"30\"/></w:rPr>" : ""}<w:t xml:space=\"preserve\">${escapeXml(text)}</w:t></w:r></w:p>`;
  const paragraphs = [paragraph(summary.title, true), paragraph(summary.executiveSummary)];
  if (summary.sections?.length) for (const section of summary.sections) paragraphs.push(paragraph(section.heading, true), ...section.items.map((item) => paragraph(`• ${item}`)));
  else if (summary.keyTakeaways.length) paragraphs.push(paragraph(labels.takeawaysHeading, true), ...summary.keyTakeaways.map((item) => paragraph(`• ${item}`)));
  if (summary.actionItems.length) paragraphs.push(paragraph(labels.actionItems, true), ...summary.actionItems.map((item) => paragraph(`• ${item.task}${item.owner ? ` · ${item.owner}` : ""}${item.dueDate ? ` · ${item.dueDate}` : ""}`)));
  if (summary.decisions.length) paragraphs.push(paragraph(labels.decisions, true), ...summary.decisions.map((item) => paragraph(`• ${item}`)));
  if (summary.importantDates.length) paragraphs.push(paragraph(labels.importantDates, true), ...summary.importantDates.map((item) => paragraph(`• ${item.date} · ${item.event}`)));
  if (note.trim()) paragraphs.push(paragraph(labels.notes, true), ...note.trim().split(/\r?\n/).map((line) => paragraph(line)));
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs.join("")}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>`;
  return createStoredZip([
    { name: "[Content_Types].xml", contents: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>` },
    { name: "_rels/.rels", contents: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>` },
    { name: "word/document.xml", contents: documentXml },
  ]);
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function DocumentGenerationPage() {
  const { t } = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requestedMode = searchParams.get("tab");
  const activeMode: ModeId = isModeId(requestedMode) ? requestedMode : "ocr";
  const [summaryStyle, setSummaryStyle] = useState<SummaryStyle>("executive");
  const [summaryPurpose, setSummaryPurpose] = useState<SummaryPurpose>("general");
  const [summaryAudience, setSummaryAudience] = useState<SummaryAudience>("general");
  const [summaryWorkspaceTab, setSummaryWorkspaceTab] = useState<SummaryWorkspaceTab>("latest");
  const [sourcePageRange, setSourcePageRange] = useState<SourcePageRange>("all");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [summaryPrompt, setSummaryPrompt] = useState("");
  const [summaryResult, setSummaryResult] = useState<DocumentSummary | null>(null);
  const [summaryFilename, setSummaryFilename] = useState("");
  const [summaryError, setSummaryError] = useState("");
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summaryLength, setSummaryLength] = useState<"brief" | "standard" | "detailed">("standard");
  const [summaryLanguage, setSummaryLanguage] = useState<"auto" | "English" | "Thai">("auto");
  const [summaryOptions, setSummaryOptions] = useState({ model: "google/gemini-3.5-flash", credits: 1 });
  const [documentHistory, setDocumentHistory] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState("");
  const [historyRefresh, setHistoryRefresh] = useState(0);

  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const [translationSourceLanguage, setTranslationSourceLanguage] = useState<TranslationLanguage>("auto");
  const [translationTargetLanguage, setTranslationTargetLanguage] = useState<Exclude<TranslationLanguage, "auto">>("Thai");
  const [outputFormat, setOutputFormat] = useState<DocumentOutputFormat>("DOCX");
  const [translationResult, setTranslationResult] = useState<DocumentTranslation | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [summaryZoom, setSummaryZoom] = useState(100);
  const [isComparingSource, setIsComparingSource] = useState(false);
  const [compareSourceFile, setCompareSourceFile] = useState<File | null>(null);
  const [isSummaryNoteOpen, setIsSummaryNoteOpen] = useState(false);
  const [summaryNote, setSummaryNote] = useState("");
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const compareSourceInputRef = useRef<HTMLInputElement>(null);
  const isSummarize = activeMode === "summarize";
  const isTranslate = activeMode === "translate";
  const displayedSummary = summaryWorkspaceTab === "examples" ? null : summaryResult;
  const sourceFileForPreview = compareSourceFile ?? selectedFile;
  const sourceFileName = sourceFileForPreview?.name ?? summaryFilename;
  const isPdfSource = Boolean(sourceFileForPreview && (sourceFileForPreview.type === "application/pdf" || sourceFileForPreview.name.toLowerCase().endsWith(".pdf")));
  const isImageSource = Boolean(sourceFileForPreview && (sourceFileForPreview.type.startsWith("image/") || /\.(png|jpe?g)$/i.test(sourceFileForPreview.name)));
  const canCompareSource = Boolean(displayedSummary && ((sourceFileForPreview && (isPdfSource || isImageSource)) || (!sourceFileForPreview && /\.(pdf|png|jpe?g)$/i.test(summaryFilename))));

  const changeActiveMode = (mode: ModeId) => {
    if (mode === "summarize") {
      setHistoryLoading(true);
      setHistoryError("");
    }
    const params = new URLSearchParams(searchParams.toString());
    if (mode === "ocr") params.delete("tab");
    else params.set("tab", mode);
    const query = params.toString();
    router.replace(`${pathname}${query ? `?${query}` : ""}`, { scroll: false });
  };

  const refreshDocumentHistory = () => {
    setHistoryLoading(true);
    setHistoryError("");
    setHistoryRefresh((current) => current + 1);
  };

  const sourcePreviewUrl = useMemo(() => sourceFileForPreview ? URL.createObjectURL(sourceFileForPreview) : "", [sourceFileForPreview]);

  useEffect(() => {
    if (!sourcePreviewUrl) return;
    return () => URL.revokeObjectURL(sourcePreviewUrl);
  }, [sourcePreviewUrl]);

  useEffect(() => {
    let mounted = true;
    void getDocumentSummaryOptions().then((options) => {
      if (mounted) setSummaryOptions(options);
    }).catch(() => undefined);
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!isSummarize) return;
    const controller = new AbortController();
    void fetchHistory({ type: "document", status: "completed", limit: 6, signal: controller.signal })
      .then((response) => {
        setDocumentHistory(response.items.filter((item) => item.documentSummary));
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setHistoryError(error instanceof Error ? error.message : "โหลดประวัติไม่สำเร็จ");
      })
      .finally(() => {
        if (!controller.signal.aborted) setHistoryLoading(false);
      });
    return () => controller.abort();
  }, [historyRefresh, isSummarize]);

  const setFileFromList = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (!extension || !["pdf", "docx", "png", "jpg", "jpeg"].includes(extension)) {
      setSummaryError(t(K("summary.errorType")));
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setSummaryError(t(K("summary.errorSize")));
      return;
    }
    setSelectedFile(file);
    setCompareSourceFile(null);
    setSummaryResult(null);
    setTranslationResult(null);
    setSummaryFilename(file.name);
    setSelectedHistoryId(null);
    setSummaryError("");
    setSummaryNote("");
    setIsSummaryNoteOpen(false);
    setIsComparingSource(false);
  };

  const setCompareFileFromList = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    const isImage = file.type.startsWith("image/") || /\.(png|jpe?g)$/i.test(file.name);
    if (!isPdf && !isImage) {
      setSummaryError(t(K("summary.errorType")));
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setSummaryError(t(K("summary.errorSize")));
      return;
    }
    setCompareSourceFile(file);
    setSummaryError("");
    setIsComparingSource(true);
  };

  const generateSummary = async () => {
    if (!selectedFile || isSummarizing) return;
    setIsSummarizing(true);
    setSummaryError("");
    try {
      const selectedPageCount = sourcePageRange === "all" ? null : Number(sourcePageRange.split("-")[1]);
      const pageRangeInstruction = selectedPageCount
        ? t(K("summary.pageRangeInstruction"), { count: selectedPageCount })
        : "";
      const summaryContext = [
        `[[EOS_SUMMARY_CONTEXT purpose=${summaryPurpose} audience=${summaryAudience} style=${summaryStyle}]]`,
        t(K(`summary.purposeInstruction.${summaryPurpose}`)),
        t(K(`summary.audienceInstruction.${summaryAudience}`)),
        t(K(`summary.styleInstruction.${summaryStyle}`)),
        t(K("summary.autoSectionsInstruction")),
        t(K("summary.groundingInstruction")),
        "[[/EOS_SUMMARY_CONTEXT]]",
      ].join("\n");
      const response = await summarizeDocument({
        file: selectedFile,
        prompt: [pageRangeInstruction, summaryContext, summaryPrompt.trim()].filter(Boolean).join("\n\n"),
        summaryStyle,
        summaryLength,
        language: summaryLanguage,
        // Keep every structured result field available; Gemini chooses which
        // sections are relevant and leaves unrelated sections empty.
        includeKeyTakeaways: true,
        includeActionItems: true,
        includeImportantDates: true,
      });
      setSummaryResult(response.summary);
      setSummaryFilename(selectedFile.name);
      setSelectedHistoryId(response.id);
      setSummaryWorkspaceTab("latest");
      setSummaryNote("");
      setIsSummaryNoteOpen(false);
      setIsComparingSource(false);
      refreshDocumentHistory();
      setSummaryOptions((current) => ({ ...current, model: response.model, credits: response.creditsUsed }));
    } catch (error) {
      setSummaryError(error instanceof Error ? error.message : t(K("summary.errorGeneral")));
    } finally {
      setIsSummarizing(false);
    }
  };

  const generateTranslation = async () => {
    if (!selectedFile || isTranslating) return;
    setIsTranslating(true);
    setSummaryError("");
    setTranslationResult(null);
    try {
      const response = await translateDocument({
        file: selectedFile,
        sourceLanguage: translationSourceLanguage,
        targetLanguage: translationTargetLanguage,
      });
      setTranslationResult(response);
      setSummaryOptions((current) => ({ ...current, model: response.model, credits: response.creditsUsed }));
    } catch (error) {
      setSummaryError(error instanceof Error ? error.message : t(K("translate.error")));
    } finally {
      setIsTranslating(false);
    }
  };

  const downloadTranslation = () => {
    if (!translationResult) return;
    const blob = new Blob([translationResult.translatedText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${selectedFile?.name.replace(/\.[^.]+$/, "") ?? "translation"}-${translationTargetLanguage.toLowerCase()}.txt`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const toggleSourceComparison = () => {
    if (!displayedSummary) return;
    if (!sourceFileForPreview) {
      compareSourceInputRef.current?.click();
      return;
    }
    setIsComparingSource((value) => !value);
  };

  const exportSummary = () => {
    if (!displayedSummary) return;
    const baseName = safeFileName(summaryFilename || selectedFile?.name || displayedSummary.title);
    const labels: SummaryExportLabels = {
      takeawaysHeading: t(K("summary.takeawaysHeading")),
      actionItems: t(K("summary.actionItems")),
      decisions: t(K("summary.decisions")),
      importantDates: t(K("summary.importantDates")),
      notes: t(K("summary.noteLabel")),
    };
    const text = summaryText(displayedSummary, summaryNote, labels);
    if (outputFormat === "TXT") {
      downloadBlob(new Blob([text], { type: "text/plain;charset=utf-8" }), `${baseName}-summary.txt`);
      return;
    }
    if (outputFormat === "JSON") {
      downloadBlob(new Blob([JSON.stringify({ ...displayedSummary, ...(summaryNote.trim() ? { note: summaryNote.trim() } : {}) }, null, 2)], { type: "application/json;charset=utf-8" }), `${baseName}-summary.json`);
      return;
    }
    if (outputFormat === "DOCX") {
      downloadBlob(createDocxBlob(displayedSummary, summaryNote, labels), `${baseName}-summary.docx`);
      return;
    }

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      setSummaryError(t(K("summary.exportPopupBlocked")));
      return;
    }
    const sections = displayedSummary.sections?.length
      ? displayedSummary.sections.map((section) => `<section><h2>${escapeXml(section.heading)}</h2><ul>${section.items.map((item) => `<li>${escapeXml(item)}</li>`).join("")}</ul></section>`).join("")
      : displayedSummary.keyTakeaways.length
        ? `<section><h2>${escapeXml(t(K("summary.takeawaysHeading")))}</h2><ul>${displayedSummary.keyTakeaways.map((item) => `<li>${escapeXml(item)}</li>`).join("")}</ul></section>`
        : "";
    const actions = displayedSummary.actionItems.length ? `<section><h2>${escapeXml(t(K("summary.actionItems")))}</h2><ul>${displayedSummary.actionItems.map((item) => `<li>${escapeXml(`${item.task}${item.owner ? ` · ${item.owner}` : ""}${item.dueDate ? ` · ${item.dueDate}` : ""}`)}</li>`).join("")}</ul></section>` : "";
    const decisions = displayedSummary.decisions.length ? `<section><h2>${escapeXml(t(K("summary.decisions")))}</h2><ul>${displayedSummary.decisions.map((item) => `<li>${escapeXml(item)}</li>`).join("")}</ul></section>` : "";
    const dates = displayedSummary.importantDates.length ? `<section><h2>${escapeXml(t(K("summary.importantDates")))}</h2><ul>${displayedSummary.importantDates.map((item) => `<li>${escapeXml(`${item.date} · ${item.event}`)}</li>`).join("")}</ul></section>` : "";
    const note = summaryNote.trim() ? `<section><h2>${escapeXml(t(K("summary.noteLabel")))}</h2><p>${escapeXml(summaryNote.trim()).replace(/\r?\n/g, "<br>")}</p></section>` : "";
    printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeXml(baseName)}</title><style>body{max-width:760px;margin:48px auto;padding:0 32px;color:#252a2f;font:16px/1.65 Arial,sans-serif}h1{font-size:28px}h2{margin:28px 0 8px;font-size:18px}p,li{color:#4d5660}section{break-inside:avoid}@media print{body{margin:0 auto;padding:0 12mm}}</style></head><body><h1>${escapeXml(displayedSummary.title)}</h1><p>${escapeXml(displayedSummary.executiveSummary)}</p>${sections}${actions}${decisions}${dates}${note}</body></html>`);
    printWindow.document.close();
    printWindow.focus();
    window.setTimeout(() => printWindow.print(), 300);
  };

  const openDocumentHistory = (item: HistoryItem) => {
    const saved = item.documentSummary;
    if (!saved) return;
    if (uploadInputRef.current) uploadInputRef.current.value = "";
    changeActiveMode("summarize");
    setSelectedFile(null);
    setCompareSourceFile(null);
    setCompareSourceFile(null);
    setSummaryFilename(saved.filename);
    setSummaryResult(saved.summary);
    setSummaryError("");
    setSelectedHistoryId(item.id);
    setSummaryWorkspaceTab("latest");
    setSummaryNote("");
    setIsSummaryNoteOpen(false);
    setIsComparingSource(false);
    const restoredContext = restoreSummaryContext(saved.options.prompt, saved.options.summaryStyle);
    setSummaryPrompt(restoredContext.prompt);
    setSummaryPurpose(restoredContext.purpose);
    setSummaryAudience(restoredContext.audience);
    setSummaryStyle(restoredContext.style);
    setSummaryLength(saved.options.summaryLength);
    setSummaryLanguage(saved.options.language);
    setSummaryOptions((current) => ({ ...current, model: item.model ?? current.model, credits: item.creditCost ?? current.credits }));
  };

  return (
    <div className={`${styles.page} document-studio-page`}>
      <header className={styles.hero}>
        <div className={styles.heroCopy}>
          <span className={styles.heroEyebrow}>EOS CREATIVE STUDIO</span>
          <h1>GEN DOCUMENT</h1>
          <div className={styles.heroStamp}>{t(K("hero.stamp"))}</div>
          <p>{t(K("hero.tagline"))}</p>
        </div>
        <div className={styles.heroArtwork} aria-hidden="true">
          <div className={styles.heroBrush}><Lines text={t(K("hero.brush"))} /></div>
          <div className={`${styles.paper} ${styles.paperBack}`}>
            <span>{t(K("hero.paper"))}</span>
            <i /><i /><i />
            <div className={styles.miniChart}><b /><b /><b /><b /><b /></div>
          </div>
          <div className={styles.smartSticker}><Lines text={t(K("hero.sticker"))} /></div>
          <div className={`${styles.paper} ${styles.paperFront}`}>
            <span>OCR</span>
            <i /><i /><i /><i />
            <div className={styles.scanCorners} />
          </div>
          <div className={styles.orangeBurst} />
        </div>
      </header>

      <CreatorWorkspaceLayout
        tabs={
          <nav className={styles.modeTabs} aria-label={t(K("a11y.tools"))}>
            {modes.map(({ id, icon: Icon, available }) => {
              const isActive = activeMode === id;
              const label = t(K(`mode.${id}`));
              return (
                <button
                  key={id}
                  type="button"
                  className={`${styles.modeTab} ${isActive ? styles.modeTabActive : ""} ${!available ? styles.modeTabDisabled : ""}`}
                  aria-pressed={isActive}
                  aria-disabled={!available}
                  title={available ? label : t(K("mode.comingSoon"), { label })}
                  onClick={() => available && changeActiveMode(id)}
                >
                  <Icon size={16} strokeWidth={2} aria-hidden="true" />
                  <span>{label}</span>
                </button>
              );
            })}
          </nav>
        }
        left={
          <aside className={styles.sourcePanel} aria-label={t(K("a11y.source"))}>
          <PanelHeading step="1">{t(K("source.heading"))}</PanelHeading>
          <div
            className={styles.dropzone}
            role="button"
            tabIndex={0}
            onClick={() => uploadInputRef.current?.click()}
            onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); uploadInputRef.current?.click(); } }}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => { event.preventDefault(); setFileFromList(event.dataTransfer.files); }}
          >
            <CloudUpload size={29} strokeWidth={1.7} aria-hidden="true" />
            <strong>{selectedFile ? t(K("source.dropReplace")) : t(K("source.dropTitle"))}</strong>
            <span>{t(K("source.dropHint"))}</span>
            <small>{t(K("source.dropTypes"), { max: 25 })}</small>
          </div>
          <input ref={uploadInputRef} className={styles.fileInput} type="file" accept=".pdf,.docx,.png,.jpg,.jpeg,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/png,image/jpeg" onChange={(event) => setFileFromList(event.currentTarget.files)} />
          <input ref={compareSourceInputRef} className={styles.fileInput} type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" onChange={(event) => { setCompareFileFromList(event.currentTarget.files); event.currentTarget.value = ""; }} />
          <div className={styles.filePlaceholder}>
            <span className={styles.fileIcon}><FileText size={17} aria-hidden="true" /></span>
            <span className={styles.fileCopy}><strong>{selectedFile?.name ?? t(K("source.filesTitle"))}</strong><small>{selectedFile ? formatFileSize(selectedFile.size) : t(K("source.filesHint"))}</small></span>
            <button type="button" className={styles.replaceFileButton} aria-label={t(K("source.chooseFile"))} onClick={() => uploadInputRef.current?.click()}><Plus size={16} aria-hidden="true" /></button>
          </div>
          <div className={styles.selectField}>
            <span>{t(K("source.pages"))}</span>
            <Dropdown
              className={styles.pageRangeDropdown}
              triggerClassName={styles.pageRangeTrigger}
              menuClassName={styles.pageRangeMenu}
              optionClassName={styles.pageRangeOption}
              value={sourcePageRange}
              onChange={(value) => setSourcePageRange(value as SourcePageRange)}
              options={[
                { value: "all", label: t(K("source.allPages")) },
                { value: "first-5", label: t(K("source.first5Pages")) },
                { value: "first-10", label: t(K("source.first10Pages")) },
                { value: "first-20", label: t(K("source.first20Pages")) },
              ]}
              ariaLabel={t(K("source.pages"))}
              menuPosition="fixed"
            />
          </div>
          <div className={styles.sectionRule} />
          <PanelHeading step="2">{isSummarize ? t(K("summary.goal")) : isTranslate ? t(K("translate.workflow")) : t(K("instructions.heading"))}</PanelHeading>
          {isSummarize ? (
            <>
              <div className={styles.summarySelectField}>
                <span>{t(K("summary.purpose"))}</span>
                <Dropdown
                  className={styles.pageRangeDropdown}
                  triggerClassName={styles.pageRangeTrigger}
                  menuClassName={styles.pageRangeMenu}
                  optionClassName={styles.pageRangeOption}
                  value={summaryPurpose}
                  onChange={(value) => setSummaryPurpose(value as SummaryPurpose)}
                  options={summaryPurposes.map((purpose) => ({
                    value: purpose,
                    label: t(K(`summary.purposeOption.${purpose}`)),
                    description: t(K(`summary.purposeHint.${purpose}`)),
                  }))}
                  ariaLabel={t(K("summary.purpose"))}
                  menuPosition="fixed"
                />
              </div>
              <div className={styles.summarySelectField}>
                <span>{t(K("summary.audience"))}</span>
                <Dropdown
                  className={styles.pageRangeDropdown}
                  triggerClassName={styles.pageRangeTrigger}
                  menuClassName={styles.pageRangeMenu}
                  optionClassName={styles.pageRangeOption}
                  value={summaryAudience}
                  onChange={(value) => setSummaryAudience(value as SummaryAudience)}
                  options={summaryAudiences.map((audience) => ({
                    value: audience,
                    label: t(K(`summary.audienceOption.${audience}`)),
                    description: t(K(`summary.audienceHint.${audience}`)),
                  }))}
                  ariaLabel={t(K("summary.audience"))}
                  menuPosition="fixed"
                />
              </div>
              <div className={styles.summaryPrompt}>
                <textarea aria-label={t(K("summary.promptLabel"))} maxLength={600} value={summaryPrompt} onChange={(event) => setSummaryPrompt(event.target.value)} placeholder={t(K("summary.promptPlaceholder"))} />
                <small>{summaryPrompt.length} / 600</small>
              </div>
              <div className={styles.summaryFormatGroup}>
                <span>{t(K("summary.format"))}</span>
                <div className={styles.summaryFormatChoices}>
                  {(["executive", "bullets"] as const).map((style) => (
                    <button
                      key={style}
                      type="button"
                      className={summaryStyle === style ? styles.summaryFormatActive : ""}
                      aria-pressed={summaryStyle === style}
                      onClick={() => {
                        setSummaryStyle(style);
                      }}
                    >
                      {style === "executive" ? <NotebookPen size={14} aria-hidden="true" /> : <ListChecks size={14} aria-hidden="true" />}
                      <span>{t(K(`summary.${style}`))}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : isTranslate ? (
            <div className={styles.translationGuide}>
              <span className={styles.translationGuideIcon}><Languages size={17} aria-hidden="true" /></span>
              <strong>{t(K("translate.guideTitle"))}</strong>
              <p>{t(K("translate.guideDescription"))}</p>
              <div><span>1</span>{t(K("translate.stepSource"))}</div>
              <div><span>2</span>{t(K("translate.stepTarget"))}</div>
              <div><span>3</span>{t(K("translate.stepOutput"))}</div>
            </div>
          ) : (
            <div className={styles.instructionPlaceholder}>
              <span>{t(K("instructions.placeholder"))}</span>
              <small>0 / 600</small>
            </div>
          )}
          {!isSummarize && !isTranslate && <div className={styles.checkList}>
            <div><i className={styles.checkedBox} />{t(K("instructions.extractTables"))}</div>
            <div><i className={styles.checkedBox} />{t(K("instructions.handwriting"))}</div>
            <div><i className={styles.checkedBox} />{t(K("instructions.layout"))}</div>
          </div>}
          </aside>
        }
        preview={
          <main className={styles.previewPanel} aria-label={t(K("a11y.preview"))}>
          <div className={styles.previewHeader}>
            <div><span>{t(K("preview.heading"))}</span><small>{isSummarize ? t(K("summary.workspace")) : isTranslate ? t(K("translate.workspace")) : t(K("preview.canvas"))}</small></div>
            <div className={styles.previewToolbar} aria-label={t(K("preview.controls"))}>
              {isSummarize ? <>
                <button type="button" className={styles.previewToolButton} onClick={() => setSummaryZoom((zoom) => Math.max(60, zoom - 10))} disabled={summaryZoom <= 60} aria-label={t(K("preview.zoomOut"))} title={t(K("preview.zoomOut"))}><ZoomOut size={14} aria-hidden="true" /></button>
                <button type="button" className={`${styles.previewToolButton} ${styles.previewZoomValue}`} onClick={() => setSummaryZoom(100)} aria-label={t(K("preview.zoomReset"))} title={t(K("preview.zoomReset"))}>{summaryZoom}%</button>
                <button type="button" className={styles.previewToolButton} onClick={() => setSummaryZoom((zoom) => Math.min(160, zoom + 10))} disabled={summaryZoom >= 160} aria-label={t(K("preview.zoomIn"))} title={t(K("preview.zoomIn"))}><ZoomIn size={14} aria-hidden="true" /></button>
                <span className={styles.toolbarDivider} />
                <button type="button" className={`${styles.previewToolButton} ${isComparingSource ? styles.previewToolButtonActive : ""}`} onClick={toggleSourceComparison} disabled={!canCompareSource} aria-pressed={isComparingSource} title={canCompareSource ? sourceFileForPreview ? t(K("preview.compare")) : t(K("summary.compareChooseSource")) : t(K("preview.compareUnavailable"))}><FileText size={13} aria-hidden="true" />{t(K("preview.compare"))}</button>
                <button type="button" className={`${styles.previewToolButton} ${isSummaryNoteOpen ? styles.previewToolButtonActive : ""}`} onClick={() => setIsSummaryNoteOpen((value) => !value)} disabled={!displayedSummary} aria-pressed={isSummaryNoteOpen} title={!displayedSummary ? t(K("summary.toolbarNeedsResult")) : t(K("preview.annotate"))}><NotebookPen size={13} aria-hidden="true" />{t(K("preview.annotate"))}</button>
                <button type="button" className={styles.previewToolButton} onClick={exportSummary} disabled={!displayedSummary} title={!displayedSummary ? t(K("summary.toolbarNeedsResult")) : t(K("summary.exportFormat"), { format: outputFormat })}><Download size={13} aria-hidden="true" />{t(K("preview.export"))}</button>
              </> : isTranslate && translationResult ? <button type="button" className={styles.previewToolButton} onClick={downloadTranslation}><Download size={13} aria-hidden="true" />{t(K("translate.downloadTxt"))}</button> : null}
            </div>
          </div>

          <div className={`${styles.previewStage} ${isSummarize || isTranslate ? styles.previewStageSummary : ""} ${isSummarize ? styles.previewStageSummaryDocument : ""}`}>
            {isSummarize ? (
              <div className={`${styles.summaryStage} ${isComparingSource && canCompareSource ? styles.summaryStageComparing : ""}`} role="region" aria-label={t(K("summary.workspace"))} tabIndex={0}>
                {isComparingSource && canCompareSource && sourceFileForPreview && <section className={styles.summarySourceCompare} aria-label={t(K("summary.sourcePreview"))}>
                  <header><strong>{t(K("summary.sourcePreview"))}</strong><span title={sourceFileName}>{sourceFileName}</span></header>
                  {sourcePreviewUrl ? isPdfSource
                    ? <div className={styles.summaryPdfSourceNotice}><FileText size={24} aria-hidden="true" /><p>{t(K("summary.pdfPreviewNote"))}</p><a href={sourcePreviewUrl} target="_blank" rel="noreferrer">{t(K("summary.openSource"))}<ArrowUpRight size={13} aria-hidden="true" /></a></div>
                    : <Image className={styles.summarySourceImage} src={sourcePreviewUrl} alt={sourceFileName} width={1600} height={1200} unoptimized />
                    : <div className={styles.summarySourceLoading} role="status">{t(K("summary.sourceLoading"))}</div>}
                </section>}
                <div className={`${styles.summaryDocumentColumn} ${isComparingSource && canCompareSource ? styles.summaryCompareDocument : ""}`} style={{ zoom: `${summaryZoom}%` }}>
                <article className={styles.summaryDocument}>
                  <div className={styles.summaryDocumentTopline}>
                    <span className={styles.sampleBadge}>{displayedSummary ? t(K("summary.generated")) : t(K("summary.sample"))}</span>
                    <span>{summaryWorkspaceTab === "examples" ? t(K("summary.sampleDoc")) : summaryFilename || selectedFile?.name || t(K("summary.sampleDoc"))}</span>
                  </div>
                  <div className={styles.summaryDocumentHeading}>
                    <small>{t(K(`summary.${summaryStyle}`)).toUpperCase()}</small>
                    <h3>{displayedSummary?.title ?? t(K("summary.docTitle"))}</h3>
                    <p>{displayedSummary?.executiveSummary ?? `${t(K("summary.leadBefore"))}${t(K("summary.leadValue"))}${t(K("summary.leadAfter"))}`}</p>
                  </div>
                  {!displayedSummary && <div className={styles.summaryMetric}>
                    <span><small>{t(K("summary.totalRevenue"))}</small><strong>$8.42M</strong><em>{t(K("summary.vsQ1"), { value: "+18.6%" })}</em></span>
                    <span><small>{t(K("summary.netProfit"))}</small><strong>$1.68M</strong><em>{t(K("summary.vsQ1"), { value: "+34.4%" })}</em></span>
                    <span><small>{t(K("summary.grossProfit"))}</small><strong>$3.92M</strong><em>{t(K("summary.vsQ1"), { value: "+22.1%" })}</em></span>
                  </div>}
                  {displayedSummary?.sections?.length ? displayedSummary.sections.map((section, index) => <div className={styles.summaryTakeaways} key={`${index}-${section.heading}`}>
                    <h4>{section.heading}</h4>
                    <ul>{section.items.map((item, itemIndex) => <li key={`${itemIndex}-${item}`}>{item}</li>)}</ul>
                  </div>) : displayedSummary ? <>
                    {displayedSummary.keyTakeaways.length > 0 && <div className={styles.summaryTakeaways}>
                      <h4>{t(K("summary.takeawaysHeading"))}</h4>
                      <ul>{displayedSummary.keyTakeaways.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul>
                    </div>}
                    {displayedSummary.actionItems.length > 0 && <div className={styles.summaryTakeaways}>
                      <h4>{t(K("summary.actionItems"))}</h4>
                      <ul>{displayedSummary.actionItems.map((item, index) => <li key={`${index}-${item.task}`}>{item.task}{item.owner ? ` · ${item.owner}` : ""}{item.dueDate ? ` · ${item.dueDate}` : ""}</li>)}</ul>
                    </div>}
                    {displayedSummary.decisions.length > 0 && <div className={styles.summaryTakeaways}><h4>{t(K("summary.decisions"))}</h4><ul>{displayedSummary.decisions.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul></div>}
                    {displayedSummary.importantDates.length > 0 && <div className={styles.summaryTakeaways}><h4>{t(K("summary.importantDates"))}</h4><ul>{displayedSummary.importantDates.map((item, index) => <li key={`${index}-${item.date}-${item.event}`}>{item.date} · {item.event}</li>)}</ul></div>}
                  </> : <div className={styles.summaryTakeaways}>
                    <h4>{t(K("summary.takeawaysHeading"))}</h4>
                    <ul>{[t(K("summary.takeaway1")), t(K("summary.takeaway2"))].map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul>
                  </div>}
                  {!displayedSummary && <div className={styles.summaryDocumentFooter}>{t(K("summary.footer"))}</div>}
                </article>
                {isSummaryNoteOpen && displayedSummary && <section className={styles.summaryAnnotation}>
                  <label htmlFor="summary-annotation"><NotebookPen size={14} aria-hidden="true" />{t(K("summary.noteLabel"))}</label>
                  <textarea id="summary-annotation" value={summaryNote} onChange={(event) => setSummaryNote(event.target.value)} placeholder={t(K("summary.notePlaceholder"))} />
                </section>}
                </div>
                {isSummarizing && <div className={styles.summaryLoading} role="status"><Sparkles size={18} aria-hidden="true" /><strong>{t(K("summary.loading"))}</strong><span>{t(K("summary.loadingHint"))}</span></div>}
              </div>
            ) : isTranslate ? (
              <div className={styles.translationStage}>
                <div className={styles.translationFlow}>
                  <article className={styles.translationFileCard}>
                    <small>{t(K("translate.sourceDocument"))}</small>
                    <span className={styles.translationFileIcon}><FileText size={19} aria-hidden="true" /></span>
                    <strong title={selectedFile?.name}>{selectedFile?.name ?? t(K("translate.noSource"))}</strong>
                    <span>{t(K(translationSourceLanguage === "auto" ? "translate.detectAutomatically" : `translate.language.${translationSourceLanguage.toLowerCase()}`))}</span>
                  </article>
                  <ArrowRight className={styles.translationFlowArrow} size={20} aria-hidden="true" />
                  <article className={`${styles.translationFileCard} ${styles.translationOutputCard}`}>
                    <small>{t(K("translate.translatedDocument"))}</small>
                    <span className={styles.translationFileIcon}><Languages size={19} aria-hidden="true" /></span>
                    <strong>{t(K(`translate.language.${translationTargetLanguage.toLowerCase()}`))}</strong>
                    <span>{t(K("translate.outputReadyAfter"))}</span>
                  </article>
                </div>
                {translationResult ? (
                  <section className={styles.translationTextResult} aria-label={t(K("translate.previewTitle"))}>
                    <header><div><Languages size={15} aria-hidden="true" /><strong>{t(K("translate.previewTitle"))} · {t(K(`translate.language.${translationTargetLanguage.toLowerCase()}`))}</strong></div><button type="button" onClick={downloadTranslation}><Download size={14} aria-hidden="true" />{t(K("translate.downloadTxt"))}</button></header>
                    <pre>{translationResult.translatedText}</pre>
                  </section>
                ) : (
                  <div className={styles.translationPreviewNote}>
                    <Languages size={16} aria-hidden="true" />
                    <div><strong>{t(K("translate.previewTitle"))}</strong><span>{t(K(selectedFile ? "translate.previewHint" : "translate.uploadHint"))}</span></div>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className={styles.pageRail} aria-hidden="true">
                  {[1, 2, 3, 4].map((page) => (
                    <div key={page} className={`${styles.pageThumb} ${page === 1 ? styles.pageThumbActive : ""}`}>
                      <span>{page}</span>
                      <div><i /><i /><i /></div>
                    </div>
                  ))}
                </div>
                <div className={styles.canvas}>
                  <div className={styles.documentSheet} aria-hidden="true">
                    <div className={styles.sheetTopline}><span /><span>{t(K("preview.sheetLabel"))}</span></div>
                    <div className={styles.sheetTitle} />
                    <div className={styles.sheetSubtitle} />
                    <div className={styles.sheetParagraph}><i /><i /><i /><i /></div>
                    <div className={styles.sheetDataRow}>
                      <div className={styles.sheetTable}><i /><i /><i /><i /><i /><i /></div>
                      <div className={styles.sheetChart}><b /><b /><b /><b /><b /></div>
                    </div>
                    <div className={styles.sheetParagraph}><i /><i /><i /></div>
                  </div>
                  <div className={styles.canvasEmptyState}>
                    <span><FileText size={22} aria-hidden="true" /></span>
                    <strong>{t(K("preview.emptyTitle"))}</strong>
                    <small>{t(K("preview.emptyHint"))}</small>
                  </div>
                  <div className={styles.canvasPageNumber}>{t(K("preview.pageOf"))}</div>
                </div>
              </>
            )}
          </div>

          {isSummarize ? (
            <section className={styles.summaryTabbedWorkspace}>
              <div className={styles.summaryWorkspaceTabs} role="tablist" aria-label={t(K("summary.workspaceTabs"))}>
                <button id="summary-results-tab" type="button" role="tab" aria-selected={summaryWorkspaceTab === "latest"} aria-controls="summary-results-panel" className={summaryWorkspaceTab === "latest" ? styles.summaryWorkspaceTabActive : ""} onClick={() => setSummaryWorkspaceTab("latest")}>
                  {t(K("summary.tabLatest"))}
                </button>
                <button id="summary-examples-tab" type="button" role="tab" aria-selected={summaryWorkspaceTab === "examples"} aria-controls="summary-examples-panel" className={summaryWorkspaceTab === "examples" ? styles.summaryWorkspaceTabActive : ""} onClick={() => setSummaryWorkspaceTab("examples")}>
                  {t(K("summary.tabExamples"))}
                </button>
              </div>
              <div id="summary-results-panel" className={styles.summaryWorkspacePanel} role="tabpanel" aria-labelledby="summary-results-tab" hidden={summaryWorkspaceTab !== "latest"}>
                {summaryWorkspaceTab === "latest" ? (
                  <section className={styles.historySection} aria-labelledby="document-history-heading">
                    <header className={styles.historyHeader}>
                      <div className={styles.historyTitle}>
                        <span><HistoryIcon size={16} aria-hidden="true" /></span>
                        <div><h2 id="document-history-heading">{t(K("summary.historyHeading"))}</h2><p>{t(K("summary.historyDescription"))}</p></div>
                      </div>
                      <div className={styles.historyActions}>
                        <button type="button" onClick={refreshDocumentHistory} disabled={historyLoading} aria-label={t(K("summary.refreshHistory"))}>
                          <RefreshCw size={15} className={historyLoading ? styles.historySpin : undefined} /> {t(K("summary.refreshHistory"))}
                        </button>
                        <Link href="/history?type=document">{t(K("summary.allHistory"))} <ArrowRight size={14} aria-hidden="true" /></Link>
                      </div>
                    </header>
                    {historyError ? <p className={styles.historyMessage} role="alert">{historyError}</p> : historyLoading ? (
                      <div className={styles.historyMessage} role="status"><LoaderCircle size={16} className={styles.historySpin} /> {t(K("summary.historyLoading"))}</div>
                    ) : documentHistory.length ? (
                      <div className={styles.historyGrid}>
                        {documentHistory.map((item) => {
                          const saved = item.documentSummary;
                          if (!saved) return null;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              className={`${styles.historyCard} ${selectedHistoryId === item.id ? styles.historyCardActive : ""}`}
                              aria-pressed={selectedHistoryId === item.id}
                              onClick={() => openDocumentHistory(item)}
                            >
                              <span className={styles.historyCardHeading}>
                                <span className={styles.historyFileIcon}><FileText size={18} aria-hidden="true" /></span>
                                <span className={styles.historyCardNames}><strong>{saved.summary.title || item.title}</strong><small>{saved.filename}</small></span>
                                <ArrowUpRight size={15} aria-hidden="true" />
                              </span>
                              <span className={styles.historyExcerpt}>{saved.summary.executiveSummary}</span>
                              <span className={styles.historyMeta}><Clock3 size={12} aria-hidden="true" />{historyDate(item.createdAt)}</span>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className={styles.historyEmpty}>
                        <FileText size={22} aria-hidden="true" />
                        <div><strong>{t(K("summary.historyEmpty"))}</strong><span>{t(K("summary.historyEmptyHint"))}</span></div>
                      </div>
                    )}
                  </section>
                ) : null}
              </div>
              <div id="summary-examples-panel" className={styles.summaryWorkspacePanel} role="tabpanel" aria-labelledby="summary-examples-tab" hidden={summaryWorkspaceTab !== "examples"}>
                {summaryWorkspaceTab === "examples" ? <p className={styles.summaryExampleNote}>{t(K("summary.exampleShowsAbove"))}</p> : null}
              </div>
            </section>
          ) : isTranslate ? (
            <div className={styles.translationResultCard}>
              <div><Languages size={14} aria-hidden="true" /><strong>{t(K(translationResult ? "translate.complete" : "output.translated"))}</strong></div>
              <p>{translationResult ? t(K("translate.completedWith"), { model: translationResult.model, credits: translationResult.creditsUsed }) : t(K("translate.resultHint"))}</p>
            </div>
          ) : (
            <div className={styles.outputCards}>
              {outputs.map(({ key, icon: Icon }) => (
                <div className={styles.outputCard} key={key}>
                  <div className={styles.outputTitle}><Icon size={13} aria-hidden="true" /><strong>{t(key)}</strong></div>
                  <i /><i /><i />
                  <small>{t(K("output.pending"))}</small>
                </div>
              ))}
            </div>
          )}
          </main>
        }
        right={
          <aside className={styles.settingsPanel} aria-label={t(K("a11y.settings"))}>
          <PanelHeading step="3">{t(K("settings.heading"))}</PanelHeading>
          <div className={styles.settingGroup}>
            <div className={styles.settingLabel}>{isTranslate ? t(K("translate.serviceLabel")) : t(K("settings.model"))} <span>ⓘ</span></div>
            {isSummarize ? <div className={`${styles.modelCards} ${styles.singleModel}`}><div className={`${styles.modelCard} ${styles.modelCardActive}`}><i /><strong>{t(K("summary.modelName"))}</strong><small>{t(K("summary.modelHint"))}</small></div></div> : isTranslate ? <div className={styles.translationServiceStatus}><span /><div><strong>{summaryOptions.model}</strong><small>{t(K("translate.modelCredits"), { credits: summaryOptions.credits })}</small></div></div> : <div className={styles.modelCards}>
              <div className={`${styles.modelCard} ${styles.modelCardActive}`}><i /><strong>{t(K("settings.standard"))}</strong><small>{t(K("settings.standardHint"))}</small></div>
              <div className={styles.modelCard}><i /><strong>{t(K("settings.premium"))}</strong><small>{t(K("settings.premiumHint"))}</small></div>
            </div>}
          </div>
          <div className={styles.settingGroup}>
            <div className={styles.settingLabel}>{t(K("settings.outputFormat"))}</div>
            <div className={styles.formatCards}>
              {(isTranslate ? ["TXT"] : documentOutputFormats).map((format) => {
                const selected = isTranslate ? format === "TXT" : outputFormat === format;
                return (
                  <button
                    key={format}
                    className={`${styles.formatCard} ${selected ? styles.formatCardActive : ""}`}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => { if (!isTranslate) setOutputFormat(format as DocumentOutputFormat); }}
                  >
                    <FileText size={18} aria-hidden="true" /><span>{format}</span>
                  </button>
                );
              })}
            </div>
          </div>
          {isSummarize ? (
            <>
              <SelectControl label={t(K("settings.language"))} value={summaryLanguage} onChange={(value) => setSummaryLanguage(value as "auto" | "English" | "Thai")} options={[{ value: "auto", label: t(K("summary.languageAuto")) }, { value: "English", label: t(K("summary.languageEnglish")) }, { value: "Thai", label: t(K("summary.languageThai")) }]} />
              <SelectControl label={t(K("summary.length"))} value={summaryLength} onChange={(value) => setSummaryLength(value as "brief" | "standard" | "detailed")} options={[{ value: "brief", label: t(K("summary.lengthBrief")) }, { value: "standard", label: t(K("summary.lengthStandard")) }, { value: "detailed", label: t(K("summary.lengthDetailed")) }]} />
              <SelectPlaceholder label={t(K("settings.tone"))} value={t(K("summary.toneValue"))} />
            </>
            ) : isTranslate ? (
              <div className={styles.translationLanguageSettings}>
                <SelectControl label={t(K("translate.sourceLanguage"))} value={translationSourceLanguage} onChange={(value) => {
                  setTranslationSourceLanguage(value as TranslationLanguage);
                  if (value !== "auto" && value === translationTargetLanguage) setTranslationTargetLanguage(value === "Thai" ? "English" : "Thai");
                }} options={[{ value: "auto", label: t(K("translate.detectAutomatically")) }, { value: "Thai", label: t(K("translate.language.thai")) }, { value: "English", label: t(K("translate.language.english")) }, { value: "Japanese", label: t(K("translate.language.japanese")) }, { value: "Chinese", label: t(K("translate.language.chinese")) }]} />
                <SelectControl label={t(K("translate.targetLanguage"))} value={translationTargetLanguage} onChange={(value) => setTranslationTargetLanguage(value as Exclude<TranslationLanguage, "auto">)} options={[{ value: "Thai", label: t(K("translate.language.thai")) }, { value: "English", label: t(K("translate.language.english")) }, { value: "Japanese", label: t(K("translate.language.japanese")) }, { value: "Chinese", label: t(K("translate.language.chinese")) }].filter((option) => translationSourceLanguage === "auto" || option.value !== translationSourceLanguage)} />
              </div>
            ) : (
              <>
              <SelectPlaceholder label={t(K("settings.language"))} value={t(K("settings.languageValue"))} />
              <SelectPlaceholder label={t(K("settings.pageRange"))} value={t(K("source.allPages"))} />
              <SelectPlaceholder label={t(K("settings.depth"))} value={t(K("settings.depthValue"))} />
              <SelectPlaceholder label={t(K("settings.tone"))} value={t(K("settings.toneValue"))} />
            </>
          )}
          <div className={styles.estimate}><span>{t(K("settings.estimate"))}</span><strong>{isSummarize || isTranslate ? t(K(summaryOptions.credits === 1 ? "summary.creditsSingular" : "summary.creditsPlural"), { value: summaryOptions.credits }) : t(K("settings.credits"))}</strong></div>
          <button className={styles.generateButton} type="button" disabled={isTranslate ? (!selectedFile || isTranslating) : (!isSummarize || !selectedFile || isSummarizing)} onClick={() => { if (isSummarize) void generateSummary(); else if (isTranslate) void generateTranslation(); }}>
            <span>{isSummarizing ? t(K("summary.generating")) : isTranslating ? t(K("translate.translating")) : isSummarize ? t(K("summary.generate")) : isTranslate ? t(K("translate.generate")) : t(K("settings.generate"))}</span>
            <Sparkles size={17} aria-hidden="true" />
          </button>
          {summaryError && <div className={styles.summaryError} role="alert">{summaryError}</div>}
          <div className={styles.secureNote}><span />{isSummarize ? t(K("summary.processingNote")) : isTranslate ? t(K("translate.processingNote")) : t(K("settings.secure"))}</div>
          </aside>
        }
      />

      <section className={styles.resourceShelf} aria-label={t(K("a11y.shelf"))}>
        <div className={styles.learnArea}>
          <div className={styles.shelfHeading}>
            <div><h2>{t(K("learn.heading"))}</h2><p>{t(K("learn.subheading"))}</p></div>
            <a href="#document-guides">{t(K("learn.viewAll"))} <ArrowUpRight size={13} aria-hidden="true" /></a>
          </div>
          <div className={styles.guideCards} id="document-guides">
            {guides.map((guide) => (
              <div className={styles.guideCard} key={guide.time}>
                <div className={`${styles.guideThumb} ${styles[`guideTone_${guide.tone}`]}`}>
                  <span>{t(guide.title)}</span><Play size={14} fill="currentColor" aria-hidden="true" />
                </div>
                <strong>{t(guide.title)}</strong>
                <small>{t(guide.detail)}</small>
                <em>{guide.time}</em>
              </div>
            ))}
          </div>
        </div>
        <div className={styles.toolsArea}>
          <div className={styles.shelfHeading}><div><h2>{t(K("tools.heading"))}</h2><p>{t(K("tools.subheading"))}</p></div></div>
          <div className={styles.documentToolCards}>
            {documentTools.map(({ title, detail, icon: Icon }) => (
              <div className={styles.documentToolCard} key={title}>
                <span><Icon size={20} aria-hidden="true" /></span>
                <strong>{t(title)}</strong>
                <small>{t(detail)}</small>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
