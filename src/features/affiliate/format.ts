import type { Locale } from "@/lib/i18n/locale-provider";

export function formatDate(value: string, locale: Locale): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-US", { dateStyle: "medium" }).format(date);
}

/** A day written as YYYY-MM-DD (a Bangkok day from the server), shown as "9 Nov" without shifting it by the viewer's time zone. */
export function formatDay(value: string, locale: Locale): string {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-US", { day: "numeric", month: "short", timeZone: "UTC" }).format(Date.UTC(year, month - 1, day));
}

export function formatNumber(value: number, locale: Locale, maximumFractionDigits = 2): string {
  return new Intl.NumberFormat(locale === "th" ? "th-TH" : "en-US", { maximumFractionDigits }).format(value);
}

/** One id per attempt at an exchange, so pressing the button twice cannot exchange twice. */
export function newRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** Credits for an amount of baht, rounded down the way the server does it. */
export function creditsFor(baht: number, creditsPerBaht: number): number {
  return Math.floor(baht * creditsPerBaht * 10000 + 1e-9) / 10000;
}
