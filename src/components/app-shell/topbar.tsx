import Link from "next/link";
import { Bell, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AccountMenu } from "@/components/auth/account-menu";

export function Topbar({ title = "Workspace" }: { title?: string }) {
  return (
    <header className="page-gutter sticky top-0 z-10 flex h-[72px] items-center justify-between border-b border-border bg-white/95 backdrop-blur">
      <div><p className="text-xs font-medium text-muted-foreground">Tuesday, August 6, 2026</p><h1 className="mt-0.5 text-lg font-bold tracking-tight">{title}</h1></div>
      <div className="flex items-center gap-2 sm:gap-4">
        <Link href="/create" className="hidden sm:block"><Button size="sm"><Plus size={16} /> Create new</Button></Link>
        <button className="relative rounded-xl p-2.5 text-muted-foreground hover:bg-surface-muted hover:text-foreground" aria-label="Notifications"><Bell size={18} /><span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-primary" /></button>
        <div className="hidden h-7 w-px bg-border sm:block" />
        <AccountMenu displayName="Jamie Davis" />
      </div>
    </header>
  );
}
