"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Clock3, Home, LayoutTemplate, Menu, Plus, Shapes, UsersRound, type LucideIcon } from "lucide-react";
import { shellCopy, useLocale } from "@/lib/i18n/locale-provider";
import { useHydrated } from "./use-hydrated";
import { MOBILE_NAVIGATION_OPEN_EVENT } from "./mobile-navigation";

type BottomItem = { label: string; href: string; icon: LucideIcon; accent?: boolean };

const workspaceItems: BottomItem[] = [
  { label: "Home", href: "/home", icon: Home },
  { label: "Assets", href: "/assets", icon: Shapes },
  { label: "Create", href: "/create/image", icon: Plus, accent: true },
  { label: "History", href: "/history", icon: Clock3 },
];

const adminItems: BottomItem[] = [
  { label: "Home", href: "/home", icon: Home },
  { label: "Templates", href: "/admin/templates", icon: LayoutTemplate },
  { label: "Members", href: "/admin/members", icon: UsersRound },
  { label: "Credits", href: "/admin/credits", icon: BarChart3 },
];

export function MobileBottomNavigation() {
  const pathnameFromRouter = usePathname();
  const hydrated = useHydrated();
  const { locale } = useLocale();
  const text = shellCopy[locale];
  const pathname = hydrated ? pathnameFromRouter : "";
  const isAdminRoute = pathname.startsWith("/admin");
  const items = isAdminRoute ? adminItems : workspaceItems;
  const isActive = (item: BottomItem) => item.accent
    ? pathname.startsWith("/create/")
    : pathname === item.href || pathname.startsWith(`${item.href}/`);

  return (
    <nav data-mobile-bottom-navigation className="fixed inset-x-0 bottom-0 z-[45] border-t border-[#e8e2de] bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_18px_rgba(54,38,27,0.08)] backdrop-blur md:hidden" aria-label={locale === "th" ? "เมนูหลักด้านล่าง" : "Mobile primary navigation"}>
      <div className="mx-auto flex h-16 max-w-lg items-stretch justify-around gap-1 px-2">
        {items.map((item) => {
          const active = isActive(item);
          const label = item.href === "/home" ? text.nav["/home"] : item.href === "/assets" ? text.nav["/assets"] : item.href === "/history" ? text.nav["/history"] : item.accent ? text.nav.create : item.label;
          return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-primary ${item.accent ? "-mt-3" : "pt-1"} ${active ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>
            <span className={`flex items-center justify-center ${item.accent ? "size-11 rounded-full bg-[linear-gradient(135deg,#ff6819,#f51591)] text-white shadow-[0_5px_14px_rgba(245,21,145,0.28)]" : "size-8"}`}><item.icon size={item.accent ? 21 : 18} strokeWidth={active ? 2.5 : 2.1} /></span>
            <span className={item.accent ? "mt-0.5" : ""}>{label}</span>
          </Link>;
        })}
        <button type="button" className="flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl pt-1 text-[10px] font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary" aria-label={locale === "th" ? "เปิดเมนูเพิ่มเติม" : "Open more navigation"} onClick={() => window.dispatchEvent(new Event(MOBILE_NAVIGATION_OPEN_EVENT))}>
          <span className="flex size-8 items-center justify-center"><Menu size={18} strokeWidth={2.1} /></span>
          <span>{locale === "th" ? "เพิ่มเติม" : "More"}</span>
        </button>
      </div>
    </nav>
  );
}
