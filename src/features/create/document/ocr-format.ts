import type { Locale } from "@/lib/i18n/dictionary";
import { fieldLabel, normalizeFieldKey } from "./ocr-field-labels";

/** Known enum-like values iApp returns, shown in Thai when the page is Thai. */
const THAI_VALUES: Record<string, Record<string, string>> = {
  priority: { high: "สูง", medium: "ปานกลาง", low: "ต่ำ" },
  experiencelevel: { entry: "ระดับเริ่มต้น", "entry-level": "ระดับเริ่มต้น", junior: "จูเนียร์", mid: "ระดับกลาง", "mid-level": "ระดับกลาง", intermediate: "ระดับกลาง", senior: "ซีเนียร์", lead: "หัวหน้าทีม", executive: "ผู้บริหาร" },
  grammarquality: { excellent: "ดีเยี่ยม", good: "ดี", fair: "พอใช้", average: "ปานกลาง", poor: "ควรปรับปรุง", "needs improvement": "ควรปรับปรุง" },
};

/**
 * Words iApp uses for levels and ratings under keys we have not seen yet. They are only translated when the whole
 * value is one of these words and the key itself talks about a level, quality, priority, status or rating, so text
 * the user's document actually contains is never rewritten.
 */
const GENERIC_LEVEL_KEY = /(level|quality|priority|status|rating|grade|severity|impact)/i;
const GENERIC_THAI_VALUES: Record<string, string> = {
  high: "สูง", medium: "ปานกลาง", low: "ต่ำ", none: "ไม่มี", critical: "วิกฤต",
  excellent: "ดีเยี่ยม", good: "ดี", fair: "พอใช้", average: "ปานกลาง", poor: "ควรปรับปรุง",
  entry: "ระดับเริ่มต้น", junior: "จูเนียร์", mid: "ระดับกลาง", senior: "ซีเนียร์",
  pass: "ผ่าน", fail: "ไม่ผ่าน", yes: "ใช่", no: "ไม่ใช่",
  active: "ใช้งานอยู่", inactive: "ไม่ได้ใช้งาน", closed: "ปิดแล้ว", open: "เปิดอยู่", pending: "รอดำเนินการ",
};

const MONEY_KEY = /(amount|balance|total|cost|charge|bill|fee|limit|payment|price|vat|tax|deposit|withdrawal|discount|interest|salary)/i;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/** Words iApp returns for "nothing here": the JSON null is fine, but it often sends the text "null" too. */
const EMPTY_WORDS = new Set(["null", "none", "n/a", "-"]);

/**
 * True for values that carry no information: null, empty text, the word "null", empty lists, and objects or
 * lists whose every entry is itself empty (a `reward` block of all nulls). `0` is a real value and is not empty.
 */
export function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "" || EMPTY_WORDS.has(value.trim().toLowerCase());
  if (Array.isArray(value)) return value.every(isEmpty);
  if (isRecord(value)) return Object.values(value).every(isEmpty);
  return false;
}

function isPlainValue(value: unknown): boolean {
  return !isRecord(value) && !Array.isArray(value);
}

export function formatPrimitive(value: unknown, key: string, locale: Locale): string {
  if (isEmpty(value) && isPlainValue(value)) return "—";
  // CV improvement rows name the section they are about with the field key (`skillsAndQualifications`).
  if (typeof value === "string" && normalizeFieldKey(key) === "section") return fieldLabel(value.trim(), locale);
  if (typeof value === "boolean") return locale === "th" ? (value ? "ใช่" : "ไม่ใช่") : value ? "Yes" : "No";
  if (locale === "th" && typeof value === "string") {
    const word = value.trim().toLowerCase();
    const translated = THAI_VALUES[normalizeFieldKey(key)]?.[word] ?? (GENERIC_LEVEL_KEY.test(key) ? GENERIC_THAI_VALUES[word] : undefined);
    if (translated) return translated;
  }
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


/**
 * The raw OCR text iApp returns for a document. It usually arrives as `{ "text": "..." }` (sometimes one entry per
 * page), so show the text itself rather than the JSON wrapper around it.
 */
export function rawOcrText(raw: unknown): string {
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) return raw.map(rawOcrText).filter(Boolean).join("\n\n");
  if (isRecord(raw)) {
    if (typeof raw.text === "string") return raw.text;
    if (Array.isArray(raw.text)) return rawOcrText(raw.text);
    if (Array.isArray(raw.pages)) return rawOcrText(raw.pages);
  }
  return JSON.stringify(raw, null, 2);
}
