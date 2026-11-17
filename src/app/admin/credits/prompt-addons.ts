import { type PromptAddonEntry } from "./pricing.types";

export function promptAddonsJson(value: Record<string, Record<string, number>> | undefined) {
  return JSON.stringify(value ?? {}, null, 2);
}

export function parsePromptAddonsJson(value: string): Record<string, Record<string, number>> {
  if (!value.trim()) return {};
  const parsed: unknown = JSON.parse(value);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error("Prompt add-ons must be a JSON object");
  return parsed as Record<string, Record<string, number>>;
}

export function promptAddonEntries(value: string): PromptAddonEntry[] {
  const parsed = parsePromptAddonsJson(value);
  return Object.entries(parsed).map(([key, options]) => ({
    key,
    values:
      options && typeof options === "object" && !Array.isArray(options)
        ? Object.entries(options).map(([option, amount]) => ({
            option,
            amount: String(amount),
          }))
        : [],
  }));
}

export function promptAddonVariableCount(value: string) {
  try {
    return promptAddonEntries(value).length;
  } catch {
    return 0;
  }
}
