export const CREDIT_BALANCE_CHANGED_EVENT = "eos:credit-balance-changed";
export const CREDIT_BALANCE_SYNC_EVENT = "eos:credit-balance-sync";

export type CreditBalanceChangedDetail = {
  delta: number;
};

export type CreditBalanceSyncDetail = {
  confirmedDelta?: number;
};

export function emitCreditBalanceChanged(delta: number): void {
  if (typeof window === "undefined" || !Number.isFinite(delta) || delta <= 0) return;
  window.dispatchEvent(new CustomEvent<CreditBalanceChangedDetail>(CREDIT_BALANCE_CHANGED_EVENT, {
    detail: { delta },
  }));
}

export function requestCreditBalanceSync(confirmedDelta?: number): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<CreditBalanceSyncDetail>(CREDIT_BALANCE_SYNC_EVENT, {
    detail: Number.isFinite(confirmedDelta) && Number(confirmedDelta) > 0
      ? { confirmedDelta: Number(confirmedDelta) }
      : {},
  }));
}
