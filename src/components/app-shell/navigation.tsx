"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, ChevronUp, Clock3, FileText, FolderKanban, Home, ImageIcon, LayoutTemplate, Palette, Settings, Sparkles, Users, Video, WandSparkles, AudioLines } from "lucide-react";
import { EosLogo } from "@/components/brand/eos-logo";
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import type { NavigationItem } from "@/types/navigation";

const primaryItems: NavigationItem[] = [
  { label: "Home", href: "/home", icon: Home },
  { label: "Projects", href: "/projects", icon: FolderKanban },
  { label: "Create", href: "/create", icon: WandSparkles },
  { label: "Templates", href: "/templates", icon: LayoutTemplate },
  { label: "Assets", href: "/assets", icon: ImageIcon },
];

const workspaceItems: NavigationItem[] = [
  { label: "Brand Kit", href: "/brand-kit", icon: Palette },
  { label: "Team & Approval", href: "/team", icon: Users },
  { label: "History", href: "/history", icon: Clock3 },
  { label: "Usage & Credits", href: "/usage", icon: BarChart3 },
  { label: "Settings", href: "/settings", icon: Settings },
];

const createItems: NavigationItem[] = [
  { label: "Image", href: "/create/image", icon: ImageIcon },
  { label: "Video", href: "/create/video", icon: Video },
  { label: "Audio", href: "/create/audio", icon: AudioLines },
  { label: "Document", href: "/create/document", icon: FileText },
];

function NavigationGroup({ label, items, pathname }: { label: string; items: NavigationItem[]; pathname: string }) {
  return <SidebarGroup className="px-0"><SidebarGroupLabel className="px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[#a49c95]">{label}</SidebarGroupLabel><SidebarGroupContent><SidebarMenu>{items.map((item) => { const active = item.href === "/home" ? pathname === item.href : pathname.startsWith(item.href); return <SidebarMenuItem key={item.href}><SidebarMenuButton render={<Link href={item.href} aria-current={active ? "page" : undefined} />} isActive={active} className="h-10 rounded-[11px] px-3 text-sm font-medium text-muted-foreground data-active:bg-[linear-gradient(90deg,#f26b38_0_6px,#f5f4f6_6px_100%)] data-active:text-primary hover:bg-surface-muted hover:text-foreground"><item.icon size={18} strokeWidth={active ? 2.5 : 2} /><span>{item.label}</span></SidebarMenuButton></SidebarMenuItem>; })}</SidebarMenu></SidebarGroupContent></SidebarGroup>;
}

export function SidebarNavigation() {
  const pathname = usePathname();
  const isCreateOpen = pathname === "/create" || pathname.startsWith("/create/");
  return <Sidebar collapsible="none" className="fixed inset-y-0 left-0 z-20 hidden w-[var(--sidebar-width)] border-r border-border bg-surface px-3 py-5 lg:flex lg:px-5"><SidebarHeader className="mb-8 px-2"><EosLogo /></SidebarHeader><SidebarContent className="gap-0"><NavigationGroup label="Workspace" items={primaryItems.filter((item) => item.href !== "/create")} pathname={pathname} /><SidebarGroup className="px-0"><SidebarMenu><SidebarMenuItem><SidebarMenuButton render={<Link href="/create" aria-current={isCreateOpen ? "page" : undefined} />} isActive={isCreateOpen} className="h-10 rounded-[11px] px-3 text-sm font-medium text-muted-foreground data-active:bg-[linear-gradient(90deg,#f26b38_0_6px,#f5f4f6_6px_100%)] data-active:text-primary hover:bg-surface-muted hover:text-foreground"><WandSparkles size={18} strokeWidth={isCreateOpen ? 2.5 : 2} /><span>Create</span><ChevronUp className="ml-auto" size={15} /></SidebarMenuButton></SidebarMenuItem>{isCreateOpen ? <SidebarMenu className="ml-5 mt-1 gap-1 border-l border-[#f1d7cc] pl-2">{createItems.map((item) => { const active = pathname.startsWith(item.href); return <SidebarMenuItem key={item.href}><SidebarMenuButton render={<Link href={item.href} aria-current={active ? "page" : undefined} />} isActive={active} className="h-8 rounded-[9px] px-2.5 text-xs font-medium text-muted-foreground data-active:bg-[#fff0e9] data-active:text-primary hover:bg-surface-muted hover:text-foreground"><item.icon size={15} strokeWidth={active ? 2.4 : 2} /><span>{item.label}</span></SidebarMenuButton></SidebarMenuItem>; })}</SidebarMenu> : null}</SidebarMenu></SidebarGroup><NavigationGroup label="Manage" items={workspaceItems} pathname={pathname} /></SidebarContent><SidebarFooter className="mt-auto rounded-2xl bg-[#201d1b] p-4 text-white"><div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-primary"><Sparkles size={15} /></div><p className="text-xs font-bold">Create more with EOS</p><p className="mt-1 text-[11px] leading-5 text-white/60">Your creative workspace is ready for its next idea.</p><Link href="/create" className="mt-3 block text-xs font-bold text-[#ffad8a]">Start creating -&gt;</Link></SidebarFooter></Sidebar>;
}
