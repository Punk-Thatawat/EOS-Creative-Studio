"use client";

import { getApiAccessToken } from "@/lib/auth/access-token";

const backendUrl = (process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000")
  .replace(/\/+$/, "")
  .replace(/\/api\/v1$/, "");
const REQUEST_TIMEOUT_MS = 15000;

export type AffiliateStatus = "active" | "suspended";

export type AffiliateSettings = {
  /** The whole program: off means no new links and no new commissions of either kind. */
  enabled: boolean;
  /** The percent of the credits an invited member tops up. */
  commissionPercent: number;
  topupEnabled: boolean;
  /** Whether successful creations earn a commission (only after the member has topped up at least once). */
  usageEnabled: boolean;
  /** The percent of the credits an invited member spends on a creation that succeeds. */
  usageCommissionPercent: number;
};

export type AffiliateStats = {
  invitedCount: number;
  topupCount: number;
  topupAmountThb: number;
  topupCredits: number;
  /** Everything earned, from top-ups and from usage together. */
  commissionCredits: number;
  topupCommissionCredits: number;
  usageCommissionCredits: number;
};

export type AffiliateReferral = {
  /** The invited member, already masked by the server (j***@gmail.com). */
  member: string;
  joinedAt: string;
  topupCount: number;
  topupAmountThb: number;
  commissionCredits: number;
};

export type AffiliateOverview = {
  settings: AffiliateSettings;
  affiliate: { id: string; code: string; status: AffiliateStatus; createdAt: string } | null;
  stats: AffiliateStats;
  referrals: AffiliateReferral[];
};

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
  commissionCredits: number;
};

export type AdminAffiliateList = { affiliates: AdminAffiliate[]; total: number; page: number; limit: number };

export type AffiliateApi = {
  load(): Promise<AffiliateOverview>;
  create(): Promise<NonNullable<AffiliateOverview["affiliate"]>>;
};

type ErrorPayload = { message?: unknown; errorMessage?: unknown } | null;

async function request<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const accessToken = await getApiAccessToken();
  if (!accessToken) throw new Error("Session expired");
  let response: Response;
  try {
    response = await fetch(`${backendUrl}/api/v1${path}`, {
      method: init.method ?? "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
        ...(init.body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      credentials: "include",
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
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
