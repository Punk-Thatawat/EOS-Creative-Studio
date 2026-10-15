"use client";

import {
  CalendarDays,
  Camera,
  Check,
  ChevronDown,
  ClipboardCopy,
  Eye,
  Hand,
  Highlighter,
  Maximize,
  MessageSquarePlus,
  MousePointer2,
  PenLine,
  RotateCcw,
  RotateCw,
  Save,
  SquareDashed,
  Type,
  WrapText,
  X,
  ZoomIn,
  ZoomOut,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Dropdown } from "@/components/ui/dropdown";
import type { TranslationKey } from "@/lib/i18n/dictionary";
import { useLocale } from "@/lib/i18n/locale-provider";
import { HIGHLIGHT_COLORS, TextStyleBar, type MarkStyle } from "./preview-marks";
import styles from "./document-feature-generation-page.module.css";

const K = (key: string) => `create.document.${key}` as TranslationKey;

/** The one thing the pointer does on the form page at a time. */
export type FormTool = "select" | "hand" | "snapshot" | "text" | "highlight" | "check" | "cross" | "date" | "signature" | "draw" | "notes";
export type FitMode = "width" | "page" | "actual";

/** The menus are 190px wide (see `.toolMenu`). */
const MENU_WIDTH = 190;

/** A toolbar button with a small menu under it, closed by a click elsewhere or Escape. */
function MenuButton({ icon: Icon, label, active, disabled, title, compact, children }: { icon: LucideIcon; label: string; active?: boolean; disabled?: boolean; title?: string; /** Only the icon on a desktop toolbar, where the name is in the tooltip. */ compact?: boolean; children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false);
  /** A menu that would run off the right edge of the screen opens leftwards instead. */
  const [alignRight, setAlignRight] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: Event) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);
  return (
    <span className={styles.toolMenuWrap} ref={ref}>
      <button type="button" className={`${styles.toolbarButton} ${active || open ? styles.toolbarButtonActive : ""}`} aria-haspopup="menu" aria-expanded={open} title={title ?? label} disabled={disabled} onClick={() => { setAlignRight((ref.current?.getBoundingClientRect().left ?? 0) + MENU_WIDTH > window.innerWidth - 8); setOpen((value) => !value); }}>
        <Icon size={16} aria-hidden="true" />
        <span className={`${styles.toolbarLabel} ${compact ? styles.desktopIconOnly : ""}`}>{label}</span>
        <ChevronDown size={11} aria-hidden="true" />
      </button>
      {open && <div className={styles.toolMenu} role="menu" style={alignRight ? { left: "auto", right: 0 } : undefined}>{children(() => setOpen(false))}</div>}
    </span>
  );
}

function MenuItem({ icon: Icon, label, onClick, disabled }: { icon?: LucideIcon; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" role="menuitem" disabled={disabled} onClick={onClick}>
      {Icon ? <Icon size={16} aria-hidden="true" /> : <span className={styles.toolMenuGap} />}
      <span>{label}</span>
    </button>
  );
}

/**
 * The tools along the top of a form's page, in the order a PDF reader has them: hand and select, snapshot, clipboard,
 * zoom and page fit, reflow, turning the page, then the markup tools (typewriter, highlight, fill and sign).
 */
export function FormToolbar({
  tool,
  onTool,
  zoom,
  onZoom,
  fit,
  onFit,
  reflow,
  onReflow,
  reflowDisabled,
  showValues,
  onShowValues,
  onRotate,
  hasPreview,
  hasFields,
  canDraw,
  canSave,
  saving,
  onSave,
  onCopy,
  hasSignature,
  onNewSignature,
  textStyle,
  onTextStyle,
  highlightColor,
  onHighlightColor,
}: {
  tool: FormTool;
  onTool: (tool: FormTool) => void;
  zoom: number;
  onZoom: (zoom: number) => void;
  fit: FitMode;
  onFit: (mode: FitMode) => void;
  reflow: boolean;
  onReflow: () => void;
  reflowDisabled: boolean;
  /** Writes each value that was read inside its box on the form. */
  showValues: boolean;
  onShowValues: () => void;
  onRotate: (direction: 1 | -1) => void;
  hasPreview: boolean;
  hasFields: boolean;
  canDraw: boolean;
  /** Whether there is a saved reading to put the changes in. */
  canSave: boolean;
  saving: boolean;
  onSave: () => void;
  onCopy: (kind: "text" | "table" | "json") => void;
  hasSignature: boolean;
  onNewSignature: () => void;
  /** The font, size and colour text is typed in. */
  textStyle: MarkStyle;
  onTextStyle: (patch: Partial<MarkStyle>) => void;
  /** The colour a new highlight gets; also recolours the highlight that is selected. */
  highlightColor: string;
  onHighlightColor: (color: string) => void;
}) {
  const { t } = useLocale();
  const needFile = t(K("ocr.tool.needFile"));
  const toggle = (name: FormTool, icon: LucideIcon, label: string, options: { disabled?: boolean; title?: string; hideLabel?: boolean; phoneHidden?: boolean } = {}) => {
    const Icon = icon;
    return (
      <button type="button" className={`${styles.toolbarButton} ${tool === name ? styles.toolbarButtonActive : ""} ${options.phoneHidden ? styles.phoneHidden : ""}`} aria-pressed={tool === name} aria-label={label} title={options.title ?? (hasPreview ? label : needFile)} disabled={options.disabled ?? !hasPreview} onClick={() => onTool(tool === name && name !== "select" ? "select" : name)}>
        <Icon size={16} aria-hidden="true" />
        {!options.hideLabel && <span className={styles.toolbarLabel}>{label}</span>}
      </button>
    );
  };
  const saveButton = (
    <button type="button" className={`${styles.toolbarButton} ${styles.toolbarSave}`} disabled={saving || !canSave} title={canSave ? t(K("form.tool.saveHint")) : t(K("form.tool.saveNeed"))} onClick={onSave}>
      <Save size={16} aria-hidden="true" />
      <span className={styles.toolbarLabel}>{saving ? t(K("form.tool.saving")) : t(K("form.tool.save"))}</span>
    </button>
  );
  const signTool = tool === "text" || tool === "check" || tool === "cross" || tool === "date" || tool === "signature";

  return (
    <div className={styles.formToolbar} role="toolbar" aria-label={t(K("form.tools"))}>
      <div className={styles.toolRow}>
        <div className={styles.toolGroup}>
          {toggle("hand", Hand, t(K("form.tool.hand")), { hideLabel: true, phoneHidden: true })}
          {toggle("select", MousePointer2, t(K("form.tool.select")), { hideLabel: true })}
          {toggle("snapshot", Camera, t(K("form.tool.snapshot")), { hideLabel: true, title: hasPreview ? t(K("form.tool.snapshotHint")) : needFile })}
          <MenuButton icon={ClipboardCopy} label={t(K("form.tool.clipboard"))} compact disabled={!hasFields} title={hasFields ? t(K("form.tool.clipboardHint")) : t(K("ocr.tool.needResult"))}>
            {(close) => (
              <>
                <MenuItem label={t(K("form.clipboard.text"))} onClick={() => { onCopy("text"); close(); }} />
                <MenuItem label={t(K("form.clipboard.table"))} onClick={() => { onCopy("table"); close(); }} />
                <MenuItem label={t(K("form.clipboard.json"))} onClick={() => { onCopy("json"); close(); }} />
              </>
            )}
          </MenuButton>

        </div>
        <div className={styles.toolGroup}>
          <button type="button" className={styles.toolbarButton} aria-label={t(K("ocr.tool.zoomOut"))} title={hasPreview ? t(K("ocr.tool.zoomOut")) : needFile} disabled={!hasPreview || zoom <= 25} onClick={() => onZoom(Math.max(25, zoom - 25))}>
            <ZoomOut size={16} aria-hidden="true" />
          </button>
          <span className={styles.zoomDropdown} title={hasPreview ? undefined : needFile}>
            <Dropdown
              value={String(zoom)}
              options={Array.from({ length: 12 }, (_, index) => ({ value: String((index + 1) * 25), label: `${(index + 1) * 25}%` }))}
              onChange={(value) => onZoom(Number(value))}
              ariaLabel={t(K("ocr.tool.zoom"))}
              disabled={!hasPreview}
              menuPosition="fixed"
              triggerClassName="h-[34px] min-h-0 w-[92px] gap-1.5 rounded-lg border-transparent bg-transparent px-2.5 text-[12px] font-medium text-[#59626b] hover:bg-[#fff2ea]"
              menuClassName="min-w-[110px]"
              optionClassName="px-3 py-2 text-[12px]"
            />
          </span>
          <button type="button" className={styles.toolbarButton} aria-label={t(K("ocr.tool.zoomIn"))} title={hasPreview ? t(K("ocr.tool.zoomIn")) : needFile} disabled={!hasPreview || zoom >= 300} onClick={() => onZoom(Math.min(300, zoom + 25))}>
            <ZoomIn size={16} aria-hidden="true" />
          </button>
          <MenuButton icon={Maximize} label={t(K("form.tool.fit"))} compact disabled={!hasPreview} title={hasPreview ? t(K("form.tool.fit")) : needFile}>
            {(close) => (
              <>
                {(["width", "page", "actual"] as const).map((mode) => (
                  <MenuItem key={mode} icon={fit === mode ? Check : undefined} label={t(K(`form.fit.${mode}`))} onClick={() => { onFit(mode); close(); }} />
                ))}
              </>
            )}
          </MenuButton>
        </div>
        <div className={`${styles.toolGroup} ${styles.toolGroupMarkup}`}>
          {toggle("draw", SquareDashed, t(K("form.tool.draw")), { hideLabel: true, disabled: !hasPreview || !canDraw, title: !hasPreview ? needFile : !canDraw ? t(K("ocr.tool.needResult")) : t(K("form.tool.drawHint")) })}
          {toggle("notes", MessageSquarePlus, t(K("preview.annotate")), { hideLabel: true, title: hasPreview ? t(K("ocr.tool.annotateHint")) : needFile })}
        </div>
      </div>
      <div className={styles.toolRow}>
        <div className={styles.toolGroup}>
          <button type="button" className={`${styles.toolbarButton} ${reflow ? styles.toolbarButtonActive : ""}`} aria-pressed={reflow} aria-label={t(K("form.tool.reflow"))} title={reflowDisabled ? t(K("form.tool.reflowNeed")) : t(K("form.tool.reflowHint"))} disabled={reflowDisabled} onClick={onReflow}>
            <WrapText size={16} aria-hidden="true" />
          </button>
          <button type="button" className={`${styles.toolbarButton} ${showValues ? styles.toolbarButtonActive : ""}`} aria-pressed={showValues} aria-label={t(K("form.tool.values"))} title={hasFields ? t(K("form.tool.valuesHint")) : t(K("ocr.tool.needResult"))} disabled={!hasFields} onClick={onShowValues}>
            <Eye size={16} aria-hidden="true" />
          </button>
          <button type="button" className={styles.toolbarButton} aria-label={t(K("form.tool.rotateLeft"))} title={hasPreview ? t(K("form.tool.rotateLeft")) : needFile} disabled={!hasPreview} onClick={() => onRotate(-1)}>
            <RotateCcw size={16} aria-hidden="true" />
          </button>
          <button type="button" className={styles.toolbarButton} aria-label={t(K("form.tool.rotateRight"))} title={hasPreview ? t(K("form.tool.rotateRight")) : needFile} disabled={!hasPreview} onClick={() => onRotate(1)}>
            <RotateCw size={16} aria-hidden="true" />
          </button>

        </div>
        <div className={styles.toolGroup}>
          {toggle("text", Type, t(K("form.tool.typewriter")), { title: hasPreview ? t(K("form.tool.typewriterHint")) : needFile })}
          {toggle("highlight", Highlighter, t(K("form.tool.highlight")), { title: hasPreview ? t(K("form.tool.highlightHint")) : needFile })}
          <MenuButton icon={PenLine} label={t(K("form.tool.fillSign"))} active={signTool} disabled={!hasPreview} title={hasPreview ? t(K("form.tool.fillSignHint")) : needFile}>
            {(close) => (
              <>
                <MenuItem icon={Type} label={t(K("form.mark.text"))} onClick={() => { onTool("text"); close(); }} />
                <MenuItem icon={Check} label={t(K("form.mark.check"))} onClick={() => { onTool("check"); close(); }} />
                <MenuItem icon={X} label={t(K("form.mark.cross"))} onClick={() => { onTool("cross"); close(); }} />
                <MenuItem icon={CalendarDays} label={t(K("form.mark.date"))} onClick={() => { onTool("date"); close(); }} />
                <MenuItem icon={PenLine} label={hasSignature ? t(K("form.mark.signature")) : t(K("form.signature.draw"))} onClick={() => { onTool("signature"); close(); }} />
                {hasSignature && <MenuItem label={t(K("form.signature.new"))} onClick={() => { onNewSignature(); close(); }} />}
              </>
            )}
          </MenuButton>

        </div>
      </div>
      {hasPreview && (
        <div className={styles.formToolbarStyle}>
          <span>{t(K("form.font.row"))}</span>
          <TextStyleBar style={textStyle} onChange={onTextStyle} />
          {/* The highlighter's name and its colours stay together when the row wraps. */}
          <span className={styles.highlightGroup}>
            <span className={styles.formToolbarGap}>{t(K("form.tool.highlight"))}</span>
            <span className={`${styles.markStyleBar} ${styles.highlightSwatches}`} role="group" aria-label={t(K("form.highlight.color"))}>
              {HIGHLIGHT_COLORS.map((color) => (
                <button key={color} type="button" className={`${styles.markSwatch} ${highlightColor === color ? styles.markSwatchOn : ""}`} style={{ backgroundColor: color }} aria-pressed={highlightColor === color} aria-label={`${t(K("form.highlight.color"))} ${color}`} onClick={() => onHighlightColor(color)} />
              ))}
            </span>
          </span>
          {saveButton}
        </div>
      )}
      {/* Without a form on screen the save button gets a row of its own, so the tools above stay where they are. */}
      {!hasPreview && <div className={styles.toolRowEnd}>{saveButton}</div>}
    </div>
  );
}
