import Link from "next/link";
import { ArrowUpRight, CircleHelp, CreditCard, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";

export function RightRail() {
  return (
    <aside className="hidden w-[var(--rail-width)] shrink-0 space-y-4 xl:block">
      <Card className="overflow-hidden bg-[#201d1b] text-white">
        <div className="p-5"><div className="mb-5 flex items-center justify-between"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary"><CreditCard size={17} /></span><span className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-bold text-white/70">This month</span></div><p className="text-xs text-white/60">Credits remaining</p><p className="mt-1 text-3xl font-bold">2,480</p><div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full w-[68%] rounded-full bg-primary" /></div><div className="mt-2 flex justify-between text-[10px] text-white/50"><span>68% used</span><span>8,000 total</span></div></div>
        <Link href="/usage" className="flex items-center justify-between border-t border-white/10 px-5 py-3 text-xs font-bold text-[#ffb18e] hover:bg-white/5">View usage <ArrowUpRight size={14} /></Link>
      </Card>
      <Card className="p-5"><div className="flex items-center gap-2 text-sm font-bold"><Sparkles size={16} className="text-primary" /> Quick tip</div><p className="mt-3 text-xs leading-5 text-muted-foreground">Start with a template to keep your team’s visual language consistent across every asset.</p><Link href="/templates" className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-primary">Browse templates <ArrowUpRight size={13} /></Link></Card>
      <div className="flex items-center gap-2 px-2 text-xs text-muted-foreground"><CircleHelp size={14} /><span>Need a hand?</span><Link href="/settings" className="font-bold text-foreground">Help center</Link></div>
    </aside>
  );
}
