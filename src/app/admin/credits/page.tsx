"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Calculator,
  CheckCircle2,
  Coins,
  DollarSign,
  Info,
  LoaderCircle,
  Percent,
  Plus,
  RefreshCw,
  Save,
  Settings2,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { SidebarNavigation } from "@/components/app-shell/navigation";
import { StudioHeader } from "@/components/app-shell/studio-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SidebarProvider } from "@/components/ui/sidebar";
import {
  listAdminModelRoutesOverview,
  type AdminModelRoutesOverview,
  type GenerationModelOption,
} from "@/lib/api/generation-models";
import {
  getAdminAudioSettings,
  type AdminAudioSettings,
} from "@/lib/api/audio";
import {
  listAdminCreditPricingRules,
  getAdminSignupCreditGrant,
  previewAdminCreditPricingRules,
  updateAdminSignupCreditGrant,
  upsertAdminCreditPricingDefaults,
  upsertAdminCreditPricingRule,
  type CreditPricingPreview,
  type CreditPricingRule,
  type CreditPricingSettings,
  type SignupCreditGrantSettings,
} from "@/lib/api/credit-pricing";

type PricingRow = {
  feature: string;
  featureKey: string;
  model: string;
  provider: string;
  displayName: string;
  unit: string;
  note: string;
  capabilities?: GenerationModelOption["capabilities"];
};

type RuleDraft = {
  targetMargin: string;
  fixedCostThb: string;
  minimumCreditCost: string;
  promptAddonsJson: string;
  dirty?: boolean;
};

type PromptAddonEntry = {
  key: string;
  values: Array<{ option: string; amount: string }>;
};

const featureLabels: Record<string, string> = {
  "text-to-image": "Text to Image",
  "image-to-image": "Image to Image",
  "image-to-video": "Image to Video",
  "video-to-sfx": "Video to SFX",
  "video-to-music": "Video to Music",
  "text-to-video": "Text to Video",
  "people-video": "People Video",
  "motion-transfer": "Motion Transfer",
  lipsync: "Lip Sync",
  "extend-video": "Extend Video",
  video: "Video",
  "style-transfer": "Style Transfer",
  "background-removal": "AI Background",
  upscale: "Upscale",
  "extend-image": "Extend Image",
  audio: "Audio Text to Speech",
  "audio-music": "Audio Background Music",
};

const featureOrder = [
  "text-to-image",
  "image-to-image",
  "image-to-video",
  "video-to-sfx",
  "video-to-music",
  "text-to-video",
  "people-video",
  "motion-transfer",
  "lipsync",
  "extend-video",
  "video",
  "style-transfer",
  "background-removal",
  "upscale",
  "extend-image",
  "audio",
  "audio-music",
];

const videoFeatureKeys = new Set([
  "video",
  "image-to-video",
  "video-to-sfx",
  "video-to-music",
  "text-to-video",
  "people-video",
  "motion-transfer",
  "lipsync",
  "extend-video",
]);
type PricingCategoryFilter = "all" | "image" | "video" | "audio";

const audioFeatureKeys = new Set(["audio", "audio-music"]);

const fallbackModelRows: PricingRow[] = [
  {
    feature: "Text to Image",
    featureKey: "text-to-image",
    model: "wavespeed-ai/z-image/turbo",
    provider: "wavespeed",
    displayName: "Z-Image Turbo",
    unit: "Per image",
    note: "Live quote from provider",
  },
  {
    feature: "Image to Image",
    featureKey: "image-to-image",
    model: "wavespeed-ai/z-image-turbo/image-to-image",
    provider: "wavespeed",
    displayName: "Z-Image Turbo",
    unit: "Per image",
    note: "Live quote from provider",
  },
  {
    feature: "AI Background",
    featureKey: "background-removal",
    model: "bria/remove-background",
    provider: "bria",
    displayName: "BRIA Remove Background",
    unit: "Per image",
    note: "Fallback until provider quote is available",
  },
  {
    feature: "Extend Image",
    featureKey: "extend-image",
    model: "bria/expand",
    provider: "bria",
    displayName: "BRIA Expand",
    unit: "Per image",
    note: "Fallback until provider quote is available",
  },
];

function rowKey(row: PricingRow) {
  return `${row.provider}:${row.model}:${row.featureKey}`;
}

function modelRowsFromOverview(
  overview: AdminModelRoutesOverview,
): PricingRow[] {
  const rows: PricingRow[] = [];
  for (const featureKey of featureOrder) {
    if (audioFeatureKeys.has(featureKey)) continue;
    const routes = overview.routes[featureKey] ?? [];
    const visibleRoutes = routes.some((route) => route.enabled)
      ? routes.filter((route) => route.enabled)
      : routes;
    for (const route of visibleRoutes) {
      rows.push({
        feature: featureLabels[featureKey] ?? featureKey,
        featureKey,
        model: route.model,
        provider: route.provider,
        displayName: route.displayName,
        unit: videoFeatureKeys.has(featureKey) ? "Per video" : "Per image",
        note:
          route.provider === "wavespeed"
            ? "Live quote from provider"
            : "Fallback until provider quote is available",
        capabilities: route.capabilities,
      });
    }
  }
  return rows;
}

function audioModelName(model: string): string {
  return model === "eleven_multilingual_v2"
    ? "Eleven Multilingual v2"
    : model === "eleven_flash_v2_5"
      ? "Eleven Flash v2.5"
      : model === "eleven_turbo_v2_5"
        ? "Eleven Turbo v2.5"
        : model === "eleven_v3"
          ? "Eleven v3"
          : model === "music_v1"
            ? "ElevenLabs Music v1"
            : model === "music_v2"
              ? "ElevenLabs Music v2"
              : model;
}

function audioPricingRows(settings: AdminAudioSettings): PricingRow[] {
  const rows: PricingRow[] = [];
  const textToSpeech = settings.featureProfiles.textToSpeech;
  const speechModelIds = new Set([
    ...Object.keys(textToSpeech.models),
    textToSpeech.modelId,
  ]);
  speechModelIds.forEach((model) => {
    if (!model || model === "internal") return;
    rows.push({
      feature: featureLabels.audio,
      featureKey: "audio",
      model,
      provider: "elevenlabs",
      displayName: audioModelName(model),
      unit: "Per scene",
      note: "ElevenLabs API pricing by character",
    });
  });
  const musicModelIds = new Set(
    settings.backgroundMusicPresets
      .filter((preset) => preset.isActive)
      .map((preset) => preset.musicModelId),
  );
  if (!musicModelIds.size) musicModelIds.add("music_v1");
  musicModelIds.forEach((model) => {
    rows.push({
      feature: featureLabels["audio-music"],
      featureKey: "audio-music",
      model,
      provider: "elevenlabs",
      displayName: audioModelName(model),
      unit: "Per background track",
      note: "Eleven Music API pricing by minute",
    });
  });
  return rows;
}

function NumberField({
  label,
  value,
  suffix,
  onChange,
  help,
  readOnly = false,
}: {
  label: string;
  value: string;
  suffix: string;
  onChange: (value: string) => void;
  help?: string;
  readOnly?: boolean;
}) {
  const autoRate = label === "USD / THB rate";
  const locked = readOnly || autoRate;
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
        {autoRate ? "USD / THB rate (auto)" : label}
        {help ? <Info size={12} aria-label={help} /> : null}
      </span>
      <span className="relative block">
        <input
          type="number"
          min="0"
          value={value}
          readOnly={locked}
          onChange={(event) => onChange(event.target.value)}
          className={`h-11 w-full rounded-xl border border-border px-3 pr-16 text-sm font-semibold outline-none transition focus:border-primary focus:ring-3 focus:ring-primary/10 ${locked ? "bg-[#f2ece7] text-muted-foreground" : "bg-[#fcfaf8]"}`}
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
          {suffix}
        </span>
      </span>
    </label>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: typeof Coins;
  label: string;
  value: string;
  detail: string;
  tone: "orange" | "green" | "pink";
}) {
  const toneClass = {
    orange: "bg-[#fff0e9] text-[#c85427]",
    green: "bg-[#e3f3e9] text-[#347454]",
    pink: "bg-[#f9e5eb] text-[#ae5572]",
  }[tone];
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-xl ${toneClass}`}
        >
          <Icon size={17} />
        </span>
        <span className="h-2 w-2 rounded-full bg-[#4c9b72]" />
      </div>
      <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </Card>
  );
}

function formatMetric(value: number | undefined, maximumFractionDigits = 2) {
  if (value === undefined || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("th-TH", { maximumFractionDigits }).format(
    value,
  );
}

function previewWithDraft(
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
  const margin = Math.min(
    Math.max((Number(draft.targetMargin) || 0) / 100, 0),
    0.99,
  );
  const fixedCostThb = Math.max(Number(draft.fixedCostThb) || 0, 0);
  const minimumCreditCost = Math.max(Number(draft.minimumCreditCost) || 1, 1);
  const sellingPriceBeforeRound =
    (preview.providerCostThb + fixedCostThb) / Math.max(1 - margin, 0.01);
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

type PricingProperty = {
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

const pricingParameterPattern =
  /(count|num[_-]?images?|batch|size|resolution|aspect|quality|duration|seconds?|frames?|fps|length|steps|audio|video|output[_-]?type)/i;
const nonPricingParameters = new Set([
  "prompt",
  "text_prompt",
  "textPrompt",
  "positive_prompt",
  "positivePrompt",
  "instruction",
  "image",
  "image_url",
  "imageUrl",
  "input_image",
  "inputImage",
  "source",
  "source_image",
  "sourceImage",
  "images",
  "reference_images",
  "referenceImages",
  "references",
  "input_images",
  "inputImages",
  "style_image",
  "styleImage",
  "negative_prompt",
  "negativePrompt",
  "seed",
  "mask",
  "mask_image",
  "maskImage",
]);

function pricingLabel(name: string, property: PricingProperty) {
  if (property.title?.trim()) return property.title.trim();
  return name
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function isPricingProperty(name: string, property: PricingProperty) {
  return (
    property.readOnly !== true &&
    property.deprecated !== true &&
    !nonPricingParameters.has(name) &&
    pricingParameterPattern.test(name)
  );
}

function pricingProperties(row: PricingRow): Array<[string, PricingProperty]> {
  const properties =
    row.capabilities?.apiSchema?.request_schema?.properties ?? {};
  const fromSchema = Object.entries(properties).filter(([name, property]) =>
    isPricingProperty(name, property as PricingProperty),
  ) as Array<[string, PricingProperty]>;
  if (fromSchema.length > 0) return fromSchema.slice(0, 8);

  const capabilities = row.capabilities;
  if (!capabilities) return [];
  const fields = new Map<string, PricingProperty>();
  const add = (name: string | undefined, property: PricingProperty) => {
    if (name && capabilities.parameters.includes(name))
      fields.set(name, property);
  };
  add(capabilities.sizeParameter, {
    title: "Image size",
    type: "string",
    enum: capabilities.supportedSizes,
  });
  add(capabilities.resolutionParameter, {
    title: "Resolution",
    type: "string",
    enum: capabilities.supportedResolutions,
  });
  add(capabilities.targetResolutionParameter, {
    title: "Target resolution",
    type: "string",
    enum: capabilities.supportedResolutions,
  });
  add(capabilities.qualityParameter, {
    title: "Quality",
    type: "string",
    enum: capabilities.qualityValues,
  });
  add(capabilities.countParameter, {
    title: "Images per generation",
    type: "integer",
    minimum: 1,
    maximum: 8,
  });
  return [...fields.entries()];
}

function defaultScenarioValues(row: PricingRow): Record<string, unknown> {
  return Object.fromEntries(
    pricingProperties(row).map(([name, property]) => {
      if (property.default !== undefined) return [name, property.default];
      if (Array.isArray(property.enum) && property.enum.length > 0) {
        const standardSize = property.enum.find(
          (value) =>
            String(value) === "1024*1024" || String(value) === "1024x1024",
        );
        return [name, standardSize ?? property.enum[0]];
      }
      return [name, undefined];
    }),
  );
}

function cleanScenarioValues(values: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(values).filter(
      ([, value]) => value !== undefined && value !== "",
    ),
  );
}

function promptAddonsJson(value: Record<string, Record<string, number>> | undefined) {
  return JSON.stringify(value ?? {}, null, 2);
}

function parsePromptAddonsJson(value: string): Record<string, Record<string, number>> {
  if (!value.trim()) return {};
  const parsed: unknown = JSON.parse(value);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error("Prompt add-ons must be a JSON object");
  return parsed as Record<string, Record<string, number>>;
}

function promptAddonEntries(value: string): PromptAddonEntry[] {
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

function promptAddonVariableCount(value: string) {
  try {
    return promptAddonEntries(value).length;
  } catch {
    return 0;
  }
}

function PromptAddonsDialog({
  row,
  value,
  onApply,
  onClose,
}: {
  row: PricingRow;
  value: string;
  onApply: (value: string) => void;
  onClose: () => void;
}) {
  const parsedInitially = useMemo(() => {
    try {
      return { entries: promptAddonEntries(value), error: "" };
    } catch (reason) {
      return {
        entries: [],
        error:
          reason instanceof Error
            ? reason.message
            : "Invalid prompt add-ons configuration",
      };
    }
  }, [value]);
  const [entries, setEntries] = useState<PromptAddonEntry[]>(
    parsedInitially.entries,
  );
  const [error, setError] = useState(parsedInitially.error);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const updateEntry = (
    entryIndex: number,
    patch: Partial<PromptAddonEntry>,
  ) => {
    setEntries((current) =>
      current.map((entry, index) =>
        index === entryIndex ? { ...entry, ...patch } : entry,
      ),
    );
    setError("");
  };

  const updateOption = (
    entryIndex: number,
    optionIndex: number,
    patch: Partial<PromptAddonEntry["values"][number]>,
  ) => {
    setEntries((current) =>
      current.map((entry, index) =>
        index === entryIndex
          ? {
              ...entry,
              values: entry.values.map((option, currentOptionIndex) =>
                currentOptionIndex === optionIndex
                  ? { ...option, ...patch }
                  : option,
              ),
            }
          : entry,
      ),
    );
    setError("");
  };

  const addVariable = () => {
    setEntries((current) => [
      ...current,
      { key: "", values: [{ option: "", amount: "" }] },
    ]);
    setError("");
  };

  const addOption = (entryIndex: number) => {
    setEntries((current) =>
      current.map((entry, index) =>
        index === entryIndex
          ? {
              ...entry,
              values: [...entry.values, { option: "", amount: "" }],
            }
          : entry,
      ),
    );
  };

  const removeVariable = (entryIndex: number) => {
    setEntries((current) => current.filter((_, index) => index !== entryIndex));
  };

  const removeOption = (entryIndex: number, optionIndex: number) => {
    setEntries((current) =>
      current.map((entry, index) =>
        index === entryIndex
          ? {
              ...entry,
              values: entry.values.filter(
                (_, currentOptionIndex) => currentOptionIndex !== optionIndex,
              ),
            }
          : entry,
      ),
    );
  };

  const apply = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result: Record<string, Record<string, number>> = {};
    const variableKeys = new Set<string>();

    for (const [entryIndex, entry] of entries.entries()) {
      const key = entry.key.trim();
      if (!/^[a-z][a-z0-9_]{0,63}$/.test(key)) {
        setError(
          `Variable ${entryIndex + 1}: use snake_case, e.g. quality or aspect_ratio`,
        );
        return;
      }
      if (key === "output_format" || key === "outputFormat") {
        setError("output_format is controlled by the provider and cannot be an add-on");
        return;
      }
      if (variableKeys.has(key)) {
        setError(`Duplicate variable: ${key}`);
        return;
      }
      variableKeys.add(key);

      const options: Record<string, number> = {};
      for (const [optionIndex, item] of entry.values.entries()) {
        const option = item.option.trim();
        const amount = Number(item.amount);
        if (!option) {
          setError(`Variable ${key}: option ${optionIndex + 1} is required`);
          return;
        }
        if (Object.prototype.hasOwnProperty.call(options, option)) {
          setError(`Variable ${key}: duplicate option ${option}`);
          return;
        }
        if (!Number.isFinite(amount) || amount < 0) {
          setError(`Variable ${key}: amount for ${option} must be 0 or greater`);
          return;
        }
        options[option] = amount;
      }
      if (Object.keys(options).length === 0) {
        setError(`Variable ${key}: add at least one option`);
        return;
      }
      result[key] = options;
    }

    onApply(JSON.stringify(result, null, 2));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#201d1b]/45 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${rowKey(row)}-addons-title`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={apply}
        className="max-h-[calc(100vh-2rem)] w-full max-w-3xl overflow-y-auto rounded-3xl border border-border bg-[#fffaf7] p-4 shadow-2xl sm:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#fff0e9] text-primary">
              <Plus size={19} />
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary">
                Prompt price add-ons
              </p>
              <h3
                id={`${rowKey(row)}-addons-title`}
                className="mt-1 text-base font-bold"
              >
                {row.displayName} · Add pricing options
              </h3>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                เพิ่มค่าบริการตามค่าที่พิมพ์ใน prompt เฉพาะกรณีที่ model ไม่มี
                parameter นี้ใน schema
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-white hover:text-foreground"
            aria-label={`Close prompt add-ons for ${row.model}`}
          >
            <X size={16} />
          </button>
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-2xl border border-[#eaded6] bg-white p-3 text-[11px] leading-5 text-muted-foreground">
          <Info className="mt-0.5 shrink-0 text-primary" size={14} />
          <p>
            จำนวนเงินเป็น <strong className="text-foreground">THB / image</strong>
            . ถ้า model รองรับ parameter อยู่แล้ว ระบบจะไม่คิด add-on ซ้ำ
          </p>
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-[#f1c5b5] bg-[#fff5f1] px-3 py-2 text-xs font-semibold text-[#a94725]" role="alert">
            {error}
          </div>
        ) : null}

        <div className="mt-4 space-y-3">
          {entries.map((entry, entryIndex) => (
            <section
              key={`addon-entry-${entryIndex}`}
              className="rounded-2xl border border-border bg-white p-3 sm:p-4"
            >
              <div className="flex items-end gap-2">
                <label className="min-w-0 flex-1 text-xs font-semibold">
                  <span className="mb-1.5 block">
                    Variable {entryIndex + 1}
                  </span>
                  <input
                    value={entry.key}
                    onChange={(event) =>
                      updateEntry(entryIndex, { key: event.target.value })
                    }
                    placeholder="quality"
                    list={`${rowKey(row)}-addon-variables`}
                    className="h-10 w-full rounded-xl border border-border bg-[#fcfaf8] px-3 text-sm font-semibold outline-none focus:border-primary focus:ring-3 focus:ring-primary/10"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => removeVariable(entryIndex)}
                  className="mb-0.5 flex h-10 items-center gap-1 rounded-xl px-2.5 text-xs font-semibold text-[#a94725] hover:bg-[#fff0e9]"
                  title="Remove variable"
                >
                  <Trash2 size={14} />
                  <span className="hidden sm:inline">Remove</span>
                </button>
              </div>

              <div className="mt-3 space-y-2">
                {entry.values.map((item, optionIndex) => (
                  <div
                    key={`addon-option-${entryIndex}-${optionIndex}`}
                    className="grid grid-cols-[minmax(0,1fr)_110px_auto] items-center gap-2"
                  >
                    <input
                      value={item.option}
                      onChange={(event) =>
                        updateOption(entryIndex, optionIndex, {
                          option: event.target.value,
                        })
                      }
                      placeholder="High"
                      aria-label={`Option ${optionIndex + 1} for variable ${entryIndex + 1}`}
                      className="h-9 min-w-0 rounded-lg border border-border bg-[#fcfaf8] px-2.5 text-xs font-semibold outline-none focus:border-primary focus:ring-3 focus:ring-primary/10"
                    />
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.amount}
                        onChange={(event) =>
                          updateOption(entryIndex, optionIndex, {
                            amount: event.target.value,
                          })
                        }
                        placeholder="0.03"
                        aria-label={`THB amount for option ${optionIndex + 1} for variable ${entryIndex + 1}`}
                        className="h-9 w-full rounded-lg border border-border bg-[#fcfaf8] px-2.5 pr-7 text-xs font-semibold outline-none focus:border-primary focus:ring-3 focus:ring-primary/10"
                      />
                      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                        ฿
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeOption(entryIndex, optionIndex)}
                      className="rounded-lg p-2 text-muted-foreground hover:bg-[#fff0e9] hover:text-[#a94725]"
                      title="Remove option"
                      aria-label={`Remove option ${optionIndex + 1}`}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => addOption(entryIndex)}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-bold text-primary hover:bg-[#fff0e9]"
              >
                <Plus size={13} /> Add option
              </button>
            </section>
          ))}
        </div>

        <datalist id={`${rowKey(row)}-addon-variables`}>
          <option value="quality" />
          <option value="resolution" />
          <option value="aspect_ratio" />
        </datalist>

        <button
          type="button"
          onClick={addVariable}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-primary/40 bg-[#fff0e9]/45 px-3 py-2.5 text-xs font-bold text-primary hover:bg-[#fff0e9]"
        >
          <Plus size={15} /> Add variable
        </button>

        <div className="mt-5 flex flex-col-reverse justify-end gap-2 border-t border-border pt-4 sm:flex-row">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">
            <CheckCircle2 size={15} /> Apply add-ons
          </Button>
        </div>
        <p className="mt-2 text-right text-[10px] text-muted-foreground">
          กด Save ที่แถวของ model เพื่อบันทึกลงระบบ
        </p>
      </form>
    </div>
  );
}

function parsePricingValue(value: string, property: PricingProperty): unknown {
  if (property.type === "integer")
    return value === "" ? undefined : Number.parseInt(value, 10);
  if (property.type === "number")
    return value === "" ? undefined : Number(value);
  if (property.type === "boolean") return value === "true";
  return value === "" ? undefined : value;
}

function PricingVariablesPanel({
  row,
  values,
  preview,
  loading,
  onChange,
  onClose,
}: {
  row: PricingRow;
  values: Record<string, unknown>;
  preview?: CreditPricingPreview;
  loading: boolean;
  onChange: (name: string, value: unknown) => void;
  onClose: () => void;
}) {
  const properties = pricingProperties(row);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#201d1b]/45 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${rowKey(row)}-pricing-title`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="max-h-[calc(100vh-2rem)] w-full max-w-5xl overflow-y-auto rounded-3xl border border-border bg-[#fffaf7] p-4 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary">
              Pricing inputs
            </p>
            <h3
              id={`${rowKey(row)}-pricing-title`}
              className="mt-1 text-base font-bold"
            >
              {row.displayName} · Configure
            </h3>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              เลือกเฉพาะตัวแปรที่อาจทำให้ต้นทุน Provider เปลี่ยน
              ระบบจะขอราคาใหม่อัตโนมัติเมื่อเปลี่ยนค่า
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-white hover:text-foreground"
            aria-label={`Close pricing inputs for ${row.model}`}
          >
            <X size={16} />
          </button>
        </div>
        {properties.length ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {properties.map(([name, property]) => {
              const label = pricingLabel(name, property);
              const value = values[name];
              const type =
                property.type ??
                (property.enum
                  ? "string"
                  : typeof property.default === "boolean"
                    ? "boolean"
                    : typeof property.default === "number"
                      ? "number"
                      : "string");
              if (Array.isArray(property.enum) && property.enum.length > 0)
                return (
                  <label key={name} className="block text-xs font-semibold">
                    <span className="mb-1.5 block">{label}</span>
                    <select
                      value={value === undefined ? "" : String(value)}
                      onChange={(event) =>
                        onChange(
                          name,
                          parsePricingValue(event.target.value, property),
                        )
                      }
                      className="h-10 w-full rounded-xl border border-border bg-white px-3 text-sm font-semibold outline-none focus:border-primary focus:ring-3 focus:ring-primary/10"
                    >
                      <option value="">Provider default</option>
                      {property.enum.map((option) => (
                        <option key={String(option)} value={String(option)}>
                          {String(option)}
                        </option>
                      ))}
                    </select>
                    {property.description ? (
                      <span className="mt-1 block text-[11px] font-normal leading-4 text-muted-foreground">
                        {property.description}
                      </span>
                    ) : null}
                  </label>
                );
              if (type === "boolean")
                return (
                  <label
                    key={name}
                    className="flex min-h-10 items-center gap-2 rounded-xl border border-border bg-white px-3 text-xs font-semibold"
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(value)}
                      onChange={(event) => onChange(name, event.target.checked)}
                      className="h-4 w-4 accent-primary"
                    />
                    <span>{label}</span>
                  </label>
                );
              return (
                <label key={name} className="block text-xs font-semibold">
                  <span className="mb-1.5 block">{label}</span>
                  <input
                    type={
                      type === "number" || type === "integer"
                        ? "number"
                        : "text"
                    }
                    value={value === undefined ? "" : String(value)}
                    min={property.minimum}
                    max={property.maximum}
                    step={type === "integer" ? 1 : "any"}
                    placeholder={
                      property.default === undefined
                        ? "Provider default"
                        : String(property.default)
                    }
                    onChange={(event) =>
                      onChange(
                        name,
                        parsePricingValue(event.target.value, property),
                      )
                    }
                    className="h-10 w-full rounded-xl border border-border bg-white px-3 text-sm font-semibold outline-none focus:border-primary focus:ring-3 focus:ring-primary/10"
                  />
                  {property.description ? (
                    <span className="mt-1 block text-[11px] font-normal leading-4 text-muted-foreground">
                      {property.description}
                    </span>
                  ) : null}
                </label>
              );
            })}
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-dashed border-[#d8d0ca] bg-white p-4 text-xs text-muted-foreground">
            Model นี้ไม่มีตัวแปรด้านราคา ระบบจะใช้ provider default input และ
            rule margin/fixed/minimum ของ model นี้
          </div>
        )}
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <div className="rounded-xl bg-white p-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
              Provider cost
            </p>
            <p className="mt-1 font-semibold text-primary">
              {loading
                ? "Loading…"
                : preview?.status === "ready"
                  ? `${formatMetric(preview.costCredits)} credit · ฿${formatMetric(preview.providerCostThb)}`
                  : "—"}
            </p>
          </div>
          <div className="rounded-xl bg-white p-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
              Customer charge
            </p>
            <p className="mt-1 font-semibold">
              {loading
                ? "Loading…"
                : preview?.status === "ready" &&
                    preview.creditCost !== undefined
                  ? `${formatMetric(preview.creditCost)} credit · ฿${formatMetric(preview.sellingPriceThb)}`
                  : "—"}
            </p>
          </div>
          <div className="rounded-xl bg-white p-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
              Profit
            </p>
            <p className="mt-1 font-semibold text-[#347454]">
              {loading
                ? "Loading…"
                : preview?.status === "ready"
                  ? `${formatMetric(preview.profitCredits)} credit · ฿${formatMetric(preview.profitThb)}`
                  : "—"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminCreditsContent() {
  const [bundleCredits, setBundleCredits] = useState("5000");
  const [bundlePrice, setBundlePrice] = useState("500");
  const [marginPercent, setMarginPercent] = useState("40");
  const [fxRate, setFxRate] = useState("33.50");
  const [roundingDecimals, setRoundingDecimals] = useState(0);
  const [fixedCost, setFixedCost] = useState("0");
  const [minimumCredits, setMinimumCredits] = useState("1");
  const [rateSource, setRateSource] = useState("Environment fallback");
  const [rateUpdatedAt, setRateUpdatedAt] = useState("");
  const [rateStale, setRateStale] = useState(false);
  const [modelRows, setModelRows] = useState<PricingRow[]>(fallbackModelRows);
  const [quotes, setQuotes] = useState<Record<string, CreditPricingPreview>>(
    {},
  );
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [scenarioValues, setScenarioValues] = useState<
    Record<string, Record<string, unknown>>
  >({});
  const [openConfigKey, setOpenConfigKey] = useState("");
  const [openAddonKey, setOpenAddonKey] = useState("");
  const [scenarioLoadingKey, setScenarioLoadingKey] = useState("");
  const scenarioTimer = useRef<number | undefined>(undefined);
  const [pricingRules, setPricingRules] = useState<CreditPricingRule[]>([]);
  const [drafts, setDrafts] = useState<Record<string, RuleDraft>>({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState("");
  const [globalDirty, setGlobalDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [categoryFilter, setCategoryFilter] =
    useState<PricingCategoryFilter>("all");
  const [featureFilter, setFeatureFilter] = useState("all");
  const [modelSearch, setModelSearch] = useState("");
  const [signupBonusEnabled, setSignupBonusEnabled] = useState(false);
  const [signupBonusCredits, setSignupBonusCredits] = useState("0");
  const [signupBonusDirty, setSignupBonusDirty] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [settings, overview, audioSettings]: [
        CreditPricingSettings,
        AdminModelRoutesOverview,
        AdminAudioSettings,
      ] = await Promise.all([
        listAdminCreditPricingRules(),
        listAdminModelRoutesOverview(),
        getAdminAudioSettings(),
      ]);
      const signupBonus: SignupCreditGrantSettings = await getAdminSignupCreditGrant();
      setPricingRules(settings.rules);
      setMarginPercent(String(settings.defaults.targetMargin * 100));
      setFxRate(settings.defaults.exchangeRateThbPerUsd.toFixed(4));
      setRateSource(
        settings.defaults.exchangeRateSource ?? "Environment fallback",
      );
      setRateUpdatedAt(settings.defaults.exchangeRateFetchedAt ?? "");
      setRateStale(settings.defaults.exchangeRateStale === true);
      setFixedCost(String(settings.defaults.fixedCostThb));
      setMinimumCredits(String(settings.defaults.minimumCreditCost));
      setRoundingDecimals(settings.defaults.roundingDecimals);
      setSignupBonusEnabled(signupBonus.enabled);
      setSignupBonusCredits(String(signupBonus.credits));
      setSignupBonusDirty(false);
      setGlobalDirty(false);
      const nextRows = [
        ...modelRowsFromOverview(overview),
        ...audioPricingRows(audioSettings),
      ];
      const rowsForPreview = nextRows.length > 0 ? nextRows : fallbackModelRows;
      if (nextRows.length > 0) setModelRows(nextRows);
      setScenarioValues(
        Object.fromEntries(
          rowsForPreview.map((row) => [
            rowKey(row),
            defaultScenarioValues(row),
          ]),
        ),
      );
      setQuotesLoading(true);
      void previewAdminCreditPricingRules(
        rowsForPreview.map((row) => ({
          provider: row.provider,
          model: row.model,
          featureKey: row.featureKey,
          input: cleanScenarioValues(defaultScenarioValues(row)),
        })),
      )
        .then((previews) => {
          setQuotes(
            Object.fromEntries(
              previews.map((preview) => [
                `${preview.provider}:${preview.model}:${preview.featureKey ?? ""}`,
                preview,
              ]),
            ),
          );
        })
        .catch(() => {
          setQuotes({});
        })
        .finally(() => {
          setQuotesLoading(false);
        });
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to load pricing rules",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(loadTimer);
  }, [load]);

  useEffect(
    () => () => {
      if (scenarioTimer.current !== undefined)
        window.clearTimeout(scenarioTimer.current);
    },
    [],
  );

  const ruleFor = useCallback(
    (row: PricingRow): CreditPricingRule | undefined => {
      return (
        pricingRules.find(
          (rule) =>
            rule.provider === row.provider &&
            rule.model === row.model &&
            rule.featureKey === row.featureKey,
        ) ??
        pricingRules.find(
          (rule) =>
            rule.provider === row.provider &&
            rule.model === row.model &&
            !rule.featureKey,
        )
      );
    },
    [pricingRules],
  );

  const draftFor = useCallback(
    (row: PricingRow): RuleDraft => {
      const existingDraft = drafts[rowKey(row)];
      if (existingDraft) return existingDraft;
      const rule = ruleFor(row);
      return {
        targetMargin: rule
          ? String(rule.targetMargin * 100)
          : String(Number(marginPercent) || 0),
        fixedCostThb: String(rule?.fixedCostThb ?? (Number(fixedCost) || 0)),
        minimumCreditCost: String(
          rule?.minimumCreditCost ?? (Number(minimumCredits) || 1),
        ),
        promptAddonsJson: promptAddonsJson(rule?.promptAddons),
      };
    },
    [drafts, fixedCost, marginPercent, minimumCredits, ruleFor],
  );

  const refreshScenarioQuote = useCallback(
    async (row: PricingRow, values: Record<string, unknown>) => {
      const key = rowKey(row);
      setScenarioLoadingKey(key);
      try {
        const previews = await previewAdminCreditPricingRules([
          {
            provider: row.provider,
            model: row.model,
            featureKey: row.featureKey,
            input: cleanScenarioValues(values),
          },
        ]);
        const preview = previews[0];
        if (preview) setQuotes((current) => ({ ...current, [key]: preview }));
      } catch {
        // Keep the last successful quote visible while a scenario request is unavailable.
      } finally {
        setScenarioLoadingKey((current) => (current === key ? "" : current));
      }
    },
    [],
  );

  const toggleConfigure = (row: PricingRow) => {
    const key = rowKey(row);
    setScenarioValues((current) =>
      current[key]
        ? current
        : { ...current, [key]: defaultScenarioValues(row) },
    );
    setOpenConfigKey((current) => (current === key ? "" : key));
  };

  const updateScenarioValue = (
    row: PricingRow,
    name: string,
    value: unknown,
  ) => {
    const key = rowKey(row);
    const nextValues = {
      ...(scenarioValues[key] ?? defaultScenarioValues(row)),
      [name]: value,
    };
    setScenarioValues((current) => ({ ...current, [key]: nextValues }));
    if (scenarioTimer.current !== undefined)
      window.clearTimeout(scenarioTimer.current);
    scenarioTimer.current = window.setTimeout(() => {
      void refreshScenarioQuote(row, nextValues);
    }, 450);
  };

  const rule = useMemo(() => {
    const credits = Number(bundleCredits) || 0;
    const price = Number(bundlePrice) || 0;
    const creditValue = credits > 0 ? price / credits : 0;
    const providerUsd = 0.04;
    const providerThb = providerUsd * (Number(fxRate) || 0);
    const margin = Math.min(
      Math.max((Number(marginPercent) || 0) / 100, 0),
      0.99,
    );
    const sellingBeforeRound =
      (providerThb + (Number(fixedCost) || 0)) / Math.max(1 - margin, 0.01);
    const chargedCredits =
      creditValue > 0
        ? Math.max(
            Number(minimumCredits) || 1,
            Math.ceil(sellingBeforeRound / creditValue),
          )
        : 0;
    const chargedThb = chargedCredits * creditValue;
    return {
      creditValue,
      providerUsd,
      providerThb,
      sellingBeforeRound,
      chargedCredits,
      chargedThb,
      profit: chargedThb - providerThb,
    };
  }, [
    bundleCredits,
    bundlePrice,
    marginPercent,
    fxRate,
    fixedCost,
    minimumCredits,
  ]);

  const updateDraft = (row: PricingRow, patch: Partial<RuleDraft>) => {
    const key = rowKey(row);
    setDrafts((current) => ({
      ...current,
      [key]: { ...draftFor(row), ...patch, dirty: true },
    }));
  };

  const saveGlobalFallback = async () => {
    const targetMargin = Number(marginPercent) / 100;
    const fixed = Number(fixedCost);
    const minimum = Number(minimumCredits);
    if (!Number.isFinite(targetMargin) || targetMargin < 0 || targetMargin >= 1) {
      setError("Global margin must be between 0% and 99.99%");
      return;
    }
    if (!Number.isFinite(fixed) || fixed < 0) {
      setError("Global fixed cost must be zero or greater");
      return;
    }
    if (!Number.isFinite(minimum) || minimum <= 0) {
      setError("Global minimum credits must be greater than zero");
      return;
    }
    setSavingKey("defaults");
    setError("");
    try {
      const defaults = await upsertAdminCreditPricingDefaults({
        targetMargin,
        fixedCostThb: fixed,
        minimumCreditCost: minimum,
      });
      setMarginPercent(String(defaults.targetMargin * 100));
      setFixedCost(String(defaults.fixedCostThb));
      setMinimumCredits(String(defaults.minimumCreditCost));
      setGlobalDirty(false);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2800);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save global pricing defaults");
    } finally {
      setSavingKey("");
    }
  };

  const saveSignupBonus = async () => {
    const credits = Number(signupBonusCredits);
    if (!Number.isFinite(credits) || credits < 0 || credits > 1000000) {
      setError("Welcome credits must be between 0 and 1,000,000");
      return;
    }
    setSavingKey("signup-bonus");
    setError("");
    try {
      const savedSettings = await updateAdminSignupCreditGrant({ enabled: signupBonusEnabled, credits });
      setSignupBonusEnabled(savedSettings.enabled);
      setSignupBonusCredits(String(savedSettings.credits));
      setSignupBonusDirty(false);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2800);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save welcome credits");
    } finally {
      setSavingKey("");
    }
  };

  const saveRows = async (rows: PricingRow[]) => {
    if (rows.length === 0) {
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2800);
      return;
    }
    setSavingKey("all");
    setError("");
    try {
      const results = await Promise.all(
        rows.map(async (row) => {
          const draft = draftFor(row);
          const targetMargin = Number(draft.targetMargin) / 100;
          if (
            !Number.isFinite(targetMargin) ||
            targetMargin < 0 ||
            targetMargin >= 1
          )
            throw new Error(
              `${row.displayName}: margin must be between 0% and 99.99%`,
            );
          const fixed = Number(draft.fixedCostThb);
          const minimum = Number(draft.minimumCreditCost);
          let promptAddons: Record<string, Record<string, number>>;
          try {
            promptAddons = parsePromptAddonsJson(draft.promptAddonsJson);
          } catch (reason) {
            throw new Error(`${row.displayName}: ${reason instanceof Error ? reason.message : "invalid prompt add-ons JSON"}`);
          }
          if (!Number.isFinite(fixed) || fixed < 0)
            throw new Error(
              `${row.displayName}: fixed cost must be zero or greater`,
            );
          if (!Number.isFinite(minimum) || minimum <= 0)
            throw new Error(
              `${row.displayName}: minimum credits must be greater than zero`,
            );
          return {
            row,
            rule: await upsertAdminCreditPricingRule({
              provider: row.provider,
              model: row.model,
              featureKey: row.featureKey,
              targetMargin,
              fixedCostThb: fixed,
              minimumCreditCost: minimum,
              promptAddons,
              enabled: true,
            }),
          };
        }),
      );
      setPricingRules((current) =>
        results.reduce(
          (next, result) => [
            ...next.filter(
              (item) =>
                !(
                  item.provider === result.rule.provider &&
                  item.model === result.rule.model &&
                  item.featureKey === result.rule.featureKey
                ),
            ),
            result.rule,
          ],
          current,
        ),
      );
      setDrafts((current) => {
        const next = { ...current };
        for (const result of results)
          next[rowKey(result.row)] = {
            targetMargin: String(result.rule.targetMargin * 100),
            fixedCostThb: String(result.rule.fixedCostThb),
            minimumCreditCost: String(result.rule.minimumCreditCost),
            promptAddonsJson: promptAddonsJson(result.rule.promptAddons),
            dirty: false,
          };
        return next;
      });
      await load();
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2800);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to save pricing rules",
      );
    } finally {
      setSavingKey("");
    }
  };

  const dirtyRows = modelRows.filter((row) => draftFor(row).dirty);
  const availableFeatureKeys = useMemo(
    () =>
      featureOrder.filter((featureKey) =>
        modelRows.some((row) => {
          if (row.featureKey !== featureKey) return false;
          if (categoryFilter === "video")
            return videoFeatureKeys.has(featureKey);
          if (categoryFilter === "image")
            return !videoFeatureKeys.has(featureKey) && !audioFeatureKeys.has(featureKey);
          if (categoryFilter === "audio")
            return audioFeatureKeys.has(featureKey);
          return true;
        }),
      ),
    [categoryFilter, modelRows],
  );
  const selectedFeatureFilter = availableFeatureKeys.includes(featureFilter)
    ? featureFilter
    : "all";
  const filteredModelRows = useMemo(() => {
    const normalizedSearch = modelSearch.trim().toLowerCase();
    return modelRows.filter((row) => {
      const matchesCategory = categoryFilter === "all"
        ? true
        : categoryFilter === "video"
          ? videoFeatureKeys.has(row.featureKey)
          : categoryFilter === "audio"
            ? audioFeatureKeys.has(row.featureKey)
            : !videoFeatureKeys.has(row.featureKey) && !audioFeatureKeys.has(row.featureKey);
      const matchesFeature =
        selectedFeatureFilter === "all" ||
        row.featureKey === selectedFeatureFilter;
      const searchable =
        `${row.feature} ${row.displayName} ${row.provider} ${row.model}`.toLowerCase();
      return (
        matchesCategory &&
        matchesFeature &&
        (!normalizedSearch || searchable.includes(normalizedSearch))
      );
    });
  }, [categoryFilter, modelRows, modelSearch, selectedFeatureFilter]);
  const hasActiveFilters =
    categoryFilter !== "all" ||
    selectedFeatureFilter !== "all" ||
    modelSearch.trim() !== "";
  const configuredRow = modelRows.find((row) => rowKey(row) === openConfigKey);
  const addonRow = modelRows.find((row) => rowKey(row) === openAddonKey);
  const configuredDraft = configuredRow ? draftFor(configuredRow) : undefined;
  const addonDraft = addonRow ? draftFor(addonRow) : undefined;
  const configuredPreview =
    configuredRow && configuredDraft
      ? previewWithDraft(
          quotes[openConfigKey],
          configuredDraft,
          rule.creditValue,
          roundingDecimals,
        )
      : undefined;
  const configuredValues = configuredRow
    ? (scenarioValues[openConfigKey] ?? defaultScenarioValues(configuredRow))
    : {};

  return (
    <SidebarProvider>
      <div className="min-h-screen w-full min-w-0 bg-background">
        <SidebarNavigation />
        <div className="min-w-0 lg:pl-[var(--sidebar-width)]">
          <StudioHeader />
          <main className="page-gutter mx-auto w-full max-w-[1600px] py-5 lg:py-8">
            <div className="min-h-[calc(100vh-120px)] overflow-x-clip rounded-3xl bg-[#faf8f6] px-4 pb-20 sm:px-6 lg:px-8 lg:pb-24">
              <div className="mx-auto max-w-[1240px] pt-6 lg:pt-8">
                <div className="mb-8 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
                  <div>
                    <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#201d1b] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white">
                      <Settings2 size={13} /> Operations
                    </div>
                    <h1 className="max-w-xl text-3xl font-bold tracking-tight sm:text-4xl">
                      Credits &amp; billing rules
                    </h1>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                      กำหนดราคาขาย credit และกำไรแยกตาม model จากต้นทุนจริงของ
                      Provider
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Badge tone="success">Admin API</Badge>
                    <Button
                      size="lg"
                      onClick={() => void saveRows(dirtyRows)}
                      disabled={savingKey !== "" || loading}
                    >
                      <Save size={16} />{" "}
                      {savingKey === "all"
                        ? "Saving…"
                        : `Save ${dirtyRows.length || "all"} model rules`}
                    </Button>
                  </div>
                </div>

                {saved ? (
                  <div
                    className="mb-5 flex items-center gap-3 rounded-2xl border border-[#bfe1cc] bg-[#f3fbf5] p-4 text-sm text-[#347454]"
                    role="status"
                  >
                    <CheckCircle2 size={18} />
                    <p className="font-semibold">
                      บันทึกกฎราคาแล้ว
                    </p>
                  </div>
                ) : null}
                {error ? (
                  <div
                    className="mb-5 flex items-center justify-between gap-3 rounded-2xl border border-[#f1c5b5] bg-[#fff5f1] p-4 text-sm text-[#a94725]"
                    role="alert"
                  >
                    <p>{error}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void load()}
                    >
                      Retry
                    </Button>
                  </div>
                ) : null}

                <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <SummaryCard
                    icon={Coins}
                    label="Credit value"
                    value={`฿${rule.creditValue.toFixed(2)}`}
                    detail={`${Number(bundleCredits || 0).toLocaleString()} credits = ฿${Number(bundlePrice || 0).toLocaleString()}`}
                    tone="orange"
                  />
                  <SummaryCard
                    icon={Percent}
                    label="Global margin"
                    value={`${Number(marginPercent || 0)}%`}
                    detail="Fallback when model has no override"
                    tone="green"
                  />
                  <SummaryCard
                    icon={DollarSign}
                    label="USD / THB rate"
                    value={Number(fxRate || 0).toFixed(2)}
                    detail={
                      rateStale
                        ? "Auto rate unavailable · using fallback"
                        : "Auto rate · Bank of Thailand"
                    }
                    tone="pink"
                  />
                  <SummaryCard
                    icon={Calculator}
                    label="Global minimum"
                    value={`${Number(minimumCredits || 0)} credit`}
                    detail="Model rules can override this"
                    tone="orange"
                  />
                </div>
                <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge tone={rateStale ? "warning" : "success"}>
                    {rateStale ? "FX fallback" : "FX auto"}
                  </Badge>
                  <span>{rateSource}</span>
                  {rateUpdatedAt ? (
                    <span>
                      · updated{" "}
                      {new Date(rateUpdatedAt).toLocaleString("th-TH")}
                    </span>
                  ) : null}
                </div>

                <Card className="mb-6 border-[#f1c7b5] bg-[#fffaf7] p-5 sm:p-6">
                  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">
                        New user welcome credits
                      </p>
                      <h2 className="mt-1 text-xl font-bold tracking-tight">
                        เครดิตต้อนรับผู้สมัครใหม่
                      </h2>
                      <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">
                        แจกอัตโนมัติครั้งเดียวหลังสมัครสมาชิกสำเร็จ ใช้ idempotency กันการแจกซ้ำ
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant={signupBonusDirty ? "default" : "outline"}
                      onClick={() => void saveSignupBonus()}
                      disabled={!signupBonusDirty || savingKey !== "" || loading}
                    >
                      {savingKey === "signup-bonus" ? <LoaderCircle size={13} className="animate-spin" /> : <Save size={13} />}
                      {savingKey === "signup-bonus" ? "Saving…" : "Save welcome credits"}
                    </Button>
                  </div>
                  <div className="mt-5 grid gap-4 sm:grid-cols-[minmax(0,220px)_minmax(0,1fr)] sm:items-end">
                    <NumberField
                      label="Credits per new user"
                      value={signupBonusCredits}
                      suffix="credits"
                      onChange={(value) => {
                        setSignupBonusCredits(value);
                        setSignupBonusDirty(true);
                      }}
                      help="ตั้งเป็น 0 เพื่อไม่แจกเครดิต"
                    />
                    <label className="flex min-h-11 items-center gap-3 rounded-xl border border-border bg-white px-3 text-xs font-semibold text-foreground">
                      <input
                        type="checkbox"
                        checked={signupBonusEnabled}
                        onChange={(event) => {
                          setSignupBonusEnabled(event.target.checked);
                          setSignupBonusDirty(true);
                        }}
                        className="h-4 w-4 accent-[#f26b38]"
                      />
                      เปิดใช้งานการแจกเครดิตอัตโนมัติ
                    </label>
                  </div>
                </Card>

                <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)] lg:items-start">
                  <Card className="bg-white p-5 sm:p-6">
                    <div className="mb-5 flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">
                          Global fallback
                        </p>
                        <h2 className="mt-1 text-xl font-bold tracking-tight">
                          Customer credit pricing
                        </h2>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          ใช้เมื่อ model ยังไม่มี rule เฉพาะ โดยค่าที่แก้ราย
                          model ด้านล่างจะ override ส่วนนี้
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Coins className="text-primary" size={22} />
                        <Button
                          size="sm"
                          variant={globalDirty ? "default" : "outline"}
                          onClick={() => void saveGlobalFallback()}
                          disabled={!globalDirty || savingKey !== "" || loading}
                        >
                          {savingKey === "defaults" ? <LoaderCircle size={13} className="animate-spin" /> : <Save size={13} />}
                          {savingKey === "defaults" ? "Saving…" : "Save fallback"}
                        </Button>
                      </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <NumberField
                        label="Credit bundle"
                        value={bundleCredits}
                        suffix="credits"
                        onChange={setBundleCredits}
                        help="จำนวน credit ใน package อ้างอิง"
                      />
                      <NumberField
                        label="Bundle price"
                        value={bundlePrice}
                        suffix="THB"
                        onChange={setBundlePrice}
                        help="ราคาที่ผู้ใช้จ่ายจริง"
                      />
                      <NumberField
                        label="Target margin"
                        value={marginPercent}
                        suffix="%"
                        onChange={(value) => {
                          setMarginPercent(value);
                          setGlobalDirty(true);
                        }}
                        help="คำนวณแบบ margin ไม่ใช่ markup"
                      />
                      <NumberField
                        label="Fixed cost"
                        value={fixedCost}
                        suffix="THB"
                        onChange={(value) => {
                          setFixedCost(value);
                          setGlobalDirty(true);
                        }}
                        help="ค่าใช้จ่ายคงที่ต่อ generation"
                      />
                      <NumberField
                        label="USD / THB rate"
                        value={fxRate}
                        suffix="THB"
                        onChange={setFxRate}
                        help="อัตราที่ใช้ใน pricing window ปัจจุบัน"
                      />
                      <NumberField
                        label="Minimum charge"
                        value={minimumCredits}
                        suffix="credit"
                        onChange={(value) => {
                          setMinimumCredits(value);
                          setGlobalDirty(true);
                        }}
                        help="ราคาขั้นต่ำต่อ generation"
                      />
                    </div>
                    <div className="mt-5 rounded-2xl border border-[#eaded6] bg-[#fffaf7] p-4">
                      <div className="flex items-start gap-3">
                        <Info
                          className="mt-0.5 shrink-0 text-primary"
                          size={16}
                        />
                        <div>
                          <p className="text-xs font-bold">Pricing formula</p>
                          <p className="mt-1 font-mono text-[11px] leading-6 text-muted-foreground">
                            selling price = (provider cost × FX + fixed cost) ÷
                            (1 − margin)
                            <br />
                            credits = ceil(selling price ÷ credit value)
                          </p>
                        </div>
                      </div>
                    </div>
                  </Card>

                  <Card className="overflow-hidden bg-[#201d1b] text-white">
                    <div className="border-b border-white/10 p-5 sm:p-6">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#ffb38b]">
                            Global fallback preview
                          </p>
                          <h2 className="mt-1 text-xl font-bold tracking-tight">
                            Fallback · one generation
                          </h2>
                          <p className="mt-1 text-xs leading-5 text-white/60">
                            ใช้เมื่อยังไม่มี provider quote ของ model นั้น
                            ส่วนตารางด้านล่างใช้ราคาของแต่ละ model
                          </p>
                        </div>
                        <RefreshCw size={19} className="text-[#ffb38b]" />
                      </div>
                      <div className="mt-5 rounded-2xl bg-white/10 p-4">
                        <div className="flex items-end justify-between gap-4">
                          <div>
                            <p className="text-[11px] text-white/60">
                              Provider cost
                            </p>
                            <p className="mt-1 text-2xl font-bold">
                              ${rule.providerUsd.toFixed(3)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-[11px] text-white/60">
                              Model input
                            </p>
                            <p className="mt-1 text-xs font-semibold">
                              1 generation · provider default input
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-4 p-5 sm:p-6">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-white/60">
                          Provider cost in THB
                        </span>
                        <strong>฿{rule.providerThb.toFixed(2)}</strong>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-white/60">
                          Price before rounding
                        </span>
                        <strong>฿{rule.sellingBeforeRound.toFixed(2)}</strong>
                      </div>
                      <div className="flex items-center justify-between border-t border-white/10 pt-4">
                        <span className="font-semibold">Customer pays</span>
                        <strong className="text-2xl text-[#ffb38b]">
                          {rule.chargedCredits} credits
                        </strong>
                      </div>
                      <div className="flex items-center justify-between rounded-xl bg-[#2e2926] px-3 py-2 text-xs">
                        <span className="text-white/60">Selling value</span>
                        <strong>
                          ฿{rule.chargedThb.toFixed(2)} · profit ฿
                          {rule.profit.toFixed(2)}
                        </strong>
                      </div>
                      <p className="text-[11px] leading-5 text-white/50">
                        ราคาจริงจะถูก snapshot ตอนสร้าง generation
                        และใช้ราคาเดิมตอน worker ทำงาน
                      </p>
                    </div>
                  </Card>
                </div>

                <section
                  className="mt-4 overflow-hidden rounded-2xl border border-border bg-white"
                  aria-labelledby="model-pricing-heading"
                >
                  <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary">
                        Per-model overrides
                      </p>
                      <h2
                        id="model-pricing-heading"
                        className="mt-0.5 text-lg font-bold tracking-tight"
                      >
                        Model rules
                      </h2>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        ตั้งค่า margin และตัวแปรราคาแยกตาม model
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone="success">
                        {loading
                          ? "Loading…"
                          : `${filteredModelRows.length}${hasActiveFilters ? ` / ${modelRows.length}` : ""} models`}
                      </Badge>
                      {quotesLoading ? (
                        <LoaderCircle
                          size={14}
                          className="animate-spin text-primary"
                        />
                      ) : null}
                      {savingKey === "all" ? (
                        <LoaderCircle
                          size={14}
                          className="animate-spin text-primary"
                        />
                      ) : null}
                    </div>
                  </div>
                  <div className="border-b border-border bg-[#fffaf7] px-4 py-2 text-[10px] text-muted-foreground sm:px-5">
                    ต้นทุนและกำไรอิงค่าเริ่มต้นของแต่ละ model · กด Configure
                    เพื่อเปลี่ยนตัวแปรและดูราคาใหม่
                  </div>
                  <div className="flex flex-wrap items-end gap-2 border-b border-border bg-white px-4 py-3 sm:px-5">
                    <label className="min-w-[130px] flex-1 sm:flex-none">
                      <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                        Type
                      </span>
                      <select
                        aria-label="Filter by type"
                        value={categoryFilter}
                        onChange={(event) =>
                          setCategoryFilter(
                            event.target.value as PricingCategoryFilter,
                          )
                        }
                        className="h-8 w-full rounded-lg border border-border bg-[#fcfaf8] px-2 text-xs font-semibold outline-none focus:border-primary focus:ring-3 focus:ring-primary/10"
                      >
                        <option value="all">All types</option>
                        <option value="image">Image</option>
                        <option value="video">Video</option>
                        <option value="audio">Audio</option>
                      </select>
                    </label>
                    <label className="min-w-[170px] flex-1 sm:flex-none">
                      <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                        Feature
                      </span>
                      <select
                        aria-label="Filter by feature"
                        value={selectedFeatureFilter}
                        onChange={(event) =>
                          setFeatureFilter(event.target.value)
                        }
                        className="h-8 w-full rounded-lg border border-border bg-[#fcfaf8] px-2 text-xs font-semibold outline-none focus:border-primary focus:ring-3 focus:ring-primary/10"
                      >
                        <option value="all">All features</option>
                        {availableFeatureKeys.map((featureKey) => (
                          <option key={featureKey} value={featureKey}>
                            {featureLabels[featureKey] ?? featureKey}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="min-w-[220px] flex-1">
                      <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                        Search
                      </span>
                      <input
                        aria-label="Search models"
                        value={modelSearch}
                        onChange={(event) => setModelSearch(event.target.value)}
                        placeholder="Model or provider"
                        className="h-8 w-full rounded-lg border border-border bg-[#fcfaf8] px-2 text-xs font-semibold outline-none placeholder:font-normal placeholder:text-muted-foreground focus:border-primary focus:ring-3 focus:ring-primary/10"
                      />
                    </label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 px-2 text-[10px]"
                      onClick={() => {
                        setCategoryFilter("all");
                        setFeatureFilter("all");
                        setModelSearch("");
                      }}
                      disabled={!hasActiveFilters}
                    >
                      Clear
                    </Button>
                  </div>
                  <div className="overflow-hidden">
                    <table className="w-full table-fixed text-left text-[11px]">
                      <colgroup>
                        <col className="w-[24%]" />
                        <col className="w-[12%]" />
                        <col className="w-[12%]" />
                        <col className="w-[11%]" />
                        <col className="w-[8%]" />
                        <col className="w-[7%]" />
                        <col className="w-[16%]" />
                        <col className="w-[10%]" />
                      </colgroup>
                      <thead className="bg-[#fcfaf8] text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2">Feature / model</th>
                          <th className="px-3 py-2">Provider cost</th>
                          <th className="px-3 py-2">Profit</th>
                          <th className="px-3 py-2">Target margin</th>
                          <th className="px-3 py-2">Fixed cost</th>
                          <th className="px-3 py-2">Minimum</th>
                          <th className="px-3 py-2">Prompt add-ons</th>
                          <th className="px-3 py-2 text-right">Rule</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredModelRows.length ? (
                          filteredModelRows.map((row) => {
                            const key = rowKey(row);
                            const draft = draftFor(row);
                            const existing = ruleFor(row);
                            const dirty = Boolean(draft.dirty);
                            const fields = pricingProperties(row);
                            const addonCount = promptAddonVariableCount(
                              draft.promptAddonsJson,
                            );
                            const rawPreview = quotes[key];
                            const preview = previewWithDraft(
                              rawPreview,
                              draft,
                              rule.creditValue,
                              roundingDecimals,
                            );
                            const previewLoading = quotesLoading && !preview;
                            const unavailable =
                              !previewLoading && preview?.status !== "ready";
                            return (
                              <tr
                                key={key}
                                className="border-t border-border align-top"
                              >
                                <td className="px-3 py-2">
                                  <p
                                    className="truncate font-semibold text-[11px]"
                                    title={`${row.feature} · ${row.displayName}`}
                                  >
                                    {row.feature}{" "}
                                    <span className="font-normal text-muted-foreground">
                                      · {row.displayName}
                                    </span>
                                    {fields.length ? (
                                      <span className="ml-1 rounded-full bg-[#fff0e9] px-1.5 py-0.5 text-[9px] font-bold text-primary">
                                        Variable · {fields.length}
                                      </span>
                                    ) : (
                                      <span className="ml-1 rounded-full bg-[#f2ece7] px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground">
                                        Fixed
                                      </span>
                                    )}
                                  </p>
                                  <p className="mt-0.5 break-all font-mono text-[9px] leading-3 text-muted-foreground">
                                    {row.provider} · {row.model}
                                  </p>
                                </td>
                                <td className="px-3 py-2">
                                  {previewLoading ? (
                                    <p className="font-semibold text-primary">
                                      Loading…
                                    </p>
                                  ) : preview?.status === "ready" ? (
                                    <>
                                      <p className="font-semibold text-primary">
                                        {formatMetric(preview.costCredits)}{" "}
                                        credit
                                      </p>
                                      <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                                        ฿{formatMetric(preview.providerCostThb)}{" "}
                                        · $
                                        {formatMetric(
                                          preview.providerCostUsd,
                                          4,
                                        )}
                                      </p>
                                    </>
                                  ) : (
                                    <>
                                      <p className="font-semibold">—</p>
                                      {unavailable ? (
                                        <p
                                          className="mt-0.5 text-[9px] text-muted-foreground"
                                          title={preview?.message}
                                        >
                                          Unavailable
                                        </p>
                                      ) : null}
                                    </>
                                  )}
                                </td>
                                <td className="px-3 py-2">
                                  {previewLoading ? (
                                    <p className="font-semibold text-[#347454]">
                                      Loading…
                                    </p>
                                  ) : preview?.status === "ready" ? (
                                    <>
                                      <p className="font-semibold text-[#347454]">
                                        {formatMetric(preview.profitCredits)}{" "}
                                        credit
                                      </p>
                                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                                        ฿{formatMetric(preview.profitThb)}
                                      </p>
                                    </>
                                  ) : (
                                    <p className="font-semibold text-[#347454]">
                                      —
                                    </p>
                                  )}
                                </td>
                                <td className="px-3 py-2">
                                  <label
                                    className="sr-only"
                                    htmlFor={`${key}-margin`}
                                  >
                                    Target margin for {row.model}
                                  </label>
                                  <div className="relative">
                                    <input
                                      id={`${key}-margin`}
                                      type="number"
                                      min="0"
                                      max="99.99"
                                      step="0.01"
                                      value={draft.targetMargin}
                                      onChange={(event) =>
                                        updateDraft(row, {
                                          targetMargin: event.target.value,
                                        })
                                      }
                                      className="h-8 w-full rounded-lg border border-border bg-[#fcfaf8] px-2 pr-6 text-xs font-semibold outline-none focus:border-primary focus:ring-3 focus:ring-primary/10"
                                    />
                                    <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                                      %
                                    </span>
                                  </div>
                                </td>
                                <td className="px-3 py-2">
                                  <label
                                    className="sr-only"
                                    htmlFor={`${key}-fixed`}
                                  >
                                    Fixed cost for {row.model}
                                  </label>
                                  <div className="relative">
                                    <input
                                      id={`${key}-fixed`}
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={draft.fixedCostThb}
                                      onChange={(event) =>
                                        updateDraft(row, {
                                          fixedCostThb: event.target.value,
                                        })
                                      }
                                      className="h-8 w-full rounded-lg border border-border bg-[#fcfaf8] px-2 pr-5 text-xs font-semibold outline-none focus:border-primary focus:ring-3 focus:ring-primary/10"
                                    />
                                    <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                                      ฿
                                    </span>
                                  </div>
                                </td>
                                <td className="px-3 py-2">
                                  <label
                                    className="sr-only"
                                    htmlFor={`${key}-minimum`}
                                  >
                                    Minimum credits for {row.model}
                                  </label>
                                  <input
                                    id={`${key}-minimum`}
                                    type="number"
                                    min="1"
                                    step="1"
                                    value={draft.minimumCreditCost}
                                    onChange={(event) =>
                                      updateDraft(row, {
                                        minimumCreditCost: event.target.value,
                                      })
                                    }
                                    className="h-8 w-full rounded-lg border border-border bg-[#fcfaf8] px-2 text-xs font-semibold outline-none focus:border-primary focus:ring-3 focus:ring-primary/10"
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  <button
                                    type="button"
                                    onClick={() => setOpenAddonKey(key)}
                                    className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-[#f1c5b5] bg-[#fffaf7] px-2 text-[10px] font-bold text-primary transition hover:border-primary hover:bg-[#fff0e9]"
                                  >
                                    <Plus size={13} />
                                    {addonCount ? "Edit add-ons" : "Add add-on"}
                                  </button>
                                  <p className="mt-1 text-center text-[9px] leading-3 text-muted-foreground">
                                    {addonCount
                                      ? `${addonCount} variable(s) · THB/image`
                                      : "No add-ons configured"}
                                  </p>
                                </td>
                                <td className="px-3 py-2 text-right">
                                  <div className="flex flex-wrap items-center justify-end gap-1">
                                    {existing ? (
                                      <Badge
                                        tone={
                                          existing.featureKey
                                            ? "success"
                                            : "warning"
                                        }
                                      >
                                        {existing.featureKey
                                          ? "Override"
                                          : "Global"}
                                      </Badge>
                                    ) : (
                                      <Badge>Global</Badge>
                                    )}
                                    {fields.length ? (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-7 px-1.5 text-[10px]"
                                        onClick={() => toggleConfigure(row)}
                                      >
                                        <SlidersHorizontal size={12} />{" "}
                                        {openConfigKey === key
                                          ? "Close"
                                          : "Configure"}
                                      </Button>
                                    ) : null}
                                    <Button
                                      size="sm"
                                      variant={dirty ? "default" : "outline"}
                                      className="h-7 px-1.5 text-[10px]"
                                      onClick={() => void saveRows([row])}
                                      disabled={!dirty || savingKey !== ""}
                                      title="Save pricing rule"
                                    >
                                      {savingKey === "all" ? (
                                        <LoaderCircle
                                          size={12}
                                          className="animate-spin"
                                        />
                                      ) : (
                                        <Save size={12} />
                                      )}{" "}
                                      Save
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td
                              colSpan={8}
                              className="px-4 py-12 text-center text-xs text-muted-foreground"
                            >
                              No models match these filters.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
                {addonRow && addonDraft ? (
                  <PromptAddonsDialog
                    key={rowKey(addonRow)}
                    row={addonRow}
                    value={addonDraft.promptAddonsJson}
                    onApply={(nextValue) => {
                      updateDraft(addonRow, { promptAddonsJson: nextValue });
                      setOpenAddonKey("");
                    }}
                    onClose={() => setOpenAddonKey("")}
                  />
                ) : null}
                {configuredRow ? (
                  <PricingVariablesPanel
                    row={configuredRow}
                    values={configuredValues}
                    preview={configuredPreview}
                    loading={
                      (quotesLoading && !quotes[openConfigKey]) ||
                      scenarioLoadingKey === openConfigKey
                    }
                    onChange={(name, value) =>
                      updateScenarioValue(configuredRow, name, value)
                    }
                    onClose={() => setOpenConfigKey("")}
                  />
                ) : null}

                <div className="mt-5 flex items-start gap-3 rounded-2xl border border-[#eaded6] bg-[#fffdfb] p-4 text-xs text-muted-foreground">
                  <Info className="mt-0.5 shrink-0 text-primary" size={16} />
                  <p>
                    <strong className="text-foreground">วิธีเลือกกฎ:</strong>{" "}
                    ระบบจะหา rule ที่ตรงกับ{" "}
                    <code className="rounded bg-[#f2ece7] px-1 py-0.5 text-[11px]">
                      provider + model + feature
                    </code>{" "}
                    ก่อน ถ้าไม่มีจะใช้ rule ของ model และสุดท้ายจึงใช้ global
                    fallback จาก environment เช่น{" "}
                    <code className="rounded bg-[#f2ece7] px-1 py-0.5 text-[11px]">
                      CREDIT_TARGET_MARGIN
                    </code>{" "}
                    และ{" "}
                    <code className="rounded bg-[#f2ece7] px-1 py-0.5 text-[11px]">
                      USD_THB_RATE
                    </code>
                  </p>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

export default function AdminCreditsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <AdminCreditsContent />
    </Suspense>
  );
}
