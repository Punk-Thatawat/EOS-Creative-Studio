import type { TranslationKey, TranslationParams } from "@/lib/i18n/dictionary";

type Translate = (key: TranslationKey, params?: TranslationParams) => string;

const schemaLabelKeys: Record<string, TranslationKey> = {
  duration: "create.video.common.duration",
  resolution: "create.video.common.resolution",
  outputresolution: "create.video.common.outputResolution",
  aspectratio: "create.video.common.aspectRatio",
  fps: "create.video.common.fps",
  cameramotion: "create.video.common.cameraMotion",
  generateaudio: "create.video.common.generateAudio",
  quality: "create.video.common.quality",
  characterorientation: "create.video.common.characterOrientation",
  keeporiginalsound: "create.video.common.keepOriginalSound",
  keepsound: "create.video.common.keepOriginalSound",
  modelparameters: "create.video.common.modelParameters",
  seed: "create.video.common.seed",
  guidance: "create.video.common.guidance",
  strength: "create.video.common.strength",
  steps: "create.video.common.steps",
  maskimage: "create.video.common.maskImage",
  image: "create.video.common.image",
  referenceaudios: "create.video.common.referenceAudios",
  referencevideos: "create.video.common.referenceVideos",
};

const schemaDescriptionKeys: Array<{ match: string; key: TranslationKey }> = [
  { match: "the resolution of the output video", key: "create.video.common.outputResolutionDescription" },
  { match: "the output video resolution", key: "create.video.common.outputResolutionDescription" },
  { match: "video resolution", key: "create.video.common.resolutionDescription" },
  { match: "the random seed to use for the generation", key: "create.video.common.seedDescription" },
  { match: "optional mask image to specify the person", key: "create.video.common.maskImageDescription" },
];

function normalize(value: string): string {
  return value.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function labelFromParameterName(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function translateVideoSchemaLabel(name: string, title: string | undefined, t: Translate): string {
  const key = schemaLabelKeys[normalize(name)] ?? (title ? schemaLabelKeys[normalize(title)] : undefined);
  return key ? t(key) : title ?? labelFromParameterName(name);
}

export function translateVideoSchemaDescription(description: string | undefined, t: Translate): string | undefined {
  if (!description) return undefined;
  const normalized = description.trim().toLowerCase();
  const match = schemaDescriptionKeys.find(({ match }) => normalized.startsWith(match));
  return match ? t(match.key) : description;
}

export function translateVideoSchemaOption(option: unknown, t: Translate): string {
  const value = String(option);
  const normalized = value.trim().toLowerCase();
  if (normalized.startsWith("the output video resolution")) return t("create.video.common.outputResolutionDescription");
  return value;
}
