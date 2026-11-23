import { type CreativeTemplate as Template } from "@/lib/api/templates";
import { useStudioCopy } from "@/lib/i18n/studio-copy";

type CopyFn = ReturnType<typeof useStudioCopy>["c"];

type Fact ={ key: "model" | "ratio" | "resolution" | "count" | "duration" | "file"; label: string; value: string };

/** The preset values worth showing for a template. */
export function presetFacts(t: Template, c: CopyFn): Fact[] {
  const settings = t.settings ?? {};
  const rows: Array<[Fact["key"], string, unknown]> = [
    ["model", c("templates.preview.factModel"), settings.model ?? settings.modelId],
    ["ratio", c("templates.preview.factRatio"), settings.ratio ?? settings.aspectRatio],
    ["resolution", c("templates.preview.factResolution"), settings.resolution],
    ["count", c("templates.preview.factCount"), settings.count],
    [
      "duration",
      c("templates.preview.factDuration"),
      typeof settings.duration === "number" ? c("templates.preview.seconds", { value: settings.duration }) : undefined,
    ],
    ["file", c("templates.preview.factFile"), settings.outputFormat],
  ];
  return rows.flatMap(([key, label, value]) =>
    typeof value === "string" || typeof value === "number" ? [{ key, label, value: String(value) }] : [],
  );
}
