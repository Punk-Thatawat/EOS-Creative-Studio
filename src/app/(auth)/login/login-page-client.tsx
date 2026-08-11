"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import { useState } from "react";
import { useEffect } from "react";
import { Card } from "@/components/ui/card";
import { signInWithGoogle } from "@/lib/auth/google-login";

export default function LoginPageClient() {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const resetLoadingState = () => {
      if (document.visibilityState === "visible") setLoading(false);
    };
    window.addEventListener("pageshow", resetLoadingState);
    document.addEventListener("visibilitychange", resetLoadingState);
    return () => {
      window.removeEventListener("pageshow", resetLoadingState);
      document.removeEventListener("visibilitychange", resetLoadingState);
    };
  }, []);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      await signInWithGoogle();
    } catch (error: unknown) {
      setLoading(false);
      setErrorMessage(error instanceof Error ? error.message : "Unable to start Google login");
    }
  };

  return (
    <div className="w-full max-w-md">
      <Link href="/" className="mb-8 inline-flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-primary"><ArrowLeft size={14} /> Back to EOS</Link>
      <Card className="p-6 sm:p-8">
        <div className="mb-7">
          <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-[#fff0e9] text-primary"><LockKeyhole size={18} /></span>
          <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Sign in to continue to your creative workspace.</p>
        </div>
        <div className="space-y-4">
          <div><label htmlFor="email" className="mb-2 block text-xs font-bold">Work email</label><input id="email" name="email" type="email" autoComplete="email" placeholder="you@company.com" className="h-11 w-full rounded-xl border border-border bg-[#fcfbfa] px-3 text-sm outline-none focus:border-primary" /></div>
          <div><label htmlFor="password" className="mb-2 block text-xs font-bold">Password</label><input id="password" name="password" type="password" autoComplete="current-password" placeholder="••••••••" className="h-11 w-full rounded-xl border border-border bg-[#fcfbfa] px-3 text-sm outline-none focus:border-primary" /></div>
          <button type="button" onClick={() => { void handleGoogleLogin(); }} disabled={loading} className="flex h-11 w-full items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-[#ff6819] to-[#f51591] text-sm font-bold text-white transition-opacity disabled:cursor-wait disabled:opacity-60">
            <Image src="/generated-assets/google-g-icon.svg" alt="" width={18} height={18} />
            {loading ? "Connecting..." : "Continue with Google"}
          </button>
        </div>
        {errorMessage && <p className="mt-4 rounded-xl bg-red-50 p-3 text-center text-xs text-red-700" role="alert">{errorMessage}</p>}
        <p className="mt-5 rounded-xl bg-surface-muted p-3 text-center text-[11px] leading-5 text-muted-foreground">Google securely signs you in with Supabase Auth. Your EOS profile is loaded from the backend after callback.</p>
      </Card>
    </div>
  );
}
