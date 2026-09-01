"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export async function signInWithGoogle({
  redirectTarget,
}: { redirectTarget?: string } = {}) {
  const supabase = getSupabaseBrowserClient();
  const callbackUrl = new URL(`${window.location.origin}/auth/callback`);
  if (redirectTarget) {
    callbackUrl.searchParams.set("redirect", redirectTarget);
  }

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: callbackUrl.toString(),
    },
  });

  if (error) throw error;
}
