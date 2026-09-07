"use client";

import { imageGenerationTabs, type ImageGenerationTab } from "../config";
import { cx } from "../styles";
import { useLocale } from "@/lib/i18n/locale-provider";

const imageTabKeys = {
  "Text to Image": "create.image.tabs.textToImage",
  "Image to Image": "create.image.tabs.imageToImage",
  "AI Background": "create.image.tabs.aiBackground",
  Upscale: "create.image.tabs.upscale",
  "Extend Image": "create.image.tabs.extendImage",
} as const;

export function ImageGenerationTabs({ activeTab, onTabChange }: { activeTab: ImageGenerationTab; onTabChange: (tab: ImageGenerationTab) => void }) {
  const { t } = useLocale();
  return <nav className={cx("gen-tabs")} aria-label={t("create.image.tools")}>{imageGenerationTabs.map((tab) => <button type="button" key={tab} onClick={() => onTabChange(tab)} className={activeTab === tab ? cx("is-active") : undefined}>{t(imageTabKeys[tab])}</button>)}</nav>;
}
