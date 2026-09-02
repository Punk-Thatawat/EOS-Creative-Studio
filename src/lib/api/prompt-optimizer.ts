"use client";

import { getApiAccessToken } from "@/lib/auth/access-token";

const configuredBackendUrl = (process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000").replace(/\/+$/, "");
const backendApiUrl = `${configuredBackendUrl.replace(/\/api\/v1$/, "")}/api/v1`;

export const promptOptimizerStyles = [
  "default",
  "artistic",
  "photographic",
  "technical",
  "anime",
  "realistic",
] as const;

export type PromptOptimizerStyle = (typeof promptOptimizerStyles)[number];

export type PromptOptimizerInput = {
  image?: string | null;
  text: string;
  style: PromptOptimizerStyle;
  mode: "image" | "video";
};

export type PromptOptimizerResponse = {
  id: string;
  model: string;
  status: "completed";
  optimizedPrompt: string;
};

export async function optimizePrompt(input: PromptOptimizerInput): Promise<PromptOptimizerResponse> {
  const accessToken = await getApiAccessToken();
  if (!accessToken) throw new Error("Please sign in before optimizing a prompt");

  const response = await fetch(`${backendApiUrl}/prompt-optimizer`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      text: input.text,
      style: input.style,
      mode: input.mode,
      ...(input.image ? { image: input.image } : {}),
    }),
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null) as {
    data?: unknown;
    message?: unknown;
  } | null;
  if (!response.ok) {
    const message = Array.isArray(payload?.message)
      ? payload.message.join(", ")
      : typeof payload?.message === "string"
        ? payload.message
        : "Prompt optimization failed";
    throw new Error(message);
  }

  const result = payload?.data ?? payload;
  if (!result || typeof result !== "object" || typeof (result as { optimizedPrompt?: unknown }).optimizedPrompt !== "string") {
    throw new Error("Prompt optimizer returned an invalid response");
  }
  return result as PromptOptimizerResponse;
}

