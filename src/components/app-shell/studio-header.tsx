"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Layers3 } from "lucide-react";
import { GenerationProgressFloating } from "@/components/app-shell/generation-progress-floating";
import { MobileBottomNavigation } from "@/components/app-shell/mobile-bottom-navigation";
import { MobileNavigation } from "@/components/app-shell/mobile-navigation";
import { useHeaderAccount } from "@/components/app-shell/use-header-account";
import { AccountMenu } from "@/components/auth/account-menu";
import { useLocale } from "@/lib/i18n/locale-provider";

export function StudioHeader() {
  const [isSticky, setIsSticky] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const account = useHeaderAccount();
  const { locale } = useLocale();
  useEffect(() => {
    const handleScroll = () => setIsSticky(window.scrollY > 4);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      <header
        className={`eos-studio-header sticky top-0 ${isAccountMenuOpen ? "z-[100] shadow-md" : isSticky ? "z-50 shadow-sm" : "z-30"} flex h-16 items-center justify-between border-b border-[#ece7e3] bg-white px-3 sm:h-[80px] sm:px-6 lg:px-8`}
      >
        <div className="mr-3 lg:hidden">
          <MobileNavigation />
        </div>
        <div className="ml-auto flex min-w-0 max-w-full items-center gap-1 sm:gap-3">
          {
            <Link
              href="/usage?tab=topup"
              title={locale === "th" ? "เติมเครดิต" : "Top up credits"}
              className="header-credits-badge shrink-0 hidden h-9 touch:min-h-10 items-center gap-2 rounded-full border border-border bg-white px-3.5 text-[13px] font-semibold text-foreground transition-colors hover:border-primary hover:bg-orange-50 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 sm:flex"
            >
              <Layers3 size={18} className="text-primary" strokeWidth={2.4} />
              <span>
                {locale === "th" ? account.creditsLabel.replace(/ Credits$/, " เครดิต") : account.creditsLabel}
              </span>
              <span className="sr-only">{locale === "th" ? " — เติมเครดิต" : " — Top up credits"}</span>
            </Link>
          }
          <AccountMenu
            displayName={account.displayName}
            role={account.role}
            useUserIcon
            onOpenChange={setIsAccountMenuOpen}
          />
        </div>
      </header>
      <MobileBottomNavigation />
      <GenerationProgressFloating />
    </>
  );
}
