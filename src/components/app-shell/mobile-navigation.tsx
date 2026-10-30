"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Activity, AudioLines, BarChart3, Boxes, ChevronDown, Clapperboard, FileText, Home, ImageIcon, LayoutTemplate, Menu, MessageSquareText, Palette, Settings, Settings2, ShieldCheck, UsersRound, Video, X } from "lucide-react";
import { EosLogo } from "@/components/brand/eos-logo";
import { useLocale } from "@/lib/i18n/locale-provider";
import { WorkspaceNavigation } from "./workspace-navigation";
import { useHydrated } from "./use-hydrated";

const adminItems = [
  { label: "Model routes", href: "/admin/model-routes", icon: Settings2 },
  { label: "Style presets", href: "/admin/style-presets", icon: Palette },
  { label: "Templates", href: "/admin/templates", icon: LayoutTemplate },
  { label: "Video showcase", href: "/admin/video-showcase", icon: Clapperboard },
  { label: "Prompt templates", href: "/admin/prompt-templates", icon: MessageSquareText },
  { label: "User activity", href: "/admin/usage", icon: Activity },
  { label: "Provider catalog", href: "/admin/provider-catalog", icon: Boxes, disabled: true },
  { label: "Feature settings", href: "/admin/feature-settings", icon: ShieldCheck, disabled: true },
];

const adminOperations = [
  { label: "Members & roles", href: "/admin/members", icon: UsersRound },
  { label: "Credits & billing", href: "/admin/credits", icon: BarChart3 },
  { label: "Legal policies", href: "/admin/legal", icon: FileText },
  { label: "System settings", href: "/admin/settings", icon: Settings, disabled: true },
];

const adminFeatureGroups = [
  {
    id: "image",
    label: "Image",
    icon: ImageIcon,
    features: ["text-to-image|Text to Image", "image-to-image|Image to Image", "style-transfer|Style Transfer", "background-removal|AI Background", "upscale|Upscale", "extend-image|Extend Image"],
  },
  {
    id: "video",
    label: "Video",
    icon: Video,
    features: ["image-to-video|Image to Video", "text-to-video|Text to Video", "people-video|People Video", "motion-transfer|Motion Transfer", "lipsync|Lipsync", "extend-video|Extend Video", "video-to-sfx|Video to SFX", "video-to-music|Video to Music"],
  },
  {
    id: "ai-presenter",
    label: "AI Presenter",
    icon: Clapperboard,
    features: ["ai-presenter|Presenter Video", "ai-presenter-script|Script Splitter"],
  },
  {
    id: "audio",
    label: "Audio",
    icon: AudioLines,
    features: ["textToSpeech|Text to Speech", "podcastDialogue|Podcast & Dialogue", "voiceClone|Voice Clone", "soundEffects|Sound Effects", "audioCleanup|Audio Cleanup"],
  },
  {
    id: "document",
    label: "Document",
    icon: FileText,
    features: ["document-ocr|OCR", "document-summary|Summarize", "document-translate|Translate", "document-contract|Contract", "document-report|Report", "document-form|Form"],
  },
] as const;

export const MOBILE_NAVIGATION_OPEN_EVENT = "eos:open-mobile-navigation";

export function MobileNavigation({ onOpenChange }: { onOpenChange?: (open: boolean) => void }) {
  const pathnameFromRouter = usePathname();
  const searchParams = useSearchParams();
  const hydrated = useHydrated();
  const { locale } = useLocale();
  const pathname = hydrated ? pathnameFromRouter : "";
  const [open, setOpen] = useState(false);
  const [rendered, setRendered] = useState(false);
  const [visible, setVisible] = useState(false);
  const isAdminRoute = pathname.startsWith("/admin");
  const isModelRoutesPage = pathname === "/admin/model-routes";
  const selectedFeature = hydrated ? searchParams.get("feature") ?? "text-to-image" : "text-to-image";

  useEffect(() => {
    const openNavigation = () => setOpen(true);
    window.addEventListener(MOBILE_NAVIGATION_OPEN_EVENT, openNavigation);
    return () => window.removeEventListener(MOBILE_NAVIGATION_OPEN_EVENT, openNavigation);
  }, []);

  useEffect(() => {
    onOpenChange?.(rendered);
  }, [onOpenChange, rendered]);

  useEffect(() => {
    if (open) {
      const mountTimer = window.setTimeout(() => setRendered(true), 0);
      return () => window.clearTimeout(mountTimer);
    }
    const hideTimer = window.setTimeout(() => setVisible(false), 0);
    const unmountTimer = window.setTimeout(() => setRendered(false), 260);
    return () => {
      window.clearTimeout(hideTimer);
      window.clearTimeout(unmountTimer);
    };
  }, [open]);

  useEffect(() => {
    if (!rendered) return;
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, [rendered]);

  useEffect(() => {
    if (!rendered) return;
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
  }, [rendered]);


  return (
    <>
      <button type="button" className="flex size-11 items-center justify-center rounded-xl border border-border bg-white text-foreground shadow-[var(--shadow-sm)] transition-colors hover:bg-surface-muted min-[1440px]:hidden" aria-label={locale === "th" ? "เปิดเมนูนำทาง" : "Open navigation menu"} aria-expanded={open} aria-controls="mobile-navigation" onClick={() => setOpen(true)}>
        <Menu size={21} strokeWidth={2.4} />
      </button>
      {rendered ? (
        <div className="fixed inset-0 z-[60] min-[1440px]:hidden">
          <button
            type="button"
            className={`absolute inset-0 bg-[#201d1b]/40 transition-opacity duration-[260ms] ease-out ${visible ? "opacity-100" : "opacity-0"}`}
            aria-label="Close navigation menu"
            onClick={() => setOpen(false)}
          />
          <nav
            id="mobile-navigation"
            className={`absolute inset-y-0 left-0 flex w-[min(280px,calc(100vw-24px))] flex-col overflow-y-auto bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[var(--shadow-md)] transition-transform duration-[260ms] ease-out ${visible ? "translate-x-0" : "-translate-x-full"}`}
            aria-label="Mobile navigation"
          >
            <div className="mb-8 flex items-center justify-between">
              <EosLogo href="/home" />
              <button type="button" className="rounded-lg p-2 text-muted-foreground hover:bg-surface-muted" aria-label={locale === "th" ? "ปิดเมนูนำทาง" : "Close navigation menu"} onClick={() => setOpen(false)}>
                <X size={18} />
              </button>
            </div>
            {isAdminRoute ? (
              <div className="space-y-1">
                <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#a49c95]">Administration</p>
                {adminItems.map((item) => {
                  const active = item.href === "/admin/model-routes" ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return item.disabled ? (
                    <div key={item.href} aria-disabled="true" className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-muted-foreground/50">
                      <item.icon size={18} />
                      <span>{item.label}</span>
                      <span className="ml-auto text-[9px] font-bold uppercase tracking-wider text-[#b9afa8]">Soon</span>
                    </div>
                  ) : (
                    <Link key={item.href} href={item.href} onClick={() => setOpen(false)} aria-current={active ? "page" : undefined} className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold ${active ? "bg-[#fff0e9] text-primary" : "text-muted-foreground hover:bg-[#fff0e9] hover:text-primary"}`}>
                      <item.icon size={18} strokeWidth={active ? 2.5 : 2} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}

                <div className="my-3 border-t border-[#eee8e3]" />
                <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#a49c95]">Features</p>
                {adminFeatureGroups.map((group) => {
                  const isGroupActive = isModelRoutesPage && group.features.some((feature) => feature.startsWith(`${selectedFeature}|`));
                  return (
                    <details key={group.id} open={isGroupActive} className="group">
                      <summary className={`flex min-h-11 cursor-pointer list-none items-center gap-3 rounded-xl px-3 text-sm font-semibold [&::-webkit-details-marker]:hidden ${isGroupActive ? "bg-[#fff0e9] text-primary" : "text-muted-foreground hover:bg-[#fff0e9] hover:text-primary"}`}>
                        <group.icon size={18} strokeWidth={isGroupActive ? 2.5 : 2} />
                        <span>{group.label}</span>
                        <ChevronDown size={15} className="ml-auto transition-transform group-open:rotate-180" />
                      </summary>
                      <div className="ml-5 mt-1 border-l border-[#f1d7cc] pl-2">
                        {group.features.map((entry) => {
                          const [featureId, label] = entry.split("|");
                          const active = isModelRoutesPage && selectedFeature === featureId;
                          return (
                            <Link key={featureId} href={`/admin/model-routes?feature=${featureId}`} onClick={() => setOpen(false)} aria-current={active ? "page" : undefined} className={`flex min-h-9 items-center rounded-lg px-2.5 text-xs font-medium ${active ? "bg-[#fff0e9] text-primary" : "text-muted-foreground hover:bg-surface-muted hover:text-foreground"}`}>
                              {label}
                            </Link>
                          );
                        })}
                      </div>
                    </details>
                  );
                })}

                <div className="my-3 border-t border-[#eee8e3]" />
                <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#a49c95]">Operations</p>
                {adminOperations.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return item.disabled ? (
                    <div key={item.href} aria-disabled="true" className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-muted-foreground/50">
                      <item.icon size={18} />
                      <span>{item.label}</span>
                      <span className="ml-auto text-[9px] font-bold uppercase tracking-wider text-[#b9afa8]">Soon</span>
                    </div>
                  ) : (
                    <Link key={item.href} href={item.href} onClick={() => setOpen(false)} aria-current={active ? "page" : undefined} className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold ${active ? "bg-[#fff0e9] text-primary" : "text-muted-foreground hover:bg-[#fff0e9] hover:text-primary"}`}>
                      <item.icon size={18} strokeWidth={active ? 2.5 : 2} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
                <Link href="/home" onClick={() => setOpen(false)} className="mt-4 flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-muted-foreground hover:bg-[#fff0e9] hover:text-primary"><Home size={18} />Back to workspace</Link>
              </div>
            ) : <WorkspaceNavigation pathname={pathname} onNavigate={() => setOpen(false)} />}
          </nav>
        </div>
      ) : null}
    </>
  );
}
