"use client";

import { useEffect, useState, type ReactNode } from "react";
import { LoaderCircle, LockKeyhole } from "lucide-react";
import { quoteDirectVideoGeneration, type DirectVideoQuoteInput } from "@/lib/api/video-generations";
import { useLocale } from "@/lib/i18n/locale-provider";
import { InfoTooltip } from "./info-tooltip";
import styles from "../video-generation-page.module.css";

export function useVideoCreditEstimate(input: DirectVideoQuoteInput | null) {
  const [creditCost, setCreditCost] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputKey = JSON.stringify(input);

  useEffect(() => {
    let active = true;
    const request = inputKey === "null" ? null : JSON.parse(inputKey) as DirectVideoQuoteInput;
    const loadingTimeoutId = window.setTimeout(() => {
      if (active && request?.model) setLoading(true);
    }, 0);
    const quoteTimeoutId = window.setTimeout(() => {
      if (!request?.model) {
        setCreditCost(null);
        setError(null);
        setLoading(false);
        return;
      }
      setError(null);
      void quoteDirectVideoGeneration(request)
        .then((quote) => {
          if (!active) return;
          const value = Number(quote.creditCost);
          if (!Number.isFinite(value)) throw new Error("Pricing unavailable");
          setCreditCost(value);
        })
        .catch((reason: unknown) => {
          if (!active) return;
          setCreditCost(null);
          setError(reason instanceof Error ? reason.message : "Pricing unavailable");
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 450);
    return () => {
      active = false;
      window.clearTimeout(loadingTimeoutId);
      window.clearTimeout(quoteTimeoutId);
    };
  }, [inputKey]);

  return { creditCost, loading, error, hasInput: inputKey !== "null" };
}

export function VideoCreditEstimate({ featureLabel, duration, estimate, emptyMessage, emptyLoading = false, compactLabel = false, children }: { featureLabel: string; duration?: unknown; estimate: ReturnType<typeof useVideoCreditEstimate>; emptyMessage?: string; emptyLoading?: boolean; compactLabel?: boolean; children?: ReactNode }) {
  const { locale, t } = useLocale();
  const noInputMessage = emptyMessage ?? t("create.video.common.pricingUnavailable");
  const value = !estimate.hasInput
    ? emptyLoading
      ? <span className={styles.creditCalculating}><LoaderCircle size={12} className={styles.creditSpinner} />{noInputMessage}</span>
      : noInputMessage
    : estimate.loading
    ? <span className={styles.creditCalculating}><LoaderCircle size={12} className={styles.creditSpinner} />{t("create.video.common.recalculatingPrice")}</span>
    : estimate.creditCost === null
      ? t("create.video.common.pricingUnavailable")
      : t("create.video.common.creditsValue", { cost: estimate.creditCost.toLocaleString(locale === "th" ? "th-TH" : "en-US", { maximumFractionDigits: 2 }) });
  const quantityLabel = duration !== undefined && duration !== "" ? t("create.video.common.creditsDuration", { duration: String(duration) }) : compactLabel ? t("create.video.common.creditsVideo") : t("create.video.common.creditsFeature", { feature: featureLabel });
  return <div className={styles.estimateBlock}>
    <div className={styles.estimate} title={estimate.error ?? undefined}>
      <div>{t("create.video.common.estimatedCredits")} <InfoTooltip content={t("create.video.common.info.estimatedCredits")} size={11} /></div>
      <span>{quantityLabel}<strong>{value}</strong></span>
    </div>
    {children}
    <p className={styles.privateNote}><LockKeyhole size={12} /> {t("create.settings.privateSecure")}</p>
  </div>;
}
