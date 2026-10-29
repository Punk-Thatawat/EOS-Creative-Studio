"use client";

import { getApiAccessToken } from "@/lib/auth/access-token";
import type { GenerationModelOption } from "@/lib/api/generation-models";

export type TemplateModelMode = "create" | "motion";

export type TemplateModelSetting = {
  mode: TemplateModelMode;
  /** The model the Templates page starts with; null leaves it to the feature's own default. */
  defaultModel: string | null;
  /** The models it offers; empty means every enabled model of the feature. */
  visibleModels: string[];
  updatedAt?: string;
};

const backendApiUrl = `${(process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000").replace(/\/+$/, "").replace(/\/api\/v1$/, "")}/api/v1`;

async function request(path: string, init: RequestInit = {}): Promise<unknown> {
  const accessToken = await getApiAccessToken();
  if (!accessToken) throw new Error("Please sign in");
  const response = await fetch(`${backendApiUrl}${path}`, {
    ...init,
    headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${accessToken}`, ...(init.headers ?? {}) },
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => null)) as { data?: unknown; message?: string } | null;
  if (!response.ok) throw new Error(payload?.message ?? "Template model settings request failed");
  return payload?.data;
}

function asList(data: unknown): TemplateModelSetting[] {
  return Array.isArray(data) ? (data as TemplateModelSetting[]) : [];
}

let cached: Promise<TemplateModelSetting[]> | null = null;

/** What the public Templates page offers per mode. Asked once per visit; a failure means "no limits". */
export function loadTemplateModelSettings(): Promise<TemplateModelSetting[]> {
  cached ??= request("/template-model-settings").then(asList).catch(() => {
    cached = null;
    return [];
  });
  return cached;
}

export async function listAdminTemplateModelSettings(): Promise<TemplateModelSetting[]> {
  return asList(await request("/admin/template-model-settings"));
}

export async function updateAdminTemplateModelSetting(
  mode: TemplateModelMode,
  input: { defaultModel?: string | null; visibleModels?: string[] },
): Promise<TemplateModelSetting> {
  cached = null;
  return (await request(`/admin/template-model-settings/${mode}`, { method: "PUT", body: JSON.stringify(input) })) as TemplateModelSetting;
}

/** The models of a feature for the Templates page: the feature's own plus the ones Admin offers only here. */
export async function listTemplateGenerationModels(feature: string): Promise<GenerationModelOption[]> {
  const data = await request(`/generation-models?feature=${encodeURIComponent(feature)}&scope=templates`);
  return Array.isArray(data) ? (data as GenerationModelOption[]) : [];
}
