/**
 * What a reference image is: a character, a product, a brand, a logo, or anything else.
 * The category is stored in the template's free-form `settings`, keyed by the image address, next to `inputImages`:
 *   settings.inputImages = ["https://…/bottle.png", "https://…/lemon.png"]
 *   settings.inputImageCategories = { "https://…/bottle.png": "product", "https://…/lemon.png": "other" }
 * An image without a category is shown as it was before, with no label.
 */
export type ReferenceCategory = "character" | "product" | "brand" | "logo" | "other";

export const referenceCategories: readonly ReferenceCategory[] = ["character", "product", "brand", "logo", "other"];

export const referenceCategoryCopyKeys = {
  character: "templates.attach.category.character",
  product: "templates.attach.category.product",
  brand: "templates.attach.category.brand",
  logo: "templates.attach.category.logo",
  other: "templates.attach.category.other",
} as const;

export function isReferenceCategory(value: unknown): value is ReferenceCategory {
  return typeof value === "string" && (referenceCategories as readonly string[]).includes(value);
}

/** The category set for one reference image address, if any. */
export function referenceCategoryOf(settings: Record<string, unknown> | undefined, address: string): ReferenceCategory | undefined {
  const map = settings?.inputImageCategories;
  if (!map || typeof map !== "object" || Array.isArray(map)) return undefined;
  const value = (map as Record<string, unknown>)[address];
  return isReferenceCategory(value) ? value : undefined;
}

/** Settings with the category of one image set, or cleared when `category` is undefined. Other settings are kept. */
export function withReferenceCategory(
  settings: Record<string, unknown> | undefined,
  address: string,
  category: ReferenceCategory | undefined,
): Record<string, unknown> {
  const current = settings?.inputImageCategories;
  const map: Record<string, unknown> = current && typeof current === "object" && !Array.isArray(current) ? { ...(current as Record<string, unknown>) } : {};
  if (category) map[address] = category;
  else delete map[address];
  const { inputImageCategories: _previous, ...rest } = settings ?? {};
  void _previous;
  return Object.keys(map).length > 0 ? { ...rest, inputImageCategories: map } : rest;
}

/** Settings whose categories only cover the addresses that are still attached. */
export function pruneReferenceCategories(settings: Record<string, unknown> | undefined, addresses: readonly string[]): Record<string, unknown> {
  const current = settings?.inputImageCategories;
  const { inputImageCategories: _previous, ...rest } = settings ?? {};
  void _previous;
  if (!current || typeof current !== "object" || Array.isArray(current)) return rest;
  const kept = Object.fromEntries(Object.entries(current as Record<string, unknown>).filter(([address, value]) => addresses.includes(address) && isReferenceCategory(value)));
  return Object.keys(kept).length > 0 ? { ...rest, inputImageCategories: kept } : rest;
}
