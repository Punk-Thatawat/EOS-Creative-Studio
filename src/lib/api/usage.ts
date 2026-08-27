"use client";

import { getApiAccessToken } from "@/lib/auth/access-token";

const configuredBackendUrl = (process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000").replace(/\/+$/, "");
const backendApiUrl = `${configuredBackendUrl.replace(/\/api\/v1$/, "")}/api/v1`;

export type UsagePeriodKey = "current" | "previous";
export type UsageTrend = "daily" | "weekly";

export type UsageDashboard = {
  period: { key: UsagePeriodKey; startAt: string; endAt: string; label: string; isCurrent: boolean; source: string };
  billing: BillingSnapshot;
  plan: {
    name: string | null;
    cycle: string | null;
    creditsPerCycle: number | null;
    renewsAt: string | null;
    currency: string | null;
    status: string;
    cancelAtPeriodEnd: boolean;
    source: string;
  };
  summary: {
    totalCredits: number;
    creditsUsed: number;
    creditsRemaining: number;
    creditsAdded: number;
    planCredits: number;
    usedPercent: number;
    remainingPercent: number;
    walletValueThb: number;
    walletUpdatedAt: string | null;
    transactionCount: number;
  };
  usageByTool: {
    items: Array<{ key: string; label: string; description: string; credits: number; percent: number }>;
    totalUsed: number;
  };
  trend: {
    granularity: UsageTrend;
    points: Array<{ date: string; label: string; credits: number }>;
    averageCredits: number;
    peakCredits: number;
    peakAt: string | null;
  };
  recentActivity: {
    items: Array<{
      id: string;
      transactionType: string;
      title: string;
      subtitle: string;
      amount: number;
      balanceAfter: number;
      referenceType: string | null;
      referenceId: string | null;
      metadata: Record<string, unknown>;
      createdAt: string;
    }>;
    pagination: { limit: number; offset: number; total: number; hasMore: boolean };
  };
  generatedAt: string;
};

export type BillingSnapshot = {
  provider: "stripe";
  status: string;
  customerId: string | null;
  subscriptionId: string | null;
  subscriptionStatus: string | null;
  planName: string | null;
  priceId: string | null;
  creditsPerCycle: number | null;
  currency: string | null;
  unitAmount: number | null;
  interval: string | null;
  intervalCount: number | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
};

export type CreditTopupPackage = {
  id: string;
  credits: number;
  amountThb: number;
  label: string;
  featured?: boolean;
};

export type CheckoutCatalog = {
  provider: "stripe";
  promptPay: boolean;
  topups: CreditTopupPackage[];
};

async function backendRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const accessToken = await getApiAccessToken();
  if (!accessToken) throw new Error("Please sign in to view usage and billing");

  const response = await fetch(`${backendApiUrl}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...(init.headers ?? {}),
    },
    credentials: "include",
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null) as { data?: T; message?: string } | null;
  if (!response.ok) throw new Error(payload?.message ?? "Backend request failed");
  return payload?.data as T;
}

export function fetchUsageDashboard(period: UsagePeriodKey, trend: UsageTrend): Promise<UsageDashboard> {
  const params = new URLSearchParams({ period, trend, activityLimit: "5" });
  return backendRequest<UsageDashboard>(`/users/me/usage?${params.toString()}`);
}

export function fetchBilling(): Promise<BillingSnapshot> {
  return backendRequest<BillingSnapshot>("/users/me/billing");
}

export function fetchCheckoutCatalog(): Promise<CheckoutCatalog> {
  return backendRequest<CheckoutCatalog>("/users/me/billing/catalog");
}

export function createBillingPortalSession(): Promise<{ id: string; url: string; customerId: string }> {
  return backendRequest<{ id: string; url: string; customerId: string }>("/users/me/billing/portal-session", { method: "POST" });
}

export function createCreditCheckoutSession(packageId: string): Promise<{ id: string; url: string; customerId: string }> {
  return backendRequest<{ id: string; url: string; customerId: string }>("/users/me/billing/checkout-session", {
    method: "POST",
    body: JSON.stringify({ packageId, mode: "payment" }),
  });
}
