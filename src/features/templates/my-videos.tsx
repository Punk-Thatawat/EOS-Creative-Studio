import { useEffect, useState } from "react";
import { Check, LayoutTemplate, Loader2, Trash2, X } from "lucide-react";
import { type CreativeTemplate as Template } from "@/lib/api/templates";
import { deleteHistoryItem, fetchHistory, type HistoryItem } from "@/lib/api/history";
import {
  generationMediaExpiry,
  isGenerationMediaAvailable,
} from "@/lib/generation-media-retention";
import {
  cancelTemplateWorkflow,
  listTemplateWorkflows,
  type TemplateWorkflowRun,
} from "@/lib/api/template-workflows";
import {
  GENERATION_COMPLETED_EVENT,
  GENERATION_STARTED_EVENT,
} from "@/lib/generation-progress-events";
import { useStudioCopy } from "@/lib/i18n/studio-copy";
import s from "./templates-page.module.css";
import { modeFeatures, type Mode, workflowEvent } from "./library-modes";
import { WORK_TEMPLATE_EVENT, templateOfWork, workSlug } from "./saved-works";
import { DISMISSED_RUNS_KEY, readDismissedRuns } from "./recent-templates";
import { SaveTemplateDialog, type SavedTemplate } from "./save-template-dialog";

/**
 * The finished clips made from a template in this mode, newest first, played right here. The server marks which clips were started
 * from a template, so this holds on any device. Reloads whenever a job finishes.
 */
export function MyVideos({
  mode,
  savedSlugs,
  onTemplateCreated,
  onUseSaved,
  onOpenLibrary,
  onDetails,
}: {
  mode: Mode;
  /** The addresses of every template in the library, to tell which clips already became one. */
  savedSlugs: Set<string>;
  onTemplateCreated: (saved: SavedTemplate) => void;
  onUseSaved: (slug: string) => void;
  onOpenLibrary?: () => void;
  /** Opens the details of one of the member's own clips. */
  onDetails: (t: Template) => void;
}) {
  const { c } = useStudioCopy();
  const [justSaved, setJustSaved] = useState<SavedTemplate | null>(null);
  const [videos, setVideos] = useState<HistoryItem[]>([]);
  // How many of the clips are on show; the rest open with "Show more" instead of being dropped.
  const [shown, setShown] = useState(8);
  const [pending, setPending] = useState<HistoryItem[]>([]);
  const [runs, setRuns] = useState<TemplateWorkflowRun[]>([]);
  const [saving, setSaving] = useState<HistoryItem | null>(null);
  // The clip whose bin was pressed once: deleting asks for a second press. A failed delete says so under the list.
  const [confirmWork, setConfirmWork] = useState<string | null>(null);
  const [deleteFailed, setDeleteFailed] = useState(false);
  const [dismissedRuns, setDismissedRuns] = useState<string[]>([]);
  useEffect(() => {
    const timer = window.setTimeout(() => setDismissedRuns(readDismissedRuns()), 0);
    return () => window.clearTimeout(timer);
  }, []);
  const dismissRun = (id: string) => {
    const next = [...new Set([...dismissedRuns, id])].slice(-100);
    setDismissedRuns(next);
    try {
      window.localStorage.setItem(DISMISSED_RUNS_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage restrictions; the item is hidden until the page reloads.
    }
  };
  useEffect(() => {
    if (!confirmWork) return;
    const timer = window.setTimeout(() => setConfirmWork(null), 4000);
    return () => window.clearTimeout(timer);
  }, [confirmWork]);
  const removeWork = async (item: HistoryItem) => {
    if (confirmWork !== item.id) {
      setConfirmWork(item.id);
      return;
    }
    setConfirmWork(null);
    setDeleteFailed(false);
    try {
      await deleteHistoryItem(item);
      setVideos((current) => current.filter((video) => video.id !== item.id));
    } catch {
      setDeleteFailed(true);
    }
  };
  useEffect(() => {
    const controller = new AbortController();
    let timer: number | undefined;
    const load = () => {
      window.clearTimeout(timer);
      const workflows = mode === "create" ? listTemplateWorkflows(12, controller.signal).catch(() => [] as TemplateWorkflowRun[]) : Promise.resolve([] as TemplateWorkflowRun[]);
      Promise.all([fetchHistory({ type: "video", fromTemplate: true, recentOnly: mode === "motion", limit: 50, signal: controller.signal }), workflows])
        .then(([result, flowRuns]) => {
          if (controller.signal.aborted) return;
          setRuns(flowRuns);
          const ofMode = result.items.filter((item) => modeFeatures[mode].includes(item.feature));
          setVideos(ofMode.filter((item) =>
            item.status === "completed" && item.outputUrl
            && (mode !== "motion" || isGenerationMediaAvailable(item.createdAt, item.expiresAt)),
          ));
          const running = ofMode.filter((item) => item.status === "queued" || item.status === "processing");
          setPending(running);
          // Follow the clips and workflow runs still being made until they are done.
          if (running.length || flowRuns.some((run) => run.status === "running")) timer = window.setTimeout(load, 6000);
        })
        .catch(() => {});
    };
    load();
    window.addEventListener(GENERATION_COMPLETED_EVENT, load);
    window.addEventListener(GENERATION_STARTED_EVENT, load);
    window.addEventListener(workflowEvent, load);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
      window.removeEventListener(GENERATION_COMPLETED_EVENT, load);
      window.removeEventListener(GENERATION_STARTED_EVENT, load);
      window.removeEventListener(workflowEvent, load);
    };
  }, [mode]);
  useEffect(() => {
    if (mode !== "motion") return;
    const nextExpiry = Math.min(...videos.map((item) => generationMediaExpiry(item.createdAt, item.expiresAt) ?? Infinity));
    if (!Number.isFinite(nextExpiry)) return;
    const timer = window.setTimeout(() => {
      const now = Date.now();
      setVideos((items) => items.filter((item) => isGenerationMediaAvailable(item.createdAt, item.expiresAt, now)));
    }, Math.min(Math.max(nextExpiry - Date.now(), 0), 2_147_483_647));
    return () => window.clearTimeout(timer);
  }, [mode, videos]);
  // The details of a clip save it as a template (or open it, once saved) through this event.
  useEffect(() => {
    const answer = (event: Event) => {
      const id = (event as CustomEvent<string>).detail;
      const item = videos.find((video) => video.id === id);
      if (!item) return;
      if (savedSlugs.has(workSlug(item.id))) onUseSaved(workSlug(item.id));
      else setSaving(item);
    };
    window.addEventListener(WORK_TEMPLATE_EVENT, answer);
    return () => window.removeEventListener(WORK_TEMPLATE_EVENT, answer);
  }, [videos, savedSlugs, onUseSaved]);
  // Motion Control shows its clips as playing tiles; Create video keeps the list with the player's own controls. In the list, the
  // player's full-screen button opens the clip's details, as the zoom button on the library cards does.
  const tiles = true;
  useEffect(() => {
    if (tiles) return;
    const opened = () => {
      const element = document.fullscreenElement;
      const id = element instanceof HTMLVideoElement ? element.dataset.workId : undefined;
      const item = id ? videos.find((video) => video.id === id) : undefined;
      if (!item) return;
      void document.exitFullscreen().catch(() => undefined);
      onDetails(templateOfWork(item, savedSlugs.has(workSlug(item.id))));
    };
    document.addEventListener("fullscreenchange", opened);
    return () => document.removeEventListener("fullscreenchange", opened);
  }, [tiles, videos, savedSlugs, onDetails]);
  // Failed runs are listed only until a newer one exists, so an old failure does not stay forever.
  const shownRuns = runs.filter((run, index) => ((run.status !== "failed" && run.status !== "cancelled") || index < 2) && !dismissedRuns.includes(run.id));
  if (!videos.length && !pending.length && !shownRuns.length) return null;
  return (
    <section className={s.myVideos} aria-label={c("templates.history.mine")}>
      <div className={s.libraryTitle}>
        <h2>{c("templates.history.mine")}</h2>
      </div>
      {justSaved && (
        <div className={s.savedNote} role="status">
          <span>
            {c("templates.save.done", { name: justSaved.title })}
            {justSaved.coverFailed ? ` · ${c("templates.save.coverFailed")}` : ""}{justSaved.assetsFailed ? ` · ${c("templates.save.assetsFailed")}` : ""}
          </span>
          <button type="button" onClick={() => onUseSaved(justSaved.slug)}>{c("templates.save.use")}</button>
          {onOpenLibrary && <button type="button" onClick={onOpenLibrary}>{c("templates.save.openLibrary")}</button>}
        </div>
      )}
      <ul className={`${s.workGrid} ${mode === "motion" ? "" : s.workGridWide}`}>
        {shownRuns.map((run) => {
          const image = run.steps[0]?.outputUrl;
          return (
            <li key={run.id}>
              {run.status === "completed" && run.resultUrl ? (
                <video src={run.resultUrl} controls playsInline preload="metadata" aria-label={run.prompt} />
              ) : (
                <div
                  className={`${s.pendingClip} ${run.status === "failed" ? s.failedClip : ""}`}
                  style={image ? { backgroundImage: `linear-gradient(#000000a6, #000000a6), url("${image}")` } : undefined}
                  role={run.status === "failed" ? "alert" : "status"}
                >
                  {run.status === "running" ? <Loader2 size={22} aria-hidden="true" /> : null}
                  {run.status === "running"
                    ? c(run.currentStep >= 2 ? "templates.workflow.makingVideo" : "templates.workflow.makingImage")
                    : run.status === "cancelled"
                      ? c("templates.workflow.cancelled")
                      : `${c("templates.workflow.failed")}${run.errorMessage ? `: ${run.errorMessage}` : ""}`}
                </div>
              )}
              <span>{run.prompt}</span>
              {(run.status === "failed" || run.status === "cancelled") && (
                <button type="button" className={s.workDelete} aria-label={c("templates.history.dismissRun")} title={c("templates.history.dismissRun")} onClick={() => dismissRun(run.id)}>
                  <X size={14} aria-hidden="true" />
                </button>
              )}
              {run.status === "running" && (
                <button
                  type="button"
                  onClick={() => {
                    cancelTemplateWorkflow(run.id)
                      .catch(() => {})
                      .finally(() => window.dispatchEvent(new Event(workflowEvent)));
                  }}
                >
                  <X size={14} aria-hidden="true" />
                  {c("templates.workflow.cancel")}
                </button>
              )}
            </li>
          );
        })}
        {pending.map((item) => (
          <li key={item.id}>
            <div className={s.pendingClip} role="status">
              <Loader2 size={22} aria-hidden="true" />
              {c("templates.history.making")}
            </div>
            <span>{item.prompt?.trim() || item.title}</span>
          </li>
        ))}
        {videos.slice(0, shown).map((item) => tiles ? (
          <li key={item.id} className={s.workTile}>
            {/* The clip plays on its tile (muted, looping); a click opens its details, where the player has its controls. */}
            <button type="button" className={s.workOpen} onClick={() => onDetails(templateOfWork(item, savedSlugs.has(workSlug(item.id))))} aria-label={c("templates.card.previewAria", { name: item.title })} title={item.prompt?.trim() || item.title}>
              <video src={item.outputUrl} autoPlay muted loop playsInline preload="metadata" aria-hidden="true" tabIndex={-1} />
            </button>
            <button
              type="button"
              className={`${s.workDelete} ${confirmWork === item.id ? s.workDeleteConfirm : ""}`}
              aria-label={c(confirmWork === item.id ? "templates.history.deleteConfirm" : "templates.history.delete")}
              title={c(confirmWork === item.id ? "templates.history.deleteConfirm" : "templates.history.delete")}
              onClick={() => void removeWork(item)}
            >
              {confirmWork === item.id ? <span>{c("templates.picker.removeConfirmShort")}</span> : <Trash2 size={14} aria-hidden="true" />}
            </button>
          </li>
        ) : (
          <li key={item.id}>
            <video src={item.outputUrl} controls playsInline preload="metadata" aria-label={item.title} data-work-id={item.id} />
            <span>{item.prompt?.trim() || item.title}</span>
            {savedSlugs.has(workSlug(item.id)) ? (
              <div className={s.savedRow}>
                <span>
                  <Check size={13} aria-hidden="true" />
                  {c("templates.save.already")}
                </span>
                <button type="button" onClick={() => onUseSaved(workSlug(item.id))}>{c("templates.save.use")}</button>
              </div>
            ) : (
              <button type="button" onClick={() => setSaving(item)}>
                <LayoutTemplate size={14} aria-hidden="true" />
                {c("templates.save.button")}
              </button>
            )}
          </li>
        ))}
      </ul>
      {deleteFailed && <p className={s.sendError} role="alert">{c("templates.history.deleteFailed")}</p>}
      {videos.length > shown && (
        <button type="button" className={s.showMore} onClick={() => setShown((count) => count + 8)}>
          {c("templates.history.more", { count: videos.length - shown })}
        </button>
      )}
      {saving && (
        <SaveTemplateDialog
          item={saving}
          mode={mode}
          onClose={() => setSaving(null)}
          onCreated={(saved) => {
            setJustSaved(saved);
            onTemplateCreated(saved);
          }}
        />
      )}
    </section>
  );
}
