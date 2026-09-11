"use client";

import { imageGenerationTabs, type ImageGenerationTab } from "../config";
import { cx } from "../styles";
import { useLocale } from "@/lib/i18n/locale-provider";
import { useState } from "react";
import { ChevronDown, Expand, Image as ImageIcon, ScanLine, Sparkles, WandSparkles, type LucideIcon } from "lucide-react";

const imageTabKeys = {
  "Text to Image": "create.image.tabs.textToImage",
  "Image to Image": "create.image.tabs.imageToImage",
  "AI Background": "create.image.tabs.aiBackground",
  Upscale: "create.image.tabs.upscale",
  "Extend Image": "create.image.tabs.extendImage",
  "AI Style Transfer": "create.image.tabs.styleTransfer",
} as const;

const imageTabIcons: Record<ImageGenerationTab, LucideIcon> = {
  "Text to Image": WandSparkles,
  "Image to Image": ImageIcon,
  "AI Background": ScanLine,
  Upscale: Sparkles,
  "Extend Image": Expand,
  "AI Style Transfer": WandSparkles,
};

export function ImageGenerationTabs({ activeTab, onTabChange }: { activeTab: ImageGenerationTab; onTabChange: (tab: ImageGenerationTab) => void }) {
  const { t } = useLocale();
  const [isModeMenuOpen, setIsModeMenuOpen] = useState(false);
  const activeLabel = t(imageTabKeys[activeTab]);
  const ActiveIcon = imageTabIcons[activeTab];
  const selectTab = (tab: ImageGenerationTab) => {
    setIsModeMenuOpen(false);
    onTabChange(tab);
  };

  return <>
    <nav className={cx("gen-tabs", "gen-desktop-tabs")} aria-label={t("create.image.tools")}>{imageGenerationTabs.map((tab) => <button type="button" key={tab} onClick={() => onTabChange(tab)} className={activeTab === tab ? cx("is-active") : undefined}>{t(imageTabKeys[tab])}</button>)}</nav>
    <nav className={cx("gen-mobile-mode-switcher", isModeMenuOpen && "is-open")} aria-label={t("create.image.tools")}>
      <button type="button" className={cx("gen-mobile-mode-current")} aria-expanded={isModeMenuOpen} aria-controls="gen-mobile-mode-menu" aria-label={t("create.image.mode.switch")} onClick={() => setIsModeMenuOpen((open) => !open)}>
        <span className={cx("gen-mobile-mode-icon")}><ActiveIcon size={25} strokeWidth={2.2} aria-hidden="true" /></span>
        <span className={cx("gen-mobile-mode-current-copy")}><small>{t("create.image.mode.current", { mode: activeLabel })}</small><strong>{activeLabel}</strong></span>
        <ChevronDown size={24} aria-hidden="true" className={cx("gen-mobile-mode-chevron")} />
      </button>
      {isModeMenuOpen && <div id="gen-mobile-mode-menu" className={cx("gen-mobile-mode-menu")} role="menu" aria-label={t("create.image.mode.other")}>
        {imageGenerationTabs.map((tab) => {
          const Icon = imageTabIcons[tab];
          return <button type="button" role="menuitem" key={tab} className={activeTab === tab ? cx("is-selected") : undefined} aria-current={activeTab === tab ? "page" : undefined} onClick={() => selectTab(tab)}><Icon size={18} aria-hidden="true" /><span>{t(imageTabKeys[tab])}</span>{activeTab === tab ? <small>{t("create.image.mode.current", { mode: activeLabel })}</small> : null}</button>;
        })}
      </div>}
    </nav>
  </>;
}
