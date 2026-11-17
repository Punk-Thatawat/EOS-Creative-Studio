import { type CreditPricingPreview } from "@/lib/api/credit-pricing";
import { type RuleDraft } from "./pricing.types";
import { MAX_TARGET_MARKUP_RATIO } from "./pricing.constants";

export function formatMetric(value: number | undefined, maximumFractionDigits = 2) {
  if (value === undefined || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("th-TH", { maximumFractionDigits }).format(
    value,
  );
}

export function previewWithDraft(
  preview: CreditPricingPreview | undefined,
  draft: RuleDraft,
  creditValue: number,
  roundingDecimals: number,
) {
  if (
    !preview ||
    preview.status !== "ready" ||
    preview.providerCostThb === undefined ||
    creditValue <= 0
  )
    return preview;
  const markup = Math.min(
    Math.max((Number(draft.targetMargin) || 0) / 100, 0),
    MAX_TARGET_MARKUP_RATIO,
  );
  const fixedCostThb = Math.max(Number(draft.fixedCostThb) || 0, 0);
  const minimumCreditCost = Math.max(Number(draft.minimumCreditCost) || 1, 1);
  const sellingPriceBeforeRound =
    (preview.providerCostThb + fixedCostThb) * (1 + markup);
  const factor = 10 ** roundingDecimals;
  const calculatedCreditCost =
    Math.ceil(
      (sellingPriceBeforeRound / creditValue - Number.EPSILON) * factor,
    ) / factor;
  const creditCost = Math.max(minimumCreditCost, calculatedCreditCost);
  const sellingPriceThb = creditCost * creditValue;
  const costCredits = preview.providerCostThb / creditValue;
  return {
    ...preview,
    creditCost,
    sellingPriceThb,
    costCredits,
    profitCredits: creditCost - costCredits,
    profitThb: sellingPriceThb - preview.providerCostThb,
  };
}
