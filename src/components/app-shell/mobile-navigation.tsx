"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { AudioLines, BarChart3, Boxes, ChevronDown, Home, ImageIcon, LayoutTemplate, Menu, MessageSquareText, Palette, Settings, Settings2, ShieldCheck, UsersRound, Video, WandSparkles, X } from "lucide-react";
import { useHydrated } from "./use-hydrated";

const links = [
  { label: "Home", href: "/home", icon: Home },
  { label: "Projects", href: "/projects", icon: LayoutTemplate },
  { label: "Templates", href: "/templates", icon: LayoutTemplate },
  { label: "Settings", href: "/settings", icon: Settings },
];

const createItems = [
  { label: "Image", href: "/create/image", icon: ImageIcon },
  { label: "Video", href: "/create/video", icon: Video },
  { label: "Audio", href: "/create/audio", icon: AudioLines },
];

const adminItems = [
  { label: "Model routes", href: "/admin/model-routes", icon: Settings2 },
  { label: "Style presets", href: "/admin/style-presets", icon: Palette },
  { label: "Prompt templates", href: "/admin/prompt-templates", icon: MessageSquareText },
  { label: "Provider catalog", href: "/admin/provider-catalog", icon: Boxes, disabled: true },
  { label: "Feature settings", href: "/admin/feature-settings", icon: ShieldCheck, disabled: true },
];

const adminOperations = [
  { label: "Users & roles", href: "/admin/users", icon: UsersRound, disabled: true },
  { label: "Credits & billing", href: "/admin/credits", icon: BarChart3 },
  { label: "System settings", href: "/admin/settings", icon: Settings, disabled: true },
];

export function MobileNavigation() {
  const pathnameFromRouter = usePathname();
  const hydrated = useHydrated();
  const pathname = hydrated ? pathnameFromRouter : "";
  const [open, setOpen] = useState(false);
  const isCreateRoute = pathname.startsWith("/create/");
  const isAdminRoute = pathname.startsWith("/admin");

  return (
    <>
      <button className="rounded-xl p-2 text-muted-foreground hover:bg-surface-muted md:hidden" aria-label="Open navigation menu" aria-expanded={open} onClick={() => setOpen(true)}>
        <Menu size={20} />
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button className="absolute inset-0 bg-[#201d1b]/40" aria-label="Close navigation menu" onClick={() => setOpen(false)} />
          <nav className="absolute inset-y-0 left-0 w-[280px] bg-surface p-5 shadow-[var(--shadow-md)]" aria-label="Mobile navigation">
            <div className="mb-8 flex items-center justify-between">
              <span className="text-sm font-black">EOS<span className="text-primary">.</span>studio</span>
              <button className="rounded-lg p-2 text-muted-foreground hover:bg-surface-muted" aria-label="Close navigation menu" onClick={() => setOpen(false)}>
                <X size={18} />
              </button>
            </div>
            {isAdminRoute ? <div className="space-y-1">
              <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#a49c95]">Administration</p>
              {adminItems.map((item) => item.disabled ? <div key={item.href} className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-muted-foreground/60"><item.icon size={18} /><span>{item.label}</span><span className="ml-auto text-[9px] font-bold uppercase tracking-wider text-[#b9afa8]">Soon</span></div> : <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold ${pathname === item.href ? "bg-[#fff0e9] text-primary" : "text-muted-foreground hover:bg-[#fff0e9] hover:text-primary"}`}><item.icon size={18} />{item.label}</Link>)}
              <p className="px-3 pb-2 pt-5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#a49c95]">Operations</p>
              {adminOperations.map((item) => item.disabled ? <div key={item.href} className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-muted-foreground/60"><item.icon size={18} /><span>{item.label}</span><span className="ml-auto text-[9px] font-bold uppercase tracking-wider text-[#b9afa8]">Soon</span></div> : <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold ${pathname === item.href ? "bg-[#fff0e9] text-primary" : "text-muted-foreground hover:bg-[#fff0e9] hover:text-primary"}`}><item.icon size={18} />{item.label}</Link>)}
              <Link href="/home" onClick={() => setOpen(false)} className="mt-4 flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-muted-foreground hover:bg-[#fff0e9] hover:text-primary"><Home size={18} />Back to workspace</Link>
            </div> : <div className="space-y-1">
              {links.map((link) => (
                <Link key={link.href} href={link.href} onClick={() => setOpen(false)} className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-muted-foreground hover:bg-[#fff0e9] hover:text-primary">
                  <link.icon size={18} />
                  {link.label}
                </Link>
              ))}
              <details open={isCreateRoute} className="group">
                <summary className={`flex min-h-11 w-full cursor-pointer list-none items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold outline-hidden focus-visible:ring-2 [&::-webkit-details-marker]:hidden ${isCreateRoute ? "bg-[#fff0e9] text-primary" : "text-muted-foreground hover:bg-[#fff0e9] hover:text-primary"}`}>
                  <WandSparkles size={18} />
                  <span>Create</span>
                  <ChevronDown className="ml-auto transition-transform group-open:rotate-180" size={16} />
                </summary>
                <div id="mobile-create-navigation" className="ml-5 space-y-1 border-l border-[#f1d7cc] pl-3">
                  {createItems.map((item) => (
                    <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className={`flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium ${pathname.startsWith(item.href) ? "bg-[#fff0e9] text-primary" : "text-muted-foreground hover:bg-surface-muted hover:text-foreground"}`}>
                      <item.icon size={17} />
                      {item.label}
                    </Link>
                  ))}
                </div>
              </details>
            </div>}
          </nav>
        </div>
      ) : null}
    </>
  );
}
