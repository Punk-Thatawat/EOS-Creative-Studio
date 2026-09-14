const modelCatalogChangedEvent = "eos:model-catalog-changed";
const modelCatalogUpdatedStorageKey = "eos.model-catalog.updated-at";

export function emitModelCatalogChanged(): void {
  if (typeof window === "undefined") return;

  window.dispatchEvent(new Event(modelCatalogChangedEvent));

  try {
    window.localStorage.setItem(modelCatalogUpdatedStorageKey, String(Date.now()));
  } catch {
    // The in-tab event still works when browser storage is unavailable.
  }
}

export function subscribeToModelCatalogChanges(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  const handleEvent = () => listener();
  const handleStorage = (event: StorageEvent) => {
    if (event.key === modelCatalogUpdatedStorageKey) listener();
  };

  window.addEventListener(modelCatalogChangedEvent, handleEvent);
  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener(modelCatalogChangedEvent, handleEvent);
    window.removeEventListener("storage", handleStorage);
  };
}
