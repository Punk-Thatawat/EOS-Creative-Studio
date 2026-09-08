"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BarChart3, Clapperboard, Home, LayoutTemplate, Menu, MessageSquareText, Palette, Settings2, UsersRound, X } from "lucide-react";
import { EosLogo } from "@/components/brand/eos-logo";
import { useLocale } from "@/lib/i18n/locale-provider";
import { WorkspaceNavigation } from "./workspace-navigation";
import { useHydrated } from "./use-hydrated";

const adminItems = [
  { label: "Video showcase", href: "/admin/video-showcase", icon: Clapperboard },
  { label: "Templates", href: "/admin/templates", icon: LayoutTemplate },
  { label: "Model routes", href: "/admin/model-routes", icon: Settings2 },
  { label: "Style presets", href: "/admin/style-presets", icon: Palette },
  { label: "Prompt templates", href: "/admin/prompt-templates", icon: MessageSquareText },
];

const adminOperations = [
  { label: "Members & roles", href: "/admin/members", icon: UsersRound },
  { label: "Credits & billing", href: "/admin/credits", icon: BarChart3 },
];

export const MOBILE_NAVIGATION_OPEN_EVENT = "eos:open-mobile-navigation";

export function MobileNavigation() {
  const pathnameFromRouter = usePathname();
  const hydrated = useHydrated();
  const { locale } = useLocale();
  const pathname = hydrated ? pathnameFromRouter : "";
  const [open, setOpen] = useState(false);
  const isAdminRoute = pathname.startsWith("/admin");

  useEffect(() => {
    const openNavigation = () => setOpen(true);
    window.addEventListener(MOBILE_NAVIGATION_OPEN_EVENT, openNavigation);
    return () => window.removeEventListener(MOBILE_NAVIGATION_OPEN_EVENT, openNavigation);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);


  return (
    <>
      <button type="button" className="flex size-11 items-center justify-center rounded-xl border border-border bg-white text-foreground shadow-[var(--shadow-sm)] transition-colors hover:bg-surface-muted md:hidden" aria-label={locale === "th" ? "เปิดเมนูนำทาง" : "Open navigation menu"} aria-expanded={open} aria-controls="mobile-navigation" onClick={() => setOpen(true)}>
        <Menu size={21} strokeWidth={2.4} />
      </button>
      {open ? (
        <div className="fixed inset-0 z-[60] md:hidden">
          <button type="button" className="absolute inset-0 bg-[#201d1b]/40" aria-label="Close navigation menu" onClick={() => setOpen(false)} />
          <nav id="mobile-navigation" className="absolute inset-y-0 left-0 flex w-[min(280px,calc(100vw-24px))] flex-col overflow-y-auto bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[var(--shadow-md)]" aria-label="Mobile navigation">
            <div className="mb-8 flex items-center justify-between">
              <EosLogo href="/home" />
              <button type="button" className="rounded-lg p-2 text-muted-foreground hover:bg-surface-muted" aria-label={locale === "th" ? "ปิดเมนูนำทาง" : "Close navigation menu"} onClick={() => setOpen(false)}>
                <X size={18} />
              </button>
            </div>
            {isAdminRoute ? <div className="space-y-1">
              <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#a49c95]">Administration</p>
              {adminItems.map((item) => { const active = pathname === item.href || pathname.startsWith(`${item.href}/`); return <Link key={item.href} href={item.href} onClick={() => setOpen(false)} aria-current={active ? "page" : undefined} className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold ${active ? "bg-[#fff0e9] text-primary" : "text-muted-foreground hover:bg-[#fff0e9] hover:text-primary"}`}><item.icon size={18} strokeWidth={active ? 2.5 : 2} /><span>{item.label}</span></Link>; })}
              <p className="px-3 pb-2 pt-5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#a49c95]">Operations</p>
              {adminOperations.map((item) => { const active = pathname === item.href || pathname.startsWith(`${item.href}/`); return <Link key={item.href} href={item.href} onClick={() => setOpen(false)} aria-current={active ? "page" : undefined} className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold ${active ? "bg-[#fff0e9] text-primary" : "text-muted-foreground hover:bg-[#fff0e9] hover:text-primary"}`}><item.icon size={18} strokeWidth={active ? 2.5 : 2} /><span>{item.label}</span></Link>; })}
              <Link href="/home" onClick={() => setOpen(false)} className="mt-4 flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-muted-foreground hover:bg-[#fff0e9] hover:text-primary"><Home size={18} />Back to workspace</Link>
            </div> : <WorkspaceNavigation pathname={pathname} onNavigate={() => setOpen(false)} />}
          </nav>
        </div>
      ) : null}
    </>
  );
}
