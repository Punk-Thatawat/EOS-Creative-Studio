"use client";

import Link from "next/link";
import { ArrowRight, Share2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useLocale } from "@/lib/i18n/locale-provider";
import settingsStyles from "./settings-page.module.css";

export const AFFILIATE_SECTION_ID = "settings-affiliate";

/**
 * The affiliate entry in settings. The link, earnings and exchanges have their own page in the menu, so this card only
 * points there.
 */
export function AffiliateSection() {
  const { t } = useLocale();
  return (
    <Card className={settingsStyles.settingsCard} id={AFFILIATE_SECTION_ID}>
      <div className={settingsStyles.sectionHeading}>
        <span className={`${settingsStyles.sectionIcon} ${settingsStyles.toneorange}`}>
          <Share2 size={18} strokeWidth={1.9} />
        </span>
        <div>
          <h2>{t("settings.affiliate.title")}</h2>
          <p>{t("settings.affiliate.description")}</p>
        </div>
      </div>
      <div className={settingsStyles.cardBody}>
        <p className="text-sm text-muted-foreground">{t("settings.affiliate.movedNote")}</p>
        <Link
          href="/affiliate"
          className="mt-3 inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-sm font-semibold text-primary-foreground hover:opacity-90 focus-visible:outline-2 focus-visible:outline-primary"
        >
          {t("settings.affiliate.openDashboard")}
          <ArrowRight size={15} />
        </Link>
      </div>
    </Card>
  );
}
