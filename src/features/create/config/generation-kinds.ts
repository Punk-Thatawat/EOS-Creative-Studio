import type { GenerationKind } from "../types/generation";
import type { TranslationKey } from "@/lib/i18n/dictionary";

export const generationKinds = ["image", "video", "audio"] as const satisfies readonly GenerationKind[];

export const generationKindConfig: Record<GenerationKind, { titleKey: TranslationKey; descriptionKey: TranslationKey }> = {
  image: { titleKey: "create.kinds.image.title", descriptionKey: "create.kinds.image.description" },
  video: { titleKey: "create.kinds.video.title", descriptionKey: "create.kinds.video.description" },
  audio: { titleKey: "create.kinds.audio.title", descriptionKey: "create.kinds.audio.description" },
};

export function isGenerationKind(value: string): value is GenerationKind {
  return generationKinds.includes(value as GenerationKind);
}
