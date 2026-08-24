export type MediaUploadKind = "image" | "video" | "audio";

export type ImageUploadConstraints = {
  maxBytes?: number;
  maxFileSizeBytes?: number;
  maxWidth?: number;
  maxHeight?: number;
};

export const IMAGE_UPLOAD_CONSTRAINTS = {
  maxBytes: 10 * 1024 * 1024,
} as const;

export const MEDIA_UPLOAD_MAX_BYTES = 25 * 1024 * 1024;

/**
 * Known provider limits that are safe to enforce before upload. Most model
 * records do not expose input pixel limits yet, so an unknown model is only
 * checked for file type and size and the provider error is handled later.
 */
export function getKnownImageUploadConstraints(model?: string | null): ImageUploadConstraints {
  const normalizedModel = model?.trim().toLowerCase() ?? "";
  if (normalizedModel.includes("bytedance/uso") || normalizedModel.includes("minimax/image-01/image-to-image")) {
    return { maxWidth: 2048, maxHeight: 2048 };
  }
  return {};
}

export function imageUploadHint(constraints: ImageUploadConstraints = {}): string {
  const dimensions = constraints.maxWidth && constraints.maxHeight
    ? ` · max ${constraints.maxWidth} × ${constraints.maxHeight}`
    : "";
  const maxBytes = constraints.maxBytes ?? constraints.maxFileSizeBytes ?? IMAGE_UPLOAD_CONSTRAINTS.maxBytes;
  return `${dimensions} · ${formatBytes(maxBytes)}`;
}

const imageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const videoTypes = new Set(["video/mp4", "video/webm", "video/quicktime"]);
const audioTypes = new Set([
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
  "audio/mp4",
  "audio/aac",
  "audio/ogg",
  "audio/webm",
]);

function fileExtension(file: File): string {
  return file.name.split(".").pop()?.toLowerCase() ?? "";
}

function hasSupportedType(file: File, kind: MediaUploadKind): boolean {
  if (kind === "image") return imageTypes.has(file.type.toLowerCase()) || ["jpg", "jpeg", "png", "webp"].includes(fileExtension(file));
  if (kind === "video") return videoTypes.has(file.type.toLowerCase()) || ["mp4", "webm", "mov", "m4v"].includes(fileExtension(file));
  return audioTypes.has(file.type.toLowerCase()) || ["mp3", "wav", "wave", "m4a", "aac", "ogg", "oga"].includes(fileExtension(file));
}

export function detectMediaUploadKind(file: File): MediaUploadKind {
  const type = file.type.toLowerCase();
  const extension = fileExtension(file);
  if (type.startsWith("video/") || ["mp4", "webm", "mov", "m4v"].includes(extension)) return "video";
  if (type.startsWith("audio/") || ["mp3", "wav", "wave", "m4a", "aac", "ogg", "oga"].includes(extension)) return "audio";
  return "image";
}

function kindLabel(kind: MediaUploadKind): string {
  return kind === "image" ? "image" : kind;
}

function formatBytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return `${mb >= 10 ? Math.round(mb) : mb.toFixed(1).replace(/\.0$/, "")} MB`;
}

function supportedFormats(kind: MediaUploadKind): string {
  if (kind === "image") return "JPG, PNG, or WebP";
  if (kind === "video") return "MP4 or WebM";
  return "MP3, WAV, or M4A";
}

async function imageDimensions(file: File): Promise<{ width: number; height: number }> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file);
    try {
      return { width: bitmap.width, height: bitmap.height };
    } finally {
      bitmap.close();
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("The image could not be read."));
    });
    return { width: image.naturalWidth, height: image.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function validateMediaFile(file: File, kind: MediaUploadKind, constraints: ImageUploadConstraints = {}): Promise<string | null> {
  if (!hasSupportedType(file, kind)) {
    return `Please choose a ${supportedFormats(kind)} ${kindLabel(kind)}.`;
  }

  const maxBytes = constraints.maxBytes ?? constraints.maxFileSizeBytes ?? (kind === "image" ? IMAGE_UPLOAD_CONSTRAINTS.maxBytes : MEDIA_UPLOAD_MAX_BYTES);
  if (file.size > maxBytes) {
    return `This ${kindLabel(kind)} is too large. Maximum file size is ${formatBytes(maxBytes)}.`;
  }

  if (kind !== "image") return null;

  const maxWidth = constraints.maxWidth;
  const maxHeight = constraints.maxHeight;
  if (typeof maxWidth !== "number" && typeof maxHeight !== "number") return null;
  try {
    const { width, height } = await imageDimensions(file);
    if ((typeof maxWidth === "number" && width > maxWidth) || (typeof maxHeight === "number" && height > maxHeight)) {
      const maxDimensions = `${maxWidth ?? "any"} × ${maxHeight ?? "any"}`;
      return `This image is too large. Maximum dimensions are ${maxDimensions} px. This file is ${width} × ${height} px. Please resize it and try again.`;
    }
  } catch {
    return "This image could not be read. Please choose a valid JPG, PNG, or WebP file.";
  }

  return null;
}

export function friendlyUploadError(error: unknown, fallback = "We could not upload this file. Please try again."): string {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  const message = raw.replace(/^msg\s*=\s*["']?/, "").replace(/["']?\s*,?\s*type\s*=.*$/i, "").trim();
  const dimensions = message.match(/maximum dimensions are\s+(\d+)\s*[x×]\s*(\d+)/i);
  if (dimensions) {
    return `This image is too large. Maximum dimensions are ${dimensions[1]} × ${dimensions[2]} px. Please resize it and try again.`;
  }
  if (/image_too_large|dimensions are too large|image is too large/i.test(message)) {
    return "This image is too large for the selected model. Please resize it and try again.";
  }
  if (/file too large|entity too large|payload too large|maximum.*(size|bytes)/i.test(message)) {
    return `This file is too large. The maximum upload size is ${formatBytes(MEDIA_UPLOAD_MAX_BYTES)}.`;
  }
  if (/bucket not found|storage.*not configured|unable to upload/i.test(message)) {
    return "Upload storage is temporarily unavailable. Please try again in a moment.";
  }
  if (/unsupported.*(file|media|format)|only supported/i.test(message)) {
    return "This file format is not supported. Please choose a supported image, video, or audio file.";
  }
  return message || fallback;
}
