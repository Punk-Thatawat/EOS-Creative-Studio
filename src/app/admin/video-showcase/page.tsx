"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, Check, CheckCircle2, Clapperboard, FileVideo, LoaderCircle, Plus, RefreshCw, Save, Trash2, Upload, X } from "lucide-react";
import { SidebarNavigation } from "@/components/app-shell/navigation";
import { StudioHeader } from "@/components/app-shell/studio-header";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { createAdminVideoShowcase, deleteAdminVideoShowcase, deleteAdminVideoShowcaseUpload, listAdminVideoShowcase, updateAdminVideoShowcase, uploadAdminVideoShowcase, type VideoShowcaseExample } from "@/lib/api/video-showcase";

type Draft = {
  id?: string;
  label: string;
  videoUrl: string;
  videoStorageKey?: string | null;
  sizeBytes?: number | null;
  sortOrder: number;
  enabled: boolean;
};

const emptyDraft: Draft = { label: "", videoUrl: "", videoStorageKey: null, sizeBytes: null, sortOrder: 0, enabled: true };

function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return "External URL";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function VideoShowcaseEditor({ draft, busy, uploading, onChange, onUpload, onSave, onClose }: { draft: Draft; busy: boolean; uploading: boolean; onChange: (next: Draft) => void; onUpload: (file: File) => void; onSave: () => void; onClose: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaUrl = draft.videoUrl.trim();
  const hasMedia = Boolean(draft.videoStorageKey || mediaUrl);

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#201d1b]/45 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="video-showcase-editor-title">
    <div className="flex max-h-[min(760px,calc(100vh-32px))] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-[#eaded6] bg-[#faf8f6] shadow-[0_24px_80px_rgba(68,49,36,0.25)]">
      <header className="flex items-start justify-between gap-4 border-b border-border bg-white px-5 py-4 sm:px-7 sm:py-5"><div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-primary">Video showcase editor</p><h2 id="video-showcase-editor-title" className="mt-1 text-xl font-bold tracking-tight">{draft.id ? "Edit showcase video" : "Add showcase video"}</h2><p className="mt-1 text-xs text-muted-foreground">This item appears in “See what you can create” when it is enabled.</p></div><button type="button" onClick={onClose} className="rounded-xl p-2 text-muted-foreground hover:bg-surface-muted" aria-label="Close video showcase editor"><X size={19} /></button></header>
      <form onSubmit={(event) => { event.preventDefault(); onSave(); }} className="min-h-0 flex-1 overflow-y-auto">
        <div className="space-y-5 p-5 sm:p-7">
          <div className="grid gap-4 sm:grid-cols-[1fr_150px]"><label className="text-xs font-semibold">Label<input value={draft.label} onChange={(event) => onChange({ ...draft, label: event.target.value })} maxLength={80} required className="mt-2 h-10 w-full rounded-xl border border-border bg-white px-3 text-sm outline-none focus:border-primary" placeholder="PRODUCT AD" /></label><label className="text-xs font-semibold">Sort order<input type="number" min={0} max={100000} value={draft.sortOrder} onChange={(event) => onChange({ ...draft, sortOrder: Number(event.target.value) })} className="mt-2 h-10 w-full rounded-xl border border-border bg-white px-3 text-sm outline-none focus:border-primary" /></label></div>
          <section className="rounded-2xl border border-border bg-white p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold">Video file</p><p className="mt-1 text-[10px] text-muted-foreground">MP4, WebM, MOV, M4V, or OGV · max 500 MB</p></div><input ref={fileInputRef} type="file" accept=".mp4,.webm,.mov,.m4v,.ogv,video/mp4,video/webm,video/quicktime,video/x-m4v,video/ogg" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) onUpload(file); event.currentTarget.value = ""; }} /><Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={busy || uploading}><Upload size={15} />{uploading ? "Uploading…" : "Upload video"}</Button></div>{draft.videoStorageKey ? <p className="mt-3 break-all rounded-xl bg-[#f3fbf5] px-3 py-2 text-[10px] text-[#347454]">Uploaded: {draft.videoStorageKey} · {formatBytes(draft.sizeBytes)}</p> : null}</section>
          <div className="relative flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border"><span>or use URL</span></div>
          <label className="block text-xs font-semibold">Video URL<input value={draft.videoUrl} onChange={(event) => onChange({ ...draft, videoUrl: event.target.value, videoStorageKey: null, sizeBytes: null })} className="mt-2 h-10 w-full rounded-xl border border-border bg-white px-3 text-sm outline-none focus:border-primary" placeholder="/uploaded-videos/product-ad.mp4 or https://…" /><span className="mt-1 block text-[10px] font-normal text-muted-foreground">Use a public URL ending in .mp4, .webm, .mov, .m4v, or .ogv.</span></label>
          {hasMedia ? <div className="overflow-hidden rounded-2xl border border-border bg-[#201d1b]"><video key={draft.videoStorageKey ?? mediaUrl} src={mediaUrl || undefined} controls muted playsInline className="aspect-video w-full object-contain" /></div> : <div className="flex aspect-video items-center justify-center rounded-2xl border border-dashed border-[#d8d0ca] bg-white text-xs text-muted-foreground"><FileVideo size={20} className="mr-2 text-primary" />Upload a video or enter a URL</div>}
          <button type="button" onClick={() => onChange({ ...draft, enabled: !draft.enabled })} className={`flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left text-xs font-semibold ${draft.enabled ? "border-[#bfe1cc] bg-[#f3fbf5] text-[#347454]" : "border-border bg-white text-muted-foreground"}`} aria-pressed={draft.enabled}><span><b>{draft.enabled ? "Enabled" : "Disabled"}</b><small className="mt-1 block font-normal">Disabled videos are hidden from the public carousel.</small></span><span className={`flex h-5 w-5 items-center justify-center rounded-full border ${draft.enabled ? "border-[#4c9b72] bg-[#4c9b72] text-white" : "border-border"}`}>{draft.enabled ? <Check size={13} strokeWidth={3} /> : null}</span></button>
        </div>
        <footer className="flex justify-end gap-2 border-t border-border bg-white px-5 py-4 sm:px-7"><Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={busy}>Cancel</Button><Button type="submit" size="sm" disabled={busy || uploading || !draft.label.trim() || !hasMedia}>{busy ? <LoaderCircle size={15} className="animate-spin" /> : <Save size={15} />} {busy ? "Saving..." : "Save video"}</Button></footer>
      </form>
    </div>
  </div>;
}

function AdminVideoShowcaseContent() {
  const [videos, setVideos] = useState<VideoShowcaseExample[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const pendingUploadRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setVideos(await listAdminVideoShowcase()); } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to load showcase videos"); } finally { setLoading(false); }
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);

  const openCreate = () => { setError(""); setMessage(""); setDraft({ ...emptyDraft, sortOrder: videos.length ? Math.max(...videos.map((video) => video.sortOrder)) + 10 : 10 }); };
  const openEdit = (video: VideoShowcaseExample) => { setError(""); setMessage(""); setDraft({ id: video.id, label: video.label, videoUrl: video.videoStorageKey ? "" : video.videoUrl ?? "", videoStorageKey: video.videoStorageKey, sizeBytes: video.sizeBytes, sortOrder: video.sortOrder, enabled: video.enabled }); };

  const upload = async (file: File) => {
    setUploading(true); setError(""); setMessage("");
    try {
      if (pendingUploadRef.current) await deleteAdminVideoShowcaseUpload(pendingUploadRef.current).catch(() => undefined);
      const uploaded = await uploadAdminVideoShowcase(file);
      pendingUploadRef.current = uploaded.storageKey;
      setDraft((current) => current ? { ...current, videoUrl: "", videoStorageKey: uploaded.storageKey, sizeBytes: uploaded.sizeBytes } : current);
      setMessage("Video uploaded. Save the item to apply it.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to upload showcase video"); } finally { setUploading(false); }
  };

  const closeDraft = async () => {
    if (uploading) return;
    setBusy(true); setError("");
    if (pendingUploadRef.current) await deleteAdminVideoShowcaseUpload(pendingUploadRef.current).catch(() => undefined);
    pendingUploadRef.current = null;
    setDraft(null); setBusy(false);
  };

  const save = async () => {
    if (!draft || uploading) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const media = draft.videoStorageKey ? { storageKey: draft.videoStorageKey, sizeBytes: draft.sizeBytes ?? undefined } : { videoUrl: draft.videoUrl.trim() };
      if (!draft.id && !media.videoUrl && !media.storageKey) throw new Error("A video file or URL is required");
      const input = { label: draft.label.trim(), ...media, sortOrder: draft.sortOrder, enabled: draft.enabled };
      const pendingUpload = pendingUploadRef.current;
      const saved = draft.id ? await updateAdminVideoShowcase(draft.id, input) : await createAdminVideoShowcase(input);
      if (pendingUpload && pendingUpload !== saved.videoStorageKey) await deleteAdminVideoShowcaseUpload(pendingUpload).catch(() => undefined);
      pendingUploadRef.current = null;
      setVideos((current) => (draft.id ? current.map((item) => item.id === saved.id ? saved : item) : [...current, saved]).sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt)));
      setDraft(null); setMessage(`${saved.label} saved.`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to save showcase video"); } finally { setBusy(false); }
  };

  const remove = async (video: VideoShowcaseExample) => {
    if (!window.confirm(`Delete ${video.label}? It will disappear from the public carousel.`)) return;
    setBusy(true); setError(""); setMessage("");
    try { await deleteAdminVideoShowcase(video.id); setVideos((current) => current.filter((item) => item.id !== video.id)); setMessage(`${video.label} deleted.`); } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to delete showcase video"); } finally { setBusy(false); }
  };

  return <SidebarProvider><div className="min-h-screen w-full min-w-0 bg-background"><SidebarNavigation /><div className="min-w-0 lg:pl-[var(--sidebar-width)]"><StudioHeader /><main className="page-gutter mx-auto w-full max-w-[1600px] py-5 lg:py-8"><div className="min-h-[calc(100vh-120px)] overflow-x-clip rounded-3xl bg-[#faf8f6] px-4 pb-20 sm:px-6 lg:px-8 lg:pb-24"><div className="mx-auto max-w-[1180px] pt-6 lg:pt-8">
    <div className="mb-8 flex flex-col justify-between gap-5 lg:flex-row lg:items-end"><div><div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#201d1b] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white"><Clapperboard size={13} /> Control plane</div><h1 className="max-w-xl text-3xl font-bold tracking-tight sm:text-4xl">Video showcase</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Manage the videos shown in the public “See what you can create” carousel.</p></div><div className="flex flex-wrap justify-end gap-2"><Button variant="outline" size="lg" onClick={() => void load()} disabled={loading || busy}><RefreshCw size={16} className={loading ? "animate-spin" : undefined} /> Refresh</Button><Button size="lg" onClick={openCreate} disabled={busy}><Plus size={17} /> Add video</Button></div></div>
    {error ? <div className="mb-5 flex items-start gap-3 rounded-2xl border border-[#efc2c2] bg-[#fff6f6] p-4 text-sm text-[#9f3b3b]" role="alert"><AlertCircle size={18} className="mt-0.5 shrink-0" /><p>{error}</p></div> : null}{message ? <div className="mb-5 flex items-center gap-3 rounded-2xl border border-[#bfe1cc] bg-[#f3fbf5] p-4 text-sm text-[#347454]" role="status"><CheckCircle2 size={18} /><p className="font-semibold">{message}</p></div> : null}
    <div className="mb-5 flex items-center justify-between gap-3"><p className="text-xs font-semibold">{loading ? "Loading videos..." : `${videos.length} showcase video${videos.length === 1 ? "" : "s"}`}</p><p className="text-[10px] text-muted-foreground">Lower sort order appears first</p></div>
    {loading ? <div className="grid gap-4 md:grid-cols-2"><div className="h-72 animate-pulse rounded-2xl border border-border bg-white" /><div className="h-72 animate-pulse rounded-2xl border border-border bg-white" /></div> : videos.length === 0 ? <div className="rounded-2xl border border-dashed border-[#d8d0ca] bg-white p-12 text-center"><FileVideo className="mx-auto text-primary" size={30} /><p className="mt-3 text-sm font-bold">No showcase videos</p><p className="mt-1 text-xs text-muted-foreground">Add a video to populate the public carousel.</p></div> : <div className="grid gap-4 md:grid-cols-2">{videos.map((video) => <article key={video.id} className={`overflow-hidden rounded-2xl border bg-white ${video.enabled ? "border-border" : "border-dashed border-[#d8d0ca] opacity-70"}`}><div className="relative bg-[#201d1b]"><video src={video.videoUrl ?? undefined} controls muted playsInline preload="metadata" className="aspect-video w-full object-contain" /><span className="absolute left-3 top-3 rounded-full bg-white/90 px-2 py-1 text-[10px] font-bold text-[#347454]">{video.enabled ? "Enabled" : "Disabled"}</span></div><div className="p-5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="truncate text-base font-bold">{video.label}</h2><p className="mt-1 truncate text-[10px] text-muted-foreground">{video.videoStorageKey ? "Uploaded to workspace storage" : video.videoUrl}</p></div><span className="shrink-0 rounded-md bg-[#fff0e9] px-2 py-1 text-[10px] font-semibold text-primary">Order {video.sortOrder}</span></div><div className="mt-4 flex items-center justify-between border-t border-border pt-3"><span className="text-[10px] text-muted-foreground">{formatBytes(video.sizeBytes)} · {video.mimeType}</span><div className="flex gap-1"><Button variant="ghost" size="sm" onClick={() => openEdit(video)} disabled={busy}>Edit</Button><Button variant="ghost" size="sm" onClick={() => void remove(video)} disabled={busy}><Trash2 size={14} /> Delete</Button></div></div></div></article>)}</div>}
    </div></div></main></div></div>{draft ? <VideoShowcaseEditor draft={draft} busy={busy} uploading={uploading} onChange={setDraft} onUpload={(file) => void upload(file)} onSave={() => void save()} onClose={() => void closeDraft()} /> : null}</SidebarProvider>;
}

export default function AdminVideoShowcasePage() {
  return <Suspense fallback={<div className="min-h-screen bg-background" />}><AdminVideoShowcaseContent /></Suspense>;
}
