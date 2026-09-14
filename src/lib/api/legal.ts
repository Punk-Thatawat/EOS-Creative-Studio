import { getApiAccessToken } from "@/lib/auth/access-token";

const configuredBackendUrl = (process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000").replace(/\/+$/, "");
const backendApiUrl = `${configuredBackendUrl.replace(/\/api\/v1$/, "")}/api/v1`;

export type LegalSlug = "cookies" | "privacy" | "terms-of-use" | "creators-community-terms" | "business-subscription-terms";

export type LegalDocumentSection = {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
};

export type AdminLegalDocument = {
  slug: LegalSlug;
  title: string;
  shortTitle: string;
  description: string;
  effectiveDate: string;
  draftNote?: string;
  sections: LegalDocumentSection[];
  published: boolean;
  updatedAt?: string;
};

export type AdminCookiePolicy = AdminLegalDocument & { slug: "cookies" };

type ApiPayload<T> = { data?: T; message?: string };

async function adminRequest(path: string, init: RequestInit = {}): Promise<unknown> {
  const accessToken = await getApiAccessToken();
  if (!accessToken) throw new Error("Please sign in as an admin");
  const response = await fetch(`${backendApiUrl}${path}`, {
    ...init,
    headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${accessToken}`, ...(init.headers ?? {}) },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null) as ApiPayload<unknown> | null;
  if (!response.ok) throw new Error(payload?.message ?? "Legal policy request failed");
  return payload?.data;
}

export async function getAdminLegalDocument(slug: LegalSlug): Promise<AdminLegalDocument> {
  const policy = await adminRequest(`/admin/legal/${encodeURIComponent(slug)}`) as AdminLegalDocument | undefined;
  if (!policy) throw new Error("Legal document could not be loaded");
  return policy;
}

export async function updateAdminLegalDocument(slug: LegalSlug, input: Omit<AdminLegalDocument, "slug" | "updatedAt">): Promise<AdminLegalDocument> {
  const policy = await adminRequest(`/admin/legal/${encodeURIComponent(slug)}`, { method: "PATCH", body: JSON.stringify(input) }) as AdminLegalDocument | undefined;
  if (!policy) throw new Error("Legal document could not be saved");
  return policy;
}

export async function getAdminCookiePolicy(): Promise<AdminCookiePolicy> {
  return await getAdminLegalDocument("cookies") as AdminCookiePolicy;
}

export async function updateAdminCookiePolicy(input: Omit<AdminCookiePolicy, "slug" | "updatedAt">): Promise<AdminCookiePolicy> {
  return await updateAdminLegalDocument("cookies", input) as AdminCookiePolicy;
}
