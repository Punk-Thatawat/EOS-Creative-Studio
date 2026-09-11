"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, ChevronDown, ChevronUp, Clock3, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { listGenerationHistory, resumeGeneration, type GenerationHistoryItem, type GenerationProgress, type PendingGeneration } from "@/lib/api/generations";
import { emitGenerationCompleted } from "@/lib/generation-progress-events";
import { getDismissedProgressStorageKey, getGenerationProgressStorageKey } from "@/lib/generation-progress-storage";
import { useHydrated } from "@/components/app-shell/use-hydrated";
import { useLocale, type TranslationKey } from "@/lib/i18n/locale-provider";
import styles from "./generation-progress-floating.module.css";

const generationLabelKeys: Record<string, TranslationKey> = {
  "text-to-image": "create.image.tabs.textToImage",
  "image-to-image": "create.image.tabs.imageToImage",
  "style-transfer": "create.image.tabs.styleTransfer",
  "background-removal": "create.image.tabs.aiBackground",
  upscale: "create.image.tabs.upscale",
  "extend-image": "create.image.tabs.extendImage",
  "image-to-video": "create.video.tabs.imageToVideo",
  "text-to-video": "create.video.tabs.textToVideo",
  "people-video": "create.video.tabs.peopleVideo",
  "motion-transfer": "create.video.tabs.motionTransfer",
  lipsync: "create.video.tabs.lipsync",
  "extend-video": "create.video.tabs.extendVideo",
};

const generationFeatureOptions = [
  { feature: "text-to-image", key: "eos.generation.pending", label: "Text to Image", tab: "text-to-image", kind: "image" },
  { feature: "image-to-image", key: "eos.generation.pending.image-to-image", label: "Image to Image", tab: "image-to-image", kind: "image" },
  { feature: "style-transfer", key: "eos.generation.pending.style-transfer", label: "Style Transfer", tab: "style-transfer", kind: "image" },
  { feature: "background-removal", key: "eos.generation.pending.background-removal", label: "Background", tab: "background-removal", kind: "image" },
  { feature: "upscale", key: "eos.generation.pending.upscale", label: "Upscale", tab: "upscale", kind: "image" },
  { feature: "extend-image", key: "eos.generation.pending.extend-image", label: "Extend Image", tab: "extend-image", kind: "image" },
  { feature: "image-to-video", key: "eos.generation.pending.image-to-video", label: "Image to Video", tab: "image-to-video", kind: "video" },
  { feature: "text-to-video", key: "eos.generation.pending.text-to-video", label: "Text to Video", tab: "text-to-video", kind: "video" },
  { feature: "people-video", key: "eos.generation.pending.people-video", label: "People Video", tab: "people-video", kind: "video" },
  { feature: "motion-transfer", key: "eos.generation.pending.motion-transfer", label: "Motion Transfer", tab: "motion-transfer", kind: "video" },
  { feature: "lipsync", key: "eos.generation.pending.lipsync", label: "Lipsync", tab: "lipsync", kind: "video" },
  { feature: "extend-video", key: "eos.generation.pending.extend-video", label: "Extend Video", tab: "extend-video", kind: "video" },
] as const;

type ActivePendingGeneration = {
  key: string;
  feature: string;
  label: string;
  tab: string;
  kind: "image" | "video";
  pending: PendingGeneration;
};

function featureConfig(feature?: string) {
  return generationFeatureOptions.find((item) => item.feature === feature) ?? {
    feature: feature ?? "image-generation",
    key: `eos.generation.pending.${feature ?? "image-generation"}`,
    label: "Image Generation",
    tab: feature ?? "text-to-image",
    kind: "image",
  };
}

function toPendingGeneration(generation: GenerationHistoryItem): ActivePendingGeneration | null {
  if (generation.status !== "queued" && generation.status !== "processing") return null;
  if (!generation.id) return null;

  // Image-to-video storyboards have one parent progress record (the
  // storyboard) and one generation record per scene. The parent is already
  // persisted by the create flow, so do not add the scene records again or
  // the floating card will double-count scenes.
  const storyboardId = generation.input?.storyboard_id ?? generation.input?.storyboardId;
  if (typeof storyboardId === "string" && storyboardId.trim()) return null;

  const config = featureConfig(generation.feature);
  return {
    key: config.key,
    feature: config.feature,
    label: config.label,
    tab: config.tab,
    kind: config.kind,
    pending: {
      generationId: generation.id,
      pollUrl: generation.pollUrl ?? `/api/v1/generations/${encodeURIComponent(generation.id)}/status`,
      workspaceId: generation.workspaceId ?? "",
      provider: generation.provider ?? "",
      model: generation.model ?? "",
      status: generation.status,
      totalCount: generation.totalCount ?? Math.max(1, generation.output?.length ?? 1),
      completedCount: generation.completedCount ?? generation.output?.length ?? 0,
      output: generation.output ?? [],
      kind: config.kind,
    },
  };
}

function readActivePendingGenerations(): ActivePendingGeneration[] {
  if (typeof window === "undefined") return [];

  const sessionActive = generationFeatureOptions.flatMap(({ key, feature, label, kind }) => {
    try {
      const raw = window.sessionStorage.getItem(key);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as Partial<PendingGeneration>;
      if (parsed.status !== "queued" && parsed.status !== "processing" && parsed.status !== "completed") return [];
      if (typeof parsed.generationId !== "string" || typeof parsed.pollUrl !== "string") return [];
      return [{
        key,
        feature,
        label,
        tab: feature,
        kind,
        pending: {
          generationId: parsed.generationId,
          pollUrl: parsed.pollUrl,
          workspaceId: typeof parsed.workspaceId === "string" ? parsed.workspaceId : "",
          provider: typeof parsed.provider === "string" ? parsed.provider : "",
          model: typeof parsed.model === "string" ? parsed.model : "",
          status: parsed.status,
          totalCount: typeof parsed.totalCount === "number" ? parsed.totalCount : 1,
          completedCount: typeof parsed.completedCount === "number" ? parsed.completedCount : Array.isArray(parsed.output) ? parsed.output.length : 0,
          output: Array.isArray(parsed.output) ? parsed.output as PendingGeneration["output"] : [],
          kind,
        },
      }];
    } catch {
      window.sessionStorage.removeItem(key);
      return [];
    }
  });

  const dismissed = readDismissedGenerationIds();
  return mergeActiveGenerations(readPersistedProgress(), sessionActive)
    .filter((item) => !dismissed.has(item.pending.generationId));
}

function mergeActiveGenerations(...groups: ActivePendingGeneration[][]): ActivePendingGeneration[] {
  const byId = new Map<string, ActivePendingGeneration>();
  for (const group of groups) {
    for (const item of group) byId.set(item.pending.generationId, item);
  }
  return Array.from(byId.values());
}

function isPersistableProgress(value: unknown): value is ActivePendingGeneration {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<ActivePendingGeneration>;
  const pending = item.pending as Partial<PendingGeneration> | undefined;
  return typeof item.key === "string"
    && typeof item.feature === "string"
    && typeof item.label === "string"
    && typeof item.tab === "string"
    && (item.kind === "image" || item.kind === "video")
    && typeof pending?.generationId === "string"
    && typeof pending.pollUrl === "string"
    && (pending.status === "queued" || pending.status === "processing" || pending.status === "completed")
    && Array.isArray(pending.output);
}

function isStoryboardParentProgress(item: ActivePendingGeneration): boolean {
  return item.feature === "image-to-video" && /\/generations\/video\/image-to-video\//.test(item.pending.pollUrl);
}

function isPersistedStoryboardSceneProgress(item: ActivePendingGeneration): boolean {
  // Storyboard scenes use the generic generation status URL. The storyboard
  // parent uses the dedicated storyboard status URL and is the only card we
  // want to show for this workflow.
  return item.feature === "image-to-video" && !isStoryboardParentProgress(item);
}

function readPersistedProgress(): ActivePendingGeneration[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(getGenerationProgressStorageKey());
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter(isPersistableProgress).filter((item) => !isPersistedStoryboardSceneProgress(item))
      : [];
  } catch {
    return [];
  }
}

function writePersistedProgress(items: ActivePendingGeneration[]): void {
  if (typeof window === "undefined") return;

  try {
    const storageKey = getGenerationProgressStorageKey();
    if (items.length === 0) window.localStorage.removeItem(storageKey);
    else window.localStorage.setItem(storageKey, JSON.stringify(items));
  } catch {
    // Storage may be unavailable in private browsing; the in-memory card still works.
  }
}

function readDismissedGenerationIds(): Set<string> {
  if (typeof window === "undefined") return new Set();

  try {
    const raw = window.localStorage.getItem(getDismissedProgressStorageKey());
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    return new Set(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : []);
  } catch {
    return new Set();
  }
}

function writeDismissedGenerationIds(ids: Set<string>): void {
  if (typeof window === "undefined") return;

  try {
    const storageKey = getDismissedProgressStorageKey();
    if (ids.size === 0) window.localStorage.removeItem(storageKey);
    else window.localStorage.setItem(storageKey, JSON.stringify(Array.from(ids)));
  } catch {
    // Storage may be unavailable; the in-memory dismissal still works.
  }
}

function dismissGeneration(generationId: string): void {
  const dismissed = readDismissedGenerationIds();
  dismissed.add(generationId);
  writeDismissedGenerationIds(dismissed);
}

function clearDismissedGeneration(generationId: string): void {
  const dismissed = readDismissedGenerationIds();
  if (!dismissed.delete(generationId)) return;
  writeDismissedGenerationIds(dismissed);
}

function upsertPersistedProgress(item: ActivePendingGeneration): void {
  const current = readPersistedProgress();
  const next = mergeActiveGenerations(current, [item]);
  if (JSON.stringify(current) !== JSON.stringify(next)) writePersistedProgress(next);
}

function removePersistedProgress(generationId: string): void {
  const current = readPersistedProgress();
  const next = current.filter((item) => item.pending.generationId !== generationId);
  if (next.length !== current.length) writePersistedProgress(next);
}

function hasSessionPendingGeneration(generationId: string): boolean {
  if (typeof window === "undefined") return false;

  return generationFeatureOptions.some(({ key }) => {
    try {
      const raw = window.sessionStorage.getItem(key);
      if (!raw) return false;
      const parsed = JSON.parse(raw) as Partial<PendingGeneration>;
      return parsed.generationId === generationId && (parsed.status === "queued" || parsed.status === "processing");
    } catch {
      return false;
    }
  });
}

function persistProgress(item: ActivePendingGeneration, progress: GenerationProgress) {
  if (typeof window === "undefined") return;
  if (progress.status === "failed" || progress.status === "cancelled") {
    window.sessionStorage.removeItem(item.key);
    removePersistedProgress(progress.generationId);
    return;
  }

  const updatedItem: ActivePendingGeneration = {
    ...item,
    pending: {
      ...item.pending,
      generationId: progress.generationId,
      pollUrl: progress.pollUrl ?? item.pending.pollUrl,
      workspaceId: progress.workspaceId ?? item.pending.workspaceId,
      provider: progress.provider ?? item.pending.provider,
      model: progress.model ?? item.pending.model,
      status: progress.status === "completed" ? "completed" : progress.status,
      totalCount: progress.totalCount,
      completedCount: progress.completedCount,
      output: progress.output,
    },
  };

  window.sessionStorage.setItem(item.key, JSON.stringify({
    ...item.pending,
    generationId: progress.generationId,
    pollUrl: progress.pollUrl ?? item.pending.pollUrl,
    workspaceId: progress.workspaceId ?? item.pending.workspaceId,
    provider: progress.provider ?? item.pending.provider,
    model: progress.model ?? item.pending.model,
    status: progress.status,
    totalCount: progress.totalCount,
    completedCount: progress.completedCount,
    output: progress.output,
  } satisfies PendingGeneration));
  upsertPersistedProgress(updatedItem);
}

async function loadActiveGenerations(): Promise<ActivePendingGeneration[]> {
  const responses = await Promise.allSettled(generationFeatureOptions.map(({ feature }) => listGenerationHistory(undefined, feature)));
  return mergeActiveGenerations(
    ...responses
      .filter((response): response is PromiseFulfilledResult<GenerationHistoryItem[]> => response.status === "fulfilled")
      .map((response) => response.value.flatMap((generation) => {
        const active = toPendingGeneration(generation);
        return active ? [active] : [];
      })),
  );
}

export function GenerationProgressFloating() {
  const { t } = useLocale();
  const pathnameFromRouter = usePathname();
  const hydrated = useHydrated();
  const pathname = hydrated ? pathnameFromRouter : "";
  const isImageCreatePage = pathname === "/create/image";
  const router = useRouter();
  // Keep the server render and the first client render identical. Browser
  // storage is hydrated by the effects below after React has completed the
  // hydration comparison.
  const [active, setActive] = useState<ActivePendingGeneration[]>([]);
  const [isCenterOpen, setIsCenterOpen] = useState(false);
  const [isOverlayDismissed, setIsOverlayDismissed] = useState(false);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const collapseRef = useRef<HTMLButtonElement>(null);
  const closeCenter = () => {
    setIsCenterOpen(false);
    requestAnimationFrame(() => launcherRef.current?.focus());
  };
  const closeAllCenter = () => {
    setIsCenterOpen(false);
    setIsOverlayDismissed(true);
  };

  useEffect(() => {
    if (isCenterOpen) collapseRef.current?.focus();
  }, [isCenterOpen]);
  const pollingRef = useRef(new Map<string, AbortController>());
  const activeRef = useRef(active);
  const dismissedGenerationIdsRef = useRef(new Set<string>());
  const completedGenerationIdsRef = useRef(new Set<string>());
  const isAssetsPage = pathname.startsWith("/assets");

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    const handleGenerationStarted = (event: Event) => {
      const detail = (event as CustomEvent<{ feature?: string; generationId?: string; pollUrl?: string; workspaceId?: string; provider?: string; model?: string; status?: "queued" | "processing"; totalCount?: number; completedCount?: number }>).detail;
      if (!detail?.feature || !detail.generationId || !detail.pollUrl) return;
      setIsOverlayDismissed(false);
      dismissedGenerationIdsRef.current.delete(detail.generationId);
      clearDismissedGeneration(detail.generationId);
      const config = featureConfig(detail.feature);
      const pending: PendingGeneration = {
        generationId: detail.generationId,
        pollUrl: detail.pollUrl,
        workspaceId: detail.workspaceId ?? "",
        provider: detail.provider ?? "",
        model: detail.model ?? "",
        status: detail.status ?? "queued",
        totalCount: detail.totalCount ?? 1,
        completedCount: detail.completedCount ?? 0,
        output: [],
        kind: config.kind,
      };
      const startedItem = { key: config.key, feature: config.feature, label: config.label, tab: config.tab, kind: config.kind, pending } satisfies ActivePendingGeneration;
      upsertPersistedProgress(startedItem);
      setActive((current) => mergeActiveGenerations(current, [startedItem]));
    };
    window.addEventListener("eos:generation-started", handleGenerationStarted);
    return () => window.removeEventListener("eos:generation-started", handleGenerationStarted);
  }, []);

  useEffect(() => {
    let disposed = false;

    const refreshFromBackend = async () => {
      try {
        const backendActive = await loadActiveGenerations();
        if (disposed) return;
        backendActive.forEach(upsertPersistedProgress);
        setActive((current) => mergeActiveGenerations(backendActive, readActivePendingGenerations(), current));
      } catch {
        // Authentication/session loading can still be in progress. The next focus or page load retries.
      }
    };

    void refreshFromBackend();
    const handleFocus = () => void refreshFromBackend();
    window.addEventListener("focus", handleFocus);
    return () => {
      disposed = true;
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    const pollingMap = pollingRef.current;

    const sync = () => {
      const localActive = readActivePendingGenerations();
      localActive.forEach(upsertPersistedProgress);
      if (localActive.length > 0) setActive((current) => mergeActiveGenerations(current, localActive));

      const next = activeRef.current;
      const activeIds = new Set(next.map((item) => item.pending.generationId));
      for (const [generationId, controller] of pollingMap) {
        if (!activeIds.has(generationId)) {
          controller.abort();
          pollingMap.delete(generationId);
        }
      }

      for (const item of next) {
        const generationId = item.pending.generationId;
        if (item.pending.status === "completed") continue;
        if (isImageCreatePage && hasSessionPendingGeneration(generationId)) continue;
        if (pollingMap.has(generationId)) continue;

        const controller = new AbortController();
        pollingMap.set(generationId, controller);
        void resumeGeneration(item.pending, (progress) => {
          if (disposed) return;
          if (dismissedGenerationIdsRef.current.has(generationId) || readDismissedGenerationIds().has(generationId)) return;
          if (progress.status === "completed" && !completedGenerationIdsRef.current.has(generationId)) {
            completedGenerationIdsRef.current.add(generationId);
            emitGenerationCompleted({ feature: item.feature, generationId });
          }
          persistProgress(item, progress);
          setActive((current) => {
            if (dismissedGenerationIdsRef.current.has(generationId)) return current;
            const currentIndex = current.findIndex((entry) => entry.pending.generationId === generationId);
            const refreshed = readActivePendingGenerations();
            if (progress.status === "failed" || progress.status === "cancelled") return current.filter((entry) => entry.pending.generationId !== generationId);
            const updated: ActivePendingGeneration = {
              ...item,
              pending: {
                ...item.pending,
                status: progress.status === "completed" ? "completed" : progress.status,
                totalCount: progress.totalCount,
                completedCount: progress.completedCount,
                output: progress.output,
                kind: item.kind,
              },
            };
            const next = [...current];
            if (currentIndex >= 0) next[currentIndex] = updated;
            else next.push(updated);
            return mergeActiveGenerations(next, refreshed);
          });
        }, controller.signal).catch(() => {
          if (!disposed && !controller.signal.aborted) {
            window.sessionStorage.removeItem(item.key);
            setActive((current) => current.filter((entry) => entry.pending.generationId !== generationId));
          }
        }).finally(() => {
          if (pollingMap.get(generationId) === controller) pollingMap.delete(generationId);
        });
      }
    };

    sync();
    const intervalId = window.setInterval(sync, 1_000);
    return () => {
      disposed = true;
      window.clearInterval(intervalId);
      for (const controller of pollingMap.values()) controller.abort();
      pollingMap.clear();
    };
  }, [isImageCreatePage]);

  if (isAssetsPage || active.length === 0 || isOverlayDismissed) return null;

  const inProgress = active.filter((item) => item.pending.status !== "completed");
  const completedItems = active.filter((item) => item.pending.status === "completed");

  const removeProgressForItem = (item: ActivePendingGeneration) => {
    const generationId = item.pending.generationId;
    dismissedGenerationIdsRef.current.add(generationId);
    dismissGeneration(generationId);
    removePersistedProgress(generationId);
    pollingRef.current.get(generationId)?.abort();
    pollingRef.current.delete(generationId);
    const stored = window.sessionStorage.getItem(item.key);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as { generationId?: string };
        if (parsed.generationId === generationId) window.sessionStorage.removeItem(item.key);
      } catch {
        // Ignore malformed stale progress storage and still dismiss the visible item.
      }
    }
  };

  const handleDismiss = (item: ActivePendingGeneration) => {
    removeProgressForItem(item);
    setActive((current) => current.filter((entry) => entry.pending.generationId !== item.pending.generationId));
  };

  const handleClearCompleted = () => {
    const completedIds = new Set(completedItems.map((item) => item.pending.generationId));
    completedItems.forEach(removeProgressForItem);
    setActive((current) => current.filter((item) => !completedIds.has(item.pending.generationId)));
  };

  const renderGenerationItem = (item: ActivePendingGeneration) => {
    const { label, tab, kind, pending } = item;
    const localizedLabel = generationLabelKeys[item.feature] ? t(generationLabelKeys[item.feature]) : label;
    const generationId = pending.generationId;
    const total = Math.max(1, pending.totalCount);
    const completed = Math.min(total, Math.max(0, pending.completedCount));
    const isCompleted = pending.status === "completed";
    const isQueued = pending.status === "queued";
    const percentage = isCompleted ? 100 : Math.round((completed / total) * 100);
    const statusClass = isCompleted ? styles.statusCompleted : isQueued ? styles.statusQueued : styles.statusProcessing;
    const visiblePercentage = percentage > 0 ? percentage : isQueued ? 10 : 22;

    const handleCardClick = () => {
      setIsCenterOpen(false);
      router.push(`${kind === "video" ? "/create/video" : "/create/image"}?tab=${encodeURIComponent(tab)}`);
    };

    return <div className={styles.itemShell} key={generationId}>
      <button type="button" className={styles.item} onClick={handleCardClick} aria-label={t("shell.generation.openItem", { label: localizedLabel })} title={t("shell.generation.openItemTitle", { label: localizedLabel, studio: kind === "video" ? t("shell.nav.video") : t("shell.nav.image") })}>
        <div className={styles.itemHeading}>
          <span className={styles.itemLabel}><i className={`${styles.dot} ${isCompleted ? styles.dotCompleted : ""}`} />{localizedLabel}</span>
          <b className={`${styles.status} ${statusClass}`}>{isCompleted ? t("shell.generation.completed") : isQueued ? t("shell.generation.waitingStatus") : t("shell.generation.processingStatus")}</b>
        </div>
        <div className={styles.track} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentage} aria-label={`${localizedLabel}: ${percentage}%`}>
          <span className={`${styles.bar} ${percentage === 0 ? styles.barIndeterminate : ""}`} style={{ width: `${visiblePercentage}%` }} />
        </div>
        <div className={styles.meta}>
          <span>{t("shell.generation.ready", { completed, total, unit: kind === "video" ? (total === 1 ? t("shell.generation.videoUnit") : t("shell.generation.videosUnit")) : (total === 1 ? t("shell.generation.imageUnit") : t("shell.generation.imagesUnit")) })}</span>
          <span className={styles.eta}>{isCompleted ? <><CheckCircle2 size={12} /> <strong>{t("shell.generation.completedStatus")}</strong></> : <><Clock3 size={12} /> <strong>{isQueued ? t("shell.generation.waitingStatus") : t("shell.generation.processingStatus")}</strong></>}</span>
        </div>
      </button>
      {isCompleted && <button type="button" className={styles.dismiss} onClick={() => handleDismiss(item)} aria-label={t("shell.generation.dismissItem", { label: localizedLabel })} title={t("shell.generation.dismissItemTitle")}><X size={13} /></button>}
    </div>;
  };

  return <div className={styles.wrapper} data-expanded={isCenterOpen} onKeyDown={(event) => { if (event.key === "Escape" && isCenterOpen) { event.stopPropagation(); closeCenter(); } }}>
    {isCenterOpen && <section id="generation-center-panel" className={styles.center} aria-label={t("shell.generation.center")}>
      <div className={styles.centerHeader}>
        <div>
          <span className={styles.centerTitle}><i className={`${styles.dot} ${inProgress.length > 0 ? "" : styles.dotCompleted}`} />{t("shell.generation.center")}</span>
          <small>{active.length} {active.length === 1 ? t("shell.generation.generation") : t("shell.generation.generations")}</small>
        </div>
        <div className={styles.centerActions}>
          <button type="button" className={styles.panelToggle} onClick={closeAllCenter} aria-label={t("shell.generation.closeAll")} title={t("shell.generation.closeAll")}><X size={17} /></button>
          <button ref={collapseRef} type="button" className={styles.panelToggle} onClick={closeCenter} aria-label={t("shell.generation.collapse")} title={t("shell.generation.collapse")}><ChevronDown size={18} /></button>
        </div>
      </div>
      {inProgress.length > 0 && <section className={styles.group} aria-labelledby="generation-center-progress">
        <h3 id="generation-center-progress"><span className={styles.groupLabel}>{t("shell.generation.inProgress")}</span><span className={styles.groupCount}>{inProgress.length}</span></h3>
        {inProgress.map(renderGenerationItem)}
      </section>}
      {completedItems.length > 0 && <section className={styles.group} aria-labelledby="generation-center-completed">
        <h3 id="generation-center-completed">
          <span className={styles.groupLabel}>{t("shell.generation.completed")}</span>
          <span className={styles.groupHeaderActions}>
            <button type="button" className={styles.clearCompleted} onClick={handleClearCompleted}>{t("shell.generation.clearCompleted")}</button>
            <span className={styles.groupCount}>{completedItems.length}</span>
          </span>
        </h3>
        {completedItems.map(renderGenerationItem)}
      </section>}
    </section>}
    <div className={styles.launcherRow}>
      <button ref={launcherRef} type="button" className={`${styles.launcher} ${inProgress.length > 0 ? styles.launcherActive : styles.launcherComplete}`} onClick={() => setIsCenterOpen((open) => !open)} aria-expanded={isCenterOpen} aria-controls={isCenterOpen ? "generation-center-panel" : undefined} aria-label={t("shell.generation.open")} title={t("shell.generation.open")}>
        <i className={`${styles.dot} ${inProgress.length === 0 ? styles.dotCompleted : ""}`} />
        <span className={styles.launcherCopy}><strong aria-live="polite">{inProgress.length > 0 ? `กำลังสร้าง ${inProgress.length} งาน` : `สร้างเสร็จแล้ว ${completedItems.length} งาน`}</strong><small>แตะเพื่อดูรายละเอียด</small></span>
        {isCenterOpen ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
      </button>
      {inProgress.length === 0 && completedItems.length > 0 ? <button type="button" className={styles.launcherDismiss} onClick={handleClearCompleted} aria-label={t("shell.generation.clearCompleted")} title={t("shell.generation.clearCompleted")}><X size={15} /></button> : null}
    </div>
  </div>;
}
