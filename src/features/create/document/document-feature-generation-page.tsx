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
import { listDocumentOcrTypes, runDocumentOcr, type DocumentOcrResult, type OcrDocumentTypeId, type OcrDepth, type OcrDocumentTypeInfo, type OcrHistoryItem, type OcrOutputFormat, type OcrStyleChoice } from "@/lib/api/document-ocr";
import { getContractOptions, reviewContract, type ContractHistoryItem, type ContractReviewResult, type ContractTypeId } from "@/lib/api/document-contract";
import { getFormDocument, getFormOptions, readForm, saveFormEdits, type FormBox, type FormField, type FormHistoryItem, type FormReadResult } from "@/lib/api/document-form";
import { getDocumentSummaryOptions, summarizeDocument, type DocumentSummary } from "@/lib/api/document-summarize";
import type { TranslationKey } from "@/lib/i18n/dictionary";
import { useLocale } from "@/lib/i18n/locale-provider";
import { CONTRACT_PARTIES, CONTRACT_TYPE_OPTIONS } from "./contract-types";
import { ContractHistoryPanel } from "./contract-history";
import { downloadFormResult, formToJson, formToText, LOW_CONFIDENCE, type FormExportFormat } from "./form-export";
import { FormToolbar, type FitMode, type FormTool } from "./form-toolbar";
import { FormHistoryPanel } from "./form-history";
import { FormResultsView } from "./form-results-view";
import { jpegPagesToFile, pagesToDocx } from "./edited-document";
import { DEFAULT_HIGHLIGHT, DEFAULT_MARK_STYLE, marksToPdf, type MarkStyle, type MarkTool, type PageMark, type PreviewHandle } from "./preview-marks";
import { SignaturePad } from "./signature-pad";
import { ContractReviewView } from "./contract-review-view";
import { DEFAULT_OCR_EXTENSIONS, DEFAULT_OCR_MAX_MEGABYTES, OCR_DOCUMENT_TYPE_OPTIONS } from "./ocr-document-types";
import { canPreviewFile, DocumentPreview, type PreviewOverlayBox, type PreviewRotation } from "./document-preview";
import { contractToText, downloadContractReview } from "./contract-export";
import { ExportMenu } from "./export-menu";
import { buildOcrCards } from "./ocr-cards";
import { downloadBlob, downloadOcrResult, ocrResultToText } from "./ocr-download";
import { OcrHistoryPanel } from "./ocr-history";
import { OcrFullTextView, OcrResultView } from "./ocr-result-view";
import styles from "./document-feature-generation-page.module.css";

const K = (key: string) => `create.document.${key}` as TranslationKey;

const FORM_EXPORT_FORMATS: ReadonlyArray<{ id: FormExportFormat; label: string }> = [
  { id: "docx", label: "DOCX" },
  { id: "pdf", label: "PDF" },
  { id: "csv", label: "CSV" },
  { id: "txt", label: "TXT" },
  { id: "json", label: "JSON" },
];

type ModeId = "ocr" | "summarize" | "translate" | "contract" | "report" | "form";
type SummaryStyle = "executive" | "bullets";

const modes: { id: ModeId; icon: typeof ScanText; available?: boolean }[] = [
  { id: "ocr", icon: ScanText, available: true },
  { id: "summarize", icon: NotebookPen, available: true },
  { id: "translate", icon: Languages },
  { id: "contract", icon: FileCheck2, available: true },
  { id: "report", icon: BarChart3 },
  { id: "form", icon: ListChecks, available: true },
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

/** Which tool is open lives in the URL (`?tab=contract`), so a refresh or a shared link comes back to the same tool. */
const MODE_PARAM = "tab";
const modeFromId = (value: string | null) => modes.find((mode) => mode.id === value && mode.available)?.id;

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

export function DocumentFeatureGenerationPage() {
  const { locale, t } = useLocale();
  const [activeMode, setActiveMode] = useState<ModeId>("ocr");

  // The URL is only known in the browser, so the saved tool is picked up right after the first render.
  useEffect(() => {
    const saved = modeFromId(new URLSearchParams(window.location.search).get(MODE_PARAM));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved) setActiveMode(saved);
  }, []);

  const selectMode = (id: ModeId) => {
    setActiveMode(id);
    const url = new URL(window.location.href);
    if (id === "ocr") url.searchParams.delete(MODE_PARAM);
    else url.searchParams.set(MODE_PARAM, id);
    window.history.replaceState(window.history.state, "", url);
  };
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
  const [ocrReturnRaw, setOcrReturnRaw] = useState(true);
  const [ocrFormat, setOcrFormat] = useState<OcrOutputFormat>("txt");
  const [ocrPageRange, setOcrPageRange] = useState("");
  const [ocrPageRangeMode, setOcrPageRangeMode] = useState<"all" | "custom">("all");
  const [pdfInfo, setPdfInfo] = useState<{ file: File; count: number } | null>(null);
  const [ocrDepth, setOcrDepth] = useState<OcrDepth>("basic");
  const [ocrZoom, setOcrZoom] = useState(100);
  const [ocrTab, setOcrTab] = useState<"preview" | "result" | "text" | "history">("preview");
  const [historyKey, setHistoryKey] = useState(0);
  /** Name of the file the shown result came from; a result opened from history has no file selected. */
  const [ocrResultName, setOcrResultName] = useState("");
  const [ocrFromHistory, setOcrFromHistory] = useState(false);
  const [ocrPan, setOcrPan] = useState(false);
  const [ocrCompare, setOcrCompare] = useState(false);
  const [ocrAnnotate, setOcrAnnotate] = useState(false);
  const [ocrShowStyled, setOcrShowStyled] = useState(true);
  const [ocrResultPages, setOcrResultPages] = useState<number[] | null>(null);
  const [isToolbarExporting, setIsToolbarExporting] = useState(false);
  const [isContractExporting, setIsContractExporting] = useState(false);
  const [ocrStyle, setOcrStyle] = useState<OcrStyleChoice>("original");
  const [ocrResult, setOcrResult] = useState<DocumentOcrResult | null>(null);
  const [ocrError, setOcrError] = useState("");
  const [isOcrRunning, setIsOcrRunning] = useState(false);
  const [contractType, setContractType] = useState<ContractTypeId>("auto");
  const [contractParty, setContractParty] = useState("");
  const [contractLanguage, setContractLanguage] = useState<"auto" | "English" | "Thai">(locale === "en" ? "English" : "Thai");
  const [contractResult, setContractResult] = useState<ContractReviewResult | null>(null);
  const [contractResultName, setContractResultName] = useState("");
  const [contractError, setContractError] = useState("");
  const [isContractRunning, setIsContractRunning] = useState(false);
  const [contractTab, setContractTab] = useState<"preview" | "review" | "history">("preview");
  const [contractHistoryKey, setContractHistoryKey] = useState(0);
  /** A review opened from history has no file behind it, so there is nothing to preview or compare. */
  const [contractFromHistory, setContractFromHistory] = useState(false);
  const [contractCredits, setContractCredits] = useState(3);
  const [formOptions, setFormOptions] = useState({ credits: 3, maxPages: 5 });
  const [formHow, setFormHow] = useState<"auto" | "custom">("auto");
  const [formFieldNames, setFormFieldNames] = useState("");
  const [formResult, setFormResult] = useState<FormReadResult | null>(null);
  /** The fields as the user has corrected them; the exports and the history download use these. */
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [formResultName, setFormResultName] = useState("");
  /** A reading opened from history has no form behind it, so there is nothing to show boxes on. */
  const [formFromHistory, setFormFromHistory] = useState(false);
  const [formError, setFormError] = useState("");
  const [isFormRunning, setIsFormRunning] = useState(false);
  const [isFormExporting, setIsFormExporting] = useState(false);
  const [formTab, setFormTab] = useState<"preview" | "results" | "history">("preview");
  /** Whether the values read are written inside their boxes on the form. */
  const [formShowValues, setFormShowValues] = useState(false);
  const [formHistoryKey, setFormHistoryKey] = useState(0);
  const [formSelectedId, setFormSelectedId] = useState<string | null>(null);
  /** What the pointer does on the form page; one thing at a time, like a PDF reader. */
  const [formTool, setFormTool] = useState<FormTool>("select");
  const formDraw = formTool === "draw";
  const setFormDraw = (on: boolean) => setFormTool((current) => (on ? "draw" : current === "draw" ? "select" : current));
  const [formFit, setFormFit] = useState<{ mode: FitMode; nonce: number }>({ mode: "width", nonce: 0 });
  const [formReflow, setFormReflow] = useState(false);
  /** Signed once, placed as often as needed. */
  const [formSignature, setFormSignature] = useState<{ url: string; ratio: number } | null>(null);
  const [signaturePadOpen, setSignaturePadOpen] = useState(false);
  const [isSavingMarks, setIsSavingMarks] = useState(false);
  /** The history entry the changes are saved into, and whether its pages are already kept there. */
  const [formHistoryId, setFormHistoryId] = useState<string | null>(null);
  const [formDocumentSaved, setFormDocumentSaved] = useState(false);
  /** Marks saved earlier, put back on the form when it is opened from history. */
  const [formInitialMarks, setFormInitialMarks] = useState<PageMark[]>([]);
  const [formNotice, setFormNotice] = useState("");
  const formNoticeTimer = useRef<number | undefined>(undefined);
  const formPreviewRef = useRef<PreviewHandle>(null);
  /** The font, size and colour the next typed text starts with; changing it also restyles the text that is selected. */
  const [textStyle, setTextStyle] = useState<MarkStyle>(DEFAULT_MARK_STYLE);
  const [highlightColor, setHighlightColor] = useState<string>(DEFAULT_HIGHLIGHT);
  const changeHighlightColor = (color: string) => {
    setHighlightColor(color);
    formPreviewRef.current?.applyHighlight(color);
  };
  const changeTextStyle = (patch: Partial<MarkStyle>) => {
    setTextStyle((current) => ({ ...current, ...patch }));
    formPreviewRef.current?.applyStyle(patch);
  };
  const [formRotation, setFormRotation] = useState<PreviewRotation>(0);
  const [formGoToPage, setFormGoToPage] = useState<{ page: number; nonce: number } | undefined>(undefined);
  const [formRegion, setFormRegion] = useState<FormBox | null>(null);
  const [formRegionLabel, setFormRegionLabel] = useState("");
  const [formRegionValue, setFormRegionValue] = useState("");
  const nextUserField = useRef(1);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  // On a narrow screen the row of modes scrolls sideways, so the one that is open is brought into view.
  useEffect(() => {
    document.querySelector<HTMLElement>('nav[class*="modeTabs"] [aria-pressed="true"]')?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [activeMode]);
  const isSummarize = activeMode === "summarize";
  const isOcr = activeMode === "ocr";
  const isContract = activeMode === "contract";
  const isForm = activeMode === "form";
  const ocrTypeInfo = ocrTypes.find((type) => type.id === ocrType);
  const ocrExtensions: readonly string[] = ocrTypeInfo?.extensions ?? DEFAULT_OCR_EXTENSIONS;
  const ocrMaxMegabytes = ocrTypeInfo?.maxMegabytes ?? DEFAULT_OCR_MAX_MEGABYTES;
  const selectedIsPdf = selectedFile?.name.toLowerCase().endsWith(".pdf") ?? true;
  const pdfPageCount = pdfInfo && pdfInfo.file === selectedFile ? pdfInfo.count : null;
  const hasPreview = (isOcr || isContract || isForm) && !!selectedFile && canPreviewFile(selectedFile);
  /** The preview tools (zoom, hand, compare, notes) only apply while the document itself is on show. */
  const showPreviewTools = isOcr ? ocrTab === "preview" : isContract ? contractTab === "preview" : false;
  const compareReady = isContract ? !!contractResult && !contractFromHistory : !!ocrResult && !ocrFromHistory;
  const preferStyled = ocrShowStyled && !!ocrResult?.styledText?.length;
  /** The extracted text for one page of the uploaded document, shown beside it by the Compare tool. */
  const compareText: ((page: number) => string) | null = !hasPreview || !ocrCompare || !compareReady ? null : isContract ? (page: number): string => {
    // A contract review is about the whole document, so it sits beside the first page.
    if (page !== 1 || !contractResult) return t(K("contract.compareOtherPages"));
    return contractToText(contractResult.review, t);
  } : (page: number): string => {
    if (!ocrResult) return "";
    const index = ocrResultPages ? ocrResultPages.indexOf(page) : page - 1;
    if (index < 0) return t(K("ocr.compareOutOfRange"));
    if (ocrResult.layout?.length) return ocrResult.layout[index]?.components.map((component) => component.text).join("\n\n") ?? "";
    const pages = preferStyled ? ocrResult.styledText ?? ocrResult.text : ocrResult.text;
    return pages.length ? pages[index] ?? "" : ocrResultToText(ocrResult, locale, t);
  };
  const exportFromToolbar = async (format: OcrOutputFormat) => {
    if (!ocrResult || isToolbarExporting) return;
    setIsToolbarExporting(true);
    try {
      // The Word / PDF iApp drew is only right for the format it was made in; any other choice is built from the result.
      const result = { ...ocrResult };
      if (result.outputFormat !== format) delete result.file;
      await downloadOcrResult({ result, fileName: ocrResultName, format, preferStyled, locale, t });
    } catch {
      setOcrError(t(K("ocr.exportFailed")));
    } finally {
      setIsToolbarExporting(false);
    }
  };
  const exportContract = async (format: OcrOutputFormat) => {
    if (!contractResult || isContractExporting) return;
    setIsContractExporting(true);
    try {
      await downloadContractReview({ review: contractResult.review, fileName: contractResultName, format, t });
    } catch {
      setContractError(t(K("ocr.exportFailed")));
    } finally {
      setIsContractExporting(false);
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
    void getContractOptions().then((options) => {
      if (mounted) setContractCredits(options.credits);
    }).catch(() => undefined);
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let mounted = true;
    void getFormOptions().then((options) => {
      if (mounted) setFormOptions({ credits: options.creditsPerPage, maxPages: options.maxPages });
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
      const reportProblem = isForm ? setFormError : isContract ? setContractError : setSummaryError;
      if (!extension || !["pdf", "docx", "png", "jpg", "jpeg"].includes(extension) || (isForm && extension === "docx")) {
        reportProblem(isForm ? t(K("form.errorType")) : t(K("summary.errorType")));
        return;
      }
      if (file.size > 25 * 1024 * 1024) {
        reportProblem(t(K("summary.errorSize")));
        return;
      }
    }
    setSelectedFile(file);
    setOcrPageRangeMode("all");
    setOcrPageRange("");
    setSummaryResult(null);
    setSummaryError("");
    setOcrResult(null);
    setOcrTab("preview");
    setOcrError("");
    setContractResult(null);
    setContractTab("preview");
    setContractError("");
    setFormResult(null);
    setFormFields([]);
    setFormFromHistory(false);
    setFormTab("preview");
    setFormError("");
    setFormSelectedId(null);
    setFormRegion(null);
    setFormTool("select");
    setFormRotation(0);
    setFormReflow(false);
    setFormHistoryId(null);
    setFormDocumentSaved(false);
    setFormInitialMarks([]);
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
    setOcrTab("preview");
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

  /** Shows a result saved in history. Its file is not stored, so there is nothing to preview or compare. */
  const openFromHistory = (result: DocumentOcrResult, item: OcrHistoryItem) => {
    setOcrType(result.documentType);
    setOcrResult(result);
    setOcrResultName(item.fileName);
    setOcrFromHistory(true);
    setOcrCompare(false);
    setOcrError("");
    setOcrTab("result");
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
    setOcrTab("preview");
    setOcrResultPages(pageRange ? pagesInRange(pageRange) : null);
    try {
      const supports = ocrTypeInfo?.supports;
      const result = await runDocumentOcr({
        file: selectedFile,
        documentType: ocrType,
        ...(supports?.targetLang ? { targetLang: ocrLanguage } : {}),
        ...(supports?.includeConfidence ? { includeConfidence: ocrConfidence } : {}),
        ...(supports?.returnOcr ? { returnOcr: ocrReturnRaw } : {}),
        ...(usesProviderFile && (ocrFormat === "docx" || ocrFormat === "pdf") ? { outputFormat: ocrFormat } : {}),
        ...(pageRange ? { pageRange } : {}),
        ...(ocrDepth === "advanced" ? { depth: ocrDepth } : {}),
        ...(ocrStyle !== "original" && ocrDepth === "basic" ? { style: ocrStyle } : {}),
      });
      setOcrResult(result);
      setOcrResultName(selectedFile.name);
      setOcrFromHistory(false);
      setOcrTab("result");
      setHistoryKey((key) => key + 1);
    } catch (error) {
      setOcrError(error instanceof Error ? error.message : t(K("ocr.errorGeneral")));
    } finally {
      setIsOcrRunning(false);
    }
  };

  /** The boxes drawn on the form: one per field, the selected one highlighted, plus the region being picked. */
  const formOverlay: PreviewOverlayBox[] = formFromHistory ? [] : [
    ...formFields.flatMap((field, index) => field.boxes.map((box): PreviewOverlayBox => ({
      id: field.id,
      page: box.page,
      left: box.left,
      top: box.top,
      right: box.right,
      bottom: box.bottom,
      label: index + 1,
      state: field.id === formSelectedId ? "selected" : field.confidence < LOW_CONFIDENCE ? "low" : "normal",
      // A value shows on the form when "show values" is on, and always once the person has corrected it.
      ...((formShowValues && field.value) || (field.original !== undefined && field.original !== field.value) ? { value: field.value } : {}),
    }))),
    ...(formRegion ? [{ id: "region", ...formRegion, label: "+", state: "region" as const }] : []),
  ];

  /** The text the OCR found inside a box, in reading order. */
  const textInBox = (box: FormBox): string => {
    const inside = (formResult?.blocks ?? []).filter((block) => {
      const x = (block.left + block.right) / 2;
      const y = (block.top + block.bottom) / 2;
      return block.page === box.page && x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
    });
    return inside.sort((a, b) => a.top - b.top || a.left - b.left).map((block) => block.text).join(" ");
  };

  const handleFormDrawn = (page: number, box: { left: number; top: number; right: number; bottom: number }) => {
    const region = { page, ...box };
    setFormRegion(region);
    setFormRegionLabel("");
    setFormRegionValue(textInBox(region));
    setFormSelectedId(null);
    setFormDraw(false);
  };

  const addRegionField = () => {
    const label = formRegionLabel.trim();
    if (!formRegion || !label) return;
    const id = `u${nextUserField.current++}`;
    // The person drew this box and typed this name, so there is nothing for the AI to be unsure about.
    setFormFields((current) => [...current, { id, label, value: formRegionValue.trim(), type: "text", confidence: 1, boxes: [formRegion] }]);
    setFormSelectedId(id);
    setFormRegion(null);
  };

  const changeFormValue = (id: string, value: string) => {
    // The first correction remembers what was read, which is how an edited field is told from an untouched one.
    setFormFields((current) => current.map((field) => (field.id === id ? { ...field, value, original: field.original ?? field.value } : field)));
  };

  const locateFormField = (id: string) => {
    const box = formFields.find((field) => field.id === id)?.boxes[0];
    setFormSelectedId(id);
    setFormTab("preview");
    if (box) setFormGoToPage({ page: box.page, nonce: Date.now() });
  };

  /**
   * Shows a reading saved in history. One whose changes were saved comes back as the edited document (its pages and
   * marks); any other keeps only its fields, since the form itself is not stored.
   */
  const openFormFromHistory = async (result: FormReadResult, item: FormHistoryItem) => {
    setFormSelectedId(null);
    setFormRegion(null);
    setFormDraw(false);
    setFormError("");
    setFormHistoryId(item.id);
    setFormResultName(item.fileName);
    if (item.hasDocument) {
      try {
        const saved = await getFormDocument(item.id);
        const file = await jpegPagesToFile(saved.pages, item.fileName);
        const rotation = [90, 180, 270].includes(saved.edits.rotation) ? (saved.edits.rotation as PreviewRotation) : 0;
        setSelectedFile(file);
        setOcrZoom(100);
        setFormInitialMarks(saved.edits.marks as PageMark[]);
        setFormRotation(rotation);
        setFormResult({ ...result, blocks: [] });
        setFormFields(result.fields);
        setFormFromHistory(false);
        setFormDocumentSaved(true);
        setFormReflow(false);
        setFormTool("select");
        setFormTab("preview");
        return;
      } catch {
        showFormNotice(t(K("form.history.documentFailed")));
      }
    }
    setFormResult(result);
    setFormFields(result.fields);
    setFormFromHistory(true);
    setFormDocumentSaved(false);
    setFormTab("results");
  };

  const runForm = async () => {
    if (!selectedFile || isFormRunning) return;
    if (formHow === "custom" && !formFieldNames.trim()) {
      setFormError(t(K("form.errorFields")));
      return;
    }
    setIsFormRunning(true);
    setFormError("");
    setFormResult(null);
    setFormFields([]);
    setFormRegion(null);
    setFormSelectedId(null);
    setFormTab("preview");
    try {
      const result = await readForm({ file: selectedFile, ...(formHow === "custom" ? { fields: formFieldNames } : {}) });
      setFormResult(result);
      setFormFields(result.fields);
      setFormResultName(selectedFile.name);
      setFormFromHistory(false);
      setFormHistoryId(result.historyId ?? null);
      setFormDocumentSaved(false);
      if (result.pages.length) setFormOptions((current) => ({ ...current, credits: result.creditsUsed / result.pages.length }));
      setFormHistoryKey((key) => key + 1);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : t(K("form.errorGeneral")));
    } finally {
      setIsFormRunning(false);
    }
  };

  const exportForm = async (format: FormExportFormat) => {
    if (!formFields.length || isFormExporting) return;
    setIsFormExporting(true);
    try {
      // Word and PDF are the document itself with everything done to it: turned, marked, filled in. Without the form on
      // screen (a reading opened from history) there is nothing to draw on, so they hold the fields instead.
      const edited = (format === "docx" || format === "pdf") && !formFromHistory ? await formPreviewRef.current?.exportPages() : null;
      if (edited) {
        const baseName = (selectedFile?.name ?? formResultName).replace(/\.[^.]+$/, "") || "form";
        downloadBlob(`${baseName}-edited.${format}`, format === "pdf" ? await marksToPdf(edited) : pagesToDocx(edited));
        return;
      }
      await downloadFormResult({
        fields: formFields,
        fileName: formResultName,
        format,
        t,
        // A reading opened from history no longer has the pages' text, so it is saved as the fields only.
        ...(formResult && !formFromHistory ? { blocks: formResult.blocks, pages: formResult.pages.length } : {}),
      });
    } catch {
      setFormError(t(K("ocr.exportFailed")));
    } finally {
      setIsFormExporting(false);
    }
  };

  const showFormNotice = (message: string) => {
    setFormNotice(message);
    window.clearTimeout(formNoticeTimer.current);
    formNoticeTimer.current = window.setTimeout(() => setFormNotice(""), 4500);
  };

  /** Picks a tool. The signature tool needs a signature first, so it asks for one the first time. */
  const selectFormTool = (tool: FormTool) => {
    if (tool === "signature" && !formSignature) {
      setSignaturePadOpen(true);
      return;
    }
    setFormTool(tool);
  };

  const copyFormFields = async (kind: "text" | "table" | "json") => {
    const cell = (value: string) => value.replace(/[\t\r\n]+/g, " ");
    const text = kind === "text" ? formToText(formFields) : kind === "json" ? formToJson(formFields) : formFields.map((field) => [field.label, field.value, `${Math.round(field.confidence * 100)}%`].map(cell).join("\t")).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      showFormNotice(t(K("form.clipboard.copied")));
    } catch {
      showFormNotice(t(K("form.clipboard.failed")));
    }
  };

  /**
   * Saves the changes into the reading's history entry: the corrected fields and the marks, and (the first time) the
   * pages, so opening it from history brings the edited document back. Downloading is what "export" is for.
   */
  const saveFormChanges = async () => {
    if (isSavingMarks || !formHistoryId) return;
    setIsSavingMarks(true);
    try {
      const handle = formPreviewRef.current;
      const pages = handle && !formDocumentSaved ? await handle.sourcePages() : null;
      const saved = await saveFormEdits(formHistoryId, { fields: formFields, rotation: formRotation, marks: handle?.getMarks() ?? formInitialMarks, ...(pages ? { pages } : {}) });
      if (saved.hasDocument) setFormDocumentSaved(true);
      setFormHistoryKey((key) => key + 1);
      showFormNotice(t(K("form.save.done")));
    } catch {
      showFormNotice(t(K("form.save.failed")));
    } finally {
      setIsSavingMarks(false);
    }
  };

  /** The text of the page as the OCR read it, in reading order: what "reflow" shows instead of the picture. */
  const reflowText = (page: number): string => {
    const lines = (formResult?.blocks ?? []).filter((block) => block.page === page).sort((a, b) => a.top - b.top || a.left - b.left);
    return lines.map((block) => block.text).join("\n");
  };

  const changeContractType = (id: ContractTypeId) => {
    setContractType(id);
    // The sides depend on the kind of contract, so a side picked for another kind no longer applies.
    setContractParty("");
  };

  /** Shows a review saved in history; its contract is not kept, so only the review itself can be shown. */
  const openContractFromHistory = (result: ContractReviewResult, item: ContractHistoryItem) => {
    setContractResult(result);
    setContractResultName(item.fileName);
    setContractFromHistory(true);
    setOcrCompare(false);
    setContractError("");
    setContractTab("review");
  };

  const runContract = async () => {
    if (!selectedFile || isContractRunning) return;
    setIsContractRunning(true);
    setContractError("");
    setContractResult(null);
    setContractTab("review");
    try {
      const result = await reviewContract({ file: selectedFile, contractType, language: contractLanguage, ...(contractParty ? { party: contractParty } : {}) });
      setContractResult(result);
      setContractResultName(selectedFile.name);
      setContractFromHistory(false);
      setContractCredits(result.creditsUsed);
      setContractHistoryKey((key) => key + 1);
    } catch (error) {
      setContractTab("preview");
      setContractError(error instanceof Error ? error.message : t(K("contract.errorGeneral")));
    } finally {
      setIsContractRunning(false);
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
        className={styles.docShell}
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
                  onClick={() => available && selectMode(id)}
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
            <small>{isOcr ? t(K("ocr.dropTypes"), { types: ocrExtensions.join(", ").toUpperCase(), max: ocrMaxMegabytes }) : isForm ? t(K("ocr.dropTypes"), { types: "PDF, JPG, JPEG, PNG", max: 25 }) : t(K("source.dropTypes"), { max: 25 })}</small>
          </div>
          <input ref={uploadInputRef} className={styles.fileInput} type="file" accept={isOcr ? ocrExtensions.map((extension) => `.${extension}`).join(",") : isForm ? ".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" : ".pdf,.docx,.png,.jpg,.jpeg,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/png,image/jpeg"} onChange={(event) => setFileFromList(event.currentTarget.files)} />
          <div className={styles.filePlaceholder}>
            <span className={styles.fileIcon}><FileText size={17} aria-hidden="true" /></span>
            <span className={styles.fileCopy}><strong>{selectedFile?.name ?? t(K("source.filesTitle"))}</strong><small>{selectedFile ? formatFileSize(selectedFile.size) : t(K("source.filesHint"))}</small></span>
            <button type="button" className={styles.replaceFileButton} aria-label={t(K("source.chooseFile"))} onClick={() => uploadInputRef.current?.click()}><Plus size={16} aria-hidden="true" /></button>
          </div>
          {!isOcr && !isContract && !isForm && <SelectPlaceholder label={t(K("source.pages"))} value={t(K("source.allPages"))} />}
          <div className={styles.sectionRule} />
          <PanelHeading step="2">{isOcr ? t(K("ocr.typeHeading")) : isContract ? t(K("contract.typeHeading")) : isForm ? t(K("form.howHeading")) : isSummarize ? t(K("summary.goal")) : t(K("instructions.heading"))}</PanelHeading>
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
          ) : isContract ? (
            <>
              <div className={styles.ocrTypeGrid} role="radiogroup" aria-label={t(K("contract.typeHeading"))}>
                {CONTRACT_TYPE_OPTIONS.map(({ id, icon: TypeIcon }) => (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={contractType === id}
                    className={`${styles.ocrTypeButton} ${contractType === id ? styles.ocrTypeActive : ""}`}
                    onClick={() => changeContractType(id)}
                  >
                    <TypeIcon size={15} aria-hidden="true" />
                    <span>{t(K(`contract.type.${id}`))}</span>
                  </button>
                ))}
              </div>
              {CONTRACT_PARTIES[contractType].length > 0 && (
                <div className={styles.contractParty}>
                  <strong>{t(K("contract.partyHeading"))}</strong>
                  <small>{t(K("contract.partyHint"))}</small>
                  <div className={styles.contractPartyChoices}>
                    <button type="button" aria-pressed={contractParty === ""} onClick={() => setContractParty("")}>{t(K("contract.partyAny"))}</button>
                    {CONTRACT_PARTIES[contractType].map((party) => {
                      const label = t(K(`contract.party.${party}`));
                      return <button key={party} type="button" aria-pressed={contractParty === label} onClick={() => setContractParty(label)}>{label}</button>;
                    })}
                  </div>
                </div>
              )}
            </>
          ) : isForm ? (
            <>
              <div className={styles.formWays} role="radiogroup" aria-label={t(K("form.howHeading"))}>
                <button type="button" role="radio" aria-checked={formHow === "auto"} className={`${styles.ocrTypeButton} ${formHow === "auto" ? styles.ocrTypeActive : ""}`} onClick={() => setFormHow("auto")}>
                  <Sparkles size={15} aria-hidden="true" />
                  <span><strong>{t(K("form.how.auto"))}</strong><small>{t(K("form.how.autoHint"))}</small></span>
                </button>
                <button type="button" role="radio" aria-checked={formHow === "custom"} className={`${styles.ocrTypeButton} ${formHow === "custom" ? styles.ocrTypeActive : ""}`} onClick={() => setFormHow("custom")}>
                  <ListChecks size={15} aria-hidden="true" />
                  <span><strong>{t(K("form.how.custom"))}</strong><small>{t(K("form.how.customHint"))}</small></span>
                </button>
              </div>
              {formHow === "custom" && (
                <div className={styles.summaryPrompt}>
                  <textarea aria-label={t(K("form.fieldsLabel"))} maxLength={600} value={formFieldNames} onChange={(event) => setFormFieldNames(event.target.value)} placeholder={t(K("form.fieldsPlaceholder"))} />
                  <small>{formFieldNames.length} / 600</small>
                </div>
              )}
            </>
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
          {!isOcr && !isContract && !isForm && <div className={styles.checkList}>
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
            <div><span>{t(K("preview.heading"))}</span><small>{isSummarize ? t(K("summary.workspace")) : isOcr ? t(K("ocr.workspace")) : isContract ? t(K("contract.workspace")) : isForm ? t(K("form.workspace")) : t(K("preview.canvas"))}</small></div>
            {isOcr || isContract || isForm ? (
              <div className={styles.previewToolbar} aria-label={t(K("preview.controls"))}>
                {showPreviewTools && (
                  <>
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
                <button type="button" className={`${styles.toolbarButton} ${ocrPan ? styles.toolbarButtonActive : ""}`} aria-label={t(K("ocr.tool.pan"))} aria-pressed={ocrPan} title={hasPreview ? t(K("ocr.tool.pan")) : t(K("ocr.tool.needFile"))} disabled={!hasPreview} onClick={() => { setOcrPan((value) => !value); setOcrAnnotate(false); setFormDraw(false); }}>
                  <Hand size={14} aria-hidden="true" />
                </button>
                <span className={styles.toolbarDivider} />
                {!isForm && (
                  <button type="button" className={`${styles.toolbarButton} ${ocrCompare ? styles.toolbarButtonActive : ""}`} aria-label={t(K("preview.compare"))} aria-pressed={ocrCompare} title={!hasPreview ? t(K("ocr.tool.needFile")) : !compareReady ? t(K("ocr.tool.needResult")) : t(K("ocr.tool.compareHint"))} disabled={!hasPreview || !compareReady} onClick={() => setOcrCompare((value) => !value)}>
                    <Columns2 size={13} aria-hidden="true" /><span className={styles.toolbarLabel}>{t(K("preview.compare"))}</span>
                  </button>
                )}
                <button type="button" className={`${styles.toolbarButton} ${ocrAnnotate ? styles.toolbarButtonActive : ""}`} aria-label={t(K("preview.annotate"))} aria-pressed={ocrAnnotate} title={hasPreview ? t(K("ocr.tool.annotateHint")) : t(K("ocr.tool.needFile"))} disabled={!hasPreview} onClick={() => { setOcrAnnotate((value) => !value); setOcrPan(false); setFormDraw(false); }}>
                  <MessageSquarePlus size={13} aria-hidden="true" /><span className={styles.toolbarLabel}>{t(K("preview.annotate"))}</span>
                </button>
                  </>
                )}
                {isForm ? (
                  <ExportMenu
                    formats={FORM_EXPORT_FORMATS}
                    hasResult={formFields.length > 0}
                    busy={isFormExporting}
                    isUnavailable={() => formFields.length === 0}
                    hint={t(K("form.exportNeedResult"))}
                    onPick={(format) => void exportForm(format)}
                  />
                ) : (
                  <ExportMenu
                    hasResult={isContract ? !!contractResult : !!ocrResult}
                    busy={isContract ? isContractExporting : isToolbarExporting}
                    {...(isOcr ? { active: ocrFormat } : {})}
                    // Before a document is read, an OCR card sets the format the next run will produce instead.
                    isUnavailable={(format) => (isContract ? !contractResult : !ocrResult && !!ocrTypeInfo && !ocrTypeInfo.outputFormats.includes(format))}
                    hint={isContract ? t(K("contract.exportNeedResult")) : t(K("ocr.exportNeedResult"))}
                    onPick={(format) => (isContract ? void exportContract(format) : ocrResult ? void exportFromToolbar(format) : setOcrFormat(format))}
                  />
                )}
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

          {isOcr && (
            <div className={styles.previewTabs} role="tablist" aria-label={t(K("ocr.tab.label"))}>
              <button type="button" role="tab" aria-selected={ocrTab === "preview"} className={ocrTab === "preview" ? styles.previewTabActive : undefined} onClick={() => setOcrTab("preview")}>{t(K("ocr.tab.preview"))}</button>
              <button type="button" role="tab" aria-selected={ocrTab === "result"} className={ocrTab === "result" ? styles.previewTabActive : undefined} disabled={!ocrResult} title={ocrResult ? undefined : t(K("ocr.tool.needResult"))} onClick={() => setOcrTab("result")}>{t(K("ocr.tab.result"))}</button>
              <button type="button" role="tab" aria-selected={ocrTab === "text"} className={ocrTab === "text" ? styles.previewTabActive : undefined} disabled={!ocrResult} title={ocrResult ? undefined : t(K("ocr.tool.needResult"))} onClick={() => setOcrTab("text")}>{t(K("ocr.tab.text"))}</button>
              <button type="button" role="tab" aria-selected={ocrTab === "history"} className={ocrTab === "history" ? styles.previewTabActive : undefined} onClick={() => setOcrTab("history")}>{t(K("ocr.tab.history"))}</button>
            </div>
          )}

          {isContract && (
            <>
              <div className={styles.previewTabs} role="tablist" aria-label={t(K("contract.tab.label"))}>
                <button type="button" role="tab" aria-selected={contractTab === "preview"} className={contractTab === "preview" ? styles.previewTabActive : undefined} onClick={() => setContractTab("preview")}>{t(K("contract.tab.preview"))}</button>
                <button type="button" role="tab" aria-selected={contractTab === "review"} className={contractTab === "review" ? styles.previewTabActive : undefined} onClick={() => setContractTab("review")}>{t(K("contract.tab.review"))}</button>
                <button type="button" role="tab" aria-selected={contractTab === "history"} className={contractTab === "history" ? styles.previewTabActive : undefined} onClick={() => setContractTab("history")}>{t(K("contract.tab.history"))}</button>
              </div>
              {contractTab === "preview" && (
                <div className={`${styles.previewStage} ${selectedFile && canPreviewFile(selectedFile) ? styles.previewStageDocument : styles.previewStageSingle}`}>
                  {selectedFile && canPreviewFile(selectedFile) ? (
                    <DocumentPreview key={`${selectedFile.name}-${selectedFile.size}-${selectedFile.lastModified}`} file={selectedFile} running={isContractRunning} zoom={ocrZoom} pan={ocrPan} annotate={ocrAnnotate} compareText={compareText} />
                  ) : (
                    <div className={styles.canvas}>
                      <div className={styles.canvasEmptyState}>
                        <span><FileText size={22} aria-hidden="true" /></span>
                        <strong>{selectedFile ? selectedFile.name : t(K("contract.emptyTitle"))}</strong>
                        <small>{selectedFile ? formatFileSize(selectedFile.size) : t(K("contract.emptyHint"))}</small>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {contractTab === "review" && (
                <div className={styles.ocrResultsPanel}>
                  {isContractRunning ? (
                    <div className={styles.contractLoading}>
                      <div className={styles.summaryLoading} role="status"><Sparkles size={18} aria-hidden="true" /><strong>{t(K("contract.loading"))}</strong><span>{t(K("contract.loadingHint"))}</span></div>
                    </div>
                  ) : contractResult ? (
                    <>
                      {contractFromHistory && <div className={styles.ocrNotice} role="status">{t(K("contract.history.notice"))}</div>}
                      <ContractReviewView review={contractResult.review} fileName={contractResultName} creditsUsed={contractResult.creditsUsed} />
                    </>
                  ) : (
                    <p className={styles.ocrMissing}>{t(K("contract.reviewEmpty"))}</p>
                  )}
                </div>
              )}
              {contractTab === "history" && (
                <div className={styles.ocrResultsPanel}>
                  <ContractHistoryPanel refreshKey={contractHistoryKey} onOpen={openContractFromHistory} />
                </div>
              )}
            </>
          )}

          {isForm && signaturePadOpen && (
            <SignaturePad
              onCancel={() => setSignaturePadOpen(false)}
              onDone={(signature) => {
                setFormSignature(signature);
                setSignaturePadOpen(false);
                setFormTool("signature");
              }}
            />
          )}
          {isForm && (
            <>
              <div className={styles.previewTabs} role="tablist" aria-label={t(K("form.tab.label"))}>
                <button type="button" role="tab" aria-selected={formTab === "preview"} className={formTab === "preview" ? styles.previewTabActive : undefined} onClick={() => setFormTab("preview")}>{t(K("form.tab.preview"))}</button>
                <button type="button" role="tab" aria-selected={formTab === "results"} className={formTab === "results" ? styles.previewTabActive : undefined} disabled={formFields.length === 0} title={formFields.length ? undefined : t(K("ocr.tool.needResult"))} onClick={() => setFormTab("results")}>{t(K("form.tab.results"))}</button>
                <button type="button" role="tab" aria-selected={formTab === "history"} className={formTab === "history" ? styles.previewTabActive : undefined} onClick={() => setFormTab("history")}>{t(K("form.tab.history"))}</button>
              </div>
              {/* Kept mounted when another tab is open, so the marks made on the form are still there and can be exported. */}
              <div style={{ display: formTab === "preview" ? "contents" : "none" }}>
                <>
                  <FormToolbar
                    tool={formTool}
                    onTool={selectFormTool}
                    zoom={ocrZoom}
                    onZoom={setOcrZoom}
                    fit={formFit.mode}
                    onFit={(mode) => setFormFit({ mode, nonce: Date.now() })}
                    reflow={formReflow}
                    onReflow={() => setFormReflow((value) => !value)}
                    reflowDisabled={!hasPreview || !formResult?.blocks?.length || formFromHistory}
                    showValues={formShowValues}
                    onShowValues={() => setFormShowValues((value) => !value)}
                    onRotate={(direction) => setFormRotation((value) => ((value + (direction === 1 ? 90 : 270)) % 360) as PreviewRotation)}
                    hasPreview={hasPreview}
                    hasFields={formFields.length > 0}
                    canDraw={!!formResult && !formFromHistory}
                    canSave={!!formHistoryId}
                    saving={isSavingMarks}
                    onSave={() => void saveFormChanges()}
                    onCopy={(kind) => void copyFormFields(kind)}
                    hasSignature={!!formSignature}
                    onNewSignature={() => setSignaturePadOpen(true)}
                    textStyle={textStyle}
                    onTextStyle={changeTextStyle}
                    highlightColor={highlightColor}
                    onHighlightColor={changeHighlightColor}
                  />
                  {formNotice && <div className={styles.formNotice} role="status">{formNotice}</div>}
                  <div className={`${styles.previewStage} ${selectedFile && canPreviewFile(selectedFile) ? styles.previewStageDocument : styles.previewStageSingle}`}>
                    {selectedFile && canPreviewFile(selectedFile) ? (
                      <DocumentPreview
                        key={`${selectedFile.name}-${selectedFile.size}-${selectedFile.lastModified}`}
                        file={selectedFile}
                        running={isFormRunning}
                        zoom={ocrZoom}
                        pan={formTool === "hand"}
                        annotate={formTool === "notes"}
                        compareText={formReflow && formResult?.blocks?.length && !formFromHistory ? reflowText : null}
                        textOnly={formReflow}
                        overlay={formOverlay}
                        onOverlaySelect={setFormSelectedId}
                        draw={formDraw}
                        onDrawn={handleFormDrawn}
                        rotation={formRotation}
                        {...(formGoToPage ? { goToPage: formGoToPage } : {})}
                        markTool={(["text", "highlight", "check", "cross", "date", "signature", "snapshot"] as const).includes(formTool as MarkTool) ? (formTool as MarkTool) : null}
                        markStyle={textStyle}
                        highlightColor={highlightColor}
                        signature={formSignature}
                        handleRef={formPreviewRef}
                        initialMarks={formInitialMarks}
                        onNotice={showFormNotice}
                        {...(formFit.nonce ? { fit: formFit } : {})}
                        onFitZoom={setOcrZoom}
                      />
                    ) : (
                      <div className={styles.canvas}>
                        <div className={styles.canvasEmptyState}>
                          <span><FileText size={22} aria-hidden="true" /></span>
                          <strong>{selectedFile ? selectedFile.name : t(K("form.emptyTitle"))}</strong>
                          <small>{selectedFile ? formatFileSize(selectedFile.size) : t(K("form.emptyHint"))}</small>
                        </div>
                      </div>
                    )}
                  </div>
                  {selectedFile && !formResult && !isFormRunning && <div className={styles.ocrNotice} role="status" style={{ marginTop: 10 }}>{t(K("form.beforeRead"))}</div>}
                  {formRegion && (
                    <div className={styles.formStrip}>
                      <h5>{t(K("form.region.title"))}</h5>
                      <div className={styles.formStripRow}>
                        <label>{t(K("form.region.label"))}<input value={formRegionLabel} maxLength={120} onChange={(event) => setFormRegionLabel(event.target.value)} /></label>
                        <label>{t(K("form.region.value"))}<input value={formRegionValue} maxLength={1000} onChange={(event) => setFormRegionValue(event.target.value)} /></label>
                      </div>
                      {!formRegionValue && <p className={styles.formStripNote}>{t(K("form.region.noText"))}</p>}
                      <div className={styles.formStripRow}>
                        <button type="button" className={styles.formStripPrimary} disabled={!formRegionLabel.trim()} onClick={addRegionField}>{t(K("form.region.add"))}</button>
                        <button type="button" onClick={() => setFormRegion(null)}>{t(K("form.region.cancel"))}</button>
                      </div>
                    </div>
                  )}
                </>
              </div>
              {formTab === "results" && (
                <div className={styles.ocrResultsPanel}>
                  {formFromHistory && <div className={styles.ocrNotice} role="status">{t(K("form.history.notice"))}</div>}
                  <FormResultsView
                    fields={formFields}
                    selectedId={formSelectedId}
                    onSelect={setFormSelectedId}
                    onChange={changeFormValue}
                    title={formResult ? selectedFile?.name ?? undefined : undefined}
                    {...(hasPreview && !formFromHistory ? { onLocate: locateFormField } : {})}
                  />
                </div>
              )}
              {formTab === "history" && (
                <div className={styles.ocrResultsPanel}>
                  <FormHistoryPanel refreshKey={formHistoryKey} onOpen={openFormFromHistory} />
                </div>
              )}
            </>
          )}

          {!isContract && !isForm && (!isOcr || ocrTab === "preview") && (
            <>
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
                      onClick={() => setOcrTab("result")}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setOcrTab("result");
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
            </>
          )}
          {isOcr && ocrFromHistory && ocrResult && (ocrTab === "result" || ocrTab === "text") && <div className={styles.ocrNotice} role="status">{t(K("ocr.history.notice"))}</div>}
          {isOcr && ocrTab === "history" && (
            <div className={styles.ocrResultsPanel}>
              <OcrHistoryPanel refreshKey={historyKey} onOpen={openFromHistory} />
            </div>
          )}
          {isOcr && ocrTab === "text" && ocrResult && (
            <div className={styles.ocrResultsPanel}>
              <OcrFullTextView result={ocrResult} />
            </div>
          )}
          {isOcr && ocrTab === "result" && ocrResult && (
            <div className={styles.ocrResultsPanel}>
              <div className={styles.ocrStats}>
                <article><small>{t(K("ocr.statPages"))}</small><strong>{ocrResult.pages}</strong></article>
                <article><small>{t(K("ocr.statDocuments"))}</small><strong>{ocrResult.text.length ? ocrResult.text.length : ocrResult.documents.length}</strong></article>
                <article><small>{t(K("ocr.statCredits"))}</small><strong>{ocrResult.creditsUsed + (ocrResult.styleCreditsUsed ?? 0)}</strong></article>
                <article><small>{t(K("ocr.statTime"))}</small><strong>{ocrResult.processMs !== undefined ? `${(ocrResult.processMs / 1000).toFixed(1)}s` : "—"}</strong></article>
              </div>
              <OcrResultView result={ocrResult} fileName={ocrResultName} showConfidence={ocrConfidence} exportFormat={ocrFormat} showStyled={ocrShowStyled} onShowStyledChange={setOcrShowStyled} />
            </div>
          )}
          </main>
        }
        right={
          <aside className={styles.settingsPanel} aria-label={t(K("a11y.settings"))}>
          <PanelHeading step="3">{t(K("settings.heading"))}</PanelHeading>
          <div className={styles.settingGroup}>
            <div className={styles.settingLabel}>{t(K("settings.model"))} <span>ⓘ</span></div>
            {isSummarize || isOcr || isContract || isForm ? <div className={`${styles.modelCards} ${styles.singleModel}`}><div className={`${styles.modelCard} ${styles.modelCardActive}`}><i /><strong>{isOcr ? t(K("ocr.modelName")) : isContract ? t(K("contract.modelName")) : isForm ? t(K("form.modelName")) : t(K("summary.modelName"))}</strong><small>{isOcr ? t(K("ocr.modelHint")) : isContract ? t(K("contract.modelHint")) : isForm ? t(K("form.modelHint")) : t(K("summary.modelHint"))}</small></div></div> : <div className={styles.modelCards}>
              <div className={`${styles.modelCard} ${styles.modelCardActive}`}><i /><strong>{t(K("settings.standard"))}</strong><small>{t(K("settings.standardHint"))}</small></div>
              <div className={styles.modelCard}><i /><strong>{t(K("settings.premium"))}</strong><small>{t(K("settings.premiumHint"))}</small></div>
            </div>}
          </div>
          {/* Gen Document picks its file format from the Export button instead of here. */}
          {!isOcr && !isContract && !isForm && (
            <div className={styles.settingGroup}>
              <div className={styles.settingLabel}>{t(K("settings.outputFormat"))}</div>
              <div className={styles.formatCards}>
                {["DOCX", "PDF", "TXT", "JSON"].map((format, index) => (
                  <div key={format} className={`${styles.formatCard} ${index === 0 ? styles.formatCardActive : ""}`}>
                    <FileText size={18} aria-hidden="true" /><span>{format}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
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
          ) : isForm ? (
            <div className={styles.summaryFocusNote}>{t(K("form.pagesNote"), { max: formOptions.maxPages })}</div>
          ) : isContract ? (
            <SelectControl label={t(K("settings.language"))} value={contractLanguage} onChange={(value) => setContractLanguage(value as "auto" | "English" | "Thai")} options={[{ value: "auto", label: t(K("summary.languageAuto")) }, { value: "English", label: t(K("summary.languageEnglish")) }, { value: "Thai", label: t(K("summary.languageThai")) }]} />
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
          <div className={styles.estimate}><span>{t(K("settings.estimate"))}</span><strong>{isForm ? t(K("form.credits"), { value: formOptions.credits }) : isContract ? t(K("contract.credits"), { value: contractCredits }) : isSummarize ? t(K(summaryOptions.credits === 1 ? "summary.creditsSingular" : "summary.creditsPlural"), { value: summaryOptions.credits }) : isOcr ? t(K("ocr.creditsPerPage"), { value: ocrCreditsPerPage ?? "—" }) : t(K("settings.credits"))}</strong></div>
          {isOcr && showStyleCredits && <div className={styles.summaryFocusNote}>{t(K("ocr.styleCreditsNote"), { value: ocrTypeInfo?.styleCredits ?? 0 })}</div>}
          <button className={styles.generateButton} type="button" disabled={(!isSummarize && !isOcr && !isContract && !isForm) || !selectedFile || isSummarizing || isOcrRunning || isContractRunning || isFormRunning} title={!selectedFile ? (isForm ? t(K("form.needFile")) : isContract ? t(K("contract.needFile")) : undefined) : undefined} onClick={() => void (isOcr ? runOcr() : isContract ? runContract() : isForm ? runForm() : generateSummary())}>
            <span>{isOcrRunning ? t(K("ocr.running")) : isFormRunning ? t(K("form.running")) : isContractRunning ? t(K("contract.running")) : isSummarizing ? t(K("summary.generating")) : isOcr ? t(K("ocr.run")) : isContract ? t(K("contract.run")) : isForm ? t(K("form.run")) : isSummarize ? t(K("summary.generate")) : t(K("settings.generate"))}</span>
            <Sparkles size={17} aria-hidden="true" />
          </button>
          {(isOcr ? ocrError : isContract ? contractError : isForm ? formError : summaryError) && <div className={styles.summaryError} role="alert">{isOcr ? ocrError : isContract ? contractError : isForm ? formError : summaryError}</div>}
          <div className={styles.secureNote}><span />{isForm ? t(K("form.secure")) : isContract ? t(K("contract.secure")) : isSummarize ? t(K("summary.processingNote")) : t(K("settings.secure"))}</div>
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
