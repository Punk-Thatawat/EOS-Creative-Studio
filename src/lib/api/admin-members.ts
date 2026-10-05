"use client";

import { getApiAccessToken } from "@/lib/auth/access-token";
import type { HistoryResponse, HistoryStatus, HistoryType } from "@/lib/api/history";

const configuredBackendUrl = (process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000").replace(/\/+$/, "");
const backendApiUrl = `${configuredBackendUrl.replace(/\/api\/v1$/, "")}/api/v1`;

export type AdminMemberRole = "user" | "admin";
export type AdminMemberStatus = "active" | "suspended";
export type QuickPlaybookType = "creator" | "marketing" | "agency" | "sme_owner" | "corporate" | "beginner" | "ai_power_user";
export type InviteAdminMemberInput = { email: string; role: AdminMemberRole; display_name?: string; recipient_name?: string; test_start_date: string; test_end_date: string; quick_playbooks: QuickPlaybookType[]; initial_credits?: number };
export type AdminMember = {
  id: string;
  email: string;
  username?: string;
  displayName?: string;
  avatarUrl?: string;
  role: AdminMemberRole;
  status: AdminMemberStatus;
  emailConfirmed: boolean;
  invitationPending?: boolean;
  quickPlaybookTypes?: QuickPlaybookType[];
  quickPlaybookType?: QuickPlaybookType;
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

export async function fetchAdminMemberHistory(id: string, input: { search?: string; type?: HistoryType; status?: HistoryStatus; offset?: number; limit?: number; signal?: AbortSignal } = {}) {
  const params = new URLSearchParams();
  if (input.search?.trim()) params.set("search", input.search.trim());
  if (input.type && input.type !== "all") params.set("type", input.type);
  if (input.status && input.status !== "all") params.set("status", input.status);
  params.set("offset", String(input.offset ?? 0));
  params.set("limit", String(input.limit ?? 24));
  return adminRequest<HistoryResponse>(`/admin/members/${encodeURIComponent(id)}/history?${params.toString()}`, { signal: input.signal });
}

export async function inviteAdminMember(input: InviteAdminMemberInput) {
  return adminRequest<{ sent: boolean; userId: string; email: string; initialCreditsAdded: number | null }>("/admin/members/invite", { method: "POST", body: JSON.stringify(input) });
}

export async function updateAdminMember(id: string, input: { role?: AdminMemberRole; status?: AdminMemberStatus }) {
  return adminRequest<AdminMember>(`/admin/members/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(input) });
}

export async function resendAdminMemberInvitation(id: string, input: { quick_playbooks: QuickPlaybookType[] }) {
  return adminRequest<{ sent: boolean; email: string }>(`/admin/members/${encodeURIComponent(id)}/resend-invitation`, { method: "POST", body: JSON.stringify(input) });
}

export async function grantAdminMemberCredits(id: string, input: { credits: number; reason?: string; idempotencyKey: string }) {
  return adminRequest<{ memberId: string; creditsAdded: number; balance: number; transaction: unknown }>(`/admin/members/${encodeURIComponent(id)}/credits`, { method: "POST", body: JSON.stringify(input) });
}
