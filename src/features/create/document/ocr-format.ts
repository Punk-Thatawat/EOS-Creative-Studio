import type { Locale } from "@/lib/i18n/dictionary";
import { fieldLabel } from "./ocr-field-labels";

const MONEY_KEY = /(amount|balance|total|cost|charge|bill|fee|limit|payment|price|vat|tax|deposit|withdrawal|discount|interest|salary)/i;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function isEmpty(value: unknown): boolean {
  return value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0) || (isRecord(value) && Object.keys(value).length === 0);
}

export function formatPrimitive(value: unknown, key: string, locale: Locale): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "number") {
    return MONEY_KEY.test(key) ? value.toLocaleString(locale === "th" ? "th-TH" : "en-US", { maximumFractionDigits: 4 }) : String(value);
  }
  return String(value);
}

export function valueToLines(value: unknown, name: string, locale: Locale, depth: number): string[] {
  const indent = "  ".repeat(depth);
  if (isEmpty(value)) return [];
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => {
      if (!isRecord(item) && !Array.isArray(item)) return [`${indent}- ${formatPrimitive(item, name, locale)}`];
      return [`${indent}#${index + 1}`, ...valueToLines(item, name, locale, depth + 1)];
    });
  }
  if (isRecord(value)) {
    return Object.entries(value).flatMap(([key, child]) => {
      if (isEmpty(child)) return [];
      const label = fieldLabel(key, locale);
      if (isRecord(child) || Array.isArray(child)) return [`${indent}${label}:`, ...valueToLines(child, key, locale, depth + 1)];
      return [`${indent}${label}: ${formatPrimitive(child, key, locale)}`];
    });
  }
  return [`${indent}${formatPrimitive(value, name, locale)}`];
}

