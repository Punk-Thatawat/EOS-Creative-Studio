"use client";

import { getApiAccessToken } from "@/lib/auth/access-token";

export type ModelUploadConstraints = {
  maxFileSizeBytes?: number;
  maxWidth?: number;
  maxHeight?: number;
  maxImages?: number;
};

export type AiBackgroundMode = "remove" | "replace" | "generate" | "solid";
export type ModelPreviewType = "image" | "video";
export type ModelPostAudioOptions = {
  sfx: boolean;
  music: boolean;
};

const configuredBackendUrl = (process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000").replace(/\/+$/, "");
const backendApiUrl = `${configuredBackendUrl.replace(/\/api\/v1$/, "")}/api/v1`;

export type GenerationModelOption = {
  model: string;
  provider: string;
  displayName: string;
  enabled: boolean;
  isDefault: boolean;
  priority: number;
  kind?: string;
  previewUrl?: string | null;
  previewStorageKey?: string | null;
  previewType?: ModelPreviewType | null;
  postAudio?: ModelPostAudioOptions;
  capabilities: {
    model: string;
    provider: string;
    kind?: string;
    description?: string;
    basePrice?: number | string;
    providerType?: string;
    nativeAudio?: boolean;
    fixedUpscale?: boolean;
    supportsUpscale?: boolean;
    syncedAt?: string;
    parameters: string[];
    supportedSizes: string[];
    supportedRatios?: string[];
    supportedResolutions?: string[];
    supportedAspectRatios?: string[];
    styleTransferCompatible?: boolean;
    promptParameter?: string;
    scriptParameter?: string;
    audioParameter?: string;
    voiceParameter?: string;
    imageParameter?: string;
    videoParameter?: string;
    imagesParameter?: string;
    lastImageParameter?: string;
    inputImageParameter?: string;
    inputParameter?: string;
    qualityParameter?: string;
    qualityValues: string[];
    negativePromptParameter?: string;
    strengthParameter?: string;
    referenceImagesParameter?: string;
    styleImageParameter?: string;
    contentPreservationParameter?: string;
    sizeParameter?: string;
    sizeConstraintsKnown?: boolean;
    aspectRatioParameter?: string;
    resolutionParameter?: string;
    targetResolutionParameter?: string;
    upscaleFactorParameter?: string;
    widthParameter?: string;
    heightParameter?: string;
    outputFormatParameter?: string;
    outputFormatValues?: string[];
    uploadConstraints?: ModelUploadConstraints;
    seedParameter?: string;
    countParameter?: string;
    maskParameter?: string;
    requiredParameters?: string[];
    transparentParameter?: string;
    backgroundImageParameter?: string;
    backgroundModes?: string[];
    apiSchema?: {
      request_schema?: {
        properties?: Record<string, {
          type?: string;
          title?: string;
          description?: string;
          default?: unknown;
          enum?: unknown[];
          minimum?: number;
          maximum?: number;
          format?: string;
          [key: string]: unknown;
        }>;
        required?: string[];
      };
      [key: string]: unknown;
    };
  };
};

export type AdminModelRoutesOverview = {
  catalog: GenerationModelOption[];
  routes: Record<string, GenerationModelOption[]>;
};

export type GenerationModelRequestOptions = {
  signal?: AbortSignal;
  timeoutMs?: number;
};

const defaultGenerationModelRequestTimeoutMs = 15000;
const generationModelCacheTtlMs = 30_000;
const generationModelCache = new Map<string, { expiresAt: number; data: GenerationModelOption[] }>();

export function clearGenerationModelCache(): void {
  generationModelCache.clear();
}

export async function listGenerationModels(
  feature = "text-to-image",
  backgroundMode?: AiBackgroundMode,
  options: GenerationModelRequestOptions = {},
): Promise<GenerationModelOption[]> {
  const cacheKey = `${feature}:${backgroundMode ?? ""}`;
  const cached = generationModelCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    options.signal?.throwIfAborted();
    return cached.data;
  }
  if (cached) generationModelCache.delete(cacheKey);
  const controller = new AbortController();
  const timeoutMs = Math.max(1000, options.timeoutMs ?? defaultGenerationModelRequestTimeoutMs);
  let timedOut = false;
  const timeoutId = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const abortFromCaller = () => controller.abort();
  if (options.signal) {
    if (options.signal.aborted) controller.abort();
    else options.signal.addEventListener("abort", abortFromCaller, { once: true });
  }

  try {
    const accessToken = await getApiAccessToken();
    if (!accessToken) return [];
    const modeQuery = backgroundMode ? `&backgroundMode=${encodeURIComponent(backgroundMode)}` : "";
    const response = await fetch(`/api/generation-models?feature=${encodeURIComponent(feature)}${modeQuery}`, {
      headers: { Accept: "application/json", Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null) as { data?: GenerationModelOption[]; message?: string } | null;
    if (!response.ok) throw new Error(payload?.message ?? "Unable to load generation models");
    const data = payload?.data ?? [];
    generationModelCache.set(cacheKey, { expiresAt: Date.now() + generationModelCacheTtlMs, data });
    return data;
  } catch (error) {
    if (timedOut) throw new Error("Loading generation models timed out");
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
    options.signal?.removeEventListener("abort", abortFromCaller);
  }
}

async function adminRequest(path: string, init: RequestInit = {}): Promise<unknown> {
  const accessToken = await getApiAccessToken();
  if (!accessToken) throw new Error("Please sign in as an admin");
  const apiPath = path.startsWith("/api/v1") ? path.slice("/api/v1".length) : path;
  const response = await fetch(`${backendApiUrl}${apiPath}`, {
    ...init,
    headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${accessToken}`, ...(init.headers ?? {}) },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null) as { data?: unknown; message?: string } | null;
  if (!response.ok) throw new Error(payload?.message ?? "Admin model operation failed");
  return payload;
}

async function adminUploadModelPreview(file: File): Promise<{ storageKey: string; previewUrl: string | null; mediaType: ModelPreviewType }> {
  const accessToken = await getApiAccessToken();
  if (!accessToken) throw new Error("Please sign in as an admin");
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(`${backendApiUrl}/admin/model-routes/preview/upload`, {
    method: "POST",
    headers: { Accept: "application/json", Authorization: `Bearer ${accessToken}` },
    body: formData,
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null) as { data?: { storageKey: string; previewUrl: string | null; mediaType: ModelPreviewType }; message?: string } | null;
  if (!response.ok || !payload?.data) throw new Error(payload?.message ?? "Model preview upload failed");
  return payload.data;
}

export async function uploadAdminModelPreview(file: File): Promise<{ storageKey: string; previewUrl: string | null; mediaType: ModelPreviewType }> {
  return adminUploadModelPreview(file);
}

export async function deleteAdminModelPreviewUpload(storageKey: string): Promise<void> {
  await adminRequest(`/api/v1/admin/model-routes/preview/upload?storageKey=${encodeURIComponent(storageKey)}`, { method: "DELETE" });
}

export async function updateAdminModelPreview(model: string, provider: string, feature: string, backgroundMode: AiBackgroundMode | undefined, preview: { previewUrl?: string | null; previewStorageKey?: string | null; previewType?: ModelPreviewType | null }): Promise<AdminModelRoutesOverview> {
  const payload = await adminRequest("/api/v1/admin/model-routes/preview", { method: "PATCH", body: JSON.stringify({
    model,
    provider,
    feature,
    ...(backgroundMode ? { backgroundMode } : {}),
    previewUrl: preview.previewUrl ?? null,
    previewStorageKey: preview.previewStorageKey ?? null,
    previewType: preview.previewType ?? null,
  }) }) as { data?: AdminModelRoutesOverview };
  return payload.data ?? { catalog: [], routes: {} };
}

export async function listAdminGenerationModels(feature = "text-to-image", backgroundMode?: AiBackgroundMode): Promise<GenerationModelOption[]> {
  const modeQuery = backgroundMode ? `&backgroundMode=${encodeURIComponent(backgroundMode)}` : "";
  const payload = await adminRequest(`/api/v1/admin/model-routes?feature=${encodeURIComponent(feature)}${modeQuery}`) as { data?: GenerationModelOption[] };
  return payload.data ?? [];
}

export async function listAdminModelCatalog(): Promise<GenerationModelOption[]> {
  const payload = await adminRequest("/api/v1/admin/model-routes/catalog") as { data?: GenerationModelOption[] };
  return payload.data ?? [];
}

export async function listAdminModelRoutesOverview(): Promise<AdminModelRoutesOverview> {
  const payload = await adminRequest("/api/v1/admin/model-routes/overview") as { data?: AdminModelRoutesOverview };
  return payload.data ?? { catalog: [], routes: {} };
}

export async function updateGenerationModelRoute(feature: string, model: string, provider: string, options: { backgroundMode?: AiBackgroundMode; enabled?: boolean; isDefault?: boolean; postAudio?: ModelPostAudioOptions } = { enabled: true, isDefault: true }): Promise<GenerationModelOption[]> {
  const payload = await adminRequest(`/api/v1/admin/model-routes/${encodeURIComponent(feature)}`, { method: "PATCH", body: JSON.stringify({ model, provider, ...options }) }) as { data?: GenerationModelOption[] };
  return payload.data ?? [];
}

export async function updateModelInputLimits(model: string, provider: string, options: ModelUploadConstraints): Promise<AdminModelRoutesOverview> {
  const payload = await adminRequest("/api/v1/admin/model-routes/model", { method: "PATCH", body: JSON.stringify({
    model,
    provider,
    maxInputFileSizeBytes: options.maxFileSizeBytes ?? null,
    maxInputWidth: options.maxWidth ?? null,
    maxInputHeight: options.maxHeight ?? null,
    maxInputImages: options.maxImages ?? null,
  }) }) as { data?: AdminModelRoutesOverview };
  return payload.data ?? { catalog: [], routes: {} };
}

export async function updateModelDisplayName(model: string, provider: string, displayName: string): Promise<AdminModelRoutesOverview> {
  const payload = await adminRequest("/api/v1/admin/model-routes/model/display-name", { method: "PATCH", body: JSON.stringify({ model, provider, displayName }) }) as { data?: AdminModelRoutesOverview };
  return payload.data ?? { catalog: [], routes: {} };
}

export async function syncGenerationModels(): Promise<{ synced: number; skipped: number }> {
  return await adminRequest("/api/v1/admin/model-routes/sync", { method: "POST" }) as { synced: number; skipped: number };
}
