"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Loader2, Play, Upload, X } from "lucide-react";
import { deleteHistoryItem, fetchHistory, type HistoryItem } from "@/lib/api/history";
import { listTemplates, type CreativeTemplate, type TemplateSource } from "@/lib/api/templates";
import { listMyTemplateLikes } from "@/lib/api/template-likes";
import { useStudioCopy } from "@/lib/i18n/studio-copy";
import s from "./templates-page.module.css";

const RECENT_KEY = "eos.templates.recentVideoUploads";
const RECENT_TTL_MS = 6 * 24 * 60 * 60 * 1000;
const PAGE = 18;
const VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];
type Recent = { url: string; at: number };
type Choice = { id: string; url: string; label: string; removable?: "recent" | "work"; source?: HistoryItem["source"] };
type Tab = "recent" | "presets" | "generated" | "liked";

function readRecentUploads(): Recent[] {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? "[]");
    if (!Array.isArray(value)) return [];
    const now = Date.now();
    return value.filter((entry): entry is Recent => typeof entry?.url === "string" && typeof entry?.at === "number" && now - entry.at < RECENT_TTL_MS);
  } catch {
    return [];
  }
}

function saveRecent(uploads: Recent[]) {
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(uploads));
  } catch {
    // Recent uploads are optional when browser storage is unavailable.
  }
}

export function rememberVideoUpload(url: string) {
  saveRecent([{ url, at: Date.now() }, ...readRecentUploads().filter((entry) => entry.url !== url)].slice(0, 40));
}

async function toFile(choice: Choice): Promise<File | null> {
  try {
    const response = await fetch(choice.url);
    if (!response.ok) return null;
    const blob = await response.blob();
    if (!VIDEO_TYPES.includes(blob.type)) return null;
    const extension = blob.type === "video/quicktime" ? "mov" : blob.type.split("/")[1];
    return new File([blob], `${choice.label.replace(/[^\w.-]+/g, "-").slice(0, 40) || "video"}-1.${extension}`, { type: blob.type });
  } catch {
    return null;
  }
}

function motionClipOf(template: CreativeTemplate): string {
  const own = template.settings?.sourceVideo;
  return typeof own === "string" && own ? own : (template.previewUrl ?? "");
}

const isMotionTemplate = (template: CreativeTemplate) => /(motion|swap)/i.test(`${String(template.settings?.feature ?? "")} ${template.targetPath}`) && !!motionClipOf(template);
const templateChoice = (template: CreativeTemplate): Choice => ({ id: template.slug, url: motionClipOf(template), label: template.title });

type Props = {
  open: boolean;
  onClose: () => void;
  onPick: (file: File) => void;
  onUploadFromDevice: () => void;
};

export function MotionVideoPicker({ open, ...props }: Props) {
  return open ? <MotionVideoPickerContent {...props} /> : null;
}

function MotionVideoPickerContent({ onClose, onPick, onUploadFromDevice }: Omit<Props, "open">) {
  const { c } = useStudioCopy();
  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "recent", label: c("templates.picker.recent") },
    { id: "presets", label: c("templates.picker.presets") },
    { id: "generated", label: c("templates.picker.videos") },
    { id: "liked", label: c("templates.picker.liked") },
  ];
  const [tab, setTab] = useState<Tab>("recent");
  const [source, setSource] = useState<TemplateSource>("official");
  const [choices, setChoices] = useState<Choice[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<Choice | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const [gone, setGone] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!confirmId) return;
    const timer = window.setTimeout(() => setConfirmId(null), 4000);
    return () => window.clearTimeout(timer);
  }, [confirmId]);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      setLoading(true);
      setFailed(false);
      try {
        let next: Choice[];
        let more = false;
        if (tab === "recent") {
          next = readRecentUploads().map((entry, index) => ({ id: entry.url, url: entry.url, label: `upload-${index + 1}`, removable: "recent" }));
        } else if (tab === "generated") {
          const result = await fetchHistory({ type: "video", status: "completed", limit: PAGE, offset: (page - 1) * PAGE });
          next = result.items.flatMap((item): Choice[] => item.outputUrl ? [{ id: item.id, url: item.outputUrl, label: item.title || "video", removable: "work", source: item.source }] : []);
          more = result.pagination.hasMore;
        } else if (tab === "presets") {
          const result = await listTemplates({ kind: "video", source, limit: 50, sort: "popular" });
          next = result.templates.filter(isMotionTemplate).map(templateChoice);
        } else {
          const [slugs, official, community] = await Promise.all([
            listMyTemplateLikes(),
            listTemplates({ kind: "video", source: "official", limit: 50 }),
            listTemplates({ kind: "video", source: "community", limit: 50 }),
          ]);
          next = [...official.templates, ...community.templates].filter((template) => slugs.includes(template.slug) && isMotionTemplate(template)).map(templateChoice);
        }
        if (!alive) return;
        setChoices((current) => page === 1 ? next : [...current, ...next.filter((choice) => !current.some((known) => known.id === choice.id))]);
        setHasMore(more);
      } catch {
        if (alive) setFailed(true);
      } finally {
        if (alive) setLoading(false);
      }
    };
    void run();
    return () => { alive = false; };
  }, [tab, page, source]);

  const resetPage = () => {
    setConfirmId(null);
    setPage(1);
    setChoices([]);
    setHasMore(false);
    setLoading(true);
  };
  const confirm = async () => {
    if (!selected) return;
    setBusy(true);
    const file = await toFile(selected);
    setBusy(false);
    setSkipped(!file);
    if (file) {
      onPick(file);
      onClose();
    }
  };
  const removeChoice = async (choice: Choice) => {
    if (choice.removable === "work" && confirmId !== choice.id) {
      setConfirmId(choice.id);
      return;
    }
    setConfirmId(null);
    if (choice.removable === "work" && choice.source) {
      try {
        await deleteHistoryItem({ id: choice.id, source: choice.source });
      } catch {
        setFailed(true);
        return;
      }
    } else {
      saveRecent(readRecentUploads().filter((entry) => entry.url !== choice.url));
    }
    setChoices((current) => current.filter((entry) => entry.id !== choice.id));
    setSelected((current) => current?.id === choice.id ? null : current);
  };
  const shown = choices.filter((choice) => !gone.has(choice.id));

  return createPortal(
    <div className={s.pickerOverlay} role="presentation" onClick={onClose}>
      <div className={s.mediaPicker} role="dialog" aria-modal="true" aria-label={c("templates.picker.title")} onClick={(event) => event.stopPropagation()}>
        <header>
          <div role="tablist" aria-label={c("templates.picker.title")}>
            {tabs.map((item) => (
              <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} onClick={() => { if (item.id !== tab) { setTab(item.id); resetPage(); } }}>
                {item.label}
              </button>
            ))}
          </div>
          <button type="button" className={s.pickerClose} onClick={onClose} aria-label={c("templates.picker.close")}><X size={18} aria-hidden="true" /></button>
        </header>
        {tab === "presets" && (
          <div className={s.pickerSub} role="tablist" aria-label={c("templates.picker.presets")}>
            {(["official", "community"] as const).map((item) => (
              <button key={item} type="button" role="tab" aria-selected={source === item} onClick={() => { if (item !== source) { setSource(item); resetPage(); } }}>
                {c(item === "official" ? "templates.picker.official" : "templates.picker.community")}
              </button>
            ))}
          </div>
        )}
        <div className={s.pickerGrid}>
          {tab === "recent" && (
            <button type="button" className={s.pickerUpload} onClick={() => { onClose(); onUploadFromDevice(); }}>
              <Upload size={22} aria-hidden="true" /> <span>{c("templates.picker.upload")}</span>
            </button>
          )}
          {shown.map((choice) => {
            const on = selected?.id === choice.id;
            const removeLabel = choice.removable === "work"
              ? c(confirmId === choice.id ? "templates.picker.removeWorkConfirm" : "templates.picker.removeWork")
              : c("templates.picker.removeFromRecent");
            return (
              <div key={choice.id} className={s.pickerCell}>
                <button type="button" className={`${s.pickerItem} ${on ? s.pickerItemOn : ""}`} aria-pressed={on} onClick={() => setSelected(on ? null : choice)} title={choice.label}>
                  <video src={choice.url} muted playsInline preload="metadata" aria-hidden="true" tabIndex={-1} onError={() => setGone((current) => new Set(current).add(choice.id))} />
                  <b aria-hidden="true"><Play size={14} fill="currentColor" /></b>
                  {on && <i aria-hidden="true"><Check size={14} /></i>}
                </button>
                {choice.removable && (
                  <button type="button" className={`${s.pickerRemove} ${confirmId === choice.id ? s.pickerRemoveConfirm : ""}`} aria-label={removeLabel} title={removeLabel} onClick={() => void removeChoice(choice)}>
                    {confirmId === choice.id ? <span>{c("templates.picker.removeConfirmShort")}</span> : <X size={14} aria-hidden="true" />}
                  </button>
                )}
              </div>
            );
          })}
        </div>
        {loading && <p className={s.pickerNote}><Loader2 size={15} aria-hidden="true" /> {c("templates.picker.loading")}</p>}
        {!loading && failed && <p className={`${s.pickerNote} ${s.sendError}`}>{c("templates.picker.failed")}</p>}
        {!loading && !failed && shown.length === 0 && <p className={s.pickerNote}>{c("templates.picker.empty")}</p>}
        {hasMore && !loading && <button type="button" className={s.showMore} onClick={() => setPage((current) => current + 1)}>{c("templates.picker.more")}</button>}
        <footer>
          <small className={skipped ? s.sendError : undefined}>{skipped ? c("templates.picker.skipped", { count: 1 }) : c("templates.picker.left", { count: selected ? 0 : 1 })}</small>
          <button type="button" className={s.pickerConfirm} disabled={!selected || busy} onClick={() => void confirm()}>
            {busy && <Loader2 size={15} aria-hidden="true" />} {c("templates.picker.add", { count: selected ? 1 : 0 })}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
