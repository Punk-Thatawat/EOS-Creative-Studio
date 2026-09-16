"use client";

import { useEffect, useRef } from "react";
import { listGenerationHistory, type GenerationHistoryItem } from "@/lib/api/generations";
import { AUTH_SESSION_UPDATED_EVENT } from "@/lib/auth/auth-events";

export type ResumableVideoStatus = {
  id?: string;
  generationId?: string;
  workspaceId?: string;
  status: string;
  progress?: number;
  totalCount?: number;
  completedCount?: number;
  output?: Array<{ url?: string; mimeType?: string; type?: string }>;
  finalVideoUrl?: string;
  videoUrl?: string;
  errorMessage?: string;
  errorCode?: string;
  errorSource?: "system" | "provider";
};

type UseVideoGenerationResumeOptions = {
  feature: string;
  isGenerating: boolean;
  loadStatus: (pollUrl: string, signal: AbortSignal) => Promise<ResumableVideoStatus>;
  onStatus: (status: ResumableVideoStatus, generation: GenerationHistoryItem) => void;
};

function waitForNextPoll(signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Generation resume cancelled", "AbortError"));
      return;
    }

    const timeoutId = window.setTimeout(() => {
      signal.removeEventListener("abort", handleAbort);
      resolve();
    }, 2500);
    const handleAbort = () => {
      window.clearTimeout(timeoutId);
      reject(new DOMException("Generation resume cancelled", "AbortError"));
    };
    signal.addEventListener("abort", handleAbort, { once: true });
  });
}

function activeGenerationForFeature(history: GenerationHistoryItem[]): GenerationHistoryItem | null {
  return history.find((item) => item.status === "queued" || item.status === "processing") ?? null;
}

function initialResumedStatus(generation: GenerationHistoryItem): ResumableVideoStatus {
  return {
    id: generation.id,
    generationId: generation.id,
    ...(generation.workspaceId ? { workspaceId: generation.workspaceId } : {}),
    status: generation.status,
    totalCount: generation.totalCount,
    completedCount: generation.completedCount,
    output: generation.output ?? [],
    ...(generation.finalVideoUrl ? { finalVideoUrl: generation.finalVideoUrl } : {}),
    ...(generation.videoUrl ? { videoUrl: generation.videoUrl } : {}),
    ...(generation.errorMessage ? { errorMessage: generation.errorMessage } : {}),
    ...(generation.errorCode ? { errorCode: generation.errorCode } : {}),
    ...(generation.errorSource ? { errorSource: generation.errorSource } : {}),
  };
}

/**
 * Rehydrates a video workspace from the server after a tab/page/auth change.
 * The actual generation is owned by the backend queue, so the browser only
 * needs to resume status polling and repaint the workspace state.
 */
export function useVideoGenerationResume({ feature, isGenerating, loadStatus, onStatus }: UseVideoGenerationResumeOptions): void {
  const isGeneratingRef = useRef(isGenerating);
  const loadStatusRef = useRef(loadStatus);
  const onStatusRef = useRef(onStatus);
  const activeRequestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    isGeneratingRef.current = isGenerating;
    loadStatusRef.current = loadStatus;
    onStatusRef.current = onStatus;
  }, [isGenerating, loadStatus, onStatus]);

  useEffect(() => {
    let disposed = false;

    const resumeLatest = async () => {
      if (disposed || isGeneratingRef.current || activeRequestRef.current) return;

      const lookupController = new AbortController();
      activeRequestRef.current = lookupController;
      let requestController: AbortController = lookupController;
      let lookupTimeoutId: number | undefined;
      try {
        lookupTimeoutId = window.setTimeout(() => lookupController.abort(), 15_000);
        const history = await listGenerationHistory(undefined, feature, { signal: lookupController.signal });
        if (disposed || lookupController.signal.aborted || isGeneratingRef.current) return;

        const generation = activeGenerationForFeature(history);
        if (!generation) return;

        const pollUrl = generation.pollUrl ?? `/api/v1/generations/${encodeURIComponent(generation.id)}/status`;
        const pollController = new AbortController();
        requestController = pollController;
        activeRequestRef.current = pollController;
        onStatusRef.current(initialResumedStatus(generation), generation);

        let status = initialResumedStatus(generation);
        while (!disposed && !pollController.signal.aborted) {
          status = await loadStatusRef.current(pollUrl, pollController.signal);
          if (disposed || pollController.signal.aborted) return;
          onStatusRef.current(status, generation);
          if (status.status === "completed" || status.status === "failed" || status.status === "cancelled") return;
          await waitForNextPoll(pollController.signal);
        }
      } catch {
        // A transient auth/network failure must not mark a real generation as
        // failed. Focus, visibility, or the next login retries the lookup.
      } finally {
        if (lookupTimeoutId !== undefined) window.clearTimeout(lookupTimeoutId);
        if (activeRequestRef.current === requestController) activeRequestRef.current = null;
      }
    };

    const retry = () => { void resumeLatest(); };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") retry();
    };

    retry();
    window.addEventListener("focus", retry);
    window.addEventListener("pageshow", retry);
    window.addEventListener(AUTH_SESSION_UPDATED_EVENT, retry);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      disposed = true;
      window.removeEventListener("focus", retry);
      window.removeEventListener("pageshow", retry);
      window.removeEventListener(AUTH_SESSION_UPDATED_EVENT, retry);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      activeRequestRef.current?.abort();
      activeRequestRef.current = null;
    };
  }, [feature]);
}
