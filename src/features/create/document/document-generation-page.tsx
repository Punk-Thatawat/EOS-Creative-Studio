"use client";

import {
  ArrowRight,
  ArrowUpRight,
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
  ScanText,
  Sparkles,
  Table2,
  TrendingDown,
  TrendingUp,
  Minus,
  ShieldAlert,
  Lightbulb,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CreatorWorkspaceLayout } from "@/components/create/creator-workspace-layout";
import { MobileModeDropdown } from "@/features/create/components/mobile-mode-dropdown";
import { Dropdown } from "@/components/ui/dropdown";
import { getDocumentSummaryOptions, summarizeDocument, type DocumentSummary } from "@/lib/api/document-summarize";
import { translateDocument, type DocumentTranslation, type TranslationLanguage, type TranslationOutputFormat } from "@/lib/api/document-translate";
import { listGenerationModels, type GenerationModelOption } from "@/lib/api/generation-models";
import { fetchHistory, fetchOriginalDocumentFile, fetchTranslatedDocumentFile, type HistoryItem } from "@/lib/api/history";
import type { TranslationKey } from "@/lib/i18n/dictionary";
import { useLocale } from "@/lib/i18n/locale-provider";
import { VideoModelDropdown } from "../video-model-dropdown";
import { DocumentFeatureGenerationPage } from "./document-feature-generation-page";
import { failDocumentGeneration, finishDocumentGeneration, startDocumentGeneration } from "./document-generation-progress";
import { ImageTutorialButton } from "../image-generation/components/image-tutorial-button";
import styles from "./document-generation-page.module.css";

const K = (key: string) => `create.document.${key}` as TranslationKey;

type ModeId = "ocr" | "summarize" | "translate" | "contract" | "report" | "form";
type SummaryPurpose = "general" | "meeting" | "decision" | "report" | "learning";
type SummaryAudience = "general" | "executive" | "team" | "client" | "specialist";
type SummaryStyle = "executive" | "bullets";
type SummaryWorkspaceTab = "latest" | "examples";
type TranslationWorkspaceTab = "latest" | "source";
type DocumentOutputFormat = "DOCX" | "PDF" | "TXT" | "JSON";
type ReportOutputFormat = "PDF" | "PPTX" | "DOCX" | "JSON";

const documentModelFeatureByMode: Record<ModeId, string> = {
  ocr: "document-ocr",
  summarize: "document-summary",
  translate: "document-translate",
  contract: "document-contract",
  report: "document-report",
  form: "document-form",
};

const documentTutorialFeatureByMode: Record<ModeId, string> = {
  ocr: "document-ocr",
  summarize: "document-summary",
  translate: "document-translate",
  contract: "document-contract",
  report: "document-report",
  form: "document-form",
};

const documentOutputFormats: DocumentOutputFormat[] = ["DOCX", "PDF", "TXT", "JSON"];
const reportOutputFormats: ReportOutputFormat[] = ["PDF", "PPTX", "DOCX", "JSON"];
const translationOutputFormats: TranslationOutputFormat[] = ["DOCX", "PDF", "TXT", "JSON"];
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
  { id: "contract", icon: FileCheck2, available: true },
  { id: "form", icon: ListChecks, available: true },
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

function translatedHistoryTitle(text: string, fallback: string): string {
  const firstLine = text.split(/\r?\n/).map((line) => line.trim()).find(Boolean);
  return firstLine || fallback;
}

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character] ?? character);
}

function safeFileName(value: string): string {
  return value.replace(/\.[^/.]+$/, "").replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").trim() || "document-summary";
}

type SummaryExportLabels = { takeawaysHeading: string; actionItems: string; decisions: string; importantDates: string; notes: string };

type ReportExportLabels = SummaryExportLabels & {
  metrics: string;
  findings: string;
  risks: string;
  recommendations: string;
  period: string;
};

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

type ReportDashboardLabels = {
  generated: string;
  metrics: string;
  findings: string;
  risks: string;
  recommendations: string;
  actions: string;
  period: string;
  source: string;
  noMetrics: string;
};

function ReportDashboard({ summary, filename, labels }: { summary: DocumentSummary; filename: string; labels: ReportDashboardLabels }) {
  return (
    <article className={styles.reportDashboard}>
      <div className={styles.reportDashboardTopline}>
        <span className={styles.sampleBadge}>{labels.generated}</span>
        <span>{filename}</span>
      </div>
      <header className={styles.reportDashboardHeader}>
        <div>
          <small>{summary.reportTypeLabel ?? labels.generated}</small>
          <h3>{summary.title}</h3>
          {summary.reportPeriod ? <span className={styles.reportDashboardPeriod}>{labels.period}: {summary.reportPeriod}</span> : null}
        </div>
        {summary.reportTypeConfidence !== undefined ? <span className={styles.reportDashboardConfidence}>{Math.round(summary.reportTypeConfidence * 100)}%</span> : null}
      </header>
      <p className={styles.reportDashboardExecutive}>{summary.executiveSummary}</p>

      <section className={styles.reportDashboardSection}>
        <h4>{labels.metrics}</h4>
        {summary.metrics?.length ? <div className={styles.reportMetricGrid}>{summary.metrics.map((metric) => {
          const TrendIcon = metric.trend === "up" ? TrendingUp : metric.trend === "down" ? TrendingDown : Minus;
          return <div className={styles.reportMetricCard} key={`${metric.label}-${metric.value}`}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <small className={metric.trend === "down" ? styles.reportMetricDown : styles.reportMetricUp}><TrendIcon size={13} aria-hidden="true" />{metric.change ?? metric.context ?? "—"}</small>
          </div>;
        })}</div> : <p className={styles.reportDashboardEmpty}>{labels.noMetrics}</p>}
      </section>

      {summary.sections?.length ? <section className={styles.reportDashboardSection}><h4>{labels.findings}</h4><div className={styles.reportDashboardFindings}>{summary.sections.map((section) => <div key={section.heading}><strong>{section.heading}</strong><ul>{section.items.map((item) => <li key={item}>{item}</li>)}</ul></div>)}</div></section> : null}
      {(summary.risks?.length || summary.recommendations?.length) ? <div className={styles.reportDashboardColumns}>
        {summary.risks?.length ? <section className={`${styles.reportDashboardSection} ${styles.reportDashboardRisk}`}><h4><ShieldAlert size={14} aria-hidden="true" />{labels.risks}</h4><ul>{summary.risks.map((item) => <li key={item}>{item}</li>)}</ul></section> : null}
        {summary.recommendations?.length ? <section className={`${styles.reportDashboardSection} ${styles.reportDashboardRecommendation}`}><h4><Lightbulb size={14} aria-hidden="true" />{labels.recommendations}</h4><ul>{summary.recommendations.map((item) => <li key={item}>{item}</li>)}</ul></section> : null}
      </div> : null}
      {summary.actionItems.length ? <section className={styles.reportDashboardSection}><h4>{labels.actions}</h4><ul className={styles.reportDashboardActionList}>{summary.actionItems.map((item) => <li key={item.task}><span>{item.task}</span><small>{[item.owner, item.dueDate].filter(Boolean).join(" · ") || "—"}</small></li>)}</ul></section> : null}
      <footer className={styles.reportDashboardFooter}>{labels.source}: {filename}</footer>
    </article>
  );
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

function createStoredZip(files: Array<{ name: string; contents: string }>, mimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"): Blob {
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
  return new Blob([blobBytes], { type: mimeType });
}

type PptxTextBox = { text: string; x: number; y: number; w: number; h: number; fontSize: number; color?: string; bold?: boolean; fill?: string; radius?: boolean };

function pptxTextBoxXml(shape: PptxTextBox, id: number): string {
  const emu = (value: number) => Math.round(value * 914400);
  const fill = shape.fill ? `<a:solidFill><a:srgbClr val="${shape.fill}"/></a:solidFill>` : "<a:noFill/>";
  const geometry = shape.radius ? "roundRect" : "rect";
  const paragraphs = shape.text.split(/\r?\n/).map((line) => `<a:p><a:r><a:rPr lang="th-TH" sz="${Math.round(shape.fontSize * 100)}" b="${shape.bold ? 1 : 0}"><a:solidFill><a:srgbClr val="${shape.color ?? "252A2F"}"/></a:solidFill><a:latin typeface="Aptos"/></a:rPr><a:t>${escapeXml(line)}</a:t></a:r><a:endParaRPr lang="th-TH" sz="${Math.round(shape.fontSize * 100)}"/></a:p>`).join("");
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Text ${id}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${emu(shape.x)}" y="${emu(shape.y)}"/><a:ext cx="${emu(shape.w)}" cy="${emu(shape.h)}"/></a:xfrm><a:prstGeom prst="${geometry}"><a:avLst/></a:prstGeom>${fill}<a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr wrap="square" rtlCol="0"/><a:lstStyle/>${paragraphs}</p:txBody></p:sp>`;
}

function createPptxSlideXml(shapes: PptxTextBox[], background = "FFFDFC"): string {
  const emu = (value: number) => Math.round(value * 914400);
  const backgroundShape: PptxTextBox = { text: "", x: 0, y: 0, w: 13.333, h: 7.5, fontSize: 1, fill: background };
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${emu(13.333)}" cy="${emu(7.5)}"/><a:chOff x="0" y="0"/><a:chExt cx="${emu(13.333)}" cy="${emu(7.5)}"/></a:xfrm></p:grpSpPr>${pptxTextBoxXml(backgroundShape, 2)}${shapes.map((shape, index) => pptxTextBoxXml(shape, index + 3)).join("")}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
}

function createPptxBlob(summary: DocumentSummary, labels: ReportExportLabels, filename: string): Blob {
  const orange = "F26B38";
  const dark = "252A2F";
  const muted = "5E6670";
  const slides: PptxTextBox[][] = [];
  slides.push([
    { text: "EOS CREATIVE STUDIO · REPORT", x: 0.75, y: 0.55, w: 7, h: 0.25, fontSize: 9, color: orange, bold: true },
    { text: summary.title, x: 0.75, y: 1.25, w: 11.8, h: 0.9, fontSize: 28, color: dark, bold: true },
    { text: summary.executiveSummary, x: 0.78, y: 2.45, w: 10.9, h: 1.25, fontSize: 15, color: muted },
    ...(summary.reportPeriod ? [{ text: `${labels.period}: ${summary.reportPeriod}`, x: 0.78, y: 4.05, w: 6.5, h: 0.3, fontSize: 11, color: orange, bold: true }] : []),
    { text: filename, x: 0.78, y: 6.75, w: 9, h: 0.22, fontSize: 8, color: "8B9298" },
  ]);
  if (summary.metrics?.length) {
    const metricShapes: PptxTextBox[] = [{ text: labels.metrics, x: 0.6, y: 0.45, w: 8, h: 0.4, fontSize: 22, color: dark, bold: true }];
    summary.metrics.slice(0, 6).forEach((metric, index) => {
      const column = index % 3;
      const row = Math.floor(index / 3);
      const x = 0.65 + column * 4.15;
      const y = 1.3 + row * 2.25;
      metricShapes.push(
        { text: "", x, y, w: 3.75, h: 1.7, fontSize: 1, color: dark, fill: "FFF7F2", radius: true },
        { text: metric.label, x: x + 0.22, y: y + 0.22, w: 3.25, h: 0.24, fontSize: 9, color: muted },
        { text: metric.value, x: x + 0.22, y: y + 0.57, w: 3.25, h: 0.46, fontSize: 22, color: dark, bold: true },
        { text: [metric.change, metric.context].filter(Boolean).join(" · ") || "—", x: x + 0.22, y: y + 1.2, w: 3.25, h: 0.22, fontSize: 8, color: metric.trend === "down" ? "B34A35" : "24946A" },
      );
    });
    slides.push(metricShapes);
  }
  const findings = summary.sections?.flatMap((section) => [section.heading, ...section.items.map((item) => `• ${item}`)]) ?? [];
  const risks = (summary.risks ?? []).map((item) => `• ${item}`).join("\n") || "—";
  const recommendations = (summary.recommendations ?? summary.actionItems.map((item) => item.task)).map((item) => `• ${item}`).join("\n") || "—";
  slides.push([
    { text: labels.findings, x: 0.65, y: 0.45, w: 6, h: 0.4, fontSize: 22, color: dark, bold: true },
    { text: findings.join("\n") || "—", x: 0.7, y: 1.2, w: 5.9, h: 5.5, fontSize: 12, color: muted },
    { text: labels.risks, x: 7.0, y: 1.2, w: 5.2, h: 0.28, fontSize: 13, color: "B34A35", bold: true },
    { text: risks, x: 7.0, y: 1.62, w: 5.2, h: 1.85, fontSize: 11, color: muted },
    { text: labels.recommendations, x: 7.0, y: 3.85, w: 5.2, h: 0.28, fontSize: 13, color: "24946A", bold: true },
    { text: recommendations, x: 7.0, y: 4.27, w: 5.2, h: 1.85, fontSize: 11, color: muted },
  ]);
  const slideFiles = slides.map((shapes, index) => ({ name: `ppt/slides/slide${index + 1}.xml`, contents: createPptxSlideXml(shapes) }));
  const slideRels = slides.map((_, index) => ({ name: `ppt/slides/_rels/slide${index + 1}.xml.rels`, contents: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>` }));
  const slideOverrides = slides.map((_, index) => `<Override PartName="/ppt/slides/slide${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join("");
  const slideIds = slides.map((_, index) => `<p:sldId id="${256 + index}" r:id="rId${index + 2}"/>`).join("");
  const presentationRels = slides.map((_, index) => `<Relationship Id="rId${index + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${index + 1}.xml"/>`).join("");
  return createStoredZip([
    { name: "[Content_Types].xml", contents: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>${slideOverrides}</Types>` },
    { name: "_rels/.rels", contents: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/></Relationships>` },
    { name: "ppt/presentation.xml", contents: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>${slideIds}</p:sldIdLst><p:sldSz cx="12192000" cy="6858000" type="screen16x9"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>` },
    { name: "ppt/_rels/presentation.xml.rels", contents: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>${presentationRels}</Relationships>` },
    { name: "ppt/slideMasters/slideMaster1.xml", contents: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld><p:sldLayoutIdLst><p:sldLayoutId id="1" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles><p:clrMap accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" bg1="lt1" bg2="lt2" folHlink="folHlink" hlink="hlink" tx1="dk1" tx2="dk2"/></p:sldMaster>` },
    { name: "ppt/slideMasters/_rels/slideMaster1.xml.rels", contents: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/></Relationships>` },
    { name: "ppt/slideLayouts/slideLayout1.xml", contents: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank"><p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>` },
    { name: "ppt/slideLayouts/_rels/slideLayout1.xml.rels", contents: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>` },
    { name: "ppt/theme/theme1.xml", contents: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="EOS"><a:themeElements><a:clrScheme name="EOS"><a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1><a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="252A2F"/></a:dk2><a:lt2><a:srgbClr val="FFFDFC"/></a:lt2><a:accent1><a:srgbClr val="F26B38"/></a:accent1><a:accent2><a:srgbClr val="24946A"/></a:accent2><a:accent3><a:srgbClr val="B34A35"/></a:accent3><a:accent4><a:srgbClr val="5E6670"/></a:accent4><a:accent5><a:srgbClr val="F1DED4"/></a:accent5><a:accent6><a:srgbClr val="FFF7F2"/></a:accent6><a:hlink><a:srgbClr val="0563C1"/></a:hlink><a:folHlink><a:srgbClr val="954F72"/></a:folHlink></a:clrScheme><a:fontScheme name="EOS"><a:majorFont><a:latin typeface="Aptos Display"/></a:majorFont><a:minorFont><a:latin typeface="Aptos"/></a:minorFont></a:fontScheme><a:fmtScheme name="EOS"><a:fillStyleLst/><a:lnStyleLst/><a:effectStyleLst/><a:bgFillStyleLst/></a:fmtScheme></a:themeElements></a:theme>` },
    ...slideFiles,
    ...slideRels,
  ], "application/vnd.openxmlformats-officedocument.presentationml.presentation");
}

function createDocxBlob(summary: DocumentSummary, note: string, labels: SummaryExportLabels): Blob {
  const paragraph = (text: string, heading = false) => `<w:p>${heading ? "<w:pPr><w:pStyle w:val=\"Heading1\"/></w:pPr>" : ""}<w:r>${heading ? "<w:rPr><w:b/><w:sz w:val=\"30\"/></w:rPr>" : ""}<w:t xml:space=\"preserve\">${escapeXml(text)}</w:t></w:r></w:p>`;
  const paragraphs = [paragraph(summary.title, true), paragraph(summary.executiveSummary)];
  if (summary.reportPeriod) paragraphs.push(paragraph(`Reporting period: ${summary.reportPeriod}`));
  if (summary.metrics?.length) paragraphs.push(paragraph("Key metrics", true), ...summary.metrics.map((metric) => paragraph(`• ${metric.label}: ${metric.value}${metric.change ? ` (${metric.change})` : ""}${metric.context ? ` · ${metric.context}` : ""}`)));
  if (summary.sections?.length) for (const section of summary.sections) paragraphs.push(paragraph(section.heading, true), ...section.items.map((item) => paragraph(`• ${item}`)));
  else if (summary.keyTakeaways.length) paragraphs.push(paragraph(labels.takeawaysHeading, true), ...summary.keyTakeaways.map((item) => paragraph(`• ${item}`)));
  if (summary.actionItems.length) paragraphs.push(paragraph(labels.actionItems, true), ...summary.actionItems.map((item) => paragraph(`• ${item.task}${item.owner ? ` · ${item.owner}` : ""}${item.dueDate ? ` · ${item.dueDate}` : ""}`)));
  if (summary.decisions.length) paragraphs.push(paragraph(labels.decisions, true), ...summary.decisions.map((item) => paragraph(`• ${item}`)));
  if (summary.importantDates.length) paragraphs.push(paragraph(labels.importantDates, true), ...summary.importantDates.map((item) => paragraph(`• ${item.date} · ${item.event}`)));
  if (summary.risks?.length) paragraphs.push(paragraph("Risks & watchouts", true), ...summary.risks.map((item) => paragraph(`• ${item}`)));
  if (summary.recommendations?.length) paragraphs.push(paragraph("Recommendations", true), ...summary.recommendations.map((item) => paragraph(`• ${item}`)));
  if (note.trim()) paragraphs.push(paragraph(labels.notes, true), ...note.trim().split(/\r?\n/).map((line) => paragraph(line)));
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs.join("")}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>`;
  return createStoredZip([
    { name: "[Content_Types].xml", contents: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>` },
    { name: "_rels/.rels", contents: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>` },
    { name: "word/document.xml", contents: documentXml },
  ]);
}

function createTranslatedDocxBlob(text: string): Blob {
  const paragraph = (value: string) => `<w:p><w:r><w:t xml:space="preserve">${escapeXml(value)}</w:t></w:r></w:p>`;
  const paragraphs = text.split(/\r?\n/).map((line) => paragraph(line));
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

function base64Blob(data: string, mimeType: string): Blob {
  const binary = window.atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: mimeType });
}

function pdfPreviewUrl(url: string): string {
  return `${url}#toolbar=0&navpanes=0&view=FitH`;
}

async function blobBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  return window.btoa(binary);
}

function SummaryTranslationPage() {
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
  const [summaryExportFormat, setSummaryExportFormat] = useState<DocumentOutputFormat | "">("");
  const [reportExportFormat, setReportExportFormat] = useState<ReportOutputFormat | "">("");
  const [translationWorkspaceTab, setTranslationWorkspaceTab] = useState<TranslationWorkspaceTab>("latest");
  const [translationExportSelection, setTranslationExportSelection] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [translationSourceFile, setTranslationSourceFile] = useState<File | null>(null);
  const [summaryPrompt, setSummaryPrompt] = useState("");
  const [summaryResult, setSummaryResult] = useState<DocumentSummary | null>(null);
  const [summaryFilename, setSummaryFilename] = useState("");
  const [summaryError, setSummaryError] = useState("");
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summaryLength, setSummaryLength] = useState<"auto" | "brief" | "standard" | "detailed">("auto");
  const [summaryLanguage, setSummaryLanguage] = useState<"auto" | "English" | "Thai">("auto");
  const [summaryOptions, setSummaryOptions] = useState({ model: "google/gemini-3.5-flash", credits: 1 });
  const [documentModels, setDocumentModels] = useState<GenerationModelOption[]>([]);
  const [selectedDocumentModel, setSelectedDocumentModel] = useState("");
  const [documentModelsLoading, setDocumentModelsLoading] = useState(true);
  const [documentModelsError, setDocumentModelsError] = useState("");
  const [documentModelRetry, setDocumentModelRetry] = useState(0);
  const [documentHistory, setDocumentHistory] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState("");
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const [sourceTextPreview, setSourceTextPreview] = useState("");
  const [sourceTextPreviewLoading, setSourceTextPreviewLoading] = useState(false);

  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const [translationSourceLanguage, setTranslationSourceLanguage] = useState<TranslationLanguage>("auto");
  const [translationTargetLanguage, setTranslationTargetLanguage] = useState<Exclude<TranslationLanguage, "auto">>("Thai");
  const [outputFormat, setOutputFormat] = useState<DocumentOutputFormat>("DOCX");
  const [translationResult, setTranslationResult] = useState<DocumentTranslation | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [summaryZoom, setSummaryZoom] = useState(100);
  const [translationZoom, setTranslationZoom] = useState(100);
  const [isComparingSource, setIsComparingSource] = useState(false);
  const [compareSourceFile, setCompareSourceFile] = useState<File | null>(null);
  const [isSummaryNoteOpen, setIsSummaryNoteOpen] = useState(false);
  const [summaryNote, setSummaryNote] = useState("");
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const compareSourceInputRef = useRef<HTMLInputElement>(null);
  const isSummarize = activeMode === "summarize";
  const isTranslate = activeMode === "translate";
  const isReport = activeMode === "report";
  const isSummaryLike = isSummarize || isReport;
  const showSummaryExample = summaryWorkspaceTab === "examples";
  const displayedSummary = summaryWorkspaceTab === "examples" ? null : summaryResult;
  const reportExampleSummary: DocumentSummary = {
    title: t(K("summary.docTitle")),
    executiveSummary: t(K("report.sampleLead")),
    reportTypeLabel: t(K("summary.executive")),
    reportPeriod: "Q2 2025",
    metrics: [
      { label: t(K("summary.totalRevenue")), value: "$8.42M", change: t(K("summary.vsQ1"), { value: "+18.6%" }), trend: "up" },
      { label: t(K("summary.netProfit")), value: "$1.68M", change: t(K("summary.vsQ1"), { value: "+34.4%" }), trend: "up" },
      { label: t(K("summary.grossProfit")), value: "$3.92M", change: t(K("summary.vsQ1"), { value: "+22.1%" }), trend: "up" },
    ],
    sections: [{ heading: t(K("report.sampleFindingsHeading")), items: [t(K("report.sampleFinding1")), t(K("report.sampleFinding2"))] }],
    risks: [t(K("report.sampleFinding2"))],
    recommendations: [t(K("report.sampleRecommendation"))],
    keyTakeaways: [],
    actionItems: [],
    decisions: [],
    importantDates: [],
  };
  const isLoadingLatestSummary = isSummaryLike && summaryWorkspaceTab === "latest" && historyLoading && !summaryResult && !selectedFile;
  const sourceFileForPreview = isTranslate ? translationSourceFile ?? selectedFile : compareSourceFile ?? selectedFile;
  const sourceFileName = sourceFileForPreview?.name ?? summaryFilename;
  const translationOutputUrl = useMemo(() => {
    if (!translationResult?.outputFile) return "";
    return URL.createObjectURL(base64Blob(translationResult.outputFile.data, translationResult.outputFile.mimeType));
  }, [translationResult]);
  const isPdfSource = Boolean(sourceFileForPreview && (sourceFileForPreview.type === "application/pdf" || sourceFileForPreview.name.toLowerCase().endsWith(".pdf")));
  const isImageSource = Boolean(sourceFileForPreview && (sourceFileForPreview.type.startsWith("image/") || /\.(png|jpe?g)$/i.test(sourceFileForPreview.name)));
  const canCompareSource = Boolean(displayedSummary && ((sourceFileForPreview && (isPdfSource || isImageSource)) || (!sourceFileForPreview && /\.(pdf|png|jpe?g)$/i.test(summaryFilename))));

  const changeActiveMode = (mode: ModeId) => {
    if ((mode === "summarize" || mode === "report") && activeMode !== mode) {
      setHistoryLoading(true);
      setHistoryError("");
    }
    if (mode === "report" && activeMode !== "report") {
      setSummaryPurpose("report");
      setSummaryAudience("executive");
      setSummaryStyle("executive");
      setSummaryResult(null);
      setSummaryWorkspaceTab("latest");
    }
    if (mode === "translate" && activeMode !== "translate") setTranslationWorkspaceTab("latest");
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

  const applySavedSummary = (item: HistoryItem) => {
    const saved = item.documentSummary;
    if (!saved) return;
    setSelectedFile(null);
    setTranslationSourceFile(null);
    setCompareSourceFile(null);
    setSummaryFilename(saved.filename);
    setSummaryResult(saved.summary);
    setSummaryError("");
    setHistoryLoading(false);
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
    if (item.model) setSelectedDocumentModel(item.model);
  };

  const applySavedTranslation = (item: HistoryItem) => {
    const saved = item.documentTranslation;
    if (!saved) return;
    setSelectedFile(null);
    setTranslationSourceFile(null);
    setCompareSourceFile(null);
    setSummaryFilename(saved.filename);
    setTranslationResult({
      id: item.id,
      model: item.model ?? "",
      translatedText: saved.translatedText,
      sourceLanguage: saved.sourceLanguage,
      targetLanguage: saved.targetLanguage,
      creditsUsed: saved.creditCost,
    });
    setTranslationSourceLanguage(saved.sourceLanguage);
    setTranslationTargetLanguage(saved.targetLanguage);
    setSummaryError("");
    setHistoryLoading(false);
    setSelectedHistoryId(item.id);
    setTranslationWorkspaceTab("latest");
    setSummaryOptions((current) => ({ ...current, model: item.model ?? current.model, credits: saved.creditCost }));
    if (item.model) setSelectedDocumentModel(item.model);
    if (saved.hasOutputFile) {
      void fetchTranslatedDocumentFile(item.id).then(async (file) => {
        const data = await blobBase64(file.blob);
        setTranslationResult((current) => current?.id === item.id ? {
          ...current,
          outputFile: { filename: file.filename, mimeType: file.blob.type || saved.outputMimeType || "application/pdf", data },
        } : current);
      }).catch(() => undefined);
    }
    if (saved.hasSourceFile) {
      void fetchOriginalDocumentFile(item.id).then((file) => {
        const sourceFile = new File([file.blob], file.filename, { type: file.blob.type || "application/octet-stream" });
        setTranslationSourceFile(sourceFile);
        setSummaryFilename(sourceFile.name);
      }).catch(() => undefined);
    }
  };

  const sourcePreviewUrl = useMemo(() => sourceFileForPreview ? URL.createObjectURL(sourceFileForPreview) : "", [sourceFileForPreview]);

  useEffect(() => {
    if (!sourcePreviewUrl) return;
    return () => URL.revokeObjectURL(sourcePreviewUrl);
  }, [sourcePreviewUrl]);

  useEffect(() => {
    const file = sourceFileForPreview;
    if (!file || isPdfSource || isImageSource) {
      setSourceTextPreview("");
      setSourceTextPreviewLoading(false);
      return;
    }

    let active = true;
    setSourceTextPreview("");
    setSourceTextPreviewLoading(true);
    const extension = file.name.split(".").pop()?.toLowerCase();
    const readText = extension === "txt" || file.type.startsWith("text/")
      ? file.text()
      : file.arrayBuffer().then(async (arrayBuffer) => {
        const { default: mammoth } = await import("mammoth");
        return (await mammoth.extractRawText({ arrayBuffer })).value;
      });
    void readText.then((text) => {
      if (active) setSourceTextPreview(text.trim());
    }).catch(() => {
      if (active) setSourceTextPreview("");
    }).finally(() => {
      if (active) setSourceTextPreviewLoading(false);
    });
    return () => { active = false; };
  }, [sourceFileForPreview, isImageSource, isPdfSource]);

  useEffect(() => {
    if (!translationOutputUrl) return;
    return () => URL.revokeObjectURL(translationOutputUrl);
  }, [translationOutputUrl]);

  useEffect(() => {
    setTranslationExportSelection("");
  }, [translationResult?.id, translationResult?.outputFile?.filename]);

  useEffect(() => {
    if (!isReport) return;
    setSummaryPurpose("report");
    setSummaryAudience("executive");
    setSummaryStyle("executive");
  }, [isReport]);

  useEffect(() => {
    let mounted = true;
    void getDocumentSummaryOptions().then((options) => {
      if (mounted) setSummaryOptions(options);
    }).catch(() => undefined);
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const documentModelFeature = documentModelFeatureByMode[activeMode];
    const controller = new AbortController();
    let active = true;
    setDocumentModelsLoading(true);
    setDocumentModelsError("");
    void listGenerationModels(documentModelFeature, undefined, { signal: controller.signal })
      .then((items) => {
        if (!active) return;
        const eligible = items.filter((item) => item.enabled);
        setDocumentModels(eligible);
        setSelectedDocumentModel((current) => eligible.some((item) => item.model === current)
          ? current
          : eligible.find((item) => item.model === summaryOptions.model)?.model
            ?? eligible.find((item) => item.isDefault)?.model
            ?? eligible[0]?.model
            ?? "");
      })
      .catch((error: unknown) => {
        if (active && !controller.signal.aborted) setDocumentModelsError(error instanceof Error ? error.message : t(K("summary.modelError")));
      })
      .finally(() => {
        if (active) setDocumentModelsLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [activeMode, documentModelRetry, summaryOptions.model, t]);

  useEffect(() => {
    if (!isSummaryLike && !isTranslate) return;
    const controller = new AbortController();
    void fetchHistory({ type: "document", status: "completed", limit: 6, signal: controller.signal })
      .then((response) => {
        const items = response.items.filter((item) => {
          if (isTranslate) return Boolean(item.documentTranslation);
          if (!item.documentSummary) return false;
          return !isReport || item.documentSummary.options.prompt?.includes("purpose=report") === true;
        });
        setDocumentHistory(items);
        if (isSummaryLike && !summaryResult && !selectedFile && summaryWorkspaceTab === "latest") {
          const latest = [...items].sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))[0];
          if (latest) applySavedSummary(latest);
        }
        if (isTranslate && !translationResult && !selectedFile) {
          const latest = [...items].sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))[0];
          if (latest) applySavedTranslation(latest);
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setHistoryError(error instanceof Error ? error.message : "โหลดประวัติไม่สำเร็จ");
      })
      .finally(() => {
        if (!controller.signal.aborted) setHistoryLoading(false);
    });
    return () => controller.abort();
  }, [historyRefresh, isReport, isSummaryLike, isSummarize, isTranslate, selectedFile, summaryResult, summaryWorkspaceTab, translationResult]);

  const setFileFromList = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    const extension = file.name.split(".").pop()?.toLowerCase();
    const allowedExtensions = isTranslate
      ? ["pdf", "docx", "txt", "png", "jpg", "jpeg"]
      : ["pdf", "docx", "png", "jpg", "jpeg"];
    if (!extension || !allowedExtensions.includes(extension)) {
      setSummaryError(t(K("summary.errorType")));
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setSummaryError(t(K("summary.errorSize")));
      return;
    }
    setSelectedFile(file);
    setTranslationSourceFile(isTranslate ? file : null);
    if (isTranslate) setTranslationWorkspaceTab("source");
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
    const progressFeature = isReport ? "document-report" : "document-summary";
    const requestId = startDocumentGeneration(progressFeature);
    setIsSummarizing(true);
    setSummaryError("");
    try {
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
        model: selectedDocumentModel || undefined,
        prompt: [summaryContext, summaryPrompt.trim()].filter(Boolean).join("\n\n"),
        summaryStyle,
        summaryLength,
        language: summaryLanguage,
        // Keep every structured result field available; Gemini chooses which
        // sections are relevant and leaves unrelated sections empty.
        includeKeyTakeaways: true,
        includeActionItems: true,
        includeImportantDates: true,
        ...(isReport ? { reportType: "auto" as const } : {}),
      });
      setSummaryResult(response.summary);
      setSummaryFilename(selectedFile.name);
      setSelectedHistoryId(response.id);
      setSummaryWorkspaceTab("latest");
      setSummaryNote("");
      setIsSummaryNoteOpen(false);
      setIsComparingSource(false);
      refreshDocumentHistory();
      setSelectedDocumentModel(response.model);
      setSummaryOptions((current) => ({ ...current, model: response.model, credits: response.creditsUsed }));
      finishDocumentGeneration(progressFeature, requestId);
    } catch (error) {
      failDocumentGeneration(progressFeature, requestId);
      setSummaryError(error instanceof Error ? error.message : t(K("summary.errorGeneral")));
    } finally {
      setIsSummarizing(false);
    }
  };

  const generateTranslation = async () => {
    if (!selectedFile || isTranslating) return;
    const requestId = startDocumentGeneration("document-translate");
    setTranslationSourceFile(selectedFile);
    setIsTranslating(true);
    setSummaryError("");
    setTranslationResult(null);
    try {
      const response = await translateDocument({
        file: selectedFile,
        model: selectedDocumentModel || undefined,
        sourceLanguage: translationSourceLanguage,
        targetLanguage: translationTargetLanguage,
      });
      setTranslationResult(response);
      setTranslationWorkspaceTab("latest");
      setSummaryOptions((current) => ({ ...current, model: response.model, credits: response.creditsUsed }));
      setSelectedHistoryId(response.id);
      refreshDocumentHistory();
      finishDocumentGeneration("document-translate", requestId);
    } catch (error) {
      failDocumentGeneration("document-translate", requestId);
      setSummaryError(error instanceof Error ? error.message : t(K("translate.error")));
    } finally {
      setIsTranslating(false);
    }
  };

  const downloadTranslation = async (format?: TranslationOutputFormat) => {
    if (!translationResult) return;
    if (translationResult.id && format) {
      try {
        const file = await fetchTranslatedDocumentFile(translationResult.id, format);
        downloadBlob(file.blob, file.filename);
        return;
      } catch {
        // Fall back to the response payload for the source format if the on-demand export is unavailable.
      }
    }
    if (translationResult.outputFile) downloadBlob(base64Blob(translationResult.outputFile.data, translationResult.outputFile.mimeType), translationResult.outputFile.filename);
  };

  const toggleSourceComparison = () => {
    if (!displayedSummary) return;
    if (!sourceFileForPreview) {
      compareSourceInputRef.current?.click();
      return;
    }
    setIsComparingSource((value) => !value);
  };

  const exportSummary = (format: DocumentOutputFormat) => {
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
    if (format === "TXT") {
      downloadBlob(new Blob([text], { type: "text/plain;charset=utf-8" }), `${baseName}-summary.txt`);
      return;
    }
    if (format === "JSON") {
      downloadBlob(new Blob([JSON.stringify({ ...displayedSummary, ...(summaryNote.trim() ? { note: summaryNote.trim() } : {}) }, null, 2)], { type: "application/json;charset=utf-8" }), `${baseName}-summary.json`);
      return;
    }
    if (format === "DOCX") {
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
    printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeXml(baseName)}</title><style>@page{size:A4;margin:14mm}body{max-width:760px;margin:48px auto;padding:0 32px;color:#252a2f;font:16px/1.65 Arial,sans-serif}h1{font-size:28px;break-after:avoid}h2{margin:28px 0 8px;font-size:18px;break-after:avoid}p,li{color:#4d5660;orphans:3;widows:3}section{break-inside:auto;page-break-inside:auto}@media print{body{max-width:none;margin:0 auto;padding:0}}</style></head><body><h1>${escapeXml(displayedSummary.title)}</h1><p>${escapeXml(displayedSummary.executiveSummary)}</p>${sections}${actions}${decisions}${dates}${note}</body></html>`);
    printWindow.document.close();
    printWindow.focus();
    window.setTimeout(() => printWindow.print(), 300);
  };

  const exportReport = async (format: ReportOutputFormat) => {
    if (!displayedSummary) return;
    const baseName = safeFileName(summaryFilename || selectedFile?.name || displayedSummary.title);
    const labels: ReportExportLabels = {
      metrics: t(K("report.dashboardMetrics")),
      findings: t(K("report.dashboardFindings")),
      risks: t(K("report.dashboardRisks")),
      recommendations: t(K("report.dashboardRecommendations")),
      period: t(K("report.dashboardPeriod")),
      takeawaysHeading: t(K("summary.takeawaysHeading")),
      actionItems: t(K("summary.actionItems")),
      decisions: t(K("summary.decisions")),
      importantDates: t(K("summary.importantDates")),
      notes: t(K("summary.noteLabel")),
    };
    if (format === "JSON") {
      downloadBlob(new Blob([JSON.stringify(displayedSummary, null, 2)], { type: "application/json;charset=utf-8" }), `${baseName}-report.json`);
      return;
    }
    if (format === "DOCX") {
      downloadBlob(createDocxBlob(displayedSummary, summaryNote, labels), `${baseName}-report.docx`);
      return;
    }
    if (format === "PPTX") {
      downloadBlob(createPptxBlob(displayedSummary, labels, summaryFilename || selectedFile?.name || displayedSummary.title), `${baseName}-report.pptx`);
      return;
    }

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      setSummaryError(t(K("summary.exportPopupBlocked")));
      return;
    }
    const metricHtml = displayedSummary.metrics?.length ? `<section class="metrics"><h2>${escapeXml(labels.metrics)}</h2><div class="metric-grid">${displayedSummary.metrics.map((metric) => `<div class="metric"><small>${escapeXml(metric.label)}</small><strong>${escapeXml(metric.value)}</strong><span>${escapeXml([metric.change, metric.context].filter(Boolean).join(" · ") || "—")}</span></div>`).join("")}</div></section>` : "";
    const sectionHtml = displayedSummary.sections?.map((section) => `<section><h2>${escapeXml(section.heading)}</h2><ul>${section.items.map((item) => `<li>${escapeXml(item)}</li>`).join("")}</ul></section>`).join("") ?? "";
    const risksHtml = displayedSummary.risks?.length ? `<section><h2>${escapeXml(labels.risks)}</h2><ul>${displayedSummary.risks.map((item) => `<li>${escapeXml(item)}</li>`).join("")}</ul></section>` : "";
    const recommendationsHtml = displayedSummary.recommendations?.length ? `<section><h2>${escapeXml(labels.recommendations)}</h2><ul>${displayedSummary.recommendations.map((item) => `<li>${escapeXml(item)}</li>`).join("")}</ul></section>` : "";
    printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeXml(baseName)}</title><style>@page{size:A4;margin:14mm}body{max-width:860px;margin:40px auto;padding:0 28px;color:#252a2f;font:15px/1.6 Arial,sans-serif}h1{font-size:28px;margin-bottom:6px}h2{font-size:16px;margin:24px 0 8px;break-after:avoid}p,li{color:#5e6670}.metric-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.metric{border:1px solid #f1ded4;background:#fff7f2;border-radius:8px;padding:12px}.metric small,.metric span{display:block;color:#69717a;font-size:11px}.metric strong{display:block;font-size:20px;margin:5px 0}@media print{body{max-width:none;margin:0;padding:0}}</style></head><body><h1>${escapeXml(displayedSummary.title)}</h1>${displayedSummary.reportPeriod ? `<p><b>${escapeXml(labels.period)}:</b> ${escapeXml(displayedSummary.reportPeriod)}</p>` : ""}<p>${escapeXml(displayedSummary.executiveSummary)}</p>${metricHtml}${sectionHtml}${risksHtml}${recommendationsHtml}</body></html>`);
    printWindow.document.close();
    printWindow.focus();
    window.setTimeout(() => printWindow.print(), 300);
  };

  const openDocumentHistory = (item: HistoryItem) => {
    if (uploadInputRef.current) uploadInputRef.current.value = "";
    if (activeMode !== "summarize") changeActiveMode("summarize");
    applySavedSummary(item);
  };

  const openTranslationHistory = (item: HistoryItem) => {
    if (uploadInputRef.current) uploadInputRef.current.value = "";
    if (activeMode !== "translate") changeActiveMode("translate");
    applySavedTranslation(item);
  };

  const renderHistorySection = (headingId: string, reportMode = false) => (
    <section className={styles.historySection} aria-labelledby={headingId}>
      <header className={styles.historyHeader}>
        <div className={styles.historyTitle}>
          <span><HistoryIcon size={16} aria-hidden="true" /></span>
          <div><h2 id={headingId}>{t(K(reportMode ? "report.historyHeading" : "summary.historyHeading"))}</h2><p>{t(K(reportMode ? "report.historyDescription" : "summary.historyDescription"))}</p></div>
        </div>
        <div className={styles.historyActions}>
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
          <div><strong>{t(K(reportMode ? "report.historyEmpty" : "summary.historyEmpty"))}</strong><span>{t(K(reportMode ? "report.historyEmptyHint" : "summary.historyEmptyHint"))}</span></div>
        </div>
      )}
    </section>
  );

  const renderTranslationHistorySection = (headingId: string) => (
    <section className={styles.historySection} aria-labelledby={headingId}>
      <header className={styles.historyHeader}>
        <div className={styles.historyTitle}>
          <span><HistoryIcon size={16} aria-hidden="true" /></span>
          <div><h2 id={headingId}>{t(K("translate.historyHeading"))}</h2><p>{t(K("translate.historyDescription"))}</p></div>
        </div>
        <div className={styles.historyActions}>
          <Link href="/history?type=document">{t(K("summary.allHistory"))} <ArrowRight size={14} aria-hidden="true" /></Link>
        </div>
      </header>
      {historyError ? <p className={styles.historyMessage} role="alert">{historyError}</p> : historyLoading ? (
        <div className={styles.historyMessage} role="status"><LoaderCircle size={16} className={styles.historySpin} /> {t(K("summary.historyLoading"))}</div>
      ) : documentHistory.length ? (
        <div className={styles.historyGrid}>
          {documentHistory.map((item) => {
            const saved = item.documentTranslation;
            if (!saved) return null;
            return (
              <button
                key={item.id}
                type="button"
                className={`${styles.historyCard} ${selectedHistoryId === item.id ? styles.historyCardActive : ""}`}
                aria-pressed={selectedHistoryId === item.id}
                onClick={() => openTranslationHistory(item)}
              >
                <span className={styles.historyCardHeading}>
                  <span className={styles.historyFileIcon}><Languages size={18} aria-hidden="true" /></span>
                  <span className={styles.historyCardNames}><strong title={translatedHistoryTitle(saved.translatedText, saved.filename)}>{translatedHistoryTitle(saved.translatedText, saved.filename)}</strong><small>{t(K(`translate.language.${saved.targetLanguage.toLowerCase()}`))}</small></span>
                  <ArrowUpRight size={15} aria-hidden="true" />
                </span>
                <span className={styles.historyExcerpt}>{saved.translatedText}</span>
                <span className={styles.historyMeta}><Clock3 size={12} aria-hidden="true" />{historyDate(item.createdAt)}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className={styles.historyEmpty}>
          <Languages size={22} aria-hidden="true" />
          <div><strong>{t(K("translate.historyEmpty"))}</strong><span>{t(K("translate.historyEmptyHint"))}</span></div>
        </div>
      )}
    </section>
  );

  const renderTranslationSourcePreview = () => {
    if (!sourceFileForPreview || !sourcePreviewUrl) return null;
    if (isPdfSource) {
      return <section className={styles.translationSourcePreview} aria-label={t(K("translate.sourceDocument"))}>
        <header>
          <div><FileText size={15} aria-hidden="true" /><strong>{t(K("translate.sourceDocument"))}</strong></div>
          <span title={sourceFileName}>{sourceFileName}</span>
        </header>
        <div className={styles.translationPdfViewport}><iframe className={styles.translationSourcePdfPreview} title={sourceFileName} src={pdfPreviewUrl(sourcePreviewUrl)} /></div>
      </section>;
    }
    if (isImageSource) return <Image className={styles.translationSourceImagePreview} src={sourcePreviewUrl} alt={sourceFileName} width={1600} height={1200} unoptimized />;
    return <section className={styles.translationSourceTextPreview} aria-label={t(K("translate.sourceDocument"))}>
      {sourceTextPreviewLoading ? <div className={styles.translationSourceTextLoading} role="status"><LoaderCircle size={18} className={styles.historySpin} />{t(K("summary.historyLoading"))}</div> : <pre>{sourceTextPreview || t(K("translate.sourceTabEmpty"))}</pre>}
    </section>;
  };

  const renderTranslationSourceTab = () => sourceFileForPreview && sourcePreviewUrl
    ? renderTranslationSourcePreview()
    : <p className={styles.translationSourceEmptyNote}>{t(K("translate.sourceEmptyNote"))}</p>;

  return (
    <div className={`${styles.page} document-studio-page`}>
      <header className={styles.hero}>
        <div className={styles.heroBanner}>
          <Image
            className={styles.heroBannerImage}
            src="/generated-assets/gen-document-hero-v2.png"
            alt="GEN DOCUMENT — AI document generation studio"
            width={2400}
            height={435}
            priority
            sizes="100vw"
          />
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
        mobileTabs={
          <MobileModeDropdown
            menuId="document-mode-menu"
            value={activeMode}
            options={modes.filter((mode) => mode.available).map(({ id, icon }) => ({
              value: id,
              label: t(K(`mode.${id}`)),
              icon,
            }))}
            ariaLabel={t(K("a11y.tools"))}
            currentModeLabel={t("create.mode.current")}
            switchModeLabel={t("create.mode.switch")}
            otherModesLabel={t("create.mode.other")}
            onChange={(nextMode) => {
              if (nextMode !== activeMode) changeActiveMode(nextMode);
            }}
          />
        }
        left={
          <aside className={styles.sourcePanel} aria-label={t(K("a11y.source"))}>
          <div className={styles.tutorialTop}><ImageTutorialButton feature={documentTutorialFeatureByMode[activeMode]} featureName={t(K(`mode.${activeMode}`))} /></div>
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
          <input ref={uploadInputRef} className={styles.fileInput} type="file" accept={isTranslate ? ".pdf,.docx,.txt,.png,.jpg,.jpeg,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,image/png,image/jpeg" : ".pdf,.docx,.png,.jpg,.jpeg,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/png,image/jpeg"} onChange={(event) => setFileFromList(event.currentTarget.files)} />
          <input ref={compareSourceInputRef} className={styles.fileInput} type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" onChange={(event) => { setCompareFileFromList(event.currentTarget.files); event.currentTarget.value = ""; }} />
          <button type="button" className={styles.filePlaceholder} onClick={() => uploadInputRef.current?.click()} aria-label={t(K("source.chooseFile"))}>
            <span className={styles.fileIcon}><FileText size={17} aria-hidden="true" /></span>
            <span className={styles.fileCopy}><strong>{selectedFile?.name ?? t(K("source.filesTitle"))}</strong><small>{selectedFile ? formatFileSize(selectedFile.size) : t(K("source.filesHint"))}</small></span>
          </button>
          <div className={styles.sectionRule} />
          {!isTranslate && <PanelHeading step="2">{isReport ? t(K("report.goal")) : isSummarize ? t(K("summary.goal")) : t(K("instructions.heading"))}</PanelHeading>}
          {isSummaryLike ? (
            <>
              {!isReport ? <div className={styles.summarySelectField}>
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
              </div> : <div className={styles.summaryPrompt}>
                <label htmlFor="report-prompt">{t(K("report.promptLabel"))}</label>
                <textarea id="report-prompt" aria-label={t(K("report.promptLabel"))} maxLength={600} value={summaryPrompt} onChange={(event) => setSummaryPrompt(event.target.value)} placeholder={t(K("report.promptPlaceholder"))} />
                <small>{summaryPrompt.length} / 600</small>
              </div>}
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
              {!isReport && <div className={styles.summaryPrompt}>
                <textarea aria-label={t(K("summary.promptLabel"))} maxLength={600} value={summaryPrompt} onChange={(event) => setSummaryPrompt(event.target.value)} placeholder={t(K("summary.promptPlaceholder"))} />
                <small>{summaryPrompt.length} / 600</small>
              </div>}
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
          ) : !isTranslate ? (
            <div className={styles.instructionPlaceholder}>
              <span>{t(K("instructions.placeholder"))}</span>
              <small>0 / 600</small>
            </div>
          ) : null}
          {!isSummaryLike && !isTranslate && <div className={styles.checkList}>
            <div><i className={styles.checkedBox} />{t(K("instructions.extractTables"))}</div>
            <div><i className={styles.checkedBox} />{t(K("instructions.handwriting"))}</div>
            <div><i className={styles.checkedBox} />{t(K("instructions.layout"))}</div>
          </div>}
          </aside>
        }
        preview={
          <main className={styles.previewPanel} aria-label={t(K("a11y.preview"))}>
          <div className={styles.previewHeader}>
            <div><span>{isSummaryLike && displayedSummary ? t(K(isReport ? "report.generated" : "summary.generated")) : isTranslate && translationWorkspaceTab === "source" ? t(K("translate.sourceDocument")) : isTranslate && translationResult ? t(K("translate.translatedDocument")) : t(K("preview.heading"))}</span><small>{isSummaryLike ? t(K("summary.workspace")) : isTranslate ? t(K("translate.workspace")) : t(K("preview.canvas"))}</small></div>
            <div className={styles.previewToolbar} aria-label={t(K("preview.controls"))}>
              {isReport ? <>
                <button type="button" className={styles.previewToolButton} onClick={() => setSummaryZoom((zoom) => Math.max(60, zoom - 10))} disabled={summaryZoom <= 60} aria-label={t(K("preview.zoomOut"))} title={t(K("preview.zoomOut"))}><ZoomOut size={14} aria-hidden="true" /></button>
                <button type="button" className={`${styles.previewToolButton} ${styles.previewZoomValue}`} onClick={() => setSummaryZoom(100)} aria-label={t(K("preview.zoomReset"))} title={t(K("preview.zoomReset"))}>{summaryZoom}%</button>
                <button type="button" className={styles.previewToolButton} onClick={() => setSummaryZoom((zoom) => Math.min(160, zoom + 10))} disabled={summaryZoom >= 160} aria-label={t(K("preview.zoomIn"))} title={t(K("preview.zoomIn"))}><ZoomIn size={14} aria-hidden="true" /></button>
                <span className={styles.toolbarDivider} />
                <Dropdown
                  value={reportExportFormat}
                  options={reportOutputFormats.map((format) => ({ value: format, label: t(K("summary.exportFormat"), { format }) }))}
                  onChange={(value) => {
                    const format = value as ReportOutputFormat;
                    setReportExportFormat(format);
                    void exportReport(format);
                  }}
                  triggerLabel={t(K("preview.export"))}
                  ariaLabel={t(K("settings.outputFormat"))}
                  disabled={!displayedSummary}
                  className={styles.previewExportDropdown}
                  triggerClassName={`${styles.previewToolButton} ${styles.previewExportTrigger}`}
                  menuClassName={styles.previewExportMenu}
                  menuPosition="fixed"
                />
              </> : isSummarize ? <>
                <button type="button" className={styles.previewToolButton} onClick={() => setSummaryZoom((zoom) => Math.max(60, zoom - 10))} disabled={summaryZoom <= 60} aria-label={t(K("preview.zoomOut"))} title={t(K("preview.zoomOut"))}><ZoomOut size={14} aria-hidden="true" /></button>
                <button type="button" className={`${styles.previewToolButton} ${styles.previewZoomValue}`} onClick={() => setSummaryZoom(100)} aria-label={t(K("preview.zoomReset"))} title={t(K("preview.zoomReset"))}>{summaryZoom}%</button>
                <button type="button" className={styles.previewToolButton} onClick={() => setSummaryZoom((zoom) => Math.min(160, zoom + 10))} disabled={summaryZoom >= 160} aria-label={t(K("preview.zoomIn"))} title={t(K("preview.zoomIn"))}><ZoomIn size={14} aria-hidden="true" /></button>
                <span className={styles.toolbarDivider} />
                <Dropdown
                  value={summaryExportFormat}
                  options={documentOutputFormats.map((format) => ({ value: format, label: t(K("summary.exportFormat"), { format }) }))}
                  onChange={(value) => {
                    const format = value as DocumentOutputFormat;
                    setSummaryExportFormat(format);
                    setOutputFormat(format);
                    exportSummary(format);
                  }}
                  triggerLabel={t(K("preview.export"))}
                  ariaLabel={t(K("settings.outputFormat"))}
                  disabled={!displayedSummary}
                  className={styles.previewExportDropdown}
                  triggerClassName={`${styles.previewToolButton} ${styles.previewExportTrigger}`}
                  menuClassName={styles.previewExportMenu}
                  menuPosition="fixed"
                />
              </> : isTranslate ? <>
                <button type="button" className={styles.previewToolButton} onClick={() => setTranslationZoom((zoom) => Math.max(60, zoom - 10))} disabled={translationZoom <= 60} aria-label={t(K("preview.zoomOut"))} title={t(K("preview.zoomOut"))}><ZoomOut size={14} aria-hidden="true" /></button>
                <button type="button" className={`${styles.previewToolButton} ${styles.previewZoomValue}`} onClick={() => setTranslationZoom(100)} aria-label={t(K("preview.zoomReset"))} title={t(K("preview.zoomReset"))}>{translationZoom}%</button>
                <button type="button" className={styles.previewToolButton} onClick={() => setTranslationZoom((zoom) => Math.min(160, zoom + 10))} disabled={translationZoom >= 160} aria-label={t(K("preview.zoomIn"))} title={t(K("preview.zoomIn"))}><ZoomIn size={14} aria-hidden="true" /></button>
                <span className={styles.toolbarDivider} />
                <Dropdown
                  value={translationExportSelection}
                  options={translationResult?.outputFile ? translationOutputFormats.map((format) => ({ value: format, label: t(K("summary.exportFormat"), { format }) })) : []}
                  onChange={(value) => {
                    setTranslationExportSelection(value);
                    void downloadTranslation(value as TranslationOutputFormat);
                  }}
                  triggerLabel={t(K("preview.export"))}
                  ariaLabel={t(K("translate.downloadFile"))}
                  disabled={!translationResult?.outputFile}
                  className={styles.previewExportDropdown}
                  triggerClassName={`${styles.previewToolButton} ${styles.previewExportTrigger}`}
                  menuClassName={styles.previewExportMenu}
                  menuPosition="fixed"
                />
              </> : null}
            </div>
          </div>

          <div className={`${styles.previewStage} ${isSummaryLike || isTranslate ? styles.previewStageSummary : ""} ${isSummaryLike || isTranslate ? styles.previewStageSummaryDocument : ""}`}>
            {isSummaryLike ? (
              <div className={`${styles.summaryStage} ${isComparingSource && canCompareSource ? styles.summaryStageComparing : ""}`} role="region" aria-label={t(K("summary.workspace"))} tabIndex={0}>
                {isComparingSource && canCompareSource && sourceFileForPreview && <section className={styles.summarySourceCompare} aria-label={t(K("summary.sourcePreview"))}>
                  <header><strong>{t(K("summary.sourcePreview"))}</strong><span title={sourceFileName}>{sourceFileName}</span></header>
                  {sourcePreviewUrl ? isPdfSource
                    ? <div className={styles.summaryPdfSourceNotice}><FileText size={24} aria-hidden="true" /><p>{t(K("summary.pdfPreviewNote"))}</p><a href={sourcePreviewUrl} target="_blank" rel="noreferrer">{t(K("summary.openSource"))}<ArrowUpRight size={13} aria-hidden="true" /></a></div>
                    : <Image className={styles.summarySourceImage} src={sourcePreviewUrl} alt={sourceFileName} width={1600} height={1200} unoptimized />
                    : <div className={styles.summarySourceLoading} role="status">{t(K("summary.sourceLoading"))}</div>}
                </section>}
                <div className={`${styles.summaryDocumentColumn} ${isComparingSource && canCompareSource ? styles.summaryCompareDocument : ""}`} style={{ zoom: `${summaryZoom}%` }}>
                {isLoadingLatestSummary ? <div className={`${styles.summaryDocument} ${styles.summaryDocumentLoading}`} role="status"><LoaderCircle size={20} className={styles.historySpin} aria-hidden="true" /><span>{t(K("summary.historyLoading"))}</span></div> : isReport && !displayedSummary && !showSummaryExample ? <div className={`${styles.summaryDocument} ${styles.summaryDocumentEmpty}`}>
                  <FileText size={28} aria-hidden="true" />
                  <strong>{t(K("report.latestEmpty"))}</strong>
                  <span>{t(K("report.latestEmptyHint"))}</span>
                </div> : isReport && showSummaryExample ? <ReportDashboard
                  summary={reportExampleSummary}
                  filename={t(K("summary.sampleDoc"))}
                  labels={{
                    generated: t(K("summary.sample")),
                    metrics: t(K("report.dashboardMetrics")),
                    findings: t(K("report.dashboardFindings")),
                    risks: t(K("report.dashboardRisks")),
                    recommendations: t(K("report.dashboardRecommendations")),
                    actions: t(K("report.dashboardActions")),
                    period: t(K("report.dashboardPeriod")),
                    source: t(K("report.dashboardSource")),
                    noMetrics: t(K("report.dashboardNoMetrics")),
                  }}
                /> : isReport && displayedSummary ? <ReportDashboard
                  summary={displayedSummary}
                  filename={summaryFilename || selectedFile?.name || t(K("summary.sampleDoc"))}
                  labels={{
                    generated: t(K("report.generated")),
                    metrics: t(K("report.dashboardMetrics")),
                    findings: t(K("report.dashboardFindings")),
                    risks: t(K("report.dashboardRisks")),
                    recommendations: t(K("report.dashboardRecommendations")),
                    actions: t(K("report.dashboardActions")),
                    period: t(K("report.dashboardPeriod")),
                    source: t(K("report.dashboardSource")),
                    noMetrics: t(K("report.dashboardNoMetrics")),
                  }}
                /> : <article className={styles.summaryDocument}>
                  <div className={styles.summaryDocumentTopline}>
                    <span className={styles.sampleBadge}>{displayedSummary ? t(K(isReport ? "report.generated" : "summary.generated")) : t(K("summary.sample"))}</span>
                    <span>{summaryWorkspaceTab === "examples" ? t(K("summary.sampleDoc")) : summaryFilename || selectedFile?.name || t(K("summary.sampleDoc"))}</span>
                  </div>
                  <div className={styles.summaryDocumentHeading}>
                    <small>{t(K(`summary.${summaryStyle}`)).toUpperCase()}</small>
                    <h3>{displayedSummary?.title ?? t(K("summary.docTitle"))}</h3>
                    <p>{displayedSummary?.executiveSummary ?? `${t(K("summary.leadBefore"))}${t(K("summary.leadValue"))}${t(K("summary.leadAfter"))}`}</p>
                  </div>
                  {!displayedSummary && isReport ? <div className={styles.reportSampleText}>
                    <p>{t(K("report.sampleLead"))}</p>
                    <h4>{t(K("report.sampleFindingsHeading"))}</h4>
                    <p>{t(K("report.sampleFinding1"))}</p>
                    <p>{t(K("report.sampleFinding2"))}</p>
                    <h4>{t(K("report.sampleRecommendationHeading"))}</h4>
                    <p>{t(K("report.sampleRecommendation"))}</p>
                  </div> : !displayedSummary ? <div className={styles.summaryMetric}>
                    <span><small>{t(K("summary.totalRevenue"))}</small><strong>$8.42M</strong><em>{t(K("summary.vsQ1"), { value: "+18.6%" })}</em></span>
                    <span><small>{t(K("summary.netProfit"))}</small><strong>$1.68M</strong><em>{t(K("summary.vsQ1"), { value: "+34.4%" })}</em></span>
                    <span><small>{t(K("summary.grossProfit"))}</small><strong>$3.92M</strong><em>{t(K("summary.vsQ1"), { value: "+22.1%" })}</em></span>
                  </div> : null}
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
                </article>}
                {isSummaryNoteOpen && displayedSummary && <section className={styles.summaryAnnotation}>
                  <label htmlFor="summary-annotation"><NotebookPen size={14} aria-hidden="true" />{t(K("summary.noteLabel"))}</label>
                  <textarea id="summary-annotation" value={summaryNote} onChange={(event) => setSummaryNote(event.target.value)} placeholder={t(K("summary.notePlaceholder"))} />
                </section>}
                </div>
                {isSummarizing && <div className={styles.summaryLoading} role="status"><Sparkles size={18} aria-hidden="true" /><strong>{t(K("summary.loading"))}</strong><span>{t(K("summary.loadingHint"))}</span></div>}
              </div>
            ) : isTranslate ? (
              <div className={styles.translationStage}>
                {translationWorkspaceTab === "source" ? renderTranslationSourceTab() : translationResult ? (
                  <section className={styles.translationTextResult} aria-label={t(K("translate.previewTitle"))} style={{ zoom: `${translationZoom}%` }}>
                    {translationResult.outputFile && translationOutputUrl && translationResult.outputFile.mimeType.startsWith("application/pdf") ? <div className={styles.translationPdfViewport}><iframe className={styles.translationPdfPreview} title={translationResult.outputFile.filename} src={pdfPreviewUrl(translationOutputUrl)} /></div> : <pre>{translationResult.translatedText}</pre>}
                  </section>
                ) : (
                  <p className={styles.translationPreviewEmptyNote}>{t(K("translate.sourceEmptyNote"))}</p>
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

          {isSummaryLike ? (
            <section className={styles.summaryTabbedWorkspace}>
              <div className={styles.summaryWorkspaceTabs} role="tablist" aria-label={t(K("summary.workspaceTabs"))}>
                <button id="summary-results-tab" type="button" role="tab" aria-selected={summaryWorkspaceTab === "latest"} aria-controls="summary-results-panel" className={summaryWorkspaceTab === "latest" ? styles.summaryWorkspaceTabActive : ""} onClick={() => setSummaryWorkspaceTab("latest")}>
                  {t(K(isReport ? "report.tabLatest" : "summary.tabLatest"))}
                </button>
                <button id={isReport ? "report-examples-tab" : "summary-examples-tab"} type="button" role="tab" aria-selected={summaryWorkspaceTab === "examples"} aria-controls={isReport ? "report-examples-panel" : "summary-examples-panel"} className={summaryWorkspaceTab === "examples" ? styles.summaryWorkspaceTabActive : ""} onClick={() => setSummaryWorkspaceTab("examples")}>
                  {t(K(isReport ? "report.tabExamples" : "summary.tabExamples"))}
                </button>
              </div>
              <div id="summary-results-panel" className={styles.summaryWorkspacePanel} role="tabpanel" aria-labelledby="summary-results-tab" hidden={summaryWorkspaceTab !== "latest"}>
                {summaryWorkspaceTab === "latest" ? renderHistorySection("document-history-heading", isReport) : null}
              </div>
              <div id={isReport ? "report-examples-panel" : "summary-examples-panel"} className={styles.summaryWorkspacePanel} role="tabpanel" aria-labelledby={isReport ? "report-examples-tab" : "summary-examples-tab"} hidden={summaryWorkspaceTab !== "examples"}>
                {summaryWorkspaceTab === "examples" ? <>
                  <p className={styles.summaryExampleNote}>{t(K(isReport ? "report.exampleShowsAbove" : "summary.exampleShowsAbove"))}</p>
                  {!isReport ? renderHistorySection("document-history-examples-heading") : null}
                </> : null}
              </div>
            </section>
          ) : isTranslate ? (
            <section className={styles.summaryTabbedWorkspace}>
              <div className={`${styles.summaryWorkspaceTabs} ${styles.translationWorkspaceTabs}`} role="tablist" aria-label={t(K("translate.workspaceTabs"))}>
                <button id="translation-results-tab" type="button" role="tab" aria-selected={translationWorkspaceTab === "latest"} aria-controls="translation-results-panel" className={translationWorkspaceTab === "latest" ? styles.summaryWorkspaceTabActive : ""} onClick={() => setTranslationWorkspaceTab("latest")}>
                  {t(K("translate.tabLatest"))}
                </button>
                <button id="translation-source-tab" type="button" role="tab" aria-selected={translationWorkspaceTab === "source"} aria-controls="translation-source-panel" className={translationWorkspaceTab === "source" ? styles.summaryWorkspaceTabActive : ""} onClick={() => setTranslationWorkspaceTab("source")}>
                  {t(K("translate.tabSource"))}
                </button>
              </div>
              <div id="translation-results-panel" className={styles.summaryWorkspacePanel} role="tabpanel" aria-labelledby="translation-results-tab" hidden={translationWorkspaceTab !== "latest"}>
                {translationWorkspaceTab === "latest" ? <>
                  {renderTranslationHistorySection("document-translation-history-heading")}
                </> : null}
              </div>
              <div id="translation-source-panel" className={styles.summaryWorkspacePanel} role="tabpanel" aria-labelledby="translation-source-tab" hidden={translationWorkspaceTab !== "source"}>
                {translationWorkspaceTab === "source" ? <>
                  {renderTranslationHistorySection("document-translation-source-history-heading")}
                </> : null}
              </div>
            </section>
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
            {isSummaryLike || isTranslate || activeMode === "ocr" ? <>
              <VideoModelDropdown
                models={documentModels}
                value={selectedDocumentModel}
                loading={documentModelsLoading}
                ariaLabel={t(K("summary.modelOptions"))}
                placeholder={t(K("summary.noModel"))}
                onChange={(value) => {
                  setSelectedDocumentModel(value);
                  if (isTranslate) setSummaryOptions((current) => ({ ...current, model: value }));
                }}
              />
              {documentModelsError ? <p className={styles.modelLoadError} role="alert">
                {documentModelsError}
                <button type="button" onClick={() => setDocumentModelRetry((current) => current + 1)}>{t("create.video.common.retry")}</button>
              </p> : null}
            </> : isTranslate ? <div className={styles.translationServiceStatus}><span /><div><strong>{summaryOptions.model}</strong><small>{t(K("translate.modelCredits"), { credits: summaryOptions.credits })}</small></div></div> : <div className={styles.modelCards}>
              <div className={`${styles.modelCard} ${styles.modelCardActive}`}><i /><strong>{t(K("settings.standard"))}</strong><small>{t(K("settings.standardHint"))}</small></div>
              <div className={styles.modelCard}><i /><strong>{t(K("settings.premium"))}</strong><small>{t(K("settings.premiumHint"))}</small></div>
            </div>}
          </div>
          {!isTranslate && !isSummaryLike ? <div className={styles.settingGroup}>
            <div className={styles.settingLabel}>{t(K("settings.outputFormat"))}</div>
            <div className={styles.formatCards}>
              {documentOutputFormats.map((format) => {
                const selected = outputFormat === format;
                return (
                  <button
                    key={format}
                    className={`${styles.formatCard} ${selected ? styles.formatCardActive : ""}`}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setOutputFormat(format)}
                  >
                    <FileText size={18} aria-hidden="true" /><span>{format}</span>
                  </button>
                );
              })}
            </div>
          </div> : null}
          {isSummaryLike ? (
            <>
              <SelectControl label={t(K("settings.language"))} value={summaryLanguage} onChange={(value) => setSummaryLanguage(value as "auto" | "English" | "Thai")} options={[{ value: "auto", label: t(K("summary.languageAuto")) }, { value: "English", label: t(K("summary.languageEnglish")) }, { value: "Thai", label: t(K("summary.languageThai")) }]} />
              <SelectControl label={t(K("summary.length"))} value={summaryLength} onChange={(value) => setSummaryLength(value as "auto" | "brief" | "standard" | "detailed")} options={[{ value: "auto", label: t(K("summary.lengthAuto")) }, { value: "brief", label: t(K("summary.lengthBrief")) }, { value: "standard", label: t(K("summary.lengthStandard")) }, { value: "detailed", label: t(K("summary.lengthDetailed")) }]} />
              <SelectControl label={t(K("settings.tone"))} value={summaryStyle} onChange={(value) => setSummaryStyle(value as SummaryStyle)} options={[{ value: "executive", label: t(K("summary.toneExecutive")) }, { value: "bullets", label: t(K("summary.toneBullets")) }]} />
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
          <div className={styles.mobileActionDock}>
            <div className={styles.estimate}><span>{t(K("settings.estimate"))}</span><strong>{isSummaryLike || isTranslate ? t(K(summaryOptions.credits === 1 ? "summary.creditsSingular" : "summary.creditsPlural"), { value: summaryOptions.credits }) : t(K("settings.credits"))}</strong></div>
            {summaryError && <div className={styles.summaryError} role="alert">{summaryError}</div>}
            <button className={styles.generateButton} type="button" disabled={isTranslate ? (!selectedFile || isTranslating) : isSummaryLike ? (!selectedFile || isSummarizing) : true} onClick={() => { if (isSummaryLike) void generateSummary(); else if (isTranslate) void generateTranslation(); }}>
              <span>{isSummarizing ? t(K(isReport ? "report.generating" : "summary.generating")) : isTranslating ? t(K("translate.translating")) : isReport ? t(K("report.generate")) : isSummarize ? t(K("summary.generate")) : isTranslate ? t(K("translate.generate")) : t(K("settings.generate"))}</span>
              <Sparkles size={17} aria-hidden="true" />
            </button>
            <div className={styles.secureNote}><span />{isSummaryLike ? t(K(isReport ? "report.processingNote" : "summary.processingNote")) : isTranslate ? t(K("translate.processingNote")) : t(K("settings.secure"))}</div>
          </div>
          </aside>
        }
      />

    </div>
  );
}

export function DocumentGenerationPage() {
  const searchParams = useSearchParams();
  const mode = searchParams.get("tab");
  if (mode === "summarize" || mode === "translate") return <SummaryTranslationPage />;
  return <DocumentFeatureGenerationPage />;
}
