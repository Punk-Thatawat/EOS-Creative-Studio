"use client";

import { useEffect } from "react";
import { claimAffiliateReferral } from "@/lib/api/affiliate";
import { forgetReferralCode, readReferralCode, rememberReferralCode } from "@/lib/affiliate/referral-storage";

/**
 * Once a member is signed in, tells the server which affiliate link they came from. The code is dropped before the
 * request is sent, so it goes out once even if this effect runs twice. Every answer from the server (accepted or not)
 * settles the matter; only a request that fails to get an answer puts the code back for the next visit.
 */
export function ReferralClaim() {
  useEffect(() => {
    const code = readReferralCode();
    if (!code) return;
    forgetReferralCode();
    void claimAffiliateReferral(code).catch(() => rememberReferralCode(code));
  }, []);
  return null;
}
