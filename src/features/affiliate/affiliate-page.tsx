"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarDays, Check, CircleCheck, Clock, Coins, Copy, Filter, Gift, RefreshCw, Star, TriangleAlert, UserRound, Users, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { affiliateApi, type AffiliateApi, type AffiliateOverview, type AffiliateWallet, type AffiliateWithdrawal } from "@/lib/api/affiliate";
import { buildReferralLink } from "@/lib/affiliate/referral-storage";
import { useLocale } from "@/lib/i18n/locale-provider";
import { MegaphoneArt } from "./affiliate-art";
import { CollapsibleListCard } from "./collapsible-list-card";
import { EarningsChart } from "./earnings-chart";
import { ExchangeCard } from "./exchange-card";
import { formatDate, formatNumber } from "./format";
import { WithdrawalsTable } from "./withdrawals-table";
import { WithdrawCard } from "./withdraw-card";
import styles from "./affiliate-page.module.css";

/** How often the page reloads itself while it is on screen. */
const REFRESH_INTERVAL_MS = 60_000;

/**
 * The member's affiliate overview: the link, what has been earned and what can be exchanged, a chart of the last 30 days,
 * how many invited people became paying members, the latest earnings and the people invited. `api` can be replaced to
 * render the page without a backend.
 */
export function AffiliatePage({ api = affiliateApi }: { api?: AffiliateApi }) {
  const { locale, t } = useLocale();
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [overview, setOverview] = useState<AffiliateOverview | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  // When the overview was read, to tell which earnings are past their hold without reading the clock while rendering.
  const [loadedAt, setLoadedAt] = useState(0);

  const apply = useCallback((result: AffiliateOverview) => {
    setOverview(result);
    setLoadedAt(Date.now());
    setLoadState("ready");
  }, []);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      apply(await api.load());
    } catch {
      setLoadState((current) => (current === "ready" ? current : "error"));
    } finally {
      setRefreshing(false);
    }
  }, [api, apply]);

  useEffect(() => {
    let active = true;
    void api
      .load()
      .then((result) => {
        if (active) apply(result);
      })
      .catch(() => {
        if (active) setLoadState("error");
      });
    return () => {
      active = false;
    };
  }, [api, apply]);

  // Quiet refresh, so people invited or baht earned while this page stays open show up without a reload.
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      void api.load().then(apply).catch(() => undefined);
    };
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    const timer = window.setInterval(refresh, REFRESH_INTERVAL_MS);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
      window.clearInterval(timer);
    };
  }, [api, apply]);

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

  function applyWallet(next: AffiliateWallet) {
    setOverview((current) => (current ? { ...current, wallet: next } : current));
  }

  function handleWithdrawal(result: { withdrawal: AffiliateWithdrawal; wallet: AffiliateWallet }) {
    setOverview((current) =>
      current ? { ...current, wallet: result.wallet, withdrawals: [result.withdrawal, ...(current.withdrawals ?? []).filter((item) => item.id !== result.withdrawal.id)] } : current,
    );
  }

  async function handleCancelWithdrawal(id: string) {
    setCancelingId(id);
    setCancelError(null);
    try {
      const result = await api.cancelWithdrawal(id);
      setOverview((current) =>
        current
          ? { ...current, wallet: result.wallet, withdrawals: (current.withdrawals ?? []).map((item) => (item.id === id ? { ...item, status: "cancelled" as const } : item)) }
          : current,
      );
    } catch {
      setCancelError(t("affiliate.withdraw.cancelFailed"));
      // Whatever happened to the request (paid, rejected) shows after a reload.
      void api.load().then(apply).catch(() => undefined);
    } finally {
      setCancelingId(null);
    }
  }

  const settings = overview?.settings;
  const wallet = overview?.wallet;
  const stats = overview?.stats;
  const percent = settings ? formatNumber(settings.commissionPercent, locale) : "";
  const usagePercent = settings ? formatNumber(settings.usageCommissionPercent, locale) : "";
  const holdDays = settings ? formatNumber(settings.holdDays, locale, 0) : "";
  // Only the kinds the admin has switched on are shown, so the page never promises what is not paid.
  const showTopup = Boolean(settings?.enabled && settings.topupEnabled);
  const showUsage = Boolean(settings?.enabled && settings.usageEnabled);

  const invited = stats?.invitedCount ?? 0;
  const paying = stats?.payingCount ?? 0;
  const conversion = invited > 0 ? Math.round((paying / invited) * 100) : 0;
  const withdrawals = overview?.withdrawals ?? [];
  const withdrawnBaht = wallet?.withdrawnBaht ?? 0;
  const withdrawWaitingBaht = wallet?.withdrawPendingBaht ?? 0;
  const daily = overview?.daily ?? [];
  const activity = overview?.activity ?? [];

  const statusLabel = {
    pending: t("settings.affiliate.statusPending"),
    completed: t("settings.affiliate.statusCompleted"),
    failed: t("settings.affiliate.statusFailed"),
  } as const;

  // The banner's promise names the rate that is really paid: the top-up rate, else the usage rate, else nothing in numbers.
  const heroSubtitle = showTopup
    ? t("affiliate.page.heroSubtitleRate", { percent })
    : showUsage
      ? t("affiliate.page.heroSubtitleRate", { percent: usagePercent })
      : t("affiliate.page.heroSubtitleNone");

  const heroNotes = (
    <ul className={styles.heroNotes}>
      {showTopup ? <li><CircleCheck size={16} aria-hidden="true" />{t("settings.affiliate.noteEarn", { percent })}</li> : null}
      {showUsage ? <li><CircleCheck size={16} aria-hidden="true" />{t("settings.affiliate.noteUsage", { usagePercent })}</li> : null}
      <li><CircleCheck size={16} aria-hidden="true" />{t("settings.affiliate.noteCredits", { days: holdDays })}</li>
    </ul>
  );

  const activityRows = activity.map((item) => {
    const ready = new Date(item.availableAt).getTime() <= loadedAt;
    return {
      key: item.id,
      node: (
        <div className={styles.rowLine}>
          <div className={styles.rowMain}>
            <strong>
              <span className={`${styles.badge} ${item.source === "topup" ? styles.badgeTopup : styles.badgeUsage}`}>
                {item.source === "topup" ? t("affiliate.page.sourceTopup") : t("affiliate.page.sourceUsage")}
              </span>
              {item.member}
            </strong>
            <span>{formatDate(item.createdAt, locale)} · {ready ? t("affiliate.page.readyNow") : t("affiliate.page.readyOn", { date: formatDate(item.availableAt, locale) })}</span>
          </div>
          <div className={styles.rowSide}>
            <strong>+฿{formatNumber(item.amountBaht, locale)}</strong>
          </div>
        </div>
      ),
    };
  });

  const referralRows = (overview?.referrals ?? []).map((item) => ({
    key: `${item.member}-${item.joinedAt}`,
    node: (
      <div className={styles.rowLine}>
        <div className={styles.rowMain}>
          <strong>{item.member}</strong>
          <span>{t("settings.affiliate.joined", { date: formatDate(item.joinedAt, locale) })}</span>
        </div>
        <div className={styles.rowSide}>
          <span>{t("settings.affiliate.topupOf", { amount: formatNumber(item.topupAmountThb, locale) })}</span>
          <strong>+฿{formatNumber(item.earnedBaht, locale)}</strong>
        </div>
      </div>
    ),
  }));

  return (
    <div className={styles.page} data-page="affiliate">
      <div className={styles.intro}>
        <div>
          <p className={styles.eyebrow}>{t("affiliate.page.eyebrow")}</p>
          <h1>{t("affiliate.page.title")}</h1>
          <p className={styles.description}>{t("affiliate.page.subtitle")}</p>
        </div>
        {loadState === "ready" && affiliate ? (
          <Button type="button" variant="outline" size="sm" className={styles.refresh} disabled={refreshing} onClick={() => { void load(); }}>
            <RefreshCw size={14} className={refreshing ? "animate-spin" : undefined} />
            {t("affiliate.page.refresh")}
          </Button>
        ) : null}
      </div>

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
        <section className={styles.hero} aria-labelledby="affiliate-hero-title">
          <div className={styles.heroBody}>
            <h2 id="affiliate-hero-title" className={styles.heroTitle}>{t("settings.affiliate.title")}</h2>
            <p className={styles.heroSubtitle}>{t("settings.affiliate.intro")}</p>
            {heroNotes}
            {overview.settings.enabled ? (
              <Button type="button" size="sm" className={styles.heroButton} disabled={creating} onClick={() => { void handleCreate(); }}>
                {creating ? t("settings.affiliate.creating") : t("settings.affiliate.create")}
              </Button>
            ) : (
              <p className={styles.heroHint}>{t("settings.affiliate.programOff")}</p>
            )}
            {createError ? <p className={styles.heroError} role="alert">{createError}</p> : null}
          </div>
          <MegaphoneArt className={styles.heroArt} />
        </section>
      ) : null}

      {loadState === "ready" && overview && affiliate && settings && wallet ? (
        <>
          {affiliate.status === "suspended" ? (
            <div className={styles.notice} role="status">
              <TriangleAlert size={16} aria-hidden="true" />
              <span>{t("settings.affiliate.suspended")}</span>
            </div>
          ) : null}
          {affiliate.status === "active" && !settings.enabled ? (
            <div className={styles.notice} role="status">
              <TriangleAlert size={16} aria-hidden="true" />
              <span>{t("settings.affiliate.programOffEarning")}</span>
            </div>
          ) : null}

          <section className={styles.hero} aria-labelledby="affiliate-hero-title">
            <div className={styles.heroBody}>
              <h2 id="affiliate-hero-title" className={styles.heroTitle}>{t("settings.affiliate.linkLabel")}</h2>
              <p className={styles.heroSubtitle}>{heroSubtitle}</p>
              <div className={styles.linkPill}>
                <input
                  className={styles.linkField}
                  readOnly
                  value={link}
                  aria-label={t("settings.affiliate.linkLabel")}
                  onFocus={(event) => event.currentTarget.select()}
                />
                <button type="button" className={styles.copyButton} onClick={() => { void handleCopy(); }} aria-label={copied ? t("settings.affiliate.copied") : t("settings.affiliate.copy")} title={copied ? t("settings.affiliate.copied") : t("settings.affiliate.copy")}>
                  {copied ? <Check size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}
                </button>
              </div>
              {heroNotes}
              <p className={styles.heroHint}>{t("settings.affiliate.linkHint")}</p>
            </div>
            <MegaphoneArt className={styles.heroArt} />
          </section>

          <dl className={styles.kpis}>
            <div className={`${styles.kpi} ${styles.kpiPrimary}`}>
              <dt><span className={`${styles.kpiIcon} ${styles.iconWarm}`} aria-hidden="true"><Users size={18} /></span>{t("settings.affiliate.walletAvailable")}</dt>
              <dd>฿{formatNumber(wallet.availableBaht, locale)}</dd>
            </div>
            <div className={styles.kpi}>
              <dt><span className={`${styles.kpiIcon} ${styles.iconBlue}`} aria-hidden="true"><Clock size={18} /></span>{t("settings.affiliate.walletPending")}</dt>
              <dd>฿{formatNumber(wallet.pendingBaht, locale)}</dd>
              {wallet.pendingBaht > 0 ? <dd className={styles.kpiSub}>{t("settings.affiliate.walletPendingHint", { days: holdDays })}</dd> : null}
            </div>
            <div className={styles.kpi}>
              <dt><span className={`${styles.kpiIcon} ${styles.iconGreen}`} aria-hidden="true"><CircleCheck size={18} /></span>{t("settings.affiliate.walletRedeemed")}</dt>
              <dd>฿{formatNumber(wallet.redeemedBaht, locale)}</dd>
              {withdrawnBaht > 0 || withdrawWaitingBaht > 0 ? (
                <dd className={styles.kpiSub}>
                  {t("affiliate.withdraw.walletSub", { paid: `฿${formatNumber(withdrawnBaht, locale)}`, waiting: `฿${formatNumber(withdrawWaitingBaht, locale)}` })}
                </dd>
              ) : null}
            </div>
            <div className={styles.kpi}>
              <dt><span className={`${styles.kpiIcon} ${styles.iconGold}`} aria-hidden="true"><Coins size={18} /></span>{t("affiliate.page.kpiEarned")}</dt>
              <dd>฿{formatNumber(wallet.earnedBaht, locale)}</dd>
              {showUsage ? (
                <dd className={styles.kpiSub}>
                  {t("settings.affiliate.earnedBreakdown", {
                    topup: `฿${formatNumber(wallet.topupEarnedBaht, locale)}`,
                    usage: `฿${formatNumber(wallet.usageEarnedBaht, locale)}`,
                  })}
                </dd>
              ) : null}
            </div>
          </dl>

          <div className={styles.grid}>
            <Card className={`${styles.card} ${styles.chartCard}`}>
              <h2 className={styles.cardTitle}>
                <span className={styles.titleIcon} aria-hidden="true"><CalendarDays size={18} /></span>
                {t("affiliate.page.chartTitle", { days: daily.length || 30 })}
              </h2>
              {daily.every((point) => point.topupBaht + point.usageBaht <= 0) ? <p className={styles.cardSubtitle}>{t("affiliate.page.chartEmpty")}</p> : null}
              <EarningsChart points={daily} />
            </Card>

            <div className={styles.stack}>
              <Card className={styles.card}>
                <ExchangeCard
                  overview={overview}
                  api={api}
                  icon={<Gift size={20} />}
                  onWallet={applyWallet}
                  onReload={() => { void api.load().then(apply).catch(() => undefined); }}
                />
              </Card>

              {settings.withdrawEnabled ? (
                <Card className={styles.card}>
                  <WithdrawCard overview={overview} api={api} icon={<Wallet size={20} />} onWithdrawal={handleWithdrawal} />
                </Card>
              ) : null}

              <Card className={styles.card}>
                <h2 className={styles.cardTitle}>
                  <span className={styles.titleIcon} aria-hidden="true"><Filter size={18} /></span>
                  {t("affiliate.page.funnelTitle")}
                </h2>
                {invited === 0 ? (
                  <p className={styles.muted}>{t("affiliate.page.funnelNone")}</p>
                ) : (
                  <>
                    <div className={styles.funnelRow}>
                      <span>{t("affiliate.page.funnelInvited")}</span>
                      <strong>{formatNumber(invited, locale, 0)}</strong>
                    </div>
                    <div className={styles.funnelBar} aria-hidden="true"><span style={{ width: "100%" }} /></div>
                    <div className={styles.funnelRow}>
                      <span>{t("affiliate.page.funnelPaying")}</span>
                      <strong>{formatNumber(paying, locale, 0)}</strong>
                    </div>
                    <div className={styles.funnelBar} aria-hidden="true"><span style={{ width: `${conversion}%` }} /></div>
                    <p className={styles.hint}>{t("affiliate.page.funnelRate", { percent: conversion })}</p>
                    <div className={styles.funnelRow}>
                      <span>{t("settings.affiliate.statTopup")}</span>
                      <strong>฿{formatNumber(stats?.topupAmountThb ?? 0, locale)}</strong>
                    </div>
                  </>
                )}
              </Card>
            </div>
          </div>

          <div className={styles.pair}>
            <CollapsibleListCard icon={<Star size={18} />} title={t("affiliate.page.activityTitle")} rows={activityRows} empty={t("affiliate.page.activityEmpty")} />
            <CollapsibleListCard icon={<UserRound size={18} />} title={t("settings.affiliate.recentTitle")} rows={referralRows} empty={t("settings.affiliate.recentEmpty")} />
          </div>

          {withdrawals.length > 0 ? (
            <Card className={styles.card}>
              <h2 className={styles.cardTitle}>{t("affiliate.withdraw.historyTitle")}</h2>
              {cancelError ? <p className={styles.error} role="alert">{cancelError}</p> : null}
              <WithdrawalsTable items={withdrawals} cancelingId={cancelingId} onCancel={(id) => { void handleCancelWithdrawal(id); }} />
            </Card>
          ) : null}

          {overview.redemptions.length > 0 ? (
            <Card className={styles.card}>
              <h2 className={styles.cardTitle}>{t("settings.affiliate.redemptionsTitle")}</h2>
              <ul className={styles.list}>
                {overview.redemptions.map((item) => (
                  <li key={item.id}>
                    <div>
                      <strong>{t("settings.affiliate.redemptionLine", { amount: formatNumber(item.amountBaht, locale), credits: formatNumber(item.creditsGranted, locale, 4) })}</strong>
                      <span>{formatDate(item.createdAt, locale)}</span>
                    </div>
                    <div className={styles.listNumbers}>
                      <span>{statusLabel[item.status]}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
