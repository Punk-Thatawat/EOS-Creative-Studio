"use client";

import { ZoomIn, ZoomOut } from "lucide-react";
import { Dropdown } from "@/components/ui/dropdown";
import type { TranslationKey } from "@/lib/i18n/dictionary";
import { useLocale } from "@/lib/i18n/locale-provider";
import { documentZoomLevels, nextDocumentZoom } from "./document-zoom-levels";
import styles from "./document-zoom-control.module.css";

const K = (key: string) => `create.document.${key}` as TranslationKey;

export function DocumentZoomControl({ value, onChange, disabled = false }: {
  value: number;
  onChange: (zoom: number) => void;
  disabled?: boolean;
}) {
  const { t } = useLocale();
  // Fit-to-page can calculate a value that is not one of the preset levels.
  const levels = documentZoomLevels(value);
  const disabledHint = disabled ? t(K("ocr.tool.needFile")) : undefined;

  return (
    <div className={styles.zoom}>
      <button type="button" aria-label={t(K("ocr.tool.zoomIn"))} title={disabledHint ?? t(K("ocr.tool.zoomIn"))} disabled={disabled || value >= 300} onClick={() => onChange(nextDocumentZoom(value, "in"))}>
        <ZoomIn size={14} aria-hidden="true" />
      </button>
      <button type="button" aria-label={t(K("ocr.tool.zoomOut"))} title={disabledHint ?? t(K("ocr.tool.zoomOut"))} disabled={disabled || value <= 25} onClick={() => onChange(nextDocumentZoom(value, "out"))}>
        <ZoomOut size={14} aria-hidden="true" />
      </button>
      <Dropdown
        value={String(value)}
        options={levels.map((zoom) => ({ value: String(zoom), label: `${zoom}%` }))}
        onChange={(zoom) => onChange(Number(zoom))}
        ariaLabel={t(K("ocr.tool.zoom"))}
        disabled={disabled}
        menuPosition="fixed"
        className={styles.dropdown}
        triggerClassName="h-[28px] min-h-0 w-full gap-1 rounded-md border-transparent bg-transparent px-2 text-[11px] font-medium text-[#59626b] hover:bg-[#fff2ea]"
        menuClassName="min-w-[96px]"
        optionClassName="px-2.5 py-1.5 text-[11px]"
      />
    </div>
  );
}
