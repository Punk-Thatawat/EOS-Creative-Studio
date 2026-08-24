"use client";

import { getApiAccessToken } from "@/lib/auth/access-token";

const configuredBackendUrl = (process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000").replace(/\/+$/, "");
const backendOrigin = configuredBackendUrl.replace(/\/api\/v1$/, "");
const backendApiUrl = `${backendOrigin}/api/v1`;

export type MotionTransferGenerationInput = {
  sourceImage: string;
  motionVideo: string;
  model: string;
  quality?: unknown;
  prompt?: string;
  negativePrompt?: string;
  characterOrientation?: unknown;
  keepOriginalSound?: unknown;
  modelParams?: Record<string, unknown>;
  [key: string]: unknown;
};

export type MotionTransferOutput = {
  url?: string;
  mimeType?: string;
  type?: string;
  [key: string]: unknown;
};

export type MotionTransferGenerationResponse = {
  id?: string;
  generationId?: string;
  pollUrl?: string;
  workspaceId?: string;
  status?: string;
  output?: MotionTransferOutput[];
  [key: string]: unknown;
};

export type MotionTransferGenerationStatus = {
  id?: string;
  generationId?: string;
  status: string;
  progress?: number;
  output?: MotionTransferOutput[];
  errorMessage?: string;
  [key: string]: unknown;
};

async function getAccessToken(): Promise<string> {
  const accessToken = await getApiAccessToken();
  if (!accessToken) throw new Error("Please sign in before generating a motion transfer video");
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
  return "Motion transfer request failed";
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

export async function createMotionTransferGeneration(input: MotionTransferGenerationInput, signal?: AbortSignal): Promise<MotionTransferGenerationResponse> {
  return await authenticatedRequest("/generations/motion-transfer", {
    method: "POST",
    body: JSON.stringify(input),
    signal,
  }) as MotionTransferGenerationResponse;
}

export async function getMotionTransferGenerationStatus(pollUrl: string, signal?: AbortSignal): Promise<MotionTransferGenerationStatus> {
  return await authenticatedRequest(pollUrl, { method: "GET", signal }) as MotionTransferGenerationStatus;
}
