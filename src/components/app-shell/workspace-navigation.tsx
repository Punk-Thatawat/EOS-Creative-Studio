"use client";

import Link, { useLinkStatus } from "next/link";
import { AudioLines, BarChart3, ChevronDown, Clock3, Home, ImageIcon, Settings, Video, WandSparkles } from "lucide-react";
import { type MouseEvent, useEffect, useRef, useState } from "react";
import { preloadCreatePage } from "@/features/create/components/preload-create-page";
import { shellCopy, useLocale } from "@/lib/i18n/locale-provider";

const workspaceItems = [
  { label: "Home", href: "/home", icon: Home },
  { label: "Assets", href: "/assets", icon: ImageIcon },
  { label: "History", href: "/history", icon: Clock3 },
  { label: "Usage & Credits", href: "/usage", icon: BarChart3 },
  { label: "Settings", href: "/settings", icon: Settings },
];
const createItems = [
  { kind: "image", label: "Image", href: "/create/image", icon: ImageIcon },
  { kind: "video", label: "Video", href: "/create/video", icon: Video },
  { kind: "audio", label: "Audio", href: "/create/audio", icon: AudioLines },
] as const;
const mainClass = "flex min-h-11 select-none items-center gap-2 rounded-[11px] px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-primary";
const activeClass = "bg-[linear-gradient(90deg,#f26b38_0_6px,#f5f4f6_6px_100%)] text-primary";
const idleClass = "text-muted-foreground hover:bg-surface-muted hover:text-foreground";

function NavigationLinkStatus() {
  const { pending } = useLinkStatus();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Route transitions can remain pending while a page waits for a slow API.
    // Keep the indicator useful without letting a stale spinner stay in the
    // sidebar indefinitely.
    const showTimer = pending ? window.setTimeout(() => setVisible(true), 120) : null;
    const hideTimer = window.setTimeout(() => setVisible(false), pending ? 1800 : 0);
    return () => {
      if (showTimer !== null) window.clearTimeout(showTimer);
      window.clearTimeout(hideTimer);
    };
  }, [pending]);

  return visible ? <span className="ml-auto flex size-4 shrink-0 items-center justify-center" aria-label="กำลังเปิดหน้า"><span className="size-3 animate-spin rounded-full border-2 border-current border-r-transparent [animation-duration:500ms]" /></span> : null;
}

/** Shared desktop/sidebar-drawer content. Only active route and close callback differ. */
export function WorkspaceNavigation({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  const { locale } = useLocale();
  const text = shellCopy[locale];
  const navigationLockRef = useRef<string | null>(null);
  const navigationUnlockTimeoutRef = useRef<number | null>(null);
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const isCreateRoute = pathname.startsWith("/create/");

  useEffect(() => {
    navigationLockRef.current = null;
    if (navigationUnlockTimeoutRef.current !== null) {
      window.clearTimeout(navigationUnlockTimeoutRef.current);
      navigationUnlockTimeoutRef.current = null;
    }
  }, [pathname]);

  useEffect(() => () => {
    if (navigationUnlockTimeoutRef.current !== null) window.clearTimeout(navigationUnlockTimeoutRef.current);
  }, []);

  const handleNavigationClick = (event: MouseEvent<HTMLAnchorElement>, href: string) => {
    // Modified/auxiliary clicks intentionally keep the browser's native
    // new-tab behavior and should not lock the current navigation.
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (href === pathname) {
      onNavigate?.();
      return;
    }
    if (navigationLockRef.current) {
      event.preventDefault();
      return;
    }
    navigationLockRef.current = href;
    navigationUnlockTimeoutRef.current = window.setTimeout(() => {
      navigationLockRef.current = null;
      navigationUnlockTimeoutRef.current = null;
    }, 3000);
    onNavigate?.();
  };

  const renderItem = (item: typeof workspaceItems[number]) => {
    const active = isActive(item.href);
    return <Link key={item.href} href={item.href} onClick={(event) => handleNavigationClick(event, item.href)} aria-current={active ? "page" : undefined} className={`${mainClass} ${active ? activeClass : idleClass}`}><item.icon size={18} strokeWidth={active ? 2.5 : 2} /><span>{text.nav[item.href] ?? item.label}</span><NavigationLinkStatus /></Link>;
  };
  return <div className="space-y-1" data-workspace-navigation>
    {renderItem(workspaceItems[0])}
    <details open={isCreateRoute} className="group">
      <summary className={`${mainClass} cursor-pointer list-none [&::-webkit-details-marker]:hidden ${isCreateRoute ? activeClass : idleClass}`}><WandSparkles size={18} strokeWidth={isCreateRoute ? 2.5 : 2} /><span>{text.nav.create}</span><ChevronDown size={15} className="ml-auto transition-transform group-open:rotate-180" /></summary>
      <div className="ml-5 mt-1 space-y-1 border-l border-[#f1d7cc] pl-2">
        {createItems.map((item) => { const active = isActive(item.href); const preparePage = () => { if (!active) preloadCreatePage(item.kind); }; return <Link key={item.href} href={item.href} onMouseEnter={preparePage} onFocus={preparePage} onClick={(event) => { preloadCreatePage(item.kind); handleNavigationClick(event, item.href); }} aria-current={active ? "page" : undefined} className={`flex min-h-10 select-none items-center gap-2 rounded-[9px] px-2.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-primary ${active ? "bg-[#fff0e9] text-primary" : idleClass}`}><item.icon size={16} strokeWidth={active ? 2.4 : 2} /><span>{text.nav[item.href] ?? item.label}</span><NavigationLinkStatus /></Link>; })}
      </div>
    </details>
    {workspaceItems.slice(1).map(renderItem)}
  </div>;
}
