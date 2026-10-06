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
  Hand,
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
import Link from "next/link";
import { Fragment, useEffect, useRef, useState } from "react";
import { CreatorWorkspaceLayout } from "@/components/create/creator-workspace-layout";
import { Dropdown } from "@/components/ui/dropdown";
import { getDocumentSummaryOptions, summarizeDocument, type DocumentSummary } from "@/lib/api/document-summarize";
import { fetchHistory, type HistoryItem } from "@/lib/api/history";
import type { TranslationKey } from "@/lib/i18n/dictionary";
import { useLocale } from "@/lib/i18n/locale-provider";
import styles from "./document-generation-page.module.css";

const K = (key: string) => `create.document.${key}` as TranslationKey;

type ModeId = "ocr" | "summarize" | "translate" | "contract" | "report" | "form";
type SummaryPurpose = "general" | "meeting" | "decision" | "report" | "learning";
type SummaryAudience = "general" | "executive" | "team" | "client" | "specialist";
type SummaryStyle = "executive" | "bullets" | "actions";
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
    style: (match?.[3] as SummaryStyle | undefined) ?? fallbackStyle,
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
    <label className={styles.selectField}>
      <span>{label}</span>
      <select className={styles.controlSelect} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

function formatFileSize(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function historyDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "ไม่ทราบวันที่" : new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function DocumentGenerationPage() {
  const { t } = useLocale();
  const [activeMode, setActiveMode] = useState<ModeId>("ocr");
  const [summaryStyle, setSummaryStyle] = useState<SummaryStyle>("executive");
  const [summaryPurpose, setSummaryPurpose] = useState<SummaryPurpose>("general");
  const [summaryAudience, setSummaryAudience] = useState<SummaryAudience>("general");
  const [sourcePageRange, setSourcePageRange] = useState<SourcePageRange>("all");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [summaryPrompt, setSummaryPrompt] = useState("");
  const [summaryResult, setSummaryResult] = useState<DocumentSummary | null>(null);
  const [summaryFilename, setSummaryFilename] = useState("");
  const [summaryError, setSummaryError] = useState("");
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summaryLength, setSummaryLength] = useState<"brief" | "standard" | "detailed">("standard");
  const [summaryLanguage, setSummaryLanguage] = useState<"auto" | "English" | "Thai">("auto");
  const [focusAreas, setFocusAreas] = useState({ keyTakeaways: true, actionItems: true, importantDates: true });
  const [summaryOptions, setSummaryOptions] = useState({ model: "google/gemini-3.5-flash", credits: 1 });
  const [documentHistory, setDocumentHistory] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState("");
  const [historyRefresh, setHistoryRefresh] = useState(0);

  const changeSummaryPurpose = (purpose: SummaryPurpose) => {
    setSummaryPurpose(purpose);
    setFocusAreas({
      general: { keyTakeaways: true, actionItems: true, importantDates: true },
      meeting: { keyTakeaways: true, actionItems: true, importantDates: true },
      decision: { keyTakeaways: true, actionItems: true, importantDates: true },
      report: { keyTakeaways: true, actionItems: false, importantDates: true },
      learning: { keyTakeaways: true, actionItems: false, importantDates: false },
    }[purpose]);
  };
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const [translationSourceLanguage, setTranslationSourceLanguage] = useState("auto");
  const [translationTargetLanguage, setTranslationTargetLanguage] = useState("Thai");
  const [outputFormat, setOutputFormat] = useState("DOCX");
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const isSummarize = activeMode === "summarize";
  const isTranslate = activeMode === "translate";

  useEffect(() => {
    let mounted = true;
    void getDocumentSummaryOptions().then((options) => {
      if (mounted) setSummaryOptions(options);
    }).catch(() => undefined);
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setHistoryLoading(true);
    setHistoryError("");
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
  }, [historyRefresh]);

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
    setSummaryResult(null);
    setSummaryFilename(file.name);
    setSelectedHistoryId(null);
    setSummaryError("");
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
        t(K("summary.groundingInstruction")),
        "[[/EOS_SUMMARY_CONTEXT]]",
      ].join("\n");
      const response = await summarizeDocument({
        file: selectedFile,
        prompt: [pageRangeInstruction, summaryContext, summaryPrompt.trim()].filter(Boolean).join("\n\n"),
        summaryStyle: summaryStyle === "actions" ? "bullets" : summaryStyle,
        summaryLength,
        language: summaryLanguage,
        includeKeyTakeaways: focusAreas.keyTakeaways,
        includeActionItems: focusAreas.actionItems,
        includeImportantDates: focusAreas.importantDates,
      });
      setSummaryResult(response.summary);
      setSummaryFilename(selectedFile.name);
      setSelectedHistoryId(response.id);
      setHistoryRefresh((current) => current + 1);
      setSummaryOptions((current) => ({ ...current, model: response.model, credits: response.creditsUsed }));
    } catch (error) {
      setSummaryError(error instanceof Error ? error.message : t(K("summary.errorGeneral")));
    } finally {
      setIsSummarizing(false);
    }
  };

  const openDocumentHistory = (item: HistoryItem) => {
    const saved = item.documentSummary;
    if (!saved) return;
    if (uploadInputRef.current) uploadInputRef.current.value = "";
    setActiveMode("summarize");
    setSelectedFile(null);
    setSummaryFilename(saved.filename);
    setSummaryResult(saved.summary);
    setSummaryError("");
    setSelectedHistoryId(item.id);
    const restoredContext = restoreSummaryContext(saved.options.prompt, saved.options.summaryStyle);
    setSummaryPrompt(restoredContext.prompt);
    setSummaryPurpose(restoredContext.purpose);
    setSummaryAudience(restoredContext.audience);
    setSummaryStyle(restoredContext.style);
    setSummaryLength(saved.options.summaryLength);
    setSummaryLanguage(saved.options.language);
    setFocusAreas({
      keyTakeaways: saved.options.includeKeyTakeaways,
      actionItems: saved.options.includeActionItems,
      importantDates: saved.options.includeImportantDates,
    });
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
                  onClick={() => available && setActiveMode(id)}
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
                  onChange={(value) => changeSummaryPurpose(value as SummaryPurpose)}
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
                  {(["executive", "bullets", "actions"] as const).map((style) => (
                    <button
                      key={style}
                      type="button"
                      className={summaryStyle === style ? styles.summaryFormatActive : ""}
                      aria-pressed={summaryStyle === style}
                      onClick={() => {
                        setSummaryStyle(style);
                        if (style === "actions") setFocusAreas((current) => ({ ...current, actionItems: true }));
                      }}
                    >
                      {style === "executive" ? <NotebookPen size={14} aria-hidden="true" /> : style === "bullets" ? <ListChecks size={14} aria-hidden="true" /> : <Table2 size={14} aria-hidden="true" />}
                      {t(K(`summary.${style}`))}
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
          <div className={styles.checkList}>
            {isSummarize ? (
              <>
                <label><input className={styles.summaryCheckbox} type="checkbox" checked={focusAreas.keyTakeaways} onChange={(event) => setFocusAreas((current) => ({ ...current, keyTakeaways: event.target.checked }))} />{t(K("summary.checkTakeaways"))}</label>
                <label><input className={styles.summaryCheckbox} type="checkbox" checked={focusAreas.actionItems} onChange={(event) => setFocusAreas((current) => ({ ...current, actionItems: event.target.checked }))} />{t(K("summary.checkActions"))}</label>
                <label><input className={styles.summaryCheckbox} type="checkbox" checked={focusAreas.importantDates} onChange={(event) => setFocusAreas((current) => ({ ...current, importantDates: event.target.checked }))} />{t(K("summary.checkDates"))}</label>
              </>
            ) : isTranslate ? null : (
              <>
                <div><i className={styles.checkedBox} />{t(K("instructions.extractTables"))}</div>
                <div><i className={styles.checkedBox} />{t(K("instructions.handwriting"))}</div>
                <div><i className={styles.checkedBox} />{t(K("instructions.layout"))}</div>
              </>
            )}
          </div>
          </aside>
        }
        preview={
          <main className={styles.previewPanel} aria-label={t(K("a11y.preview"))}>
          <div className={styles.previewHeader}>
            <div><span>{t(K("preview.heading"))}</span><small>{isSummarize ? t(K("summary.workspace")) : isTranslate ? t(K("translate.workspace")) : t(K("preview.canvas"))}</small></div>
            <div className={styles.previewToolbar} aria-label={t(K("preview.controls"))}>
              <ZoomIn size={14} aria-hidden="true" />
              <ZoomOut size={14} aria-hidden="true" />
              <span>100% <ChevronDown size={12} /></span>
              <Hand size={14} aria-hidden="true" />
              <span className={styles.toolbarDivider} />
              <span>{t(K("preview.compare"))}</span>
              <span>{t(K("preview.annotate"))}</span>
              <span><Download size={13} />{t(K("preview.export"))}</span>
            </div>
          </div>

          <div className={`${styles.previewStage} ${isSummarize || isTranslate ? styles.previewStageSummary : ""}`}>
            {isSummarize ? (
              <div className={styles.summaryStage}>
                <article className={styles.summaryDocument}>
                  <div className={styles.summaryDocumentTopline}>
                    <span className={styles.sampleBadge}>{summaryResult ? t(K("summary.generated")) : t(K("summary.sample"))}</span>
                    <span>{summaryFilename || selectedFile?.name || t(K("summary.sampleDoc"))}</span>
                  </div>
                  <div className={styles.summaryDocumentHeading}>
                    <small>{t(K(`summary.${summaryStyle}`)).toUpperCase()}</small>
                    <h3>{summaryResult?.title ?? t(K("summary.docTitle"))}</h3>
                    <p>{summaryResult?.executiveSummary ?? `${t(K("summary.leadBefore"))}${t(K("summary.leadValue"))}${t(K("summary.leadAfter"))}`}</p>
                  </div>
                  {!summaryResult && <div className={styles.summaryMetric}>
                    <span><small>{t(K("summary.totalRevenue"))}</small><strong>$8.42M</strong><em>{t(K("summary.vsQ1"), { value: "+18.6%" })}</em></span>
                    <span><small>{t(K("summary.netProfit"))}</small><strong>$1.68M</strong><em>{t(K("summary.vsQ1"), { value: "+34.4%" })}</em></span>
                    <span><small>{t(K("summary.grossProfit"))}</small><strong>$3.92M</strong><em>{t(K("summary.vsQ1"), { value: "+22.1%" })}</em></span>
                  </div>}
                  {(summaryResult?.keyTakeaways.length ?? 2) > 0 && <div className={styles.summaryTakeaways}>
                    <h4>{t(K("summary.takeawaysHeading"))}</h4>
                    <ul>{(summaryResult?.keyTakeaways ?? [t(K("summary.takeaway1")), t(K("summary.takeaway2"))]).map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul>
                  </div>}
                  {(summaryResult?.actionItems.length || (!summaryResult && summaryStyle === "actions")) ? <div className={styles.summaryTakeaways}>
                    <h4>{t(K("summary.actionItems"))}</h4>
                    {summaryStyle === "actions" ? (
                      <div className={styles.summaryActionTableWrap}>
                        <table className={styles.summaryActionTable}>
                          <thead><tr><th scope="col">{t(K("summary.actionTask"))}</th><th scope="col">{t(K("summary.actionOwner"))}</th><th scope="col">{t(K("summary.actionDueDate"))}</th></tr></thead>
                          <tbody>{(summaryResult?.actionItems ?? [
                            { task: t(K("summary.sampleActionTask1")), owner: t(K("summary.sampleActionOwner1")), dueDate: t(K("summary.sampleActionDate")) },
                            { task: t(K("summary.sampleActionTask2")), owner: t(K("summary.sampleActionOwner2")), dueDate: t(K("summary.sampleActionDate")) },
                          ]).map((item, index) => <tr key={`${index}-${item.task}`}><td>{item.task}</td><td>{item.owner || "—"}</td><td>{item.dueDate || "—"}</td></tr>)}</tbody>
                        </table>
                      </div>
                    ) : <ul>{(summaryResult?.actionItems ?? []).map((item, index) => <li key={`${index}-${item.task}`}>{item.task}{item.owner ? ` · ${item.owner}` : ""}{item.dueDate ? ` · ${item.dueDate}` : ""}</li>)}</ul>}
                  </div> : summaryStyle === "actions" && summaryResult && focusAreas.actionItems ? <p className={styles.summaryEmptyActions}>{t(K("summary.noActionItems"))}</p> : null}
                  {summaryResult?.decisions.length ? <div className={styles.summaryTakeaways}><h4>{t(K("summary.decisions"))}</h4><ul>{summaryResult.decisions.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul></div> : null}
                  {summaryResult?.importantDates.length ? <div className={styles.summaryTakeaways}><h4>{t(K("summary.importantDates"))}</h4><ul>{summaryResult.importantDates.map((item, index) => <li key={`${index}-${item.date}-${item.event}`}>{item.date} · {item.event}</li>)}</ul></div> : null}
                  <div className={styles.summaryDocumentFooter}>{summaryResult ? t(K("summary.generatedBy"), { model: summaryOptions.model }) : t(K("summary.footer"))}</div>
                </article>
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
                <div className={styles.translationPreviewNote}>
                  <Languages size={16} aria-hidden="true" />
                  <div><strong>{t(K("translate.previewTitle"))}</strong><span>{t(K(selectedFile ? "translate.previewHint" : "translate.uploadHint"))}</span></div>
                </div>
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

          {isSummarize ? null : isTranslate ? (
            <div className={styles.translationResultCard}>
              <div><Languages size={14} aria-hidden="true" /><strong>{t(K("output.translated"))}</strong></div>
              <p>{t(K("translate.resultHint"))}</p>
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
            <div className={styles.settingLabel}>{t(K("settings.model"))} <span>ⓘ</span></div>
            {isSummarize ? <div className={`${styles.modelCards} ${styles.singleModel}`}><div className={`${styles.modelCard} ${styles.modelCardActive}`}><i /><strong>{t(K("summary.modelName"))}</strong><small>{t(K("summary.modelHint"))}</small></div></div> : <div className={styles.modelCards}>
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
              <div className={styles.summaryFocusNote}>{t(K("summary.focus"))}: {[focusAreas.keyTakeaways && t(K("summary.focusTakeaways")), focusAreas.actionItems && t(K("summary.focusActions")), focusAreas.importantDates && t(K("summary.focusDates"))].filter(Boolean).join(", ") || t(K("summary.focusGeneral"))}</div>
              <SelectPlaceholder label={t(K("settings.tone"))} value={t(K("summary.toneValue"))} />
            </>
            ) : isTranslate ? null : (
              <>
              <SelectPlaceholder label={t(K("settings.language"))} value={t(K("settings.languageValue"))} />
              <SelectPlaceholder label={t(K("settings.pageRange"))} value={t(K("source.allPages"))} />
              <SelectPlaceholder label={t(K("settings.depth"))} value={t(K("settings.depthValue"))} />
              <SelectPlaceholder label={t(K("settings.tone"))} value={t(K("settings.toneValue"))} />
            </>
          )}
          <div className={styles.estimate}><span>{t(K("settings.estimate"))}</span><strong>{isSummarize ? t(K(summaryOptions.credits === 1 ? "summary.creditsSingular" : "summary.creditsPlural"), { value: summaryOptions.credits }) : t(K("settings.credits"))}</strong></div>
          <button className={styles.generateButton} type="button" disabled={!isSummarize || !selectedFile || isSummarizing} onClick={() => void generateSummary()}>
            <span>{isSummarizing ? t(K("summary.generating")) : isSummarize ? t(K("summary.generate")) : t(K("settings.generate"))}</span>
            <Sparkles size={17} aria-hidden="true" />
          </button>
          {summaryError && <div className={styles.summaryError} role="alert">{summaryError}</div>}
          <div className={styles.secureNote}><span />{isSummarize ? t(K("summary.processingNote")) : t(K("settings.secure"))}</div>
          </aside>
        }
      />

      {isSummarize && (
        <section className={styles.historySection} aria-labelledby="document-history-heading">
          <header className={styles.historyHeader}>
            <div className={styles.historyTitle}>
              <span><HistoryIcon size={16} aria-hidden="true" /></span>
              <div><h2 id="document-history-heading">ประวัติสรุปเอกสาร</h2><p>เปิดดูผลสรุปที่สร้างไว้ในช่วง 7 วันที่ผ่านมา</p></div>
            </div>
            <div className={styles.historyActions}>
              <button type="button" onClick={() => setHistoryRefresh((current) => current + 1)} disabled={historyLoading} aria-label="รีเฟรชประวัติเอกสาร">
                <RefreshCw size={15} className={historyLoading ? styles.historySpin : undefined} /> รีเฟรช
              </button>
              <Link href="/history?type=document">ประวัติทั้งหมด <ArrowRight size={14} aria-hidden="true" /></Link>
            </div>
          </header>
          {historyError ? <p className={styles.historyMessage} role="alert">{historyError}</p> : historyLoading ? (
            <div className={styles.historyMessage} role="status"><LoaderCircle size={16} className={styles.historySpin} /> กำลังโหลดประวัติ…</div>
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
              <div><strong>ยังไม่มีประวัติสรุปเอกสาร</strong><span>เมื่อสร้างสรุปสำเร็จ รายการจะปรากฏที่นี่และเปิดดูได้ภายหลัง</span></div>
            </div>
          )}
        </section>
      )}

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
