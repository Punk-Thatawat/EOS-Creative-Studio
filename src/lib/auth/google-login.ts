"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export async function signInWithGoogle() {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });

  if (error) throw error;
}
