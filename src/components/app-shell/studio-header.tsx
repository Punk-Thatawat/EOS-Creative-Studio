"use client";

import { useEffect, useState } from "react";
import { Bell, Database, Layers3, Search } from "lucide-react";
import { usePathname } from "next/navigation";
import { GenerationProgressFloating } from "@/components/app-shell/generation-progress-floating";
import { MobileNavigation } from "@/components/app-shell/mobile-navigation";
import { useHeaderAccount } from "@/components/app-shell/use-header-account";
import { AccountMenu } from "@/components/auth/account-menu";

export function StudioHeader() {
  const [isSticky, setIsSticky] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const account = useHeaderAccount();
  const pathname = usePathname();
  const isAudioStudio = pathname.startsWith("/create/audio");
  const isAssets = pathname.startsWith("/assets");
  const isUsage = pathname === "/usage";

  useEffect(() => {
    const handleScroll = () => setIsSticky(window.scrollY > 4);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const clearAssetSearch = () => {
      const searchInput = document.querySelector<HTMLInputElement>('input[aria-label="Search assets"]');
      if (searchInput) searchInput.value = "";
    };
    window.addEventListener("assets-search-clear", clearAssetSearch);
    return () => window.removeEventListener("assets-search-clear", clearAssetSearch);
  }, []);

  return (
    <>
      <header className={`eos-studio-header page-gutter sticky top-0 ${isAccountMenuOpen ? "z-[100] shadow-md" : isSticky ? "z-50 shadow-sm" : "z-30"} flex h-[80px] items-center justify-between border-b border-[#ece7e3] bg-background`}>
        <div className="mr-3 md:hidden"><MobileNavigation /></div>
        <div className="ml-auto flex items-center gap-1 sm:gap-3">
          <div className="relative z-[60] hidden w-[min(420px,42vw)] md:block">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <input
              aria-label={isAssets ? "Search assets" : "Search projects, assets, templates"}
              placeholder={isAssets ? "Search assets..." : "Search projects, assets, tools..."}
              onChange={(event) => { if (isAssets) { const query = event.currentTarget.value; window.history.replaceState(null, "", query ? `/assets?q=${encodeURIComponent(query)}` : "/assets"); window.dispatchEvent(new Event("assets-search")); } }}
              className="h-[46px] w-full rounded-[17px] border border-border bg-surface/95 pl-11 pr-12 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
            />
            {isAssets ? <span className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md bg-[#f6f7f9] px-2 py-1 text-[10px] font-semibold text-[#4c4e5c]">⌘ K</span> : null}
          </div>
          <button className="rounded-xl p-2.5 text-muted-foreground hover:bg-surface-muted md:hidden" aria-label="Search projects, assets, templates"><Search size={18} /></button>
          {isAssets || isUsage ? null : <div className="header-credits-badge hidden h-9 items-center gap-2 rounded-full border border-border bg-white px-3.5 text-[13px] font-semibold text-foreground sm:flex">{isAudioStudio ? <Database size={18} className="text-foreground" strokeWidth={2.4} /> : <Layers3 size={18} className="text-primary" strokeWidth={2.4} />}<span>{isAudioStudio ? "4,250 Credits" : account.creditsLabel}</span></div>}
          <button className="relative rounded-xl p-2.5 text-muted-foreground hover:bg-surface-muted" aria-label="Open notifications"><Bell size={18} /><span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-white">2</span></button>
          <div className="hidden h-7 w-px bg-border sm:block" />
          <AccountMenu displayName={isAssets || isAudioStudio || isUsage ? "EOS Admin" : account.displayName} role="Owner" useUserIcon onOpenChange={setIsAccountMenuOpen} />
        </div>
      </header>
      <GenerationProgressFloating />
    </>
  );
}
