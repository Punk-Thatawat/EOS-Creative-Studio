"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { HomeUtilityRail } from "@/features/home/components/home-utility-rail";
import { SidebarNavigation } from "@/components/app-shell/navigation";
import { SidebarProvider } from "@/components/ui/sidebar";
import { StudioHeader } from "@/components/app-shell/studio-header";
import { LegalFooter } from "@/components/legal/legal-footer";

export function AppShell({ children }: { children: ReactNode }) {
  const isHome = usePathname() === "/home";
  return <SidebarProvider><div className={`${isHome ? "eos-home-page overflow-x-clip " : ""}min-h-screen w-full min-w-0 bg-background`}><SidebarNavigation /><div className="w-full min-w-0 md:pl-[var(--sidebar-width)]"><StudioHeader /><div className={`page-gutter mx-auto flex w-full min-w-0 ${isHome ? "max-w-[1760px] gap-5 py-4 lg:gap-6 lg:py-6" : "max-w-[1600px] py-5 lg:py-8"}`}><main className="min-w-0 flex-1 basis-0">{children}<LegalFooter /></main>{isHome ? <HomeUtilityRail /> : null}</div></div></div></SidebarProvider>;
}
