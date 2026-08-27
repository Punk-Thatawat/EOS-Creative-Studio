import { getApiAccessToken } from "@/lib/auth/access-token";
import { validateMediaFile } from "@/lib/media/upload-validation";

const configuredBackendUrl = (process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000").replace(/\/+$/, "");
const backendOrigin = configuredBackendUrl.replace(/\/api\/v1$/, "");
const backendApiUrl = `${backendOrigin}/api/v1`;

export const stylePresetFeatureOptions = ["text-to-image", "image-to-image", "background-removal", "style-transfer"] as const;
export type StylePresetFeature = typeof stylePresetFeatureOptions[number];

export type GenerationStylePreset = {
  id: string;
  slug: string;
  name: string;
  prompt: string;
  imageUrl: string | null;
  imageStorageKey?: string | null;
  features: StylePresetFeature[];
  enabled: boolean;
  sortOrder: number;
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
  if (!response.ok) throw new Error(payload?.message ?? "Style preset request failed");
  return payload?.data;
}

export async function listStylePresets(feature?: StylePresetFeature): Promise<GenerationStylePreset[]> {
  const query = feature ? `?feature=${encodeURIComponent(feature)}` : "";
  return (await request(`/generation-style-presets${query}`) as GenerationStylePreset[] | undefined) ?? [];
}

export async function listAdminStylePresets(feature?: StylePresetFeature): Promise<GenerationStylePreset[]> {
  const query = feature ? `?feature=${encodeURIComponent(feature)}` : "";
  return (await request(`/admin/style-presets${query}`) as GenerationStylePreset[] | undefined) ?? [];
}

export type SaveStylePresetInput = {
  slug?: string;
  name: string;
  prompt: string;
  imageUrl?: string;
  imageStorageKey?: string;
  features: StylePresetFeature[];
  enabled?: boolean;
  sortOrder?: number;
};

export type UploadedStylePresetImage = {
  storageKey: string;
  previewUrl: string | null;
  mimeType: string;
};

export async function uploadAdminStylePresetImage(file: File): Promise<UploadedStylePresetImage> {
  const validationError = await validateMediaFile(file, "image", { maxBytes: 10 * 1024 * 1024 });
  if (validationError) throw new Error(validationError);
  const accessToken = await getApiAccessToken();
  if (!accessToken) throw new Error("Please sign in as an admin");
  const formData = new FormData();
  formData.append("file", file, file.name);
  const response = await fetch(`${backendApiUrl}/admin/style-presets/upload`, {
    method: "POST",
    headers: { Accept: "application/json", Authorization: `Bearer ${accessToken}` },
    body: formData,
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null) as { data?: UploadedStylePresetImage; message?: string } | null;
  if (!response.ok) throw new Error(payload?.message ?? "Unable to upload style preset image");
  if (!payload?.data?.storageKey) throw new Error("Style preset upload returned an invalid response");
  return payload.data;
}

export async function deleteAdminStylePresetImage(storageKey: string): Promise<void> {
  await request(`/admin/style-presets/upload?storageKey=${encodeURIComponent(storageKey)}`, { method: "DELETE" });
}

export async function createAdminStylePreset(input: SaveStylePresetInput): Promise<GenerationStylePreset> {
  return await request("/admin/style-presets", { method: "POST", body: JSON.stringify(input) }) as GenerationStylePreset;
}

export async function updateAdminStylePreset(id: string, input: Partial<SaveStylePresetInput>): Promise<GenerationStylePreset> {
  return await request(`/admin/style-presets/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(input) }) as GenerationStylePreset;
}

export async function disableAdminStylePreset(id: string): Promise<GenerationStylePreset> {
  return await request(`/admin/style-presets/${encodeURIComponent(id)}`, { method: "DELETE" }) as GenerationStylePreset;
}
