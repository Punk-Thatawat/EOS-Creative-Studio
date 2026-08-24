"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

const configuredBackendUrl = (process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000").replace(/\/+$/, "");
const backendOrigin = configuredBackendUrl.replace(/\/api\/v1$/, "");
const backendApiUrl = `${backendOrigin}/api/v1`;

export type LipsyncGenerationInput = {
  model?: string;
  sourceImage?: string;
  sourceVideo?: string;
  script?: string;
  audioUrl?: string;
  actingDirection?: string;
  negativePrompt?: string;
  voiceId?: string;
  voiceLanguage?: string;
  voiceSpeed?: number;
  duration?: unknown;
  resolution?: unknown;
  aspectRatio?: unknown;
  modelParams?: Record<string, unknown>;
  [key: string]: unknown;
};

export type LipsyncOutput = {
  url?: string;
  mimeType?: string;
  type?: string;
  [key: string]: unknown;
};

export type LipsyncGenerationResponse = {
  id?: string;
  generationId?: string;
  pollUrl?: string;
  status?: string;
  progress?: number;
  output?: LipsyncOutput[];
  [key: string]: unknown;
};

export type LipsyncGenerationStatus = {
  id?: string;
  generationId?: string;
  status: string;
  progress?: number;
  output?: LipsyncOutput[];
  errorMessage?: string;
  [key: string]: unknown;
};

async function getAccessToken(): Promise<string> {
  const { data, error } = await getSupabaseBrowserClient().auth.getSession();
  if (error) throw error;
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error("Please sign in before generating a lipsync video");
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
  if (payload && typeof payload === "object" && "errorMessage" in payload && typeof payload.errorMessage === "string") return payload.errorMessage;
  return "Lipsync request failed";
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

export async function createLipsyncGeneration(input: LipsyncGenerationInput, signal?: AbortSignal): Promise<LipsyncGenerationResponse> {
  return await authenticatedRequest("/generations/lipsync", {
    method: "POST",
    body: JSON.stringify(input),
    signal,
  }) as LipsyncGenerationResponse;
}

export async function getLipsyncGenerationStatus(pollUrl: string, signal?: AbortSignal): Promise<LipsyncGenerationStatus> {
  return await authenticatedRequest(pollUrl, { method: "GET", signal }) as LipsyncGenerationStatus;
}
