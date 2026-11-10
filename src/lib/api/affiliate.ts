"use client";

import { getApiAccessToken } from "@/lib/auth/access-token";

const backendUrl = (process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000")
  .replace(/\/+$/, "")
  .replace(/\/api\/v1$/, "");
const REQUEST_TIMEOUT_MS = 15000;

export type AffiliateStatus = "active" | "suspended";

export type AffiliateSettings = {
  /** The whole program: off means no new links, no new commissions and no new exchanges. */
  enabled: boolean;
  topupEnabled: boolean;
  /** The percent of what an invited member pays (before VAT) when they top up. */
  commissionPercent: number;
  /** Whether successful creations earn a commission (only after the member has topped up at least once). */
  usageEnabled: boolean;
  /** The percent of the credits an invited member spends on a creation that succeeds. */
  usageCommissionPercent: number;
  /** What one credit is worth in baht, to value the credits spent on a creation. */
  bahtPerCredit: number;
  /** The exchange rate: credits received for each baht exchanged. */
  creditsPerBaht: number;
  /** Days a new earning waits before it can be exchanged. */
  holdDays: number;
  /** The smallest amount, in baht, that can be exchanged at once. */
  minExchangeBaht: number;
  /** Whether members can ask to withdraw baht as money. Missing from a server that predates withdrawals. */
  withdrawEnabled?: boolean;
  /** The smallest amount, in baht, that can be withdrawn at once. */
  minWithdrawBaht?: number;
};

export type AffiliateWallet = {
  /** Earned, past the hold, and neither exchanged nor asked to be withdrawn: what can be exchanged or withdrawn now. */
  availableBaht: number;
  /** Asked to be withdrawn and waiting for an admin to pay it. Missing from a server that predates withdrawals. */
  withdrawPendingBaht?: number;
  /** Paid out as money. */
  withdrawnBaht?: number;
  /** Earned but still inside the hold. */
  pendingBaht: number;
  /** Already exchanged for credits. */
  redeemedBaht: number;
  earnedBaht: number;
  topupEarnedBaht: number;
  usageEarnedBaht: number;
};

export type AffiliateStats = {
  invitedCount: number;
  /** Invited members who have topped up at least once. Missing from a server that predates the overview page. */
  payingCount?: number;
  topupCount: number;
  topupAmountThb: number;
};

/** What one day earned, in baht. Every day of the window is present, with zeros when nothing was earned. */
export type AffiliateDailyPoint = {
  /** The day in Bangkok time, YYYY-MM-DD. */
  date: string;
  topupBaht: number;
  usageBaht: number;
};

export type AffiliateActivity = {
  id: string;
  /** The invited member, already masked by the server. */
  member: string;
  source: "topup" | "usage";
  amountBaht: number;
  createdAt: string;
  /** When the baht can be exchanged. */
  availableAt: string;
};

export type AffiliateReferral = {
  /** The invited member, already masked by the server (j***@gmail.com). */
  member: string;
  joinedAt: string;
  topupCount: number;
  topupAmountThb: number;
  earnedBaht: number;
};

export type AffiliateRedemption = {
  id: string;
  amountBaht: number;
  creditsGranted: number;
  status: "pending" | "completed" | "failed";
  createdAt: string;
};

export type PayoutMethod = "promptpay" | "bank";
export type WithdrawalStatus = "pending" | "paid" | "rejected" | "cancelled";

/** A withdrawal as its owner sees it: the destination is already masked by the server. */
export type AffiliateWithdrawal = {
  id: string;
  amountBaht: number;
  method: PayoutMethod;
  /** `PromptPay ******5678` or `Kasikornbank ******7890`. */
  destination: string;
  accountName: string;
  /** The email the member gave for this request, masked (`s***@example.com`). Null for a request made before it was asked for. */
  contactEmail: string | null;
  status: WithdrawalStatus;
  /** The reason, when it was rejected. */
  note: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

/** What the member types to ask for a withdrawal. Only the fields of the chosen method are sent. */
export type WithdrawalInput = {
  amountBaht: number;
  /** One per press of the button, so a double press is one request. */
  requestId: string;
  method: PayoutMethod;
  promptpayId?: string;
  bankName?: string;
  bankAccountNumber?: string;
  accountName: string;
  /** The email an admin can reach the member on about this request. */
  contactEmail: string;
  /** A photo of the ID card or bank book (JPG, PNG or WEBP, up to 5 MB). Only an admin can see it. */
  proof: File;
};

export type WithdrawalResult = { withdrawal: AffiliateWithdrawal; wallet: AffiliateWallet };

export type AffiliateOverview = {
  settings: AffiliateSettings;
  affiliate: { id: string; code: string; status: AffiliateStatus; createdAt: string } | null;
  wallet: AffiliateWallet;
  stats: AffiliateStats;
  referrals: AffiliateReferral[];
  redemptions: AffiliateRedemption[];
  /** The last 30 days, oldest first. Missing from a server that predates the overview page. */
  daily?: AffiliateDailyPoint[];
  activity?: AffiliateActivity[];
  /** The latest withdrawal requests, newest first. Missing from a server that predates withdrawals. */
  withdrawals?: AffiliateWithdrawal[];
};

export type RedeemResult = {
  redemptionId: string;
  amountBaht: number;
  creditsGranted: number;
  wallet: AffiliateWallet;
};

/** The short codes the server answers an exchange with when it refuses. Anything else is shown as a general failure. */
export type RedeemErrorCode =
  | "below_minimum"
  | "exceeds_balance"
  | "invalid_amount"
  | "program_off"
  | "suspended"
  | "affiliate_not_found"
  | "previous_attempt_failed"
  | "exchange_failed";

/** The short codes the server answers a withdrawal with when it refuses. Anything else is shown as a general failure. */
export type WithdrawErrorCode =
  | "withdraw_off"
  | "program_off"
  | "suspended"
  | "affiliate_not_found"
  | "below_minimum"
  | "exceeds_balance"
  | "invalid_amount"
  | "invalid_method"
  | "invalid_promptpay"
  | "invalid_bank_name"
  | "invalid_bank_account"
  | "invalid_account_name"
  | "invalid_contact_email"
  | "proof_required"
  | "invalid_proof"
  | "proof_storage_unavailable"
  | "not_pending"
  | "withdrawal_not_found";

export type ClaimReferralResult = {
  claimed: boolean;
  reason?: "invalid_code" | "own_code" | "already_referred" | "too_late" | "program_off";
};

export type AdminAffiliate = {
  id: string;
  userId: string;
  email: string | null;
  displayName: string | null;
  code: string;
  status: AffiliateStatus;
  createdAt: string;
  invitedCount: number;
  topupAmountThb: number;
  earnedBaht: number;
  redeemedBaht: number;
};

export type AdminAffiliateList = { affiliates: AdminAffiliate[]; total: number; page: number; limit: number };

/** A withdrawal as an admin sees it, with everything needed to make the transfer. */
export type AdminWithdrawal = {
  id: string;
  affiliateId: string;
  code: string;
  email: string | null;
  displayName: string | null;
  amountBaht: number;
  method: PayoutMethod;
  promptpayId: string | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  accountName: string;
  /** The email the member gave for this request. Null for a request made before it was asked for. */
  contactEmail: string | null;
  status: WithdrawalStatus;
  note: string | null;
  reference: string | null;
  /** A short-lived link to the photo of the member's ID card or bank book. Null for a request made before one was asked for. */
  proofUrl: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

export type AdminWithdrawalList = {
  withdrawals: AdminWithdrawal[];
  total: number;
  page: number;
  limit: number;
  /** What is waiting to be paid, whatever the filter. */
  pendingCount: number;
  pendingBaht: number;
};

export type AffiliateApi = {
  load(): Promise<AffiliateOverview>;
  create(): Promise<NonNullable<AffiliateOverview["affiliate"]>>;
  /** Exchanges baht for credits. `requestId` is one per press of the button, so a double press is one exchange. */
  redeem(amountBaht: number, requestId: string): Promise<RedeemResult>;
  /** Asks to withdraw baht as money. The baht is held back at once; an admin pays it by hand or rejects it. */
  withdraw(input: WithdrawalInput): Promise<WithdrawalResult>;
  /** Takes back a request that has not been paid or rejected yet. */
  cancelWithdrawal(id: string): Promise<{ wallet: AffiliateWallet }>;
};

type ErrorPayload = { message?: unknown; errorMessage?: unknown } | null;

async function request<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  // A form (a file upload) goes as it is, so the browser writes its own multipart header; anything else goes as JSON.
  const isForm = typeof FormData !== "undefined" && init.body instanceof FormData;
  const accessToken = await getApiAccessToken();
  if (!accessToken) throw new Error("Session expired");
  let response: Response;
  try {
    response = await fetch(`${backendUrl}/api/v1${path}`, {
      method: init.method ?? "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
        ...(init.body === undefined || isForm ? {} : { "Content-Type": "application/json" }),
      },
      credentials: "include",
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      ...(init.body === undefined ? {} : { body: isForm ? (init.body as FormData) : JSON.stringify(init.body) }),
    });
  } catch {
    throw new Error("Unable to reach the server");
  }
  const payload = (await response.json().catch(() => null)) as (ErrorPayload & { data?: unknown }) | null;
  if (!response.ok) {
    const message = Array.isArray(payload?.message) ? payload.message.join(", ") : payload?.message ?? payload?.errorMessage;
    throw new Error(typeof message === "string" && message ? message : "Affiliate request failed");
  }
  return payload?.data as T;
}

export const affiliateApi: AffiliateApi = {
  load: () => request<AffiliateOverview>("/affiliate"),
  create: () => request<NonNullable<AffiliateOverview["affiliate"]>>("/affiliate", { method: "POST", body: {} }),
  redeem: (amountBaht, requestId) => request<RedeemResult>("/affiliate/redeem", { method: "POST", body: { amountBaht, requestId } }),
  withdraw: (input) => {
    const form = new FormData();
    form.set("amountBaht", String(input.amountBaht));
    form.set("requestId", input.requestId);
    form.set("method", input.method);
    form.set("accountName", input.accountName);
    form.set("contactEmail", input.contactEmail);
    if (input.promptpayId) form.set("promptpayId", input.promptpayId);
    if (input.bankName) form.set("bankName", input.bankName);
    if (input.bankAccountNumber) form.set("bankAccountNumber", input.bankAccountNumber);
    form.set("proof", input.proof);
    return request<WithdrawalResult>("/affiliate/withdrawals", { method: "POST", body: form });
  },
  cancelWithdrawal: (id) => request<{ wallet: AffiliateWallet }>(`/affiliate/withdrawals/${id}/cancel`, { method: "POST", body: {} }),
};

export function claimAffiliateReferral(code: string): Promise<ClaimReferralResult> {
  return request<ClaimReferralResult>("/affiliate/referral", { method: "POST", body: { code } });
}

export function getAdminAffiliateSettings(): Promise<AffiliateSettings> {
  return request<AffiliateSettings>("/admin/affiliate/settings");
}

export function updateAdminAffiliateSettings(input: Partial<AffiliateSettings>): Promise<AffiliateSettings> {
  return request<AffiliateSettings>("/admin/affiliate/settings", { method: "PATCH", body: input });
}

export type AffiliateSort = "member" | "code" | "invited" | "topups" | "commission" | "joined" | "status";

export function listAdminAffiliates(input: { q?: string; status?: AffiliateStatus | "all"; page?: number; limit?: number; sort?: AffiliateSort; order?: "asc" | "desc" } = {}): Promise<AdminAffiliateList> {
  const params = new URLSearchParams();
  if (input.q?.trim()) params.set("q", input.q.trim());
  if (input.status && input.status !== "all") params.set("status", input.status);
  params.set("page", String(input.page ?? 1));
  params.set("limit", String(input.limit ?? 25));
  if (input.sort) params.set("sort", input.sort);
  if (input.order) params.set("order", input.order);
  return request<AdminAffiliateList>(`/admin/affiliate/affiliates?${params.toString()}`);
}

export function updateAdminAffiliateStatus(affiliateId: string, status: AffiliateStatus): Promise<{ id: string; status: AffiliateStatus }> {
  return request<{ id: string; status: AffiliateStatus }>(`/admin/affiliate/affiliates/${affiliateId}`, { method: "PATCH", body: { status } });
}

export function listAdminWithdrawals(input: { status?: WithdrawalStatus | "all"; page?: number; limit?: number } = {}): Promise<AdminWithdrawalList> {
  const params = new URLSearchParams();
  if (input.status && input.status !== "all") params.set("status", input.status);
  params.set("page", String(input.page ?? 1));
  params.set("limit", String(input.limit ?? 25));
  return request<AdminWithdrawalList>(`/admin/affiliate/withdrawals?${params.toString()}`);
}

/** Marks a request paid (after the transfer was made by hand) or rejects it. A rejection needs a reason, which the member sees. */
export function reviewAdminWithdrawal(id: string, input: { action: "pay" | "reject"; note?: string; reference?: string }): Promise<AdminWithdrawal> {
  return request<AdminWithdrawal>(`/admin/affiliate/withdrawals/${id}`, { method: "PATCH", body: input });
}
