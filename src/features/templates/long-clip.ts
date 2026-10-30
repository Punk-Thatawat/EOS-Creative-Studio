"use client";

import { useEffect } from "react";
import { createExtendVideoGeneration, getExtendVideoGenerationStatus } from "@/lib/api/extend-video-generations";
import { emitGenerationStarted } from "@/lib/generation-progress-events";

/**
 * Seedance 2.5 makes up to 30 seconds in one go. A longer clip is made in two steps: the first part, then the model's own
 * "extend" for the rest (it hands back the first part with the new seconds joined on). The page keeps the second step
 * here until the first part is done, so it carries on even after the page was closed and opened again.
 */
export const longClipModels = /\/seedance-2\.5\/(text-to-video|reference-to-video|image-to-video)(-turbo)?$/;
export const longClipExtender = "bytedance/seedance-2.5/video-extend";
/** The lengths offered above what the model makes at once. */
export const longClipLengths = [45, 60];

export type PendingExtension = {
  generationId: string;
  pollUrl: string;
  prompt: string;
  duration: number;
  resolution?: string;
  aspectRatio?: string;
  templateSlug?: string;
  queuedAt: number;
};

const storageKey = "eos.templates.pendingExtensions";
const giveUpAfter = 3 * 60 * 60 * 1000;

function readPending(): PendingExtension[] {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(storageKey) ?? "[]");
    return Array.isArray(value) ? value.filter((entry): entry is PendingExtension => typeof entry?.generationId === "string" && typeof entry?.pollUrl === "string") : [];
  } catch {
    return [];
  }
}

function writePending(list: PendingExtension[]) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(list.slice(-20)));
  } catch {
    // Without storage the second part only follows while this page stays open.
  }
}

export function queueExtension(entry: Omit<PendingExtension, "queuedAt">) {
  writePending([...readPending().filter((item) => item.generationId !== entry.generationId), { ...entry, queuedAt: Date.now() }]);
  window.dispatchEvent(new Event("eos:pending-extension"));
}

/** Starts the second part of every long clip whose first part is done; drops the ones that failed. */
export function useExtensionQueue() {
  useEffect(() => {
    let alive = true;
    let busy = false;
    const check = async () => {
      if (busy) return;
      busy = true;
      try {
        for (const entry of readPending()) {
          if (!alive) return;
          const remove = () => writePending(readPending().filter((item) => item.generationId !== entry.generationId));
          if (Date.now() - entry.queuedAt > giveUpAfter) {
            remove();
            continue;
          }
          let status;
          try {
            status = await getExtendVideoGenerationStatus(entry.pollUrl);
          } catch {
            continue;
          }
          if (status.status === "failed" || status.status === "cancelled") {
            remove();
            continue;
          }
          const clip = status.status === "completed" ? status.output?.find((item) => typeof item.url === "string")?.url : undefined;
          if (!clip) continue;
          // Taken off the list first, so the second part is never started twice.
          remove();
          try {
            const created = await createExtendVideoGeneration({
              model: longClipExtender,
              sourceVideo: clip,
              prompt: entry.prompt,
              duration: entry.duration,
              resolution: entry.resolution,
              aspectRatio: entry.aspectRatio,
              templateSlug: entry.templateSlug,
              idempotencyKey: `extend-${entry.generationId}`,
            });
            const generationId = created.generationId ?? created.id;
            const pollUrl = created.pollUrl ?? (generationId ? `/generations/${encodeURIComponent(generationId)}/status` : "");
            if (generationId && pollUrl) {
              emitGenerationStarted({ feature: "extend-video", requestId: crypto.randomUUID(), generationId, pollUrl, workspaceId: created.workspaceId, model: longClipExtender, status: created.status === "processing" ? "processing" : "queued" });
            }
          } catch {
            // The first part is kept as it is; the rest could not be started (for instance, not enough credits).
          }
        }
      } finally {
        busy = false;
      }
    };
    void check();
    const timer = window.setInterval(() => void check(), 8000);
    const onQueued = () => void check();
    window.addEventListener("eos:pending-extension", onQueued);
    return () => {
      alive = false;
      window.clearInterval(timer);
      window.removeEventListener("eos:pending-extension", onQueued);
    };
  }, []);
}
