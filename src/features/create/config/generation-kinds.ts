import type { GenerationKind } from "../types/generation";
import type { TranslationKey } from "@/lib/i18n/dictionary";

export const generationKinds = ["image", "video", "ai-presenter", "audio", "document", "workflow"] as const satisfies readonly GenerationKind[];

export const generationKindConfig: Record<GenerationKind, { titleKey: TranslationKey; descriptionKey: TranslationKey }> = {
  image: { titleKey: "create.kinds.image.title", descriptionKey: "create.kinds.image.description" },
  video: { titleKey: "create.kinds.video.title", descriptionKey: "create.kinds.video.description" },
  "ai-presenter": { titleKey: "create.kinds.aiPresenter.title", descriptionKey: "create.kinds.aiPresenter.description" },
  audio: { titleKey: "create.kinds.audio.title", descriptionKey: "create.kinds.audio.description" },
  document: { titleKey: "create.kinds.document.title", descriptionKey: "create.kinds.document.description" },
  workflow: { titleKey: "create.kinds.workflow.title", descriptionKey: "create.kinds.workflow.description" },
};

export function isGenerationKind(value: string): value is GenerationKind {
  return generationKinds.includes(value as GenerationKind);
}
