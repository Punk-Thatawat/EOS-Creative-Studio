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

export type GenerationCompletedEventDetail = {
  feature: string;
  generationId: string;
};

export const GENERATION_COMPLETED_EVENT = "eos:generation-completed";

export function emitGenerationStarted(detail: GenerationProgressEventDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<GenerationProgressEventDetail>("eos:generation-started", { detail }));
}

export function emitGenerationCompleted(detail: GenerationCompletedEventDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<GenerationCompletedEventDetail>(GENERATION_COMPLETED_EVENT, { detail }));
}
