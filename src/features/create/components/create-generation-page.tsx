"use client";

import type { GenerationKind } from "../types/generation";
import { ImageGenerationPage } from "../image-generation/components/image-generation-page";
import { VideoGenerationPage } from "../video-generation-page";
import { AudioGenerationPage } from "../audio-generation/components/audio-generation-page";

export function CreateGenerationPage({ kind }: { kind: GenerationKind }) {
  if (kind === "image") return <ImageGenerationPage />;
  if (kind === "video") return <VideoGenerationPage />;
  if (kind === "audio") return <AudioGenerationPage />;
  return null;
}
