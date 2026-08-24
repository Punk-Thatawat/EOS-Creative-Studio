"use client";

import { useEffect, useState } from "react";
import { Bell, Layers3, Search } from "lucide-react";
import { GenerationProgressFloating } from "@/components/app-shell/generation-progress-floating";
import { MobileNavigation } from "@/components/app-shell/mobile-navigation";
import { useHeaderAccount } from "@/components/app-shell/use-header-account";
import { AccountMenu } from "@/components/auth/account-menu";

export function StudioHeader() {
  const [isSticky, setIsSticky] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const account = useHeaderAccount();

  useEffect(() => {
    const handleScroll = () => setIsSticky(window.scrollY > 4);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return <><header className={`page-gutter sticky top-0 ${isAccountMenuOpen ? "z-[100] shadow-md" : isSticky ? "z-50 shadow-sm" : "z-30"} flex h-[68px] items-center justify-between bg-background`}><div className="mr-3 md:hidden"><MobileNavigation /></div><div className="ml-auto flex items-center gap-1 sm:gap-3"><div className="relative z-[60] hidden w-[min(360px,42vw)] md:block"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} /><input aria-label="Search projects, assets, templates" placeholder="Search projects, assets, tools..." className="h-10 w-full rounded-xl border border-border bg-surface/95 pl-10 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary" /></div><button className="rounded-xl p-2.5 text-muted-foreground hover:bg-surface-muted md:hidden" aria-label="Search projects, assets, templates"><Search size={18} /></button><div className="hidden items-center gap-2 rounded-full border border-border bg-white px-3 py-1.5 text-xs font-semibold text-foreground sm:flex"><Layers3 size={16} className="text-primary" strokeWidth={2.4} /><span>{account.creditsLabel}</span></div><button className="relative rounded-xl p-2.5 text-muted-foreground hover:bg-surface-muted" aria-label="Open notifications"><Bell size={18} /><span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-white">2</span></button><div className="hidden h-7 w-px bg-border sm:block" /><AccountMenu displayName={account.displayName} role="Owner" useUserIcon onOpenChange={setIsAccountMenuOpen} /></div></header><GenerationProgressFloating /></>;
}
