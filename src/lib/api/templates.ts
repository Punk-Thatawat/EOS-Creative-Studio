import { getApiAccessToken } from "@/lib/auth/access-token";

export type TemplateKind = "image" | "video" | "audio" | "document";

export type CreativeTemplate = {
  settings?: Record<string, unknown>;
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  kind: TemplateKind;
  format: string;
  thumbnailUrl: string;
  previewUrl?: string;
  targetPath: string;
  prompt: string;
  tags: string[];
  featured: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AdminCreativeTemplate = CreativeTemplate & {
  enabled: boolean;
  sortOrder: number;
};

export type TemplatePagination = { page: number; limit: number; total: number; totalPages: number };
type TemplatesPayload = { data?: { templates?: CreativeTemplate[]; categories?: string[]; pagination?: TemplatePagination } };

async function getErrorMessage(response: Response): Promise<string> {
  const payload = await response.json().catch(() => null) as { message?: string } | null;
  return payload?.message ?? "Template request failed";
}

export async function listTemplates(options: { search?: string; category?: string; kind?: TemplateKind | "all"; limit?: number; page?: number; sort?: "recommended" | "newest"; signal?: AbortSignal } = {}): Promise<{ templates: CreativeTemplate[]; categories: string[]; pagination?: TemplatePagination }> {
  const params = new URLSearchParams();
  if (options.search?.trim()) params.set("q", options.search.trim());
  if (options.category && options.category !== "all") params.set("category", options.category);
  if (options.kind && options.kind !== "all") params.set("kind", options.kind);
  if (options.limit) params.set("limit", String(options.limit));
  if (options.page) params.set("page", String(options.page));
  if (options.sort) params.set("sort", options.sort);
  const response = await fetch(`/api/templates${params.toString() ? `?${params.toString()}` : ""}`, { headers: { Accept: "application/json" }, cache: "no-store", signal: options.signal ?? AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(await getErrorMessage(response));
  const payload = await response.json() as TemplatesPayload;
  return { templates: payload.data?.templates ?? [], categories: payload.data?.categories ?? [], pagination: payload.data?.pagination };
}

export async function getTemplate(slug: string): Promise<CreativeTemplate> {
  const response = await fetch(`/api/templates/${encodeURIComponent(slug)}`, { headers: { Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(await getErrorMessage(response));
  const payload = await response.json() as { data?: CreativeTemplate };
  if (!payload.data) throw new Error("Template not found");
  return payload.data;
}

async function adminRequest(path: string, init: RequestInit = {}): Promise<unknown> {
  const accessToken = await getApiAccessToken();
  if (!accessToken) throw new Error("Please sign in as an admin");
  const response = await fetch(`${(process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000").replace(/\/+$/, "").replace(/\/api\/v1$/, "")}/api/v1${path}`, {
    ...init,
    headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${accessToken}`, ...(init.headers ?? {}) },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null) as { data?: unknown; message?: string } | null;
  if (!response.ok) throw new Error(payload?.message ?? "Template admin request failed");
  return payload?.data;
}

export type TemplateAdminInput = {
  settings?: Record<string, unknown>;
  previewUrl?: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  kind: TemplateKind;
  format: string;
  thumbnailUrl: string;
  targetPath: string;
  prompt: string;
  tags: string[];
  featured: boolean;
  enabled: boolean;
  sortOrder: number;
};

export async function listAdminTemplates(): Promise<AdminCreativeTemplate[]> {
  const payload = await adminRequest("/admin/templates") as AdminCreativeTemplate[] | undefined;
  return payload ?? [];
}

export async function createAdminTemplate(input: TemplateAdminInput): Promise<AdminCreativeTemplate> {
  const payload = await adminRequest("/admin/templates", { method: "POST", body: JSON.stringify(input) }) as AdminCreativeTemplate | undefined;
  if (!payload) throw new Error("Template could not be created");
  return payload;
}

export async function updateAdminTemplate(id: string, input: Partial<TemplateAdminInput>): Promise<AdminCreativeTemplate> {
  const payload = await adminRequest(`/admin/templates/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(input) }) as AdminCreativeTemplate | undefined;
  if (!payload) throw new Error("Template could not be updated");
  return payload;
}

export async function deleteAdminTemplate(id: string): Promise<void> {
  await adminRequest(`/admin/templates/${encodeURIComponent(id)}`, { method: "DELETE" });
}
