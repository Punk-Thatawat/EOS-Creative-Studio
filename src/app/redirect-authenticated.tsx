"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { getApiAccessToken } from "@/lib/auth/access-token";

export function RedirectAuthenticated({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    let active = true;
    void getApiAccessToken().then((token) => {
      if (active && token) router.replace("/home");
    });
    return () => { active = false; };
  }, [router]);

  return children;
}
