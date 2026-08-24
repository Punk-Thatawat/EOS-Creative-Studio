"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

const DEV_AUTH_BYPASS_TOKEN = "eos-dev-bypass";

export function isDevAuthBypassEnabled(): boolean {
  return (
    process.env.NODE_ENV === "development" &&
    process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === "true"
  );
}

export async function getApiAccessToken(): Promise<string | null> {
  if (isDevAuthBypassEnabled()) {
    return DEV_AUTH_BYPASS_TOKEN;
  }

  const { data, error } = await getSupabaseBrowserClient().auth.getSession();
  if (error) throw error;
  return data.session?.access_token ?? null;
}
