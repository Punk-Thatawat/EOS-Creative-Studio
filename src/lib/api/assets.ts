"use client";

import { getApiAccessToken } from "@/lib/auth/access-token";

const configuredBackendUrl = (process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000").replace(/\/+$/, "");
const backendOrigin = configuredBackendUrl.replace(/\/api\/v1$/, "");
const backendApiUrl = `${backendOrigin}/api/v1`;

export type AssetsApiTab = "mine" | "shared" | "team" | "trash";
export type AssetsApiType = "image" | "video" | "document" | "audio" | "other";

export type AssetsApiAsset = {
  id: string;
  workspaceId?: string | null;
  title: string;
  type: AssetsApiType;
  fileExtension?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  sizeLabel?: string | null;
  url?: string | null;
  downloadUrl?: string | null;
  previewUrl?: string | null;
  folder?: string | null;
  tags?: string[] | null;
  source?: "generated";
  sourceGenerationId?: string | null;
  feature?: string | null;
  createdBy?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt?: string | null;
};

export type AssetsApiSummary = {
  total: number;
  images: number;
  videos: number;
  documents: number;
  others: number;
};

export type AssetsApiFilter = {
  id: string;
  name: string;
  count: number;
};

export type AssetsApiListData = {
  assets: AssetsApiAsset[];
  summary: AssetsApiSummary;
  filters: {
    folders: AssetsApiFilter[];
    tags: AssetsApiFilter[];
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
};

type ApiPayload<T> = {
  data?: T;
  message?: unknown;
  error?: unknown;
};

type AssetMetadataInput = {
  title?: string;
  folder?: string | null;
  tags?: string[];
  workspaceId?: string;
};

function errorMessage(payload: ApiPayload<unknown> | null, fallback: string): string {
  if (Array.isArray(payload?.message)) return payload.message.filter((value): value is string => typeof value === "string").join(", ") || fallback;
  if (typeof payload?.message === "string" && payload.message.trim()) return payload.message;
  if (typeof payload?.error === "string" && payload.error.trim()) return payload.error;
  return fallback;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const accessToken = await getApiAccessToken();
  if (!accessToken) throw new Error("Please sign in before using assets");

  const response = await fetch(`${backendApiUrl}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...(init.headers ?? {}),
    },
    credentials: "include",
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null) as ApiPayload<T> | null;
  if (!response.ok) throw new Error(errorMessage(payload, `Assets request failed (${response.status})`));
  if (!payload?.data) throw new Error("Assets API returned an invalid response");
  return payload.data;
}

export type FetchAssetsInput = {
  tab: AssetsApiTab;
  type?: AssetsApiType;
  search?: string;
  folder?: string;
  tag?: string;
  sort?: "newest" | "oldest";
  page?: number;
  limit?: number;
  workspaceId?: string;
};

export async function fetchAssets(input: FetchAssetsInput): Promise<AssetsApiListData> {
  const query = new URLSearchParams({
    tab: input.tab,
    page: String(input.page ?? 1),
    limit: String(input.limit ?? 12),
  });
  if (input.type) query.set("type", input.type);
  if (input.search?.trim()) query.set("search", input.search.trim());
  if (input.folder) query.set("folder", input.folder);
  if (input.tag) query.set("tag", input.tag);
  if (input.sort) query.set("sort", input.sort);
  if (input.workspaceId) query.set("workspaceId", input.workspaceId);
  return request<AssetsApiListData>(`/assets?${query.toString()}`);
}

export async function fetchAsset(assetId: string, workspaceId?: string): Promise<AssetsApiAsset> {
  const query = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : "";
  return request<AssetsApiAsset>(`/assets/${encodeURIComponent(assetId)}${query}`);
}

export async function createAssetFolder(name: string, workspaceId?: string): Promise<AssetsApiFilter> {
  const query = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : "";
  return request<AssetsApiFilter>(`/assets/folders${query}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
}

export async function deleteAssetFolder(name: string, workspaceId?: string): Promise<{ name: string; unassignedCount: number }> {
  const query = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : "";
  return request<{ name: string; unassignedCount: number }>(`/assets/folders/${encodeURIComponent(name)}${query}`, { method: "DELETE" });
}

export async function createAssetTag(name: string, workspaceId?: string): Promise<AssetsApiFilter> {
  const query = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : "";
  return request<AssetsApiFilter>(`/assets/tags${query}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
}

export async function deleteAssetTag(name: string, workspaceId?: string): Promise<{ name: string; unassignedCount: number }> {
  const query = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : "";
  return request<{ name: string; unassignedCount: number }>(`/assets/tags/${encodeURIComponent(name)}${query}`, { method: "DELETE" });
}

export async function updateAsset(assetId: string, input: AssetMetadataInput): Promise<AssetsApiAsset> {
  const { workspaceId, ...body } = input;
  const query = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : "";
  return request<AssetsApiAsset>(`/assets/${encodeURIComponent(assetId)}${query}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function deleteAsset(assetId: string, workspaceId?: string): Promise<unknown> {
  const query = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : "";
  return request<unknown>(`/assets/${encodeURIComponent(assetId)}${query}`, { method: "DELETE" });
}

export async function restoreAsset(assetId: string, workspaceId?: string): Promise<AssetsApiAsset> {
  const query = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : "";
  return request<AssetsApiAsset>(`/assets/${encodeURIComponent(assetId)}/restore${query}`, { method: "POST" });
}

export async function emptyTrash(workspaceId?: string): Promise<unknown> {
  const query = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : "";
  return request<unknown>(`/assets/trash${query}`, { method: "DELETE" });
}
