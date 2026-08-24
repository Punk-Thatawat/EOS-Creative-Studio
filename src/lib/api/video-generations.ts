"use client";

import { getApiAccessToken } from "@/lib/auth/access-token";

const configuredBackendUrl = (process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000").replace(/\/+$/, "");
const backendApiUrl = `${configuredBackendUrl.replace(/\/api\/v1$/, "")}/api/v1`;

export type VideoGenerationSceneInput = {
  storyboardImage?: string;
  referenceImages?: string[];
  startFrameSource: "manual" | "previous_last_frame";
  prompt: string;
  negativePrompt?: string;
  duration?: number;
  modelParams?: Record<string, unknown>;
  [key: string]: unknown;
};

export type VideoGenerationInput = {
  workspaceId?: string | null;
  projectId?: string | null;
  model: string;
  mode: "storyboard" | "continuous" | "hybrid";
  duration?: number;
  resolution?: string;
  aspectRatio?: string;
  generateAudio?: boolean;
  audioUrl?: string;
  modelParams?: Record<string, unknown>;
  scenes: VideoGenerationSceneInput[];
  idempotencyKey: string;
};

export type VideoStoryboardResponse = {
  storyboardId: string;
  pollUrl?: string;
  status?: string;
  totalScenes?: number;
  completedScenes?: number;
  failedScenes?: number;
  totalCreditCost?: number;
  continuation?: {
    strategy?: string;
    nativeExtend?: boolean;
    seamless?: boolean;
  };
  [key: string]: unknown;
};

export type VideoCreditQuoteResponse = {
  model?: string;
  provider?: string;
  mode?: "storyboard" | "continuous" | "hybrid" | string;
  totalScenes?: number;
  totalDuration?: number | null;
  totalCreditCost?: number;
  scenes?: Array<{
    sceneIndex?: number;
    model?: string;
    provider?: string;
    creditCost?: number;
    pricingSource?: string;
  }>;
};

export type DirectVideoQuoteInput = {
  feature: "text-to-video" | "people-video" | "lipsync" | "motion-transfer" | "extend-video" | "image-to-video";
  model?: string;
  prompt?: string;
  negativePrompt?: string;
  duration?: unknown;
  resolution?: unknown;
  aspectRatio?: unknown;
  audioUrl?: string;
  sourceVideo?: string;
  sourceImage?: string;
  modelParams?: Record<string, unknown>;
};

export type DirectVideoQuoteResponse = {
  creditCost?: number;
  providerCostUsd?: number;
  pricingSource?: string;
  pricingVersion?: string;
  [key: string]: unknown;
};

export type VideoStoryboardStatus = {
  workspaceId?: string;
  storyboardId?: string;
  status: "processing" | "completed" | "failed" | "cancelled" | string;
  totalScenes?: number;
  completedScenes?: number;
  failedScenes?: number;
  finalVideoUrl?: string;
  continuation?: {
    strategy?: string;
    nativeExtend?: boolean;
    seamless?: boolean;
  };
  scenes?: Array<{
    sceneIndex?: number;
    status?: string;
    outputUrl?: string;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
};

export type VideoStoryboardHistoryItem = {
  storyboardId: string;
  workspaceId?: string;
  provider?: string;
  model?: string;
  mode?: "storyboard" | "continuous" | "hybrid" | string;
  status: "completed" | string;
  totalScenes?: number;
  totalDuration?: number | null;
  finalVideoUrl: string;
  createdAt?: string;
};

async function authenticatedRequest(path: string, init: RequestInit = {}) {
  const accessToken = await getApiAccessToken();
  if (!accessToken) throw new Error("Please sign in before generating a video");

  const response = await fetch(`${backendApiUrl}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null) as {
    data?: unknown;
    message?: unknown;
  } | null;
  if (!response.ok) {
    const message = Array.isArray(payload?.message)
      ? payload.message.join(", ")
      : typeof payload?.message === "string"
        ? payload.message
        : "Video generation request failed";
    throw new Error(message);
  }
  return payload?.data ?? payload;
}

export async function createVideoStoryboard(input: VideoGenerationInput): Promise<VideoStoryboardResponse> {
  return await authenticatedRequest("/generations/video/image-to-video", {
    method: "POST",
    body: JSON.stringify(input),
  }) as VideoStoryboardResponse;
}

export async function quoteVideoStoryboard(input: Omit<VideoGenerationInput, "idempotencyKey">): Promise<VideoCreditQuoteResponse> {
  return await authenticatedRequest("/generations/video/image-to-video/quote", {
    method: "POST",
    body: JSON.stringify(input),
  }) as VideoCreditQuoteResponse;
}

export async function quoteDirectVideoGeneration(input: DirectVideoQuoteInput): Promise<DirectVideoQuoteResponse> {
  return await authenticatedRequest("/generations/video/quote", {
    method: "POST",
    body: JSON.stringify({
      feature: input.feature,
      ...(input.model ? { model: input.model } : {}),
      ...(input.prompt ? { prompt: input.prompt } : {}),
      ...(input.negativePrompt ? { negativePrompt: input.negativePrompt } : {}),
      ...(input.duration !== undefined ? { duration: input.duration } : {}),
      ...(input.resolution !== undefined ? { resolution: input.resolution } : {}),
      ...(input.aspectRatio !== undefined ? { aspectRatio: input.aspectRatio } : {}),
      ...(input.audioUrl ? { audioUrl: input.audioUrl } : {}),
      ...(input.sourceVideo ? { sourceVideo: input.sourceVideo } : {}),
      ...(input.sourceImage ? { sourceImage: input.sourceImage } : {}),
      ...(input.modelParams ? { modelParams: input.modelParams } : {}),
    }),
  }) as DirectVideoQuoteResponse;
}

export async function getVideoStoryboardStatus(storyboardId: string): Promise<VideoStoryboardStatus> {
  return await authenticatedRequest(`/generations/video/image-to-video/${encodeURIComponent(storyboardId)}/status`) as VideoStoryboardStatus;
}

export async function listVideoStoryboardHistory(workspaceId?: string | null, limit = 12): Promise<VideoStoryboardHistoryItem[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (workspaceId) params.set("workspaceId", workspaceId);
  return await authenticatedRequest(`/generations/video/image-to-video/history?${params.toString()}`) as VideoStoryboardHistoryItem[];
}
