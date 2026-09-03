"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Check, CheckCircle2, LoaderCircle, PlayCircle, RefreshCw, Trash2, Upload, Video, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { deleteAdminTutorial, deleteAdminTutorialUpload, listAdminTutorials, saveAdminTutorial, uploadAdminTutorial, type AdminTutorialSlot, type UploadedAdminTutorial } from "@/lib/api/tutorials";

const tutorialAccept = "video/mp4,video/webm,video/quicktime,video/x-m4v,video/ogg,.mp4,.webm,.mov,.m4v,.ogv";

function formatBytes(value: number | null): string {
  if (!value || value <= 0) return "—";
  const megabytes = value / (1024 * 1024);
  return `${megabytes >= 10 ? Math.round(megabytes) : megabytes.toFixed(1).replace(/\.0$/, "")} MB`;
}

function slotKey(slot: AdminTutorialSlot): string {
  return `${slot.feature}:${slot.mode ?? "feature"}`;
}

function slotLabel(slot: AdminTutorialSlot): string {
  return slot.modeName ?? "Feature overview";
}

function TutorialSlotRow({ slot, busy, onOpen }: { slot: AdminTutorialSlot; busy: boolean; onOpen: (slot: AdminTutorialSlot) => void }) {
  const hasVideo = Boolean(slot.videoStorageKey);

  return <div className="flex flex-col gap-3 px-1 py-3 sm:flex-row sm:items-center sm:justify-between">
    <div className="flex min-w-0 items-center gap-3">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${hasVideo ? "bg-[#fff0e9] text-primary" : "bg-[#f7f3f0] text-muted-foreground"}`}><Video size={16} /></span>
      <div className="min-w-0">
        <p className="truncate text-xs font-bold">{slotLabel(slot)}</p>
        <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{slot.mode ? `${slot.feature} · ${slot.mode}` : "General feature tutorial"}{hasVideo ? ` · ${formatBytes(slot.sizeBytes)}` : " · No video uploaded"}</p>
      </div>
    </div>
    <div className="flex shrink-0 items-center gap-2">
      {hasVideo ? <Badge tone={slot.enabled ? "success" : "neutral"}>{slot.enabled ? "Enabled" : "Disabled"}</Badge> : <Badge tone="warning">Not uploaded</Badge>}
      <Button variant="outline" size="sm" onClick={() => onOpen(slot)} disabled={busy}><PlayCircle size={14} /> {hasVideo ? "Manage / view" : "Upload tutorial"}</Button>
    </div>
  </div>;
}

function TutorialDialog({ slot, busy, onClose, onSaved, onRemoved, onBusyChange }: { slot: AdminTutorialSlot; busy: boolean; onClose: () => void; onSaved: (slot: AdminTutorialSlot) => void; onRemoved: (slot: AdminTutorialSlot) => void; onBusyChange: (busy: boolean) => void }) {
  const [pendingUpload, setPendingUpload] = useState<UploadedAdminTutorial | null>(null);
  const [enabled, setEnabled] = useState(slot.id ? slot.enabled : true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const previewUrl = pendingUpload?.videoUrl ?? slot.videoUrl;
  const hasChanges = Boolean(pendingUpload) || (Boolean(slot.id) && enabled !== slot.enabled);

  const cleanupPendingUpload = () => {
    if (pendingUpload) void deleteAdminTutorialUpload(pendingUpload.storageKey).catch(() => undefined);
    setPendingUpload(null);
  };

  const close = () => {
    cleanupPendingUpload();
    onClose();
  };

  const upload = async (file: File) => {
    setUploading(true);
    onBusyChange(true);
    setError("");
    setMessage("");
    try {
      const uploaded = await uploadAdminTutorial(file);
      if (pendingUpload) await deleteAdminTutorialUpload(pendingUpload.storageKey).catch(() => undefined);
      setPendingUpload(uploaded);
      setMessage("Video uploaded temporarily. Press Save to apply it.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to upload tutorial video");
    } finally {
      setUploading(false);
      onBusyChange(false);
    }
  };

  const save = async () => {
    const storageKey = pendingUpload?.storageKey ?? slot.videoStorageKey;
    if (!storageKey) {
      setError("Please upload a tutorial video first.");
      return;
    }
    setSaving(true);
    onBusyChange(true);
    setError("");
    setMessage("");
    try {
      const saved = await saveAdminTutorial(slot.feature, {
        ...(slot.mode ? { mode: slot.mode } : {}),
        storageKey,
        sizeBytes: pendingUpload?.sizeBytes ?? slot.sizeBytes ?? undefined,
        ...(slot.title ? { title: slot.title } : {}),
        ...(slot.description ? { description: slot.description } : {}),
        enabled,
      });
      setPendingUpload(null);
      onSaved(saved);
      setMessage("Tutorial saved.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save tutorial video");
    } finally {
      setSaving(false);
      onBusyChange(false);
    }
  };

  const remove = async () => {
    if (!slot.id || !window.confirm(`Remove the ${slot.modeName ? `${slot.modeName} ` : ""}${slot.featureName} tutorial?`)) return;
    setSaving(true);
    onBusyChange(true);
    setError("");
    setMessage("");
    try {
      await deleteAdminTutorial(slot.feature, slot.mode ?? undefined);
      cleanupPendingUpload();
      onRemoved({ ...slot, id: null, title: null, description: null, videoUrl: null, videoStorageKey: null, mimeType: null, sizeBytes: null, enabled: false, createdAt: null, updatedAt: null });
      setMessage("Tutorial removed.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to remove tutorial");
    } finally {
      setSaving(false);
      onBusyChange(false);
    }
  };

  return <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#201d1b]/45 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="tutorial-dialog-title">
    <div className="flex max-h-[min(760px,calc(100vh-32px))] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-[#eaded6] bg-[#faf8f6] shadow-[0_24px_80px_rgba(68,49,36,0.25)]">
      <header className="flex items-start justify-between gap-4 border-b border-border bg-white px-5 py-4 sm:px-7">
        <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-primary">{slot.mode ? "Mode tutorial" : "Feature tutorial"}</p><h2 id="tutorial-dialog-title" className="mt-1 truncate text-xl font-bold tracking-tight">{slot.featureName} · {slotLabel(slot)}</h2><p className="mt-1 truncate font-mono text-[10px] text-muted-foreground">{slot.feature}{slot.mode ? ` · ${slot.mode}` : ""}</p></div>
        <button type="button" onClick={close} className="rounded-xl p-2 text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground" aria-label="Close tutorial dialog"><X size={19} /></button>
      </header>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5 sm:p-7">
        <div className="flex aspect-video items-center justify-center overflow-hidden rounded-2xl border border-border bg-[#201d1b]">
          {previewUrl ? <video key={previewUrl} src={previewUrl} controls playsInline preload="metadata" className="h-full w-full object-contain" aria-label={`${slot.featureName} ${slotLabel(slot)} tutorial`} /> : <div className="flex flex-col items-center gap-2 text-white/60"><Video size={30} /><p className="text-xs">No tutorial video yet</p></div>}
        </div>

        <div className="rounded-2xl border border-[#f1c7b5] bg-[#fffaf7] p-4">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><p className="text-sm font-bold">Tutorial video</p><p className="mt-1 text-[11px] leading-5 text-muted-foreground">เลือกไฟล์ใหม่เพื่อเปลี่ยนวิดีโอ แล้วกด Save เพื่อเผยแพร่</p></div><label className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary px-3 text-[11px] font-bold text-white transition hover:bg-primary/85 has-[:disabled]:pointer-events-none has-[:disabled]:opacity-50"><Upload size={14} /> {uploading ? "Uploading..." : slot.videoStorageKey ? "Replace video" : "Upload video"}<input type="file" className="hidden" accept={tutorialAccept} disabled={busy || uploading} onChange={(event) => { const file = event.target.files?.[0]; event.currentTarget.value = ""; if (file) void upload(file); }} /></label></div>
          {pendingUpload ? <p className="mt-3 text-[10px] font-semibold text-[#347454]">New video ready · {pendingUpload.mimeType.replace("video/", "").toUpperCase()} · {formatBytes(pendingUpload.sizeBytes)}</p> : slot.videoStorageKey ? <p className="mt-3 text-[10px] text-muted-foreground">Current file · {slot.mimeType?.replace("video/", "").toUpperCase() ?? "VIDEO"} · {formatBytes(slot.sizeBytes)}</p> : null}
        </div>

        <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-border bg-white p-4"><span><span className="block text-xs font-bold">Publish tutorial</span><span className="mt-1 block text-[11px] text-muted-foreground">เปิดให้ผู้ใช้ที่เกี่ยวข้องเห็น tutorial นี้</span></span><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} className="h-4 w-4 accent-primary" /></label>
        {error ? <div className="flex items-start gap-2 rounded-xl border border-[#efc2c2] bg-[#fff6f6] p-3 text-xs text-[#9f3b3b]" role="alert"><AlertCircle className="mt-0.5 shrink-0" size={16} /><p>{error}</p></div> : null}
        {message ? <div className="flex items-center gap-2 rounded-xl border border-[#bfe1cc] bg-[#f3fbf5] p-3 text-xs font-semibold text-[#347454]" role="status"><CheckCircle2 size={16} /><p>{message}</p></div> : null}
      </div>

      <footer className="flex flex-col-reverse justify-between gap-3 border-t border-border bg-white px-5 py-4 sm:flex-row sm:items-center sm:px-7"><div>{slot.id ? <Button variant="ghost" size="sm" onClick={() => void remove()} disabled={busy} className="text-[#9f3b3b] hover:bg-[#fff6f6] hover:text-[#9f3b3b]"><Trash2 size={14} /> Remove</Button> : null}</div><div className="flex items-center justify-end gap-2"><Button variant="ghost" size="sm" onClick={close} disabled={busy}>Cancel</Button><Button size="sm" onClick={() => void save()} disabled={busy || !hasChanges}>{saving ? <LoaderCircle size={14} className="animate-spin" /> : <Check size={14} />} {saving ? "Saving..." : "Save tutorial"}</Button></div></footer>
    </div>
  </div>;
}

export function FeatureTutorialPanel({ feature, featureName, includeFeatureOverview = true }: { feature: string; featureName: string; includeFeatureOverview?: boolean }) {
  const [slots, setSlots] = useState<AdminTutorialSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setSlots(await listAdminTutorials(feature));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load tutorial videos");
    } finally {
      setLoading(false);
    }
  }, [feature]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const visibleSlots = includeFeatureOverview ? slots : slots.filter((slot) => Boolean(slot.mode));
  const activeSlot = useMemo(() => visibleSlots.find((slot) => slotKey(slot) === activeKey) ?? null, [activeKey, visibleSlots]);
  const configuredCount = visibleSlots.filter((slot) => Boolean(slot.videoStorageKey)).length;
  const updateSlot = (next: AdminTutorialSlot) => setSlots((current) => current.map((slot) => slotKey(slot) === slotKey(next) ? next : slot));

  return <section aria-labelledby="feature-tutorial-heading" className="mb-7 rounded-3xl border border-[#eaded6] bg-white p-5 shadow-[0_8px_24px_rgba(68,49,36,0.04)] sm:p-6">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
      <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Feature tutorial</p><h2 id="feature-tutorial-heading" className="mt-1 text-xl font-bold tracking-tight">{featureName} tutorial videos</h2><p className="mt-1 text-[11px] text-muted-foreground">จัดการ tutorial ของ feature และ mode ใน popup</p></div>
      <div className="flex items-center gap-2"><span className="rounded-full bg-[#fff0e9] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-primary">{configuredCount}/{slots.length || "—"} uploaded</span><Button variant="ghost" size="sm" onClick={() => void load()} disabled={loading || Boolean(busyKey)} aria-label="Refresh tutorial videos"><RefreshCw size={14} className={loading ? "animate-spin" : undefined} /></Button></div>
    </div>

    {error ? <div className="mt-4 flex items-start gap-2 rounded-xl border border-[#efc2c2] bg-[#fff6f6] p-3 text-xs text-[#9f3b3b]" role="alert"><AlertCircle className="mt-0.5 shrink-0" size={16} /><p>{error}</p></div> : null}
    {message ? <div className="mt-4 flex items-center gap-2 rounded-xl border border-[#bfe1cc] bg-[#f3fbf5] p-3 text-xs font-semibold text-[#347454]" role="status"><CheckCircle2 size={16} /><p>{message}</p></div> : null}
    {loading ? <div className="mt-4 flex items-center justify-center rounded-2xl border border-dashed border-[#d8d0ca] p-6 text-xs text-muted-foreground"><LoaderCircle size={16} className="mr-2 animate-spin" /> Loading tutorial slots...</div> : visibleSlots.length ? <div className="mt-4 divide-y divide-border rounded-2xl border border-border bg-[#fcfaf8] px-3">{visibleSlots.map((slot) => <TutorialSlotRow key={slotKey(slot)} slot={slot} busy={busyKey === slotKey(slot)} onOpen={(current) => { setActiveKey(slotKey(current)); setMessage(""); setError(""); }} />)}</div> : <div className="mt-4 rounded-2xl border border-dashed border-[#d8d0ca] p-6 text-center text-xs text-muted-foreground">No tutorial slots available for this feature.</div>}
    <p className="mt-3 text-[10px] text-muted-foreground">กดปุ่มด้านขวาเพื่อเปิด popup สำหรับดูวิดีโอ อัปโหลด และ Save</p>
    {activeSlot ? <TutorialDialog key={slotKey(activeSlot)} slot={activeSlot} busy={busyKey === slotKey(activeSlot)} onClose={() => setActiveKey(null)} onSaved={(saved) => { updateSlot(saved); setMessage(`${saved.featureName}${saved.modeName ? ` · ${saved.modeName}` : ""} tutorial saved.`); }} onRemoved={(removed) => { updateSlot(removed); setMessage(`${removed.featureName}${removed.modeName ? ` · ${removed.modeName}` : ""} tutorial removed.`); }} onBusyChange={(isBusy) => setBusyKey(isBusy ? slotKey(activeSlot) : null)} /> : null}
  </section>;
}
