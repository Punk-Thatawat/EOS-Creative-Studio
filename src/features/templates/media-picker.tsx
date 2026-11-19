"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowDownUp, Check, ChevronDown, Clock3, Heart, ImagePlus, Loader2, Play, Upload, X } from "lucide-react";
import { deleteAsset, fetchAssets, updateAsset } from "@/lib/api/assets";
import { deleteHistoryItem, fetchHistory, type HistoryItem } from "@/lib/api/history";
import { listTemplates, type CreativeTemplate, type TemplateSource } from "@/lib/api/templates";
import { listMyTemplateLikes } from "@/lib/api/template-likes";
import { useStudioCopy } from "@/lib/i18n/studio-copy";
import s from "./templates-page.module.css";

type MediaKind = "image" | "video";
const RECENT_KEY: Record<MediaKind, string> = { image: "eos.templates.recentUploads", video: "eos.templates.recentVideoUploads" };
/** A link from the upload service lasts about a week, so a recent upload is offered for a little less. */
const RECENT_TTL_MS = 6 * 24 * 60 * 60 * 1000;
const RECENT_MAX = 40;
const PAGE = 18;
const MOTION = /(motion|swap)/i;
/** Groups of your own images, read from the asset folder of the same name. */
const CATEGORY_FOLDERS = { product: "Product", brand: "Brand", character: "Character", logo: "Logo", scene: "Scene" } as const;
export type PickerCategory = keyof typeof CATEGORY_FOLDERS;
const PICKER_VIEWS = ["recent", "all", "product", "brand", "character", "logo", "scene"] as const;
type PickerView = (typeof PICKER_VIEWS)[number];
const isPickerCategory = (view: PickerView): view is PickerCategory => view !== "recent" && view !== "all";

const LIKED_KEY = "eos.templates.likedImages";
type Recent = { url: string; at: number; category?: PickerCategory };
type Liked = { id: string; url: string; label: string };

function readLikedImages(): Liked[] {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(LIKED_KEY) ?? "[]");
    return Array.isArray(value) ? value.filter((entry): entry is Liked => typeof entry?.id === "string" && typeof entry?.url === "string") : [];
  } catch {
    return [];
  }
}
function writeLikedImages(list: Liked[]) {
  try {
    window.localStorage.setItem(LIKED_KEY, JSON.stringify(list.slice(0, 200)));
  } catch {
    // Liking is a convenience; the picker works without it.
  }
}
/**
 * `removable` says what the cross on a picture does: "device" drops an image just added here, "recent" takes a remembered upload out of its group
 * (or out of the latest uploads when no group is open), "asset" moves a saved asset out of its group folder (it is kept in Assets),
 * "trash" moves a saved asset to the trash of Assets (it can be restored there), after a second press,
 * "work" deletes a work made in this account from its history, after a second press.
 */
type Choice = { id: string; url: string; label: string; removable?: "device" | "recent" | "asset" | "trash" | "work"; /** Where a work of the account lives, to delete it. */ source?: HistoryItem["source"] };
type Tab = "recent" | "uploads" | "presets" | "generated" | "liked";
const ALLOWED: Record<MediaKind, string[]> = { image: ["image/png", "image/jpeg", "image/webp"], video: ["video/mp4", "video/quicktime", "video/webm"] };

export function readRecentUploads(kind: MediaKind = "image"): Recent[] {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(RECENT_KEY[kind]) ?? "[]");
    if (!Array.isArray(value)) return [];
    const now = Date.now();
    return value.filter((entry): entry is Recent => typeof entry?.url === "string" && typeof entry?.at === "number" && now - entry.at < RECENT_TTL_MS);
  } catch {
    return [];
  }
}

/** Remembers what was just uploaded for a video, newest first, so it can be picked again without uploading. */
/** Takes an image out of its group; it stays in the latest uploads. */
export function forgetUploadCategory(url: string, kind: MediaKind = "image") {
  try {
    const next = readRecentUploads(kind).map((entry) => {
      if (entry.url !== url) return entry;
      const { category: _category, ...rest } = entry;
      void _category;
      return rest;
    });
    window.localStorage.setItem(RECENT_KEY[kind], JSON.stringify(next));
  } catch {
    // Remembering is a convenience; the page works without it.
  }
}

/** Takes an upload out of the latest uploads. */
export function forgetUpload(url: string, kind: MediaKind = "image") {
  try {
    window.localStorage.setItem(RECENT_KEY[kind], JSON.stringify(readRecentUploads(kind).filter((entry) => entry.url !== url)));
  } catch {
    // Remembering is a convenience; the page works without it.
  }
}

export function rememberUploads(urls: string[], kind: MediaKind = "image", categories: Array<string | undefined> = []) {
  try {
    const now = Date.now();
    const known = readRecentUploads(kind).filter((entry) => !urls.includes(entry.url));
    const next = [...urls.map((url, index): Recent => { const category = categories[index]; return { url, at: now, ...(category && category in CATEGORY_FOLDERS ? { category: category as PickerCategory } : {}) }; }), ...known].slice(0, RECENT_MAX);
    window.localStorage.setItem(RECENT_KEY[kind], JSON.stringify(next));
  } catch {
    // Remembering is a convenience; the page works without it.
  }
}

async function toFile(choice: Choice, index: number, kind: MediaKind, added?: File): Promise<File | null> {
  if (added) return added;
  try {
    const response = await fetch(choice.url);
    if (!response.ok) return null;
    const blob = await response.blob();
    if (!ALLOWED[kind].includes(blob.type)) return null;
    const extension = blob.type === "image/jpeg" ? "jpg" : blob.type === "video/quicktime" ? "mov" : blob.type.split("/")[1];
    return new File([blob], `${choice.label.replace(/[^\w.-]+/g, "-").slice(0, 40) || kind}-${index + 1}.${extension}`, { type: blob.type });
  } catch {
    return null;
  }
}

/** The clip that carries a template's motion: the one it was made from, else its preview. */
function motionClipOf(template: CreativeTemplate): string {
  const own = template.settings?.sourceVideo;
  return typeof own === "string" && own ? own : (template.previewUrl ?? "");
}
const isMotionTemplate = (template: CreativeTemplate) => MOTION.test(`${String(template.settings?.feature ?? "")} ${template.targetPath}`) && !!motionClipOf(template);

/**
 * Pick media you already have instead of uploading again. Images: the last uploads, your saved assets, and what you generated.
 * Videos (a motion to copy): the last uploads, the library's motions (EOS and community), your videos, and the ones you liked.
 * The chosen ones come back as files, ready for the panel.
 */
export function MediaPicker({
  open,
  kind = "image",
  remaining,
  onClose,
  onPick,
  onUploadFromDevice,
}: {
  open: boolean;
  kind?: MediaKind;
  /** How many more the panel takes. */
  remaining: number;
  onClose: () => void;
  /** `category` is the group chip the visitor was on, when there was one. */
  onPick: (files: File[], category?: PickerCategory) => void;
  onUploadFromDevice: (category?: PickerCategory) => void;
}) {
  const { c } = useStudioCopy();
  const tabs: Array<{ id: Tab; label: string }> =
    kind === "image"
      ? [
          { id: "uploads", label: c("templates.picker.uploads") },
          { id: "generated", label: c("templates.picker.generated") },
          { id: "liked", label: c("templates.picker.liked") },
        ]
      : [
          { id: "recent", label: c("templates.picker.recent") },
          { id: "presets", label: c("templates.picker.presets") },
          { id: "generated", label: c("templates.picker.videos") },
          { id: "liked", label: c("templates.picker.liked") },
        ];
  const [tab, setTab] = useState<Tab>(kind === "image" ? "uploads" : "recent");
  // Uploads: the last ones you made here, or everything saved in your assets; newest or oldest first.
  const [view, setView] = useState<PickerView>("recent");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const activeCategory = kind === "image" && tab === "uploads" && isPickerCategory(view) ? view : undefined;
  // Images added from the device in this window: they stay here, picked, so more can be added without closing it.
  const [added, setAdded] = useState<Array<{ choice: Choice; category?: PickerCategory }>>([]);
  const addedFiles = useRef(new Map<string, File>());
  // The picture whose cross was pressed once: moving a saved image to the trash asks for a second press.
  const [confirmId, setConfirmId] = useState<string | null>(null);
  useEffect(() => {
    if (!confirmId) return;
    const timer = window.setTimeout(() => setConfirmId(null), 4000);
    return () => window.clearTimeout(timer);
  }, [confirmId]);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [sortOpen, setSortOpen] = useState(false);
  const [liked, setLiked] = useState<Liked[]>([]);
  const [source, setSource] = useState<TemplateSource>("official");
  const [choices, setChoices] = useState<Choice[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<Choice[]>([]);
  const [busy, setBusy] = useState(false);
  const [skipped, setSkipped] = useState(0);
  // Links that no longer open (a generated file is kept for a week) are left out instead of showing as broken boxes.
  const [gone, setGone] = useState<Set<string>>(new Set());

  // Every time the window opens it starts from the latest uploads, not from the group it was left on (which may be empty).
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) {
      setTab(kind === "image" ? "uploads" : "recent");
      setView("recent");
    }
  }

  // A new tab (or another group of presets) starts from its first page.
  const [lastView, setLastView] = useState(`${tab}:${source}:${view}:${sort}`);
  if (lastView !== `${tab}:${source}:${view}:${sort}`) {
    setLastView(`${tab}:${source}:${view}:${sort}`);
    setPage(1);
    setChoices([]);
  }

  useEffect(() => {
    if (!open) return;
    let alive = true;
    const run = async () => {
      // The hearts follow what is stored.
      setLiked(readLikedImages());
      setLoading(true);
      setFailed(false);
      try {
        let next: Choice[] = [];
        let more = false;
        if (tab === "recent" || (tab === "uploads" && view === "recent")) {
          const recent = readRecentUploads(kind);
          next = (sort === "oldest" ? [...recent].reverse() : recent).map((entry, index): Choice => ({ id: entry.url, url: entry.url, label: `upload-${index + 1}`, removable: "recent" }));
        } else if (tab === "uploads") {
          const result = await fetchAssets({ tab: "mine", type: "image", limit: PAGE, page, sort, ...(isPickerCategory(view) ? { folder: CATEGORY_FOLDERS[view] } : {}) });
          const fromAssets = result.assets.map((asset): Choice => ({ id: asset.id, url: asset.url ?? asset.previewUrl ?? "", label: asset.title || "asset", removable: isPickerCategory(view) ? ("asset" as const) : ("trash" as const) })).filter((choice) => choice.url);
          // What was added under this group in this browser comes first (it is not in an asset folder).
          const remembered = page === 1 && isPickerCategory(view) ? readRecentUploads(kind).filter((entry) => entry.category === view).map((entry, index): Choice => ({ id: entry.url, url: entry.url, label: `upload-${index + 1}`, removable: "recent" })) : [];
          next = [...remembered, ...fromAssets.filter((choice) => !remembered.some((known) => known.url === choice.url))];
          more = page < result.pagination.totalPages;
        } else if (tab === "generated") {
          const result = await fetchHistory({ type: kind, status: "completed", limit: PAGE, offset: (page - 1) * PAGE });
          next = result.items.filter((item) => item.outputUrl).map((item): Choice => ({ id: item.id, url: item.outputUrl as string, label: item.title || kind, removable: "work", source: item.source }));
          more = result.pagination.hasMore;
        } else if (tab === "presets") {
          const result = await listTemplates({ kind: "video", source, limit: 50, sort: "popular" });
          next = result.templates.filter(isMotionTemplate).map((template) => ({ id: template.slug, url: motionClipOf(template), label: template.title }));
        } else if (kind === "image") {
          next = readLikedImages().map((entry) => ({ id: entry.id, url: entry.url, label: entry.label }));
        } else {
          const [slugs, official, community] = await Promise.all([
            listMyTemplateLikes(),
            listTemplates({ kind: "video", source: "official", limit: 50 }),
            listTemplates({ kind: "video", source: "community", limit: 50 }),
          ]);
          next = [...official.templates, ...community.templates]
            .filter((template) => slugs.includes(template.slug) && isMotionTemplate(template))
            .map((template) => ({ id: template.slug, url: motionClipOf(template), label: template.title }));
        }
        if (!alive) return;
        setChoices((current) => (page === 1 ? next : [...current, ...next.filter((choice) => !current.some((known) => known.id === choice.id))]));
        setHasMore(more);
      } catch {
        if (alive) setFailed(true);
      } finally {
        if (alive) setLoading(false);
      }
    };
    void run();
    return () => {
      alive = false;
    };
  }, [open, tab, page, source, kind, view, sort]);

  if (!open) return null;

  const addedHere = tab === "uploads" && kind === "image" ? added.filter((entry) => !activeCategory || entry.category === activeCategory).map((entry) => entry.choice) : [];
  const shown = [...addedHere, ...choices.filter((choice) => !gone.has(choice.id))];
  const toggle = (choice: Choice) =>
    setSelected((current) => {
      if (current.some((entry) => entry.id === choice.id)) return current.filter((entry) => entry.id !== choice.id);
      // A panel that takes one swaps the choice instead of refusing the next one.
      if (remaining === 1) return [choice];
      return current.length >= remaining ? current : [...current, choice];
    });
  const confirm = async () => {
    setBusy(true);
    const files = (await Promise.all(selected.map((choice, index) => toFile(choice, index, kind, addedFiles.current.get(choice.id))))).filter((file): file is File => file !== null);
    setBusy(false);
    setSkipped(selected.length - files.length);
    if (files.length) {
      // Images added here keep the group they were added under; the rest take the group chip that is open.
      const groups = selected.map((choice) => added.find((entry) => entry.choice.id === choice.id)?.category ?? activeCategory);
      onPick(files, groups.every((group) => group === groups[0]) ? groups[0] : undefined);
      setSelected([]);
      discardAdded();
    }
    if (files.length === selected.length) onClose();
  };
  function discardAdded() {
    added.forEach((entry) => URL.revokeObjectURL(entry.choice.url));
    addedFiles.current.clear();
    setAdded([]);
  }
  const addFromDevice = (list: FileList | null) => {
    const entries = Array.from(list ?? [])
      .filter((file) => ALLOWED[kind].includes(file.type))
      .map((file) => {
        const choice: Choice = { id: `device-${crypto.randomUUID()}`, url: URL.createObjectURL(file), label: file.name, removable: "device" };
        addedFiles.current.set(choice.id, file);
        return { choice, ...(activeCategory ? { category: activeCategory } : {}) };
      });
    if (entries.length === 0) return;
    setAdded((current) => [...entries, ...current]);
    // What was just added is picked, so adding is one step; the panel's limit still applies.
    setSelected((current) => {
      const next = [...current];
      for (const entry of entries) {
        if (remaining === 1) return [entry.choice];
        if (next.length < remaining) next.push(entry.choice);
      }
      return next;
    });
  };
  const close = () => {
    discardAdded();
    setSelected([]);
    setSkipped(0);
    onClose();
  };
  const removeChoice = async (choice: Choice) => {
    if ((choice.removable === "trash" || choice.removable === "work") && confirmId !== choice.id) {
      setConfirmId(choice.id);
      return;
    }
    setConfirmId(null);
    if (choice.removable === "device") {
      URL.revokeObjectURL(choice.url);
      addedFiles.current.delete(choice.id);
      setAdded((current) => current.filter((entry) => entry.choice.id !== choice.id));
    } else {
      if (choice.removable === "asset" || choice.removable === "trash" || choice.removable === "work") {
        // A group folder only gives the image up (it stays in Assets); "trash" moves it to the trash there, where it can be restored.
        try {
          if (choice.removable === "asset") await updateAsset(choice.id, { folder: null });
          else if (choice.removable === "work" && choice.source) await deleteHistoryItem({ id: choice.id, source: choice.source });
          else await deleteAsset(choice.id);
        } catch {
          setFailed(true);
          return;
        }
      } else if (activeCategory) forgetUploadCategory(choice.url, kind);
      else forgetUpload(choice.url, kind);
      setChoices((current) => current.filter((entry) => entry.id !== choice.id));
    }
    setSelected((current) => current.filter((entry) => entry.id !== choice.id));
  };
  const removeLabel = (choice: Choice) => c(choice.removable === "work" ? (confirmId === choice.id ? "templates.picker.removeWorkConfirm" : "templates.picker.removeWork") : choice.removable === "trash" ? (confirmId === choice.id ? "templates.picker.removeToTrashConfirm" : "templates.picker.removeToTrash") : choice.removable === "device" ? "templates.picker.removeDiscard" : activeCategory ? "templates.picker.removeFromCategory" : "templates.picker.removeFromRecent");
  const markGone = (choice: Choice) => setGone((current) => new Set(current).add(choice.id));
  const isLiked = (choice: Choice) => liked.some((entry) => entry.id === choice.id);
  const toggleLike = (choice: Choice) => {
    // Start from what is stored, so two quick taps never undo each other.
    const stored = readLikedImages();
    const next = stored.some((entry) => entry.id === choice.id) ? stored.filter((entry) => entry.id !== choice.id) : [{ id: choice.id, url: choice.url, label: choice.label }, ...stored];
    setLiked(next);
    writeLikedImages(next);
    // In the Liked tab, taking one away takes it off the grid at once.
    if (tab === "liked" && kind === "image") setChoices((current) => current.filter((entry) => next.some((item) => item.id === entry.id)));
  };

  return createPortal(
    <div className={s.pickerOverlay} role="presentation" onClick={close}>
      <div className={s.mediaPicker} role="dialog" aria-modal="true" aria-label={c("templates.picker.title")} onClick={(event) => event.stopPropagation()}>
        <header>
          <div role="tablist" aria-label={c("templates.picker.title")}>
            {tabs.map((item) => (
              <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} onClick={() => setTab(item.id)}>
                {item.label}
              </button>
            ))}
          </div>
          <button type="button" className={s.pickerClose} onClick={close} aria-label={c("templates.picker.close")}>
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        {kind === "image" && tab === "uploads" && (
          <div className={s.pickerSub}>
            <div role="tablist" aria-label={c("templates.picker.uploads")}>
              {PICKER_VIEWS.map((item) => (
                <button key={item} type="button" role="tab" aria-selected={view === item} onClick={() => setView(item)}>
                  {c(item === "recent" ? "templates.picker.latest" : item === "all" ? "templates.picker.all" : (`templates.picker.category.${item}` as const))}
                </button>
              ))}
            </div>
            <div className={s.pickerSort}>
              <button type="button" className={s.pickerSortButton} aria-haspopup="listbox" aria-expanded={sortOpen} onClick={() => setSortOpen((current) => !current)}>
                <ArrowDownUp size={14} aria-hidden="true" />
                <span>{c("templates.picker.sort")}</span>
                <ChevronDown size={14} aria-hidden="true" />
              </button>
              {sortOpen && (
                <>
                  <button type="button" className={s.pickerSortBackdrop} aria-label={c("templates.picker.close")} onClick={() => setSortOpen(false)} />
                  <ul className={s.pickerSortMenu} role="listbox" aria-label={c("templates.picker.sort")}>
                    {(["newest", "oldest"] as const).map((item) => (
                      <li key={item} role="option" aria-selected={sort === item}>
                        <button type="button" onClick={() => { setSort(item); setSortOpen(false); }}>
                          {item === "newest" ? <Clock3 size={16} aria-hidden="true" /> : <ArrowDownUp size={16} aria-hidden="true" />}
                          <span>{c(item === "newest" ? "templates.picker.newest" : "templates.picker.oldest")}</span>
                          {sort === item && <Check size={16} aria-hidden="true" />}
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>
        )}
        {tab === "presets" && (
          <div className={s.pickerSub} role="tablist" aria-label={c("templates.picker.presets")}>
            {(["official", "community"] as const).map((item) => (
              <button key={item} type="button" role="tab" aria-selected={source === item} onClick={() => setSource(item)}>
                {c(item === "official" ? "templates.picker.official" : "templates.picker.community")}
              </button>
            ))}
          </div>
        )}
        <input
          ref={uploadInputRef}
          className={s.visuallyHidden}
          type="file"
          multiple
          accept={ALLOWED.image.join(",")}
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => {
            addFromDevice(event.currentTarget.files);
            event.currentTarget.value = "";
          }}
        />
        <div className={s.pickerGrid}>
          {(tab === "recent" || (kind === "image" && tab === "uploads")) && (
            <button type="button" className={s.pickerUpload} onClick={() => { if (kind === "image") uploadInputRef.current?.click(); else { close(); onUploadFromDevice(activeCategory); } }}>
              {kind === "video" ? <Upload size={22} aria-hidden="true" /> : <ImagePlus size={22} aria-hidden="true" />}
              <span>{c("templates.picker.upload")}</span>
            </button>
          )}
          {shown.map((choice) => {
            const on = selected.some((entry) => entry.id === choice.id);
            return (
              <div key={choice.id} className={s.pickerCell}>
              <button type="button" className={`${s.pickerItem} ${on ? s.pickerItemOn : ""}`} aria-pressed={on} onClick={() => toggle(choice)} title={choice.label}>
                {kind === "video" ? (
                  <>
                    <video src={choice.url} muted playsInline preload="metadata" aria-hidden="true" tabIndex={-1} onError={() => markGone(choice)} />
                    <b aria-hidden="true"><Play size={14} fill="currentColor" /></b>
                  </>
                ) : (
                  <Image src={choice.url} alt="" fill unoptimized sizes="140px" onError={() => markGone(choice)} />
                )}
                {on && (
                  <i aria-hidden="true">
                    <Check size={14} />
                  </i>
                )}
              </button>
              {choice.removable && (
                <button type="button" className={`${s.pickerRemove} ${confirmId === choice.id ? s.pickerRemoveConfirm : ""}`} aria-label={removeLabel(choice)} title={removeLabel(choice)} onClick={() => void removeChoice(choice)}>
                  {confirmId === choice.id ? <span>{c("templates.picker.removeConfirmShort")}</span> : <X size={14} aria-hidden="true" />}
                </button>
              )}
              {kind === "image" && (
                <button type="button" className={`${s.pickerHeart} ${isLiked(choice) ? s.pickerHeartOn : ""}`} aria-pressed={isLiked(choice)} aria-label={c(isLiked(choice) ? "templates.picker.unlike" : "templates.picker.like")} onClick={() => toggleLike(choice)}>
                  <Heart size={14} fill={isLiked(choice) ? "currentColor" : "none"} aria-hidden="true" />
                </button>
              )}
              </div>
            );
          })}
        </div>
        {loading && (
          <p className={s.pickerNote}>
            <Loader2 size={15} aria-hidden="true" /> {c("templates.picker.loading")}
          </p>
        )}
        {!loading && failed && <p className={`${s.pickerNote} ${s.sendError}`}>{c("templates.picker.failed")}</p>}
        {!loading && !failed && shown.length === 0 && <p className={s.pickerNote}>{tab === "uploads" && kind === "image" && isPickerCategory(view) ? c("templates.picker.categoryEmpty", { folder: CATEGORY_FOLDERS[view] }) : c(tab === "liked" && kind === "image" ? "templates.picker.likedEmpty" : "templates.picker.empty")}</p>}
        {!loading && !failed && shown.length === 0 && tab === "uploads" && kind === "image" && isPickerCategory(view) && (
          // The latest uploads of this browser first (that is where images added here are), else everything saved in Assets.
          <button type="button" className={s.showMore} onClick={() => setView(readRecentUploads(kind).length > 0 ? "recent" : "all")}>
            {c("templates.picker.showAll")}
          </button>
        )}
        {hasMore && !loading && (
          <button type="button" className={s.showMore} onClick={() => setPage((current) => current + 1)}>
            {c("templates.picker.more")}
          </button>
        )}
        <footer>
          <small className={skipped ? s.sendError : undefined}>
            {skipped ? c("templates.picker.skipped", { count: skipped }) : c("templates.picker.left", { count: Math.max(0, remaining - selected.length) })}
          </small>
          <button type="button" className={s.pickerConfirm} disabled={selected.length === 0 || busy} onClick={() => void confirm()}>
            {busy ? <Loader2 size={15} aria-hidden="true" /> : null}
            {c("templates.picker.add", { count: selected.length })}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
