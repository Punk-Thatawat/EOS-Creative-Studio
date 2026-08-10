import type { ReactNode } from "react";
import { SidebarNavigation } from "@/components/app-shell/navigation";
import { SidebarProvider } from "@/components/ui/sidebar";
import { RightRail } from "@/components/app-shell/right-rail";
import { StudioHeader } from "@/components/app-shell/studio-header";

export function AppShell({ children }: { children: ReactNode }) {
  return <SidebarProvider><div className="min-h-screen w-full min-w-0 bg-background"><SidebarNavigation /><div className="min-w-0 lg:pl-[var(--sidebar-width)]"><StudioHeader /><div className="page-gutter mx-auto flex max-w-[1600px] gap-6 py-5 lg:py-8"><main className="min-w-0 flex-1">{children}</main><RightRail /></div></div></div></SidebarProvider>;
}
