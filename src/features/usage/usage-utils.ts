import type { UsageDashboard } from "@/lib/api/usage";
export type Activity = UsageDashboard["recentActivity"]["items"][number];
export const number = (value: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
export const signed = (value: number) => `${value > 0 ? "+" : ""}${number(value)}`;
export const dateLabel = (value: string) => new Intl.DateTimeFormat("th-TH-u-ca-gregory", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }).format(new Date(value));
export const monthLabel = (value: string) => new Intl.DateTimeFormat("th-TH-u-ca-gregory", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(value));
export function creditLabel(item: Activity) {
  if (item.referenceType === "stripe_checkout") return "เติมเครดิตผ่าน Stripe";
  if (item.referenceType === "admin_adjustment") return "ปรับเครดิตโดยผู้ดูแล";
  const labels: Record<string, string> = { usage: "หักเครดิตสร้างผลงาน", refund: "คืนเครดิต", purchase: "เติมเครดิต", grant: "ได้รับเครดิต", expiry: "เครดิตหมดอายุ", adjustment: "ปรับยอดเครดิต", admin_adjustment: "ปรับเครดิตโดยผู้ดูแล" };
  return labels[item.transactionType] ?? "รายการปรับยอดเครดิต";
}
export function activityLabel(item: Activity) {
  if (item.referenceType === "stripe_checkout") return "เติมเครดิตผ่าน Stripe";
  if (item.transactionType === "admin_adjustment" || item.referenceType === "admin_adjustment") return "ปรับเครดิตโดยผู้ดูแล";
  if (item.transactionType === "purchase") return "เติมเครดิต";
  if (item.transactionType === "refund") return "คืนเครดิต";
  if (item.transactionType === "grant") return "เครดิตที่ได้รับ";
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
export function activityCsv(items: Activity[]) {
  return "\uFEFF" + [["วันที่", "รายการ", "เครดิต", "ยอดหลังรายการ", "รหัสรายการ"], ...items.map(item => [item.createdAt, activityLabel(item), item.amount, item.balanceAfter, item.id])].map(row => row.map(csvCell).join(",")).join("\r\n");
}
