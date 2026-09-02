import { cn } from "@/lib/utils";

export type AspectRatioPickerProps<T extends string = string> = {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel?: string;
  className?: string;
};

function iconSizeForRatio(value: string): { width: number; height: number } {
  const [width, height] = value.split(":").map(Number);
  if (!width || !height) return { width: 28, height: 28 };
  if (width >= height) return { width: 28, height: Math.max(12, Math.round(28 * height / width)) };
  return { width: Math.max(16, Math.round(28 * width / height)), height: 28 };
}

function AspectRatioIcon({ value }: { value: string }) {
  const size = iconSizeForRatio(value);
  return <span className="block shrink-0 border border-current" style={size} aria-hidden="true" />;
}

export function AspectRatioPicker<T extends string>({ options, value, onChange, ariaLabel = "Aspect ratio options", className }: AspectRatioPickerProps<T>) {
  return <div className={cn("grid grid-cols-3 gap-2", className)} role="radiogroup" aria-label={ariaLabel}>
    {options.map((option) => <button key={option} type="button" role="radio" aria-label={`Aspect ratio ${option}`} aria-checked={value === option} className={cn("grid min-h-[74px] min-w-0 place-items-center content-center gap-2 rounded-[10px] border border-[#e2e2e2] bg-white px-1 py-2 text-[#59616c] transition-colors hover:border-primary/60 hover:bg-[#fffaf7]", value === option && "border-primary bg-[#fff7f3] text-primary")} onClick={() => onChange(option)}>
      <AspectRatioIcon value={option} />
      <b className="text-[13px] font-semibold leading-none">{option}</b>
    </button>)}
  </div>;
}
