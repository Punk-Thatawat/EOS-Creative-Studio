"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { confirmEmailWithBackend, persistBackendSession, type BackendAuthSession } from "@/lib/auth/backend-auth";
import { fetchBackendSession } from "@/lib/auth/backend-session";

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

      let accessToken: string | null = null;
      let backendSession: BackendAuthSession | null = null;

      if (tokenHash || (token && email)) {
        const result = await confirmEmailWithBackend({
          ...(tokenHash ? { token_hash: tokenHash } : { token: token ?? undefined, email: email ?? undefined }),
          type,
        });
        backendSession = result.data.session;
        if (backendSession) accessToken = await persistBackendSession(backendSession);
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
        <Image src="/generated-assets/eos-logo.png" alt="EOS Creative Studio" width={422} height={152} className="auth-confirm-logo" />
        <h1>{state === "error" ? "Confirmation failed" : state === "success" ? "Welcome to EOS" : "Confirming your email"}</h1>
        <p>{message}</p>
        {state === "error" && <Link href="/?login=1">Back to login</Link>}
      </section>
    </main>
  );
}
