"use client";

import { useEffect, useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AffiliateApi, AffiliateOverview, AffiliateWallet, AffiliateWithdrawal, PayoutMethod, WithdrawErrorCode } from "@/lib/api/affiliate";
import { fetchHeaderAccountData } from "@/lib/api/account";
import { useLocale, type TranslationKey } from "@/lib/i18n/locale-provider";
import { formatNumber, newRequestId } from "./format";
import styles from "./affiliate-page.module.css";

/** The wording for each short code the server refuses a withdrawal with. */
const WITHDRAW_ERROR_KEYS: Record<WithdrawErrorCode, TranslationKey> = {
  withdraw_off: "affiliate.withdraw.errOff",
  program_off: "affiliate.withdraw.errOff",
  suspended: "affiliate.withdraw.errSuspended",
  affiliate_not_found: "affiliate.withdraw.errGeneric",
  below_minimum: "affiliate.withdraw.errBelow",
  exceeds_balance: "affiliate.withdraw.errExceeds",
  invalid_amount: "affiliate.withdraw.errAmount",
  invalid_method: "affiliate.withdraw.errGeneric",
  invalid_promptpay: "affiliate.withdraw.errPromptpay",
  invalid_bank_name: "affiliate.withdraw.errBankName",
  invalid_bank_account: "affiliate.withdraw.errBankAccount",
  invalid_account_name: "affiliate.withdraw.errAccountName",
  invalid_contact_email: "affiliate.withdraw.errContactEmail",
  proof_required: "affiliate.withdraw.errProofRequired",
  invalid_proof: "affiliate.withdraw.errProofInvalid",
  proof_storage_unavailable: "affiliate.withdraw.errProofStorage",
  not_pending: "affiliate.withdraw.errGeneric",
  withdrawal_not_found: "affiliate.withdraw.errGeneric",
};

/** Where the withdrawal is: nothing open, filling the form, checking it, waiting for the server, or finished. */
type Step = "closed" | "entering" | "confirming" | "processing" | "done" | "error";

const digitsOnly = (value: string) => value.replace(/[\s-]/g, "");

/** The same rule as the server: one @, a dot in the domain, no spaces. */
const emailValid = (value: string) => value.trim().length <= 160 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

/** The photo of the ID card or bank book: the same limit and kinds as the server. */
const PROOF_MAX_BYTES = 5 * 1024 * 1024;
const PROOF_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** The same rule as the server: a mobile number, a national or tax ID, or an e-wallet ID. */
function promptpayValid(value: string): boolean {
  const id = digitsOnly(value);
  return /^\d+$/.test(id) && ((id.length === 10 && id.startsWith("0")) || id.length === 13 || id.length === 15);
}

/**
 * Asks to withdraw the baht that is ready as money, to PromptPay or a bank account. The baht is held at once and an admin
 * pays it by hand, so the card ends at "request sent"; the status then lives in the list of withdrawals. Each attempt has
 * its own request id, so a double press is one request. The details are asked for every time and are not kept here.
 */
export function WithdrawCard({
  overview,
  api,
  onWithdrawal,
}: {
  overview: AffiliateOverview;
  api: Pick<AffiliateApi, "withdraw">;
  onWithdrawal: (result: { withdrawal: AffiliateWithdrawal; wallet: AffiliateWallet }) => void;
}) {
  const { locale, t } = useLocale();
  const [step, setStep] = useState<Step>("closed");
  const [amountText, setAmountText] = useState("");
  const [method, setMethod] = useState<PayoutMethod>("promptpay");
  const [promptpayId, setPromptpayId] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [accountName, setAccountName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [requestId, setRequestId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sentAmount, setSentAmount] = useState(0);
  const [proof, setProof] = useState<File | null>(null);
  const [proofError, setProofError] = useState<string | null>(null);
  const proofInput = useRef<HTMLInputElement>(null);
  // After a refusal the details need fixing; after a reply that never came the same attempt is tried again as it was.
  const [retryStep, setRetryStep] = useState<"entering" | "confirming">("entering");

  const { settings, wallet, affiliate } = overview;
  const available = wallet.availableBaht;
  const minimum = settings.minWithdrawBaht ?? 0;
  const active = affiliate?.status === "active" && settings.enabled && Boolean(settings.withdrawEnabled);
  const canWithdraw = Boolean(active && minimum > 0 && available >= minimum);

  const amount = Number(amountText);
  const amountValid = amountText.trim() !== "" && Number.isFinite(amount) && Math.round(amount * 100) / 100 === amount && amount >= minimum && amount <= available;
  const nameValid = accountName.trim().length >= 2;
  const destinationValid =
    method === "promptpay"
      ? promptpayValid(promptpayId)
      : bankName.trim().length >= 2 && /^\d{10,15}$/.test(digitsOnly(bankAccount));
  const formValid = amountValid && nameValid && destinationValid && emailValid(contactEmail) && proof !== null;

  // The sign-in email is filled in to start with, and can be changed to another one to be reached on.
  useEffect(() => {
    let active = true;
    void fetchHeaderAccountData()
      .then((account) => {
        if (active && account.email) setContactEmail((current) => current || account.email);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const destinationLabel = method === "promptpay" ? `PromptPay ${digitsOnly(promptpayId)}` : `${bankName.trim()} ${digitsOnly(bankAccount)}`;

  function open() {
    setAmountText(String(available));
    setError(null);
    setProofError(null);
    setStep("entering");
  }

  function close() {
    setStep("closed");
    setError(null);
  }

  function chooseProof(file: File | undefined) {
    setProofError(null);
    if (!file) return;
    if (!PROOF_TYPES.includes(file.type)) {
      setProof(null);
      setProofError(t("affiliate.withdraw.errProofInvalid"));
      return;
    }
    if (file.size > PROOF_MAX_BYTES) {
      setProof(null);
      setProofError(t("affiliate.withdraw.errProofTooLarge"));
      return;
    }
    setProof(file);
  }

  function review() {
    if (!formValid) return;
    setRequestId(newRequestId());
    setStep("confirming");
  }

  async function submit() {
    if (!formValid || !proof || step === "processing") return;
    setStep("processing");
    setError(null);
    try {
      const result = await api.withdraw({
        proof,
        amountBaht: amount,
        requestId,
        method,
        accountName: accountName.trim(),
        contactEmail: contactEmail.trim(),
        ...(method === "promptpay"
          ? { promptpayId: digitsOnly(promptpayId) }
          : { bankName: bankName.trim(), bankAccountNumber: digitsOnly(bankAccount) }),
      });
      setSentAmount(result.withdrawal.amountBaht);
      onWithdrawal(result);
      // Nothing about where the money goes stays in the page once the request is sent.
      setPromptpayId("");
      setBankName("");
      setBankAccount("");
      setAccountName("");
      setProof(null);
      setStep("done");
    } catch (caught: unknown) {
      const code = caught instanceof Error ? caught.message : "";
      const key = code in WITHDRAW_ERROR_KEYS ? WITHDRAW_ERROR_KEYS[code as WithdrawErrorCode] : "affiliate.withdraw.errGeneric";
      setError(t(key));
      // A refusal ends this attempt. A reply that never came keeps the same id, so trying again cannot ask twice.
      const refused = code in WITHDRAW_ERROR_KEYS;
      if (refused) setRequestId(newRequestId());
      setRetryStep(refused ? "entering" : "confirming");
      setStep("error");
    }
  }

  return (
    <div className={styles.exchange}>
      <div className={styles.exchangeHead}>
        <div>
          <strong>{t("affiliate.withdraw.title")}</strong>
          <span>{t("affiliate.withdraw.rate", { min: formatNumber(minimum, locale) })}</span>
        </div>
        {step === "closed" ? (
          <Button type="button" size="sm" disabled={!canWithdraw} onClick={open}>
            {t("affiliate.withdraw.button")}
          </Button>
        ) : null}
      </div>
      {step === "closed" && !canWithdraw && active ? (
        <p className={styles.hint}>{t("affiliate.withdraw.notReady", { min: formatNumber(minimum, locale) })}</p>
      ) : null}

      {step === "entering" ? (
        <div className={styles.exchangePanel}>
          <label className={styles.label} htmlFor="affiliate-withdraw-amount">{t("affiliate.withdraw.amount")}</label>
          <div className={styles.amountRow}>
            <input
              id="affiliate-withdraw-amount"
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
          {!amountValid ? (
            <p className={styles.hint}>{t("settings.affiliate.exchangeRange", { min: formatNumber(minimum, locale), max: formatNumber(available, locale) })}</p>
          ) : null}

          <fieldset className={styles.methodGroup}>
            <legend className={styles.label}>{t("affiliate.withdraw.method")}</legend>
            <label className={styles.radio}>
              <input type="radio" name="affiliate-withdraw-method" checked={method === "promptpay"} onChange={() => setMethod("promptpay")} />
              {t("affiliate.withdraw.methodPromptpay")}
            </label>
            <label className={styles.radio}>
              <input type="radio" name="affiliate-withdraw-method" checked={method === "bank"} onChange={() => setMethod("bank")} />
              {t("affiliate.withdraw.methodBank")}
            </label>
          </fieldset>

          {method === "promptpay" ? (
            <div className={styles.field}>
              <label className={styles.label} htmlFor="affiliate-withdraw-promptpay">{t("affiliate.withdraw.promptpayId")}</label>
              <input
                id="affiliate-withdraw-promptpay"
                className={styles.textField}
                inputMode="numeric"
                autoComplete="off"
                value={promptpayId}
                onChange={(event) => setPromptpayId(event.target.value)}
                aria-invalid={promptpayId !== "" && !promptpayValid(promptpayId)}
              />
              <p className={styles.hint}>{t("affiliate.withdraw.promptpayHint")}</p>
            </div>
          ) : (
            <>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="affiliate-withdraw-bank">{t("affiliate.withdraw.bankName")}</label>
                <input
                  id="affiliate-withdraw-bank"
                  className={styles.textField}
                  autoComplete="off"
                  maxLength={60}
                  value={bankName}
                  onChange={(event) => setBankName(event.target.value)}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="affiliate-withdraw-account">{t("affiliate.withdraw.bankAccount")}</label>
                <input
                  id="affiliate-withdraw-account"
                  className={styles.textField}
                  inputMode="numeric"
                  autoComplete="off"
                  value={bankAccount}
                  onChange={(event) => setBankAccount(event.target.value)}
                  aria-invalid={bankAccount !== "" && !/^\d{10,15}$/.test(digitsOnly(bankAccount))}
                />
              </div>
            </>
          )}

          <div className={styles.field}>
            <label className={styles.label} htmlFor="affiliate-withdraw-name">{t("affiliate.withdraw.accountName")}</label>
            <input
              id="affiliate-withdraw-name"
              className={styles.textField}
              autoComplete="off"
              maxLength={100}
              value={accountName}
              onChange={(event) => setAccountName(event.target.value)}
            />
            <p className={styles.hint}>{t("affiliate.withdraw.accountNameHint")}</p>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="affiliate-withdraw-email">{t("affiliate.withdraw.contactEmail")}</label>
            <input
              id="affiliate-withdraw-email"
              className={styles.textField}
              type="email"
              inputMode="email"
              autoComplete="email"
              maxLength={160}
              value={contactEmail}
              onChange={(event) => setContactEmail(event.target.value)}
              aria-invalid={contactEmail !== "" && !emailValid(contactEmail)}
            />
            <p className={styles.hint}>{t("affiliate.withdraw.contactEmailHint")}</p>
          </div>

          <div className={styles.field}>
            <span className={styles.label}>{t("affiliate.withdraw.proof")}</span>
            <input
              ref={proofInput}
              className={styles.fileInput}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => {
                chooseProof(event.target.files?.[0]);
                // Choosing the same photo again must still fire a change.
                event.target.value = "";
              }}
              aria-label={t("affiliate.withdraw.proof")}
              tabIndex={-1}
            />
            <div className={styles.proofRow}>
              <Button type="button" variant="outline" size="sm" onClick={() => proofInput.current?.click()}>
                {proof ? t("affiliate.withdraw.proofChange") : t("affiliate.withdraw.proofChoose")}
              </Button>
              {proof ? <span className={styles.proofName}>{t("affiliate.withdraw.proofAttached", { name: proof.name })}</span> : null}
            </div>
            {proofError ? <p className={styles.error} role="alert">{proofError}</p> : <p className={styles.hint}>{t("affiliate.withdraw.proofHint")}</p>}
          </div>

          <div className={styles.exchangeActions}>
            <Button type="button" size="sm" disabled={!formValid} onClick={review}>{t("affiliate.withdraw.review")}</Button>
            <Button type="button" variant="outline" size="sm" onClick={close}>{t("settings.affiliate.exchangeCancel")}</Button>
          </div>
        </div>
      ) : null}

      {step === "confirming" || step === "processing" ? (
        <div className={styles.exchangePanel}>
          <p className={styles.label}>{t("affiliate.withdraw.confirmTitle")}</p>
          <p className={styles.preview}>
            {t("affiliate.withdraw.confirmBody", { amount: formatNumber(amount, locale), destination: destinationLabel, name: accountName.trim() })}
          </p>
          {proof ? <p className={styles.hint}>{t("affiliate.withdraw.proofAttached", { name: proof.name })}</p> : null}
          <p className={styles.hint}>{t("affiliate.withdraw.manualNote")}</p>
          <div className={styles.exchangeActions}>
            <Button type="button" size="sm" disabled={step === "processing"} onClick={() => { void submit(); }}>
              {step === "processing" ? <LoaderCircle size={14} className="animate-spin" /> : null}
              {step === "processing" ? t("settings.affiliate.exchangeProcessing") : t("affiliate.withdraw.confirm")}
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={step === "processing"} onClick={() => setStep("entering")}>
              {t("settings.affiliate.exchangeBack")}
            </Button>
          </div>
        </div>
      ) : null}

      {step === "done" ? (
        <div className={styles.exchangePanel} role="status">
          <p className={styles.success}>{t("affiliate.withdraw.done", { amount: formatNumber(sentAmount, locale) })}</p>
          <div className={styles.exchangeActions}>
            <Button type="button" variant="outline" size="sm" onClick={close}>{t("settings.affiliate.exchangeClose")}</Button>
          </div>
        </div>
      ) : null}

      {step === "error" ? (
        <div className={styles.exchangePanel} role="alert">
          <p className={styles.error}>{error}</p>
          <div className={styles.exchangeActions}>
            <Button type="button" size="sm" onClick={() => setStep(retryStep)}>{t("settings.affiliate.retry")}</Button>
            <Button type="button" variant="outline" size="sm" onClick={close}>{t("settings.affiliate.exchangeClose")}</Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
