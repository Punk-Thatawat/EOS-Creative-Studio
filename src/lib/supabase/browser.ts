import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | undefined;

export function getSupabaseBrowserClient() {
  if (browserClient) return browserClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  const hostname = typeof window === "undefined" ? "" : window.location.hostname;
  const isSecureHost = typeof window !== "undefined" && window.location.protocol === "https:";
  const isEosHost = hostname === "eoslabs.tech" || hostname.endsWith(".eoslabs.tech");

  browserClient = createBrowserClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      flowType: "pkce",
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    // Share the session across EOS subdomains in production. Do not set the
    // production domain or Secure flag on localhost: browsers reject those
    // cookies over http, which also drops the PKCE code verifier.
    cookieOptions: {
      path: "/",
      sameSite: "lax",
      secure: isSecureHost,
      ...(isSecureHost && isEosHost ? { domain: ".eoslabs.tech" } : {}),
    },
  });

  return browserClient;
}
