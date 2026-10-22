"use client";

import { useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import { useLocale } from "@/lib/i18n/locale-provider";

export type DateFieldProps = {
  /** The chosen day as `yyyy-mm-dd`, or "" when none is chosen. */
  value: string;
  onChange: (value: string) => void;
  /** Earliest day, `yyyy-mm-dd`. */
  min?: string;
  /** Latest day, `yyyy-mm-dd`. */
  max?: string;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
};

function isoToDisplay(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "";
}

/** Keeps digits only and lays them out as dd/mm/yyyy while the user types. */
function maskDigits(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean).join("/");
}

/** `dd/mm/yyyy` to `yyyy-mm-dd`, or "" when it is not a real day inside min/max. */
function displayToIso(text: string, min?: string, max?: string): string {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  if (!match) return "";
  const [, day, month, year] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  const isRealDay =
    date.getUTCFullYear() === Number(year) && date.getUTCMonth() === Number(month) - 1 && date.getUTCDate() === Number(day);
  if (!isRealDay) return "";
  const iso = `${year}-${month}-${day}`;
  if ((min && iso < min) || (max && iso > max)) return "";
  return iso;
}

/**
 * A day field that always reads day / month / year, whatever the browser's language is (a native date input follows
 * the browser, so an English browser shows mm/dd/yyyy). The calendar button still opens the browser's own calendar.
 */
export function DateField({ value, onChange, min, max, disabled = false, ariaLabel, className }: DateFieldProps) {
  const { locale } = useLocale();
  // What is typed while it is not yet a complete, valid day; null means "show the chosen value".
  const [draft, setDraft] = useState<string | null>(null);
  const pickerRef = useRef<HTMLInputElement>(null);
  const shown = draft ?? isoToDisplay(value);
  const isInvalid = draft !== null && draft.length === 10;

  const handleType = (raw: string) => {
    const next = maskDigits(raw);
    const iso = displayToIso(next, min, max);
    setDraft(iso ? null : next);
    if (iso || value) onChange(iso);
  };

  const openPicker = () => {
    const picker = pickerRef.current;
    if (!picker) return;
    try {
      picker.showPicker();
    } catch {
      picker.focus();
      picker.click();
    }
  };

  return (
    <div className={className} style={{ position: "relative" }}>
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        maxLength={10}
        value={shown}
        disabled={disabled}
        placeholder={locale === "th" ? "วว/ดด/ปปปป" : "dd/mm/yyyy"}
        aria-label={ariaLabel}
        aria-invalid={isInvalid || undefined}
        style={{ paddingRight: "2.2rem" }}
        onChange={(event) => handleType(event.target.value)}
      />
      <button
        type="button"
        disabled={disabled}
        aria-label={locale === "th" ? "เลือกวันจากปฏิทิน" : "Pick a date from the calendar"}
        className="absolute top-1/2 right-2 -translate-y-1/2 text-[#8b817a] hover:text-[#f26b38] disabled:opacity-50"
        onClick={openPicker}
      >
        <CalendarDays size={16} aria-hidden="true" />
      </button>
      {/* The browser's calendar, kept invisible and laid over the field so it opens right under it. */}
      <input
        ref={pickerRef}
        type="date"
        tabIndex={-1}
        aria-hidden="true"
        value={value}
        min={min}
        max={max}
        disabled={disabled}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, pointerEvents: "none", border: 0, padding: 0 }}
        onChange={(event) => {
          setDraft(null);
          onChange(event.target.value);
        }}
      />
    </div>
  );
}
