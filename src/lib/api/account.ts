"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

const configuredBackendUrl = (process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000").replace(/\/+$/, "");
const backendUrl = configuredBackendUrl.replace(/\/api\/v1$/, "");

type BackendResponse = {
  data?: {
    user?: {
      displayName?: string | null;
      email?: string | null;
    };
    balance?: number | string | null;
  };
};

export type HeaderAccountData = {
  displayName: string;
  email: string;
  balance: number | string | null;
};

async function getAccessToken(): Promise<string | null> {
  const { data, error } = await getSupabaseBrowserClient().auth.getSession();
  if (error) throw error;
  return data.session?.access_token ?? null;
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

export async function fetchHeaderAccountData(): Promise<HeaderAccountData> {
  const accessToken = await getAccessToken();
  if (!accessToken) return { displayName: "User", email: "", balance: null };

  const [session, credits] = await Promise.all([
    getBackendData("/auth/session", accessToken),
    getBackendData("/users/me/credits", accessToken),
  ]);
  const user = session.data?.user;
  const email = user?.email?.trim() ?? "";
  const displayName = user?.displayName?.trim() || email || "User";

  return {
    displayName,
    email,
    balance: credits.data?.balance ?? null,
  };
}
