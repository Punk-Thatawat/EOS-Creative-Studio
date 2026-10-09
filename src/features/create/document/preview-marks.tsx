"use client";

import { GripVertical, X } from "lucide-react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { Dropdown } from "@/components/ui/dropdown";
import type { TranslationKey } from "@/lib/i18n/dictionary";
import { useLocale } from "@/lib/i18n/locale-provider";
import styles from "./document-feature-generation-page.module.css";
import { fontById, TEXT_FONTS } from "./text-fonts";

const K = (key: string) => `create.document.${key}` as TranslationKey;

/** What a click or drag on the page does while a markup tool is on. */
export type MarkTool = "text" | "highlight" | "check" | "cross" | "date" | "signature" | "snapshot";
export type MarkKind = Exclude<MarkTool, "snapshot">;

/**
 * Something the person put on the page. Marks live in the page as it is shown, so what they see is what is saved:
 * `x`, `y`, `w`, `h` are fractions (0-1) of the displayed page. A highlight is the box itself; every other mark is
 * placed by its anchor (`x`, `y`: the centre, or the left edge and first line for text) and `w`, its width. Text with
 * `w` 0 is as wide as what was typed, up to the page edge; dragging its right edge fixes a width, and it wraps there.
 */
/** How typed text looks. `size` is a fraction of the page width, so it scales with the page like everything else. */
export type MarkStyle = { font: string; size: number; bold: boolean; italic: boolean; color: string };

/** Sizes are shown as pixels on a page 760 wide (the width the preview shows at 100%). */
export const SIZE_REFERENCE_WIDTH = 760;
export const MARK_SIZES = [10, 12, 14, 16, 18, 20, 24, 28, 32, 40, 48] as const;
/** Highlighter colours; the first is the classic yellow. The fill is the colour at 40%, so the text under it still reads. */
export const HIGHLIGHT_COLORS = ["#ffd600", "#7ddc78", "#ff8fb8", "#6ec6ff", "#ffb066"] as const;
export const DEFAULT_HIGHLIGHT = HIGHLIGHT_COLORS[0];
export const highlightFill = (color: string) => `${color}66`;
export const MARK_COLORS = ["#111111", "#1a3a8a", "#c62828", "#1a7f37", "#df602d"] as const;
export const DEFAULT_MARK_STYLE: MarkStyle = { font: "sarabun", size: 16 / SIZE_REFERENCE_WIDTH, bold: false, italic: false, color: "#111111" };

export type PageMark = {
  id: number;
  page: number;
  kind: MarkKind;
  x: number;
  y: number;
  w: number;
  h: number;
  text?: string;
  /** Typed text (text and date marks) in the font the person chose. */
  style?: MarkStyle;
  /** A highlight's colour. */
  color?: string;
  /** A signature: a transparent PNG, and its height over its width. */
  image?: string;
  ratio?: number;
};

/**
 * How many font sizes wide a value is: the box's width over this is the biggest size it fits at. Measured in the same
 * font the value is drawn in, on one canvas that is kept.
 */
let measureContext: CanvasRenderingContext2D | null | undefined;
export function valueWidthInEm(value: string): number {
  if (measureContext === undefined) measureContext = document.createElement("canvas").getContext("2d");
  if (!measureContext) return Math.max(1, value.length * 0.55);
  measureContext.font = `100px ${fontById("sarabun").family}`;
  return Math.max(0.5, measureContext.measureText(value).width / 100);
}

/** A value read from the form, written in the box it was read from (fractions of the displayed page). */
export type ValueBox = { left: number; top: number; right: number; bottom: number; value: string };

export type PreviewHandle = {
  /** Every page with the marks (and the values on show) drawn on it. `null` when there is no page to draw. */
  exportPages: () => Promise<Array<{ url: string; width: number; height: number }> | null>;
  /** Recolours the highlight that is selected, if any. */
  applyHighlight: (color: string) => void;
  /** Restyles the typed text that is selected, if any. */
  applyStyle: (patch: Partial<MarkStyle>) => void;
  /** The marks on the pages, to save them. */
  getMarks: () => PageMark[];
  /** Every page as it was uploaded (no marks, not turned) as a JPEG, to save with the marks so they can be edited later. */
  sourcePages: () => Promise<Blob[] | null>;
};

/** Check marks are 3.5% of the page width: the same on screen (cqw) and in the saved file. */
export const SYMBOL_WIDTH = 0.035;
export const SIGNATURE_WIDTH = 0.24;
export const MIN_SYMBOL_WIDTH = 0.015;
export const MAX_SYMBOL_WIDTH = 0.2;
export const MIN_TEXT_WIDTH = 0.1;
/** The height of a line of typed text, as a multiple of its size; the input and the saved file use the same. */
export const TEXT_LINE_HEIGHT = 1.3;
/** The inset between a text box's edge and its text, as a fraction of the page width. */
export const TEXT_INSET = 0.004;

export function newMark(id: number, page: number, kind: MarkKind, x: number, y: number, extra: { image?: string; ratio?: number; today?: string; style?: MarkStyle } = {}): PageMark {
  if (kind === "text") return { id, page, kind, x, y, w: 0, h: 0, text: "", style: extra.style ?? DEFAULT_MARK_STYLE };
  if (kind === "date") return { id, page, kind, x, y, w: 0, h: 0, text: extra.today ?? "", style: extra.style ?? DEFAULT_MARK_STYLE };
  if (kind === "check" || kind === "cross") return { id, page, kind, x, y, w: SYMBOL_WIDTH, h: 0 };
  return { id, page, kind, x, y, w: SIGNATURE_WIDTH, h: 0, ...(extra.image ? { image: extra.image } : {}), ...(extra.ratio ? { ratio: extra.ratio } : {}) };
}

/** Where the page's marks land when the page is turned a quarter turn clockwise (`delta` 90, 180 or 270). */
export function turnMark(mark: PageMark, delta: number): PageMark {
  if (delta === 0) return mark;
  const turn = (px: number, py: number) => {
    if (delta === 90) return { x: 1 - py, y: px };
    if (delta === 180) return { x: 1 - px, y: 1 - py };
    return { x: py, y: 1 - px };
  };
  if (mark.kind === "highlight") {
    const a = turn(mark.x, mark.y);
    const b = turn(mark.x + mark.w, mark.y + mark.h);
    return { ...mark, x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) };
  }
  return { ...mark, ...turn(mark.x, mark.y) };
}

/** Font, size, bold, italic and colour of typed text. It sits in the form's tool row, always in view. */
export function TextStyleBar({ style, onChange }: { style: MarkStyle; onChange: (patch: Partial<MarkStyle>) => void }) {
  const { t } = useLocale();
  const size = String(Math.round(style.size * SIZE_REFERENCE_WIDTH));
  const sizes = MARK_SIZES.some((value) => String(value) === size) ? [...MARK_SIZES] : [...MARK_SIZES, Number(size)].sort((a, b) => a - b);
  return (
    <div className={styles.markStyleBar} role="group" aria-label={t(K("form.font.bar"))}>
      <Dropdown
        value={style.font}
        options={TEXT_FONTS.map((font) => ({ value: font.id, label: font.label }))}
        onChange={(value) => onChange({ font: value })}
        ariaLabel={t(K("form.font.label"))}
        menuPosition="fixed"
        triggerClassName="h-[28px] min-h-0 w-[132px] gap-1 rounded-md border-[#e2e3e5] px-2 text-[11px] font-medium text-[#343b42]"
        menuClassName="min-w-[170px]"
        optionClassName="px-2.5 py-1.5 text-[12px]"
      />
      <Dropdown
        value={size}
        options={sizes.map((value) => ({ value: String(value), label: String(value) }))}
        onChange={(value) => onChange({ size: Number(value) / SIZE_REFERENCE_WIDTH })}
        ariaLabel={t(K("form.font.size"))}
        menuPosition="fixed"
        triggerClassName="h-[28px] min-h-0 w-[58px] gap-1 rounded-md border-[#e2e3e5] px-2 text-[11px] font-medium text-[#343b42]"
        menuClassName="min-w-[70px]"
        optionClassName="px-2.5 py-1.5 text-[12px]"
      />
      <span className={styles.markStyleRest}>
        <button type="button" className={`${styles.markStyleButton} ${style.bold ? styles.markStyleButtonOn : ""}`} aria-pressed={style.bold} aria-label={t(K("form.font.bold"))} title={t(K("form.font.bold"))} onClick={() => onChange({ bold: !style.bold })}><b>B</b></button>
        <button type="button" className={`${styles.markStyleButton} ${style.italic ? styles.markStyleButtonOn : ""}`} aria-pressed={style.italic} aria-label={t(K("form.font.italic"))} title={t(K("form.font.italic"))} onClick={() => onChange({ italic: !style.italic })}><i>I</i></button>
        {MARK_COLORS.map((color) => (
          <button key={color} type="button" className={`${styles.markSwatch} ${style.color === color ? styles.markSwatchOn : ""}`} style={{ backgroundColor: color }} aria-pressed={style.color === color} aria-label={`${t(K("form.font.color"))} ${color}`} onClick={() => onChange({ color })} />
        ))}
      </span>
    </div>
  );
}

/** The marks of the page on show, drawn over it. They can be dragged to move, and a highlight or signature resized. */
export function MarksLayer({
  marks,
  selectedId,
  onSelect,
  onChange,
  onRemove,
  onDragStart,
}: {
  marks: PageMark[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onChange: (id: number, text: string) => void;
  onRemove: (id: number) => void;
  onDragStart: (id: number, mode: "move" | "resize", event: ReactPointerEvent<HTMLElement>) => void;
}) {
  const { t } = useLocale();
  const grab = (id: number, mode: "move" | "resize") => (event: ReactPointerEvent<HTMLElement>) => {
    event.stopPropagation();
    onSelect(id);
    onDragStart(id, mode, event);
  };
  return (
    <>
      {marks.map((mark) => {
        const picked = selectedId === mark.id ? styles.markPicked : "";
        const remove = (
          <button type="button" className={styles.markRemove} aria-label={t(K("form.mark.remove"))} title={t(K("form.mark.remove"))} onPointerDown={(event) => event.stopPropagation()} onClick={() => onRemove(mark.id)}>
            <X size={10} aria-hidden="true" />
          </button>
        );
        const handle = (className: string) => (selectedId === mark.id ? <span data-handle className={className} title={t(K("form.mark.resize"))} onPointerDown={grab(mark.id, "resize")} /> : null);
        const resize = handle(styles.markResize);
        if (mark.kind === "highlight") {
          return (
            <div key={mark.id} data-mark className={`${styles.mark} ${styles.markHighlight} ${picked}`} title={t(K("form.mark.move"))} style={{ left: `${mark.x * 100}%`, top: `${mark.y * 100}%`, width: `${mark.w * 100}%`, height: `${mark.h * 100}%`, background: highlightFill(mark.color ?? DEFAULT_HIGHLIGHT) }} onPointerDown={grab(mark.id, "move")}>
              {remove}
              {resize}
            </div>
          );
        }
        if (mark.kind === "text" || mark.kind === "date") {
          const style = mark.style ?? DEFAULT_MARK_STYLE;
          return (
            <div
              key={mark.id}
              data-mark
              className={`${styles.mark} ${styles.markText} ${picked}`}
              style={{ left: `${mark.x * 100}%`, top: `${mark.y * 100}%`, width: mark.w ? `${mark.w * 100}%` : undefined, maxWidth: `${(1 - mark.x) * 100}%`, fontSize: `${style.size * 100}cqw`, fontFamily: fontById(style.font).family, fontWeight: style.bold ? 700 : 400, fontStyle: style.italic ? "italic" : "normal", color: style.color }}
            >
              <span data-handle className={styles.markGrip} title={t(K("form.mark.move"))} onPointerDown={grab(mark.id, "move")}><GripVertical size={12} aria-hidden="true" /></span>
              {/* The input grows with its text: a hidden copy of the text sizes the box, and the input fills it. */}
              <div className={styles.markTextField} data-value={mark.text ?? ""}>
                <textarea
                  value={mark.text ?? ""}
                  rows={1}
                  aria-label={t(K(mark.kind === "date" ? "form.mark.date" : "form.mark.text"))}
                  autoFocus={mark.kind === "text" && !mark.text}
                  onFocus={() => onSelect(mark.id)}
                  onChange={(event) => onChange(mark.id, event.target.value)}
                  onPointerDown={(event) => { event.stopPropagation(); onSelect(mark.id); }}
                />
              </div>
              {remove}
              {handle(styles.markWidth)}
            </div>
          );
        }
        if (mark.kind === "signature") {
          return (
            <div key={mark.id} data-mark className={`${styles.mark} ${styles.markSign} ${picked}`} title={t(K("form.mark.move"))} style={{ left: `${mark.x * 100}%`, top: `${mark.y * 100}%`, width: `${mark.w * 100}%` }} onPointerDown={grab(mark.id, "move")}>
              {
                // eslint-disable-next-line @next/next/no-img-element -- a signature drawn in the browser, a data URL
                mark.image ? <img src={mark.image} alt={t(K("form.mark.signature"))} draggable={false} /> : null
              }
              {remove}
              {resize}
            </div>
          );
        }
        return (
          <div key={mark.id} data-mark className={`${styles.mark} ${styles.markSymbol} ${picked}`} title={t(K("form.mark.move"))} style={{ left: `${mark.x * 100}%`, top: `${mark.y * 100}%`, width: `${mark.w * 100}%`, fontSize: `${mark.w * 90}cqw` }} aria-label={t(K(mark.kind === "check" ? "form.mark.check" : "form.mark.cross"))} onPointerDown={grab(mark.id, "move")}>
            {mark.kind === "check" ? "✓" : "✗"}
            {remove}
            {resize}
          </div>
        );
      })}
    </>
  );
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("image failed to load"));
    image.src = url;
  });
}

/** Breaks text into lines no wider than `room` pixels in the canvas' current font: at new lines, between words, and inside a word only when it alone is too long. */
function wrapText(context: CanvasRenderingContext2D, text: string, room: number): string[] {
  const segmenter = typeof Intl.Segmenter === "function" ? new Intl.Segmenter(undefined, { granularity: "word" }) : null;
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    const pieces = segmenter ? Array.from(segmenter.segment(paragraph), (part) => part.segment) : paragraph.split(/(?<=\s)/);
    let line = "";
    for (const piece of pieces) {
      if (!line || context.measureText(line + piece.replace(/\s+$/, "")).width <= room) {
        line += piece;
      } else {
        lines.push(line.replace(/\s+$/, ""));
        line = piece.replace(/^\s+/, "");
      }
      // A piece that is wider than the box by itself is cut by letters.
      while (context.measureText(line).width > room && line.length > 1) {
        let cut = line.length - 1;
        while (cut > 1 && context.measureText(line.slice(0, cut)).width > room) cut -= 1;
        lines.push(line.slice(0, cut));
        line = line.slice(cut);
      }
    }
    lines.push(line.replace(/\s+$/, ""));
  }
  return lines;
}

/** Draws one page's marks on its picture and returns it as a JPEG data URL, with the picture's size. */
export async function drawMarks(pageUrl: string, marks: PageMark[], values: ValueBox[] = []): Promise<{ url: string; width: number; height: number }> {
  const image = await loadImage(pageUrl);
  const { width, height } = image;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("canvas unavailable");
  context.drawImage(image, 0, 0);
  for (const box of values) {
    const boxWidth = (box.right - box.left) * width;
    const boxHeight = (box.bottom - box.top) * height;
    const family = fontById("sarabun").family;
    await document.fonts.load(`${boxHeight * 0.65}px ${family}`, box.value).catch(() => undefined);
    // As big as the box is tall, but shrunk until the whole value fits across it.
    const padding = boxHeight * 0.13;
    context.font = `100px ${family}`;
    const wide = box.value ? context.measureText(box.value).width / 100 : 0;
    const font = `${Math.min(boxHeight * 0.65, wide ? (boxWidth - 2 * padding) / wide : Infinity)}px ${family}`;
    // The value covers what was there (a blank line, handwriting) and is clipped to its box, like on screen.
    context.save();
    context.beginPath();
    context.rect(box.left * width, box.top * height, boxWidth, boxHeight);
    context.clip();
    context.fillStyle = "rgba(255, 255, 255, 0.9)";
    context.fillRect(box.left * width, box.top * height, boxWidth, boxHeight);
    context.fillStyle = "#1a3a8a";
    context.font = font;
    context.textBaseline = "middle";
    context.textAlign = "left";
    if (box.value) context.fillText(box.value, box.left * width + padding, (box.top + (box.bottom - box.top) / 2) * height);
    context.restore();
  }
  for (const mark of marks) {
    if (mark.kind === "highlight") {
      context.fillStyle = highlightFill(mark.color ?? DEFAULT_HIGHLIGHT);
      context.fillRect(mark.x * width, mark.y * height, mark.w * width, mark.h * height);
    } else if (mark.kind === "text" || mark.kind === "date") {
      if (!mark.text) continue;
      const style = mark.style ?? DEFAULT_MARK_STYLE;
      const font = `${style.italic ? "italic " : ""}${style.bold ? 700 : 400} ${style.size * width}px ${fontById(style.font).family}`;
      // A web font that has not been used yet is not in the canvas until it has been loaded.
      await document.fonts.load(font, mark.text).catch(() => undefined);
      context.fillStyle = style.color;
      context.font = font;
      context.textBaseline = "middle";
      context.textAlign = "left";
      // The same inset, width and line height the on-screen box has, so the lines break where they do there.
      const inset = TEXT_INSET * width;
      const room = (mark.w || 1 - mark.x) * width - 2 * inset;
      wrapText(context, mark.text, room).forEach((line, index) => {
        context.fillText(line, mark.x * width + inset, mark.y * height + index * TEXT_LINE_HEIGHT * style.size * width);
      });
    } else if (mark.kind === "check" || mark.kind === "cross") {
      context.fillStyle = mark.kind === "check" ? "#1a7f37" : "#c62828";
      context.font = `${mark.w * 0.9 * width}px sans-serif`;
      context.textBaseline = "middle";
      context.textAlign = "center";
      context.fillText(mark.kind === "check" ? "✓" : "✗", mark.x * width, mark.y * height);
    } else if (mark.image) {
      const signature = await loadImage(mark.image);
      const drawWidth = mark.w * width;
      const drawHeight = drawWidth * (mark.ratio ?? signature.height / signature.width);
      context.drawImage(signature, mark.x * width - drawWidth / 2, mark.y * height - drawHeight / 2, drawWidth, drawHeight);
    }
  }
  return { url: canvas.toDataURL("image/jpeg", 0.92), width, height };
}

/** Pages with their marks (see `drawMarks`), put together as one PDF. */
export async function marksToPdf(pages: Array<{ url: string; width: number; height: number }>): Promise<Blob> {
  const { PDFDocument } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  for (const page of pages) {
    const bytes = Uint8Array.from(atob(page.url.slice(page.url.indexOf(",") + 1)), (character) => character.charCodeAt(0));
    const picture = await pdf.embedJpg(bytes);
    pdf.addPage([page.width, page.height]).drawImage(picture, { x: 0, y: 0, width: page.width, height: page.height });
  }
  return new Blob([Uint8Array.from(await pdf.save())], { type: "application/pdf" });
}
