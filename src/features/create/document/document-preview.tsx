"use client";

import { FileText, X } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { TranslationKey } from "@/lib/i18n/dictionary";
import { useLocale } from "@/lib/i18n/locale-provider";
import styles from "./document-generation-page.module.css";

const K = (key: string) => `create.document.${key}` as TranslationKey;

const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp"];
/** Thumbnails are cheap but not free; very long PDFs still get their first pages. */
const MAX_THUMBNAILS = 40;
const THUMBNAIL_WIDTH = 120;
const PAGE_RENDER_WIDTH = 1400;
/** A drawn box smaller than this (as a share of the page) is treated as a stray click, not an annotation. */
const MIN_ANNOTATION_SIZE = 0.01;

function extensionOf(file: File): string {
  return file.name.split(".").pop()?.toLowerCase() ?? "";
}

/** Files the browser can draw for us: PDFs and web image formats (not HEIC / Office files). */
export function canPreviewFile(file: File): boolean {
  const extension = extensionOf(file);
  return extension === "pdf" || IMAGE_EXTENSIONS.includes(extension);
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function renderPdfPage(pdf: PDFDocumentProxy, pageNumber: number, width: number): Promise<string> {
  const page = await pdf.getPage(pageNumber);
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: width / base.width });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  await page.render({ canvasContext: canvas.getContext("2d")!, viewport }).promise;
  return canvas.toDataURL("image/jpeg", 0.88);
}

type Loaded = { pages: number; thumbs: string[]; failed: boolean };
/** Position and size are fractions of the page (0–1), so a note stays put when the page is zoomed. */
type Annotation = { id: number; page: number; x: number; y: number; w: number; h: number; note: string };
type Box = { x: number; y: number; w: number; h: number };

/**
 * The page rail and canvas for an uploaded document. Mount it with a `key` per file so its state (selected page,
 * notes) resets when the file changes. PDFs are rendered in the browser with pdf.js; images are shown as they are.
 */
export function DocumentPreview({ file, running, zoom, pan, annotate, compareText }: {
  file: File;
  running: boolean;
  /** Percent; 100 fits the page to the canvas. */
  zoom: number;
  /** Drag the canvas to scroll it. */
  pan: boolean;
  /** Drag on the page to draw a note box. */
  annotate: boolean;
  /** When set, the page is shown next to this text (the extracted text for the selected page). */
  compareText: ((page: number) => string) | null;
}) {
  const { t } = useLocale();
  const isPdf = extensionOf(file) === "pdf";
  const [loaded, setLoaded] = useState<Loaded>({ pages: isPdf ? 0 : 1, thumbs: [], failed: false });
  const [selected, setSelected] = useState(1);
  const [pageImages, setPageImages] = useState<Record<number, string>>({});
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [draft, setDraft] = useState<Box | null>(null);
  const pdfRef = useRef<PDFDocumentProxy | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const nextAnnotationId = useRef(1);
  const dragStart = useRef<{ x: number; y: number; left: number; top: number } | null>(null);

  // Load the document and its thumbnails.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        if (!isPdf) {
          const url = await readAsDataUrl(file);
          if (cancelled) return;
          setLoaded({ pages: 1, thumbs: [url], failed: false });
          setPageImages({ 1: url });
          return;
        }
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
        const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
        if (cancelled) {
          void pdf.destroy();
          return;
        }
        pdfRef.current = pdf;
        setLoaded({ pages: pdf.numPages, thumbs: [], failed: false });
        for (let pageNumber = 1; pageNumber <= Math.min(pdf.numPages, MAX_THUMBNAILS); pageNumber += 1) {
          const thumb = await renderPdfPage(pdf, pageNumber, THUMBNAIL_WIDTH);
          if (cancelled) return;
          setLoaded((current) => ({ ...current, thumbs: [...current.thumbs, thumb] }));
        }
      } catch {
        if (!cancelled) setLoaded({ pages: 0, thumbs: [], failed: true });
      }
    })();
    return () => {
      cancelled = true;
      void pdfRef.current?.destroy();
      pdfRef.current = null;
    };
  }, [file, isPdf]);

  // Render the selected PDF page at reading size, once.
  useEffect(() => {
    const pdf = pdfRef.current;
    if (!isPdf || !pdf || loaded.pages === 0 || pageImages[selected]) return;
    let cancelled = false;
    void renderPdfPage(pdf, selected, PAGE_RENDER_WIDTH).then((url) => {
      if (!cancelled) setPageImages((current) => ({ ...current, [selected]: url }));
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [isPdf, loaded.pages, selected, pageImages]);

  const pageUrl = pageImages[selected];
  const railPages = Math.min(loaded.pages, MAX_THUMBNAILS);
  const pageAnnotations = annotations.filter((annotation) => annotation.page === selected);

  const pointInPage = (event: ReactPointerEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    };
  };

  // Drawing a note box (annotate tool)
  const startDraw = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!annotate || event.button !== 0 || (event.target as HTMLElement).closest("[data-annotation]")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointInPage(event);
    setDraft({ x: point.x, y: point.y, w: 0, h: 0 });
  };
  const moveDraw = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!draft) return;
    const point = pointInPage(event);
    setDraft({ ...draft, w: point.x - draft.x, h: point.y - draft.y });
  };
  const endDraw = () => {
    if (!draft) return;
    const box = { x: Math.min(draft.x, draft.x + draft.w), y: Math.min(draft.y, draft.y + draft.h), w: Math.abs(draft.w), h: Math.abs(draft.h) };
    setDraft(null);
    if (box.w < MIN_ANNOTATION_SIZE || box.h < MIN_ANNOTATION_SIZE) return;
    setAnnotations((current) => [...current, { id: nextAnnotationId.current++, page: selected, note: "", ...box }]);
  };

  // Dragging the canvas to scroll it (pan tool)
  const startPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    const canvas = canvasRef.current;
    if (!pan || !canvas || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStart.current = { x: event.clientX, y: event.clientY, left: canvas.scrollLeft, top: canvas.scrollTop };
  };
  const movePan = (event: ReactPointerEvent<HTMLDivElement>) => {
    const canvas = canvasRef.current;
    const start = dragStart.current;
    if (!canvas || !start) return;
    canvas.scrollLeft = start.left - (event.clientX - start.x);
    canvas.scrollTop = start.top - (event.clientY - start.y);
  };
  const endPan = () => { dragStart.current = null; };

  const page = pageUrl ? (
    <div
      className={`${styles.previewPageFrame} ${annotate ? styles.previewPageAnnotating : ""} ${pan ? styles.previewPagePanning : ""}`}
      style={{ "--preview-zoom": zoom / 100 } as CSSProperties}
      onPointerDown={annotate ? startDraw : startPan}
      onPointerMove={annotate ? moveDraw : movePan}
      onPointerUp={annotate ? endDraw : endPan}
      onPointerCancel={annotate ? endDraw : endPan}
    >
      {
        // eslint-disable-next-line @next/next/no-img-element -- a data URL drawn in the browser, nothing next/image can optimise
        <img className={styles.previewPage} src={pageUrl} alt={t(K("ocr.pageXofN"), { page: selected, total: loaded.pages })} draggable={false} />
      }
      {[...pageAnnotations.map((annotation) => ({ ...annotation, draft: false })), ...(draft ? [{ id: -1, page: selected, note: "", draft: true, x: Math.min(draft.x, draft.x + draft.w), y: Math.min(draft.y, draft.y + draft.h), w: Math.abs(draft.w), h: Math.abs(draft.h) }] : [])].map((annotation) => (
        <div
          key={annotation.id}
          data-annotation
          className={`${styles.annotation} ${annotation.draft ? styles.annotationDraft : ""}`}
          style={{ left: `${annotation.x * 100}%`, top: `${annotation.y * 100}%`, width: `${annotation.w * 100}%`, height: `${annotation.h * 100}%` }}
        >
          {!annotation.draft && (
            <div className={styles.annotationNote}>
              <input
                value={annotation.note}
                placeholder={t(K("ocr.annotationNote"))}
                aria-label={t(K("ocr.annotationNote"))}
                readOnly={!annotate}
                onChange={(event) => setAnnotations((current) => current.map((item) => (item.id === annotation.id ? { ...item, note: event.target.value } : item)))}
              />
              {annotate && (
                <button type="button" aria-label={t(K("ocr.annotationRemove"))} onClick={() => setAnnotations((current) => current.filter((item) => item.id !== annotation.id))}>
                  <X size={12} aria-hidden="true" />
                </button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  ) : (
    <div className={styles.canvasEmptyState}>
      <span><FileText size={22} aria-hidden="true" /></span>
      <strong>{file.name}</strong>
      <small>{loaded.failed ? t(K("ocr.previewFailed")) : t(K("ocr.previewLoading"))}</small>
    </div>
  );

  return (
    <>
      <div className={styles.pageRail} role="tablist" aria-label={t(K("preview.heading"))}>
        {Array.from({ length: railPages }, (_, index) => index + 1).map((pageNumber) => {
          const thumb = loaded.thumbs[pageNumber - 1];
          return (
            <button
              key={pageNumber}
              type="button"
              role="tab"
              aria-selected={selected === pageNumber}
              className={`${styles.pageThumb} ${styles.pageThumbButton} ${selected === pageNumber ? styles.pageThumbActive : ""}`}
              onClick={() => setSelected(pageNumber)}
            >
              <span>{pageNumber}</span>
              <div>{thumb ? (
                // eslint-disable-next-line @next/next/no-img-element -- a data URL drawn in the browser, nothing next/image can optimise
                <img src={thumb} alt="" />
              ) : <><i /><i /><i /></>}</div>
            </button>
          );
        })}
      </div>
      <div ref={canvasRef} className={`${styles.canvas} ${pan ? styles.canvasPanning : ""}`}>
        {compareText && pageUrl ? (
          <div className={styles.previewCompare}>
            {page}
            <pre className={styles.previewCompareText}>{compareText(selected)}</pre>
          </div>
        ) : page}
        {annotations.length > 0 && (
          <button type="button" className={styles.annotationClear} onClick={() => setAnnotations([])}>{t(K("ocr.annotationsClear"))}</button>
        )}
        {running && <div className={styles.summaryLoading} role="status"><strong>{t(K("ocr.loading"))}</strong><span>{t(K("ocr.loadingHint"))}</span></div>}
        {loaded.pages > 0 && <div className={styles.canvasPageNumber}>{t(K("ocr.pageXofN"), { page: selected, total: loaded.pages })}</div>}
      </div>
    </>
  );
}
