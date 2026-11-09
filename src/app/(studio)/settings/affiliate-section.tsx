"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, LoaderCircle, Share2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { affiliateApi, type AffiliateApi, type AffiliateOverview, type RedeemErrorCode } from "@/lib/api/affiliate";
import { buildReferralLink } from "@/lib/affiliate/referral-storage";
import { requestCreditBalanceSync } from "@/lib/credits/credit-events";
import { useLocale, type Locale, type TranslationKey } from "@/lib/i18n/locale-provider";
import settingsStyles from "./settings-page.module.css";
import styles from "./affiliate-section.module.css";

export const AFFILIATE_SECTION_ID = "settings-affiliate";

/** How often the section reloads itself while it is on screen. */
const REFRESH_INTERVAL_MS = 60_000;

/** The wording for each short code the server refuses an exchange with. */
const REDEEM_ERROR_KEYS: Record<RedeemErrorCode, TranslationKey> = {
  below_minimum: "settings.affiliate.redeemErrorBelowMinimum",
  exceeds_balance: "settings.affiliate.redeemErrorExceedsBalance",
  invalid_amount: "settings.affiliate.redeemErrorInvalidAmount",
  program_off: "settings.affiliate.redeemErrorProgramOff",
  suspended: "settings.affiliate.redeemErrorSuspended",
  affiliate_not_found: "settings.affiliate.redeemErrorGeneric",
  previous_attempt_failed: "settings.affiliate.redeemErrorFailed",
  exchange_failed: "settings.affiliate.redeemErrorFailed",
};

/** Where the exchange is: nothing open, typing the amount, checking it, waiting for the server, or finished. */
type ExchangeStep = "closed" | "entering" | "confirming" | "processing" | "done" | "error";

function formatDate(value: string, locale: Locale): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-US", { dateStyle: "medium" }).format(date);
}

function formatNumber(value: number, locale: Locale, maximumFractionDigits = 2): string {
  return new Intl.NumberFormat(locale === "th" ? "th-TH" : "en-US", { maximumFractionDigits }).format(value);
}

/** One id per attempt at the exchange, so pressing the button twice cannot exchange twice. */
function newRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** Credits for an amount of baht, rounded down the way the server does it. */
function creditsFor(baht: number, creditsPerBaht: number): number {
  return Math.floor(baht * creditsPerBaht * 10000 + 1e-9) / 10000;
}

/**
 * The member's affiliate: create it once, share the link, see how many people came through it and what that earned in
 * baht, and exchange the baht that is ready for credits. `api` can be replaced to render the section without a backend.
 */
export function AffiliateSection({ api = affiliateApi }: { api?: AffiliateApi }) {
  const { locale, t } = useLocale();
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [overview, setOverview] = useState<AffiliateOverview | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [step, setStep] = useState<ExchangeStep>("closed");
  const [amountText, setAmountText] = useState("");
  const [requestId, setRequestId] = useState("");
  const [exchangeError, setExchangeError] = useState<string | null>(null);
  const [creditsReceived, setCreditsReceived] = useState(0);

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

  // Quiet refresh, so people invited or baht earned while this page stays open show up without a reload.
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
  const wallet = overview?.wallet;
  const stats = overview?.stats;
  const percent = settings ? formatNumber(settings.commissionPercent, locale) : "";
  const usagePercent = settings ? formatNumber(settings.usageCommissionPercent, locale) : "";
  const holdDays = settings ? formatNumber(settings.holdDays, locale, 0) : "";
  // Only the kinds the admin has switched on are shown, so the page never promises what is not paid.
  const showTopup = Boolean(settings?.enabled && settings.topupEnabled);
  const showUsage = Boolean(settings?.enabled && settings.usageEnabled);

  const available = wallet?.availableBaht ?? 0;
  const minimum = settings?.minExchangeBaht ?? 0;
  const creditsPerBaht = settings?.creditsPerBaht ?? 0;
  const canExchange = Boolean(affiliate && affiliate.status === "active" && settings?.enabled && available >= minimum && minimum > 0);

  const amount = Number(amountText);
  const amountValid =
    amountText.trim() !== "" && Number.isFinite(amount) && Math.round(amount * 100) / 100 === amount && amount >= minimum && amount <= available;
  const previewCredits = amountValid ? creditsFor(amount, creditsPerBaht) : 0;

  function openExchange() {
    setAmountText(String(available));
    setExchangeError(null);
    setStep("entering");
  }

  function closeExchange() {
    setStep("closed");
    setExchangeError(null);
  }

  function goConfirm() {
    if (!amountValid) return;
    setRequestId(newRequestId());
    setStep("confirming");
  }

  async function handleConfirm() {
    if (!amountValid || step === "processing") return;
    setStep("processing");
    setExchangeError(null);
    try {
      const result = await api.redeem(amount, requestId);
      setCreditsReceived(result.creditsGranted);
      setOverview((current) => (current ? { ...current, wallet: result.wallet } : current));
      requestCreditBalanceSync(result.creditsGranted);
      setStep("done");
      // The list of recent exchanges and the totals come from the server.
      void api.load().then(setOverview).catch(() => undefined);
    } catch (error: unknown) {
      const code = error instanceof Error ? error.message : "";
      const key = code in REDEEM_ERROR_KEYS ? REDEEM_ERROR_KEYS[code as RedeemErrorCode] : "settings.affiliate.redeemErrorGeneric";
      setExchangeError(t(key));
      // A refusal ends this attempt. A reply that never came keeps the same id, so trying again cannot exchange twice.
      if (code in REDEEM_ERROR_KEYS) setRequestId(newRequestId());
      setStep("error");
      void api.load().then(setOverview).catch(() => undefined);
    }
  }

  const statusLabel = {
    pending: t("settings.affiliate.statusPending"),
    completed: t("settings.affiliate.statusCompleted"),
    failed: t("settings.affiliate.statusFailed"),
  } as const;

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
            <p>{t("settings.affiliate.intro")}</p>
            <ul className={styles.notes}>
              <li>{t("settings.affiliate.noteLink")}</li>
              {showTopup ? <li>{t("settings.affiliate.noteEarn", { percent })}</li> : null}
              {showUsage ? <li>{t("settings.affiliate.noteUsage", { usagePercent })}</li> : null}
              <li>{t("settings.affiliate.noteCredits", { days: holdDays })}</li>
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
              <li>{t("settings.affiliate.noteCredits", { days: holdDays })}</li>
            </ul>

            <dl className={`${styles.stats} ${styles.walletStats}`}>
              <div>
                <dt>{t("settings.affiliate.walletAvailable")}</dt>
                <dd>฿{formatNumber(available, locale)}</dd>
              </div>
              <div>
                <dt>{t("settings.affiliate.walletPending")}</dt>
                <dd>฿{formatNumber(wallet?.pendingBaht ?? 0, locale)}</dd>
                {(wallet?.pendingBaht ?? 0) > 0 ? <dd className={styles.statSub}>{t("settings.affiliate.walletPendingHint", { days: holdDays })}</dd> : null}
              </div>
              <div>
                <dt>{t("settings.affiliate.walletRedeemed")}</dt>
                <dd>฿{formatNumber(wallet?.redeemedBaht ?? 0, locale)}</dd>
              </div>
            </dl>

            <div className={styles.exchange}>
              <div className={styles.exchangeHead}>
                <div>
                  <strong>{t("settings.affiliate.exchangeTitle")}</strong>
                  <span>{t("settings.affiliate.exchangeRate", { rate: formatNumber(creditsPerBaht, locale, 4), min: formatNumber(minimum, locale) })}</span>
                </div>
                {step === "closed" ? (
                  <Button type="button" size="sm" disabled={!canExchange} onClick={openExchange}>
                    {t("settings.affiliate.exchangeButton")}
                  </Button>
                ) : null}
              </div>
              {step === "closed" && !canExchange && affiliate.status === "active" && overview.settings.enabled ? (
                <p className={styles.hint}>{t("settings.affiliate.exchangeNotReady", { min: formatNumber(minimum, locale) })}</p>
              ) : null}

              {step === "entering" ? (
                <div className={styles.exchangePanel}>
                  <label className={styles.label} htmlFor="affiliate-exchange-amount">{t("settings.affiliate.exchangeAmount")}</label>
                  <div className={styles.amountRow}>
                    <input
                      id="affiliate-exchange-amount"
                      className={styles.amountField}
                      type="number"
                      inputMode="decimal"
                      min={minimum}
                      max={available}
                      step={0.01}
                      value={amountText}
                      onChange={(event) => setAmountText(event.target.value)}
                      aria-invalid={amountText !== "" && !amountValid}
                    />
                    <Button type="button" variant="outline" size="sm" onClick={() => setAmountText(String(available))}>
                      {t("settings.affiliate.exchangeAll")}
                    </Button>
                  </div>
                  {amountValid ? (
                    <p className={styles.preview}>{t("settings.affiliate.exchangePreview", { credits: formatNumber(previewCredits, locale, 4) })}</p>
                  ) : (
                    <p className={styles.hint}>{t("settings.affiliate.exchangeRange", { min: formatNumber(minimum, locale), max: formatNumber(available, locale) })}</p>
                  )}
                  <div className={styles.exchangeActions}>
                    <Button type="button" size="sm" disabled={!amountValid} onClick={goConfirm}>{t("settings.affiliate.exchangeNext")}</Button>
                    <Button type="button" variant="outline" size="sm" onClick={closeExchange}>{t("settings.affiliate.exchangeCancel")}</Button>
                  </div>
                </div>
              ) : null}

              {step === "confirming" || step === "processing" ? (
                <div className={styles.exchangePanel}>
                  <p className={styles.label}>{t("settings.affiliate.exchangeConfirmTitle")}</p>
                  <p className={styles.preview}>
                    {t("settings.affiliate.exchangeConfirmBody", { amount: formatNumber(amount, locale), credits: formatNumber(previewCredits, locale, 4) })}
                  </p>
                  <div className={styles.exchangeActions}>
                    <Button type="button" size="sm" disabled={step === "processing"} onClick={() => { void handleConfirm(); }}>
                      {step === "processing" ? <LoaderCircle size={14} className="animate-spin" /> : null}
                      {step === "processing" ? t("settings.affiliate.exchangeProcessing") : t("settings.affiliate.exchangeConfirm")}
                    </Button>
                    <Button type="button" variant="outline" size="sm" disabled={step === "processing"} onClick={() => setStep("entering")}>
                      {t("settings.affiliate.exchangeBack")}
                    </Button>
                  </div>
                </div>
              ) : null}

              {step === "done" ? (
                <div className={styles.exchangePanel} role="status">
                  <p className={styles.success}>{t("settings.affiliate.exchangeDone", { credits: formatNumber(creditsReceived, locale, 4) })}</p>
                  <div className={styles.exchangeActions}>
                    <Button type="button" variant="outline" size="sm" onClick={closeExchange}>{t("settings.affiliate.exchangeClose")}</Button>
                  </div>
                </div>
              ) : null}

              {step === "error" ? (
                <div className={styles.exchangePanel} role="alert">
                  <p className={styles.error}>{exchangeError}</p>
                  <div className={styles.exchangeActions}>
                    <Button type="button" size="sm" onClick={() => setStep("confirming")}>{t("settings.affiliate.retry")}</Button>
                    <Button type="button" variant="outline" size="sm" onClick={closeExchange}>{t("settings.affiliate.exchangeClose")}</Button>
                  </div>
                </div>
              ) : null}
            </div>

            {overview.redemptions.length > 0 ? (
              <>
                <h3 className={styles.listTitle}>{t("settings.affiliate.redemptionsTitle")}</h3>
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
              </>
            ) : null}

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
                <dd>฿{formatNumber(wallet?.earnedBaht ?? 0, locale)}</dd>
                {showUsage ? (
                  <dd className={styles.statSub}>
                    {t("settings.affiliate.earnedBreakdown", {
                      topup: `฿${formatNumber(wallet?.topupEarnedBaht ?? 0, locale)}`,
                      usage: `฿${formatNumber(wallet?.usageEarnedBaht ?? 0, locale)}`,
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
                      <strong>+฿{formatNumber(item.earnedBaht, locale)}</strong>
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
