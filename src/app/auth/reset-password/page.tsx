"use client";

import Link from "next/link";
import { ArrowRight, Check, LockKeyhole } from "lucide-react";
import { FormEvent, useState } from "react";
import { resetPasswordWithBackend } from "@/lib/auth/backend-auth";
import { useLocale } from "@/lib/i18n/locale-provider";

export default function ResetPasswordPage() {
  const { t } = useLocale();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [state, setState] = useState<"form" | "success" | "error">("form");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = new URLSearchParams(window.location.search).get("token")?.trim();
    if (!token || password.length < 8 || password !== confirmation) {
      setMessage(password.length < 8 ? t("auth.validation.passwordMinFull") : t("auth.validation.passwordMismatch"));
      return;
    }
    setLoading(true); setMessage(null);
    try { await resetPasswordWithBackend({ token, newPassword: password }); setState("success"); }
    catch { setState("error"); setMessage(t("auth.reset.invalid")); }
    finally { setLoading(false); }
  }

  return <main className="auth-reset-page"><section className="auth-reset-card">
    <div className="auth-reset-icon">{state === "success" ? <Check size={25} /> : <LockKeyhole size={25} />}</div>
    <h1>{state === "success" ? t("auth.reset.updated") : t("auth.reset.pageTitle")}</h1>
    <p>{state === "success" ? t("auth.reset.updated") : t("auth.reset.pageSubtitle")}</p>
    {state === "form" && <form onSubmit={submit}>
      <label>{t("auth.reset.newPassword")}<input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
      <label>{t("auth.reset.confirmPassword")}<input type="password" autoComplete="new-password" minLength={8} required value={confirmation} onChange={(e) => setConfirmation(e.target.value)} /></label>
      {message && <p className="auth-reset-error" role="alert">{message}</p>}
      <button type="submit" disabled={loading}>{loading ? t("auth.action.sending") : t("auth.reset.update")} <ArrowRight size={18} /></button>
    </form>}
    {state !== "form" && <Link href="/?login=1">{t("auth.action.backToLogin")}</Link>}
  </section></main>;
}
