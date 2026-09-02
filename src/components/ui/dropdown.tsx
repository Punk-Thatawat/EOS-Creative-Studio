"use client";

import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type DropdownOption = {
  value: string;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
};

export type DropdownProps = {
  value?: string;
  options: readonly DropdownOption[];
  onChange: (value: string) => void;
  placeholder?: ReactNode;
  ariaLabel: string;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  triggerClassName?: string;
  menuClassName?: string;
  optionClassName?: string;
  menuPosition?: "absolute" | "fixed";
};

export function Dropdown({ value, options, onChange, placeholder = "Select an option", ariaLabel, disabled = false, loading = false, className, triggerClassName, menuClassName, optionClassName, menuPosition = "absolute" }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const [fixedMenuStyle, setFixedMenuStyle] = useState<CSSProperties | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listboxId = useId();
  const selectedOption = options.find((option) => option.value === value);
  const isDisabled = disabled || loading || options.length === 0;

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

  useEffect(() => {
    if (!open || menuPosition !== "fixed") {
      return;
    }

    const updateMenuPosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setFixedMenuStyle({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    };

    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [menuPosition, open]);

  const choose = (option: DropdownOption) => {
    if (option.disabled) return;
    onChange(option.value);
    setOpen(false);
    setFixedMenuStyle(null);
    triggerRef.current?.focus();
  };

  return <div ref={rootRef} className={cn("relative min-w-0", className)}>
    <button ref={triggerRef} type="button" className={cn("flex min-h-10 w-full items-center justify-between gap-3 rounded-xl border border-border bg-white px-3 text-left text-xs font-semibold text-foreground outline-none transition focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-60", triggerClassName)} disabled={isDisabled} aria-haspopup="listbox" aria-expanded={open} aria-controls={listboxId} aria-label={ariaLabel} onClick={() => setOpen((current) => !current)}>
      <span className="min-w-0 flex-1 truncate">{loading ? <span className="inline-block h-3 w-24 animate-pulse rounded bg-surface-muted" aria-label="Loading" /> : selectedOption?.label ?? placeholder}</span>
      <ChevronDown size={15} className={cn("shrink-0 transition-transform", open && "rotate-180")} aria-hidden="true" />
    </button>
    {open && !isDisabled && (menuPosition === "absolute" || fixedMenuStyle) ? <div id={listboxId} style={fixedMenuStyle ?? undefined} className={cn(menuPosition === "fixed" ? "fixed z-50 max-h-72 overflow-y-auto rounded-xl border border-border bg-white p-1.5 shadow-[0_14px_32px_rgba(33,29,25,0.16)]" : "absolute left-0 right-0 top-[calc(100%+6px)] z-50 max-h-72 overflow-y-auto rounded-xl border border-border bg-white p-1.5 shadow-[0_14px_32px_rgba(33,29,25,0.16)]", menuClassName)} role="listbox" aria-label={ariaLabel}>
      {options.map((option) => <button key={option.value} type="button" role="option" aria-selected={option.value === value} disabled={option.disabled} className={cn("flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-xs font-semibold text-foreground transition-colors hover:bg-[#fff7f3] hover:text-primary disabled:cursor-not-allowed disabled:opacity-45", option.value === value && "bg-[#fff7f3] text-primary", optionClassName)} onClick={() => choose(option)}>
        <span className="min-w-0 flex-1">{option.label}{option.description ? <small className="mt-0.5 block truncate text-[10px] font-normal text-muted-foreground">{option.description}</small> : null}</span>
        {option.value === value ? <Check size={15} className="shrink-0 text-primary" aria-hidden="true" /> : null}
      </button>)}
    </div> : null}
  </div>;
}
