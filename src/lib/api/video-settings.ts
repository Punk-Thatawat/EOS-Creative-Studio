import { getApiAccessToken } from "@/lib/auth/access-token";

export type VideoStoryboardModeKey = "image-to-video" | "reference-to-video" | "single-image" | "multi-scene" | "continuous";
export const defaultVideoStoryboardModeLabels: Record<VideoStoryboardModeKey, string> = {
  "image-to-video": "Image to Video",
  "reference-to-video": "Reference to Video",
  "single-image": "Single Storyboard Image",
  "multi-scene": "Multi-Scene Storyboard",
  continuous: "Continuous",
};

const configuredBackendUrl = (process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000").replace(/\/+$/, "");
const backendApiUrl = `${configuredBackendUrl.replace(/\/api\/v1$/, "")}/api/v1`;

export type AdminVideoStoryboardSettings = {
  maxScenes: number;
  hardMaxScenes: number;
  modeLabels: Record<VideoStoryboardModeKey, string>;
  updatedAt?: string;
};

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
  const payload = await response.json().catch(() => null) as { data?: unknown; message?: string } | null;
  if (!response.ok) throw new Error(payload?.message ?? "Admin video settings operation failed");
  return payload?.data ?? payload;
}

export async function getAdminVideoStoryboardSettings(): Promise<AdminVideoStoryboardSettings> {
  return await adminRequest("/admin/video-settings/storyboard") as AdminVideoStoryboardSettings;
}

export async function updateAdminVideoStoryboardSettings(maxScenes: number, modeLabels?: Partial<Record<VideoStoryboardModeKey, string>>): Promise<AdminVideoStoryboardSettings> {
  return await adminRequest("/admin/video-settings/storyboard", {
    method: "PATCH",
    body: JSON.stringify({ maxScenes, ...(modeLabels ? { modeLabels } : {}) }),
  }) as AdminVideoStoryboardSettings;
}
