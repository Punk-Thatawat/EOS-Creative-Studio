"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Share2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { affiliateApi, type AffiliateApi, type AffiliateOverview } from "@/lib/api/affiliate";
import { buildReferralLink } from "@/lib/affiliate/referral-storage";
import { useLocale, type Locale } from "@/lib/i18n/locale-provider";
import settingsStyles from "./settings-page.module.css";
import styles from "./affiliate-section.module.css";

export const AFFILIATE_SECTION_ID = "settings-affiliate";

/** How often the section reloads itself while it is on screen. */
const REFRESH_INTERVAL_MS = 60_000;

function formatDate(value: string, locale: Locale): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-US", { dateStyle: "medium" }).format(date);
}

function formatNumber(value: number, locale: Locale, maximumFractionDigits = 2): string {
  return new Intl.NumberFormat(locale === "th" ? "th-TH" : "en-US", { maximumFractionDigits }).format(value);
}

/**
 * The member's affiliate: create it once, share the link, and see how many people came through it, what they topped up
 * and what that earned back as credits. `api` can be replaced to render the section without a backend.
 */
export function AffiliateSection({ api = affiliateApi }: { api?: AffiliateApi }) {
  const { locale, t } = useLocale();
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [overview, setOverview] = useState<AffiliateOverview | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoadState("loading");
    try {
      setOverview(await api.load());
      setLoadState("ready");
    } catch {
      setLoadState("error");
    }
  }, [api]);

  useEffect(() => {
    let active = true;
    void api
      .load()
      .then((result) => {
        if (!active) return;
        setOverview(result);
        setLoadState("ready");
      })
      .catch(() => {
        if (active) setLoadState("error");
      });
    return () => {
      active = false;
    };
  }, [api]);

  // Quiet refresh, so people invited or credits earned while this page stays open show up without a reload.
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      void api
        .load()
        .then((result) => {
          setOverview(result);
          setLoadState("ready");
        })
        .catch(() => undefined);
    };
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    const timer = window.setInterval(refresh, REFRESH_INTERVAL_MS);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
      window.clearInterval(timer);
    };
  }, [api]);

  async function handleCreate() {
    setCreating(true);
    setCreateError(null);
    try {
      const affiliate = await api.create();
      setOverview((current) => (current ? { ...current, affiliate } : current));
    } catch (error: unknown) {
      setCreateError(error instanceof Error && error.message ? error.message : t("settings.affiliate.createFailed"));
    } finally {
      setCreating(false);
    }
  }

  const affiliate = overview?.affiliate ?? null;
  const link = affiliate && typeof window !== "undefined" ? buildReferralLink(window.location.origin, affiliate.code) : "";

  async function handleCopy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // The link stays selectable in the field if the browser refuses clipboard access.
    }
  }

  const settings = overview?.settings;
  const percent = settings ? formatNumber(settings.commissionPercent, locale) : "";
  const usagePercent = settings ? formatNumber(settings.usageCommissionPercent, locale) : "";
  const stats = overview?.stats;
  // Only the kinds the admin has switched on are shown, so the page never promises what is not paid.
  const showTopup = Boolean(settings?.enabled && settings.topupEnabled);
  const showUsage = Boolean(settings?.enabled && settings.usageEnabled);

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
        {loadState === "loading" ? <p className={styles.muted}>{t("settings.affiliate.loading")}</p> : null}

        {loadState === "error" ? (
          <div className={styles.notice} role="alert">
            <TriangleAlert size={16} aria-hidden="true" />
            <span>{t("settings.affiliate.loadFailed")}</span>
            <Button type="button" variant="outline" size="sm" onClick={() => { void load(); }}>
              {t("settings.affiliate.retry")}
            </Button>
          </div>
        ) : null}

        {loadState === "ready" && overview && !affiliate ? (
          <div className={styles.intro}>
            <p>{t("settings.affiliate.intro", { percent })}</p>
            <ul className={styles.notes}>
              <li>{t("settings.affiliate.noteLink")}</li>
              {showTopup ? <li>{t("settings.affiliate.noteEarn", { percent })}</li> : null}
              {showUsage ? <li>{t("settings.affiliate.noteUsage", { usagePercent })}</li> : null}
              <li>{t("settings.affiliate.noteCredits")}</li>
            </ul>
            {overview.settings.enabled ? (
              <Button type="button" size="sm" disabled={creating} onClick={() => { void handleCreate(); }}>
                {creating ? t("settings.affiliate.creating") : t("settings.affiliate.create")}
              </Button>
            ) : (
              <p className={styles.muted}>{t("settings.affiliate.programOff")}</p>
            )}
            {createError ? <p className={styles.error} role="alert">{createError}</p> : null}
          </div>
        ) : null}

        {loadState === "ready" && overview && affiliate ? (
          <>
            {affiliate.status === "suspended" ? (
              <div className={styles.notice} role="status">
                <TriangleAlert size={16} aria-hidden="true" />
                <span>{t("settings.affiliate.suspended")}</span>
              </div>
            ) : null}
            {affiliate.status === "active" && !overview.settings.enabled ? (
              <div className={styles.notice} role="status">
                <TriangleAlert size={16} aria-hidden="true" />
                <span>{t("settings.affiliate.programOffEarning")}</span>
              </div>
            ) : null}

            <p className={styles.label}>{t("settings.affiliate.linkLabel")}</p>
            <div className={styles.linkRow}>
              <input
                className={styles.linkField}
                readOnly
                value={link}
                aria-label={t("settings.affiliate.linkLabel")}
                onFocus={(event) => event.currentTarget.select()}
              />
              <Button type="button" variant="outline" size="sm" onClick={() => { void handleCopy(); }}>
                {copied ? <Check size={15} /> : <Copy size={15} />}
                {copied ? t("settings.affiliate.copied") : t("settings.affiliate.copy")}
              </Button>
            </div>
            <p className={styles.hint}>{t("settings.affiliate.linkHint")}</p>
            <ul className={styles.notes}>
              {showTopup ? <li>{t("settings.affiliate.noteEarn", { percent })}</li> : null}
              {showUsage ? <li>{t("settings.affiliate.noteUsage", { usagePercent })}</li> : null}
            </ul>

            <dl className={styles.stats}>
              <div>
                <dt>{t("settings.affiliate.statInvited")}</dt>
                <dd>{formatNumber(stats?.invitedCount ?? 0, locale, 0)}</dd>
              </div>
              <div>
                <dt>{t("settings.affiliate.statTopup")}</dt>
                <dd>฿{formatNumber(stats?.topupAmountThb ?? 0, locale)}</dd>
              </div>
              <div>
                <dt>{t("settings.affiliate.statCommission")}</dt>
                <dd>{formatNumber(stats?.commissionCredits ?? 0, locale)}</dd>
                {showUsage ? (
                  <dd className={styles.statSub}>
                    {t("settings.affiliate.earnedBreakdown", {
                      topup: formatNumber(stats?.topupCommissionCredits ?? 0, locale),
                      usage: formatNumber(stats?.usageCommissionCredits ?? 0, locale),
                    })}
                  </dd>
                ) : null}
              </div>
              <div>
                <dt>{t("settings.affiliate.statRate")}</dt>
                {showTopup ? <dd className={styles.statRate}>{t("settings.affiliate.rateTopup", { percent })}</dd> : null}
                {showUsage ? <dd className={styles.statRate}>{t("settings.affiliate.rateUsage", { usagePercent })}</dd> : null}
                {!showTopup && !showUsage ? <dd>—</dd> : null}
              </div>
            </dl>

            <h3 className={styles.listTitle}>{t("settings.affiliate.recentTitle")}</h3>
            {overview.referrals.length === 0 ? (
              <p className={styles.muted}>{t("settings.affiliate.recentEmpty")}</p>
            ) : (
              <ul className={styles.list}>
                {overview.referrals.map((item) => (
                  <li key={`${item.member}-${item.joinedAt}`}>
                    <div>
                      <strong>{item.member}</strong>
                      <span>{t("settings.affiliate.joined", { date: formatDate(item.joinedAt, locale) })}</span>
                    </div>
                    <div className={styles.listNumbers}>
                      <span>{t("settings.affiliate.topupOf", { amount: formatNumber(item.topupAmountThb, locale) })}</span>
                      <strong>+{formatNumber(item.commissionCredits, locale)} {t("settings.affiliate.creditUnit")}</strong>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : null}
      </div>
    </Card>
  );
}
