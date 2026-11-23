
// The look a video is given: EOS's own presets, or an image the visitor uploads. Custom ones are kept in this browser for now.
export type StyleChoice = { id: string; name: string; imageUrl: string };

/**
 * A name a person can read for a style made from an uploaded image. A file saved from the web is often named by a random id
 * (a long run of letters and digits, or a UUID), which says nothing, so those become the plain default.
 */
export function styleNameFromFile(fileName: string, untitled: string): string {
  const base = fileName.replace(/\.[^.]+$/, "").trim();
  const looksGenerated = !/\s/.test(base) && (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(base) || (base.length >= 20 && /^[A-Za-z0-9_-]+$/.test(base) && /\d/.test(base) && /[A-Za-z]/.test(base)));
  return !base || looksGenerated ? untitled : base.slice(0, 40);
}

const customStylesKey = "eos.templates.custom-styles";

export function readCustomStyles(): StyleChoice[] {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(customStylesKey) ?? "[]");
    return Array.isArray(value)
      ? value.filter((item): item is StyleChoice => !!item && typeof item.id === "string" && typeof item.name === "string" && typeof item.imageUrl === "string")
      : [];
  } catch {
    return [];
  }
}

export function saveCustomStyles(list: StyleChoice[]) {
  try {
    window.localStorage.setItem(customStylesKey, JSON.stringify(list.slice(0, 50)));
  } catch {
    // The style still works for this visit.
  }
}
