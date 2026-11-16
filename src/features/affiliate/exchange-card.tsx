"use client";

import { useState, type ReactNode } from "react";
import { ArrowLeftRight, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AffiliateApi, AffiliateOverview, AffiliateWallet, RedeemErrorCode } from "@/lib/api/affiliate";
import { requestCreditBalanceSync } from "@/lib/credits/credit-events";
import { useLocale, type TranslationKey } from "@/lib/i18n/locale-provider";
import { creditsFor, formatNumber, newRequestId } from "./format";
import styles from "./affiliate-page.module.css";

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

/**
 * Exchanges the baht that is ready for credits: type an amount, check it, confirm. Each attempt carries its own request id,
 * so a double press is one exchange. The page owns the data; this card only reports the new wallet and asks for a reload.
 */
export function ExchangeCard({
  overview,
  api,
  onWallet,
  onReload,
  icon,
}: {
  icon?: ReactNode;
  overview: AffiliateOverview;
  api: Pick<AffiliateApi, "redeem">;
  onWallet: (wallet: AffiliateWallet) => void;
  onReload: () => void;
}) {
  const { locale, t } = useLocale();
  const [step, setStep] = useState<ExchangeStep>("closed");
  const [amountText, setAmountText] = useState("");
  const [requestId, setRequestId] = useState("");
  const [exchangeError, setExchangeError] = useState<string | null>(null);
  const [creditsReceived, setCreditsReceived] = useState(0);

  const { settings, wallet, affiliate } = overview;
  const available = wallet.availableBaht;
  const minimum = settings.minExchangeBaht;
  const creditsPerBaht = settings.creditsPerBaht;
  const active = affiliate?.status === "active" && settings.enabled;
  const canExchange = Boolean(active && available >= minimum && minimum > 0);

  const amount = Number(amountText);
  const amountValid = amountText.trim() !== "" && Number.isFinite(amount) && Math.round(amount * 100) / 100 === amount && amount >= minimum && amount <= available;
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
      onWallet(result.wallet);
      requestCreditBalanceSync(result.creditsGranted);
      setStep("done");
      // The list of exchanges and the totals come from the server.
      onReload();
    } catch (error: unknown) {
      const code = error instanceof Error ? error.message : "";
      const key = code in REDEEM_ERROR_KEYS ? REDEEM_ERROR_KEYS[code as RedeemErrorCode] : "settings.affiliate.redeemErrorGeneric";
      setExchangeError(t(key));
      // A refusal ends this attempt. A reply that never came keeps the same id, so trying again cannot exchange twice.
      if (code in REDEEM_ERROR_KEYS) setRequestId(newRequestId());
      setStep("error");
      onReload();
    }
  }

  return (
    <div className={styles.exchange}>
      <div className={styles.actionHead}>
        {icon ? <span className={styles.actionIcon} aria-hidden="true">{icon}</span> : null}
        <div className={styles.actionText}>
          <strong>{t("settings.affiliate.exchangeTitle")}</strong>
          <span>{t("settings.affiliate.exchangeRate", { rate: formatNumber(creditsPerBaht, locale, 4), min: formatNumber(minimum, locale) })}</span>
          {step === "closed" && !canExchange && active ? (
            <span className={styles.actionHint}>{t("settings.affiliate.exchangeNotReady", { min: formatNumber(minimum, locale) })}</span>
          ) : null}
        </div>
        {step === "closed" ? (
          <Button type="button" size="sm" className={styles.actionPrimary} disabled={!canExchange} onClick={openExchange}>
            <ArrowLeftRight size={15} aria-hidden="true" />
            {t("settings.affiliate.exchangeButton")}
          </Button>
        ) : null}
      </div>

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
  );
}
