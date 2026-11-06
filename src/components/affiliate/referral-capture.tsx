"use client";

import { useEffect } from "react";
import { parseReferralCode, rememberReferralCode } from "@/lib/affiliate/referral-storage";

/** Keeps the `?ref=CODE` of an affiliate link until the visitor has signed up. Renders nothing. */
export function ReferralCapture() {
  useEffect(() => {
    const code = parseReferralCode(new URLSearchParams(window.location.search).get("ref"));
    if (code) rememberReferralCode(code);
  }, []);
  return null;
}
