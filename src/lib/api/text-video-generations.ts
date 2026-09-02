"use client";

import { getApiAccessToken } from "@/lib/auth/access-token";

const configuredBackendUrl = (process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000").replace(/\/+$/, "");
const backendOrigin = configuredBackendUrl.replace(/\/api\/v1$/, "");
const backendApiUrl = `${backendOrigin}/api/v1`;

export type TextVideoGenerationInput = {
  prompt: string;
  promptOptimizerEnabled?: boolean;
  negativePrompt?: string;
  duration?: unknown;
  resolution?: unknown;
  aspectRatio?: unknown;
  fps?: unknown;
  seed?: unknown;
  generateAudio?: unknown;
  model?: string;
  modelParams?: Record<string, unknown>;
  referenceImage?: string;
  audioUrl?: string;
  idempotencyKey?: string;
  [key: string]: unknown;
};

export type TextVideoOutput = {
  url?: string;
  mimeType?: string;
  type?: string;
  [key: string]: unknown;
};

export type TextVideoGenerationResponse = {
  id?: string;
  generationId?: string;
  pollUrl?: string;
  workspaceId?: string;
  status?: string;
  output?: TextVideoOutput[];
  finalVideoUrl?: string;
  [key: string]: unknown;
};

export type TextVideoGenerationStatus = {
  id?: string;
  generationId?: string;
  workspaceId?: string;
  status: string;
  progress?: number;
  totalCount?: number;
  completedCount?: number;
  output?: TextVideoOutput[];
  finalVideoUrl?: string;
  videoUrl?: string;
  errorMessage?: string;
  [key: string]: unknown;
};

async function getAccessToken(): Promise<string> {
  const accessToken = await getApiAccessToken();
  if (!accessToken) throw new Error("Please sign in before generating a video");
  return accessToken;
}

function apiPath(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith("/api/v1")) return `${backendOrigin}${path}`;
  return `${backendApiUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

async function readPayload(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

function errorMessage(payload: unknown): string {
  if (payload && typeof payload === "object" && "message" in payload) {
    const message = payload.message;
    if (typeof message === "string") return message;
    if (Array.isArray(message)) return message.join(", ");
  }
  if (payload && typeof payload === "object" && "errorMessage" in payload && typeof payload.errorMessage === "string") {
    return payload.errorMessage;
  }
  return "Text to video request failed";
}

function unwrapData(payload: unknown): unknown {
  if (payload && typeof payload === "object" && "data" in payload) return payload.data;
  return payload;
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
  const payload = await readPayload(response);
  if (!response.ok) throw new Error(errorMessage(payload));
  return unwrapData(payload);
}

export async function createTextVideoGeneration(
  input: TextVideoGenerationInput,
  signal?: AbortSignal,
): Promise<TextVideoGenerationResponse> {
  return await authenticatedRequest("/generations/text-to-video", {
    method: "POST",
    body: JSON.stringify(input),
    signal,
  }) as TextVideoGenerationResponse;
}

export async function getTextVideoGenerationStatus(
  pollUrl: string,
  signal?: AbortSignal,
): Promise<TextVideoGenerationStatus> {
  return await authenticatedRequest(pollUrl, { method: "GET", signal }) as TextVideoGenerationStatus;
}

export async function cancelTextVideoGeneration(
  generationId: string,
  workspaceId?: string,
): Promise<void> {
  const query = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : "";
  await authenticatedRequest(`/generations/${encodeURIComponent(generationId)}/cancel${query}`, { method: "POST" });
}
