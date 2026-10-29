import type { AdminCreativeTemplate } from "@/lib/api/templates";

export type TemplateMode = "create" | "edit" | "motion";

/** Which mode of the public Templates page lists a template, worked out the same way the public page does it. */
export function modeOfTemplate(template: Pick<AdminCreativeTemplate, "settings" | "targetPath">): TemplateMode {
  const feature = typeof template.settings?.feature === "string" ? template.settings.feature : "";
  const hint = `${feature} ${template.targetPath}`.toLowerCase();
  if (/(motion|swap)/.test(hint)) return "motion";
  if (/(extend|edit|upscale|reframe|lipsync|remove-background)/.test(hint)) return "edit";
  return "create";
}

/** How many templates each admin menu shows: every template, the Create Video ones and the Motion Control ones. */
export function templateModeCounts(templates: Array<Pick<AdminCreativeTemplate, "settings" | "targetPath">>) {
  return {
    all: templates.length,
    create: templates.filter((template) => modeOfTemplate(template) === "create").length,
    motion: templates.filter((template) => modeOfTemplate(template) === "motion").length,
  };
}
