"use client";

export type GenerationProgressEventDetail = {
  feature: string;
  generationId: string;
  pollUrl: string;
  workspaceId?: string;
  provider?: string;
  model?: string;
  status?: "queued" | "processing";
  totalCount?: number;
  completedCount?: number;
};

export function emitGenerationStarted(detail: GenerationProgressEventDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<GenerationProgressEventDetail>("eos:generation-started", { detail }));
}
