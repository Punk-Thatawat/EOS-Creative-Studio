import { useEffect, useState } from "react";
import { listGenerationModels, type GenerationModelOption } from "@/lib/api/generation-models";
import {
  quoteDirectVideoGeneration,
  type DirectVideoQuoteInput,
} from "@/lib/api/video-generations";
import { longClipLengths, longClipModels } from "./long-clip";
import {
  listTemplateGenerationModels,
  loadTemplateModelSettings,
  type TemplateModelMode,
  type TemplateModelSetting,
} from "@/lib/api/template-model-settings";
import { quoteImageGeneration, type ImageCreditQuoteInput } from "@/lib/api/generations";
import { useStudioCopy } from "@/lib/i18n/studio-copy";
import { type FlyoutOption } from "./edit-workspace";

/**
 * The models the creator offers for one feature, shaped for the model and quality pickers. Nothing is listed until they load
 * (or when the visitor is signed out), and the pickers then fall back to what the templates themselves say.
 */
// The modes Admin > Templates > Settings can choose models for, by the feature each mode creates with.
const templateModeByFeature: Record<string, TemplateModelMode> = { "text-to-video": "create", "motion-transfer": "motion", "video-swap": "motion" };

/** Keeps the models Admin chose to offer (never an empty list) and makes the chosen default the one that starts selected. */
function applyTemplateModelSetting(models: GenerationModelOption[], setting?: TemplateModelSetting): GenerationModelOption[] {
  if (!setting) return models;
  const offered = setting.visibleModels.length ? models.filter((m) => setting.visibleModels.includes(m.model)) : models;
  const list = offered.length ? offered : models;
  if (!setting.defaultModel || !list.some((m) => m.model === setting.defaultModel)) return list;
  return list.map((m) => ({ ...m, isDefault: m.model === setting.defaultModel }));
}

export function useModelPicker(feature: string, enabled = true) {
  const { c } = useStudioCopy();
  const [models, setModels] = useState<GenerationModelOption[]>([]);
  // Whether the list has been asked for and answered, so "no models" is not shown while it loads.
  const [ready, setReady] = useState(false);
  // The model Admin chose to start with (Templates settings), when it is offered; empty otherwise.
  const [preferredModel, setPreferredModel] = useState("");
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const mode = templateModeByFeature[feature];
    Promise.all([mode ? listTemplateGenerationModels(feature).catch(() => listGenerationModels(feature)) : listGenerationModels(feature), mode ? loadTemplateModelSettings() : Promise.resolve([])])
      .then(([list, settings]) => {
        if (alive) {
          const setting = settings.find((item) => item.mode === mode);
          const offered = applyTemplateModelSetting(list.filter((m) => m.enabled), setting);
          setModels(offered);
          setPreferredModel(setting?.defaultModel && offered.some((m) => m.model === setting.defaultModel) ? setting.defaultModel : "");
          setReady(true);
        }
      })
      .catch(() => {
        if (alive) {
          setModels([]);
          setReady(true);
        }
      });
    return () => {
      alive = false;
    };
  }, [feature, enabled]);
  // Whether the model's qualities are resolutions (720p) or named qualities (low, medium, high).
  const qualityKeyOf = (id: string): "resolution" | "quality" =>
    models.find((m) => m.model === id)?.capabilities.supportedResolutions?.length ? "resolution" : "quality";
  const qualitiesOf = (id: string): string[] => {
    const capabilities = models.find((m) => m.model === id)?.capabilities;
    return capabilities?.supportedResolutions?.length ? capabilities.supportedResolutions : (capabilities?.qualityValues ?? []);
  };
  const options: FlyoutOption[] = models.map((m) => ({
    id: m.model,
    label: m.displayName || m.model,
    chips: qualitiesOf(m.model).slice(0, 4),
    badge: m.isDefault ? c("templates.sortRecommended") : undefined,
  }));
  const labelOf = (id: string) => options.find((o) => o.id === id)?.label ?? id;
  // The aspect ratios the model accepts; empty when it does not say.
  const ratiosOf = (id: string): string[] => {
    const capabilities = models.find((m) => m.model === id)?.capabilities;
    return capabilities?.supportedAspectRatios?.length ? capabilities.supportedAspectRatios : (capabilities?.supportedRatios ?? []);
  };
  // The length to ask for: the wanted one when the model takes it, else the closest it allows (Omni only takes 3 to 10 seconds).
  const durationFor = (id: string, wanted: number): number => {
    const property = models.find((m) => m.model === id)?.capabilities.apiSchema?.request_schema?.properties?.duration;
    if (longerThanOnce(id) && longClipLengths.includes(wanted)) return wanted;
    const allowed = Array.isArray(property?.enum) ? property.enum.filter((value): value is number => typeof value === "number") : [];
    if (allowed.length) return allowed.includes(wanted) ? wanted : allowed.reduce((best, value) => (Math.abs(value - wanted) < Math.abs(best - wanted) ? value : best));
    if (typeof property?.minimum === "number" && wanted < property.minimum) return property.minimum;
    if (typeof property?.maximum === "number" && wanted > property.maximum) return property.maximum;
    return wanted;
  };
  // The most the model makes at once, and whether a longer clip can be had by extending it.
  const onceOf = (id: string): number | undefined => {
    const maximum = models.find((m) => m.model === id)?.capabilities.apiSchema?.request_schema?.properties?.duration?.maximum;
    return typeof maximum === "number" ? maximum : undefined;
  };
  const longerThanOnce = (id: string) => longClipModels.test(id) && onceOf(id) === 30;
  // Where the model takes reference images, if it does: the parameter name and whether it wants a list.
  const referenceOf = (id: string): { parameter: string; list: boolean; maxImages?: number } | null => {
    const capabilities = models.find((m) => m.model === id)?.capabilities;
    const properties = capabilities?.apiSchema?.request_schema?.properties ?? {};
    const parameter =
      capabilities?.referenceImagesParameter ??
      capabilities?.imageParameter ??
      Object.keys(properties).find((key) => ["referenceImage", "reference_image", "referenceImages", "reference_images", "image", "image_url"].includes(key));
    const maxItems = parameter ? properties[parameter]?.maxItems : undefined;
    return parameter ? { parameter, list: properties[parameter]?.type === "array", ...(typeof maxItems === "number" ? { maxImages: maxItems } : {}) } : null;
  };
  // The lengths (in seconds) the model takes: its own list, or the usual steps between its shortest and longest.
  const durationsOf = (id: string): number[] => [...ownDurationsOf(id), ...(longerThanOnce(id) ? longClipLengths : [])];
  const ownDurationsOf = (id: string): number[] => {
    const property = models.find((m) => m.model === id)?.capabilities.apiSchema?.request_schema?.properties?.duration;
    const allowed = Array.isArray(property?.enum) ? property.enum.filter((value): value is number => typeof value === "number") : [];
    if (allowed.length) return allowed;
    if (typeof property?.minimum === "number" && typeof property?.maximum === "number") {
      const { minimum, maximum } = property;
      const steps = [4, 5, 6, 8, 10, 12, 15, 20, 25, 30].filter((value) => value > minimum && value < maximum);
      return [minimum, ...steps, maximum];
    }
    return [];
  };
  // What a swap model can swap (person, object, background), when it has that choice.
  const modesOf = (id: string): string[] => {
    const property = models.find((m) => m.model === id)?.capabilities.apiSchema?.request_schema?.properties?.mode;
    return Array.isArray(property?.enum) ? property.enum.filter((value): value is string => value === "person" || value === "object" || value === "background") : [];
  };
  return { options, ready, preferredModel, defaultModel: models.find((model) => model.isDefault)?.model ?? models[0]?.model ?? "", qualitiesOf, qualityKeyOf, ratiosOf, durationFor, durationsOf, onceOf, referenceOf, modesOf, labelOf };
}

/**
 * What a workflow costs in all: the image step plus the video step, each quoted by the creator's own endpoints. Null until
 * both models and qualities are picked, or when either quote cannot be given.
 */
export function useWorkflowQuote(
  input: { imageModel: string; imageKey: "resolution" | "quality"; imageQuality: string; imageRatio: string; videoModel: string; videoQuality: string; duration: number; aspectRatio: string } | null,
): number | null {
  const key = JSON.stringify(input);
  const [quote, setQuote] = useState<{ key: string; credits: number } | null>(null);
  useEffect(() => {
    if (!input) return;
    let alive = true;
    const timer = window.setTimeout(() => {
      const imageQuote: ImageCreditQuoteInput = { feature: "text-to-image", model: input.imageModel, ratio: input.imageRatio as ImageCreditQuoteInput["ratio"], count: "1" as ImageCreditQuoteInput["count"], [input.imageKey]: input.imageQuality };
      Promise.all([
        quoteImageGeneration(imageQuote),
        quoteDirectVideoGeneration({ feature: "image-to-video", model: input.videoModel, resolution: input.videoQuality, duration: input.duration, aspectRatio: input.aspectRatio }),
      ])
        .then(([image, video]) => {
          if (alive && typeof image.creditCost === "number" && typeof video.creditCost === "number") setQuote({ key, credits: image.creditCost + video.creditCost });
        })
        .catch(() => {});
    }, 350);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
    // The key stands for the whole input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return quote?.key === key ? quote.credits : null;
}

/**
 * What the creator would charge for the chosen model and quality, from its own quote endpoint. Null until a model is picked or
 * while the answer is on its way (or when the quote cannot be given), so the button then shows no price rather than a guess.
 */
export function useCreditQuote(input: Pick<DirectVideoQuoteInput, "feature" | "model" | "aspectRatio" | "sourceVideo" | "referenceImageCount"> & { resolution?: string; duration?: number; retry?: number }): number | null {
  const { feature, model, resolution, duration, aspectRatio, sourceVideo, referenceImageCount, retry } = input;
  const key = [feature, model, resolution, duration, aspectRatio, sourceVideo, referenceImageCount, retry].join("|");
  const [quote, setQuote] = useState<{ key: string; credits: number } | null>(null);
  useEffect(() => {
    if (!model) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      quoteDirectVideoGeneration({ feature, model, resolution, duration, aspectRatio, sourceVideo, referenceImageCount }, controller.signal)
        .then((result) => {
          if (typeof result.creditCost === "number") setQuote({ key, credits: result.creditCost });
        })
        .catch(() => {});
    }, 300);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [key, feature, model, resolution, duration, aspectRatio, sourceVideo, referenceImageCount]);
  return quote?.key === key ? quote.credits : null;
}

export const creditText = (credits: number | null) => (credits === null ? "" : String(Math.round(credits * 10) / 10));
