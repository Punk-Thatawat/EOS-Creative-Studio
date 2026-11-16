"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { confirmEmailWithBackend, persistBackendSession, type BackendAuthSession } from "@/lib/auth/backend-auth";
import { fetchBackendSession } from "@/lib/auth/backend-session";
import { clearGenerationProgressStorage } from "@/lib/generation-progress-storage";
import { useLocale } from "@/lib/i18n/locale-provider";

type ConfirmationState = "loading" | "success" | "error";

const INVALID_LINK = "__invalid_confirmation_link__";

export default function ConfirmEmailPage() {
  const { t } = useLocale();
  const [state, setState] = useState<ConfirmationState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    // The confirmation token is single-use. StrictMode (dev) mounts twice, so run the request only once;
    // the second run would be rejected and replace the success result with an error.
    if (started.current) return;
    started.current = true;

    async function confirm() {
      const params = new URLSearchParams(window.location.search);
      const tokenHash = params.get("token_hash");
      const token = params.get("token");
      const email = params.get("email");
      const type = params.get("type") === "email" ? "email" : "signup";

      if (params.get("confirmed") === "1") {
        setState("success");
        return;
      }

      let accessToken: string | null = null;
      let backendSession: BackendAuthSession | null = null;

      // Backend-generated confirmation links contain the one-time token only.
      // The email query parameter is optional and must not prevent confirmation.
      if (tokenHash || token) {
        const result = await confirmEmailWithBackend({
          ...(tokenHash ? { token_hash: tokenHash } : { token: token ?? undefined, email: email ?? undefined }),
          type,
        });
        backendSession = result.data.session;
        if (backendSession) accessToken = await persistBackendSession(backendSession);
      }

      if (!accessToken) throw new Error(INVALID_LINK);
      clearGenerationProgressStorage();
      const backendProfile = await fetchBackendSession(accessToken);
      window.sessionStorage.setItem("eos.backend.user-profile", JSON.stringify(backendProfile));
      setState("success");
      window.history.replaceState(null, "", `${window.location.pathname}?confirmed=1`);
    }

    confirm().catch((error: unknown) => {
      setState("error");
      setErrorMessage(error instanceof Error && error.message !== INVALID_LINK ? error.message : null);
    });
  }, []);

  const title = state === "error" ? t("auth.confirm.errorTitle") : state === "success" ? t("auth.confirm.successTitle") : t("auth.confirm.loadingTitle");
  const message = state === "error" ? errorMessage ?? t("auth.confirm.invalidLink") : state === "success" ? t("auth.confirm.successMessage") : t("auth.confirm.loadingMessage");

  return (
    <main className="auth-confirm-page">
      <section className="auth-confirm-card" aria-live="polite">
        {state === "loading" || state === "success" ? <div className={`auth-confirm-mark${state === "success" ? " is-success" : ""}`} aria-hidden="true">{state === "success" ? "✓" : <span />}</div> : <div className="auth-confirm-mark is-error" aria-hidden="true">!</div>}
        <Image src="/generated-assets/eos-logo.png" alt="EOS Creative Studio" width={422} height={152} className="auth-confirm-logo" />
        <h1>{title}</h1>
        <p>{message}</p>
        {state === "error" && <Link href="/?login=1">{t("auth.action.backToLogin")}</Link>}
        {state === "success" && <Link href="/home">{t("auth.confirm.goHome")}</Link>}
      </section>
    </main>
  );
}
