"use client";

import { getApiAccessToken } from "@/lib/auth/access-token";

const configuredBackendUrl = (process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000").replace(/\/+$/, "");
const backendApiUrl = `${configuredBackendUrl.replace(/\/api\/v1$/, "")}/api/v1`;

async function request(path: string, method: string): Promise<unknown> {
  const accessToken = await getApiAccessToken();
  if (!accessToken) throw new Error("Please sign in to like a template");
  const response = await fetch(`${backendApiUrl}${path}`, {
    method,
    headers: { Accept: "application/json", Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => null)) as { data?: unknown; message?: string } | null;
  if (!response.ok) throw new Error(payload?.message ?? "Template like request failed");
  return payload?.data;
}

/** The slugs of the templates this person liked. */
export async function listMyTemplateLikes(): Promise<string[]> {
  const data = await request("/template-likes", "GET");
  return Array.isArray(data) ? data.filter((slug): slug is string => typeof slug === "string") : [];
}

/** Likes or un-likes a template; answers with the new state and the template's like count. */
export async function setTemplateLike(slug: string, liked: boolean): Promise<{ liked: boolean; likeCount: number }> {
  const data = (await request(`/template-likes/${encodeURIComponent(slug)}`, liked ? "PUT" : "DELETE")) as { liked?: boolean; likeCount?: number } | undefined;
  return { liked: data?.liked ?? liked, likeCount: Number(data?.likeCount ?? 0) };
}
