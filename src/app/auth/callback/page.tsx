"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { exchangeGoogleCode, persistBackendSession } from "@/lib/auth/backend-auth";
import { fetchBackendSession } from "@/lib/auth/backend-session";

type AuthStage = "authenticating" | "workspace" | "ready";

const stageIndex: Record<AuthStage, number> = {
  authenticating: 0,
  workspace: 1,
  ready: 2,
};

// Only redirect back to eoslabs.tech after login. This prevents the redirect
// query parameter from being used as an open redirect to an attacker page.
function resolveSafeRedirect(rawRedirect: string | null): string {
  if (!rawRedirect) return "/home";
  if (rawRedirect.startsWith("/") && !rawRedirect.startsWith("//")) return rawRedirect;
  try {
    const target = new URL(rawRedirect);
    const isAllowedHost =
      target.hostname === "eoslabs.tech" || target.hostname.endsWith(".eoslabs.tech");
    return target.protocol === "https:" && isAllowedHost ? target.toString() : "/home";
  } catch {
    return "/home";
  }
}

export default function AuthCallbackPage() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [stage, setStage] = useState<AuthStage>("authenticating");
  const completionStarted = useRef(false);

  useEffect(() => {
    if (completionStarted.current) return undefined;
    completionStarted.current = true;
    let active = true;
    const redirectParam = new URLSearchParams(window.location.search).get("redirect");
    const loginRetryUrl = "/?auth_error=1";

    async function completeAuth() {
      const code = new URLSearchParams(window.location.search).get("code");
      if (!code) throw new Error("Google login code is missing or expired");
      const exchangeResult = await exchangeGoogleCode(code);
      const session = exchangeResult.data.session;
      if (!session) throw new Error("EOS session was not created");

      setStage("workspace");
      const accessToken = await persistBackendSession(session);
      const backendProfile = await fetchBackendSession(accessToken);
      setStage("ready");
      window.sessionStorage.setItem("eos.backend.user-profile", JSON.stringify(backendProfile));

      await new Promise((resolve) => window.setTimeout(resolve, 420));
      window.location.replace(resolveSafeRedirect(redirectParam));
    }

    completeAuth().catch((error: unknown) => {
      if (!active) return;

      const message = error instanceof Error ? error.message : "Unable to complete login";
      setErrorMessage(message);
      window.sessionStorage.setItem("eos.auth.login-error", message);
      window.location.replace(loginRetryUrl);
    });

    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="auth-callback-page">
      <section className="auth-callback-card" aria-live="polite">
        {errorMessage ? (
          <div className="auth-callback-error">
            <div className="auth-callback-error-mark" aria-hidden="true">!</div>
            <h1>Login failed</h1>
            <p>{errorMessage}</p>
            <Link href="/?login=1">Back to login</Link>
          </div>
        ) : (
          <>
            <div className="auth-callback-loader" aria-hidden="true" />
            <div className="auth-callback-title-row">
              <Image src="/generated-assets/signing-you-in-transparent.png" alt="Signing you in..." width={1776} height={434} priority className="auth-callback-title-art" />
            </div>
            <p className="auth-callback-subtitle">Connecting your EOS Creative Studio account.</p>
            <div className="auth-callback-steps">
              {(["Authenticating", "Loading workspace", "Ready"] as const).map((label, index) => {
                const currentIndex = stageIndex[stage];
                const isActive = index === currentIndex;
                const isComplete = index < currentIndex;
                return (
                  <div className={`auth-callback-step${isActive ? " is-active" : ""}${isComplete ? " is-complete" : ""}`} key={label}>
                    <span className="auth-callback-step-dot" aria-hidden="true">{isComplete ? "✓" : ""}</span>
                    <span>{label}</span>
                  </div>
                );
              })}
            </div>
            <div className="auth-callback-progress" aria-hidden="true">
              <span style={{ width: `${Math.max(8, (stageIndex[stage] / 2) * 100)}%` }} />
            </div>
          </>
        )}
      </section>
    </main>
  );
}
