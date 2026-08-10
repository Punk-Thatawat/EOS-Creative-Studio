import Link from "next/link";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const metadata = { title: "Log in" };

export default function LoginPage() {
  return <div className="w-full max-w-md"><Link href="/" className="mb-8 inline-flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-primary"><ArrowLeft size={14} /> Back to EOS</Link><Card className="p-6 sm:p-8"><div className="mb-7"><span className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-[#fff0e9] text-primary"><LockKeyhole size={18} /></span><h1 className="text-2xl font-bold tracking-tight">Welcome back</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">Sign in to continue to your creative workspace.</p></div><div className="space-y-4"><div><label htmlFor="email" className="mb-2 block text-xs font-bold">Work email</label><input id="email" name="email" type="email" autoComplete="email" placeholder="you@company.com" className="h-11 w-full rounded-xl border border-border bg-[#fcfbfa] px-3 text-sm outline-none focus:border-primary" /></div><div><label htmlFor="password" className="mb-2 block text-xs font-bold">Password</label><input id="password" name="password" type="password" autoComplete="current-password" placeholder="••••••••" className="h-11 w-full rounded-xl border border-border bg-[#fcfbfa] px-3 text-sm outline-none focus:border-primary" /></div><Link href="/dashboard" className={buttonVariants({ className: "w-full" })}>Continue</Link></div><p className="mt-5 rounded-xl bg-surface-muted p-3 text-center text-[11px] leading-5 text-muted-foreground">Test mode: Continue opens the dashboard. Supabase Auth will own sign-in and session handling in the identity phase.</p></Card></div>;
}
