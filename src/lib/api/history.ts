"use client";

import { getApiAccessToken } from "@/lib/auth/access-token";

const configuredBackendUrl = (process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000").replace(/\/+$/, "");
const backendApiUrl = `${configuredBackendUrl.replace(/\/api\/v1$/, "")}/api/v1`;

export type HistoryType = "all" | "image" | "video" | "audio";
export type HistoryStatus = "all" | "queued" | "processing" | "completed" | "failed" | "cancelled";

export type HistoryItem = {
  settings?: Record<string, unknown>;
  id: string;
  source: "generation" | "video-storyboard" | "audio";
  mediaKind: "image" | "video" | "audio";
  feature: string;
  title: string;
  prompt?: string;
  status: Exclude<HistoryStatus, "all">;
  model?: string;
  provider?: string;
  outputUrl?: string;
  outputMimeType?: string;
  outputCount: number;
  totalCount: number;
  completedCount: number;
  durationSeconds?: number;
  creditCost?: number;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
};

export type HistoryResponse = {
  items: HistoryItem[];
  pagination: { limit: number; offset: number; total: number; hasMore: boolean };
  summary: { total: number; inProgress: number; completed: number; failed: number; images: number; videos: number; audio: number };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isHistoryItem(value: unknown): value is HistoryItem {
  return isRecord(value)
    && ["id", "feature", "title", "createdAt", "updatedAt"].every((key) => typeof value[key] === "string")
    && ["generation", "video-storyboard", "audio"].some((source) => source === value.source)
    && ["image", "video", "audio"].some((kind) => kind === value.mediaKind)
    && ["queued", "processing", "completed", "failed", "cancelled"].some((status) => status === value.status)
    && ["outputCount", "totalCount", "completedCount"].every((key) => isCount(value[key]));
}

// Validate required fields only; preserve optional metadata and future backend additions.
function isHistoryResponse(value: unknown): value is HistoryResponse {
  if (!isRecord(value) || !Array.isArray(value.items) || !value.items.every(isHistoryItem)) return false;
  const { pagination, summary } = value;
  return isRecord(pagination)
    && ["limit", "offset", "total"].every((key) => isCount(pagination[key]))
    && typeof pagination.hasMore === "boolean"
    && isRecord(summary)
    && ["total", "inProgress", "completed", "failed", "images", "videos", "audio"].every((key) => isCount(summary[key]));
}

export async function fetchHistory(input: { search?: string; type?: HistoryType; status?: HistoryStatus; offset?: number; limit?: number; signal?: AbortSignal } = {}): Promise<HistoryResponse> {
  input.signal?.throwIfAborted();
  const accessToken = await getApiAccessToken();
  input.signal?.throwIfAborted();
  if (!accessToken) throw new Error("Please sign in to view your history");
  const params = new URLSearchParams();
  if (input.search?.trim()) params.set("search", input.search.trim());
  if (input.type && input.type !== "all") params.set("type", input.type);
  if (input.status && input.status !== "all") params.set("status", input.status);
  params.set("offset", String(input.offset ?? 0));
  params.set("limit", String(input.limit ?? 24));
  const response = await fetch(`${backendApiUrl}/history?${params.toString()}`, {
    method: "GET",
    headers: { Accept: "application/json", Authorization: `Bearer ${accessToken}` },
    credentials: "include",
    cache: "no-store",
    signal: input.signal,
  });
  const payload: unknown = await response.json().catch((reason: unknown) => {
    input.signal?.throwIfAborted();
    if (isRecord(reason) && reason.name === "AbortError") throw reason;
    return null;
  });
  input.signal?.throwIfAborted();
  if (!response.ok) {
    const message = isRecord(payload) && typeof payload.message === "string" && payload.message.trim()
      ? payload.message : "Unable to load history";
    throw new Error(message);
  }
  if (!isRecord(payload) || payload.data == null) throw new Error("History response was empty");
  if (!isHistoryResponse(payload.data)) throw new Error("History response was invalid");
  return payload.data;
}
