import type { ReactNode } from "react";
import { SidebarNavigation } from "@/components/app-shell/navigation";
import { SidebarProvider } from "@/components/ui/sidebar";
import { StudioHeader } from "@/components/app-shell/studio-header";
import { HomeUtilityRail } from "@/features/home/components/home-utility-rail";

export function HomeShell({ children }: { children: ReactNode }) {
  return <SidebarProvider><div className="eos-home-page min-h-screen w-full min-w-0 overflow-x-clip bg-background"><SidebarNavigation /><div className="w-full min-w-0 lg:pl-[var(--sidebar-width)]"><StudioHeader /><div className="page-gutter mx-auto flex w-full min-w-0 max-w-[1760px] gap-5 py-4 lg:gap-6 lg:py-6"><main className="min-w-0 flex-1 basis-0">{children}</main><HomeUtilityRail /></div></div></div></SidebarProvider>;
}
