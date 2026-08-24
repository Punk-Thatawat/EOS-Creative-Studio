import { ImagePlus } from "lucide-react";
import { cx } from "../styles";

export function ImagePlaceholder({ className, label = "YOUR IMAGE HERE" }: { className?: string; label?: string }) {
  return <div className={cx("gen-placeholder", className)} aria-label={label}><div className={cx("gen-placeholder-glow")} /><ImagePlus size={30} strokeWidth={1.5} /><span>{label}</span></div>;
}

export function Segmented<T extends string>({ items, value, onChange }: { items: readonly T[]; value: T; onChange: (value: T) => void }) {
  const labelFor = (item: T) => /^(avif|gif|jpe?g|png|webp)$/i.test(item) ? item.toUpperCase() : item.split(/[-_]/).map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()).join(" ");
  return <div className={cx("gen-segmented")} style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>{items.map((item) => <button type="button" key={item} onClick={() => onChange(item)} className={value === item ? cx("is-selected") : undefined}>{labelFor(item)}</button>)}</div>;
}
