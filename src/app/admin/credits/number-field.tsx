import { Info } from "lucide-react";

export function NumberField({
  label,
  value,
  suffix,
  onChange,
  help,
  readOnly = false,
  max,
  step,
}: {
  label: string;
  value: string;
  suffix: string;
  onChange: (value: string) => void;
  help?: string;
  readOnly?: boolean;
  max?: number;
  step?: number;
}) {
  const autoRate = label === "USD / THB rate";
  const locked = readOnly || autoRate;
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
        {autoRate ? "USD / THB rate (auto)" : label}
        {help ? <Info size={12} aria-label={help} /> : null}
      </span>
      <span className="relative block">
        <input
          type="number"
          min="0"
          max={max}
          step={step}
          value={value}
          readOnly={locked}
          onChange={(event) => onChange(event.target.value)}
          className={`h-11 w-full rounded-xl border border-border px-3 pr-16 text-sm font-semibold outline-none transition focus:border-primary focus:ring-3 focus:ring-primary/10 ${locked ? "bg-[#f2ece7] text-muted-foreground" : "bg-[#fcfaf8]"}`}
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
          {suffix}
        </span>
      </span>
    </label>
  );
}
