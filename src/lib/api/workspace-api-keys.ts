"use client";

import { getApiAccessToken } from "@/lib/auth/access-token";

const backendUrl = (process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000")
  .replace(/\/+$/, "")
  .replace(/\/api\/v1$/, "");
const REQUEST_TIMEOUT_MS = 15000;

export type WorkspaceApiKeyStatus = "active" | "expired" | "revoked";

export type WorkspaceApiKey = {
  id: string;
  workspaceId: string;
  name: string;
  /** First characters of the key, only to tell keys apart. It cannot be used to call the API. */
  keyPrefix: string;
  createdBy: string;
  createdAt: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
  status: WorkspaceApiKeyStatus;
};

/** The response of creating a key. `key` is the full secret and is only ever returned this once. */
export type CreatedWorkspaceApiKey = WorkspaceApiKey & { key: string };

export type WorkspaceApiKeysApi = {
  /** Loads the workspace of the signed-in user and its keys. */
  load(): Promise<{ workspaceId: string; keys: WorkspaceApiKey[] }>;
  create(workspaceId: string, input: { name: string; expiresAt?: string }): Promise<CreatedWorkspaceApiKey>;
  revoke(workspaceId: string, keyId: string): Promise<void>;
};

type ErrorPayload = { message?: unknown; errorMessage?: unknown } | null;

async function request<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const accessToken = await getApiAccessToken();
  if (!accessToken) throw new Error("Session expired");
  let response: Response;
  try {
    response = await fetch(`${backendUrl}/api/v1${path}`, {
      method: init.method ?? "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
        ...(init.body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      credentials: "include",
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
    });
  } catch {
    throw new Error("Unable to reach the server");
  }
  const payload = (await response.json().catch(() => null)) as (ErrorPayload & { data?: unknown }) | null;
  if (!response.ok) {
    const message =
      typeof payload?.errorMessage === "string"
        ? payload.errorMessage
        : typeof payload?.message === "string"
          ? payload.message
          : Array.isArray(payload?.message)
            ? payload.message.join(", ")
            : "Request failed";
    throw new Error(message);
  }
  return payload?.data as T;
}

export const workspaceApiKeysApi: WorkspaceApiKeysApi = {
  async load() {
    const session = await request<{ workspaceId?: string }>("/auth/session");
    const workspaceId = session.workspaceId;
    if (!workspaceId) throw new Error("Workspace not found");
    const list = await request<{ keys: WorkspaceApiKey[] }>(`/workspaces/${encodeURIComponent(workspaceId)}/api-keys`);
    return { workspaceId, keys: list.keys };
  },
  create(workspaceId, input) {
    return request<CreatedWorkspaceApiKey>(`/workspaces/${encodeURIComponent(workspaceId)}/api-keys`, {
      method: "POST",
      body: input,
    });
  },
  async revoke(workspaceId, keyId) {
    await request<unknown>(`/workspaces/${encodeURIComponent(workspaceId)}/api-keys/${encodeURIComponent(keyId)}`, {
      method: "DELETE",
    });
  },
};
