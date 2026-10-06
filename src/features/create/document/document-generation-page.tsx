"use client";

import {
  ArrowUpRight,
  BarChart3,
  ChevronDown,
  CloudUpload,
  Columns2,
  Download,
  FileCheck2,
  FileText,
  Hand,
  Languages,
  ListChecks,
  MessageSquarePlus,
  NotebookPen,
  Play,
  Plus,
  ScanText,
  Sparkles,
  Table2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Fragment, useEffect, useRef, useState } from "react";
import { CreatorWorkspaceLayout } from "@/components/create/creator-workspace-layout";
import { Dropdown } from "@/components/ui/dropdown";
import { listDocumentOcrTypes, runDocumentOcr, type DocumentOcrResult, type OcrDocumentTypeId, type OcrDepth, type OcrDocumentTypeInfo, type OcrOutputFormat, type OcrStyleChoice } from "@/lib/api/document-ocr";
import { getDocumentSummaryOptions, summarizeDocument, type DocumentSummary } from "@/lib/api/document-summarize";
import type { TranslationKey } from "@/lib/i18n/dictionary";
import { useLocale } from "@/lib/i18n/locale-provider";
import { DEFAULT_OCR_EXTENSIONS, DEFAULT_OCR_MAX_MEGABYTES, OCR_DOCUMENT_TYPE_OPTIONS } from "./ocr-document-types";
import { canPreviewFile, DocumentPreview } from "./document-preview";
import { buildOcrCards } from "./ocr-cards";
import { downloadOcrResult, ocrResultToText } from "./ocr-download";
import { OcrResultView } from "./ocr-result-view";
import styles from "./document-generation-page.module.css";

const K = (key: string) => `create.document.${key}` as TranslationKey;

type ModeId = "ocr" | "summarize" | "translate" | "contract" | "report" | "form";
type SummaryStyle = "executive" | "bullets";

const modes: { id: ModeId; icon: typeof ScanText; available?: boolean }[] = [
  { id: "ocr", icon: ScanText, available: true },
  { id: "summarize", icon: NotebookPen, available: true },
  { id: "translate", icon: Languages },
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

function SelectPlaceholder({ label, value, disabled, title }: { label: string; value: string; disabled?: boolean; title?: string }) {
  return (
    <div className={`${styles.selectField} ${disabled ? styles.selectFieldDisabled : ""}`} aria-disabled={disabled || undefined} title={title}>
      <span>{label}</span>
      <div className={styles.selectValue}>
        {value}
        <ChevronDown size={14} aria-hidden="true" />
      </div>
    </div>
  );
}

function SelectControl({ label, value, options, onChange, disabled, title }: { label: string; value: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void; disabled?: boolean; title?: string }) {
  return (
    <div className={`${styles.selectField} ${disabled ? styles.selectFieldDisabled : ""}`} title={title}>
      <span>{label}</span>
      <Dropdown
        value={value}
        options={options}
        onChange={onChange}
        ariaLabel={label}
        disabled={disabled}
        menuPosition="fixed"
        triggerClassName="h-[38px] min-h-0 rounded-lg border-[#dfe2e7] px-[11px] text-[11px] font-normal"
        optionClassName="px-2.5 py-2 text-[11px]"
      />
    </div>
  );
}

function formatFileSize(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentGenerationPage() {
  const { locale, t } = useLocale();
  const [activeMode, setActiveMode] = useState<ModeId>("ocr");
  const [summaryStyle, setSummaryStyle] = useState<SummaryStyle>("executive");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [summaryPrompt, setSummaryPrompt] = useState("");
  const [summaryResult, setSummaryResult] = useState<DocumentSummary | null>(null);
  const [summaryError, setSummaryError] = useState("");
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summaryLength, setSummaryLength] = useState<"brief" | "standard" | "detailed">("standard");
  const [summaryLanguage, setSummaryLanguage] = useState<"auto" | "English" | "Thai">("auto");
  const [focusAreas, setFocusAreas] = useState({ keyTakeaways: true, actionItems: true, importantDates: true });
  const [summaryOptions, setSummaryOptions] = useState({ model: "google/gemini-3.5-flash", credits: 1 });
  const [ocrType, setOcrType] = useState<OcrDocumentTypeId>("general");
  const [ocrTypes, setOcrTypes] = useState<OcrDocumentTypeInfo[]>([]);
  const [ocrLanguage, setOcrLanguage] = useState<"th" | "en">(locale === "en" ? "en" : "th");
  const [ocrConfidence, setOcrConfidence] = useState(true);
  const [ocrReturnRaw, setOcrReturnRaw] = useState(false);
  const [ocrFormat, setOcrFormat] = useState<OcrOutputFormat>("txt");
  const [ocrPageRange, setOcrPageRange] = useState("");
  const [ocrPageRangeMode, setOcrPageRangeMode] = useState<"all" | "custom">("all");
  const [pdfInfo, setPdfInfo] = useState<{ file: File; count: number } | null>(null);
  const [ocrDepth, setOcrDepth] = useState<OcrDepth>("basic");
  const [ocrZoom, setOcrZoom] = useState(100);
  const [ocrPan, setOcrPan] = useState(false);
  const [ocrCompare, setOcrCompare] = useState(false);
  const [ocrAnnotate, setOcrAnnotate] = useState(false);
  const [ocrShowStyled, setOcrShowStyled] = useState(true);
  const [ocrResultPages, setOcrResultPages] = useState<number[] | null>(null);
  const [isToolbarExporting, setIsToolbarExporting] = useState(false);
  const [ocrStyle, setOcrStyle] = useState<OcrStyleChoice>("original");
  const [ocrResult, setOcrResult] = useState<DocumentOcrResult | null>(null);
  const [ocrError, setOcrError] = useState("");
  const [isOcrRunning, setIsOcrRunning] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const ocrResultsRef = useRef<HTMLDivElement>(null);
  const isSummarize = activeMode === "summarize";
  const isOcr = activeMode === "ocr";
  const ocrTypeInfo = ocrTypes.find((type) => type.id === ocrType);
  const ocrExtensions: readonly string[] = ocrTypeInfo?.extensions ?? DEFAULT_OCR_EXTENSIONS;
  const ocrMaxMegabytes = ocrTypeInfo?.maxMegabytes ?? DEFAULT_OCR_MAX_MEGABYTES;
  const selectedIsPdf = selectedFile?.name.toLowerCase().endsWith(".pdf") ?? true;
  const pdfPageCount = pdfInfo && pdfInfo.file === selectedFile ? pdfInfo.count : null;
  const hasPreview = isOcr && !!selectedFile && canPreviewFile(selectedFile);
  const preferStyled = ocrShowStyled && !!ocrResult?.styledText?.length;
  /** The extracted text for one page of the uploaded document, shown beside it by the Compare tool. */
  const compareText = hasPreview && ocrCompare && ocrResult ? (page: number): string => {
    const index = ocrResultPages ? ocrResultPages.indexOf(page) : page - 1;
    if (index < 0) return t(K("ocr.compareOutOfRange"));
    if (ocrResult.layout?.length) return ocrResult.layout[index]?.components.map((component) => component.text).join("\n\n") ?? "";
    const pages = preferStyled ? ocrResult.styledText ?? ocrResult.text : ocrResult.text;
    return pages.length ? pages[index] ?? "" : ocrResultToText(ocrResult, locale, t);
  } : null;
  const exportFromToolbar = async () => {
    if (!ocrResult || isToolbarExporting) return;
    setIsToolbarExporting(true);
    try {
      await downloadOcrResult({ result: ocrResult, fileName: selectedFile?.name ?? "", format: ocrFormat, preferStyled, locale, t });
    } catch {
      setOcrError(t(K("ocr.exportFailed")));
    } finally {
      setIsToolbarExporting(false);
    }
  };
  // iApp itself produces DOCX / PDF for plain general OCR (it keeps the scan's layout). Every other combination is
  // extracted first and then exported as Word / PDF by our backend, which is free.
  const usesProviderFile = (ocrFormat === "docx" || ocrFormat === "pdf") && !!ocrTypeInfo?.outputFormats.includes(ocrFormat) && ocrDepth === "basic" && ocrStyle === "original";
  const ocrCreditsPerPage = usesProviderFile && (ocrFormat === "docx" || ocrFormat === "pdf") ? ocrTypeInfo?.creditsPerPageByFormat?.[ocrFormat] : ocrDepth === "advanced" ? ocrTypeInfo?.creditsPerPageAdvanced : ocrTypeInfo?.creditsPerPage;
  const showStyleCredits = ocrDepth === "basic" && ocrStyle !== "original" && ocrTypeInfo?.styleCredits !== undefined;

  useEffect(() => {
    let mounted = true;
    void getDocumentSummaryOptions().then((options) => {
      if (mounted) setSummaryOptions(options);
    }).catch(() => undefined);
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let mounted = true;
    void listDocumentOcrTypes().then((types) => {
      if (mounted) setOcrTypes(types);
    }).catch(() => undefined);
    return () => { mounted = false; };
  }, []);

  const setFileFromList = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (isOcr) {
      const problem = ocrFileProblem(file, ocrExtensions, ocrMaxMegabytes);
      if (problem) {
        setOcrError(problem);
        return;
      }
    } else {
      if (!extension || !["pdf", "docx", "png", "jpg", "jpeg"].includes(extension)) {
        setSummaryError(t(K("summary.errorType")));
        return;
      }
      if (file.size > 25 * 1024 * 1024) {
        setSummaryError(t(K("summary.errorSize")));
        return;
      }
    }
    setSelectedFile(file);
    setOcrPageRangeMode("all");
    setOcrPageRange("");
    setSummaryResult(null);
    setSummaryError("");
    setOcrResult(null);
    setOcrError("");
  };

  useEffect(() => {
    if (!selectedFile || !selectedFile.name.toLowerCase().endsWith(".pdf")) return;
    let cancelled = false;
    void (async () => {
      try {
        const { PDFDocument } = await import("pdf-lib");
        const document = await PDFDocument.load(await selectedFile.arrayBuffer(), { ignoreEncryption: true, updateMetadata: false });
        if (!cancelled) setPdfInfo({ file: selectedFile, count: document.getPageCount() });
      } catch {
        // An unreadable PDF just means we cannot show its page count; the backend still validates the range.
      }
    })();
    return () => { cancelled = true; };
  }, [selectedFile]);

  const ocrFileProblem = (file: File, extensions: readonly string[], maxMegabytes: number): string => {
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (!extension || !extensions.includes(extension)) return t(K("ocr.errorType"), { types: extensions.join(", ").toUpperCase() });
    if (file.size > maxMegabytes * 1024 * 1024) return t(K("ocr.errorSize"), { max: maxMegabytes });
    return "";
  };

  const changeOcrType = (id: OcrDocumentTypeId) => {
    setOcrType(id);
    setOcrResult(null);
    setOcrError("");
    const info = ocrTypes.find((type) => type.id === id);
    if (info && !info.outputFormats.includes(ocrFormat)) setOcrFormat("txt");
    if (info && !info.depths) setOcrDepth("basic");
    if (info && !info.styles) setOcrStyle("original");
    if (selectedFile && info) {
      const problem = ocrFileProblem(selectedFile, info.extensions, info.maxMegabytes);
      if (problem) {
        setSelectedFile(null);
        setOcrPageRangeMode("all");
        setOcrPageRange("");
        setOcrError(problem);
      }
    }
  };

  /** `1-3, 5` -> [1, 2, 3, 5]; the range was already validated before the request was sent. */
  const pagesInRange = (range: string): number[] => {
    const pages = new Set<number>();
    for (const part of range.split(",")) {
      const [start, end = start] = part.split("-").map((value) => Number(value.trim()));
      for (let page = start ?? 0; page <= (end ?? 0); page += 1) if (page >= 1) pages.add(page);
    }
    return [...pages].sort((a, b) => a - b);
  };

  const runOcr = async () => {
    if (!selectedFile || isOcrRunning) return;
    const problem = ocrFileProblem(selectedFile, ocrExtensions, ocrMaxMegabytes);
    if (problem) {
      setOcrError(problem);
      return;
    }
    const pageRange = selectedIsPdf && ocrPageRangeMode === "custom" ? ocrPageRange.trim() : "";
    if (selectedIsPdf && ocrPageRangeMode === "custom" && !pageRange) {
      setOcrError(t(K("ocr.errorPageRange")));
      return;
    }
    if (pageRange && !/^\d+(\s*-\s*\d+)?(\s*,\s*\d+(\s*-\s*\d+)?)*$/.test(pageRange)) {
      setOcrError(t(K("ocr.errorPageRange")));
      return;
    }
    if (pageRange && pdfPageCount !== null && pageRange.split(/[-,]/).some((part) => Number(part) > pdfPageCount || Number(part) < 1)) {
      setOcrError(t(K("ocr.errorPageRangeBounds"), { count: pdfPageCount }));
      return;
    }
    setIsOcrRunning(true);
    setOcrError("");
    setOcrResult(null);
    setOcrResultPages(pageRange ? pagesInRange(pageRange) : null);
    try {
      const supports = ocrTypeInfo?.supports;
      setOcrResult(await runDocumentOcr({
        file: selectedFile,
        documentType: ocrType,
        ...(supports?.targetLang ? { targetLang: ocrLanguage } : {}),
        ...(supports?.includeConfidence ? { includeConfidence: ocrConfidence } : {}),
        ...(supports?.returnOcr ? { returnOcr: ocrReturnRaw } : {}),
        ...(usesProviderFile && (ocrFormat === "docx" || ocrFormat === "pdf") ? { outputFormat: ocrFormat } : {}),
        ...(pageRange ? { pageRange } : {}),
        ...(ocrDepth === "advanced" ? { depth: ocrDepth } : {}),
        ...(ocrStyle !== "original" && ocrDepth === "basic" ? { style: ocrStyle } : {}),
      }));
    } catch (error) {
      setOcrError(error instanceof Error ? error.message : t(K("ocr.errorGeneral")));
    } finally {
      setIsOcrRunning(false);
    }
  };

  const generateSummary = async () => {
    if (!selectedFile || isSummarizing) return;
    setIsSummarizing(true);
    setSummaryError("");
    try {
      const response = await summarizeDocument({
        file: selectedFile,
        prompt: summaryPrompt,
        summaryStyle,
        summaryLength,
        language: summaryLanguage,
        includeKeyTakeaways: focusAreas.keyTakeaways,
        includeActionItems: focusAreas.actionItems,
        includeImportantDates: focusAreas.importantDates,
      });
      setSummaryResult(response.summary);
      setSummaryOptions((current) => ({ ...current, model: response.model, credits: response.creditsUsed }));
    } catch (error) {
      setSummaryError(error instanceof Error ? error.message : t(K("summary.errorGeneral")));
    } finally {
      setIsSummarizing(false);
    }
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
            <small>{isOcr ? t(K("ocr.dropTypes"), { types: ocrExtensions.join(", ").toUpperCase(), max: ocrMaxMegabytes }) : t(K("source.dropTypes"), { max: 25 })}</small>
          </div>
          <input ref={uploadInputRef} className={styles.fileInput} type="file" accept={isOcr ? ocrExtensions.map((extension) => `.${extension}`).join(",") : ".pdf,.docx,.png,.jpg,.jpeg,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/png,image/jpeg"} onChange={(event) => setFileFromList(event.currentTarget.files)} />
          <div className={styles.filePlaceholder}>
            <span className={styles.fileIcon}><FileText size={17} aria-hidden="true" /></span>
            <span className={styles.fileCopy}><strong>{selectedFile?.name ?? t(K("source.filesTitle"))}</strong><small>{selectedFile ? formatFileSize(selectedFile.size) : t(K("source.filesHint"))}</small></span>
            <button type="button" className={styles.replaceFileButton} aria-label={t(K("source.chooseFile"))} onClick={() => uploadInputRef.current?.click()}><Plus size={16} aria-hidden="true" /></button>
          </div>
          {!isOcr && <SelectPlaceholder label={t(K("source.pages"))} value={t(K("source.allPages"))} />}
          <div className={styles.sectionRule} />
          <PanelHeading step="2">{isOcr ? t(K("ocr.typeHeading")) : isSummarize ? t(K("summary.goal")) : t(K("instructions.heading"))}</PanelHeading>
          {isOcr ? (
            <div className={styles.ocrTypeGrid} role="radiogroup" aria-label={t(K("ocr.typeHeading"))}>
              {OCR_DOCUMENT_TYPE_OPTIONS.map(({ id, icon: TypeIcon }) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={ocrType === id}
                  className={`${styles.ocrTypeButton} ${ocrType === id ? styles.ocrTypeActive : ""}`}
                  onClick={() => changeOcrType(id)}
                >
                  <TypeIcon size={15} aria-hidden="true" />
                  <span>{t(K(`ocr.type.${id}`))}</span>
                </button>
              ))}
            </div>
          ) : isSummarize ? (
            <>
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
                      onClick={() => setSummaryStyle(style)}
                    >
                      {style === "executive" ? <NotebookPen size={14} aria-hidden="true" /> : <ListChecks size={14} aria-hidden="true" />}
                      {t(K(`summary.${style}`))}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className={styles.instructionPlaceholder}>
              <span>{t(K("instructions.placeholder"))}</span>
              <small>0 / 600</small>
            </div>
          )}
          {!isOcr && <div className={styles.checkList}>
            {isSummarize ? (
              <>
                <label><input className={styles.summaryCheckbox} type="checkbox" checked={focusAreas.keyTakeaways} onChange={(event) => setFocusAreas((current) => ({ ...current, keyTakeaways: event.target.checked }))} />{t(K("summary.checkTakeaways"))}</label>
                <label><input className={styles.summaryCheckbox} type="checkbox" checked={focusAreas.actionItems} onChange={(event) => setFocusAreas((current) => ({ ...current, actionItems: event.target.checked }))} />{t(K("summary.checkActions"))}</label>
                <label><input className={styles.summaryCheckbox} type="checkbox" checked={focusAreas.importantDates} onChange={(event) => setFocusAreas((current) => ({ ...current, importantDates: event.target.checked }))} />{t(K("summary.checkDates"))}</label>
              </>
            ) : (
              <>
                <div><i className={styles.checkedBox} />{t(K("instructions.extractTables"))}</div>
                <div><i className={styles.checkedBox} />{t(K("instructions.handwriting"))}</div>
                <div><i className={styles.checkedBox} />{t(K("instructions.layout"))}</div>
              </>
            )}
          </div>}
          </aside>
        }
        preview={
          <main className={styles.previewPanel} aria-label={t(K("a11y.preview"))}>
          <div className={styles.previewHeader}>
            <div><span>{t(K("preview.heading"))}</span><small>{isSummarize ? t(K("summary.workspace")) : isOcr ? t(K("ocr.workspace")) : t(K("preview.canvas"))}</small></div>
            {isOcr ? (
              <div className={styles.previewToolbar} aria-label={t(K("preview.controls"))}>
                <button type="button" className={styles.toolbarButton} aria-label={t(K("ocr.tool.zoomIn"))} title={hasPreview ? t(K("ocr.tool.zoomIn")) : t(K("ocr.tool.needFile"))} disabled={!hasPreview || ocrZoom >= 300} onClick={() => setOcrZoom((zoom) => Math.min(300, zoom + 25))}>
                  <ZoomIn size={14} aria-hidden="true" />
                </button>
                <button type="button" className={styles.toolbarButton} aria-label={t(K("ocr.tool.zoomOut"))} title={hasPreview ? t(K("ocr.tool.zoomOut")) : t(K("ocr.tool.needFile"))} disabled={!hasPreview || ocrZoom <= 25} onClick={() => setOcrZoom((zoom) => Math.max(25, zoom - 25))}>
                  <ZoomOut size={14} aria-hidden="true" />
                </button>
                <span className={styles.zoomDropdown} title={hasPreview ? undefined : t(K("ocr.tool.needFile"))}>
                  <Dropdown
                    value={String(ocrZoom)}
                    options={Array.from({ length: 12 }, (_, index) => ({ value: String((index + 1) * 25), label: `${(index + 1) * 25}%` }))}
                    onChange={(value) => setOcrZoom(Number(value))}
                    ariaLabel={t(K("ocr.tool.zoom"))}
                    disabled={!hasPreview}
                    menuPosition="fixed"
                    triggerClassName="h-[26px] min-h-0 w-[68px] gap-1 rounded-md border-transparent bg-transparent px-2 text-[10px] font-medium text-[#59626b] hover:bg-[#fff2ea]"
                    menuClassName="min-w-[96px]"
                    optionClassName="px-2.5 py-1.5 text-[11px]"
                  />
                </span>
                <button type="button" className={`${styles.toolbarButton} ${ocrPan ? styles.toolbarButtonActive : ""}`} aria-label={t(K("ocr.tool.pan"))} aria-pressed={ocrPan} title={hasPreview ? t(K("ocr.tool.pan")) : t(K("ocr.tool.needFile"))} disabled={!hasPreview} onClick={() => { setOcrPan((value) => !value); setOcrAnnotate(false); }}>
                  <Hand size={14} aria-hidden="true" />
                </button>
                <span className={styles.toolbarDivider} />
                <button type="button" className={`${styles.toolbarButton} ${ocrCompare ? styles.toolbarButtonActive : ""}`} aria-label={t(K("preview.compare"))} aria-pressed={ocrCompare} title={!hasPreview ? t(K("ocr.tool.needFile")) : !ocrResult ? t(K("ocr.tool.needResult")) : t(K("ocr.tool.compareHint"))} disabled={!hasPreview || !ocrResult} onClick={() => setOcrCompare((value) => !value)}>
                  <Columns2 size={13} aria-hidden="true" /><span className={styles.toolbarLabel}>{t(K("preview.compare"))}</span>
                </button>
                <button type="button" className={`${styles.toolbarButton} ${ocrAnnotate ? styles.toolbarButtonActive : ""}`} aria-label={t(K("preview.annotate"))} aria-pressed={ocrAnnotate} title={hasPreview ? t(K("ocr.tool.annotateHint")) : t(K("ocr.tool.needFile"))} disabled={!hasPreview} onClick={() => { setOcrAnnotate((value) => !value); setOcrPan(false); }}>
                  <MessageSquarePlus size={13} aria-hidden="true" /><span className={styles.toolbarLabel}>{t(K("preview.annotate"))}</span>
                </button>
                <button type="button" className={styles.toolbarButton} aria-label={t(K("preview.export"))} title={ocrResult ? t(K("ocr.tool.exportHint")) : t(K("ocr.tool.needResult"))} disabled={!ocrResult || isToolbarExporting} onClick={() => void exportFromToolbar()}>
                  <Download size={13} aria-hidden="true" /><span className={styles.toolbarLabel}>{isToolbarExporting ? t(K("ocr.exporting")) : t(K("preview.export"))}</span>
                </button>
              </div>
            ) : (
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
            )}
          </div>

          <div className={`${styles.previewStage} ${isSummarize ? styles.previewStageSummary : ""} ${isOcr && selectedFile && canPreviewFile(selectedFile) ? styles.previewStageDocument : ""}`}>
            {isSummarize ? (
              <div className={styles.summaryStage}>
                <article className={styles.summaryDocument}>
                  <div className={styles.summaryDocumentTopline}>
                    <span className={styles.sampleBadge}>{summaryResult ? t(K("summary.generated")) : t(K("summary.sample"))}</span>
                    <span>{selectedFile?.name ?? t(K("summary.sampleDoc"))}</span>
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
                  {summaryResult?.actionItems.length ? <div className={styles.summaryTakeaways}><h4>{t(K("summary.actionItems"))}</h4><ul>{summaryResult.actionItems.map((item, index) => <li key={`${index}-${item.task}`}>{item.task}{item.owner ? ` · ${item.owner}` : ""}{item.dueDate ? ` · ${item.dueDate}` : ""}</li>)}</ul></div> : null}
                  {summaryResult?.decisions.length ? <div className={styles.summaryTakeaways}><h4>{t(K("summary.decisions"))}</h4><ul>{summaryResult.decisions.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul></div> : null}
                  {summaryResult?.importantDates.length ? <div className={styles.summaryTakeaways}><h4>{t(K("summary.importantDates"))}</h4><ul>{summaryResult.importantDates.map((item, index) => <li key={`${index}-${item.date}-${item.event}`}>{item.date} · {item.event}</li>)}</ul></div> : null}
                  <div className={styles.summaryDocumentFooter}>{summaryResult ? t(K("summary.generatedBy"), { model: summaryOptions.model }) : t(K("summary.footer"))}</div>
                </article>
                {isSummarizing && <div className={styles.summaryLoading} role="status"><Sparkles size={18} aria-hidden="true" /><strong>{t(K("summary.loading"))}</strong><span>{t(K("summary.loadingHint"))}</span></div>}
              </div>
            ) : isOcr && selectedFile && canPreviewFile(selectedFile) ? (
              <DocumentPreview key={`${selectedFile.name}-${selectedFile.size}-${selectedFile.lastModified}`} file={selectedFile} running={isOcrRunning} zoom={ocrZoom} pan={ocrPan} annotate={ocrAnnotate} compareText={compareText} />
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
                  {!(isOcr && isOcrRunning) && (
                    <div className={styles.canvasEmptyState}>
                      <span><FileText size={22} aria-hidden="true" /></span>
                      <strong>{isOcr && selectedFile ? selectedFile.name : t(K("preview.emptyTitle"))}</strong>
                      <small>{isOcr && selectedFile ? formatFileSize(selectedFile.size) : t(K("preview.emptyHint"))}</small>
                    </div>
                  )}
                  {isOcr && isOcrRunning && <div className={styles.summaryLoading} role="status"><Sparkles size={18} aria-hidden="true" /><strong>{t(K("ocr.loading"))}</strong><span>{t(K("ocr.loadingHint"))}</span></div>}
                  <div className={styles.canvasPageNumber}>{t(K("preview.pageOf"))}</div>
                </div>
              </>
            )}
          </div>

          {isSummarize ? (
            <div className={styles.summaryOutputCards}>
              <article><div><NotebookPen size={13} /><strong>{t(K("summary.cardExecutive"))}</strong></div><p>{summaryResult?.executiveSummary ?? t(K("summary.cardExecutiveBody"))}</p></article>
              <article><div><ListChecks size={13} /><strong>{t(K("summary.takeawaysHeading"))}</strong></div><p>{summaryResult?.keyTakeaways.join(" · ") ?? t(K("summary.cardTakeawaysBody"))}</p></article>
              <article><div><Sparkles size={13} /><strong>{summaryResult ? t(K("summary.actionItems")) : t(K("summary.cardNext"))}</strong></div><p>{summaryResult ? [...summaryResult.actionItems.map((item) => item.task), ...summaryResult.importantDates.map((item) => `${item.date}: ${item.event}`)].join(" · ") || t(K("summary.noneFound")) : t(K("summary.cardNextBody"))}</p></article>
            </div>
          ) : (
            <div className={styles.outputCards}>
              {isOcr && ocrResult ? (
                buildOcrCards(ocrResult, locale, t).map((card, index) => {
                  const Icon = outputs[index]?.icon ?? Sparkles;
                  return (
                    // A div, not a button: buttons centre their content vertically and the page-wide text floor
                    // forces buttons and list items to a larger size than the rest of the card.
                    <div
                      role="button"
                      tabIndex={0}
                      className={`${styles.outputCard} ${styles.outputCardFilled}`}
                      key={card.slot}
                      title={t(K("cards.openResult"))}
                      onClick={() => ocrResultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          ocrResultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                        }
                      }}
                    >
                      <div className={styles.outputTitle}><Icon size={13} aria-hidden="true" /><strong>{card.title}</strong></div>
                      <div className={`${styles.outputCardBody} ${card.muted ? styles.outputCardMuted : ""}`}>
                        {card.lines.map((line, lineIndex) => <span key={lineIndex}>{line}</span>)}
                      </div>
                    </div>
                  );
                })
              ) : outputs.map(({ key, icon: Icon }) => (
                <div className={styles.outputCard} key={key}>
                  <div className={styles.outputTitle}><Icon size={13} aria-hidden="true" /><strong>{t(key)}</strong></div>
                  <i /><i /><i />
                  <small>{t(K("output.pending"))}</small>
                </div>
              ))}
            </div>
          )}
          {isOcr && ocrResult && (
            <div className={styles.ocrResultsPanel} ref={ocrResultsRef}>
              <div className={styles.ocrStats}>
                <article><small>{t(K("ocr.statPages"))}</small><strong>{ocrResult.pages}</strong></article>
                <article><small>{t(K("ocr.statDocuments"))}</small><strong>{ocrResult.text.length ? ocrResult.text.length : ocrResult.documents.length}</strong></article>
                <article><small>{t(K("ocr.statCredits"))}</small><strong>{ocrResult.creditsUsed + (ocrResult.styleCreditsUsed ?? 0)}</strong></article>
                <article><small>{t(K("ocr.statTime"))}</small><strong>{ocrResult.processMs !== undefined ? `${(ocrResult.processMs / 1000).toFixed(1)}s` : "—"}</strong></article>
              </div>
              <OcrResultView result={ocrResult} fileName={selectedFile?.name ?? ""} showConfidence={ocrConfidence} exportFormat={ocrFormat} showStyled={ocrShowStyled} onShowStyledChange={setOcrShowStyled} />
            </div>
          )}
          </main>
        }
        right={
          <aside className={styles.settingsPanel} aria-label={t(K("a11y.settings"))}>
          <PanelHeading step="3">{t(K("settings.heading"))}</PanelHeading>
          <div className={styles.settingGroup}>
            <div className={styles.settingLabel}>{t(K("settings.model"))} <span>ⓘ</span></div>
            {isSummarize || isOcr ? <div className={`${styles.modelCards} ${styles.singleModel}`}><div className={`${styles.modelCard} ${styles.modelCardActive}`}><i /><strong>{isOcr ? t(K("ocr.modelName")) : t(K("summary.modelName"))}</strong><small>{isOcr ? t(K("ocr.modelHint")) : t(K("summary.modelHint"))}</small></div></div> : <div className={styles.modelCards}>
              <div className={`${styles.modelCard} ${styles.modelCardActive}`}><i /><strong>{t(K("settings.standard"))}</strong><small>{t(K("settings.standardHint"))}</small></div>
              <div className={styles.modelCard}><i /><strong>{t(K("settings.premium"))}</strong><small>{t(K("settings.premiumHint"))}</small></div>
            </div>}
          </div>
          <div className={styles.settingGroup}>
            <div className={styles.settingLabel}>{t(K("settings.outputFormat"))}</div>
            <div className={styles.formatCards}>
              {["DOCX", "PDF", "TXT", "JSON"].map((format, index) => {
                if (!isOcr) {
                  return (
                    <div key={format} className={`${styles.formatCard} ${index === 0 ? styles.formatCardActive : ""}`}>
                      <FileText size={18} aria-hidden="true" /><span>{format}</span>
                    </div>
                  );
                }
                const formatId = format.toLowerCase() as OcrOutputFormat;
                const selected = ocrFormat === formatId;
                return (
                  <button
                    key={format}
                    type="button"
                    className={`${styles.formatCard} ${styles.formatButton} ${selected ? styles.formatCardActive : ""}`}
                    aria-pressed={selected}
                    onClick={() => setOcrFormat(formatId)}
                  >
                    <FileText size={18} aria-hidden="true" /><span>{format}</span>
                  </button>
                );
              })}
            </div>
          </div>
          {isOcr ? (
            <>
              {ocrTypeInfo?.supports.targetLang && (
                <SelectControl
                  label={t(K("ocr.language"))}
                  value={ocrLanguage}
                  onChange={(value) => setOcrLanguage(value as "th" | "en")}
                  options={[{ value: "th", label: t(K("ocr.langThai")) }, { value: "en", label: t(K("ocr.langEnglish")) }]}
                />
              )}
              <SelectControl
                label={t(K("settings.pageRange"))}
                value={ocrPageRangeMode}
                onChange={(value) => setOcrPageRangeMode(value as "all" | "custom")}
                options={[
                  { value: "all", label: pdfPageCount ? t(K("ocr.pageRangeAllCount"), { count: pdfPageCount }) : t(K("source.allPages")) },
                  { value: "custom", label: t(K("ocr.pageRangeCustom")) },
                ]}
                disabled={!selectedIsPdf}
                title={selectedIsPdf ? undefined : t(K("ocr.pageRangePdfOnly"))}
              />
              {selectedIsPdf && ocrPageRangeMode === "custom" && (
                <input
                  className={`${styles.controlSelect} ${styles.pageRangeInput}`}
                  type="text"
                  inputMode="numeric"
                  aria-label={t(K("settings.pageRange"))}
                  value={ocrPageRange}
                  maxLength={100}
                  placeholder={t(K("ocr.pageRangePlaceholder"))}
                  onChange={(event) => setOcrPageRange(event.target.value)}
                />
              )}
              {ocrTypeInfo?.depths && (
                <SelectControl
                  label={t(K("settings.depth"))}
                  value={ocrDepth}
                  onChange={(value) => {
                    setOcrDepth(value as OcrDepth);
                    if (value === "advanced") setOcrStyle("original");
                  }}
                  options={[{ value: "basic", label: t(K("ocr.depthBasic")) }, { value: "advanced", label: t(K("ocr.depthAdvanced")) }]}
                />
              )}
              {ocrTypeInfo?.styles && (
                <SelectControl
                  label={t(K("settings.tone"))}
                  value={ocrDepth === "advanced" ? "original" : ocrStyle}
                  onChange={(value) => setOcrStyle(value as OcrStyleChoice)}
                  options={ocrTypeInfo.styles.map((style) => ({ value: style, label: t(K(`ocr.style.${style}`)) }))}
                  disabled={ocrDepth === "advanced"}
                  title={ocrDepth === "advanced" ? t(K("ocr.notSupported")) : undefined}
                />
              )}
              {ocrTypeInfo && ocrTypeInfo.id !== "general" && (
                <label className={styles.ocrToggle}>
                  <input className={styles.summaryCheckbox} type="checkbox" checked={ocrConfidence} onChange={(event) => setOcrConfidence(event.target.checked)} />{t(K("ocr.confidence"))}
                </label>
              )}
              {ocrTypeInfo?.supports.returnOcr && (
                <label className={styles.ocrToggle}>
                  <input className={styles.summaryCheckbox} type="checkbox" checked={ocrReturnRaw} onChange={(event) => setOcrReturnRaw(event.target.checked)} />{t(K("ocr.returnRaw"))}
                </label>
              )}
            </>
          ) : isSummarize ? (
            <>
              <SelectControl label={t(K("settings.language"))} value={summaryLanguage} onChange={(value) => setSummaryLanguage(value as "auto" | "English" | "Thai")} options={[{ value: "auto", label: t(K("summary.languageAuto")) }, { value: "English", label: t(K("summary.languageEnglish")) }, { value: "Thai", label: t(K("summary.languageThai")) }]} />
              <SelectControl label={t(K("summary.length"))} value={summaryLength} onChange={(value) => setSummaryLength(value as "brief" | "standard" | "detailed")} options={[{ value: "brief", label: t(K("summary.lengthBrief")) }, { value: "standard", label: t(K("summary.lengthStandard")) }, { value: "detailed", label: t(K("summary.lengthDetailed")) }]} />
              <div className={styles.summaryFocusNote}>{t(K("summary.focus"))}: {[focusAreas.keyTakeaways && t(K("summary.focusTakeaways")), focusAreas.actionItems && t(K("summary.focusActions")), focusAreas.importantDates && t(K("summary.focusDates"))].filter(Boolean).join(", ") || t(K("summary.focusGeneral"))}</div>
              <SelectPlaceholder label={t(K("settings.tone"))} value={t(K("summary.toneValue"))} />
            </>
            ) : (
              <>
              <SelectPlaceholder label={t(K("settings.language"))} value={t(K("settings.languageValue"))} />
              <SelectPlaceholder label={t(K("settings.pageRange"))} value={t(K("source.allPages"))} />
              <SelectPlaceholder label={t(K("settings.depth"))} value={t(K("settings.depthValue"))} />
              <SelectPlaceholder label={t(K("settings.tone"))} value={t(K("settings.toneValue"))} />
            </>
          )}
          <div className={styles.estimate}><span>{t(K("settings.estimate"))}</span><strong>{isSummarize ? t(K(summaryOptions.credits === 1 ? "summary.creditsSingular" : "summary.creditsPlural"), { value: summaryOptions.credits }) : isOcr ? t(K("ocr.creditsPerPage"), { value: ocrCreditsPerPage ?? "—" }) : t(K("settings.credits"))}</strong></div>
          {isOcr && showStyleCredits && <div className={styles.summaryFocusNote}>{t(K("ocr.styleCreditsNote"), { value: ocrTypeInfo?.styleCredits ?? 0 })}</div>}
          <button className={styles.generateButton} type="button" disabled={(!isSummarize && !isOcr) || !selectedFile || isSummarizing || isOcrRunning} onClick={() => void (isOcr ? runOcr() : generateSummary())}>
            <span>{isOcrRunning ? t(K("ocr.running")) : isSummarizing ? t(K("summary.generating")) : isOcr ? t(K("ocr.run")) : isSummarize ? t(K("summary.generate")) : t(K("settings.generate"))}</span>
            <Sparkles size={17} aria-hidden="true" />
          </button>
          {(isOcr ? ocrError : summaryError) && <div className={styles.summaryError} role="alert">{isOcr ? ocrError : summaryError}</div>}
          <div className={styles.secureNote}><span />{isSummarize ? t(K("summary.processingNote")) : t(K("settings.secure"))}</div>
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
