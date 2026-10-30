"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowDownUp, Check, ChevronDown, Clock3, Heart, ImagePlus, Loader2, Play, Upload, X } from "lucide-react";
import { fetchAssets } from "@/lib/api/assets";
import { fetchHistory } from "@/lib/api/history";
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

const LIKED_KEY = "eos.templates.likedImages";
type Recent = { url: string; at: number };
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
type Choice = { id: string; url: string; label: string };
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
export function rememberUploads(urls: string[], kind: MediaKind = "image") {
  try {
    const now = Date.now();
    const known = readRecentUploads(kind).filter((entry) => !urls.includes(entry.url));
    const next = [...urls.map((url) => ({ url, at: now })), ...known].slice(0, RECENT_MAX);
    window.localStorage.setItem(RECENT_KEY[kind], JSON.stringify(next));
  } catch {
    // Remembering is a convenience; the page works without it.
  }
}

async function toFile(choice: Choice, index: number, kind: MediaKind): Promise<File | null> {
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
  onPick: (files: File[]) => void;
  onUploadFromDevice: () => void;
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
  const [view, setView] = useState<"recent" | "all">("recent");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
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
          next = (sort === "oldest" ? [...recent].reverse() : recent).map((entry, index) => ({ id: entry.url, url: entry.url, label: `upload-${index + 1}` }));
        } else if (tab === "uploads") {
          const result = await fetchAssets({ tab: "mine", type: "image", limit: PAGE, page, sort });
          next = result.assets.map((asset) => ({ id: asset.id, url: asset.url ?? asset.previewUrl ?? "", label: asset.title || "asset" })).filter((choice) => choice.url);
          more = page < result.pagination.totalPages;
        } else if (tab === "generated") {
          const result = await fetchHistory({ type: kind, status: "completed", limit: PAGE, offset: (page - 1) * PAGE });
          next = result.items.filter((item) => item.outputUrl).map((item) => ({ id: item.id, url: item.outputUrl as string, label: item.title || kind }));
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

  const shown = choices.filter((choice) => !gone.has(choice.id));
  const toggle = (choice: Choice) =>
    setSelected((current) => {
      if (current.some((entry) => entry.id === choice.id)) return current.filter((entry) => entry.id !== choice.id);
      // A panel that takes one swaps the choice instead of refusing the next one.
      if (remaining === 1) return [choice];
      return current.length >= remaining ? current : [...current, choice];
    });
  const confirm = async () => {
    setBusy(true);
    const files = (await Promise.all(selected.map((choice, index) => toFile(choice, index, kind)))).filter((file): file is File => file !== null);
    setBusy(false);
    setSkipped(selected.length - files.length);
    if (files.length) {
      onPick(files);
      setSelected([]);
    }
    if (files.length === selected.length) onClose();
  };
  const close = () => {
    setSelected([]);
    setSkipped(0);
    onClose();
  };
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
              {(["recent", "all"] as const).map((item) => (
                <button key={item} type="button" role="tab" aria-selected={view === item} onClick={() => setView(item)}>
                  {c(item === "recent" ? "templates.picker.latest" : "templates.picker.all")}
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
        <div className={s.pickerGrid}>
          {(tab === "recent" || (kind === "image" && tab === "uploads")) && (
            <button type="button" className={s.pickerUpload} onClick={() => { close(); onUploadFromDevice(); }}>
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
        {!loading && !failed && shown.length === 0 && <p className={s.pickerNote}>{c(tab === "liked" && kind === "image" ? "templates.picker.likedEmpty" : "templates.picker.empty")}</p>}
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
