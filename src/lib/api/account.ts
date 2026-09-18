"use client";

import { getApiAccessToken } from "@/lib/auth/access-token";

const configuredBackendUrl = (process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000").replace(/\/+$/, "");
const backendUrl = configuredBackendUrl.replace(/\/api\/v1$/, "");

type BackendResponse = {
  data?: {
    user?: {
      displayName?: string | null;
      email?: string | null;
      role?: string | null;
    };
    balance?: number | string | null;
  };
};

export type HeaderAccountData = {
  displayName: string;
  email: string;
  role: string;
  balance: number | string | null;
};

const HEADER_ACCOUNT_CACHE_TTL_MS = 10_000;
let cachedAccount: { accessToken: string; value: HeaderAccountData; expiresAt: number } | null = null;
let pendingAccount: { accessToken: string; request: Promise<HeaderAccountData> } | null = null;

async function getAccessToken(): Promise<string | null> {
  return getApiAccessToken();
}

async function getBackendData(path: string, accessToken: string): Promise<BackendResponse> {
  const response = await fetch(`${backendUrl}/api/v1${path}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    credentials: "include",
    cache: "no-store",
  });

  const payload = await response.json().catch(() => null) as BackendResponse | null;
  if (!response.ok) throw new Error(`Backend request failed: ${path}`);
  return payload ?? {};
}

export async function fetchHeaderAccountData(options: { force?: boolean } = {}): Promise<HeaderAccountData> {
  const accessToken = await getAccessToken();
  if (!accessToken) return { displayName: "User", email: "", role: "User", balance: null };

  const now = Date.now();
  if (!options.force && cachedAccount?.accessToken === accessToken && cachedAccount.expiresAt > now) {
    return cachedAccount.value;
  }
  if (pendingAccount?.accessToken === accessToken) return pendingAccount.request;

  const request = Promise.all([
    getBackendData("/auth/session", accessToken),
    getBackendData("/users/me/credits", accessToken),
  ]).then(([session, credits]) => {
    const user = session.data?.user;
    const email = user?.email?.trim() ?? "";
    const displayName = user?.displayName?.trim() || email || "User";
    const role = user?.role?.trim().toLowerCase();
    const accountRole = role === "admin" ? "Admin" : role === "owner" ? "Owner" : role === "staff" ? "Staff" : "User";
    const value = {
      displayName,
      email,
      role: accountRole,
      balance: credits.data?.balance ?? null,
    };
    cachedAccount = { accessToken, value, expiresAt: Date.now() + HEADER_ACCOUNT_CACHE_TTL_MS };
    return value;
  }).finally(() => {
    if (pendingAccount?.request === request) pendingAccount = null;
  });
  pendingAccount = { accessToken, request };
  return request;
}

export function clearHeaderAccountCache(): void {
  cachedAccount = null;
}
