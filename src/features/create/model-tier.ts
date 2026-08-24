import type { GenerationModelOption } from "@/lib/api/generation-models";

export type ModelTier = "TOP" | "MID" | "TEST";

/**
 * Route priority is the source of truth for the admin-configured tier. The
 * index fallback keeps the labels useful while a newly seeded route is still
 * being returned without a priority value.
 */
export function modelTier(model: GenerationModelOption | undefined, index = 0): ModelTier {
  if (model?.priority !== undefined) {
    if (model.priority >= 120) return "TOP";
    if (model.priority >= 90) return "MID";
    return "TEST";
  }
  if (index === 0) return "TOP";
  if (index === 1) return "MID";
  return "TEST";
}

export function modelTierClass(tier: ModelTier): string {
  return tier === "TOP" ? "modelTierTop" : tier === "MID" ? "modelTierMid" : "modelTierTest";
}
