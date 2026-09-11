"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight, CircleHelp, CreditCard, Sparkles } from "lucide-react";
import { usePathname } from "next/navigation";
import { Card } from "@/components/ui/card";
import { fetchHomeDashboard, type HomeCredits } from "@/lib/api/home";
import { shellCopy, useLocale } from "@/lib/i18n/locale-provider";

export function RightRail() {
  const pathname = usePathname();
  const { locale } = useLocale();
  const text = shellCopy[locale];
  const [credits, setCredits] = useState<HomeCredits | null>(null);
  useEffect(() => {
    let mounted = true;
    void fetchHomeDashboard().then((dashboard) => { if (mounted) setCredits(dashboard.credits); }).catch(() => undefined);
    return () => { mounted = false; };
  }, []);
  if (pathname === "/history" || pathname.startsWith("/create")) return null;
  const usedPercent = credits ? Math.min(100, Math.max(0, credits.usedPercent)) : 0;
  const format = (value: number) => value.toLocaleString("en-US");

  return (
    <aside className="eos-studio-right-rail hidden w-[var(--rail-width)] shrink-0 space-y-4 xl:block">
      <Card className="overflow-hidden bg-[#201d1b] text-white">
        <div className="p-5"><div className="mb-5 flex items-center justify-between"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary"><CreditCard size={17} /></span><span className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-bold text-white/70">{text.rail.thisMonth}</span></div><p className="text-xs text-white/60">{text.rail.creditsRemaining}</p><p className="mt-1 text-3xl font-bold">{credits ? format(credits.available) : "—"}</p><div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${usedPercent}%` }} /></div><div className="mt-2 flex justify-between text-[10px] text-white/50"><span>{credits ? `${usedPercent}%` : "—"} {text.rail.used}</span><span>{credits ? format(credits.allowance) : "—"} {text.rail.total}</span></div></div>
        <Link href="/usage" className="flex items-center justify-between border-t border-white/10 px-5 py-3 text-xs font-bold text-[#ffb18e] hover:bg-white/5">{text.rail.viewUsage} <ArrowUpRight size={14} /></Link>
      </Card>
      <Card className="p-5"><div className="flex items-center gap-2 text-sm font-bold"><Sparkles size={16} className="text-primary" /> {text.rail.quickTip}</div><p className="mt-3 text-xs leading-5 text-muted-foreground">{text.rail.tip}</p><Link href="/templates" className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-primary">{text.rail.browseTemplates} <ArrowUpRight size={13} /></Link></Card>
      <div className="flex items-center gap-2 px-2 text-xs text-muted-foreground"><CircleHelp size={14} /><span>{text.rail.needHelp}</span><Link href="/settings" className="font-bold text-foreground">{text.rail.helpCenter}</Link></div>
    </aside>
  );
}
