"use client";

import { getApiAccessToken } from "@/lib/auth/access-token";
import { generationErrorFromPayload } from "@/lib/api/generation-errors";

const configuredBackendUrl = (process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000").replace(/\/+$/, "");
const backendApiUrl = `${configuredBackendUrl.replace(/\/api\/v1$/, "")}/api/v1`;

export type VideoGenerationSceneInput = {
  storyboardImage?: string;
  referenceImages?: string[];
  startFrameSource: "manual" | "previous_last_frame";
  prompt: string;
  negativePrompt?: string;
  duration?: number;
  audioUrl?: string;
  /** Replace any generated model audio with this reference after composition. */
  preserveReferenceAudio?: boolean;
  /** Send this scene's audio as a model reference without using it as the final soundtrack. */
  useReferenceAudio?: boolean;
  modelParams?: Record<string, unknown>;
  [key: string]: unknown;
};

export type PresenterSceneMediaInput = {
  sceneIndex: number;
  startSeconds: number;
  endSeconds: number;
  file: File;
};

export type PresenterVideoCompositionResponse = {
  url: string;
  mimeType?: string;
};

export type VideoGenerationInput = {
  workspaceId?: string | null;
  projectId?: string | null;
  model: string;
  mode: "storyboard" | "continuous" | "flexible";
  /** Selects the Admin-configured Image to Video mode route. */
  generationMode?: "image-to-video" | "reference-to-video" | "single-image" | "multi-scene" | "continuous" | "ai-presenter";
  duration?: number;
  resolution?: string;
  aspectRatio?: string;
  generateAudio?: boolean;
  /** Enables the backend Prompt Optimizer before video generation. */
  promptOptimizerEnabled?: boolean;
  /** Ask the backend to upscale each manual storyboard frame before video generation. */
  autoUpscale?: boolean;
  audioUrl?: string;
  audioMode?: "none" | "sfx" | "music" | "both";
  audioModel?: string;
  audioPrompt?: string;
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
  scenes?: Array<{ sceneIndex?: number; generationId?: string; status?: string; [key: string]: unknown }>;
  errorSource?: "system" | "provider";
  errorCode?: string;
  errorMessage?: string;
  audioMode?: "none" | "sfx" | "music" | "both" | string;
  audioModel?: string;
  audioProvider?: string;
  audioCreditCost?: number;
  upscaleModel?: string;
  upscaleProvider?: string;
  upscaleCreditCost?: number;
  audio?: {
    mode?: "none" | "sfx" | "music" | "both" | string;
    model?: string;
    provider?: string;
  };
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
  mode?: "storyboard" | "continuous" | "flexible" | string;
  totalScenes?: number;
  totalDuration?: number | null;
  audioMode?: "none" | "sfx" | "music" | "both" | string;
  audioModel?: string;
  audioProvider?: string;
  audioCreditCost?: number;
  upscaleModel?: string;
  upscaleProvider?: string;
  upscaleCreditCost?: number;
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
  feature: "text-to-video" | "people-video" | "lipsync" | "motion-transfer" | "video-swap" | "extend-video" | "image-to-video";
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
  promptOptimizerEnabled?: boolean;
};

export type DirectVideoQuoteResponse = {
  creditCost?: number;
  providerCostUsd?: number;
  pricingSource?: string;
  pricingVersion?: string;
  [key: string]: unknown;
};

export type VideoStoryboardStatus = {
  id?: string;
  generationId?: string;
  workspaceId?: string;
  storyboardId?: string;
  status: "processing" | "completed" | "failed" | "cancelled" | string;
  progress?: number;
  totalCount?: number;
  completedCount?: number;
  totalScenes?: number;
  completedScenes?: number;
  failedScenes?: number;
  totalDuration?: number | null;
  audioMode?: "none" | "sfx" | "music" | "both" | string;
  audioModel?: string;
  audioProvider?: string;
  audio?: {
    mode?: "none" | "sfx" | "music" | "both" | string;
  };
  finalVideoUrl?: string;
  videoUrl?: string;
  output?: Array<{ url?: string; mimeType?: string; type?: string }>;
  errorSource?: "system" | "provider";
  errorCode?: string;
  errorMessage?: string;
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
  mode?: "storyboard" | "continuous" | "flexible" | string;
  status: "completed" | string;
  totalScenes?: number;
  totalDuration?: number | null;
  finalVideoUrl: string;
  createdAt?: string;
};

export type VideoStoryboardSettings = {
  maxScenes: number;
  hardMaxScenes: number;
  modeLabels?: Record<"image-to-video" | "reference-to-video" | "single-image" | "multi-scene" | "continuous", string>;
  updatedAt?: string;
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
    errorSource?: unknown;
    errorCode?: unknown;
    code?: unknown;
    errorMessage?: unknown;
  } | null;
  if (!response.ok) {
    throw generationErrorFromPayload(payload, "Video generation request failed");
  }
  return payload?.data ?? payload;
}

export async function splitPresenterScript(script: string): Promise<{ scenes: string[] }> {
  return await authenticatedRequest("/generations/presenter/split-script", {
    method: "POST", body: JSON.stringify({ script }),
  }) as { scenes: string[] };
}

export async function createVideoStoryboard(input: VideoGenerationInput, signal?: AbortSignal): Promise<VideoStoryboardResponse> {
  return await authenticatedRequest("/generations/video/image-to-video", {
    method: "POST",
    body: JSON.stringify(input),
    signal,
  }) as VideoStoryboardResponse;
}

export async function getVideoStoryboardSettings(): Promise<VideoStoryboardSettings> {
  return await authenticatedRequest("/generations/video/image-to-video/settings") as VideoStoryboardSettings;
}

export async function quoteVideoStoryboard(input: Omit<VideoGenerationInput, "idempotencyKey">, signal?: AbortSignal): Promise<VideoCreditQuoteResponse> {
  return await authenticatedRequest("/generations/video/image-to-video/quote", {
    method: "POST",
    body: JSON.stringify(input),
    signal,
  }) as VideoCreditQuoteResponse;
}

export async function composePresenterVideo(storyboardId: string, scenes: PresenterSceneMediaInput[], signal?: AbortSignal): Promise<PresenterVideoCompositionResponse> {
  const accessToken = await getApiAccessToken();
  if (!accessToken) throw new Error("Please sign in before finalizing a presenter video");
  const formData = new FormData();
  if (scenes.length > 0) formData.append("manifest", JSON.stringify({
    scenes: scenes.map(({ sceneIndex, startSeconds, endSeconds }) => ({ sceneIndex, startSeconds, endSeconds })),
  }));
  for (const scene of scenes) formData.append("media", scene.file, scene.file.name);
  const response = await fetch(`${backendApiUrl}/generations/presenter/storyboard/${encodeURIComponent(storyboardId)}/compose`, {
    method: "POST",
    headers: { Accept: "application/json", Authorization: `Bearer ${accessToken}` },
    body: formData,
    signal,
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw generationErrorFromPayload(payload, "Could not finalize the presenter video");
  const result = payload && typeof payload === "object" && "data" in payload ? payload.data : payload;
  if (!result || typeof result !== "object" || !("url" in result) || typeof result.url !== "string" || !result.url) {
    throw new Error("Presenter video composition did not return a video URL");
  }
  return result as PresenterVideoCompositionResponse;
}

export async function quoteDirectVideoGeneration(input: DirectVideoQuoteInput, signal?: AbortSignal): Promise<DirectVideoQuoteResponse> {
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
      ...(input.promptOptimizerEnabled ? { promptOptimizerEnabled: true } : {}),
      ...(input.modelParams ? { modelParams: input.modelParams } : {}),
    }),
    signal,
  }) as DirectVideoQuoteResponse;
}

export async function getVideoStoryboardStatus(storyboardIdOrPollUrl: string, signal?: AbortSignal): Promise<VideoStoryboardStatus> {
  const path = storyboardIdOrPollUrl.startsWith("/api/v1/")
    ? storyboardIdOrPollUrl.slice("/api/v1".length)
    : storyboardIdOrPollUrl.startsWith("/generations/")
      ? storyboardIdOrPollUrl
      : `/generations/video/image-to-video/${encodeURIComponent(storyboardIdOrPollUrl)}/status`;
  return await authenticatedRequest(path, { method: "GET", signal }) as VideoStoryboardStatus;
}

export async function cancelVideoStoryboard(storyboardId: string): Promise<VideoStoryboardStatus> {
  return await authenticatedRequest(`/generations/video/image-to-video/${encodeURIComponent(storyboardId)}/cancel`, {
    method: "POST",
  }) as VideoStoryboardStatus;
}

export async function listVideoStoryboardHistory(workspaceId?: string | null, limit = 12): Promise<VideoStoryboardHistoryItem[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (workspaceId) params.set("workspaceId", workspaceId);
  return await authenticatedRequest(`/generations/video/image-to-video/history?${params.toString()}`) as VideoStoryboardHistoryItem[];
}
