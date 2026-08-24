export const imageGenerationTabs = ["Text to Image", "Image to Image", "AI Style Transfer", "AI Background", "Upscale", "Extend Image"] as const;
export type ImageGenerationTab = typeof imageGenerationTabs[number];

export const backgroundModes = [
  { id: "remove", label: "Remove Background", shortLabel: "Remove", description: "Cut out the subject cleanly" },
  { id: "replace", label: "Replace Background", shortLabel: "Replace", description: "Swap in a new scene" },
  { id: "generate", label: "Generate Background", shortLabel: "Generate", description: "Create a background from a prompt" },
  { id: "solid", label: "Solid Color", shortLabel: "Solid Color", description: "Fill the cutout with a selected color" },
] as const;
export type BackgroundMode = typeof backgroundModes[number]["id"];
export type BackgroundPreviewMode = "before" | "after" | "mask";
export type MaskTool = "brush" | "lasso" | "eraser";
export const extendDirections = ["left", "right", "top", "bottom", "all"] as const;
export type ExtendDirection = typeof extendDirections[number];
export const extendAmounts = ["25%", "50%", "100%"] as const;
export type ExtendAmount = typeof extendAmounts[number];

export const stylePresets = ["Realistic", "Cyberpunk", "Cinematic", "3D Render", "Anime"] as const;
export type StylePreset = string;

export const styleTransferPresets = [
  { name: "Anime", image: "/generated-assets/style-anime.png" },
  { name: "Watercolor", image: "/generated-assets/style-cinematic.png" },
  { name: "Oil Painting", image: "/generated-assets/style-realistic.png" },
  { name: "Cyberpunk", image: "/generated-assets/style-cyberpunk.png" },
] as const;
export type StyleTransferPreset = string;
export type StyleSourceMode = "preset" | "reference";

export const stylePresetImages = [
  "/generated-assets/style-realistic.png",
  "/generated-assets/style-cyberpunk.png",
  "/generated-assets/style-cinematic.png",
  "/generated-assets/style-3d-render.png",
  "/generated-assets/style-anime.png",
] as const;

export const imageRatios = ["1:1", "16:9", "4:3", "3:4", "9:16"] as const;
export type ImageRatio = typeof imageRatios[number];

export const imageRatioSizes: Record<ImageRatio, string> = {
  "1:1": "1024 x 1024",
  "16:9": "1280 x 720",
  "4:3": "1152 x 864",
  "3:4": "864 x 1152",
  "9:16": "720 x 1280",
};

export const imageResolutionOptions: Record<ImageRatio, readonly string[]> = {
  "1:1": ["HD", "2K", "4K"],
  "16:9": ["720p", "2K", "4K"],
  "4:3": ["HD", "2K", "4K"],
  "3:4": ["HD", "2K", "4K"],
  "9:16": ["HD", "2K", "4K"],
};

export const imageResolutionSizes: Record<ImageRatio, Record<string, string>> = {
  "1:1": { HD: "1024 x 1024", "2K": "2048 x 2048", "4K": "4096 x 4096" },
  "16:9": { "720p": "1280 x 720", "2K": "2560 x 1440", "4K": "3840 x 2160" },
  "4:3": { HD: "1152 x 864", "2K": "2048 x 1536", "4K": "4096 x 3072" },
  "3:4": { HD: "864 x 1152", "2K": "1536 x 2048", "4K": "3072 x 4096" },
  "9:16": { HD: "720 x 1280", "2K": "1440 x 2560", "4K": "2160 x 3840" },
};

export function providerSizeForResolution(ratio: ImageRatio, resolution: string): string {
  return (imageResolutionSizes[ratio][resolution] ?? imageRatioSizes[ratio]).replace(/\s+x\s+/g, "*");
}

function normalizeSize(value: string): string {
  return value.toLowerCase().replace(/\s/g, "").replace(/[×x]/g, "*");
}

function ratioFromSize(value: string): ImageRatio | null {
  const match = value.match(/(\d+)\D+(\d+)/);
  if (!match) return null;
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!width || !height) return null;
  const target = width / height;
  const best = imageRatios.reduce<{ ratio: ImageRatio | null; distance: number }>((currentBest, ratio) => {
    const [ratioWidth, ratioHeight] = ratio.split(":").map(Number);
    const distance = Math.abs(target - ratioWidth / ratioHeight);
    return distance < currentBest.distance ? { ratio, distance } : currentBest;
  }, { ratio: null, distance: Number.POSITIVE_INFINITY });
  return best.distance < 0.03 ? best.ratio : null;
}

function normalizeCapabilitySize(value: string): string {
  return normalizeSize(value).replace(/x/gi, "*").replace(/\u00d7/g, "*");
}

export function supportedRatiosForModel(supportedSizes?: string[], supportedRatios?: string[]): ImageRatio[] {
  const explicitRatios = (supportedRatios ?? []).filter((value): value is ImageRatio => imageRatios.includes(value as ImageRatio));
  if (explicitRatios.length > 0) return explicitRatios;
  if (!supportedSizes || supportedSizes.length === 0) return [...imageRatios];

  const inferredRatios = new Set<ImageRatio>();
  for (const size of supportedSizes) {
    const ratio = ratioFromSize(size);
    if (ratio) inferredRatios.add(ratio);
  }
  return inferredRatios.size > 0 ? imageRatios.filter((ratio) => inferredRatios.has(ratio)) : [...imageRatios];
}

export function supportedResolutionOptions(ratio: ImageRatio, supportedSizes?: string[], supportedResolutions?: string[]): string[] {
  if (supportedResolutions && supportedResolutions.length > 0) {
    const mapped = supportedResolutions.flatMap((value) => {
      const normalized = value.toLowerCase().replace(/\s/g, "");
      if (normalized.includes("8k") || normalized.includes("8192")) return ["8K"];
      if (normalized.includes("4k") || normalized.includes("4096")) return ["4K"];
      if (normalized.includes("2k") || normalized.includes("2048")) return ["2K"];
      if (normalized.includes("720p")) return ["720p"];
      if (normalized.includes("1k") || normalized.includes("1024")) return [ratio === "16:9" ? "720p" : "HD"];
      return [];
    });
    if (mapped.length > 0) return Array.from(new Set(mapped));
  }
  const options = [...imageResolutionOptions[ratio]];
  if (!supportedSizes || supportedSizes.length === 0) return options;
  const normalizedSizes = supportedSizes.map(normalizeCapabilitySize);
  const knownSizes = imageRatios.flatMap((supportedRatio) => imageResolutionOptions[supportedRatio].map((resolution) => normalizeCapabilitySize(providerSizeForResolution(supportedRatio, resolution))));
  if (!normalizedSizes.some((size) => knownSizes.includes(size))) return options;
  return options.filter((resolution) => normalizedSizes.includes(normalizeCapabilitySize(providerSizeForResolution(ratio, resolution))));
}

export function supportedQualityOptions(qualityValues?: string[]): ImageQuality[] {
  if (!qualityValues || qualityValues.length === 0) return [...qualityOptions];
  return Array.from(new Set(qualityValues.filter(Boolean)));
}

export const qualityOptions = ["Draft", "Standard", "High", "Ultra"] as const;
export const promptQualityOptions = ["low", "medium", "high"] as const;
export type ImageQuality = string;

export const imageCountOptions = ["1", "2", "4", "8"] as const;
export type ImageCount = string;

export const powerUpTools = [
  ["AI Background", "Create stunning backgrounds"],
  ["Remove Object", "Clean your image in one click"],
  ["Upscale Image", "Increase resolution without losing quality"],
  ["Color Grading", "Apply cinematic color tones"],
  ["Remove Text", "Erase text & logos"],
  ["Magic Expand", "Extend beyond image borders"],
] as const;
