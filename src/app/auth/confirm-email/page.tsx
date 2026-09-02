"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { confirmEmailWithBackend, persistBackendSession, type BackendAuthSession } from "@/lib/auth/backend-auth";
import { fetchBackendSession } from "@/lib/auth/backend-session";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

type ConfirmationState = "loading" | "success" | "error";

export default function ConfirmEmailPage() {
  const [state, setState] = useState<ConfirmationState>("loading");
  const [message, setMessage] = useState("Confirming your email address...");

  useEffect(() => {
    let active = true;

    async function confirm() {
      const params = new URLSearchParams(window.location.search);
      const tokenHash = params.get("token_hash");
      const token = params.get("token");
      const email = params.get("email");
      const type = params.get("type") === "email" ? "email" : "signup";
      const supabase = getSupabaseBrowserClient();

      let accessToken: string | null = null;
      let backendSession: BackendAuthSession | null = null;

      if (tokenHash || (token && email)) {
        const result = await confirmEmailWithBackend({
          ...(tokenHash ? { token_hash: tokenHash } : { token: token ?? undefined, email: email ?? undefined }),
          type,
        });
        backendSession = result.data.session;
        if (backendSession) accessToken = await persistBackendSession(backendSession);
      } else {
        const code = params.get("code");
        const initialSessionResult = await supabase.auth.getSession();
        if (initialSessionResult.error) throw initialSessionResult.error;
        let session = initialSessionResult.data.session;

        if (!session && code) {
          const exchangeResult = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeResult.error) throw exchangeResult.error;
          session = exchangeResult.data.session;
        }

        if (!session && window.location.hash) {
          const hashParams = new URLSearchParams(window.location.hash.slice(1));
          const hashAccessToken = hashParams.get("access_token");
          const hashRefreshToken = hashParams.get("refresh_token");
          if (hashAccessToken && hashRefreshToken) {
            const setSessionResult = await supabase.auth.setSession({ access_token: hashAccessToken, refresh_token: hashRefreshToken });
            if (setSessionResult.error) throw setSessionResult.error;
            session = setSessionResult.data.session;
          }
        }
        if (session) accessToken = session.access_token;
      }

      if (!accessToken) throw new Error("The confirmation link is invalid or has expired.");
      const backendProfile = await fetchBackendSession(accessToken);
      window.sessionStorage.setItem("eos.backend.user-profile", JSON.stringify(backendProfile));
      if (!active) return;
      setMessage("Email confirmed. Opening your creative workspace...");
      setState("success");
      window.history.replaceState(null, "", window.location.pathname);
      window.setTimeout(() => window.location.replace("/home"), 700);
    }

    confirm().catch((error: unknown) => {
      if (!active) return;
      setState("error");
      setMessage(error instanceof Error ? error.message : "We could not confirm this email.");
    });

    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="auth-confirm-page">
      <section className="auth-confirm-card" aria-live="polite">
        {state === "loading" || state === "success" ? <div className={`auth-confirm-mark${state === "success" ? " is-success" : ""}`} aria-hidden="true">{state === "success" ? "✓" : <span />}</div> : <div className="auth-confirm-mark is-error" aria-hidden="true">!</div>}
        <Image src="/generated-assets/eos-logo.webp" alt="EOS Creative Studio" width={128} height={50} className="auth-confirm-logo" />
        <h1>{state === "error" ? "Confirmation failed" : state === "success" ? "Welcome to EOS" : "Confirming your email"}</h1>
        <p>{message}</p>
        {state === "error" && <Link href="/?login=1">Back to login</Link>}
      </section>
    </main>
  );
}
