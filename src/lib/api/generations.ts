"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { BackgroundMode, ExtendAmount, ExtendDirection, ImageCount, ImageQuality, ImageRatio, MaskTool, StylePreset, StyleTransferPreset } from "@/features/create/image-generation/config";

const configuredBackendUrl = (process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000").replace(/\/+$/, "");
const backendOrigin = configuredBackendUrl.replace(/\/api\/v1$/, "");
const backendApiUrl = `${backendOrigin}/api/v1`;

export type TextToImageInput = {
  prompt: string;
  style?: StylePreset;
  ratio?: string;
  resolution: string;
  quality?: ImageQuality;
  outputFormat?: string;
  count: ImageCount;
  smartEnhance: boolean;
  negativePrompt: string;
  modelParams?: Record<string, unknown>;
  model?: string;
  idempotencyKey: string;
};

export type ImageToImageInput = {
  workspaceId?: string | null;
  sourceImage: string;
  sourceImages?: string[];
  prompt: string;
  style?: StylePreset | null;
  strength?: number;
  ratio: ImageRatio;
  resolution: string;
  quality?: ImageQuality;
  outputFormat?: string;
  count: ImageCount;
  smartEnhance: boolean;
  negativePrompt: string;
  modelParams?: Record<string, unknown>;
  model?: string;
  idempotencyKey: string;
};

export type StyleTransferInput = {
  workspaceId?: string | null;
  sourceImage: string;
  styleReferenceImage?: string | null;
  stylePreset?: StyleTransferPreset;
  prompt?: string;
  styleStrength?: number;
  contentPreservation?: number;
  ratio: ImageRatio;
  resolution: string;
  quality: ImageQuality;
  outputFormat?: string;
  count: ImageCount;
  smartEnhance: boolean;
  negativePrompt: string;
  modelParams?: Record<string, unknown>;
  model?: string;
  idempotencyKey: string;
};

export type BackgroundGenerationInput = {
  workspaceId?: string | null;
  mode: BackgroundMode;
  sourceImage: string;
  backgroundReferenceImage?: string | null;
  prompt?: string;
  style?: StylePreset | null;
  mask?: string | null;
  maskTool?: MaskTool;
  autoDetectSubject: boolean;
  transparent: boolean;
  backgroundColor?: string | null;
  preserveSubject: boolean;
  edgeCleanup: boolean;
  addShadow: boolean;
  matchLighting: boolean;
  ratio: ImageRatio;
  resolution: string;
  quality?: ImageQuality;
  outputFormat?: string;
  count: ImageCount;
  modelParams?: Record<string, unknown>;
  model?: string;
  idempotencyKey: string;
};

export type ExtendImageInput = {
  workspaceId?: string | null;
  sourceImage: string;
  prompt?: string;
  direction: ExtendDirection;
  amount: ExtendAmount;
  ratio: ImageRatio;
  resolution: string;
  quality?: ImageQuality;
  outputFormat?: string;
  count: ImageCount;
  smartEnhance: boolean;
  negativePrompt: string;
  modelParams?: Record<string, unknown>;
  model?: string;
  idempotencyKey: string;
};

export type UpscaleInput = {
  workspaceId?: string | null;
  sourceImage: string;
  targetResolution: string;
  quality?: string;
  outputFormat?: string;
  modelParams?: Record<string, unknown>;
  model?: string;
  idempotencyKey: string;
};

export type ImageCreditQuoteInput = {
  feature: "text-to-image" | "image-to-image" | "style-transfer" | "background-removal" | "extend-image" | "upscale";
  model?: string;
  sourceImage?: string | null;
  styleReferenceImage?: string | null;
  backgroundReferenceImage?: string | null;
  mask?: string | null;
  prompt?: string;
  style?: string | null;
  stylePreset?: string | null;
  negativePrompt?: string;
  strength?: number;
  styleStrength?: number;
  contentPreservation?: number;
  mode?: BackgroundMode;
  direction?: ExtendDirection;
  amount?: ExtendAmount;
  ratio?: ImageRatio;
  resolution?: string;
  targetResolution?: string;
  quality?: string;
  outputFormat?: string;
  count?: ImageCount;
  smartEnhance?: boolean;
  autoDetectSubject?: boolean;
  transparent?: boolean;
  backgroundColor?: string | null;
  preserveSubject?: boolean;
  edgeCleanup?: boolean;
  addShadow?: boolean;
  matchLighting?: boolean;
  modelParams?: Record<string, unknown>;
};

export type ImageCreditQuoteResponse = {
  creditCost?: number;
  providerCostUsd?: number;
  providerCostThb?: number;
  sellingPriceThb?: number;
  pricingSource?: string;
  pricingVersion?: string;
  [key: string]: unknown;
};

export type TextToImageOutput = {
  type?: "image" | "video";
  url: string;
  mimeType?: string;
};

export type GenerationStatus = "idle" | "queued" | "processing" | "completed" | "failed" | "cancelled";

export type GenerationProgress = {
  generationId: string;
  pollUrl?: string;
  workspaceId?: string;
  provider?: string;
  model?: string;
  status: Exclude<GenerationStatus, "idle">;
  totalCount: number;
  completedCount: number;
  output: TextToImageOutput[];
};

export type PendingGeneration = {
  generationId: string;
  pollUrl: string;
  workspaceId: string;
  provider: string;
  model: string;
  status: "queued" | "processing" | "completed";
  totalCount: number;
  completedCount: number;
  output: TextToImageOutput[];
  kind?: "image" | "video";
};

export type TextToImageResponse = {
  data: {
    generationId: string;
    workspaceId: string;
    provider: string;
    model: string;
    status: "completed";
    output: TextToImageOutput[];
    predictionIds: string[];
    count: number;
    estimatedProviderCostUsd: number;
  };
};

type EnqueuedGenerationResponse = {
  data: {
    id: string;
    status: "queued" | "processing";
    provider?: string;
    model?: string;
    pollUrl: string;
    workspaceId: string;
    totalCount?: number;
    completedCount?: number;
  };
};

type GenerationStatusResponse = {
  id: string;
  status: Exclude<GenerationStatus, "idle">;
  totalCount?: number;
  completedCount?: number;
  totalScenes?: number;
  completedScenes?: number;
  output?: TextToImageOutput[];
  finalVideoUrl?: string;
  videoUrl?: string;
  errorMessage?: string;
};

function unwrapGenerationStatus(payload: unknown): GenerationStatusResponse {
  if (payload && typeof payload === "object" && "data" in payload && payload.data && typeof payload.data === "object" && "status" in payload.data) {
    return payload.data as GenerationStatusResponse;
  }
  return payload as GenerationStatusResponse;
}

function getErrorMessage(payload: unknown): string {
  if (payload && typeof payload === "object" && "errorMessage" in payload && typeof payload.errorMessage === "string") {
    return payload.errorMessage;
  }
  if (payload && typeof payload === "object" && "errorCode" in payload && typeof payload.errorCode === "string") {
    return payload.errorCode;
  }
  if (payload && typeof payload === "object" && "message" in payload) {
    const message = payload.message;
    if (typeof message === "string") return message;
    if (Array.isArray(message)) return message.join(", ");
  }
  return "Image generation failed";
}

async function getAccessToken(): Promise<string> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error("Please sign in before generating an image");
  return accessToken;
}

async function pollGeneration(target: EnqueuedGenerationResponse["data"] | PendingGeneration, fallbackCount: number, accessToken: string, onProgress?: (progress: GenerationProgress) => void, signal?: AbortSignal): Promise<TextToImageResponse> {
  const generationId = "id" in target ? target.id : target.generationId;
  const initialOutput = "output" in target ? target.output : [];
  onProgress?.({ generationId, pollUrl: target.pollUrl, workspaceId: target.workspaceId, provider: target.provider, model: target.model, status: target.status, totalCount: target.totalCount ?? fallbackCount, completedCount: target.completedCount ?? initialOutput.length, output: initialOutput });

  // This is a queue-backed workflow. Do not fail a valid job just because it
  // is waiting for the provider rate-limit window to reset.
  let isFirstPoll = true;
  while (true) {
    if (!isFirstPoll) await new Promise((resolve) => setTimeout(resolve, 2_000));
    isFirstPoll = false;
    const pollUrl = target.pollUrl.startsWith("http") ? target.pollUrl : `${backendOrigin}${target.pollUrl}`;
    const statusResponse = await fetch(pollUrl, {
      method: "GET",
      headers: { Accept: "application/json", Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
      signal,
    });
    const statusPayload = await statusResponse.json().catch(() => null) as GenerationStatusResponse | { data?: unknown; message?: unknown } | null;
    if (!statusResponse.ok) throw new Error(getErrorMessage(statusPayload));
    const status = unwrapGenerationStatus(statusPayload);
    const outputs = status.output ?? [];
    onProgress?.({ generationId: status.id || generationId, pollUrl: target.pollUrl, workspaceId: target.workspaceId, provider: target.provider, model: target.model, status: status.status, totalCount: status.totalCount ?? status.totalScenes ?? target.totalCount ?? fallbackCount, completedCount: status.completedCount ?? status.completedScenes ?? outputs.length, output: outputs });
    if (status.status === "completed") {
      if (!outputs.length && !("kind" in target && target.kind === "video")) throw new Error("Generation completed without image output");
      return { data: { generationId, workspaceId: target.workspaceId, provider: target.provider ?? "", model: target.model ?? "", status: "completed", output: outputs, predictionIds: [], count: outputs.length, estimatedProviderCostUsd: Number((outputs.length * 0.005).toFixed(3)) } };
    }
    if (status.status === "failed" || status.status === "cancelled") throw new Error(status.errorMessage ?? `Generation ${status.status}`);
  }
}

export async function createTextToImage(input: TextToImageInput, onProgress?: (progress: GenerationProgress) => void, signal?: AbortSignal): Promise<TextToImageResponse> {
  const requestBody = {
    prompt: input.prompt,
    ...(input.style ? { style: input.style } : {}),
    ratio: input.ratio,
    resolution: input.resolution,
    quality: input.quality,
    ...(input.outputFormat ? { outputFormat: input.outputFormat } : {}),
    count: input.count,
    smartEnhance: input.smartEnhance,
    negativePrompt: input.negativePrompt,
    ...(input.modelParams ? { modelParams: input.modelParams } : {}),
    ...(input.model ? { model: input.model } : {}),
    idempotencyKey: input.idempotencyKey,
  };
  console.log("[Text to Image] POST /api/v1/generations/preview", requestBody);
  const accessToken = await getAccessToken();

  const response = await fetch(`${backendApiUrl}/generations/preview`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(requestBody),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(getErrorMessage(payload));
  const enqueued = payload as EnqueuedGenerationResponse;
  return pollGeneration(enqueued.data, Number(input.count), accessToken, onProgress, signal);
}

export async function quoteImageGeneration(input: ImageCreditQuoteInput): Promise<ImageCreditQuoteResponse> {
  const accessToken = await getAccessToken();
  const response = await fetch(`${backendApiUrl}/generations/image/quote`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(input),
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null) as { data?: ImageCreditQuoteResponse } | ImageCreditQuoteResponse | null;
  if (!response.ok) throw new Error(getErrorMessage(payload));
  if (payload && typeof payload === "object" && "data" in payload && payload.data && typeof payload.data === "object") return payload.data as ImageCreditQuoteResponse;
  return (payload ?? {}) as ImageCreditQuoteResponse;
}

export async function resumeGeneration(pending: PendingGeneration, onProgress?: (progress: GenerationProgress) => void, signal?: AbortSignal): Promise<TextToImageResponse> {
  const accessToken = await getAccessToken();
  return pollGeneration(pending, pending.totalCount, accessToken, onProgress, signal);
}

export async function resumeTextToImage(pending: PendingGeneration, onProgress?: (progress: GenerationProgress) => void, signal?: AbortSignal): Promise<TextToImageResponse> {
  return resumeGeneration(pending, onProgress, signal);
}

export async function cancelGeneration(generationId: string, workspaceId: string): Promise<void> {
  const accessToken = await getAccessToken();
  const params = new URLSearchParams({ workspaceId });
  const response = await fetch(`${backendApiUrl}/generations/${encodeURIComponent(generationId)}/cancel?${params.toString()}`, {
    method: "POST",
    headers: { Accept: "application/json", Authorization: `Bearer ${accessToken}` },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(getErrorMessage(payload));
}

export async function createImageToImage(input: ImageToImageInput, onProgress?: (progress: GenerationProgress) => void, signal?: AbortSignal): Promise<TextToImageResponse> {
  const requestBody = {
    ...(input.workspaceId ? { workspaceId: input.workspaceId } : {}),
    sourceImage: input.sourceImage,
    ...(input.sourceImages && input.sourceImages.length > 0 ? { sourceImages: input.sourceImages } : {}),
    prompt: input.prompt,
    ...(input.style ? { style: input.style } : {}),
    ...(input.strength !== undefined ? { strength: Math.min(1, Math.max(0, input.strength / 100)) } : {}),
    ratio: input.ratio,
    resolution: input.resolution,
    ...(input.quality ? { quality: input.quality } : {}),
    ...(input.outputFormat ? { outputFormat: input.outputFormat } : {}),
    count: input.count,
    smartEnhance: input.smartEnhance,
    negativePrompt: input.negativePrompt,
    ...(input.modelParams ? { modelParams: input.modelParams } : {}),
    ...(input.model ? { model: input.model } : {}),
    idempotencyKey: input.idempotencyKey,
  };
  console.log("[Image to Image] POST /api/v1/generations/image-to-image", requestBody);
  const accessToken = await getAccessToken();
  const response = await fetch(`${backendApiUrl}/generations/image-to-image`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(requestBody),
    signal,
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(getErrorMessage(payload));
  const enqueued = payload as EnqueuedGenerationResponse;
  return pollGeneration(enqueued.data, Number(input.count), accessToken, onProgress, signal);
}

export async function createStyleTransfer(input: StyleTransferInput, onProgress?: (progress: GenerationProgress) => void, signal?: AbortSignal): Promise<TextToImageResponse> {
  const requestBody = {
    ...(input.workspaceId ? { workspaceId: input.workspaceId } : {}),
    sourceImage: input.sourceImage,
    ...(input.styleReferenceImage ? { styleReferenceImage: input.styleReferenceImage } : {}),
    ...(input.stylePreset ? { stylePreset: input.stylePreset } : {}),
    ...(input.prompt?.trim() ? { prompt: input.prompt.trim() } : {}),
    ...(input.styleStrength !== undefined ? { styleStrength: Math.min(1, Math.max(0, input.styleStrength)) } : {}),
    ...(input.contentPreservation !== undefined ? { contentPreservation: Math.min(1, Math.max(0, input.contentPreservation)) } : {}),
    ratio: input.ratio,
    resolution: input.resolution,
    quality: input.quality,
    ...(input.outputFormat ? { outputFormat: input.outputFormat } : {}),
    count: input.count,
    smartEnhance: input.smartEnhance,
    negativePrompt: input.negativePrompt,
    ...(input.modelParams ? { modelParams: input.modelParams } : {}),
    ...(input.model ? { model: input.model } : {}),
    idempotencyKey: input.idempotencyKey,
  };
  console.log("[Style Transfer] POST /api/v1/generations/style-transfer", requestBody);
  const accessToken = await getAccessToken();
  const response = await fetch(`${backendApiUrl}/generations/style-transfer`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(requestBody),
    signal,
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(getErrorMessage(payload));
  const enqueued = payload as EnqueuedGenerationResponse;
  return pollGeneration(enqueued.data, Number(input.count), accessToken, onProgress, signal);
}

export async function createBackgroundGeneration(input: BackgroundGenerationInput, onProgress?: (progress: GenerationProgress) => void, signal?: AbortSignal): Promise<TextToImageResponse> {
  const requestBody = {
    ...(input.workspaceId ? { workspaceId: input.workspaceId } : {}),
    mode: input.mode,
    sourceImage: input.sourceImage,
    ...(input.backgroundReferenceImage ? { backgroundReferenceImage: input.backgroundReferenceImage } : {}),
    ...(input.prompt?.trim() ? { prompt: input.prompt.trim() } : {}),
    ...(input.style ? { style: input.style } : {}),
    ...(input.mask ? { mask: input.mask } : {}),
    ...(input.maskTool ? { maskTool: input.maskTool } : {}),
    autoDetectSubject: input.autoDetectSubject,
    transparent: input.transparent,
    ...(input.backgroundColor ? { backgroundColor: input.backgroundColor } : {}),
    preserveSubject: input.preserveSubject,
    edgeCleanup: input.edgeCleanup,
    addShadow: input.addShadow,
    matchLighting: input.matchLighting,
    ratio: input.ratio,
    resolution: input.resolution,
    ...(input.quality ? { quality: input.quality } : {}),
    ...(input.outputFormat ? { outputFormat: input.outputFormat } : {}),
    count: input.count,
    ...(input.modelParams ? { modelParams: input.modelParams } : {}),
    ...(input.model ? { model: input.model } : {}),
    idempotencyKey: input.idempotencyKey,
  };
  console.log("[AI Background] POST /api/v1/generations/background-removal", requestBody);
  const accessToken = await getAccessToken();
  const response = await fetch(`${backendApiUrl}/generations/background-removal`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(requestBody),
    signal,
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(getErrorMessage(payload));
  const enqueued = payload as EnqueuedGenerationResponse;
  return pollGeneration(enqueued.data, Number(input.count), accessToken, onProgress, signal);
}

export async function createExtendImage(input: ExtendImageInput, onProgress?: (progress: GenerationProgress) => void, signal?: AbortSignal): Promise<TextToImageResponse> {
  const requestBody = {
    ...(input.workspaceId ? { workspaceId: input.workspaceId } : {}),
    sourceImage: input.sourceImage,
    ...(input.prompt?.trim() ? { prompt: input.prompt.trim() } : {}),
    direction: input.direction,
    amount: input.amount,
    ratio: input.ratio,
    resolution: input.resolution,
    ...(input.quality ? { quality: input.quality } : {}),
    ...(input.outputFormat ? { outputFormat: input.outputFormat } : {}),
    count: input.count,
    smartEnhance: input.smartEnhance,
    negativePrompt: input.negativePrompt,
    ...(input.modelParams ? { modelParams: input.modelParams } : {}),
    ...(input.model ? { model: input.model } : {}),
    idempotencyKey: input.idempotencyKey,
  };
  console.log("[Extend Image] POST /api/v1/generations/extend-image", requestBody);
  const accessToken = await getAccessToken();
  const response = await fetch(`${backendApiUrl}/generations/extend-image`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(requestBody),
    signal,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(getErrorMessage(payload));
  const enqueued = payload as EnqueuedGenerationResponse;
  return pollGeneration(enqueued.data, Number(input.count), accessToken, onProgress, signal);
}

export async function createUpscale(input: UpscaleInput, onProgress?: (progress: GenerationProgress) => void, signal?: AbortSignal): Promise<TextToImageResponse> {
  const requestBody = {
    ...(input.workspaceId ? { workspaceId: input.workspaceId } : {}),
    sourceImage: input.sourceImage,
    targetResolution: input.targetResolution,
    ...(input.quality ? { quality: input.quality } : {}),
    ...(input.outputFormat ? { outputFormat: input.outputFormat } : {}),
    ...(input.modelParams ? { modelParams: input.modelParams } : {}),
    ...(input.model ? { model: input.model } : {}),
    idempotencyKey: input.idempotencyKey,
  };
  console.log("[Upscale] POST /api/v1/generations/upscale", requestBody);
  const accessToken = await getAccessToken();
  const response = await fetch(`${backendApiUrl}/generations/upscale`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(requestBody),
    signal,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(getErrorMessage(payload));
  const enqueued = payload as EnqueuedGenerationResponse;
  return pollGeneration(enqueued.data, 1, accessToken, onProgress, signal);
}

export type GenerationHistoryItem = {
  id: string;
  status: "queued" | "processing" | "completed" | "failed" | "cancelled";
  feature?: string;
  pollUrl?: string;
  workspaceId?: string;
  provider?: string;
  model?: string;
  totalCount?: number;
  completedCount?: number;
  output?: TextToImageOutput[];
  finalVideoUrl?: string;
  videoUrl?: string;
  errorMessage?: string;
  createdAt?: string;
  updatedAt?: string;
};

export async function listGenerationHistory(workspaceId?: string | null, feature?: string): Promise<GenerationHistoryItem[]> {
  const accessToken = await getAccessToken();
  const params = new URLSearchParams();
  if (workspaceId) params.set("workspaceId", workspaceId);
  if (feature) params.set("feature", feature);
  const query = params.toString();
  const response = await fetch(`${backendApiUrl}/generations${query ? `?${query}` : ""}`, {
    method: "GET",
    headers: { Accept: "application/json", Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  const payload = await response.json().catch(() => null) as { data?: GenerationHistoryItem[] } | null;
  if (!response.ok) throw new Error(getErrorMessage(payload));

  return payload?.data ?? [];
}

export async function listCompletedGenerationImages(workspaceId: string, feature?: string): Promise<string[]> {
  return (await listGenerationHistory(workspaceId, feature))
    .filter((generation) => generation.status === "completed")
    .flatMap((generation) => generation.output ?? [])
    .map((output) => output.url)
    .filter(Boolean);
}
