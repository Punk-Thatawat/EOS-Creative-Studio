"use client";

import { useEffect, useState } from "react";
import { Bell, Search } from "lucide-react";
import { MobileNavigation } from "@/components/app-shell/mobile-navigation";
import { AccountMenu } from "@/components/auth/account-menu";

export function StudioHeader() {
  const [isSticky, setIsSticky] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsSticky(window.scrollY > 4);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return <header className={`page-gutter sticky top-0 flex h-[68px] items-center justify-between bg-background ${isSticky ? "z-50 shadow-sm" : ""}`}><div className="mr-3 lg:hidden"><MobileNavigation /></div><div className="ml-auto flex items-center gap-1 sm:gap-3"><div className="relative z-[60] hidden w-[min(360px,42vw)] md:block"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} /><input aria-label="Search projects, assets, templates" placeholder="Search projects, assets, tools..." className="h-10 w-full rounded-xl border border-border bg-surface/95 pl-10 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary" /></div><button className="rounded-xl p-2.5 text-muted-foreground hover:bg-surface-muted md:hidden" aria-label="Search projects, assets, templates"><Search size={18} /></button><button className="relative rounded-xl p-2.5 text-muted-foreground hover:bg-surface-muted" aria-label="Open notifications"><Bell size={18} /><span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-white">2</span></button><div className="hidden h-7 w-px bg-border sm:block" /><AccountMenu displayName="EOS Admin" role="Owner" useUserIcon /></div></header>;
}
