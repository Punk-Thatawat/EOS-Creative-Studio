"use client";

import { useEffect, useMemo, useState } from "react";
import { quoteImageGeneration, type ImageCreditQuoteInput } from "@/lib/api/generations";

export function useImageCreditEstimate(input: ImageCreditQuoteInput | null) {
  const [creditCost, setCreditCost] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestKey = input ? JSON.stringify(input) : "";
  const stableInput = useMemo(() => requestKey ? JSON.parse(requestKey) as ImageCreditQuoteInput : null, [requestKey]);

  useEffect(() => {
    let cancelled = false;
    if (!stableInput || !requestKey) return;

    const timeoutId = window.setTimeout(() => {
      setIsLoading(true);
      setError(null);
      void quoteImageGeneration(stableInput)
        .then((quote) => {
          if (cancelled) return;
          const nextCost = typeof quote.creditCost === "number" && Number.isFinite(quote.creditCost) ? quote.creditCost : null;
          setCreditCost(nextCost);
          if (nextCost === null) setError("Pricing unavailable");
        })
        .catch((reason: unknown) => {
          if (cancelled) return;
          setCreditCost(null);
          setError(reason instanceof Error ? reason.message : "Pricing unavailable");
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [requestKey, stableInput]);

  return {
    creditCost: stableInput ? creditCost : null,
    isLoading: stableInput ? isLoading : false,
    error: stableInput ? error : null,
  };
}
