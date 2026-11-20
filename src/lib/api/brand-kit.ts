"use client";

import { getApiAccessToken } from "@/lib/auth/access-token";

export type BrandAssetKind = "logo" | "product";
export type BrandAsset = {
  id: string;
  kind: BrandAssetKind;
  name: string;
  sizeBytes: number;
  width: number;
  height: number;
  url: string | null;
  createdAt: string;
};
export type BrandKit = {
  id: string;
  colors: string[];
  assets: BrandAsset[];
  usedBytes: number;
  quotaBytes: number;
  remainingBytes: number;
};
export type BrandKitSettings = { quotaMb: number; minQuotaMb: number; maxQuotaMb: number };
export type BrandKitFolder = { id: string; name: string; imageCount?: number };
const backend = (process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000")
  .replace(/\/+$/, "")
  .replace(/\/api\/v1$/, "");

async function request<T = BrandKit>(
  path = "",
  method = "GET",
  body?: unknown,
  signal?: AbortSignal,
  admin = false,
): Promise<T> {
  const token = await getApiAccessToken();
  if (!token) throw new Error("brand_session_expired");
  const form = body instanceof FormData;
  const response = await fetch(`${backend}/api/v1/${admin ? "admin/brand-kit/settings" : "brand-kit"}${path}`, {
    method,
    cache: "no-store",
    credentials: "include",
    signal: signal ?? AbortSignal.timeout(60000),
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      ...(body !== undefined && !form ? { "Content-Type": "application/json" } : {}),
    },
    ...(body === undefined ? {} : { body: form ? (body as FormData) : JSON.stringify(body) }),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.data)
    throw new Error(typeof result?.message === "string" ? result.message : "brand_request_failed");
  return result.data as T;
}

export const brandKitApi = {
  loadSettings: (signal?: AbortSignal) => request<BrandKitSettings>("", "GET", undefined, signal, true),
  saveSettings: (quotaMb: number) => request<BrandKitSettings>("", "PATCH", { quotaMb }, undefined, true),
  folders: (signal?: AbortSignal) => request<BrandKitFolder[]>("/folders", "GET", undefined, signal),
  createFolder: (name: string) => request<BrandKitFolder>("/folders", "POST", { name }),
  renameFolder: (id: string, name: string) => request<BrandKitFolder>(`/folders/${encodeURIComponent(id)}`, "PATCH", { name }),
  removeFolder: (id: string) => request<{ id: string }>("/folders/" + encodeURIComponent(id), "DELETE"),
  load: (folderId: string, signal?: AbortSignal) => request(`?folderId=${encodeURIComponent(folderId)}`, "GET", undefined, signal),
  async imageFile(asset: Pick<BrandAsset, "id" | "name">, signal = AbortSignal.timeout(15000)): Promise<File> {
    const token = await getApiAccessToken();
    if (!token) throw new Error("brand_session_expired");
    const response = await fetch(`${backend}/api/v1/brand-kit/assets/${encodeURIComponent(asset.id)}/content`, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: "include",
      cache: "no-store",
      signal,
    });
    if (!response.ok) throw new Error("brand_request_failed");
    const image = await response.blob();
    if (image.type !== "image/webp" || !image.size) throw new Error("brand_invalid_image");
    return new File([image], `${asset.name}.webp`, { type: image.type });
  },
  colors: (folderId: string, colors: string[]) => request(`/colors?folderId=${encodeURIComponent(folderId)}`, "PATCH", { colors }),
  upload: (folderId: string, kind: BrandAssetKind, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request(`/assets/${kind}?folderId=${encodeURIComponent(folderId)}`, "POST", form);
  },
  rename: (id: string, name: string) => request(`/assets/${encodeURIComponent(id)}`, "PATCH", { name }),
  remove: (id: string) => request(`/assets/${encodeURIComponent(id)}`, "DELETE"),
};
