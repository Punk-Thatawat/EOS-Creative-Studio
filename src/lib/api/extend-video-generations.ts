"use client";

import { getApiAccessToken } from "@/lib/auth/access-token";

const configuredBackendUrl = (process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000").replace(/\/+$/, "");
const backendOrigin = configuredBackendUrl.replace(/\/api\/v1$/, "");
const backendApiUrl = `${backendOrigin}/api/v1`;

export type ExtendVideoGenerationInput = {
  model?: string;
  promptOptimizerEnabled?: boolean;
  sourceVideo: string;
  prompt: string;
  negativePrompt?: string;
  audioUrl?: string;
  duration?: number;
  resolution?: string;
  aspectRatio?: string;
  enablePromptExpansion?: boolean;
  seed?: number;
  modelParams?: Record<string, unknown>;
  idempotencyKey?: string;
};

export type ExtendVideoOutput = {
  url?: string;
  mimeType?: string;
  type?: string;
  [key: string]: unknown;
};

export type ExtendVideoGenerationResponse = {
  id?: string;
  generationId?: string;
  workspaceId?: string;
  pollUrl?: string;
  status?: string;
  output?: ExtendVideoOutput[];
  [key: string]: unknown;
};

export type ExtendVideoGenerationStatus = {
  id?: string;
  generationId?: string;
  status: string;
  progress?: number;
  output?: ExtendVideoOutput[];
  errorMessage?: string;
  [key: string]: unknown;
};

async function getAccessToken(): Promise<string> {
  const accessToken = await getApiAccessToken();
  if (!accessToken) throw new Error("Please sign in before generating an extended video");
  return accessToken;
}

function apiPath(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith("/api/v1")) return `${backendOrigin}${path}`;
  return `${backendApiUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

async function authenticatedRequest(path: string, init: RequestInit = {}): Promise<unknown> {
  const accessToken = await getAccessToken();
  const response = await fetch(apiPath(path), {
    ...init,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null) as { data?: unknown; message?: unknown; errorMessage?: unknown } | null;
  if (!response.ok) {
    const message = Array.isArray(payload?.message) ? payload.message.join(", ") : typeof payload?.message === "string" ? payload.message : typeof payload?.errorMessage === "string" ? payload.errorMessage : "Extend video request failed";
    throw new Error(message);
  }
  return payload && typeof payload === "object" && "data" in payload ? payload.data : payload;
}

export async function createExtendVideoGeneration(input: ExtendVideoGenerationInput, signal?: AbortSignal): Promise<ExtendVideoGenerationResponse> {
  return await authenticatedRequest("/generations/extend-video", { method: "POST", body: JSON.stringify(input), signal }) as ExtendVideoGenerationResponse;
}

export async function getExtendVideoGenerationStatus(pollUrl: string, signal?: AbortSignal): Promise<ExtendVideoGenerationStatus> {
  return await authenticatedRequest(pollUrl, { method: "GET", signal }) as ExtendVideoGenerationStatus;
}

export async function cancelExtendVideoGeneration(generationId: string): Promise<void> {
  await authenticatedRequest(`/generations/${encodeURIComponent(generationId)}/cancel`, { method: "POST" });
}
