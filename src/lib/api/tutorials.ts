import { getApiAccessToken } from "@/lib/auth/access-token";

const configuredBackendUrl = (process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000").replace(/\/+$/, "");
const backendApiUrl = `${configuredBackendUrl.replace(/\/api\/v1$/, "")}/api/v1`;
const MAX_TUTORIAL_BYTES = 500 * 1024 * 1024;
const tutorialExtensions = ["mp4", "webm", "mov", "m4v", "ogv"] as const;

export type AdminTutorialSlot = {
  id: string | null;
  feature: string;
  featureName: string;
  mode: string | null;
  modeName: string | null;
  title: string | null;
  description: string | null;
  videoUrl: string | null;
  videoStorageKey: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  enabled: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

export type UploadedAdminTutorial = {
  storageKey: string;
  videoUrl: string | null;
  mimeType: string;
  sizeBytes: number;
};

async function getErrorMessage(response: Response): Promise<string> {
  const payload = await response.json().catch(() => null) as { message?: string } | null;
  return payload?.message ?? "Tutorial video request failed";
}

async function authenticatedJsonRequest(path: string, init: RequestInit = {}): Promise<unknown> {
  const accessToken = await getApiAccessToken();
  if (!accessToken) throw new Error("Please sign in to view tutorials");
  const response = await fetch(`${backendApiUrl}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(await getErrorMessage(response));
  return response.json();
}

async function adminJsonRequest(path: string, init: RequestInit = {}): Promise<unknown> {
  return authenticatedJsonRequest(path, init);
}

export async function listPublicTutorials(feature: string): Promise<AdminTutorialSlot[]> {
  const payload = await authenticatedJsonRequest(`/tutorials?feature=${encodeURIComponent(feature)}`) as { data?: { tutorials?: AdminTutorialSlot[] } };
  return payload.data?.tutorials ?? [];
}

export async function listAdminTutorials(feature?: string): Promise<AdminTutorialSlot[]> {
  const query = feature ? `?feature=${encodeURIComponent(feature)}` : "";
  const payload = await adminJsonRequest(`/admin/tutorials${query}`) as { data?: { tutorials?: AdminTutorialSlot[] } };
  return payload.data?.tutorials ?? [];
}

export function validateTutorialVideo(file: File): string | null {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const isSupported = file.type.toLowerCase().startsWith("video/") && ["video/mp4", "video/webm", "video/quicktime", "video/x-m4v", "video/ogg"].includes(file.type.toLowerCase())
    || tutorialExtensions.includes(extension as typeof tutorialExtensions[number]);
  if (!isSupported) return "Please choose an MP4, WebM, MOV, M4V, or OGV video.";
  if (file.size <= 0) return "The selected video is empty.";
  if (file.size > MAX_TUTORIAL_BYTES) return "Tutorial videos must be 500 MB or smaller.";
  return null;
}

export async function uploadAdminTutorial(file: File): Promise<UploadedAdminTutorial> {
  const validationError = validateTutorialVideo(file);
  if (validationError) throw new Error(validationError);
  const accessToken = await getApiAccessToken();
  if (!accessToken) throw new Error("Please sign in as an admin");
  const formData = new FormData();
  formData.append("file", file, file.name);
  const response = await fetch(`${backendApiUrl}/admin/tutorials/upload`, {
    method: "POST",
    headers: { Accept: "application/json", Authorization: `Bearer ${accessToken}` },
    body: formData,
    cache: "no-store",
  });
  if (!response.ok) throw new Error(await getErrorMessage(response));
  const payload = await response.json().catch(() => null) as { data?: UploadedAdminTutorial } | null;
  if (!payload?.data?.storageKey) throw new Error("Tutorial upload returned an invalid response");
  return payload.data;
}

export async function saveAdminTutorial(feature: string, input: { mode?: string; storageKey: string; sizeBytes?: number; title?: string; description?: string; enabled?: boolean }): Promise<AdminTutorialSlot> {
  const payload = await adminJsonRequest(`/admin/tutorials/${encodeURIComponent(feature)}`, {
    method: "PUT",
    body: JSON.stringify(input),
  }) as { data?: AdminTutorialSlot };
  if (!payload.data) throw new Error("Tutorial save returned an invalid response");
  return payload.data;
}

export async function deleteAdminTutorialUpload(storageKey: string): Promise<void> {
  await adminJsonRequest(`/admin/tutorials/upload?storageKey=${encodeURIComponent(storageKey)}`, { method: "DELETE" });
}

export async function deleteAdminTutorial(feature: string, mode?: string): Promise<void> {
  const query = mode ? `?mode=${encodeURIComponent(mode)}` : "";
  await adminJsonRequest(`/admin/tutorials/${encodeURIComponent(feature)}${query}`, { method: "DELETE" });
}
