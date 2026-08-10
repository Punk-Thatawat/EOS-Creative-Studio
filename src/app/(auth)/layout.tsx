import type { ReactNode } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <div className="grid min-h-screen lg:grid-cols-[1fr_0.9fr]"><div className="flex flex-col bg-[#201d1b] p-6 text-white lg:p-10"><Link href="/dashboard" className="flex items-center gap-2.5 text-sm font-extrabold"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary"><Sparkles size={17} fill="currentColor" /></span>EOS<span className="text-primary">.</span>studio</Link><div className="mt-auto max-w-md pb-8"><p className="mb-4 text-[11px] font-bold uppercase tracking-[0.2em] text-[#ffad8a]">A calmer creative workflow</p><h1 className="text-4xl font-bold leading-tight tracking-tight">Make space for your best ideas.</h1><p className="mt-4 text-sm leading-6 text-white/60">One focused workspace for the visuals, stories, and assets your team brings to life.</p></div></div><main className="flex items-center justify-center bg-background p-6">{children}</main></div>;
}
