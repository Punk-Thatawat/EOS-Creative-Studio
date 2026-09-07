"use client";

import { Plus } from "lucide-react";
import { powerUpTools } from "../config";
import { cx } from "../styles";
import { useLocale } from "@/lib/i18n/locale-provider";

const powerUpToolKeys = [
  ["create.image.powerUp.background", "create.image.powerUp.backgroundDescription"],
  ["create.image.powerUp.removeObject", "create.image.powerUp.removeObjectDescription"],
  ["create.image.powerUp.upscale", "create.image.powerUp.upscaleDescription"],
  ["create.image.powerUp.colorGrading", "create.image.powerUp.colorGradingDescription"],
  ["create.image.powerUp.removeText", "create.image.powerUp.removeTextDescription"],
  ["create.image.powerUp.magicExpand", "create.image.powerUp.magicExpandDescription"],
] as const;

export function PowerUpTools() {
  const { t } = useLocale();
  return <section className={cx("gen-tools")}><div className={cx("gen-section-heading")}><h2>{t("create.image.powerUp.title")}</h2><span>{t("create.image.powerUp.viewAll")}</span></div><div className={cx("gen-tool-grid")}>{powerUpTools.map(([tool], index) => { const [toolKey, descriptionKey] = powerUpToolKeys[index]!; return <button type="button" key={tool}><span className={cx("gen-tool-icon", `tool-${index}`)}><Plus size={20} /></span><span><b>{t(toolKey)}</b><small>{t(descriptionKey)}</small></span></button>; })}</div></section>;
}
