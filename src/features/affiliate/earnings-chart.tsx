"use client";

import type { AffiliateDailyPoint } from "@/lib/api/affiliate";
import { useLocale } from "@/lib/i18n/locale-provider";
import { formatDay, formatNumber } from "./format";
import styles from "./affiliate-page.module.css";

/**
 * Commission per day as stacked bars, top-ups under usage. Bars are drawn with plain boxes so the chart needs no library
 * and follows the page's colours. A day with nothing earned keeps its slot, which keeps the days evenly spaced.
 */
export function EarningsChart({ points }: { points: AffiliateDailyPoint[] }) {
  const { locale, t } = useLocale();
  const total = points.reduce((sum, point) => sum + point.topupBaht + point.usageBaht, 0);
  const peak = points.reduce((max, point) => Math.max(max, point.topupBaht + point.usageBaht), 0);
  const amount = `฿${formatNumber(total, locale)}`;

  if (points.length === 0 || total <= 0) {
    return <p className={styles.muted}>{t("affiliate.page.chartEmpty")}</p>;
  }

  const first = points[0];
  const middle = points[Math.floor(points.length / 2)];
  const last = points[points.length - 1];

  return (
    <div>
      <div className={styles.chartTotal}>
        <strong>{amount}</strong>
        <span className={styles.legend}>
          <span><i className={styles.dotTopup} aria-hidden="true" />{t("affiliate.page.legendTopup")}</span>
          <span><i className={styles.dotUsage} aria-hidden="true" />{t("affiliate.page.legendUsage")}</span>
        </span>
      </div>
      <div className={styles.chart} role="img" aria-label={t("affiliate.page.chartAria", { days: points.length, amount })}>
        {points.map((point) => {
          const sum = point.topupBaht + point.usageBaht;
          const height = peak > 0 ? (sum / peak) * 100 : 0;
          const usageShare = sum > 0 ? (point.usageBaht / sum) * 100 : 0;
          const label = t("affiliate.page.chartDay", {
            date: formatDay(point.date, locale),
            topup: formatNumber(point.topupBaht, locale),
            usage: formatNumber(point.usageBaht, locale),
          });
          return (
            <div key={point.date} className={styles.chartColumn} title={label}>
              <div className={styles.chartBar} style={{ height: `${Math.max(height, sum > 0 ? 3 : 0)}%` }}>
                {point.usageBaht > 0 ? <span className={styles.barUsage} style={{ height: `${usageShare}%` }} /> : null}
                {point.topupBaht > 0 ? <span className={styles.barTopup} style={{ height: `${100 - usageShare}%` }} /> : null}
              </div>
            </div>
          );
        })}
      </div>
      <div className={styles.chartAxis} aria-hidden="true">
        <span>{first ? formatDay(first.date, locale) : ""}</span>
        <span>{middle ? formatDay(middle.date, locale) : ""}</span>
        <span>{last ? formatDay(last.date, locale) : ""}</span>
      </div>
    </div>
  );
}
