/** The current output wins; selecting an older history entry must not redefine latest. */
export function latestVideoResult(currentVideoUrl: string | null, history: readonly { url: string }[]): string | null {
  return currentVideoUrl || history[0]?.url || null;
}
