"use client";

import type { ActiveJob, RecentProject } from "@/features/home/types/home";
import { getApiAccessToken } from "@/lib/auth/access-token";

const configuredBackendUrl = (process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000").replace(/\/+$/, "");
const backendApiUrl = `${configuredBackendUrl.replace(/\/api\/v1$/, "")}/api/v1`;

export type HomeCredits = {
  available: number;
  reserved: number;
  usedPercent: number;
  plan: string;
  renewal: string | null;
  allowance: number;
  walletValueThb: number;
};

export type HomeDashboard = {
  recentProjects: RecentProject[];
  activeJobs: ActiveJob[];
  recentJobs: ActiveJob[];
  credits: HomeCredits;
  generatedAt: string;
};

type BackendPayload<T> = { data?: T; message?: string };

async function backendRequest<T>(path: string): Promise<T> {
  const accessToken = await getApiAccessToken();
  if (!accessToken) throw new Error("Please sign in to view your home dashboard");

  const response = await fetch(`${backendApiUrl}${path}`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    credentials: "include",
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null) as BackendPayload<T> | null;
  if (!response.ok) throw new Error(payload?.message ?? "Unable to load home dashboard");
  if (!payload?.data) throw new Error("Home dashboard response was empty");
  return payload.data;
}

let cachedDashboard: { value: HomeDashboard; expiresAt: number } | null = null;
let pendingRequest: Promise<HomeDashboard> | null = null;

export function fetchHomeDashboard(options: { force?: boolean } = {}): Promise<HomeDashboard> {
  const now = Date.now();
  if (!options.force && cachedDashboard && cachedDashboard.expiresAt > now) return Promise.resolve(cachedDashboard.value);
  if (pendingRequest) return pendingRequest;

  pendingRequest = backendRequest<HomeDashboard>("/users/me/home")
    .then((dashboard) => {
      cachedDashboard = { value: dashboard, expiresAt: Date.now() + 15_000 };
      return dashboard;
    })
    .finally(() => {
      pendingRequest = null;
    });

  return pendingRequest;
}

export function clearHomeDashboardCache(): void {
  cachedDashboard = null;
}
