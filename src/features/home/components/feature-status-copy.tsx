"use client";

import { useLocale } from "@/lib/i18n/locale-provider";

export function FeatureStatusBadge() {
  const { t } = useLocale();
  return <span className="absolute left-2 top-2 z-10 rounded-full bg-muted px-2 py-1 text-[10px] font-bold text-muted-foreground">{t("home.featureStatus.inDevelopment")}</span>;
}

export function FeatureStatusDescription() {
  const { t } = useLocale();
  return t("home.featureStatus.description");
}

export function FeatureStatusCta() {
  const { t } = useLocale();
  return <span className="mt-3 rounded-full border border-border bg-muted/60 px-2.5 py-1 text-[10px] font-bold text-muted-foreground">{t("home.featureStatus.comingSoon")}</span>;
}
