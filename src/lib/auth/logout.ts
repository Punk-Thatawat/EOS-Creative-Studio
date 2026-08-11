"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export async function signOutFromEOS() {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.auth.signOut();

  if (error) throw error;

  window.sessionStorage.removeItem("eos.backend.user-profile");
  window.location.replace("/?login=1");
}
