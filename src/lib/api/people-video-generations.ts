"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { detectMediaUploadKind, friendlyUploadError, validateMediaFile, type ImageUploadConstraints } from "@/lib/media/upload-validation";

const configuredBackendUrl = (process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000").replace(/\/+$/, "");
const backendOrigin = configuredBackendUrl.replace(/\/api\/v1$/, "");
const backendApiUrl = `${backendOrigin}/api/v1`;

export type PeopleVideoGenerationInput = {
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

export type PeopleVideoOutput = {
  url?: string;
  mimeType?: string;
  type?: string;
  [key: string]: unknown;
};

export type PeopleVideoGenerationResponse = {
  id?: string;
  generationId?: string;
  pollUrl?: string;
  status?: string;
  progress?: number;
  output?: PeopleVideoOutput[];
  [key: string]: unknown;
};

export type PeopleVideoGenerationStatus = {
  id?: string;
  generationId?: string;
  status: string;
  progress?: number;
  output?: PeopleVideoOutput[];
  errorMessage?: string;
  [key: string]: unknown;
};

async function getAccessToken(): Promise<string> {
  const { data, error } = await getSupabaseBrowserClient().auth.getSession();
  if (error) throw error;
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error("Please sign in before generating a people video");
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
  return "People video request failed";
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
  if (!response.ok) throw new Error(friendlyUploadError(errorMessage(payload), "Media upload failed"));
  return unwrapData(payload);
}

export async function uploadPeopleMedia(file: File, signal?: AbortSignal, constraints?: ImageUploadConstraints): Promise<string> {
  const mediaKind = detectMediaUploadKind(file);
  const validationError = await validateMediaFile(file, mediaKind, constraints);
  if (validationError) throw new Error(validationError);
  const accessToken = await getAccessToken();
  const formData = new FormData();
  formData.append("file", file, `${crypto.randomUUID()}-${file.name}`);
  const response = await fetch(`${backendApiUrl}/media/upload`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: formData,
    signal,
    cache: "no-store",
  });
  const payload = await readPayload(response);
  if (!response.ok) throw new Error(errorMessage(payload));
  const data = unwrapData(payload);
  const url = data && typeof data === "object" && "url" in data ? data.url : undefined;
  if (typeof url !== "string" || !url) throw new Error("Media upload did not return a URL");
  return url;
}

export async function createPeopleVideoGeneration(input: PeopleVideoGenerationInput, signal?: AbortSignal): Promise<PeopleVideoGenerationResponse> {
  return await authenticatedRequest("/generations/people-video", {
    method: "POST",
    body: JSON.stringify(input),
    signal,
  }) as PeopleVideoGenerationResponse;
}

export async function getPeopleVideoGenerationStatus(pollUrl: string, signal?: AbortSignal): Promise<PeopleVideoGenerationStatus> {
  return await authenticatedRequest(pollUrl, { method: "GET", signal }) as PeopleVideoGenerationStatus;
}
