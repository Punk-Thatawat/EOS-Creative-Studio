"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getApiAccessToken } from "@/lib/auth/access-token";
import { fetchBackendSession } from "@/lib/auth/backend-session";

type GuardState = "checking" | "allowed";

function buildLoginRedirect(pathname: string): string {
  const params = new URLSearchParams({ login: "1", reason: "auth-required", redirect: pathname });
  return `/?${params.toString()}`;
}

function isAdminSession(session: Record<string, unknown>): boolean {
  const data = session.data;
  if (!data || typeof data !== "object") return false;
  const user = (data as Record<string, unknown>).user;
  if (!user || typeof user !== "object") return false;
  const profile = user as Record<string, unknown>;
  return profile.role === "admin" && profile.status === "active";
}

export function AdminAccessGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/admin";
  const [state, setState] = useState<GuardState>("checking");

  useEffect(() => {
    let active = true;
    void getApiAccessToken()
      .then(async (accessToken) => {
        if (!accessToken) {
          window.location.replace(buildLoginRedirect(pathname));
          return;
        }

        const session = await fetchBackendSession(accessToken);
        if (!active) return;
        if (!isAdminSession(session)) {
          window.location.replace("/");
          return;
        }
        setState("allowed");
      })
      .catch(() => {
        if (active) window.location.replace("/");
      });

    return () => {
      active = false;
    };
  }, [pathname]);

  if (state !== "allowed") {
    return <div className="min-h-screen bg-background" aria-busy="true" aria-label="Checking admin access" />;
  }

  return children;
}
