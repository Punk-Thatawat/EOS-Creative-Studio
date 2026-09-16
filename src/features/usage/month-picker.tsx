"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

const monthNames = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

export type MonthOption = { value: string; label: string };

export function MonthPicker({ value, options, onChange, ariaLabel, className }: { value: string; options: readonly MonthOption[]; onChange: (value: string) => void; ariaLabel: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(() => Number(value.slice(0, 4)));
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const allowed = useMemo(() => new Set(options.map((option) => option.value)), [options]);
  const years = useMemo(() => [...new Set(options.map((option) => Number(option.value.slice(0, 4))))].sort((a, b) => a - b), [options]);
  const selectedLabel = options.find((option) => option.value === value)?.label ?? value;

  const toggle = () => {
    if (open) return setOpen(false);
    setYear(Number(value.slice(0, 4)));
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const choose = (month: string) => {
    onChange(month);
    setOpen(false);
    triggerRef.current?.focus();
  };

  return <div ref={rootRef} className={`relative min-w-0 ${className ?? ""}`}>
    <button ref={triggerRef} type="button" className="flex min-h-11 w-full items-center justify-between gap-3 rounded-[12px] border border-border bg-white px-4 text-left text-base font-bold text-foreground outline-none transition focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/10" aria-haspopup="dialog" aria-expanded={open} aria-label={ariaLabel} onClick={toggle}>
      <span className="min-w-0 flex-1 truncate">{selectedLabel}</span>
      <ChevronDown size={16} className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
    </button>
    {open ? <div className="absolute left-0 top-[calc(100%+6px)] z-50 w-[272px] rounded-[12px] border border-border bg-white p-3 shadow-[0_14px_32px_rgba(33,29,25,0.16)]" role="dialog" aria-label={ariaLabel}>
      <div className="mb-2 flex items-center justify-between">
        <button type="button" className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-muted disabled:opacity-35" disabled={year <= years[0]} onClick={() => setYear((current) => current - 1)} aria-label="ปีก่อนหน้า"><ChevronLeft size={16} /></button>
        <strong className="text-sm font-bold">{year}</strong>
        <button type="button" className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-muted disabled:opacity-35" disabled={year >= years[years.length - 1]} onClick={() => setYear((current) => current + 1)} aria-label="ปีถัดไป"><ChevronRight size={16} /></button>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {monthNames.map((name, index) => {
          const month = `${year}-${String(index + 1).padStart(2, "0")}`;
          const disabled = !allowed.has(month);
          return <button key={month} type="button" role="option" aria-selected={month === value} disabled={disabled} onClick={() => choose(month)} className={`min-h-9 rounded-lg px-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${month === value ? "bg-primary text-white" : "text-foreground hover:bg-[#fff7f3] hover:text-primary"}`}>{name}</button>;
        })}
      </div>
    </div> : null}
  </div>;
}
