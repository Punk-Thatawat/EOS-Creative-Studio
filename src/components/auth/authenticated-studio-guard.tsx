"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getApiAccessToken } from "@/lib/auth/access-token";

type GuardState = "checking" | "allowed";

function buildLoginRedirect(pathname: string, searchParams: URLSearchParams): string {
  const target = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
  const params = new URLSearchParams({ login: "1", reason: "auth-required", redirect: target });
  return `/?${params.toString()}`;
}

export function AuthenticatedStudioGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/home";
  const [state, setState] = useState<GuardState>("checking");

  useEffect(() => {
    let active = true;
    const currentSearchParams = new URLSearchParams(window.location.search);
    void getApiAccessToken()
      .then((accessToken) => {
        if (!active) return;
        if (accessToken) {
          setState("allowed");
          return;
        }
        window.location.replace(buildLoginRedirect(pathname, currentSearchParams));
      })
      .catch(() => {
        if (active) window.location.replace(buildLoginRedirect(pathname, currentSearchParams));
      });
    return () => {
      active = false;
    };
  }, [pathname]);

  if (state !== "allowed") return <div className="min-h-screen bg-background" aria-busy="true" aria-label="Checking authentication" />;
  return children;
}
