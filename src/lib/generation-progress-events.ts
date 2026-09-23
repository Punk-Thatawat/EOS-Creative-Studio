"use client";

export type GenerationProgressEventDetail = {
  feature: string;
  generationId?: string;
  pollUrl?: string;
  requestId?: string;
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

export type GenerationRequestEventDetail = {
  feature: string;
  requestId: string;
};

export const GENERATION_COMPLETED_EVENT = "eos:generation-completed";
export const GENERATION_REQUEST_FAILED_EVENT = "eos:generation-request-failed";
export const GENERATION_REQUEST_FINISHED_EVENT = "eos:generation-request-finished";

export function emitGenerationSubmitting(detail: GenerationRequestEventDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<GenerationRequestEventDetail>("eos:generation-submitting", { detail }));
}

export function emitGenerationStarted(detail: GenerationProgressEventDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<GenerationProgressEventDetail>("eos:generation-started", { detail }));
}

export function emitGenerationRequestFailed(detail: GenerationRequestEventDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<GenerationRequestEventDetail>(GENERATION_REQUEST_FAILED_EVENT, { detail }));
}

export function emitGenerationRequestFinished(detail: GenerationRequestEventDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<GenerationRequestEventDetail>(GENERATION_REQUEST_FINISHED_EVENT, { detail }));
}

export function emitGenerationCompleted(detail: GenerationCompletedEventDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<GenerationCompletedEventDetail>(GENERATION_COMPLETED_EVENT, { detail }));
}
