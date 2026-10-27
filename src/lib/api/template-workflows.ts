"use client";

import { getApiAccessToken } from "@/lib/auth/access-token";
import { generationErrorFromPayload } from "@/lib/api/generation-errors";

const configuredBackendUrl = (process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000").replace(/\/+$/, "");
const backendApiUrl = `${configuredBackendUrl.replace(/\/api\/v1$/, "")}/api/v1`;

/** The feature name that marks a template as an image -> video workflow. */
export const workflowFeature = "workflow-image-to-video";

export type TemplateWorkflowStep = {
  type: "image" | "video";
  status: "pending" | "running" | "completed" | "failed";
  model: string;
  outputUrl?: string;
  error?: string;
};

export type TemplateWorkflowRun = {
  id: string;
  templateSlug: string;
  status: "running" | "completed" | "failed" | "cancelled";
  prompt: string;
  /** The step being worked on, counted from 1. */
  currentStep: number;
  steps: TemplateWorkflowStep[];
  resultUrl?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
};

export type StartTemplateWorkflowInput = {
  templateSlug: string;
  prompt: string;
  image: { model: string; resolution?: string; ratio?: string };
  video: { model: string; resolution?: string; duration?: number; aspectRatio?: string };
};

async function request(path: string, init: RequestInit = {}): Promise<unknown> {
  const accessToken = await getApiAccessToken();
  if (!accessToken) throw new Error("Please sign in before starting a workflow");
  const response = await fetch(`${backendApiUrl}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) throw generationErrorFromPayload(payload, "Workflow request failed");
  return payload && typeof payload === "object" && "data" in payload ? (payload as { data: unknown }).data : payload;
}

export async function startTemplateWorkflow(input: StartTemplateWorkflowInput, signal?: AbortSignal): Promise<TemplateWorkflowRun> {
  return (await request("/template-workflows", { method: "POST", body: JSON.stringify(input), signal })) as TemplateWorkflowRun;
}

/** Stops a run: the step in progress is cancelled and the next steps never start. */
export async function cancelTemplateWorkflow(id: string): Promise<TemplateWorkflowRun> {
  return (await request(`/template-workflows/${encodeURIComponent(id)}/cancel`, { method: "POST" })) as TemplateWorkflowRun;
}

export async function listTemplateWorkflows(limit = 12, signal?: AbortSignal): Promise<TemplateWorkflowRun[]> {
  return ((await request(`/template-workflows?limit=${limit}`, { signal })) as TemplateWorkflowRun[] | undefined) ?? [];
}
