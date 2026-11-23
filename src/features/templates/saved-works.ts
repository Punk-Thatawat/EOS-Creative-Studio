import { type CreativeTemplate as Template } from "@/lib/api/templates";
import { type HistoryItem } from "@/lib/api/history";

/**
 * Turns one finished video into a template of the library: its prompt and settings, the clip as the preview and the creator tab
 * of the feature that made it. The cover is optional; without one the mode's stock cover stands in. Creating templates needs the
 * admin role, so anyone else gets the server's refusal as the message.
 */
/** The address of the template made from a clip, so a clip that already became a template can be recognised. */
export const favoriteWorksKey = "eos.templates.favorite-works";

export function readFavoriteWorks(): Set<string> {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(favoriteWorksKey) ?? "[]");
    return new Set(Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : []);
  } catch {
    return new Set();
  }
}

/** A clip of the member's own, shaped like a template so the details panel can show it. Its id says it is not a library template. */
export const WORK_ID = "mine:";

/** Sent by the details of a member's clip to save it as a template (or to use it, once saved); the clip list answers it. */
export const WORK_TEMPLATE_EVENT = "eos:work-template";

export function templateOfWork(item: HistoryItem, saved = false): Template {
  const settings = item.settings ?? {};
  return {
    id: `${WORK_ID}${item.id}`,
    slug: workSlug(item.id),
    title: item.title,
    description: item.prompt ?? "",
    category: "Video",
    kind: "video",
    format: "Video",
    thumbnailUrl: "",
    previewUrl: item.outputUrl,
    targetPath: "",
    prompt: item.prompt ?? "",
    tags: [],
    featured: false,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    settings: { ...settings, ...(item.model && !settings.model ? { model: item.model } : {}), ...(item.durationSeconds && !settings.duration ? { duration: item.durationSeconds } : {}), ...(saved ? { savedAsTemplate: true } : {}) },
  };
}

export const workSlug = (id: string) => `work-${id.replace(/[^a-zA-Z0-9-]/g, "-").toLowerCase()}`.slice(0, 80);
