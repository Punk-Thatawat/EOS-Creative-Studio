"use client";

import { clearBackendSession, getStoredBackendSession } from "@/lib/auth/backend-auth";

const backendUrl = (process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000").replace(/\/+$/, "").replace(/\/api\/v1$/, "");

export async function signOutFromEOS() {
  const session = getStoredBackendSession();
  if (session) {
    await fetch(`${backendUrl}/api/v1/auth/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ refresh_token: session.refreshToken }),
      credentials: "include",
    }).catch(() => undefined);
  }
  clearBackendSession();

  window.sessionStorage.removeItem("eos.backend.user-profile");
  window.location.replace("/?login=1");
}
