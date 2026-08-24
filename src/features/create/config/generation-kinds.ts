import type { GenerationKind } from "../types/generation";

export const generationKinds = ["image", "video", "ai-presenter", "audio", "document", "workflow"] as const satisfies readonly GenerationKind[];

export const generationKindConfig: Record<GenerationKind, { title: string; description: string }> = {
  image: { title: "Generate an image", description: "Create a focused visual brief with the direction and format you need." },
  video: { title: "Generate a video", description: "Define the story, pacing, and visual direction for your next video concept." },
  "ai-presenter": { title: "Create an AI presenter", description: "Prepare a presenter-led content brief for a future generation workflow." },
  audio: { title: "Generate audio", description: "Set the voice, feeling, and format for your audio idea." },
  document: { title: "Create a document", description: "Build a structured document brief with AI and OCR-ready inputs." },
  workflow: { title: "Build a custom workflow", description: "Design a repeatable creative workflow for your team." },
};

export function isGenerationKind(value: string): value is GenerationKind {
  return generationKinds.includes(value as GenerationKind);
}
