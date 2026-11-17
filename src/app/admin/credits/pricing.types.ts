import { type GenerationModelOption } from "@/lib/api/generation-models";

export type PricingRow = {
  feature: string;
  featureKey: string;
  model: string;
  provider: string;
  displayName: string;
  unit: string;
  note: string;
  capabilities?: GenerationModelOption["capabilities"];
};

export type RuleDraft = {
  targetMargin: string;
  fixedCostThb: string;
  minimumCreditCost: string;
  promptAddonsJson: string;
  dirty?: boolean;
};

export type PromptAddonEntry = {
  key: string;
  values: Array<{ option: string; amount: string }>;
};

export type PricingCategoryFilter = "all" | "image" | "video" | "audio" | "document" | "presenter";

export type PricingProperty = {
  type?: string;
  title?: string;
  description?: string;
  default?: unknown;
  enum?: unknown[];
  minimum?: number;
  maximum?: number;
  format?: string;
  readOnly?: boolean;
  deprecated?: boolean;
  [key: string]: unknown;
};
