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
  load: (signal?: AbortSignal) => request("", "GET", undefined, signal),
  colors: (colors: string[]) => request("/colors", "PATCH", { colors }),
  upload: (kind: BrandAssetKind, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request(`/assets/${kind}`, "POST", form);
  },
  rename: (id: string, name: string) => request(`/assets/${encodeURIComponent(id)}`, "PATCH", { name }),
  remove: (id: string) => request(`/assets/${encodeURIComponent(id)}`, "DELETE"),
};
