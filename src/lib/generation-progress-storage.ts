"use client";

import { getStoredBackendSession } from "@/lib/auth/backend-auth";

export const generationProgressStorageBaseKey = "eos.generation.progress.cards";
export const dismissedProgressStorageBaseKey = "eos.generation.progress.dismissed";
export const generationWorkspaceStorageKey = "eos.generation.workspace-id";

const generationPendingStorageKeys = [
  "eos.generation.pending",
  "eos.generation.pending.image-to-image",
  "eos.generation.pending.style-transfer",
  "eos.generation.pending.background-removal",
  "eos.generation.pending.upscale",
  "eos.generation.pending.extend-image",
  "eos.generation.pending.image-to-video",
  "eos.generation.pending.text-to-video",
  "eos.generation.pending.people-video",
  "eos.generation.pending.motion-transfer",
  "eos.generation.pending.lipsync",
  "eos.generation.pending.extend-video",
];

const accountScopedCreateStorageKeys = [
  ...generationPendingStorageKeys,
  "eos.generation.image-draft.v1",
  "eos.generation.source-image.image-to-image",
  "eos.generation.source-images.image-to-image",
  "eos.generation.source-image.style-transfer",
  "eos.generation.source-image.background",
  "eos.generation.source-image.upscale",
  "eos.generation.source-image.extend",
  "eos.generation.style-reference-image",
];

function readProfileUserId(): string | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem("eos.backend.user-profile");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      data?: { user?: { id?: unknown }; auth?: { id?: unknown } };
      user?: { id?: unknown };
    };
    const userId = parsed.data?.user?.id ?? parsed.data?.auth?.id ?? parsed.user?.id;
    return typeof userId === "string" && userId.length > 0 ? userId : null;
  } catch {
    return null;
  }
}

function readTokenUserId(): string | null {
  const token = getStoredBackendSession()?.accessToken;
  if (!token) return null;

  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = window.atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
    const parsed = JSON.parse(decoded) as { sub?: unknown };
    return typeof parsed.sub === "string" && parsed.sub.length > 0 ? parsed.sub : null;
  } catch {
    return null;
  }
}

export function getAccountScope(): string {
  if (typeof window === "undefined") return "anonymous";
  // Prefer the current access token during account switches; the profile in
  // sessionStorage can briefly still belong to the previous account.
  const userId = readTokenUserId() ?? readProfileUserId();
  return userId ? encodeURIComponent(userId) : "anonymous";
}

export function getAccountScopedStorageKey(baseKey: string): string {
  return `${baseKey}.${getAccountScope()}`;
}

export function getGenerationProgressStorageKey(): string {
  return getAccountScopedStorageKey(generationProgressStorageBaseKey);
}

export function getDismissedProgressStorageKey(): string {
  return getAccountScopedStorageKey(dismissedProgressStorageBaseKey);
}

/**
 * Remove browser-only generation state when a different account signs in.
 * Server-side generation history remains untouched and is loaded for the new user.
 */
export function clearGenerationProgressStorage(): void {
  if (typeof window === "undefined") return;

  try {
    const accountScope = getAccountScope();
    const scopedKey = (baseKey: string) => `${baseKey}.${accountScope}`;

    window.localStorage.removeItem(generationProgressStorageBaseKey);
    window.localStorage.removeItem(dismissedProgressStorageBaseKey);
    window.localStorage.removeItem(scopedKey(generationProgressStorageBaseKey));
    window.localStorage.removeItem(scopedKey(dismissedProgressStorageBaseKey));
    window.sessionStorage.removeItem(generationWorkspaceStorageKey);
    accountScopedCreateStorageKeys.forEach((key) => {
      window.sessionStorage.removeItem(key);
      window.sessionStorage.removeItem(scopedKey(key));
    });
  } catch {
    // Storage may be unavailable in private browsing.
  }
}
