"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, AudioLines, BarChart3, Boxes, ChevronDown, Clock3, FileText, FolderKanban, Home, ImageIcon, LayoutTemplate, MessageSquareText, Palette, Settings, Settings2, ShieldCheck, Users, UsersRound, Video, WandSparkles } from "lucide-react";
import { EosLogo } from "@/components/brand/eos-logo";
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import type { NavigationItem } from "@/types/navigation";

const primaryItems: NavigationItem[] = [
  { label: "Home", href: "/home", icon: Home },
  { label: "Projects", href: "/projects", icon: FolderKanban },
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

function AdminNavigationGroup({ label, items, pathname }: { label: string; items: Array<NavigationItem & { disabled?: boolean }>; pathname: string }) {
  return <SidebarGroup className="px-0"><SidebarGroupLabel className="px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[#a49c95]">{label}</SidebarGroupLabel><SidebarGroupContent><SidebarMenu>{items.map((item) => { const active = !item.disabled && (item.href === "/admin/model-routes" ? pathname === item.href : pathname.startsWith(item.href)); return <SidebarMenuItem key={item.label}>{item.disabled ? <SidebarMenuButton disabled className="h-10 rounded-[11px] px-3 text-sm font-medium text-muted-foreground"><item.icon size={18} /><span>{item.label}</span><span className="ml-auto text-[9px] font-bold uppercase tracking-wider text-[#b9afa8]">Soon</span></SidebarMenuButton> : <SidebarMenuButton render={<Link href={item.href} aria-current={active ? "page" : undefined} />} isActive={active} className="h-10 rounded-[11px] px-3 text-sm font-medium text-muted-foreground data-active:bg-[linear-gradient(90deg,#f26b38_0_6px,#f5f4f6_6px_100%)] data-active:text-primary hover:bg-surface-muted hover:text-foreground"><item.icon size={18} strokeWidth={active ? 2.5 : 2} /><span>{item.label}</span></SidebarMenuButton>}</SidebarMenuItem>; })}</SidebarMenu></SidebarGroupContent></SidebarGroup>;
}

const adminImageFeatures = [
  { id: "text-to-image", label: "Text to Image" },
  { id: "image-to-image", label: "Image to Image" },
  { id: "style-transfer", label: "Style Transfer" },
  { id: "background-removal", label: "AI Background" },
  { id: "upscale", label: "Upscale" },
  { id: "extend-image", label: "Extend Image" },
] as const;

const adminVideoFeatures = [
  { id: "image-to-video", label: "Image to Video" },
  { id: "text-to-video", label: "Text to Video" },
  { id: "people-video", label: "People Video" },
  { id: "motion-transfer", label: "Motion Transfer" },
  { id: "lipsync", label: "Lipsync" },
  { id: "extend-video", label: "Extend Video" },
] as const;

const adminCreativeFeatures = [
  { id: "audio", label: "Audio", description: "Create audio and music", icon: AudioLines },
  { id: "document", label: "Document", description: "Create documents and presentations", icon: FileText },
] as const;

function AdminFeatureNavigationTree({ pathname }: { pathname: string }) {
  const searchParams = useSearchParams();
  const requestedFeature = searchParams.get("feature");
  const selectedFeature = requestedFeature === "video" ? "image-to-video" : requestedFeature ?? "text-to-image";
  const isImageFeature = adminImageFeatures.some((item) => item.id === selectedFeature);
  const isVideoFeature = adminVideoFeatures.some((item) => item.id === selectedFeature);

  return <SidebarGroup className="px-0"><SidebarMenu><SidebarMenuItem><details open={isImageFeature} className="group"><summary className={`flex h-10 w-full cursor-pointer list-none items-center gap-2 overflow-hidden rounded-[11px] px-3 text-left text-sm font-medium outline-hidden transition-colors [&::-webkit-details-marker]:hidden ${isImageFeature ? "bg-[linear-gradient(90deg,#f26b38_0_6px,#f5f4f6_6px_100%)] text-primary" : "text-muted-foreground hover:bg-surface-muted hover:text-foreground"}`}><ImageIcon size={18} strokeWidth={isImageFeature ? 2.5 : 2} /><span>Image</span><span className="ml-auto"><ChevronDown size={15} className="transition-transform group-open:rotate-180" /></span></summary><div className="ml-5 mt-1 border-l border-[#f1d7cc] pl-2">{adminImageFeatures.map((item) => { const active = pathname === "/admin/model-routes" && selectedFeature === item.id; return <Link key={item.id} href={`/admin/model-routes?feature=${item.id}`} aria-current={active ? "page" : undefined} className={`flex h-8 items-center rounded-[9px] px-2.5 text-xs font-medium transition-colors ${active ? "bg-[#fff0e9] text-primary" : "text-muted-foreground hover:bg-surface-muted hover:text-foreground"}`}>{item.label}</Link>; })}</div></details></SidebarMenuItem><SidebarMenuItem><details open={isVideoFeature} className="group"><summary className={`flex h-10 w-full cursor-pointer list-none items-center gap-2 overflow-hidden rounded-[11px] px-3 text-left text-sm font-medium outline-hidden transition-colors [&::-webkit-details-marker]:hidden ${isVideoFeature ? "bg-[linear-gradient(90deg,#f26b38_0_6px,#f5f4f6_6px_100%)] text-primary" : "text-muted-foreground hover:bg-surface-muted hover:text-foreground"}`}><Video size={18} strokeWidth={isVideoFeature ? 2.5 : 2} /><span>Video</span><span className="ml-auto"><ChevronDown size={15} className="transition-transform group-open:rotate-180" /></span></summary><div className="ml-5 mt-1 border-l border-[#f1d7cc] pl-2">{adminVideoFeatures.map((item) => { const active = pathname === "/admin/model-routes" && selectedFeature === item.id; return <Link key={item.id} href={`/admin/model-routes?feature=${item.id}`} aria-current={active ? "page" : undefined} className={`flex h-8 items-center rounded-[9px] px-2.5 text-xs font-medium transition-colors ${active ? "bg-[#fff0e9] text-primary" : "text-muted-foreground hover:bg-surface-muted hover:text-foreground"}`}>{item.label}</Link>; })}</div></details></SidebarMenuItem>{adminCreativeFeatures.map((item) => { const active = pathname === "/admin/model-routes" && selectedFeature === item.id; return <SidebarMenuItem key={item.id}><SidebarMenuButton render={<Link href={`/admin/model-routes?feature=${item.id}`} aria-current={active ? "page" : undefined} />} isActive={active} className="h-8 rounded-[9px] px-3 text-xs font-medium text-muted-foreground data-active:bg-[#fff0e9] data-active:text-primary hover:bg-surface-muted hover:text-foreground"><item.icon size={15} strokeWidth={active ? 2.4 : 2} /><span>{item.label}</span></SidebarMenuButton></SidebarMenuItem>; })}</SidebarMenu></SidebarGroup>;
}

function AdminFeatureNavigation({ pathname }: { pathname: string }) {
  const searchParams = useSearchParams();
  const selectedFeature = searchParams.get("feature") ?? "text-to-image";
  const isImageFeature = adminImageFeatures.some((item) => item.id === selectedFeature);

  return <SidebarGroup className="px-0"><SidebarMenu><SidebarMenuItem><details open={isImageFeature} className="group"><summary className={`flex h-10 w-full cursor-pointer list-none items-center gap-2 overflow-hidden rounded-[11px] px-3 text-left text-sm font-medium outline-hidden transition-colors [&::-webkit-details-marker]:hidden ${isImageFeature ? "bg-[linear-gradient(90deg,#f26b38_0_6px,#f5f4f6_6px_100%)] text-primary" : "text-muted-foreground hover:bg-surface-muted hover:text-foreground"}`}><WandSparkles size={18} strokeWidth={isImageFeature ? 2.5 : 2} /><span>Create</span><span className="ml-auto"><ChevronDown size={15} className="transition-transform group-open:rotate-180" /></span></summary><SidebarMenu className="ml-5 mt-1 gap-1 border-l border-[#f1d7cc] pl-2"><SidebarMenuItem><SidebarMenuButton render={<Link href="/admin/model-routes?feature=text-to-image" aria-current={isImageFeature ? "page" : undefined} />} isActive={isImageFeature} className="h-8 rounded-[9px] px-2.5 text-xs font-medium text-muted-foreground data-active:bg-[#fff0e9] data-active:text-primary hover:bg-surface-muted hover:text-foreground"><ImageIcon size={15} strokeWidth={isImageFeature ? 2.4 : 2} /><span>Image</span></SidebarMenuButton></SidebarMenuItem>{adminCreativeFeatures.map((item) => { const active = pathname === "/admin/model-routes" && selectedFeature === item.id; return <SidebarMenuItem key={item.id}><SidebarMenuButton render={<Link href={`/admin/model-routes?feature=${item.id}`} aria-current={active ? "page" : undefined} />} isActive={active} className="h-8 rounded-[9px] px-2.5 text-xs font-medium text-muted-foreground data-active:bg-[#fff0e9] data-active:text-primary hover:bg-surface-muted hover:text-foreground"><item.icon size={15} strokeWidth={active ? 2.4 : 2} /><span>{item.label}</span></SidebarMenuButton></SidebarMenuItem>; })}</SidebarMenu></details></SidebarMenuItem></SidebarMenu></SidebarGroup>;
}

function AdminSidebarNavigation({ pathname }: { pathname: string }) {
  const adminItems = [
    { label: "Model routes", href: "/admin/model-routes", icon: Settings2 },
    { label: "Style presets", href: "/admin/style-presets", icon: Palette },
    { label: "Prompt templates", href: "/admin/prompt-templates", icon: MessageSquareText },
    { label: "Provider catalog", href: "/admin/provider-catalog", icon: Boxes, disabled: true },
    { label: "Feature settings", href: "/admin/feature-settings", icon: ShieldCheck, disabled: true },
  ] satisfies Array<NavigationItem & { disabled?: boolean }>;
  const operations = [
    { label: "Users & roles", href: "/admin/users", icon: UsersRound, disabled: true },
    { label: "Credits & billing", href: "/admin/credits", icon: BarChart3 },
    { label: "System settings", href: "/admin/settings", icon: Settings, disabled: true },
  ] satisfies Array<NavigationItem & { disabled?: boolean }>;

  return <Sidebar collapsible="none" className="fixed inset-y-0 left-0 z-20 hidden w-[var(--sidebar-width)] border-r border-border bg-surface px-3 py-5 md:flex md:px-5"><SidebarHeader className="mb-8 px-2"><EosLogo /></SidebarHeader><SidebarContent className="gap-0"><AdminNavigationGroup label="Administration" items={adminItems} pathname={pathname} /><AdminFeatureNavigationTree pathname={pathname} /><AdminNavigationGroup label="Operations" items={operations} pathname={pathname} /><SidebarGroup className="mt-2 px-0"><SidebarGroupContent><SidebarMenu><SidebarMenuItem><SidebarMenuButton render={<Link href="/home" />} className="h-10 rounded-[11px] px-3 text-sm font-medium text-muted-foreground hover:bg-surface-muted hover:text-foreground"><ArrowLeft size={18} /><span>Back to workspace</span></SidebarMenuButton></SidebarMenuItem></SidebarMenu></SidebarGroupContent></SidebarGroup></SidebarContent></Sidebar>;
}

export function SidebarNavigation() {
  const pathname = usePathname();
  if (pathname.startsWith("/admin")) return <AdminSidebarNavigation pathname={pathname} />;
  const isCreateRoute = pathname.startsWith("/create/");

  return <Sidebar collapsible="none" className="fixed inset-y-0 left-0 z-20 hidden w-[var(--sidebar-width)] border-r border-border bg-surface px-3 py-5 md:flex md:px-5"><SidebarHeader className="mb-8 px-2"><EosLogo /></SidebarHeader><SidebarContent className="gap-0"><NavigationGroup label="Workspace" items={primaryItems} pathname={pathname} /><SidebarGroup className="px-0"><SidebarMenu><SidebarMenuItem><details open={isCreateRoute} className="group"><summary className={`flex h-10 w-full cursor-pointer list-none items-center gap-2 overflow-hidden rounded-[11px] px-3 text-left text-sm font-medium outline-hidden ring-sidebar-ring transition-colors focus-visible:ring-2 [&::-webkit-details-marker]:hidden ${isCreateRoute ? "bg-[linear-gradient(90deg,#f26b38_0_6px,#f5f4f6_6px_100%)] text-primary" : "text-muted-foreground hover:bg-surface-muted hover:text-foreground"}`}><WandSparkles size={18} strokeWidth={isCreateRoute ? 2.5 : 2} /><span>Create</span><span className="ml-auto"><svg className="size-[15px] transition-transform group-open:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg></span></summary><SidebarMenu id="create-navigation-menu" className="ml-5 mt-1 gap-1 border-l border-[#f1d7cc] pl-2">{createItems.map((item) => { const active = pathname.startsWith(item.href); return <SidebarMenuItem key={item.href}><SidebarMenuButton render={<Link href={item.href} aria-current={active ? "page" : undefined} />} isActive={active} className="h-8 rounded-[9px] px-2.5 text-xs font-medium text-muted-foreground data-active:bg-[#fff0e9] data-active:text-primary hover:bg-surface-muted hover:text-foreground"><item.icon size={15} strokeWidth={active ? 2.4 : 2} /><span>{item.label}</span></SidebarMenuButton></SidebarMenuItem>; })}</SidebarMenu></details></SidebarMenuItem></SidebarMenu></SidebarGroup><NavigationGroup label="Manage" items={workspaceItems} pathname={pathname} /></SidebarContent>{/* Temporarily hidden: Create more with EOS promo. */}</Sidebar>;
}
