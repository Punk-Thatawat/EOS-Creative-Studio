// These names are reserved and automatically assigned by the assets API.
const SYSTEM_FOLDERS = new Set(["image", "videos", "voice", "document"]);

export function isSystemAssetFolder(name: string | null | undefined): boolean {
  return name != null && SYSTEM_FOLDERS.has(name.trim().toLowerCase());
}

export function isUnfiledAssetFolder(name: string | null | undefined): boolean {
  return !name || isSystemAssetFolder(name);
}
