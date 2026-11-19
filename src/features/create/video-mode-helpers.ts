import { type ActiveVideoTab, type GenerationMode } from "./video-generation.types";
import { mobileVideoModeOptions } from "./video-generation.constants";

export function isActiveVideoTab(value: string | null): value is ActiveVideoTab {
  return mobileVideoModeOptions.some((option) => option.value === value);
}

export function videoModeRouteFeature(mode: GenerationMode): string {
  return mode === "image-to-video" ? "image-to-video" : `image-to-video:${mode}`;
}

export function isSingleSceneGenerationMode(mode: GenerationMode): boolean {
  return mode === "image-to-video" || mode === "reference-to-video";
}

export function isStorylinePromptMode(mode: GenerationMode): boolean {
  return mode === "single-image" || mode === "multi-scene";
}
