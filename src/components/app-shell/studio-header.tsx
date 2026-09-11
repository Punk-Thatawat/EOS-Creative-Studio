"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Layers3, Search } from "lucide-react";
import { usePathname } from "next/navigation";
import { GenerationProgressFloating } from "@/components/app-shell/generation-progress-floating";
import { MobileBottomNavigation } from "@/components/app-shell/mobile-bottom-navigation";
import { MobileNavigation } from "@/components/app-shell/mobile-navigation";
import { useHydrated } from "@/components/app-shell/use-hydrated";
import { useHeaderAccount } from "@/components/app-shell/use-header-account";
import { AccountMenu } from "@/components/auth/account-menu";
import { shellCopy, useLocale } from "@/lib/i18n/locale-provider";

export function StudioHeader() {
  const [isSticky, setIsSticky] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const account = useHeaderAccount();
  const { locale } = useLocale();
  const text = shellCopy[locale];
  const pathnameFromRouter = usePathname();
  const hydrated = useHydrated();
  const pathname = hydrated ? pathnameFromRouter : "";
  const isAssets = pathname.startsWith("/assets");

  useEffect(() => {
    if (!isAssets) return;
    const focusSearch = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        document.querySelector<HTMLInputElement>('.eos-studio-header input')?.focus();
      }
    };
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, [isAssets]);

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
      <header className={`eos-studio-header sticky top-0 ${isAccountMenuOpen ? "z-[100] shadow-md" : isSticky ? "z-50 shadow-sm" : "z-30"} flex h-16 items-center justify-between border-b border-[#ece7e3] bg-white px-3 sm:h-[80px] sm:px-6 lg:px-8`}>
        <div className="mr-3 md:hidden"><MobileNavigation /></div>
        <div className="ml-auto flex min-w-0 max-w-full items-center gap-1 sm:gap-3">
          {isAssets ? <div className="relative z-[60] hidden min-w-0 w-[min(420px,42vw)] shrink md:block">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <input
              key={pathname}
              aria-label={isAssets ? text.header.searchAssets : text.header.openSearch}
              placeholder={isAssets ? text.header.searchAssets : text.header.search}
              onChange={(event) => { if (isAssets) { const query = event.currentTarget.value; window.history.replaceState(null, "", query ? `/assets?q=${encodeURIComponent(query)}` : "/assets"); window.dispatchEvent(new Event("assets-search")); } }}
              className="h-[46px] w-full rounded-[17px] border border-border bg-surface/95 pl-11 pr-12 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
            />
            {isAssets ? <span className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md bg-[#f6f7f9] px-2 py-1 text-[10px] font-semibold text-[#4c4e5c]">⌘ K</span> : null}
          </div> : null}
          {isAssets ? <button className="rounded-xl p-2.5 text-muted-foreground hover:bg-surface-muted md:hidden" aria-label={text.header.openSearch}><Search size={18} /></button> : null}
          {<Link href="/usage?tab=topup" title={locale === "th" ? "เติมเครดิต" : "Top up credits"} className="header-credits-badge shrink-0 hidden h-9 items-center gap-2 rounded-full border border-border bg-white px-3.5 text-[13px] font-semibold text-foreground transition-colors hover:border-primary hover:bg-orange-50 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 sm:flex"><Layers3 size={18} className="text-primary" strokeWidth={2.4} /><span>{locale === "th" ? account.creditsLabel.replace(/ Credits$/, " เครดิต") : account.creditsLabel}</span><span className="sr-only">{locale === "th" ? " — เติมเครดิต" : " — Top up credits"}</span></Link>}
          <AccountMenu displayName={account.displayName} role={account.role} useUserIcon onOpenChange={setIsAccountMenuOpen} />
        </div>
      </header>
      <MobileBottomNavigation />
      <GenerationProgressFloating />
    </>
  );
}
