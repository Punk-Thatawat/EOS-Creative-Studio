"use client";

import type { AffiliateDailyPoint } from "@/lib/api/affiliate";
import { useLocale } from "@/lib/i18n/locale-provider";
import { EmptyChartArt } from "./affiliate-art";
import { formatDay, formatNumber } from "./format";
import styles from "./affiliate-page.module.css";

/**
 * Commission per day as stacked bars: top-ups at the bottom, then usage, then the step bonus. Bars are drawn with plain boxes so the chart needs no library
 * and follows the page's colours. A day with nothing earned keeps its slot, which keeps the days evenly spaced.
 */
export function EarningsChart({ points }: { points: AffiliateDailyPoint[] }) {
  const { locale, t } = useLocale();
  const sumOf = (point: AffiliateDailyPoint) => point.topupBaht + point.usageBaht + (point.bonusBaht ?? 0);
  const total = points.reduce((sum, point) => sum + sumOf(point), 0);
  const peak = points.reduce((max, point) => Math.max(max, sumOf(point)), 0);
  // A kind that earned nothing in the window is left out of the legend.
  const hasUsage = points.some((point) => point.usageBaht > 0);
  const hasBonus = points.some((point) => (point.bonusBaht ?? 0) > 0);
  const amount = `฿${formatNumber(total, locale)}`;

  if (points.length === 0 || total <= 0) {
    return (
      <div className={styles.chartEmpty}>
        <EmptyChartArt className={styles.chartEmptyArt} />
        <strong>{t("affiliate.page.noData")}</strong>
      </div>
    );
  }

  const first = points[0];
  const middle = points[Math.floor(points.length / 2)];
  const last = points[points.length - 1];

  return (
    <div className={styles.chartRoot}>
      <div className={styles.chartTotal}>
        <strong>{amount}</strong>
        <span className={styles.legend}>
          <span><i className={styles.dotTopup} aria-hidden="true" />{t("affiliate.page.legendTopup")}</span>
          {hasUsage ? <span><i className={styles.dotUsage} aria-hidden="true" />{t("affiliate.page.legendUsage")}</span> : null}
          {hasBonus ? <span><i className={styles.dotBonus} aria-hidden="true" />{t("affiliate.page.legendBonus")}</span> : null}
        </span>
      </div>
      <div className={styles.chart} role="img" aria-label={t("affiliate.page.chartAria", { days: points.length, amount })}>
        {points.map((point) => {
          const bonusBaht = point.bonusBaht ?? 0;
          const sum = sumOf(point);
          const height = peak > 0 ? (sum / peak) * 100 : 0;
          const usageShare = sum > 0 ? (point.usageBaht / sum) * 100 : 0;
          const bonusShare = sum > 0 ? (bonusBaht / sum) * 100 : 0;
          const label = t(bonusBaht > 0 ? "affiliate.page.chartDayBonus" : "affiliate.page.chartDay", {
            date: formatDay(point.date, locale),
            topup: formatNumber(point.topupBaht, locale),
            usage: formatNumber(point.usageBaht, locale),
            bonus: formatNumber(bonusBaht, locale),
          });
          return (
            <div key={point.date} className={styles.chartColumn} title={label}>
              <div className={styles.chartBar} style={{ height: `${Math.max(height, sum > 0 ? 3 : 0)}%` }}>
                {bonusBaht > 0 ? <span className={styles.barBonus} style={{ height: `${bonusShare}%` }} /> : null}
                {point.usageBaht > 0 ? <span className={styles.barUsage} style={{ height: `${usageShare}%` }} /> : null}
                {point.topupBaht > 0 ? <span className={styles.barTopup} style={{ height: `${100 - usageShare - bonusShare}%` }} /> : null}
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
