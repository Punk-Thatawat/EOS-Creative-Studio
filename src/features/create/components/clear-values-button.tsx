"use client";

import { RotateCcw } from "lucide-react";
import { useLocale } from "@/lib/i18n/locale-provider";
import { useStudioCopy } from "@/lib/i18n/studio-copy";

type ClearValuesButtonProps = {
  onClick: () => void;
  disabled?: boolean;
};

export function ClearValuesButton({ onClick, disabled = false }: ClearValuesButtonProps) {
  const { c } = useStudioCopy();
  const { locale } = useLocale();
  // The tooltip and accessible name say a bit more than the visible label, in both languages.
  const description = locale === "en" ? "Clear all values on this page" : "เคลียร์ค่าทั้งหมดในหน้านี้";
  return (
    <button
      type="button"
      className="gen-clear-values-button inline-flex h-8 min-h-8 touch:min-h-10 items-center gap-1.5 whitespace-nowrap rounded-md border px-2.5 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50"
      onClick={onClick}
      disabled={disabled}
      title={description}
      aria-label={description}
    >
      <RotateCcw size={13} aria-hidden="true" />
      {c("common.clearAll")}
    </button>
  );
}
