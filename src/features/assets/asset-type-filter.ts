export function selectAssetType<T extends string>(type: T, activeTag: string | null): { type: T; tag: string | null } {
  return { type, tag: type === "All Types" ? null : activeTag };
}

export function isAssetTypeSelected(type: string, activeType: string, activeTag: string | null): boolean {
  return type === activeType && (type !== "All Types" || activeTag === null);
}
