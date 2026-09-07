"use client";

const backendUrl = (process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000").replace(/\/+$/, "").replace(/\/api\/v1$/, "");
const sessionStorageKey = "eos.backend.session";

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

export function exchangeGoogleCode(code: string) {
  return postAuth("google/exchange", { code });
}

function parseStoredSession(value: string | null): BackendAuthSession | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<BackendAuthSession>;
    if (typeof parsed.accessToken !== "string" || typeof parsed.refreshToken !== "string" || typeof parsed.expiresAt !== "number") return null;
    return parsed as BackendAuthSession;
  } catch {
    return null;
  }
}

export function getStoredBackendSession(): BackendAuthSession | null {
  if (typeof window === "undefined") return null;
  try {
    return parseStoredSession(window.localStorage.getItem(sessionStorageKey)) ?? parseStoredSession(window.sessionStorage.getItem(sessionStorageKey));
  } catch {
    return null;
  }
}

export async function persistBackendSession(session: BackendAuthSession, remember = true): Promise<string> {
  if (typeof window === "undefined") throw new Error("Browser session is unavailable");
  const storage = remember ? window.localStorage : window.sessionStorage;
  storage.setItem(sessionStorageKey, JSON.stringify(session));
  if (!remember) window.localStorage.removeItem(sessionStorageKey);
  return session.accessToken;
}

export function clearBackendSession(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(sessionStorageKey);
  window.sessionStorage.removeItem(sessionStorageKey);
}
