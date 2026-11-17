import { type AdminModelRoutesOverview } from "@/lib/api/generation-models";
import { type AdminAudioSettings } from "@/lib/api/audio";
import { type OcrDocumentTypeInfo } from "@/lib/api/document-ocr";
import {
  previewAdminCreditPricingRules,
  type CreditPricingPreview,
} from "@/lib/api/credit-pricing";
import { type PricingCategoryFilter, type PricingRow } from "./pricing.types";
import {
  PRICING_PREVIEW_BATCH_SIZE,
  UNUSED_VOICE_CLONE_MODELS,
  audioFeatureKeys,
  documentFeatureKeys,
  featureLabels,
  featureOrder,
  presenterFeatureKeys,
  videoFeatureKeys,
} from "./pricing.constants";

export function matchesPricingCategory(featureKey: string, category: PricingCategoryFilter) {
  if (category === "all") return true;
  if (category === "presenter") return presenterFeatureKeys.has(featureKey);
  if (category === "document") return documentFeatureKeys.has(featureKey);
  if (category === "audio") return audioFeatureKeys.has(featureKey);
  if (category === "video") return videoFeatureKeys.has(featureKey) && !presenterFeatureKeys.has(featureKey);
  return !videoFeatureKeys.has(featureKey) && !audioFeatureKeys.has(featureKey) && !documentFeatureKeys.has(featureKey);
}

export function rowKey(row: PricingRow) {
  return `${row.provider}:${row.model}:${row.featureKey}`;
}

export async function previewPricingRowsInBatches(
  models: Array<{
    provider: string;
    model: string;
    featureKey?: string;
    input?: Record<string, unknown>;
  }>,
): Promise<CreditPricingPreview[]> {
  const previews: CreditPricingPreview[] = [];
  for (let start = 0; start < models.length; start += PRICING_PREVIEW_BATCH_SIZE) {
    const batch = models.slice(start, start + PRICING_PREVIEW_BATCH_SIZE);
    previews.push(...(await previewAdminCreditPricingRules(batch)));
  }
  return previews;
}

export function modelRowsFromOverview(
  overview: AdminModelRoutesOverview,
): PricingRow[] {
  const rows: PricingRow[] = [];
  for (const featureKey of featureOrder) {
    if (audioFeatureKeys.has(featureKey) || featureKey === "document-ocr") continue;
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
        unit: presenterFeatureKeys.has(featureKey)
          ? "Per scene · 13 sec sample"
          : documentFeatureKeys.has(featureKey)
            ? "Per document · token estimate"
            : videoFeatureKeys.has(featureKey)
              ? "Per video"
              : "Per image",
        note:
          presenterFeatureKeys.has(featureKey)
            ? "Provider quote for one 13-second scene; configure duration for a different estimate"
            : documentFeatureKeys.has(featureKey)
            ? "Estimate: 2,000 input + 1,000 output tokens; current Document billing remains unchanged"
            : route.provider === "wavespeed"
            ? "Live quote from provider"
            : "Fallback until provider quote is available",
        capabilities: route.capabilities,
      });
    }
  }
  return rows;
}

function readableDocumentType(documentType: string) {
  return documentType.replace(/-/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

export function documentOcrPricingRows(types: OcrDocumentTypeInfo[]): PricingRow[] {
  const rows: PricingRow[] = [];
  for (const type of types) {
    const name = readableDocumentType(type.id);
    const add = (variant: string, output: string) => rows.push({
      feature: featureLabels["document-ocr"],
      featureKey: "document-ocr",
      model: `document-ocr/${type.id}/${variant}`,
      provider: "iapp",
      displayName: `${name} · ${output}`,
      unit: "Per page",
      note: "iApp published rate at 1.25 THB / IC · Document billing remains unchanged",
    });
    add("basic", "Text / JSON");
    if (type.depths?.includes("advanced")) add("advanced", "Layout");
    if (type.outputFormats.includes("docx")) add("docx", "DOCX export");
    if (type.outputFormats.includes("pdf")) add("pdf", "Searchable PDF");
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
          : model === "eleven_v4" || model === "elevenlabs/eleven-v4"
            ? "Eleven v4"
          : model === "music_v1"
            ? "ElevenLabs Music v1"
            : model === "music_v2"
              ? "ElevenLabs Music v2"
              : model;
}

export function audioPricingRows(settings: AdminAudioSettings): PricingRow[] {
  const rows: PricingRow[] = [];
  const addProfileRows = (
    featureKey: string,
    profile: AdminAudioSettings["featureProfiles"]["textToSpeech"],
    provider: string,
    unit: string,
    note: string,
  ) => {
    const modelIds = new Set([...Object.keys(profile.models), profile.modelId]);
    modelIds.forEach((model) => {
      if (!model || model === "internal") return;
      // MiniMax speech models are always served through WaveSpeed, even when
      // the general Text-to-Speech route is configured as ElevenLabs.
      const modelProvider =
        featureKey === "audio" &&
        model.trim().toLowerCase().startsWith("minimax/speech-")
          ? "wavespeed"
          : provider;
      rows.push({
        feature: featureLabels[featureKey] ?? featureKey,
        featureKey,
        model,
        provider: modelProvider,
        displayName: audioModelName(model),
        unit,
        note,
      });
    });
  };

  addProfileRows(
    "audio",
    settings.featureProfiles.textToSpeech,
    settings.routing.textToSpeech,
    "Per scene",
    "Provider quote by text length",
  );
  addProfileRows(
    "podcastDialogue",
    settings.featureProfiles.podcastDialogue,
    settings.routing.podcastDialogue,
    "Per dialogue",
    "Provider quote by spoken text length",
  );

  const cloneModels = new Set([
    ...Object.keys(settings.featureProfiles.voiceClone.models),
    settings.featureProfiles.voiceClone.modelId,
    "minimax/voice-clone",
  ]);
  cloneModels.forEach((model) => {
    if (
      !model ||
      model === "internal" ||
      UNUSED_VOICE_CLONE_MODELS.has(model.trim().toLowerCase())
    ) return;
    rows.push({
      feature: featureLabels["audio-voice-clone"],
      featureKey: "audio-voice-clone",
      model,
      provider: settings.routing.voiceClone,
      displayName: audioModelName(model),
      unit: model.trim().toLowerCase() === "minimax/voice-clone" ? "Per clone registration" : "Per voice preview",
      note: model.trim().toLowerCase() === "minimax/voice-clone"
        ? "WaveSpeed quote for MiniMax voice-clone creation"
        : "WaveSpeed quote for speech generated with a cloned voice",
    });
  });

  rows.push(
    {
      feature: featureLabels["audio-text-to-music"],
      featureKey: "audio-text-to-music",
      model: "sonilo/text-to-music",
      provider: "wavespeed",
      displayName: "Sonilo Text-to-Music",
      unit: "Per second · 10 second minimum",
      note: "WaveSpeed Sonilo · $0.0025 / second",
    },
    {
      feature: featureLabels["audio-sound-effects"],
      featureKey: "audio-sound-effects",
      model: "sonilo/v1/text-to-sfx",
      provider: settings.routing.soundEffects,
      displayName: "Sonilo Text-to-SFX",
      unit: "Per second · variations",
      note: "WaveSpeed Sonilo · $0.002 / second",
    },
    {
      feature: featureLabels["audio-sound-effects"],
      featureKey: "video-to-sfx",
      model: "sonilo/v1/video-to-sfx",
      provider: settings.routing.soundEffects,
      displayName: "Sonilo Video-to-SFX",
      unit: "Per video second",
      note: "WaveSpeed Sonilo · $0.009 / second",
    },
    {
      feature: featureLabels["audio-cleanup"],
      featureKey: "audio-cleanup",
      model: "voice_isolator",
      provider: "elevenlabs",
      displayName: "ElevenLabs Voice Isolator",
      unit: "Per audio minute",
      note: "Used when paid cleanup tools are selected",
    },
  );

  const hasGeneratedMusicPreset = settings.backgroundMusicPresets.some(
    (preset) => preset.isActive && !preset.audioUrl && preset.prompt.trim(),
  );
  if (hasGeneratedMusicPreset) {
    rows.push({
      feature: featureLabels["audio-music"],
      featureKey: "audio-music",
      model: "elevenlabs/music",
      provider: "wavespeed",
      displayName: audioModelName("elevenlabs/music"),
      unit: "Per background track",
      note: "Background music add-on for speech and dialogue",
    });
  }
  return rows;
}
