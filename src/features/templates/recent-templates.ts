import { type CreativeTemplate as Template } from "@/lib/api/templates";

const RECENT_KEY = "eos.templates.recent";

export function readRecent(): Template[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as Template[]).filter((t) => t && typeof t.id === "string") : [];
  } catch {
    return [];
  }
}

export function clearRecent() {
  try {
    window.localStorage.removeItem(RECENT_KEY);
  } catch {
    // Ignore storage restrictions.
  }
}

/** Failed or cancelled workflow runs the visitor removed from the list (the server keeps no way to delete a run). */
export const DISMISSED_RUNS_KEY = "eos.templates.dismissedRuns";

export function readDismissedRuns(): string[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(DISMISSED_RUNS_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function rememberTemplate(t: Template): Template[] {
  const next = [t, ...readRecent().filter((x) => x.id !== t.id)].slice(0, 12);
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage restrictions; the template still opens.
  }
  return next;
}
