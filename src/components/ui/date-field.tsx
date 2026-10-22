"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useLocale, type Locale } from "@/lib/i18n/locale-provider";

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

const COPY: Record<Locale, { placeholder: string; openCalendar: string; previous: string; next: string; today: string; clear: string }> = {
  th: { placeholder: "วว/ดด/ปปปป", openCalendar: "เลือกวันจากปฏิทิน", previous: "เดือนก่อนหน้า", next: "เดือนถัดไป", today: "วันนี้", clear: "ล้าง" },
  en: { placeholder: "dd/mm/yyyy", openCalendar: "Pick a date from the calendar", previous: "Previous month", next: "Next month", today: "Today", clear: "Clear" },
};

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function toIso(year: number, month: number, day: number): string {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

function todayIso(): string {
  const now = new Date();
  return toIso(now.getFullYear(), now.getMonth(), now.getDate());
}

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

function isOutOfRange(iso: string, min?: string, max?: string): boolean {
  return Boolean((min && iso < min) || (max && iso > max));
}

/** The month shown first: the chosen day's, otherwise today's (or the earliest allowed day if that is later). */
function initialMonth(value: string, min?: string): { year: number; month: number } {
  const source = value || (min && min > todayIso() ? min : todayIso());
  return { year: Number(source.slice(0, 4)), month: Number(source.slice(5, 7)) - 1 };
}

const CALENDAR_WIDTH = 272;
const CALENDAR_HEIGHT = 340;

function Calendar({
  value,
  min,
  max,
  locale,
  style,
  popupRef,
  onPick,
  onClear,
}: {
  value: string;
  min?: string;
  max?: string;
  locale: Locale;
  style: CSSProperties;
  popupRef: React.RefObject<HTMLDivElement | null>;
  onPick: (iso: string) => void;
  onClear: () => void;
}) {
  const copy = COPY[locale];
  const [view, setView] = useState(() => initialMonth(value, min));
  const today = todayIso();
  // Always the Gregorian calendar, so the year matches the one typed into the field.
  const formatLocale = locale === "th" ? "th-TH-u-ca-gregory" : "en-US";

  const monthLabel = useMemo(
    () => new Intl.DateTimeFormat(formatLocale, { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(view.year, view.month, 1))),
    [formatLocale, view.month, view.year],
  );
  const weekdays = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(formatLocale, { weekday: "short", timeZone: "UTC" });
    // 4 January 2026 is a Sunday.
    return Array.from({ length: 7 }, (_, index) => formatter.format(new Date(Date.UTC(2026, 0, 4 + index))));
  }, [formatLocale]);

  const firstWeekday = new Date(Date.UTC(view.year, view.month, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(view.year, view.month + 1, 0)).getUTCDate();
  const cells: Array<number | null> = [...Array.from({ length: firstWeekday }, () => null), ...Array.from({ length: daysInMonth }, (_, index) => index + 1)];

  const moveMonth = (delta: number) => {
    setView((current) => {
      const next = new Date(Date.UTC(current.year, current.month + delta, 1));
      return { year: next.getUTCFullYear(), month: next.getUTCMonth() };
    });
  };

  const navButton = "grid size-7 place-items-center rounded-md text-[#554d47] hover:bg-[#fff2ea] hover:text-[#f26b38]";

  return (
    <div
      ref={popupRef}
      role="dialog"
      aria-label={copy.openCalendar}
      style={{ ...style, width: CALENDAR_WIDTH }}
      className="fixed z-[200] rounded-xl border border-[#e9e3df] bg-white p-3 shadow-[0_14px_32px_rgba(33,29,25,0.16)]"
    >
      <div className="mb-2 flex items-center justify-between">
        <button type="button" className={navButton} aria-label={copy.previous} onClick={() => moveMonth(-1)}>
          <ChevronLeft size={16} aria-hidden="true" />
        </button>
        <strong className="text-sm text-[#171412]">
          {monthLabel} {view.year}
        </strong>
        <button type="button" className={navButton} aria-label={copy.next} onClick={() => moveMonth(1)}>
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center text-xs">
        {weekdays.map((weekday) => (
          <span key={weekday} className="py-1 font-semibold text-[#8b817a]">
            {weekday}
          </span>
        ))}
        {cells.map((day, index) => {
          if (day === null) return <span key={`blank-${index}`} />;
          const iso = toIso(view.year, view.month, day);
          const disabled = isOutOfRange(iso, min, max);
          const selected = iso === value;
          return (
            <button
              key={iso}
              type="button"
              disabled={disabled}
              aria-pressed={selected}
              aria-current={iso === today ? "date" : undefined}
              className={`grid size-8 place-items-center rounded-lg text-[#171412] ${
                selected
                  ? "bg-[#f26b38] font-bold text-white"
                  : iso === today
                    ? "border border-[#f26b38] hover:bg-[#fff2ea]"
                    : "hover:bg-[#fff2ea]"
              } disabled:cursor-not-allowed disabled:text-[#c8c0ba] disabled:hover:bg-transparent`}
              onClick={() => onPick(iso)}
            >
              {day}
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex items-center justify-between border-t border-[#f0ebe7] pt-2 text-xs font-semibold">
        <button type="button" className="rounded-md px-2 py-1 text-[#f26b38] hover:bg-[#fff2ea]" onClick={onClear}>
          {copy.clear}
        </button>
        <button
          type="button"
          disabled={isOutOfRange(today, min, max)}
          className="rounded-md px-2 py-1 text-[#f26b38] hover:bg-[#fff2ea] disabled:cursor-not-allowed disabled:opacity-40"
          onClick={() => onPick(today)}
        >
          {copy.today}
        </button>
      </div>
    </div>
  );
}

/**
 * A day field that always reads day / month / year, whatever the browser's language is. A native date input and its
 * calendar follow the browser, so an English browser showed mm/dd/yyyy and an English calendar on a Thai page; this one
 * follows the language chosen in the app.
 */
export function DateField({ value, onChange, min, max, disabled = false, ariaLabel, className }: DateFieldProps) {
  const { locale } = useLocale();
  const copy = COPY[locale];
  // What is typed while it is not yet a complete, valid day; null means "show the chosen value".
  const [draft, setDraft] = useState<string | null>(null);
  // Where the calendar sits on screen while it is open (it is drawn above the page, so no card can clip it).
  const [anchor, setAnchor] = useState<CSSProperties | null>(null);
  const open = anchor !== null;
  const rootRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const shown = draft ?? isoToDisplay(value);
  const isInvalid = draft !== null && draft.length === 10;

  useEffect(() => {
    if (!open) return;
    const close = () => setAnchor(null);
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !popupRef.current?.contains(target)) close();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  const handleType = (raw: string) => {
    const next = maskDigits(raw);
    const iso = displayToIso(next, min, max);
    setDraft(iso ? null : next);
    if (iso || value) onChange(iso);
  };

  const pick = (iso: string) => {
    setDraft(null);
    onChange(iso);
    setAnchor(null);
  };

  const toggleCalendar = () => {
    if (open) {
      setAnchor(null);
      return;
    }
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return;
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - CALENDAR_WIDTH - 8));
    const spaceBelow = window.innerHeight - rect.bottom;
    // Open upwards when there is not room below and there is more above.
    setAnchor(spaceBelow < CALENDAR_HEIGHT && rect.top > spaceBelow ? { left, bottom: window.innerHeight - rect.top + 4 } : { left, top: rect.bottom + 4 });
  };

  return (
    <div ref={rootRef} className={className} style={{ position: "relative" }}>
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        maxLength={10}
        value={shown}
        disabled={disabled}
        placeholder={copy.placeholder}
        aria-label={ariaLabel}
        aria-invalid={isInvalid || undefined}
        style={{ paddingRight: "2.2rem" }}
        onChange={(event) => handleType(event.target.value)}
      />
      <button
        type="button"
        disabled={disabled}
        aria-label={copy.openCalendar}
        aria-expanded={open}
        className="absolute top-1/2 right-2 -translate-y-1/2 text-[#8b817a] hover:text-[#f26b38] disabled:opacity-50"
        onClick={toggleCalendar}
      >
        <CalendarDays size={16} aria-hidden="true" />
      </button>
      {anchor && !disabled && typeof document !== "undefined"
        ? createPortal(
            <Calendar value={value} min={min} max={max} locale={locale} style={anchor} popupRef={popupRef} onPick={pick} onClear={() => pick("")} />,
            document.body,
          )
        : null}
    </div>
  );
}
