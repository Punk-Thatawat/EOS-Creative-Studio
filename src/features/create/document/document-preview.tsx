"use client";

import { FileText, X } from "lucide-react";
import { useEffect, useImperativeHandle, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type Ref } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { TranslationKey } from "@/lib/i18n/dictionary";
import { useLocale } from "@/lib/i18n/locale-provider";
import { DEFAULT_HIGHLIGHT, DEFAULT_MARK_STYLE, drawMarks, MarksLayer, valueWidthInEm, MAX_SYMBOL_WIDTH, MIN_SYMBOL_WIDTH, MIN_TEXT_WIDTH, newMark, turnMark, type MarkStyle, type MarkTool, type PageMark, type PreviewHandle } from "./preview-marks";
import { fontById } from "./text-fonts";
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

/** A box laid over the page (the form reader's fields), as fractions of the page as the OCR provider saw it. */
export type PreviewOverlayBox = { id: string; page: number; left: number; top: number; right: number; bottom: number; label: number | string; state: "normal" | "low" | "selected" | "region"; /** The value to write inside the box, covering what was printed there. An empty one just covers it. */ value?: string };
export type PreviewRotation = 0 | 90 | 180 | 270;

/** Where a box on the upright page lands when the page is turned clockwise. */
export function rotateBox(box: { left: number; top: number; right: number; bottom: number }, rotation: PreviewRotation) {
  const { left, top, right, bottom } = box;
  if (rotation === 90) return { left: 1 - bottom, top: left, right: 1 - top, bottom: right };
  if (rotation === 180) return { left: 1 - right, top: 1 - bottom, right: 1 - left, bottom: 1 - top };
  if (rotation === 270) return { left: top, top: 1 - right, right: bottom, bottom: 1 - left };
  return { left, top, right, bottom };
}

/** The reverse of `rotateBox`: a box drawn on the turned page, back on the upright page. */
export function unrotateBox(box: { left: number; top: number; right: number; bottom: number }, rotation: PreviewRotation) {
  return rotateBox(box, ((360 - rotation) % 360) as PreviewRotation);
}

/** The page picture turned clockwise, drawn on a canvas. */
/** A page picture as a JPEG file, the form it is saved in. */
function jpegBlob(url: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext("2d");
      if (!context) return reject(new Error("canvas unavailable"));
      // JPEG has no transparency: a page picture that has some is drawn on white.
      context.fillStyle = "#fff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0);
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("no picture"))), "image/jpeg", 0.85);
    };
    image.onerror = () => reject(new Error("image failed to load"));
    image.src = url;
  });
}

function rotateImage(url: string, rotation: PreviewRotation): Promise<string> {
  if (rotation === 0) return Promise.resolve(url);
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const sideways = rotation === 90 || rotation === 270;
      const canvas = document.createElement("canvas");
      canvas.width = sideways ? image.height : image.width;
      canvas.height = sideways ? image.width : image.height;
      const context = canvas.getContext("2d");
      if (!context) return resolve(url);
      context.translate(canvas.width / 2, canvas.height / 2);
      context.rotate((rotation * Math.PI) / 180);
      context.drawImage(image, -image.width / 2, -image.height / 2);
      resolve(canvas.toDataURL("image/jpeg", 0.9));
    };
    image.onerror = () => resolve(url);
    image.src = url;
  });
}

/**
 * The page rail and canvas for an uploaded document. Mount it with a `key` per file so its state (selected page,
 * notes) resets when the file changes. PDFs are rendered in the browser with pdf.js; images are shown as they are.
 */
export function DocumentPreview({ file, running, zoom, pan, annotate, compareText, overlay, onOverlaySelect, draw, onDrawn, rotation = 0, goToPage, markTool = null, markStyle = DEFAULT_MARK_STYLE, highlightColor = DEFAULT_HIGHLIGHT, signature = null, handleRef, initialMarks, onMarksChange, onNotice, fit, onFitZoom, textOnly = false }: {
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
  /** Boxes to show on the pages, e.g. the fields found on a form. */
  overlay?: PreviewOverlayBox[];
  onOverlaySelect?: (id: string) => void;
  /** Drag on the page to pick a region; `onDrawn` gets it on the upright page (whatever the rotation). */
  draw?: boolean;
  onDrawn?: (page: number, box: { left: number; top: number; right: number; bottom: number }) => void;
  /** Quarter turns clockwise. */
  rotation?: PreviewRotation;
  /** Show this page (e.g. the page a selected field is on). A new `nonce` shows it again after the user paged away. */
  goToPage?: { page: number; nonce: number };
  /** A markup tool: drag for a highlight or a snapshot, click to put text, a tick, a date or a signature on the page. */
  markTool?: MarkTool | null;
  /** How text the person types looks: the font, size and colour picked in the toolbar. */
  markStyle?: MarkStyle;
  /** The colour a new highlight gets. */
  highlightColor?: string;
  /** The signature a click places while the signature tool is on. */
  signature?: { url: string; ratio: number } | null;
  /** Lets the parent save the page with its marks. */
  handleRef?: Ref<PreviewHandle>;
  /** Marks saved earlier, put back on the pages when the preview opens. */
  initialMarks?: PageMark[];
  onMarksChange?: (count: number) => void;
  /** A short message about something that just happened (a snapshot copied). */
  onNotice?: (message: string) => void;
  /** Fit the page to the width, to the height, or show it at its real size; a new `nonce` asks again. */
  fit?: { mode: "width" | "page" | "actual"; nonce: number };
  onFitZoom?: (zoom: number) => void;
  /** With `compareText`: show only the text of the page, reflowed, instead of the page picture. */
  textOnly?: boolean;
}) {
  const { t, locale } = useLocale();
  const isPdf = extensionOf(file) === "pdf";
  const [loaded, setLoaded] = useState<Loaded>({ pages: isPdf ? 0 : 1, thumbs: [], failed: false });
  const [selected, setSelected] = useState(1);
  const [pageImages, setPageImages] = useState<Record<number, string>>({});
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [draft, setDraft] = useState<Box | null>(null);
  const pdfRef = useRef<PDFDocumentProxy | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const nextAnnotationId = useRef(1);
  const [marks, setMarks] = useState<PageMark[]>(initialMarks ?? []);
  const nextMarkId = useRef((initialMarks ?? []).reduce((highest, mark) => Math.max(highest, mark.id), 0) + 1);
  const [selectedMark, setSelectedMark] = useState<number | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  // Marks stay on the same spot of the page when it is turned, so they follow the rotation as it changes.
  const [markRotation, setMarkRotation] = useState<PreviewRotation>(rotation);
  if (markRotation !== rotation) {
    const delta = (rotation - markRotation + 360) % 360;
    setMarkRotation(rotation);
    setMarks((current) => current.map((mark) => turnMark(mark, delta)));
  }
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

  const [turned, setTurned] = useState<{ url: string; rotation: PreviewRotation; source: string } | null>(null);
  const upright = pageImages[selected];
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (goToPage && goToPage.page >= 1 && goToPage.page <= loaded.pages) setSelected(goToPage.page);
  }, [goToPage, loaded.pages]);
  // The page picture turned to the chosen rotation (drawn once per page and turn).
  useEffect(() => {
    if (!upright || rotation === 0) return;
    let cancelled = false;
    void rotateImage(upright, rotation).then((url) => {
      if (!cancelled) setTurned({ url, rotation, source: upright });
    });
    return () => { cancelled = true; };
  }, [upright, rotation]);
  const pageUrl = rotation === 0 ? upright : turned?.rotation === rotation && turned.source === upright ? turned.url : undefined;
  const railPages = Math.min(loaded.pages, MAX_THUMBNAILS);
  const pageAnnotations = annotations.filter((annotation) => annotation.page === selected);
  const pageMarks = marks.filter((mark) => mark.page === selected);
  /** What a drag on the page does (null when it scrolls the page or the tool places on a click). */
  const boxTool = annotate ? "annotate" : draw ? "draw" : markTool === "highlight" || markTool === "snapshot" ? markTool : null;
  /** What a click on the page puts down. */
  const clickTool = !boxTool && markTool && markTool !== "highlight" && markTool !== "snapshot" ? markTool : null;
  const handlers = boxTool ? "box" : clickTool ? "click" : "pan";

  useEffect(() => {
    onMarksChange?.(marks.length);
  }, [marks.length, onMarksChange]);

  const pointInPage = (event: ReactPointerEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    // A page with no size yet (still loading, or hidden) cannot be pointed at; dividing by it would give NaN.
    if (!rect.width || !rect.height) return null;
    return {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    };
  };

  // Drawing a note box (annotate tool)
  const startDraw = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!boxTool || event.button !== 0 || (event.target as HTMLElement).closest("[data-annotation], [data-overlay], [data-mark]")) return;
    const point = pointInPage(event);
    if (!point) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDraft({ x: point.x, y: point.y, w: 0, h: 0 });
  };
  const moveDraw = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!draft) return;
    const point = pointInPage(event);
    if (!point) return;
    setDraft({ ...draft, w: point.x - draft.x, h: point.y - draft.y });
  };
  const endDraw = () => {
    if (!draft) return;
    const box = { x: Math.min(draft.x, draft.x + draft.w), y: Math.min(draft.y, draft.y + draft.h), w: Math.abs(draft.w), h: Math.abs(draft.h) };
    setDraft(null);
    if (box.w < MIN_ANNOTATION_SIZE || box.h < MIN_ANNOTATION_SIZE) return;
    if (boxTool === "draw") {
      onDrawn?.(selected, unrotateBox({ left: box.x, top: box.y, right: box.x + box.w, bottom: box.y + box.h }, rotation));
      return;
    }
    if (boxTool === "highlight") {
      const id = nextMarkId.current++;
      setMarks((current) => [...current, { id, page: selected, kind: "highlight", color: highlightColor, ...box }]);
      // The new highlight is the selected one, so the next colour picked recolours it.
      setSelectedMark(id);
      return;
    }
    if (boxTool === "snapshot") {
      void takeSnapshot(box);
      return;
    }
    setAnnotations((current) => [...current, { id: nextAnnotationId.current++, page: selected, note: "", ...box }]);
  };

  /** Copies the part of the page inside the box as a picture; saves it as a file when the browser will not copy. */
  const takeSnapshot = async (box: Box) => {
    if (!pageUrl) return;
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const element = new Image();
        element.onload = () => resolve(element);
        element.onerror = () => reject(new Error("image failed to load"));
        element.src = pageUrl;
      });
      const width = Math.max(1, Math.round(box.w * image.width));
      const height = Math.max(1, Math.round(box.h * image.height));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d")?.drawImage(image, Math.round(box.x * image.width), Math.round(box.y * image.height), width, height, 0, 0, width, height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("no picture");
      try {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        onNotice?.(t(K("form.snapshot.copied")));
      } catch {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${file.name.replace(/\.[^.]+$/, "")}-snapshot.png`;
        link.click();
        URL.revokeObjectURL(url);
        onNotice?.(t(K("form.snapshot.saved")));
      }
    } catch {
      onNotice?.(t(K("form.snapshot.failed")));
    }
  };

  /** Drags a mark to move it, or its corner to resize it (a highlight's box, the width of a signature, tick, cross or text box). */
  const startMarkDrag = (id: number, mode: "move" | "resize", event: ReactPointerEvent<HTMLElement>) => {
    const rect = frameRef.current?.getBoundingClientRect();
    const origin = marks.find((mark) => mark.id === id);
    if (!rect || !rect.width || !rect.height || !origin || event.button !== 0) return;
    event.preventDefault();
    // Text that has no width of its own is as wide as it is now, which is where dragging its edge starts from.
    const shown = (event.currentTarget.closest("[data-mark]") as HTMLElement | null)?.getBoundingClientRect().width ?? 0;
    const startWidth = origin.w || shown / rect.width;
    const startX = event.clientX;
    const startY = event.clientY;
    const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));
    const move = (pointer: PointerEvent) => {
      const dx = (pointer.clientX - startX) / rect.width;
      const dy = (pointer.clientY - startY) / rect.height;
      setMarks((current) => current.map((mark) => {
        if (mark.id !== id) return mark;
        if (mode === "move") {
          // A highlight keeps its whole box on the page; the other marks keep their anchor on it.
          return mark.kind === "highlight"
            ? { ...mark, x: clamp(origin.x + dx, 0, 1 - mark.w), y: clamp(origin.y + dy, 0, 1 - mark.h) }
            : { ...mark, x: clamp(origin.x + dx, 0, 1), y: clamp(origin.y + dy, 0, 1) };
        }
        if (mark.kind === "highlight") return { ...mark, w: clamp(origin.w + dx, 0.01, 1 - origin.x), h: clamp(origin.h + dy, 0.01, 1 - origin.y) };
        // Text grows to the right from its left edge, and wraps at the width it is given.
        if (mark.kind === "text" || mark.kind === "date") return { ...mark, w: clamp(startWidth + dx, MIN_TEXT_WIDTH, 1 - origin.x) };
        // The rest are centred on their anchor, so they grow by twice what the corner moved.
        return mark.kind === "signature"
          ? { ...mark, w: clamp(origin.w + dx * 2, 0.05, 0.8) }
          : { ...mark, w: clamp(origin.w + dx * 2, MIN_SYMBOL_WIDTH, MAX_SYMBOL_WIDTH) };
      }));
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
  };

  // Putting a mark on the page with a click (typewriter, tick, cross, date, signature)
  const placeMark = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!clickTool || event.button !== 0 || (event.target as HTMLElement).closest("[data-mark], [data-overlay], [data-annotation]")) return;
    if (clickTool === "signature" && !signature) return;
    const point = pointInPage(event);
    if (!point) return;
    const today = new Date().toLocaleDateString(locale === "th" ? "th-TH" : "en-GB", { day: "numeric", month: "short", year: "numeric" });
    const id = nextMarkId.current++;
    setMarks((current) => [...current, newMark(id, selected, clickTool, point.x, point.y, { today, style: markStyle, ...(signature ? { image: signature.url, ratio: signature.ratio } : {}) })]);
    setSelectedMark(clickTool === "text" || clickTool === "date" ? id : null);
  };

  /** The pages as they are on screen: turned the way the person turned them, with their marks and the values shown in the boxes. */
  const exportPages = async () => {
    const pages: Array<{ url: string; width: number; height: number }> = [];
    for (let pageNumber = 1; pageNumber <= loaded.pages; pageNumber += 1) {
      let url = pageImages[pageNumber];
      if (!url && pdfRef.current) url = await renderPdfPage(pdfRef.current, pageNumber, PAGE_RENDER_WIDTH);
      if (!url) continue;
      const values = (overlay ?? []).filter((box) => box.page === pageNumber && box.value !== undefined).map((box) => ({ ...rotateBox(box, rotation), value: box.value ?? "" }));
      pages.push(await drawMarks(await rotateImage(url, rotation), marks.filter((mark) => mark.page === pageNumber), values));
    }
    return pages.length ? pages : null;
  };

  // The pages with their marks on them, in the orientation the person is looking at.
  useImperativeHandle(handleRef, () => ({
    applyHighlight: (color) => {
      if (selectedMark === null) return;
      setMarks((current) => current.map((mark) => (mark.id === selectedMark && mark.kind === "highlight" ? { ...mark, color } : mark)));
    },
    applyStyle: (patch) => {
      if (selectedMark === null) return;
      setMarks((current) => current.map((mark) => (mark.id === selectedMark && (mark.kind === "text" || mark.kind === "date") ? { ...mark, style: { ...(mark.style ?? DEFAULT_MARK_STYLE), ...patch } } : mark)));
    },
    exportPages,
    getMarks: () => marks,
    sourcePages: async () => {
      const blobs: Blob[] = [];
      for (let pageNumber = 1; pageNumber <= loaded.pages; pageNumber += 1) {
        let url = pageImages[pageNumber];
        if (!url && pdfRef.current) url = await renderPdfPage(pdfRef.current, pageNumber, PAGE_RENDER_WIDTH);
        if (!url) return null;
        blobs.push(await jpegBlob(url));
      }
      return blobs.length ? blobs : null;
    },
  }));

  // Fit the page to the window, or show it at its real size
  useEffect(() => {
    if (!fit) return;
    if (fit.mode === "width") return onFitZoom?.(100);
    const frame = frameRef.current;
    const canvas = canvasRef.current;
    if (!frame || !canvas) return;
    const rect = frame.getBoundingClientRect();
    const baseWidth = rect.width / (zoom / 100);
    const snap = (value: number) => Math.min(300, Math.max(25, Math.round(value / 25) * 25));
    if (fit.mode === "actual") {
      const natural = frame.querySelector("img")?.naturalWidth ?? 0;
      return onFitZoom?.(natural ? snap((natural / baseWidth) * 100) : 100);
    }
    onFitZoom?.(Math.min(100, snap(((canvas.clientHeight - 32) / (baseWidth * (rect.height / rect.width))) * 100)));
    // Only a new request moves the zoom; a later zoom change must not undo the user's own.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fit]);

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
      ref={frameRef}
      className={`${styles.previewPageFrame} ${handlers !== "pan" ? styles.previewPageAnnotating : ""} ${pan ? styles.previewPagePanning : ""}`}
      style={{ "--preview-zoom": zoom / 100 } as CSSProperties}
      onPointerDown={(event) => {
        // A click anywhere but on a mark puts the marks' style bars away.
        if (!(event.target as HTMLElement).closest("[data-mark]")) setSelectedMark(null);
        (handlers === "box" ? startDraw : handlers === "click" ? placeMark : startPan)(event);
      }}
      onPointerMove={handlers === "box" ? moveDraw : handlers === "click" ? undefined : movePan}
      onPointerUp={handlers === "box" ? endDraw : handlers === "click" ? undefined : endPan}
      onPointerCancel={handlers === "box" ? endDraw : handlers === "click" ? undefined : endPan}
    >
      {
        // eslint-disable-next-line @next/next/no-img-element -- a data URL drawn in the browser, nothing next/image can optimise
        <img className={styles.previewPage} src={pageUrl} alt={t(K("ocr.pageXofN"), { page: selected, total: loaded.pages })} draggable={false} />
      }
      {(overlay ?? []).filter((box) => box.page === selected).map((box) => {
        const shown = rotateBox(box, rotation);
        return (
          <div
            key={box.id}
            data-overlay
            role={onOverlaySelect && box.state !== "region" ? "button" : undefined}
            tabIndex={onOverlaySelect && box.state !== "region" ? 0 : undefined}
            className={`${styles.fieldBox} ${styles[`fieldBox_${box.state}`]} ${box.value !== undefined ? styles.fieldBoxFilled : ""}`}
            style={{ left: `${shown.left * 100}%`, top: `${shown.top * 100}%`, width: `${(shown.right - shown.left) * 100}%`, height: `${(shown.bottom - shown.top) * 100}%` }}
            onClick={() => box.state !== "region" && onOverlaySelect?.(box.id)}
            onKeyDown={(event) => {
              if ((event.key === "Enter" || event.key === " ") && box.state !== "region") {
                event.preventDefault();
                onOverlaySelect?.(box.id);
              }
            }}
          >
            <em>{box.label}</em>
            {box.value ? <span className={styles.fieldValue} style={{ "--value-em": valueWidthInEm(box.value), fontFamily: fontById("sarabun").family } as CSSProperties}>{box.value}</span> : null}
          </div>
        );
      })}
      <MarksLayer
        marks={pageMarks}
        selectedId={selectedMark}
        onSelect={setSelectedMark}
        onChange={(id, text) => setMarks((current) => current.map((mark) => (mark.id === id ? { ...mark, text } : mark)))}
        onRemove={(id) => setMarks((current) => current.filter((mark) => mark.id !== id))}
        onDragStart={startMarkDrag}
      />
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
          textOnly ? (
            <pre className={`${styles.previewCompareText} ${styles.previewReflow}`}>{compareText(selected)}</pre>
          ) : (
            <div className={styles.previewCompare}>
              {page}
              <pre className={styles.previewCompareText}>{compareText(selected)}</pre>
            </div>
          )
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
