"use client";

import { useEffect, useState } from "react";
import { fetchBackendSession } from "@/lib/auth/backend-session";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function AuthCallbackPage() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function completeAuth() {
      const supabase = getSupabaseBrowserClient();
      const code = new URLSearchParams(window.location.search).get("code");
      const initialSessionResult = await supabase.auth.getSession();
      let session = initialSessionResult.data.session;

      if (initialSessionResult.error) throw initialSessionResult.error;

      if (!session && code) {
        const exchangeResult = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeResult.error) throw exchangeResult.error;
        session = exchangeResult.data.session;
      }

      if (!session) throw new Error("Supabase session was not created");

      const backendProfile = await fetchBackendSession(session.access_token);
      window.sessionStorage.setItem("eos.backend.user-profile", JSON.stringify(backendProfile));
      window.location.replace("/dashboard");
    }

    completeAuth().catch((error: unknown) => {
      if (!active) return;
      setErrorMessage(error instanceof Error ? error.message : "Unable to complete login");
    });

    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#111113] px-6 text-white">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/[.06] p-8 text-center shadow-2xl">
        {errorMessage ? (
          <>
            <h1 className="text-xl font-bold">Login failed</h1>
            <p className="mt-3 text-sm text-white/65">{errorMessage}</p>
            <a href="/login" className="mt-6 inline-flex rounded-full bg-[#f51591] px-5 py-2 text-sm font-bold">Back to login</a>
          </>
        ) : (
          <>
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-[#f51591]" aria-hidden="true" />
            <h1 className="mt-5 text-xl font-bold">Signing you in...</h1>
            <p className="mt-2 text-sm text-white/65">Connecting your EOS Creative Studio account.</p>
          </>
        )}
      </div>
    </main>
  );
}
