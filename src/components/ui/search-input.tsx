import { Search, X } from "lucide-react";
import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import styles from "./search-input.module.css";

type SearchInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange" | "size"> & {
  value: string;
  onValueChange: (value: string) => void;
  onClear?: () => void;
  size?: "default" | "compact";
  className?: string;
};

export function SearchInput({ value, onValueChange, onClear, size = "default", className, placeholder = "ค้นหา...", ...inputProps }: SearchInputProps) {
  const clear = onClear ?? (() => onValueChange(""));

  return (
    <div className={cn(styles.root, size === "compact" && styles.compact, className)}>
      <Search className={styles.icon} aria-hidden="true" />
      <input
        {...inputProps}
        type="search"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        placeholder={placeholder}
        className={styles.input}
      />
      {value ? <button type="button" className={styles.clear} onClick={clear} aria-label="ล้างคำค้นหา"><X aria-hidden="true" /></button> : null}
    </div>
  );
}
