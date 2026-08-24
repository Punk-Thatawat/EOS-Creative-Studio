"use client";

import { getApiAccessToken } from "@/lib/auth/access-token";
import { detectMediaUploadKind, friendlyUploadError, validateMediaFile, type ImageUploadConstraints } from "@/lib/media/upload-validation";

const configuredBackendUrl = (
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000"
).replace(/\/+$/, "");
const backendOrigin = configuredBackendUrl.replace(/\/api\/v1$/, "");
const backendApiUrl = `${backendOrigin}/api/v1`;

type UploadImageOptions = {
  purpose: "content" | "style-reference" | "background-reference" | "mask";
  feature:
    | "image-to-image"
    | "ai-style-transfer"
    | "background-removal"
    | "upscale"
    | "extend-image"
    | "image-to-video"
    | "text-to-video"
    | "motion-transfer";
  workspaceId?: string | null;
  uploadConstraints?: ImageUploadConstraints;
};

function fileExtension(file: File): string {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension && /^[a-z0-9]+$/.test(extension)) return extension;
  return file.type === "image/png"
    ? "png"
    : file.type === "image/webp"
      ? "webp"
      : file.type === "video/mp4"
        ? "mp4"
        : file.type === "video/webm"
          ? "webm"
          : file.type === "audio/mpeg"
            ? "mp3"
            : file.type === "audio/wav" || file.type === "audio/x-wav"
              ? "wav"
              : file.type === "audio/mp4"
                ? "m4a"
                : "jpg";
}

export async function uploadImageAsset(
  file: File,
  options: UploadImageOptions,
): Promise<string> {
  void options;
  const mediaKind = detectMediaUploadKind(file);
  const validationError = await validateMediaFile(file, mediaKind, options.uploadConstraints);
  if (validationError) throw new Error(validationError);
  const accessToken = await getApiAccessToken();
  if (!accessToken) throw new Error("Please sign in before uploading an image");

  // The provider key stays server-side. The backend forwards the file to
  // WaveSpeed and returns its temporary download URL.
  const formData = new FormData();
  formData.append(
    "file",
    file,
    `${crypto.randomUUID()}.${fileExtension(file)}`,
  );
  const response = await fetch(`${backendApiUrl}/media/upload`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: formData,
  });
  const payload = (await response.json().catch(() => null)) as {
    data?: { url?: unknown };
    message?: unknown;
  } | null;
  if (!response.ok) {
    const message = Array.isArray(payload?.message)
      ? payload.message.join(", ")
      : typeof payload?.message === "string"
        ? payload.message
        : "Unable to upload image to WaveSpeed";
    throw new Error(friendlyUploadError(message, "Unable to upload image to WaveSpeed"));
  }
  const url = payload?.data?.url;
  if (typeof url !== "string" || !url)
    throw new Error("WaveSpeed did not return an image URL");
  return url;
}

export async function uploadMaskAsset(
  maskDataUrl: string,
  workspaceId?: string | null,
): Promise<string> {
  const response = await fetch(maskDataUrl);
  if (!response.ok) throw new Error("Unable to prepare the mask image");
  const blob = await response.blob();
  const file = new File([blob], `mask-${crypto.randomUUID()}.png`, {
    type: "image/png",
  });
  return uploadImageAsset(file, {
    purpose: "mask",
    feature: "background-removal",
    workspaceId,
  });
}
