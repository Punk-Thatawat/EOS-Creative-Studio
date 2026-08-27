"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Info, LoaderCircle, LockKeyhole } from "lucide-react";
import { quoteDirectVideoGeneration, type DirectVideoQuoteInput } from "@/lib/api/video-generations";
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

export function VideoCreditEstimate({ featureLabel, duration, estimate, emptyMessage = "Pricing unavailable", emptyLoading = false, compactLabel = false, children }: { featureLabel: string; duration?: unknown; estimate: ReturnType<typeof useVideoCreditEstimate>; emptyMessage?: string; emptyLoading?: boolean; compactLabel?: boolean; children?: ReactNode }) {
  const value = !estimate.hasInput
    ? emptyLoading
      ? <span className={styles.creditCalculating}><LoaderCircle size={12} className={styles.creditSpinner} />{emptyMessage}</span>
      : emptyMessage
    : estimate.loading
    ? <span className={styles.creditCalculating}><LoaderCircle size={12} className={styles.creditSpinner} />Recalculating price…</span>
    : estimate.creditCost === null
      ? "Pricing unavailable"
      : `= ${estimate.creditCost.toLocaleString(undefined, { maximumFractionDigits: 2 })} Credits`;
  const quantityLabel = duration !== undefined && duration !== "" ? `1 video × ${duration} sec` : compactLabel ? "1 video" : `1 video · ${featureLabel}`;
  return <div className={styles.estimateBlock}>
    <div className={styles.estimate} title={estimate.error ?? undefined}>
      <div>ESTIMATED CREDITS <Info size={11} /></div>
      <span>{quantityLabel}<strong>{value}</strong></span>
    </div>
    {children}
    <p className={styles.privateNote}><LockKeyhole size={12} /> Your generation is private and secure</p>
  </div>;
}
