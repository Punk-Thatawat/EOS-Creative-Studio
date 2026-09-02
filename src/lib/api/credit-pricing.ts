"use client";

import { getApiAccessToken } from "@/lib/auth/access-token";

const configuredBackendUrl = (process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000").replace(/\/+$/, "");
const backendApiUrl = `${configuredBackendUrl.replace(/\/api\/v1$/, "")}/api/v1`;

export type CreditPricingDefaults = {
  creditValueThb: number;
  exchangeRateThbPerUsd: number;
  targetMargin: number;
  fixedCostThb: number;
  smartEnhancePriceThb: number;
  roundingDecimals: number;
  minimumCreditCost: number;
  pricingVersion: string;
  exchangeRateSource?: string;
  exchangeRateObservedAt?: string | null;
  exchangeRateFetchedAt?: string;
  exchangeRateStale?: boolean;
};

export type CreditPricingRule = {
  id: string;
  provider: string;
  model: string;
  featureKey: string | null;
  targetMargin: number;
  fixedCostThb: number;
  minimumCreditCost: number;
  promptAddons: Record<string, Record<string, number>>;
  enabled: boolean;
  pricingVersion: string;
  createdAt: string;
  updatedAt: string;
};

export type CreditPricingSettings = {
  defaults: CreditPricingDefaults;
  rules: CreditPricingRule[];
};

export type SignupCreditGrantSettings = {
  enabled: boolean;
  credits: number;
  updatedAt?: string;
};

export type CreditPricingPreview = {
  provider: string;
  model: string;
  featureKey: string | null;
  status: "ready" | "unavailable";
  providerCostUsd?: number;
  providerCostThb?: number;
  costCredits?: number;
  creditCost?: number;
  sellingPriceThb?: number;
  profitCredits?: number;
  profitThb?: number;
  promptAddonThb?: number;
  promptAddonCredits?: number;
  smartEnhancePriceThb?: number;
  smartEnhancePriceCredits?: number;
  pricingSource?: string;
  pricingVersion?: string;
  message?: string;
};

export type UpsertCreditPricingRuleInput = {
  provider: string;
  model: string;
  featureKey?: string | null;
  targetMargin: number;
  fixedCostThb?: number;
  minimumCreditCost?: number;
  promptAddons?: Record<string, Record<string, number>>;
  enabled?: boolean;
};

export type UpsertCreditPricingDefaultsInput = {
  targetMargin: number;
  fixedCostThb?: number;
  smartEnhancePriceThb?: number;
  minimumCreditCost?: number;
};

async function adminRequest(path: string, init: RequestInit = {}): Promise<unknown> {
  const accessToken = await getApiAccessToken();
  if (!accessToken) throw new Error("Please sign in as an admin");
  const response = await fetch(`${backendApiUrl}${path}`, {
    ...init,
    headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${accessToken}`, ...(init.headers ?? {}) },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null) as { data?: unknown; message?: string } | null;
  if (!response.ok) throw new Error(payload?.message ?? "Admin credit pricing operation failed");
  return payload?.data;
}

export async function listAdminCreditPricingRules(): Promise<CreditPricingSettings> {
  return await adminRequest("/admin/credit-pricing-rules") as CreditPricingSettings;
}

export async function upsertAdminCreditPricingRule(input: UpsertCreditPricingRuleInput): Promise<CreditPricingRule> {
  return await adminRequest("/admin/credit-pricing-rules", { method: "PATCH", body: JSON.stringify(input) }) as CreditPricingRule;
}

export async function upsertAdminCreditPricingDefaults(input: UpsertCreditPricingDefaultsInput): Promise<CreditPricingDefaults> {
  return await adminRequest("/admin/credit-pricing-rules/defaults", { method: "PATCH", body: JSON.stringify(input) }) as CreditPricingDefaults;
}

export async function previewAdminCreditPricingRules(models: Array<{ provider: string; model: string; featureKey?: string; input?: Record<string, unknown> }>): Promise<CreditPricingPreview[]> {
  return await adminRequest("/admin/credit-pricing-rules/preview", { method: "POST", body: JSON.stringify({ models }) }) as CreditPricingPreview[];
}

export async function getAdminSignupCreditGrant(): Promise<SignupCreditGrantSettings> {
  return await adminRequest("/admin/signup-credit-grant") as SignupCreditGrantSettings;
}

export async function updateAdminSignupCreditGrant(input: { enabled: boolean; credits: number }): Promise<SignupCreditGrantSettings> {
  return await adminRequest("/admin/signup-credit-grant", { method: "PATCH", body: JSON.stringify(input) }) as SignupCreditGrantSettings;
}
