import { getApiAccessToken } from "@/lib/auth/access-token";

const configuredBackendUrl = (process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000").replace(/\/+$/, "");
const backendOrigin = configuredBackendUrl.replace(/\/api\/v1$/, "");
const backendApiUrl = `${backendOrigin}/api/v1`;

export const promptTemplateFeatureOptions = ["text-to-image", "image-to-image", "style-transfer", "background-remove", "background-replace", "background-generate", "background-solid", "extend-image"] as const;
export type PromptTemplateFeature = typeof promptTemplateFeatureOptions[number];

export type PromptTemplate = {
  feature: PromptTemplateFeature;
  name: string;
  prompt: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

async function request(path: string, init: RequestInit = {}): Promise<unknown> {
  const accessToken = await getApiAccessToken();
  if (!accessToken) throw new Error("Please sign in");
  const response = await fetch(`${backendApiUrl}${path}`, {
    ...init,
    headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${accessToken}`, ...(init.headers ?? {}) },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null) as { data?: unknown; message?: string } | null;
  if (!response.ok) throw new Error(payload?.message ?? "Prompt template request failed");
  return payload?.data;
}

export async function listAdminPromptTemplates(): Promise<PromptTemplate[]> {
  return (await request("/admin/prompt-templates") as PromptTemplate[] | undefined) ?? [];
}

export async function updateAdminPromptTemplate(feature: PromptTemplateFeature, input: { prompt: string; enabled: boolean }): Promise<PromptTemplate> {
  return await request(`/admin/prompt-templates/${encodeURIComponent(feature)}`, { method: "PATCH", body: JSON.stringify(input) }) as PromptTemplate;
}
