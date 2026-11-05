import type { HistoryItem, HistoryResponse } from "@/lib/api/history";

type FetchPage = (input: { type: "video"; status: "completed"; recentOnly: true; limit: number; offset: number; signal: AbortSignal }) => Promise<HistoryResponse>;

export function presenterHistoryKey(item: Pick<HistoryItem, "source" | "id">): string {
  return `${item.source}:${item.id}`;
}

export async function loadPresenterHistory(fetchPage: FetchPage, signal: AbortSignal): Promise<HistoryItem[]> {
  const found: HistoryItem[] = [];
  const seen = new Set<string>();
  let offset = 0;
  let hasMore = true;
  while (hasMore && offset < 100 && found.length < 12) {
    const page = await fetchPage({ type: "video", status: "completed", recentOnly: true, limit: 50, offset, signal });
    signal.throwIfAborted();
    for (const item of page.items) {
      const key = presenterHistoryKey(item);
      if (item.feature !== "ai-presenter-video" || item.mediaKind !== "video" || item.status !== "completed" || !item.outputUrl?.trim() || seen.has(key)) continue;
      seen.add(key);
      found.push(item);
    }
    hasMore = page.pagination.hasMore && page.items.length > 0;
    offset += page.items.length;
  }
  return found.slice(0, 12);
}

export function presenterPreviewUrl(view: "scene" | "latest" | "library", finalUrl: string, history: HistoryItem[], selectedKey: string | null): string {
  if (view === "scene") return "";
  if (view === "latest") return finalUrl || history[0]?.outputUrl || "";
  const selected = selectedKey ? history.find((item) => presenterHistoryKey(item) === selectedKey) : history[0];
  return selected?.outputUrl || "";
}
