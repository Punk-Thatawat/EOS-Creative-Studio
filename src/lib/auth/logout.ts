"use client";

import { clearBackendSession, getStoredBackendSession } from "@/lib/auth/backend-auth";
import { clearGenerationProgressStorage } from "@/lib/generation-progress-storage";

const backendUrl = (process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000").replace(/\/+$/, "").replace(/\/api\/v1$/, "");

export async function signOutFromEOS() {
  const returnTarget = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  const session = getStoredBackendSession();
  if (session) {
    await fetch(`${backendUrl}/api/v1/auth/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ refresh_token: session.refreshToken }),
      credentials: "include",
    }).catch(() => undefined);
  }
  // Keep this account's scoped generation cards so the next login can resume
  // polling jobs that were started before logout. Other accounts cannot read
  // them because the progress key is scoped by the access-token user id.
  clearGenerationProgressStorage({ preserveAccountProgress: true });
  clearBackendSession();

  window.sessionStorage.removeItem("eos.backend.user-profile");
  const loginUrl = new URL("/", window.location.origin);
  loginUrl.searchParams.set("login", "1");
  loginUrl.searchParams.set("redirect", returnTarget || "/home");
  window.location.replace(loginUrl.toString());
}
