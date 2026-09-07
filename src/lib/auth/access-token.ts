"use client";

import { clearBackendSession, getStoredBackendSession, persistBackendSession, type BackendAuthSession } from "@/lib/auth/backend-auth";

const DEV_AUTH_BYPASS_TOKEN = "eos-dev-bypass";
const backendUrl = (process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000").replace(/\/+$/, "").replace(/\/api\/v1$/, "");
let refreshRequest: Promise<string | null> | null = null;

export function isDevAuthBypassEnabled(): boolean {
  return (
    process.env.NODE_ENV === "development" &&
    process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === "true"
  );
}

async function refreshStoredSession(stored: BackendAuthSession): Promise<string | null> {
  const latest = getStoredBackendSession();
  const session = latest ?? stored;
  const now = Math.floor(Date.now() / 1000);

  // Another request may have completed the rotating refresh while this
  // request was waiting. Reuse that session instead of refreshing twice.
  if (session.accessToken !== stored.accessToken && session.expiresAt !== null && session.expiresAt > now + 30) {
    return session.accessToken;
  }

  try {
    const response = await fetch(`${backendUrl}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ refresh_token: session.refreshToken }),
      credentials: "include",
    });
    const payload = await response.json().catch(() => null) as { data?: { session?: BackendAuthSession | null } } | null;
    const refreshed = payload?.data?.session;
    if (!response.ok || !refreshed) throw new Error("Session refresh failed");
    return persistBackendSession(refreshed);
  } catch {
    // Do not erase a newer login/session that another tab or request stored.
    const current = getStoredBackendSession();
    if (!current || current.refreshToken === session.refreshToken) clearBackendSession();
    return null;
  }
}

export async function getApiAccessToken(options: { forceRefresh?: boolean } = {}): Promise<string | null> {
  if (isDevAuthBypassEnabled()) {
    return DEV_AUTH_BYPASS_TOKEN;
  }

  const stored = getStoredBackendSession();
  if (!stored) return null;
  const expiresSoon = stored.expiresAt === null || stored.expiresAt <= Math.floor(Date.now() / 1000) + 30;
  if (!options.forceRefresh && !expiresSoon) return stored.accessToken;

  if (!refreshRequest) {
    refreshRequest = refreshStoredSession(stored).finally(() => {
      refreshRequest = null;
    });
  }
  return refreshRequest;
}
