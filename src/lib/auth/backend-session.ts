"use client";

const backendUrl = (process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000").replace(/\/+$/, "").replace(/\/api\/v1$/, "");
const AUTH_REQUEST_TIMEOUT_MS = 15000;

export type BackendUserProfile = Record<string, unknown>;
export type BackendAuthProvider = "email" | "google";
export type BackendSessionSummary = {
  id: string;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string;
  userAgent: string | null;
};

export async function fetchBackendSession(accessToken: string): Promise<BackendUserProfile> {
  let response: Response;
  try {
    response = await fetch(`${backendUrl}/api/v1/auth/session`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      credentials: "include",
      signal: AbortSignal.timeout(AUTH_REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof DOMException && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new Error("The workspace server is taking too long to respond. Please try again.");
    }
    throw new Error("Unable to connect to the workspace server. Please try again.");
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload && typeof payload === "object" && "message" in payload && typeof payload.message === "string"
      ? payload.message
      : "Backend session request failed";
    throw new Error(message);
  }

  return payload as BackendUserProfile;
}

export async function fetchBackendAuthProvider(accessToken: string): Promise<BackendAuthProvider | null> {
  const session = await fetchBackendSession(accessToken) as {
    data?: { auth?: { provider?: unknown } };
  };
  const provider = session.data?.auth?.provider;
  return provider === "email" || provider === "google" ? provider : null;
}

export async function fetchBackendAuthSessions(accessToken: string): Promise<BackendSessionSummary[]> {
  const response = await fetch(`${backendUrl}/api/v1/auth/sessions`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    credentials: "include",
    cache: "no-store",
    signal: AbortSignal.timeout(AUTH_REQUEST_TIMEOUT_MS),
  });

  const payload = await response.json().catch(() => null) as { data?: { sessions?: BackendSessionSummary[] }; message?: string } | null;
  if (!response.ok) throw new Error(payload?.message ?? "Active sessions request failed");
  return payload?.data?.sessions ?? [];
}
