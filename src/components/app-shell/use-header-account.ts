"use client";

import { useEffect, useRef, useState } from "react";
import { fetchHeaderAccountData, type HeaderAccountData } from "@/lib/api/account";
import {
  CREDIT_BALANCE_CHANGED_EVENT,
  CREDIT_BALANCE_SYNC_EVENT,
  type CreditBalanceChangedDetail,
  type CreditBalanceSyncDetail,
} from "@/lib/credits/credit-events";

const initialAccount: HeaderAccountData = { displayName: "User", email: "", balance: null };

function toNumericBalance(balance: HeaderAccountData["balance"]): number | null {
  const value = typeof balance === "string" ? Number(balance.replace(/,/g, "")) : balance;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function useHeaderAccount() {
  const [account, setAccount] = useState<HeaderAccountData>(initialAccount);
  const optimisticDeduction = useRef(0);

  useEffect(() => {
    let isMounted = true;
    const refreshAccount = async (confirmedDelta = 0) => {
      try {
        const nextAccount = await fetchHeaderAccountData();
        if (!isMounted) return;
        if (confirmedDelta > 0) {
          optimisticDeduction.current = Math.max(0, optimisticDeduction.current - confirmedDelta);
        }
        const visibleBalance = toNumericBalance(nextAccount.balance);
        const pendingDeduction = optimisticDeduction.current;
        setAccount(visibleBalance === null || pendingDeduction <= 0
          ? nextAccount
          : { ...nextAccount, balance: Math.max(0, visibleBalance - pendingDeduction) });
      } catch {
        // Keep the current value when the account endpoints are unavailable.
      }
    };
    const handleBalanceChanged = (event: Event) => {
      const detail = (event as CustomEvent<CreditBalanceChangedDetail>).detail;
      const delta = Number(detail?.delta);
      if (!Number.isFinite(delta) || delta <= 0) return;
      optimisticDeduction.current += delta;
      setAccount((current) => {
        const currentBalance = toNumericBalance(current.balance);
        if (currentBalance === null) return current;
        return { ...current, balance: Math.max(0, currentBalance - delta) };
      });
    };
    const handleBalanceSync = (event: Event) => {
      const detail = (event as CustomEvent<CreditBalanceSyncDetail>).detail;
      const confirmedDelta = Number(detail?.confirmedDelta);
      void refreshAccount(Number.isFinite(confirmedDelta) && confirmedDelta > 0 ? confirmedDelta : 0);
    };

    void refreshAccount();
    window.addEventListener(CREDIT_BALANCE_CHANGED_EVENT, handleBalanceChanged);
    window.addEventListener(CREDIT_BALANCE_SYNC_EVENT, handleBalanceSync);

    return () => {
      isMounted = false;
      window.removeEventListener(CREDIT_BALANCE_CHANGED_EVENT, handleBalanceChanged);
      window.removeEventListener(CREDIT_BALANCE_SYNC_EVENT, handleBalanceSync);
    };
  }, []);

  const numericBalance = toNumericBalance(account.balance);
  const creditsLabel = numericBalance !== null && Number.isFinite(numericBalance)
    ? `${numericBalance.toLocaleString("en-US")} Credits`
    : "— Credits";

  return { ...account, creditsLabel };
}
