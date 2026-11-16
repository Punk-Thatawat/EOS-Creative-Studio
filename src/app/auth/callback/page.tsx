"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { exchangeGoogleCode, persistBackendSession } from "@/lib/auth/backend-auth";
import { fetchBackendSession } from "@/lib/auth/backend-session";
import { clearGenerationProgressStorage } from "@/lib/generation-progress-storage";
import { useLocale } from "@/lib/i18n/locale-provider";

type AuthStage = "authenticating" | "workspace" | "ready";

const MISSING_CODE_MESSAGE = "Google login code is missing or expired";

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
  const { t } = useLocale();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [stage, setStage] = useState<AuthStage>("authenticating");
  const completionStarted = useRef(false);

  useEffect(() => {
    if (completionStarted.current) return undefined;
    completionStarted.current = true;
    const redirectParam = new URLSearchParams(window.location.search).get("redirect");

    async function completeAuth() {
      const code = new URLSearchParams(window.location.search).get("code");
      if (!code) throw new Error(MISSING_CODE_MESSAGE);
      const exchangeResult = await exchangeGoogleCode(code);
      const session = exchangeResult.data.session;
      if (!session) throw new Error("EOS session was not created");

      setStage("workspace");
      clearGenerationProgressStorage();
      const accessToken = await persistBackendSession(session);
      const backendProfile = await fetchBackendSession(accessToken);
      setStage("ready");
      window.sessionStorage.setItem("eos.backend.user-profile", JSON.stringify(backendProfile));

      await new Promise((resolve) => window.setTimeout(resolve, 420));
      window.location.replace(resolveSafeRedirect(redirectParam));
    }

    // No "active" guard on purpose: React StrictMode (dev) mounts twice and the second mount is skipped by the ref
    // above, so a guard cleared by the first cleanup would swallow the result and leave the loader spinning forever.
    completeAuth().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "Unable to complete login";
      setErrorMessage(message);
      window.sessionStorage.setItem("eos.auth.login-error", message);
    });

  }, []);

  return (
    <main className="auth-callback-page">
      <section className="auth-callback-card" aria-live="polite">
        {errorMessage ? (
          <div className="auth-callback-error">
            <div className="auth-callback-error-mark" aria-hidden="true">!</div>
            <h1>{t("auth.callback.failedTitle")}</h1>
            <p>{errorMessage === MISSING_CODE_MESSAGE ? t("auth.callback.missingCode") : errorMessage}</p>
            <Link href="/?login=1">{t("auth.action.backToLogin")}</Link>
          </div>
        ) : (
          <>
            <div className="auth-callback-loader" aria-hidden="true" />
            <div className="auth-callback-title-row">
              <Image src="/generated-assets/signing-you-in-transparent.png" alt={t("auth.callback.signingInAlt")} width={1776} height={434} priority className="auth-callback-title-art" />
            </div>
            <p className="auth-callback-subtitle">{t("auth.callback.subtitle")}</p>
            <div className="auth-callback-steps">
              {[t("auth.callback.stageAuthenticating"), t("auth.callback.stageWorkspace"), t("auth.callback.stageReady")].map((label, index) => {
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
