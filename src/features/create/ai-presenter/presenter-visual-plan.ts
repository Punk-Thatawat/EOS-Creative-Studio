export type PresenterDirectionPlan = { opening: string; continuation: string };

/** Select a plan for this logical scene; never carry another scene's direction over. */
export function presenterDirectionForChunk(originalDirection: string, plan: PresenterDirectionPlan | undefined, continuesPreviousChunk: boolean): string {
  if (!plan) return originalDirection;
  return continuesPreviousChunk ? plan.continuation : plan.opening;
}
