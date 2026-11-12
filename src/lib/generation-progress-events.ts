"use client";

import { emitCreditBalanceChanged, requestCreditBalanceSync } from "@/lib/credits/credit-events";

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
  /**
   * Credits this job will take. Pass it (use 0 when the price is not known) to make the
   * header balance follow the job: it drops when the job is accepted and is re-read from the
   * server when the job ends, whether it completed, failed or was cancelled. Leave it out when
   * the page keeps the header balance up to date itself.
   */
  creditCost?: number;
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
export const GENERATION_STARTED_EVENT = "eos:generation-started";
export const GENERATION_REQUEST_FAILED_EVENT = "eos:generation-request-failed";
export const GENERATION_REQUEST_FINISHED_EVENT = "eos:generation-request-finished";

export function emitGenerationSubmitting(detail: GenerationRequestEventDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<GenerationRequestEventDetail>("eos:generation-submitting", { detail }));
}

type TrackedCredits = { cost: number; requestId?: string; timer: number };

// Jobs whose credits the header follows, keyed by generation id.
const trackedCredits = new Map<string, TrackedCredits>();
// A job that never reports an ending must not keep the expected balance lowered forever.
const TRACKED_CREDITS_TIMEOUT_MS = 20 * 60_000;

function trackGenerationCredits(detail: GenerationProgressEventDetail): void {
  if (detail.creditCost === undefined || !detail.generationId || !detail.pollUrl) return;
  const generationId = detail.generationId;
  // Image jobs report progress on every poll; only the first report counts.
  if (trackedCredits.has(generationId)) return;
  const cost = Number.isFinite(detail.creditCost) && detail.creditCost > 0 ? detail.creditCost : 0;
  const timer = window.setTimeout(() => settleGenerationCredits({ generationId }), TRACKED_CREDITS_TIMEOUT_MS);
  trackedCredits.set(generationId, { cost, requestId: detail.requestId, timer });
  if (cost > 0) emitCreditBalanceChanged(cost);
}

/**
 * A job ended (completed, failed or cancelled). The backend has taken, or refunded, its credits
 * by now, so re-read the balance. Does nothing for jobs that were not tracked.
 */
export function settleGenerationCredits(ref: { generationId?: string; requestId?: string }): void {
  if (typeof window === "undefined") return;
  for (const [generationId, tracked] of [...trackedCredits]) {
    const matches = ref.generationId === generationId || (ref.requestId !== undefined && ref.requestId === tracked.requestId);
    if (!matches) continue;
    trackedCredits.delete(generationId);
    window.clearTimeout(tracked.timer);
    requestCreditBalanceSync(tracked.cost);
  }
}

export function emitGenerationStarted(detail: GenerationProgressEventDetail): void {
  if (typeof window === "undefined") return;
  trackGenerationCredits(detail);
  window.dispatchEvent(new CustomEvent<GenerationProgressEventDetail>(GENERATION_STARTED_EVENT, { detail }));
}

export function emitGenerationRequestFailed(detail: GenerationRequestEventDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<GenerationRequestEventDetail>(GENERATION_REQUEST_FAILED_EVENT, { detail }));
}

export function emitGenerationRequestFinished(detail: GenerationRequestEventDetail): void {
  if (typeof window === "undefined") return;
  settleGenerationCredits({ requestId: detail.requestId });
  window.dispatchEvent(new CustomEvent<GenerationRequestEventDetail>(GENERATION_REQUEST_FINISHED_EVENT, { detail }));
}

export function emitGenerationCompleted(detail: GenerationCompletedEventDetail): void {
  if (typeof window === "undefined") return;
  settleGenerationCredits({ generationId: detail.generationId });
  window.dispatchEvent(new CustomEvent<GenerationCompletedEventDetail>(GENERATION_COMPLETED_EVENT, { detail }));
}
