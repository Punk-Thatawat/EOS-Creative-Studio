"use client";

import { getApiAccessToken } from "@/lib/auth/access-token";

const configuredBackendUrl = (process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000").replace(/\/+$/, "");
const backendApiUrl = `${configuredBackendUrl.replace(/\/api\/v1$/, "")}/api/v1`;

export type AdminMemberRole = "user" | "admin";
export type AdminMemberStatus = "active" | "suspended";
export type AdminMember = {
  id: string;
  email: string;
  username?: string;
  displayName?: string;
  avatarUrl?: string;
  role: AdminMemberRole;
  status: AdminMemberStatus;
  emailConfirmed: boolean;
  creditBalance: number;
  permissions: string[];
  lastSeenAt?: string;
  createdAt: string;
};

export type AdminMembersResponse = {
  members: AdminMember[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
};

async function adminRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const accessToken = await getApiAccessToken();
  if (!accessToken) throw new Error("Please sign in as an admin");
  const response = await fetch(`${backendApiUrl}${path}`, {
    ...init,
    headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${accessToken}`, ...(init.headers ?? {}) },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null) as { data?: T; message?: string | string[] } | null;
  if (!response.ok) {
    const message = Array.isArray(payload?.message) ? payload.message.join(", ") : payload?.message;
    throw new Error(message ?? "Member management operation failed");
  }
  return payload?.data as T;
}

export async function listAdminMembers(input: { q?: string; role?: AdminMemberRole | "all"; status?: AdminMemberStatus | "all"; page?: number; limit?: number } = {}) {
  const params = new URLSearchParams();
  if (input.q?.trim()) params.set("q", input.q.trim());
  if (input.role && input.role !== "all") params.set("role", input.role);
  if (input.status && input.status !== "all") params.set("status", input.status);
  params.set("page", String(input.page ?? 1));
  params.set("limit", String(input.limit ?? 25));
  return adminRequest<AdminMembersResponse>(`/admin/members?${params.toString()}`);
}

export async function updateAdminMember(id: string, input: { role?: AdminMemberRole; status?: AdminMemberStatus }) {
  return adminRequest<AdminMember>(`/admin/members/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(input) });
}

export async function grantAdminMemberCredits(id: string, input: { credits: number; reason?: string; idempotencyKey: string }) {
  return adminRequest<{ memberId: string; creditsAdded: number; balance: number; transaction: unknown }>(`/admin/members/${encodeURIComponent(id)}/credits`, { method: "POST", body: JSON.stringify(input) });
}
