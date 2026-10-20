import type { UsageDashboard } from "@/lib/api/usage";
export type Activity = UsageDashboard["recentActivity"]["items"][number];
export const number = (value: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
export function calculateVat(amountThb: number, vatPercent: number) {
  const subtotalThb = Math.round((amountThb + Number.EPSILON) * 100) / 100;
  const vatAmountThb = Math.round((subtotalThb * vatPercent / 100 + Number.EPSILON) * 100) / 100;
  return { subtotalThb, vatAmountThb, totalThb: Math.round((subtotalThb + vatAmountThb + Number.EPSILON) * 100) / 100 };
}
export const signed = (value: number) => `${value > 0 ? "+" : ""}${number(value)}`;
export type UsageLocale = "th" | "en";
const intlLocale = (locale: UsageLocale) => (locale === "en" ? "en-GB" : "th-TH-u-ca-gregory");
export const dateLabel = (value: string, locale: UsageLocale = "th") => new Intl.DateTimeFormat(intlLocale(locale), { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }).format(new Date(value));
export const monthLabel = (value: string, locale: UsageLocale = "th") => new Intl.DateTimeFormat(intlLocale(locale), { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(value));
/** Short month names for the month picker, in calendar order. */
export const shortMonthNames: Record<UsageLocale, readonly string[]> = {
  th: ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
};
// Labels used by pure helpers and CSV exports. Both languages sit here, next to the code that
// needs them, so these helpers stay free of imports and the plain-Node usage checks can load them.
const labels = {
  th: {
    stripe: "เติมเครดิตผ่าน Stripe", admin: "ปรับเครดิตโดยผู้ดูแล", usage: "หักเครดิตสร้างผลงาน", refund: "คืนเครดิต", purchase: "เติมเครดิต", grant: "ได้รับเครดิต",
    expiry: "เครดิตหมดอายุ", adjustment: "ปรับยอดเครดิต", fallback: "รายการปรับยอดเครดิต", grantShort: "เครดิตที่ได้รับ",
    csvDate: "วันที่", csvEntry: "รายการ", csvCredits: "เครดิต", csvBalanceAfter: "ยอดหลังรายการ", csvEntryId: "รหัสรายการ", csvReferenceId: "รหัสอ้างอิง",
    csvAmountInOut: "เครดิตเข้า–ออก", csvBalanceAfterEntry: "คงเหลือหลังรายการ", csvSubtotal: "ราคาก่อน VAT", csvVat: "VAT", csvTotal: "ยอดชำระรวม",
  },
  en: {
    stripe: "Top-up via Stripe", admin: "Credit adjusted by an administrator", usage: "Credits spent on a creation", refund: "Credit refund", purchase: "Top-up", grant: "Credits received",
    expiry: "Credits expired", adjustment: "Credit adjustment", fallback: "Credit adjustment entry", grantShort: "Credits received",
    csvDate: "Date", csvEntry: "Entry", csvCredits: "Credits", csvBalanceAfter: "Balance after entry", csvEntryId: "Entry ID", csvReferenceId: "Reference ID",
    csvAmountInOut: "Credits in / out", csvBalanceAfterEntry: "Balance after entry", csvSubtotal: "Price before VAT", csvVat: "VAT", csvTotal: "Total paid",
  },
} as const;
export type UsageLabelKey = keyof typeof labels.th;
export const usageLabel = (locale: UsageLocale, key: UsageLabelKey): string => labels[locale][key];
/** The last `count` calendar months, newest first, as { value: "YYYY-MM", label }. */
export function recentMonths(count = 12, now = new Date(), locale: UsageLocale = "th") {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - index, 1));
    return { value: `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`, label: monthLabel(date.toISOString(), locale) };
  });
}
export function creditLabel(item: Activity, locale: UsageLocale = "th") {
  const text = labels[locale];
  if (item.referenceType === "stripe_checkout") return text.stripe;
  if (item.referenceType === "admin_adjustment") return text.admin;
  const byType: Record<string, string> = { usage: text.usage, refund: text.refund, purchase: text.purchase, grant: text.grant, expiry: text.expiry, adjustment: text.adjustment, admin_adjustment: text.admin };
  return byType[item.transactionType] ?? text.fallback;
}
export function activityLabel(item: Activity, locale: UsageLocale = "th") {
  const text = labels[locale];
  if (item.referenceType === "stripe_checkout") return text.stripe;
  if (item.transactionType === "admin_adjustment" || item.referenceType === "admin_adjustment") return text.admin;
  if (item.transactionType === "purchase") return text.purchase;
  if (item.transactionType === "refund") return text.refund;
  if (item.transactionType === "grant") return text.grantShort;
  if (item.artwork) return item.artwork.name;
  return item.title.replace(/ Generation$/, "");
}
export function visibleTrend(dashboard: UsageDashboard) {
  const end = dashboard.period.isCurrent ? dashboard.generatedAt.slice(0, 10) : dashboard.period.endAt.slice(0, 10);
  return dashboard.trend.points.filter(point => point.date.slice(0, 10) <= end).slice(-7);
}
export function chartBounds(values: number[]) {
  const max = Math.max(0, ...values), min = Math.min(0, ...values);
  const step = Math.max(1, 10 ** Math.floor(Math.log10(Math.max(max - min, 1))) / 2);
  return { max: Math.max(step * 3, Math.ceil(max / step) * step), min: Math.floor(min / step) * step };
}
export function csvCell(value: string | number) {
  const safe = typeof value === "string" && /^[=+\-@\t\r]/.test(value) ? `'${value}` : String(value);
  return `"${safe.replaceAll('"', '""')}"`;
}
export function activityCsv(items: Activity[], locale: UsageLocale = "th") {
  const text = labels[locale];
  return "\uFEFF" + [[text.csvDate, text.csvEntry, text.csvCredits, text.csvBalanceAfter, text.csvEntryId], ...items.map(item => [item.createdAt, activityLabel(item, locale), item.amount, item.balanceAfter, item.id])].map(row => row.map(csvCell).join(",")).join("\r\n");
}
