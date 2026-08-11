"use client";

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";

export type BackendUserProfile = Record<string, unknown>;

export async function fetchBackendSession(accessToken: string): Promise<BackendUserProfile> {
  const response = await fetch(`${backendUrl}/api/v1/auth/session`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    credentials: "include",
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload && typeof payload === "object" && "message" in payload && typeof payload.message === "string"
      ? payload.message
      : "Backend session request failed";
    throw new Error(message);
  }

  return payload as BackendUserProfile;
}
