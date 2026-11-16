"use client";

import { useEffect, useRef, useState } from "react";
import { clearHeaderAccountCache, fetchHeaderAccountData, type HeaderAccountData } from "@/lib/api/account";
import { AUTH_SESSION_EXPIRED_EVENT, getApiAccessToken } from "@/lib/auth/access-token";
import {
  CREDIT_BALANCE_CHANGED_EVENT,
  CREDIT_BALANCE_SYNC_EVENT,
  type CreditBalanceChangedDetail,
  type CreditBalanceSyncDetail,
} from "@/lib/credits/credit-events";

const initialAccount: HeaderAccountData = { displayName: "User", email: "", role: "User", balance: null };

function toNumericBalance(balance: HeaderAccountData["balance"]): number | null {
  const value = typeof balance === "string" ? Number(balance.replace(/,/g, "")) : balance;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function useHeaderAccount() {
  const [account, setAccount] = useState<HeaderAccountData>(initialAccount);
  // Credits are taken by the backend worker some seconds after a job is accepted, so the
  // header lowers the balance right away (an "expected" balance) and only trusts the server
  // once the job is settled. While jobs are pending the shown balance is the lower of the
  // server balance and the expected balance, which can never count a charge twice.
  const pendingJobs = useRef({ total: 0, expectedBalance: null as number | null });
  const shownAccount = useRef<HeaderAccountData>(initialAccount);

  useEffect(() => {
    let isMounted = true;
    const show = (next: HeaderAccountData) => {
      shownAccount.current = next;
      setAccount(next);
    };
    const handleSessionExpired = () => {
      if (!isMounted) return;
      clearHeaderAccountCache();
      pendingJobs.current = { total: 0, expectedBalance: null };
      show(initialAccount);
      window.location.replace("/?login=1&reason=session-expired");
    };
    // `force` skips the 10 second cache. Every explicit sync request means "the balance just
    // changed", so it must always go to the server; only the first load may use the cache.
    const refreshAccount = async (confirmedDelta = 0, force = false) => {
      try {
        const nextAccount = await fetchHeaderAccountData({ force });
        if (!isMounted) return;
        const pending = pendingJobs.current;
        if (confirmedDelta > 0) pending.total = Math.max(0, pending.total - confirmedDelta);
        if (pending.total <= 0) {
          pending.total = 0;
          pending.expectedBalance = null;
        }
        const serverBalance = toNumericBalance(nextAccount.balance);
        show(
          serverBalance === null || pending.expectedBalance === null || serverBalance <= pending.expectedBalance
            ? nextAccount
            : { ...nextAccount, balance: pending.expectedBalance },
        );
      } catch {
        // Keep the current value when the account endpoints are unavailable.
      }
    };
    const handleBalanceChanged = (event: Event) => {
      const detail = (event as CustomEvent<CreditBalanceChangedDetail>).detail;
      const delta = Number(detail?.delta);
      if (!Number.isFinite(delta) || delta <= 0) return;
      const currentBalance = toNumericBalance(shownAccount.current.balance);
      if (currentBalance === null) return;
      const nextBalance = Math.max(0, currentBalance - delta);
      pendingJobs.current.total += delta;
      pendingJobs.current.expectedBalance = nextBalance;
      show({ ...shownAccount.current, balance: nextBalance });
    };
    const handleBalanceSync = (event: Event) => {
      const detail = (event as CustomEvent<CreditBalanceSyncDetail>).detail;
      const confirmedDelta = Number(detail?.confirmedDelta);
      void refreshAccount(Number.isFinite(confirmedDelta) && confirmedDelta > 0 ? confirmedDelta : 0, true);
    };

    void refreshAccount();
    window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, handleSessionExpired);
    window.addEventListener(CREDIT_BALANCE_CHANGED_EVENT, handleBalanceChanged);
    window.addEventListener(CREDIT_BALANCE_SYNC_EVENT, handleBalanceSync);

    return () => {
      isMounted = false;
      window.removeEventListener(AUTH_SESSION_EXPIRED_EVENT, handleSessionExpired);
      window.removeEventListener(CREDIT_BALANCE_CHANGED_EVENT, handleBalanceChanged);
      window.removeEventListener(CREDIT_BALANCE_SYNC_EVENT, handleBalanceSync);
    };
  }, []);

  useEffect(() => {
    const refreshSession = () => {
      void getApiAccessToken();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") refreshSession();
    };
    const interval = window.setInterval(refreshSession, 60_000);
    window.addEventListener("focus", refreshSession);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshSession);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const numericBalance = toNumericBalance(account.balance);
  const creditsLabel =
    numericBalance !== null && Number.isFinite(numericBalance)
      ? `${numericBalance.toLocaleString("en-US")} Credits`
      : "— Credits";

  return { ...account, creditsLabel };
}
