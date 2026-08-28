import { getApiAccessToken } from "@/lib/auth/access-token";

const configuredBackendUrl = (process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000").replace(/\/+$/, "");
const backendApiUrl = `${configuredBackendUrl.replace(/\/api\/v1$/, "")}/api/v1`;

export type AdminVideoStoryboardSettings = {
  maxScenes: number;
  hardMaxScenes: number;
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

export async function updateAdminVideoStoryboardSettings(maxScenes: number): Promise<AdminVideoStoryboardSettings> {
  return await adminRequest("/admin/video-settings/storyboard", {
    method: "PATCH",
    body: JSON.stringify({ maxScenes }),
  }) as AdminVideoStoryboardSettings;
}
