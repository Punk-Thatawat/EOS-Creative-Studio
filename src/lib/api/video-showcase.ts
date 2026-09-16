import { getApiAccessToken } from "@/lib/auth/access-token";

const configuredBackendUrl = (process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000").replace(/\/+$/, "");
const backendApiUrl = `${configuredBackendUrl.replace(/\/api\/v1$/, "")}/api/v1`;
const maxVideoBytes = 500 * 1024 * 1024;
const videoExtensions = ["mp4", "webm", "mov", "m4v", "ogv"] as const;

export type VideoShowcaseExample = {
  id: string;
  label: string;
  videoUrl: string | null;
  videoStorageKey: string | null;
  mimeType: string;
  sizeBytes: number | null;
  sortOrder: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type UploadedVideoShowcase = {
  storageKey: string;
  videoUrl: string | null;
  mimeType: string;
  sizeBytes: number;
};

export type LandingIntroVideo = {
  videoUrl: string | null;
  videoStorageKey: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  enabled: boolean;
  updatedAt: string | null;
};

export type UploadedLandingIntroVideo = {
  storageKey: string;
  videoUrl: string | null;
  mimeType: string;
  sizeBytes: number;
};

async function getErrorMessage(response: Response): Promise<string> {
  const payload = await response.json().catch(() => null) as { message?: string } | null;
  return payload?.message ?? "Video showcase request failed";
}

async function adminRequest(path: string, init: RequestInit = {}): Promise<unknown> {
  const accessToken = await getApiAccessToken();
  if (!accessToken) throw new Error("Please sign in as an admin");
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

export async function listPublicVideoShowcase(): Promise<VideoShowcaseExample[]> {
  const response = await fetch("/api/video-showcase", { headers: { Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(await getErrorMessage(response));
  const payload = await response.json() as { data?: { videos?: VideoShowcaseExample[] } };
  return payload.data?.videos ?? [];
}

export async function listPublicLandingIntroVideo(): Promise<LandingIntroVideo> {
  const response = await fetch("/api/video-showcase/landing-intro", { headers: { Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(await getErrorMessage(response));
  const payload = await response.json() as { data?: { video?: LandingIntroVideo } };
  return payload.data?.video ?? { videoUrl: null, videoStorageKey: null, mimeType: null, sizeBytes: null, enabled: false, updatedAt: null };
}

export async function listAdminVideoShowcase(): Promise<VideoShowcaseExample[]> {
  const payload = await adminRequest("/admin/video-showcase") as { data?: { videos?: VideoShowcaseExample[] } };
  return payload.data?.videos ?? [];
}

export function validateVideoShowcaseFile(file: File): string | null {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const mimeType = file.type.toLowerCase();
  const supportedMime = ["video/mp4", "video/webm", "video/quicktime", "video/x-m4v", "video/ogg"].includes(mimeType);
  if (!(supportedMime || videoExtensions.includes(extension as typeof videoExtensions[number]))) return "Please choose an MP4, WebM, MOV, M4V, or OGV video.";
  if (file.size <= 0) return "The selected video is empty.";
  if (file.size > maxVideoBytes) return "Showcase videos must be 500 MB or smaller.";
  return null;
}

export async function uploadAdminVideoShowcase(file: File): Promise<UploadedVideoShowcase> {
  const validationError = validateVideoShowcaseFile(file);
  if (validationError) throw new Error(validationError);
  const accessToken = await getApiAccessToken();
  if (!accessToken) throw new Error("Please sign in as an admin");
  const formData = new FormData();
  formData.append("file", file, file.name);
  const response = await fetch(`${backendApiUrl}/admin/video-showcase/upload`, { method: "POST", headers: { Accept: "application/json", Authorization: `Bearer ${accessToken}` }, body: formData, cache: "no-store" });
  if (!response.ok) throw new Error(await getErrorMessage(response));
  const payload = await response.json().catch(() => null) as { data?: UploadedVideoShowcase } | null;
  if (!payload?.data?.storageKey) throw new Error("Video upload returned an invalid response");
  return payload.data;
}

export async function listAdminLandingIntroVideo(): Promise<LandingIntroVideo> {
  const payload = await adminRequest("/admin/video-showcase/landing-intro") as { data?: { video?: LandingIntroVideo } };
  return payload.data?.video ?? { videoUrl: null, videoStorageKey: null, mimeType: null, sizeBytes: null, enabled: false, updatedAt: null };
}

export async function uploadAdminLandingIntroVideo(file: File): Promise<UploadedLandingIntroVideo> {
  const validationError = validateVideoShowcaseFile(file);
  if (validationError) throw new Error(validationError.replace("Showcase videos", "Landing intro videos"));
  const accessToken = await getApiAccessToken();
  if (!accessToken) throw new Error("Please sign in as an admin");
  const formData = new FormData();
  formData.append("file", file, file.name);
  const response = await fetch(`${backendApiUrl}/admin/video-showcase/landing-intro/upload`, { method: "POST", headers: { Accept: "application/json", Authorization: `Bearer ${accessToken}` }, body: formData, cache: "no-store" });
  if (!response.ok) throw new Error(await getErrorMessage(response));
  const payload = await response.json().catch(() => null) as { data?: UploadedLandingIntroVideo } | null;
  if (!payload?.data?.storageKey) throw new Error("Landing intro upload returned an invalid response");
  return payload.data;
}

export async function deleteAdminLandingIntroUpload(storageKey: string): Promise<void> {
  await adminRequest(`/admin/video-showcase/landing-intro/upload?storageKey=${encodeURIComponent(storageKey)}`, { method: "DELETE" });
}

export async function saveAdminLandingIntroVideo(input: { storageKey?: string | null; videoUrl?: string | null; sizeBytes?: number | null; enabled?: boolean }): Promise<LandingIntroVideo> {
  const payload = await adminRequest("/admin/video-showcase/landing-intro", { method: "PATCH", body: JSON.stringify(input) }) as { data?: { video?: LandingIntroVideo } };
  if (!payload.data?.video) throw new Error("Landing intro video could not be saved");
  return payload.data.video;
}

export async function removeAdminLandingIntroVideo(): Promise<void> {
  await adminRequest("/admin/video-showcase/landing-intro", { method: "DELETE" });
}

export async function deleteAdminVideoShowcaseUpload(storageKey: string): Promise<void> {
  await adminRequest(`/admin/video-showcase/upload?storageKey=${encodeURIComponent(storageKey)}`, { method: "DELETE" });
}

export async function createAdminVideoShowcase(input: { label: string; storageKey?: string; videoUrl?: string; sizeBytes?: number; sortOrder?: number; enabled?: boolean }): Promise<VideoShowcaseExample> {
  const payload = await adminRequest("/admin/video-showcase", { method: "POST", body: JSON.stringify(input) }) as { data?: VideoShowcaseExample };
  if (!payload.data) throw new Error("Video showcase item could not be created");
  return payload.data;
}

export async function updateAdminVideoShowcase(id: string, input: Partial<{ label: string; storageKey: string; videoUrl: string; sizeBytes: number; sortOrder: number; enabled: boolean }>): Promise<VideoShowcaseExample> {
  const payload = await adminRequest(`/admin/video-showcase/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(input) }) as { data?: VideoShowcaseExample };
  if (!payload.data) throw new Error("Video showcase item could not be updated");
  return payload.data;
}

export async function deleteAdminVideoShowcase(id: string): Promise<void> {
  await adminRequest(`/admin/video-showcase/${encodeURIComponent(id)}`, { method: "DELETE" });
}
