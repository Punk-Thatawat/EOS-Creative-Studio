"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";

export type BackendAuthSession = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  expiresAt: number | null;
  tokenType: string;
};

type BackendAuthResponse = {
  data: {
    user: {
      id: string;
      email: string | null;
      emailConfirmedAt: string | null;
    } | null;
    session: BackendAuthSession | null;
    emailConfirmationRequired?: boolean;
    sent?: boolean;
  };
};

function getErrorMessage(payload: unknown): string {
  if (payload && typeof payload === "object" && "message" in payload) {
    const message = payload.message;
    if (typeof message === "string") return message;
    if (Array.isArray(message) && message.every((item) => typeof item === "string")) return message.join(" ");
  }
  return "Authentication request failed. Please try again.";
}

async function postAuth(path: string, body: Record<string, string>): Promise<BackendAuthResponse> {
  const response = await fetch(`${backendUrl}/api/v1/auth/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new Error(getErrorMessage(payload));
  return payload as BackendAuthResponse;
}

export function loginWithBackend(email: string, password: string) {
  return postAuth("login", { email, password });
}

export function registerWithBackend(input: { email: string; password: string; display_name?: string }) {
  const body: Record<string, string> = { email: input.email, password: input.password };
  if (input.display_name) body.display_name = input.display_name;
  return postAuth("register", body);
}

export function resendConfirmationWithBackend(email: string) {
  return postAuth("resend-confirmation", { email });
}

export function confirmEmailWithBackend(input: { token_hash?: string; token?: string; email?: string; type?: "signup" | "email" }) {
  const body: Record<string, string> = {};
  if (input.token_hash) body.token_hash = input.token_hash;
  if (input.token) body.token = input.token;
  if (input.email) body.email = input.email;
  if (input.type) body.type = input.type;
  return postAuth("confirm-email", body);
}

export async function persistBackendSession(session: BackendAuthSession): Promise<string> {
  const { data, error } = await getSupabaseBrowserClient().auth.setSession({
    access_token: session.accessToken,
    refresh_token: session.refreshToken,
  });
  if (error || !data.session) throw error ?? new Error("Could not create browser session");
  return data.session.access_token;
}
