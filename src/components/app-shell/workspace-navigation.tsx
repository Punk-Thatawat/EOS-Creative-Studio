"use client";

import Link, { useLinkStatus } from "next/link";
import { AudioLines, BarChart3, ChevronDown, Clock3, Home, ImageIcon, Settings, Video, WandSparkles } from "lucide-react";
import { shellCopy, useLocale } from "@/lib/i18n/locale-provider";

const workspaceItems = [
  { label: "Home", href: "/home", icon: Home },
  { label: "Assets", href: "/assets", icon: ImageIcon },
  { label: "History", href: "/history", icon: Clock3 },
  { label: "Usage & Credits", href: "/usage", icon: BarChart3 },
  { label: "Settings", href: "/settings", icon: Settings },
];
const createItems = [
  { label: "Image", href: "/create/image", icon: ImageIcon },
  { label: "Video", href: "/create/video", icon: Video },
  { label: "Audio", href: "/create/audio", icon: AudioLines },
];
const mainClass = "flex min-h-11 select-none items-center gap-2 rounded-[11px] px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-primary";
const activeClass = "bg-[linear-gradient(90deg,#f26b38_0_6px,#f5f4f6_6px_100%)] text-primary";
const idleClass = "text-muted-foreground hover:bg-surface-muted hover:text-foreground";

function NavigationLinkStatus() {
  const { pending } = useLinkStatus();
  return pending ? <span className="ml-auto flex size-4 shrink-0 items-center justify-center" aria-label="กำลังเปิดหน้า"><span className="size-3 animate-spin rounded-full border-2 border-current border-r-transparent [animation-duration:500ms]" /></span> : null;
}

/** Shared desktop/sidebar-drawer content. Only active route and close callback differ. */
export function WorkspaceNavigation({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  const { locale } = useLocale();
  const text = shellCopy[locale];
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const isCreateRoute = pathname.startsWith("/create/");
  const renderItem = (item: typeof workspaceItems[number]) => {
    const active = isActive(item.href);
    return <Link key={item.href} href={item.href} onClick={onNavigate} aria-current={active ? "page" : undefined} className={`${mainClass} ${active ? activeClass : idleClass}`}><item.icon size={18} strokeWidth={active ? 2.5 : 2} /><span>{text.nav[item.href] ?? item.label}</span><NavigationLinkStatus /></Link>;
  };
  return <div className="space-y-1" data-workspace-navigation>
    {renderItem(workspaceItems[0])}
    <details key={`create-group:${pathname}`} open={isCreateRoute} className="group">
      <summary className={`${mainClass} cursor-pointer list-none [&::-webkit-details-marker]:hidden ${isCreateRoute ? activeClass : idleClass}`}><WandSparkles size={18} strokeWidth={isCreateRoute ? 2.5 : 2} /><span>{text.nav.create}</span><ChevronDown size={15} className="ml-auto transition-transform group-open:rotate-180" /></summary>
      <div className="ml-5 mt-1 space-y-1 border-l border-[#f1d7cc] pl-2">
        {createItems.map((item) => { const active = isActive(item.href); return <Link key={item.href} href={item.href} onClick={onNavigate} aria-current={active ? "page" : undefined} className={`flex min-h-10 select-none items-center gap-2 rounded-[9px] px-2.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-primary ${active ? "bg-[#fff0e9] text-primary" : idleClass}`}><item.icon size={16} strokeWidth={active ? 2.4 : 2} /><span>{text.nav[item.href] ?? item.label}</span><NavigationLinkStatus /></Link>; })}
      </div>
    </details>
    {workspaceItems.slice(1).map(renderItem)}
  </div>;
}
