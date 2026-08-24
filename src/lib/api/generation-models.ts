"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export type ModelUploadConstraints = {
  maxFileSizeBytes?: number;
  maxWidth?: number;
  maxHeight?: number;
  maxImages?: number;
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
  capabilities: {
    model: string;
    provider: string;
    kind?: string;
    description?: string;
    basePrice?: number | string;
    providerType?: string;
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

export async function listGenerationModels(feature = "text-to-image"): Promise<GenerationModelOption[]> {
  const { data, error } = await getSupabaseBrowserClient().auth.getSession();
  if (error) throw error;
  const accessToken = data.session?.access_token;
  if (!accessToken) return [];
  const response = await fetch(`${backendApiUrl}/generation-models?feature=${encodeURIComponent(feature)}`, {
    headers: { Accept: "application/json", Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null) as { data?: GenerationModelOption[]; message?: string } | null;
  if (!response.ok) throw new Error(payload?.message ?? "Unable to load generation models");
  return payload?.data ?? [];
}

async function adminRequest(path: string, init: RequestInit = {}): Promise<unknown> {
  const { data, error } = await getSupabaseBrowserClient().auth.getSession();
  if (error) throw error;
  const accessToken = data.session?.access_token;
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

export async function listAdminGenerationModels(feature = "text-to-image"): Promise<GenerationModelOption[]> {
  const payload = await adminRequest(`/api/v1/admin/model-routes?feature=${encodeURIComponent(feature)}`) as { data?: GenerationModelOption[] };
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

export async function updateGenerationModelRoute(feature: string, model: string, provider: string, options: { enabled?: boolean; isDefault?: boolean } = { enabled: true, isDefault: true }): Promise<GenerationModelOption[]> {
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

export async function syncGenerationModels(): Promise<{ synced: number; skipped: number }> {
  return await adminRequest("/api/v1/admin/model-routes/sync", { method: "POST" }) as { synced: number; skipped: number };
}
