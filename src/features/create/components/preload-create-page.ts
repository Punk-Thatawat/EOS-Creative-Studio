import type { GenerationKind } from "../types/generation";

// Keep the page imports in one small helper so navigation can start loading the
// destination bundle before the click. The dynamic page imports use these same
// module paths, so the browser/Next module cache can reuse the work.
const pageLoaders: Record<GenerationKind, () => Promise<unknown>> = {
  image: () => import("../image-generation/components/image-generation-page"),
  video: () => import("../video-generation-page"),
  audio: () => import("../audio-generation/components/audio-generation-page"),
};

const preloadPromises = new Map<GenerationKind, Promise<unknown>>();

export function preloadCreatePage(kind: GenerationKind) {
  if (typeof window === "undefined" || preloadPromises.has(kind)) return;

  const promise = pageLoaders[kind]().catch((error) => {
    // A transient failed preload should not permanently prevent a later retry.
    preloadPromises.delete(kind);
    throw error;
  });

  preloadPromises.set(kind, promise);
  void promise.catch(() => undefined);
}
