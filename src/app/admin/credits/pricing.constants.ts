import { type PricingRow } from "./pricing.types";

export const MAX_TARGET_MARKUP_PERCENT = 999.99;
export const MAX_TARGET_MARKUP_RATIO = MAX_TARGET_MARKUP_PERCENT / 100;

export const featureLabels: Record<string, string> = {
  "text-to-image": "Text to Image",
  "image-to-image": "Image to Image",
  "image-to-video": "Image to Video",
  "video-to-sfx": "Sound Effects",
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
  "audio-music": "Background Music Add-on",
  podcastDialogue: "Podcast & Dialogue",
  "audio-voice-clone": "Voice Clone",
  "audio-sound-effects": "Sound Effects",
  "audio-text-to-music": "Text to Music",
  "audio-cleanup": "Audio Cleanup",
  document: "Document",
  "document-ocr": "Document OCR",
  "document-summary": "Document Summary",
  "document-translate": "Document Translation",
  "document-contract": "Contract Review",
  "document-report": "Document Report",
  "document-form": "Form Reading",
  "ai-presenter": "AI Presenter",
};

export const featureOrder = [
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
  "ai-presenter",
  "audio",
  "podcastDialogue",
  "audio-voice-clone",
  "audio-sound-effects",
  "audio-text-to-music",
  "audio-cleanup",
  "audio-music",
  "document",
  "document-ocr",
  "document-summary",
  "document-translate",
  "document-contract",
  "document-report",
  "document-form",
];

export const videoFeatureKeys = new Set([
  "video",
  "image-to-video",
  "video-to-music",
  "text-to-video",
  "people-video",
  "motion-transfer",
  "lipsync",
  "extend-video",
  "ai-presenter",
]);

export const presenterFeatureKeys = new Set(["ai-presenter"]);
export const documentFeatureKeys = new Set([
  "document",
  "document-ocr",
  "document-summary",
  "document-translate",
  "document-contract",
  "document-report",
  "document-form",
]);

export const audioFeatureKeys = new Set([
  "audio",
  "audio-music",
  "podcastDialogue",
  "audio-voice-clone",
  "audio-sound-effects",
  "audio-text-to-music",
  "video-to-sfx",
  "audio-cleanup",
]);

export const audioFeatureGroups: Array<{ key: string; featureKeys: readonly string[] }> = [
  { key: "audio", featureKeys: ["audio", "audio-music"] },
  { key: "podcastDialogue", featureKeys: ["podcastDialogue"] },
  { key: "audio-voice-clone", featureKeys: ["audio-voice-clone"] },
  { key: "audio-sound-effects", featureKeys: ["audio-sound-effects", "video-to-sfx"] },
  { key: "audio-text-to-music", featureKeys: ["audio-text-to-music"] },
  { key: "audio-cleanup", featureKeys: ["audio-cleanup"] },
];

export const fallbackModelRows: PricingRow[] = [
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

export const PRICING_PREVIEW_BATCH_SIZE = 50;
export const UNUSED_VOICE_CLONE_MODELS = new Set([
  "eleven_v3",
  "elevenlabs_v3",
  "elevenlabs/eleven-v3",
  "eleven_multilingual_v2",
  "elevenlabs_multilingual_v2",
  "elevenlabs/multilingual-v2",
]);

export const pricingParameterPattern =
  /(count|num[_-]?images?|batch|size|resolution|aspect|quality|duration|seconds?|frames?|fps|length|steps|audio|video|output[_-]?type)/i;
export const nonPricingParameters = new Set([
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
