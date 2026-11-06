export const DOCUMENT_ZOOM_LEVELS = Array.from({ length: 12 }, (_, index) => (index + 1) * 25);

export function nextDocumentZoom(value: number, direction: "in" | "out") {
  return direction === "in"
    ? Math.min(300, (Math.floor(value / 25) + 1) * 25)
    : Math.max(25, (Math.ceil(value / 25) - 1) * 25);
}

export function documentZoomLevels(value: number) {
  return DOCUMENT_ZOOM_LEVELS.includes(value)
    ? DOCUMENT_ZOOM_LEVELS
    : [...DOCUMENT_ZOOM_LEVELS, value].sort((a, b) => a - b);
}
