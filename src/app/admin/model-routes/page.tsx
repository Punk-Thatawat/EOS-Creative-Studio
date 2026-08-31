"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  CloudDownload,
  AudioWaveform,
  FileText,
  GripVertical,
  LoaderCircle,
  Search,
  ServerCog,
  Settings2,
  X,
} from "lucide-react";
import { SidebarNavigation } from "@/components/app-shell/navigation";
import { SidebarProvider } from "@/components/ui/sidebar";
import { StudioHeader } from "@/components/app-shell/studio-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  listAdminModelRoutesOverview,
  updateAdminModelPreview,
  uploadAdminModelPreview,
  deleteAdminModelPreviewUpload,
  syncGenerationModels,
  updateModelDisplayName,
  updateModelInputLimits,
  updateGenerationModelRoute,
  type AdminModelRoutesOverview,
  type AiBackgroundMode,
  type GenerationModelOption,
  type ModelUploadConstraints,
  type ModelPreviewType,
} from "@/lib/api/generation-models";
import { generateAdminAudioVoicePreview, getAdminAudioSettings, testAdminElevenLabsConnection, testAdminWaveSpeedConnection, updateAdminAudioSettings, type AdminAudioBackgroundMusicPreset, type AdminAudioFeature, type AdminAudioProvider, type AdminAudioSettings, type AdminAudioVoiceProfile, type AdminAudioVoiceSettings } from "@/lib/api/audio";
import { getAdminVideoStoryboardSettings, updateAdminVideoStoryboardSettings, type AdminVideoStoryboardSettings } from "@/lib/api/video-settings";
import { useSearchParams } from "next/navigation";

const imageFunctions = [
  { id: "text-to-image", label: "Text to Image", description: "Create images from a prompt" },
  { id: "image-to-image", label: "Image to Image", description: "Transform an existing image" },
  { id: "style-transfer", label: "Style Transfer", description: "Apply a new visual direction" },
  { id: "background-removal", label: "AI Background", description: "Create or remove backgrounds" },
  { id: "upscale", label: "Upscale", description: "Increase image resolution" },
  { id: "extend-image", label: "Extend Image", description: "Expand the image canvas" },
] as const;

const videoFunctions = [
  { id: "image-to-video", label: "Image to Video", description: "Create videos from images" },
  { id: "text-to-video", label: "Text to Video", description: "Create videos from a prompt" },
  { id: "people-video", label: "People Video", description: "Create videos with people" },
  { id: "motion-transfer", label: "Motion Transfer", description: "Transfer motion to a subject" },
  { id: "lipsync", label: "Lipsync", description: "Synchronize speech and mouth movement" },
  { id: "extend-video", label: "Extend Video", description: "Continue an existing video" },
  { id: "video-to-sfx", label: "Video to SFX", description: "Generate sound effects from a video" },
  { id: "video-to-music", label: "Video to Music", description: "Generate music from a video" },
] as const;

const features = [
  { id: "audio", label: "Audio", description: "Create audio and music", icon: AudioWaveform },
  { id: "document", label: "Document", description: "Create documents and presentations", icon: FileText },
] as const;

const aiBackgroundModes: Array<{ id: AiBackgroundMode; label: string; description: string }> = [
  { id: "remove", label: "Remove", description: "Cut out the subject" },
  { id: "replace", label: "Replace", description: "Swap the scene" },
  { id: "generate", label: "Generate", description: "Create a background" },
  { id: "solid", label: "Solid", description: "Fill with a color" },
];

type FeatureId = (typeof imageFunctions)[number]["id"] | (typeof videoFunctions)[number]["id"] | (typeof features)[number]["id"];

function formatFeature(id: FeatureId) {
  return imageFunctions.find((feature) => feature.id === id)?.label ?? videoFunctions.find((feature) => feature.id === id)?.label ?? features.find((feature) => feature.id === id)?.label ?? id;
}

function ModelInitials({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#201d1b] text-sm font-bold text-white">{initials || "AI"}</span>;
}

type ModelSchemaProperty = {
  type?: string;
  title?: string;
  description?: string;
  default?: unknown;
  enum?: unknown[];
  minimum?: number;
  maximum?: number;
  format?: string;
  [key: string]: unknown;
};

function displaySchemaValue(value: unknown): string {
  if (value === undefined || value === null) return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try { return JSON.stringify(value); } catch { return String(value); }
}

function ModelDetailsDialog({ item, feature, backgroundMode, onClose, onSaveDisplayName, onSaveInputLimits, onSavePreview }: { item: GenerationModelOption; feature: FeatureId; backgroundMode?: AiBackgroundMode; onClose: () => void; onSaveDisplayName: (model: string, provider: string, displayName: string) => Promise<void>; onSaveInputLimits: (model: string, provider: string, limits: ModelUploadConstraints) => Promise<void>; onSavePreview: (model: string, provider: string, preview: { previewUrl: string | null; previewStorageKey: string | null; previewType: ModelPreviewType | null }, backgroundMode?: AiBackgroundMode) => Promise<void> }) {
  const capabilities = item.capabilities;
  const isVideoModel = item.kind === "video" || capabilities.kind === "video";
  const supportedOutputValues = isVideoModel ? capabilities.supportedResolutions ?? [] : capabilities.supportedSizes;
  const properties = capabilities.apiSchema?.request_schema?.properties ?? {};
  const required = new Set(capabilities.apiSchema?.request_schema?.required ?? []);
  const propertyEntries = Object.entries(properties) as [string, ModelSchemaProperty][];
  const uploadConstraints = capabilities.uploadConstraints;
  const [limitDraft, setLimitDraft] = useState({
    maxFileSizeMb: uploadConstraints?.maxFileSizeBytes ? String((uploadConstraints.maxFileSizeBytes / (1024 * 1024)).toFixed(2).replace(/\.00$/, "")) : "",
    maxWidth: uploadConstraints?.maxWidth ? String(uploadConstraints.maxWidth) : "",
    maxHeight: uploadConstraints?.maxHeight ? String(uploadConstraints.maxHeight) : "",
    maxImages: uploadConstraints?.maxImages ? String(uploadConstraints.maxImages) : "",
  });
  const [savingLimits, setSavingLimits] = useState(false);
  const [limitsMessage, setLimitsMessage] = useState("");
  const [displayNameDraft, setDisplayNameDraft] = useState(item.displayName);
  const [savingDisplayName, setSavingDisplayName] = useState(false);
  const [displayNameMessage, setDisplayNameMessage] = useState("");
  const [previewUrlDraft, setPreviewUrlDraft] = useState(item.previewUrl ?? "");
  const [previewStorageKeyDraft, setPreviewStorageKeyDraft] = useState(item.previewStorageKey ?? "");
  const [previewTypeDraft, setPreviewTypeDraft] = useState<ModelPreviewType>(item.previewType === "video" ? "video" : "image");
  const [pendingPreviewKeys, setPendingPreviewKeys] = useState<string[]>([]);
  const [uploadingPreview, setUploadingPreview] = useState(false);
  const [savingPreview, setSavingPreview] = useState(false);
  const [previewMessage, setPreviewMessage] = useState("");

  const saveDisplayName = async () => {
    const displayName = displayNameDraft.trim();
    if (!displayName) {
      setDisplayNameMessage("Display name cannot be empty");
      return;
    }
    try {
      setSavingDisplayName(true);
      setDisplayNameMessage("");
      await onSaveDisplayName(item.model, item.provider, displayName);
      setDisplayNameDraft(displayName);
      setDisplayNameMessage("Display name saved.");
    } catch (reason) {
      setDisplayNameMessage(reason instanceof Error ? reason.message : "Unable to save display name");
    } finally {
      setSavingDisplayName(false);
    }
  };

  const saveLimits = async () => {
    const parsePositive = (value: string, label: string): number | undefined => {
      if (!value.trim()) return undefined;
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${label} must be greater than zero`);
      return parsed;
    };
    try {
      const fileSizeMb = parsePositive(limitDraft.maxFileSizeMb, "Max file size");
      const maxWidth = parsePositive(limitDraft.maxWidth, "Max width");
      const maxHeight = parsePositive(limitDraft.maxHeight, "Max height");
      const maxImages = parsePositive(limitDraft.maxImages, "Max images");
      setSavingLimits(true);
      setLimitsMessage("");
      await onSaveInputLimits(item.model, item.provider, {
        ...(fileSizeMb !== undefined ? { maxFileSizeBytes: Math.round(fileSizeMb * 1024 * 1024) } : {}),
        ...(maxWidth !== undefined ? { maxWidth: Math.round(maxWidth) } : {}),
        ...(maxHeight !== undefined ? { maxHeight: Math.round(maxHeight) } : {}),
        ...(maxImages !== undefined ? { maxImages: Math.round(maxImages) } : {}),
      });
      setLimitsMessage("Upload limits saved.");
    } catch (reason) {
      setLimitsMessage(reason instanceof Error ? reason.message : "Unable to save upload limits");
    } finally {
      setSavingLimits(false);
    }
  };

  const uploadPreview = async (file: File) => {
    if (file.size > 100 * 1024 * 1024) { setPreviewMessage("Preview must be 100 MB or smaller"); return; }
    const allowed = new Set(["image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm", "video/quicktime"]);
    if (!allowed.has(file.type)) { setPreviewMessage("Use JPG, PNG, WebP, MP4, WebM, or MOV"); return; }
    try {
      setUploadingPreview(true); setPreviewMessage("");
      const uploaded = await uploadAdminModelPreview(file);
      setPreviewUrlDraft(uploaded.previewUrl ?? ""); setPreviewStorageKeyDraft(uploaded.storageKey); setPreviewTypeDraft(uploaded.mediaType);
      setPendingPreviewKeys((current) => current.includes(uploaded.storageKey) ? current : [...current, uploaded.storageKey]);
      setPreviewMessage("Preview uploaded. Save it to apply this feature/model setting.");
    } catch (reason) { setPreviewMessage(reason instanceof Error ? reason.message : "Unable to upload model preview"); }
    finally { setUploadingPreview(false); }
  };

  const savePreview = async () => {
    const previewUrl = previewUrlDraft.trim() || null;
    const previewStorageKey = previewStorageKeyDraft.trim() || null;
    try {
      setSavingPreview(true); setPreviewMessage("");
      await onSavePreview(item.model, item.provider, { previewUrl: previewStorageKey ? null : previewUrl, previewStorageKey, previewType: previewUrl || previewStorageKey ? previewTypeDraft : null }, backgroundMode);
      const staleKeys = pendingPreviewKeys.filter((key) => key !== previewStorageKey);
      await Promise.all(staleKeys.map((key) => deleteAdminModelPreviewUpload(key).catch(() => undefined)));
      setPendingPreviewKeys(previewStorageKey ? [previewStorageKey] : []); setPreviewMessage("Model preview saved.");
    } catch (reason) { setPreviewMessage(reason instanceof Error ? reason.message : "Unable to save model preview"); }
    finally { setSavingPreview(false); }
  };

  const closeDialog = () => {
    const staleKeys = pendingPreviewKeys.filter((key) => key !== item.previewStorageKey);
    if (staleKeys.length) void Promise.all(staleKeys.map((key) => deleteAdminModelPreviewUpload(key).catch(() => undefined)));
    onClose();
  };

  return <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#201d1b]/45 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="model-details-title">
    <div className="flex max-h-[min(820px,calc(100vh-32px))] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-[#eaded6] bg-[#faf8f6] shadow-[0_24px_80px_rgba(68,49,36,0.25)]">
      <header className="flex items-start justify-between gap-4 border-b border-border bg-white px-5 py-4 sm:px-7 sm:py-5">
        <div className="flex min-w-0 items-center gap-3"><ModelInitials name={item.displayName} /><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-primary">Model details</p><h2 id="model-details-title" className="mt-1 truncate text-xl font-bold tracking-tight">{item.displayName}</h2><p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">{item.provider} · {item.model}</p></div></div>
        <button type="button" onClick={closeDialog} className="rounded-xl p-2 text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground" aria-label="Close model details"><X size={19} /></button>
      </header>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5 sm:p-7">
        <section className="rounded-2xl border border-[#f1c7b5] bg-[#fffaf7] p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-bold">Display name</h3><p className="mt-1 text-[11px] leading-5 text-muted-foreground">ชื่อนี้จะแสดงในหน้า Create แทนชื่อที่ระบบสร้างจาก model ID</p></div><span className="rounded-full bg-[#fff0e9] px-2.5 py-1 text-[10px] font-bold text-primary">Admin</span></div><div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end"><label className="flex-1 text-[11px] font-semibold text-muted-foreground">Model display name<input value={displayNameDraft} onChange={(event) => setDisplayNameDraft(event.target.value)} maxLength={160} className="mt-1.5 h-9 w-full rounded-lg border border-border bg-white px-2.5 text-xs font-semibold text-foreground outline-none focus:border-primary focus:ring-3 focus:ring-primary/10" /></label><Button size="sm" onClick={() => void saveDisplayName()} disabled={savingDisplayName || !displayNameDraft.trim()}>{savingDisplayName ? <LoaderCircle size={14} className="animate-spin" /> : <Check size={14} />} {savingDisplayName ? "Saving..." : "Save display name"}</Button></div>{displayNameMessage ? <p className={`mt-2 text-[11px] font-semibold ${displayNameMessage.endsWith("saved.") ? "text-[#347454]" : "text-[#9f3b3b]"}`} role="status">{displayNameMessage}</p> : null}</section>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-border bg-white p-4"><p className="text-[11px] text-muted-foreground">Kind</p><p className="mt-1 font-semibold">{item.kind ?? capabilities.kind ?? "image"}</p></div>
          <div className="rounded-2xl border border-border bg-white p-4"><p className="text-[11px] text-muted-foreground">{isVideoModel ? "Supported resolutions" : "Supported sizes"}</p><p className="mt-1 font-semibold">{supportedOutputValues.length} presets</p></div>
          <div className="rounded-2xl border border-border bg-white p-4"><p className="text-[11px] text-muted-foreground">Quality</p><p className="mt-1 font-semibold">{capabilities.qualityParameter ? `Native: ${capabilities.qualityParameter}` : "Prompt fallback"}</p></div>
          <div className="rounded-2xl border border-border bg-white p-4"><p className="text-[11px] text-muted-foreground">Parameters</p><p className="mt-1 font-semibold">{capabilities.parameters.length}</p></div>
        </div>

        {capabilities.description ? <section className="rounded-2xl border border-border bg-white p-4"><h3 className="text-sm font-bold">Description</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{capabilities.description}</p></section> : null}

        <section className="rounded-2xl border border-[#f1c7b5] bg-[#fffaf7] p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-bold">Model preview</h3><p className="mt-1 text-[11px] leading-5 text-muted-foreground">กำหนด preview แยกตาม {formatFeature(feature)} + model นี้ เมื่อผู้ใช้เลือก model จะเห็นใน Current preview</p><p className="mt-1 text-[11px] leading-5 text-muted-foreground">รองรับทั้งภาพและวิดีโอ อัปโหลดแล้วต้องกด Save preview เพื่อเผยแพร่</p></div><span className="rounded-full bg-[#fff0e9] px-2.5 py-1 text-[10px] font-bold text-primary">Admin</span></div><div className="mt-4 grid gap-4 md:grid-cols-[180px_minmax(0,1fr)]"><div className="flex min-h-32 items-center justify-center overflow-hidden rounded-xl border border-border bg-[#201d1b]">{previewUrlDraft ? previewTypeDraft === "video" ? <video src={previewUrlDraft} muted autoPlay loop playsInline className="h-full max-h-40 w-full object-contain" /> : <img src={previewUrlDraft} alt={`${item.displayName} preview`} className="h-full max-h-40 w-full object-contain" /> : <span className="px-4 text-center text-[11px] text-white/60">No preview configured</span>}</div><div className="space-y-3"><label className="block text-[11px] font-semibold text-muted-foreground">Preview media URL<input type="url" value={previewUrlDraft} onChange={(event) => { setPreviewUrlDraft(event.target.value); setPreviewStorageKeyDraft(""); }} placeholder="https://.../preview.png or preview.mp4" className="mt-1.5 h-9 w-full rounded-lg border border-border bg-white px-2.5 text-xs text-foreground outline-none focus:border-primary focus:ring-3 focus:ring-primary/10" /></label><div className="flex flex-wrap items-center gap-2"><label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-primary/50 bg-white px-3 text-[11px] font-bold text-primary hover:bg-[#fff0e9]"><CloudDownload size={14} /> {uploadingPreview ? "Uploading..." : "Upload preview"}<input type="file" className="hidden" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime" disabled={uploadingPreview} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadPreview(file); event.currentTarget.value = ""; }} /></label><select value={previewTypeDraft} onChange={(event) => setPreviewTypeDraft(event.target.value as ModelPreviewType)} className="h-9 rounded-lg border border-border bg-white px-2.5 text-xs font-semibold outline-none focus:border-primary focus:ring-3 focus:ring-primary/10" aria-label="Preview media type"><option value="image">Image preview</option><option value="video">Video preview</option></select><Button size="sm" onClick={() => void savePreview()} disabled={savingPreview || uploadingPreview}>{savingPreview ? <LoaderCircle size={14} className="animate-spin" /> : <Check size={14} />} {savingPreview ? "Saving..." : "Save preview"}</Button><Button variant="ghost" size="sm" onClick={() => { setPreviewUrlDraft(""); setPreviewStorageKeyDraft(""); setPreviewMessage("Preview will be cleared after Save preview."); }}>Clear</Button></div>{previewMessage ? <p className={`text-[11px] font-semibold ${previewMessage.includes("saved") || previewMessage.includes("uploaded") ? "text-[#347454]" : "text-[#9f3b3b]"}`} role="status">{previewMessage}</p> : null}</div></div></section>

        <section className="rounded-2xl border border-[#f1c7b5] bg-[#fffaf7] p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-bold">Upload limits</h3><p className="mt-1 text-[11px] leading-5 text-muted-foreground">กำหนด limit ของไฟล์ input สำหรับ model นี้โดยตรง เว้นว่างเพื่อใช้ค่าเริ่มต้นของระบบ</p><p className="mt-1 text-[11px] leading-5 text-muted-foreground">Sync จะดึงค่าที่ provider ประกาศใน schema เช่น จำนวนรูปสูงสุด ส่วนขนาดไฟล์และพิกเซลต้องกำหนดเองเมื่อ provider ไม่ได้ส่งมา</p></div><span className="rounded-full bg-[#fff0e9] px-2.5 py-1 text-[10px] font-bold text-primary">Admin</span></div><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><label className="text-[11px] font-semibold text-muted-foreground">Max file size (MB)<input type="number" min="0.1" step="0.1" value={limitDraft.maxFileSizeMb} onChange={(event) => setLimitDraft((current) => ({ ...current, maxFileSizeMb: event.target.value }))} placeholder="System default" className="mt-1.5 h-9 w-full rounded-lg border border-border bg-white px-2.5 text-xs font-semibold text-foreground outline-none focus:border-primary focus:ring-3 focus:ring-primary/10" /></label><label className="text-[11px] font-semibold text-muted-foreground">Max width (px)<input type="number" min="1" step="1" value={limitDraft.maxWidth} onChange={(event) => setLimitDraft((current) => ({ ...current, maxWidth: event.target.value }))} placeholder="Not published" className="mt-1.5 h-9 w-full rounded-lg border border-border bg-white px-2.5 text-xs font-semibold text-foreground outline-none focus:border-primary focus:ring-3 focus:ring-primary/10" /></label><label className="text-[11px] font-semibold text-muted-foreground">Max height (px)<input type="number" min="1" step="1" value={limitDraft.maxHeight} onChange={(event) => setLimitDraft((current) => ({ ...current, maxHeight: event.target.value }))} placeholder="Not published" className="mt-1.5 h-9 w-full rounded-lg border border-border bg-white px-2.5 text-xs font-semibold text-foreground outline-none focus:border-primary focus:ring-3 focus:ring-primary/10" /></label><label className="text-[11px] font-semibold text-muted-foreground">Max input images<input type="number" min="1" step="1" value={limitDraft.maxImages} onChange={(event) => setLimitDraft((current) => ({ ...current, maxImages: event.target.value }))} placeholder="Schema default" className="mt-1.5 h-9 w-full rounded-lg border border-border bg-white px-2.5 text-xs font-semibold text-foreground outline-none focus:border-primary focus:ring-3 focus:ring-primary/10" /></label></div><div className="mt-3 flex flex-wrap items-center gap-3"><Button size="sm" onClick={() => void saveLimits()} disabled={savingLimits}>{savingLimits ? <LoaderCircle size={14} className="animate-spin" /> : <Check size={14} />} {savingLimits ? "Saving..." : "Save upload limits"}</Button>{limitsMessage ? <p className="text-[11px] font-semibold text-[#347454]" role="status">{limitsMessage}</p> : null}</div></section>

        <section className="rounded-2xl border border-border bg-white p-4"><div className="flex items-center justify-between gap-3"><div><h3 className="text-sm font-bold">{isVideoModel ? "Supported resolutions" : "Supported sizes"}</h3><p className="mt-1 text-[11px] text-muted-foreground">The values accepted by this model</p></div><span className="rounded-full bg-[#fff0e9] px-2.5 py-1 text-[10px] font-bold text-primary">{supportedOutputValues.length}</span></div>{supportedOutputValues.length ? <div className="mt-3 flex flex-wrap gap-2">{supportedOutputValues.map((value) => <span key={value} className="rounded-lg bg-surface-muted px-2.5 py-1.5 font-mono text-[11px] text-muted-foreground">{value}</span>)}</div> : <p className="mt-3 text-xs text-muted-foreground">This model does not publish a fixed preset list. Use its input schema controls.</p>}</section>

        <section className="rounded-2xl border border-border bg-white p-4"><div className="flex items-center justify-between gap-3"><div><h3 className="text-sm font-bold">Input schema</h3><p className="mt-1 text-[11px] text-muted-foreground">Complete provider parameters and validation rules</p></div><span className="rounded-full bg-[#e3f3e9] px-2.5 py-1 text-[10px] font-bold text-[#347454]">{propertyEntries.length} fields</span></div>{propertyEntries.length ? <div className="mt-4 space-y-3">{propertyEntries.map(([name, property]) => <div key={name} className="rounded-xl border border-border bg-[#fcfaf8] p-3"><div className="flex flex-wrap items-center gap-2"><p className="font-mono text-xs font-bold">{name}</p>{required.has(name) ? <Badge tone="orange">Required</Badge> : <Badge>Optional</Badge>}{property.type ? <span className="rounded-md bg-white px-2 py-1 font-mono text-[10px] text-muted-foreground">{property.type}</span> : null}</div>{property.description ? <p className="mt-2 text-xs leading-5 text-muted-foreground">{property.description}</p> : null}<div className="mt-2 flex flex-wrap gap-2 text-[10px] text-muted-foreground">{property.enum?.length ? <span className="rounded-md bg-white px-2 py-1">Values: {property.enum.map(displaySchemaValue).join(", ")}</span> : null}{property.default !== undefined ? <span className="rounded-md bg-white px-2 py-1">Default: {displaySchemaValue(property.default)}</span> : null}{property.minimum !== undefined || property.maximum !== undefined ? <span className="rounded-md bg-white px-2 py-1">Range: {displaySchemaValue(property.minimum)} – {displaySchemaValue(property.maximum)}</span> : null}{property.format ? <span className="rounded-md bg-white px-2 py-1">Format: {property.format}</span> : null}</div></div>)}</div> : <div className="mt-4 rounded-xl border border-dashed border-[#d8d0ca] p-5 text-center text-xs text-muted-foreground">Provider schema is not available for this model. The backend will use the known fallback capabilities.</div>}</section>

        <section className="rounded-2xl border border-border bg-white p-4"><h3 className="text-sm font-bold">Backend behavior</h3><div className="mt-3 grid gap-2 text-xs sm:grid-cols-2"><p className="rounded-lg bg-[#fcfaf8] p-3"><span className="text-muted-foreground">Quality parameter: </span><strong>{capabilities.qualityParameter ?? "none; appended to prompt"}</strong></p><p className="rounded-lg bg-[#fcfaf8] p-3"><span className="text-muted-foreground">Negative prompt: </span><strong>{capabilities.negativePromptParameter ?? "none; fallback handling"}</strong></p><p className="rounded-lg bg-[#fcfaf8] p-3"><span className="text-muted-foreground">Provider type: </span><strong>{capabilities.providerType ?? "—"}</strong></p><p className="rounded-lg bg-[#fcfaf8] p-3"><span className="text-muted-foreground">Base price: </span><strong>{displaySchemaValue(capabilities.basePrice)}</strong></p></div></section>
      </div>

      <footer className="flex justify-end border-t border-border bg-white px-5 py-4 sm:px-7"><Button variant="outline" size="sm" onClick={closeDialog}>Close</Button></footer>
    </div>
  </div>;
}

function StatCard({ label, value, detail, accent }: { label: string; value: string; detail: string; accent: "orange" | "green" | "pink" }) {
  const accents = {
    orange: "bg-[#fff0e9] text-[#c85427]",
    green: "bg-[#e3f3e9] text-[#347454]",
    pink: "bg-[#f9e5eb] text-[#ae5572]",
  };

  return (
    <div className="rounded-2xl border border-border bg-white p-4 shadow-[var(--shadow-sm)]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
        <span className={`h-2 w-2 rounded-full ${accents[accent].split(" ")[0]}`} aria-hidden="true" />
      </div>
      <p className="mt-2 text-2xl font-bold tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function ModelCard({ item, selected, onSelect, onToggleEnabled, onDetails }: { item: GenerationModelOption; selected: boolean; onSelect: () => void; onToggleEnabled: () => void; onDetails: () => void }) {
  const isVideoModel = item.kind === "video" || item.capabilities.kind === "video";
  const imageInput = item.capabilities.imageParameter ?? item.capabilities.referenceImagesParameter;
  return (
    <div className={`group flex w-full flex-col gap-4 rounded-2xl border p-4 text-left transition-all sm:p-5 ${selected ? "border-primary bg-[#fffaf7] shadow-[0_0_0_3px_rgba(242,107,56,0.1)]" : "border-border bg-white hover:-translate-y-0.5 hover:border-[#f2b39b] hover:shadow-[var(--shadow-sm)]"}`}>
      <div className="flex items-start justify-between gap-3">
        <button type="button" onClick={onSelect} aria-pressed={selected} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <ModelInitials name={item.displayName} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-sm font-bold sm:text-[15px]">{item.displayName}</h3>
              {item.isDefault ? <Badge tone="orange">Current default</Badge> : null}
            </div>
            <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">{item.provider} · {item.model}</p>
          </div>
        </button>
        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors ${selected ? "border-primary bg-primary text-white" : "border-[#d8d0ca] text-transparent group-hover:border-primary/50"}`} aria-hidden="true">
          <Check size={14} strokeWidth={3} />
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 border-t border-border pt-3 text-xs">
        <div>
          <p className="text-muted-foreground">{isVideoModel ? "Schema controls" : "Supported sizes"}</p>
          <p className="mt-1 font-semibold">{isVideoModel ? `${item.capabilities.parameters.length} parameters` : `${item.capabilities.supportedSizes.length || 0} presets`}</p>
        </div>
        <div>
          <p className="text-muted-foreground">{isVideoModel ? "Storyboard image" : "Quality control"}</p>
          <p className="mt-1 font-semibold">{isVideoModel ? (imageInput ? `Native: ${imageInput}` : "Not supported") : (item.capabilities.qualityParameter ? "Native parameter" : "Prompt fallback")}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {(isVideoModel ? item.capabilities.parameters : item.capabilities.supportedSizes).slice(0, 4).map((value) => <span key={value} className="rounded-md bg-surface-muted px-2 py-1 font-mono text-[10px] text-muted-foreground">{value}</span>)}
        {(isVideoModel ? item.capabilities.parameters : item.capabilities.supportedSizes).length > 4 ? <span className="rounded-md bg-surface-muted px-2 py-1 text-[10px] text-muted-foreground">+{(isVideoModel ? item.capabilities.parameters : item.capabilities.supportedSizes).length - 4}</span> : null}
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
        <button type="button" onClick={onToggleEnabled} className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${item.enabled ? "bg-[#e3f3e9] text-[#347454]" : "bg-surface-muted text-muted-foreground hover:bg-[#fff0e9] hover:text-primary"}`} aria-pressed={item.enabled}>{item.enabled ? "Allowed" : "Allow model"}</button>
        <div className="flex items-center gap-1"><button type="button" onClick={onDetails} className="rounded-lg px-2.5 py-1.5 text-xs font-bold text-muted-foreground transition-colors hover:bg-surface-muted hover:text-primary">View details</button><button type="button" onClick={onSelect} className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition-colors ${selected ? "text-primary" : "text-muted-foreground hover:text-primary"}`}>{selected ? "Default model" : "Set as default"}</button></div>
      </div>
    </div>
  );
}

function ModelGrid({ models, selectedModel, onSelect, onToggleEnabled, onDetails, onOpenAssignment, loading, query }: { models: GenerationModelOption[]; selectedModel: string; onSelect: (model: string) => void; onToggleEnabled: (model: string) => void; onDetails: (item: GenerationModelOption) => void; onOpenAssignment: () => void; loading: boolean; query: string }) {
  if (loading) {
    return <div className="grid gap-3 md:grid-cols-2">{[1, 2, 3].map((item) => <div key={item} className="h-[213px] animate-pulse rounded-2xl border border-border bg-[#f5f2ef]" />)}</div>;
  }

  if (models.length === 0) {
    return <div className="flex min-h-52 flex-col items-center justify-center rounded-2xl border border-dashed border-[#d8d0ca] bg-[#fcfaf8] px-6 text-center"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#fff0e9] text-primary"><Search size={19} /></div><p className="mt-3 text-sm font-bold">{query ? "No matching models" : "No models assigned yet"}</p><p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">{query ? "Try another search term or clear the search to see assigned models." : "Open the model assignment popup and drag a model here to enable it for this function."}</p>{!query ? <Button className="mt-4" size="sm" onClick={onOpenAssignment}><Settings2 size={14} /> Assign models</Button> : null}</div>;
  }

  return <div className="grid gap-3 md:grid-cols-2">{models.map((item) => <ModelCard key={`${item.provider}:${item.model}`} item={item} selected={selectedModel === item.model} onSelect={() => onSelect(item.model)} onToggleEnabled={() => onToggleEnabled(item.model)} onDetails={() => onDetails(item)} />)}</div>;
}

function modelKindForFeature(feature: FeatureId): string {
  if (feature === "video-to-sfx" || feature === "video-to-music") return "audio";
  if (videoFunctions.some((item) => item.id === feature)) return "video";
  if (feature === "audio") return "audio";
  if (feature === "document") return "document";
  return "image";
}

function isFeatureCompatible(item: GenerationModelOption, feature: FeatureId): boolean {
  if (item.kind !== modelKindForFeature(feature)) return false;
  const capabilities = item.capabilities;
  if (feature === "text-to-image") return capabilities.parameters.length > 0 && Boolean(capabilities.promptParameter);
  if (feature === "image-to-image") return capabilities.parameters.length > 0 && Boolean(capabilities.promptParameter && (capabilities.imageParameter || capabilities.referenceImagesParameter));
  if (feature === "image-to-video") return capabilities.parameters.length > 0 && Boolean(capabilities.promptParameter && (capabilities.imageParameter || capabilities.referenceImagesParameter));
  if (feature === "video-to-sfx" || feature === "video-to-music") return capabilities.parameters.length > 0 && Boolean(capabilities.videoParameter);
  if (videoFunctions.some((item) => item.id === feature)) return capabilities.parameters.length > 0;
  if (feature === "style-transfer") return capabilities.styleTransferCompatible === true;
  if (feature === "background-removal") {
    const providerType = capabilities.providerType?.toLowerCase() ?? "";
    const hasBackgroundMode = Boolean(capabilities.backgroundModes?.length);
    const imageInput = capabilities.imageParameter ?? capabilities.referenceImagesParameter ?? capabilities.imagesParameter ?? capabilities.inputImageParameter;
    return capabilities.parameters.length > 0 && Boolean(imageInput) && (hasBackgroundMode || Boolean(capabilities.backgroundImageParameter) || providerType.includes("background") || providerType.includes("remov"));
  }
  return true;
}

function isBackgroundModeCompatible(item: GenerationModelOption, mode: AiBackgroundMode): boolean {
  const configuredModes = item.capabilities.backgroundModes ?? [];
  if (configuredModes.length > 0) return configuredModes.includes(mode);
  if (mode === "remove") return true;
  if (mode === "replace") return Boolean(item.capabilities.promptParameter || item.capabilities.backgroundImageParameter);
  return Boolean(item.capabilities.promptParameter);
}

type AssignmentDraft = { assignedModelIds: string[]; defaultModel: string };

function MultiTargetModelAssignmentDialog({
  feature,
  catalog,
  assignments,
  onFeatureChange,
  backgroundMode,
  onBackgroundModeChange,
  onAdd,
  onRemove,
  onSetDefault,
  onClose,
  onSave,
  saving,
}: {
  feature: FeatureId;
  catalog: GenerationModelOption[];
  assignments: Record<string, AssignmentDraft>;
  onFeatureChange: (feature: FeatureId) => void;
  backgroundMode: AiBackgroundMode;
  onBackgroundModeChange: (mode: AiBackgroundMode) => void;
  onAdd: (feature: FeatureId, model: string) => void;
  onRemove: (feature: FeatureId, model: string) => void;
  onSetDefault: (feature: FeatureId, model: string) => void;
  onClose: () => void;
  onSave: () => Promise<void>;
  saving: boolean;
}) {
  const [query, setQuery] = useState("");
  const [draggedModel, setDraggedModel] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const draft = assignments[feature] ?? { assignedModelIds: [], defaultModel: "" };
  const compatibleModels = catalog
    .filter((item) => isFeatureCompatible(item, feature))
    .sort((left, right) => {
      if (feature !== "background-removal") return 0;
      return Number(isBackgroundModeCompatible(right, backgroundMode)) - Number(isBackgroundModeCompatible(left, backgroundMode));
    });
  const filteredCatalog = compatibleModels.filter((item) => `${item.displayName} ${item.provider} ${item.model}`.toLowerCase().includes(query.trim().toLowerCase()));
  const assigned = compatibleModels.filter((item) => draft.assignedModelIds.includes(item.model));
  const unassigned = filteredCatalog.filter((item) => !draft.assignedModelIds.includes(item.model));

  const handleFeatureChange = (nextFeature: FeatureId) => {
    setQuery("");
    setDraggedModel(null);
    setDragOver(false);
    onFeatureChange(nextFeature);
  };

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#201d1b]/45 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="assign-models-title">
    <div className="flex max-h-[min(820px,calc(100vh-32px))] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-[#eaded6] bg-[#faf8f6] shadow-[0_24px_80px_rgba(68,49,36,0.25)]">
      <header className="border-b border-border bg-white px-5 py-4 sm:px-7 sm:py-5">
        <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-primary">Model assignment</p><h2 id="assign-models-title" className="mt-1 text-xl font-bold tracking-tight">Assign models to features</h2><p className="mt-1 text-xs text-muted-foreground">เลือกฟีเจอร์ปลายทาง แล้วลาก model เข้าไป หรือกด Add</p></div><button type="button" onClick={onClose} className="rounded-xl p-2 text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground" aria-label="Close dialog"><X size={19} /></button></div>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"><label className="block max-w-md flex-1"><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Assign to</span><select value={feature} onChange={(event) => handleFeatureChange(event.target.value as FeatureId)} className="h-10 w-full rounded-xl border border-border bg-[#fcfaf8] px-3 text-sm font-semibold outline-none focus:border-primary focus:ring-3 focus:ring-primary/10"><optgroup label="Image">{imageFunctions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</optgroup><optgroup label="Video">{videoFunctions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</optgroup>{features.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>{feature === "background-removal" ? <label className="block max-w-md flex-1"><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">AI Background mode</span><select value={backgroundMode} onChange={(event) => onBackgroundModeChange(event.target.value as AiBackgroundMode)} className="h-10 w-full rounded-xl border border-border bg-[#fcfaf8] px-3 text-sm font-semibold outline-none focus:border-primary focus:ring-3 focus:ring-primary/10">{aiBackgroundModes.map((mode) => <option key={mode.id} value={mode.id}>{mode.label}</option>)}</select></label> : null}</div>
      </header>

      <div className="grid min-h-0 flex-1 gap-4 overflow-hidden p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-white p-4" aria-label="Model catalog">
          <div className="mb-3 flex items-center justify-between gap-3"><div><h3 className="text-sm font-bold">Model catalog</h3><p className="mt-1 text-[11px] text-muted-foreground">{compatibleModels.length} compatible model{compatibleModels.length === 1 ? "" : "s"} · {formatFeature(feature)}</p></div><GripVertical size={17} className="text-muted-foreground" /></div>
          <div className="relative mb-3"><Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search model" aria-label="Search model catalog" className="h-9 w-full rounded-xl border border-border bg-[#fcfaf8] pl-9 pr-3 text-xs outline-none focus:border-primary focus:ring-3 focus:ring-primary/10" /></div>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">{unassigned.length ? unassigned.map((item) => <div key={`${item.provider}:${item.model}`} draggable onDragStart={() => setDraggedModel(item.model)} onDragEnd={() => { setDraggedModel(null); setDragOver(false); }} className="flex cursor-grab items-center gap-3 rounded-xl border border-border bg-[#fcfaf8] p-3 transition hover:border-primary/50 active:cursor-grabbing"><GripVertical size={15} className="shrink-0 text-muted-foreground" /><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold">{item.displayName}</p><p className="truncate font-mono text-[10px] text-muted-foreground">{item.provider} · {item.model}</p></div><button type="button" onClick={() => onAdd(feature, item.model)} className="shrink-0 rounded-lg bg-[#fff0e9] px-2.5 py-1.5 text-[10px] font-bold text-primary hover:bg-primary hover:text-white">Add</button></div>) : <p className="rounded-xl border border-dashed border-[#d8d0ca] px-4 py-8 text-center text-xs text-muted-foreground">All compatible models are assigned.</p>}</div>
        </section>

        <section className={`flex min-h-0 flex-col overflow-hidden rounded-2xl border-2 border-dashed p-4 transition-colors ${dragOver ? "border-primary bg-[#fff0e9]" : "border-[#d8d0ca] bg-white"}`} onDragOver={(event) => { event.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={(event) => { event.preventDefault(); if (draggedModel) onAdd(feature, draggedModel); setDraggedModel(null); setDragOver(false); }} aria-label="Assigned models drop zone">
          <div className="mb-3 flex items-center justify-between gap-3"><div><h3 className="text-sm font-bold">Assigned models</h3><p className="mt-1 text-[11px] text-muted-foreground">เฉพาะ model เหล่านี้จะแสดงใน {formatFeature(feature)}</p></div><span className="rounded-full bg-[#e3f3e9] px-2.5 py-1 text-[10px] font-bold text-[#347454]">{assigned.length} allowed</span></div>
          <div className="space-y-2">{assigned.length ? assigned.map((item) => <div key={`${item.provider}:${item.model}`} className={`flex items-center gap-3 rounded-xl border p-3 ${draft.defaultModel === item.model ? "border-primary bg-[#fffaf7]" : "border-border bg-[#fcfaf8]"}`}><GripVertical size={15} className="shrink-0 text-muted-foreground" /><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold">{item.displayName}</p><p className="truncate font-mono text-[10px] text-muted-foreground">{item.provider} · {item.model}</p></div><button type="button" onClick={() => onSetDefault(feature, item.model)} className={`shrink-0 rounded-lg px-2.5 py-1.5 text-[10px] font-bold ${draft.defaultModel === item.model ? "bg-primary text-white" : "bg-surface-muted text-muted-foreground hover:bg-[#fff0e9] hover:text-primary"}`}>{draft.defaultModel === item.model ? "Default" : "Set default"}</button><button type="button" onClick={() => onRemove(feature, item.model)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-[#fff0e9] hover:text-primary" aria-label={`Remove ${item.displayName}`}><X size={14} /></button></div>) : <div className="flex min-h-44 flex-col items-center justify-center rounded-xl border border-dashed border-[#d8d0ca] px-5 text-center"><GripVertical size={20} className="text-muted-foreground" /><p className="mt-2 text-xs font-bold">Drop models here</p><p className="mt-1 text-[11px] text-muted-foreground">Drag a model from the catalog to allow it for this function.</p></div>}</div>
        </section>
      </div>

      <footer className="flex flex-col justify-between gap-3 border-t border-border bg-white px-5 py-4 sm:flex-row sm:items-center sm:px-7"><p className="text-[11px] text-muted-foreground">เปลี่ยน Assign to เพื่อเพิ่ม model ให้ function อื่นได้ทันที · default ได้หนึ่งตัวต่อ function</p><div className="flex items-center justify-end gap-2"><Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>Cancel</Button><Button size="sm" onClick={() => void onSave()} disabled={saving}>{saving ? <LoaderCircle size={15} className="animate-spin" /> : <Settings2 size={15} />} {saving ? "Saving..." : "Save assignments"}</Button></div></footer>
    </div>
  </div>;
}

const audioVoiceFields: Array<{ key: keyof AdminAudioVoiceSettings; label: string; hint: string }> = [
  { key: "femaleWarm", label: "Female Warm", hint: "เสียงผู้หญิงโทนอุ่น" },
  { key: "maleBold", label: "Male Bold", hint: "เสียงผู้ชายโทนหนักแน่น" },
  { key: "youthful", label: "Youthful", hint: "เสียงวัยรุ่น" },
  { key: "corporate", label: "Corporate", hint: "เสียงองค์กร" },
  { key: "podcastHost", label: "Podcast Host", hint: "เสียงผู้ดำเนินรายการ" },
];

const waveSpeedAudioModelOptions = [
  { id: "elevenlabs/multilingual-v2", label: "ElevenLabs · Multilingual v2" },
  { id: "elevenlabs/flash-v2.5", label: "ElevenLabs · Flash v2.5" },
  { id: "elevenlabs/turbo-v2.5", label: "ElevenLabs · Turbo v2.5" },
  { id: "elevenlabs/eleven-v3", label: "ElevenLabs · Eleven v3" },
  { id: "minimax/speech-2.6-hd", label: "WaveSpeed · MiniMax Speech 2.6 HD" },
  { id: "mirelo-ai/sfx-1.6/text-to-audio", label: "WaveSpeed · Mirelo SFX 1.6" },
  { id: "elevenlabs/music", label: "WaveSpeed · Eleven Music" },
];

function AudioSettingsCard() {
  const [settings, setSettings] = useState<AdminAudioSettings | null>(null);
  const [draft, setDraft] = useState<AdminAudioSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void getAdminAudioSettings().then((next) => {
      if (cancelled) return;
      setSettings(next);
      setDraft(next);
    }).catch((reason) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : "Unable to load audio settings");
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const next = await updateAdminAudioSettings({ modelId: draft.modelId.trim(), voices: draft.voices });
      setSettings(next);
      setDraft(next);
      setMessage("Audio settings saved.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save audio settings");
    } finally {
      setSaving(false);
    }
  };

  const isDirty = Boolean(settings && draft && JSON.stringify(settings) !== JSON.stringify(draft));

  return <section aria-labelledby="audio-settings-heading" className="mb-7 rounded-3xl border border-[#eaded6] bg-white p-5 shadow-[0_8px_24px_rgba(68,49,36,0.04)] sm:p-6">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Provider settings</p>
        <h2 id="audio-settings-heading" className="mt-1 text-xl font-bold tracking-tight">WaveSpeed Audio Settings</h2>
        <p className="mt-2 max-w-2xl text-xs leading-5 text-muted-foreground">Audio ทุก tab จะเรียกผ่าน WaveSpeed กำหนด WaveSpeed model path และ voice ID ที่หน้า Create &gt; Audio จะใช้ ค่าเหล่านี้มีผลกับการสร้างเสียงใหม่ทันที</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-2 rounded-full bg-[#201d1b] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-white"><span className="h-2 w-2 rounded-full bg-[#f47d4b]" />Provider: WaveSpeed</span>
        <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] ${draft?.providerConfigured ? "bg-[#e3f3e9] text-[#347454]" : "bg-[#fff0e9] text-primary"}`}><span className={`h-2 w-2 rounded-full ${draft?.providerConfigured ? "bg-[#4c9b72]" : "bg-primary"}`} />API key {draft?.providerConfigured ? "configured" : "missing"}</span>
      </div>
    </div>

    {error ? <div className="mt-4 rounded-xl border border-[#efc2c2] bg-[#fff6f6] p-3 text-xs text-[#9f3b3b]" role="alert">{error}</div> : null}
    {message ? <div className="mt-4 rounded-xl border border-[#bfe1cc] bg-[#f3fbf5] p-3 text-xs font-semibold text-[#347454]" role="status">{message}</div> : null}

    {loading || !draft ? <div className="mt-5 rounded-2xl border border-dashed border-[#d8d0ca] p-6 text-center text-xs text-muted-foreground">Loading audio settings...</div> : <>
      <label className="mt-5 block max-w-xl"><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">WaveSpeed audio model path</span><input value={draft.modelId} onChange={(event) => setDraft((current) => current ? { ...current, modelId: event.target.value } : current)} placeholder="elevenlabs/flash-v2.5" className="h-10 w-full rounded-xl border border-border bg-[#fcfaf8] px-3 font-mono text-xs outline-none transition focus:border-primary focus:ring-3 focus:ring-primary/10" aria-label="WaveSpeed audio model path" /></label>
      <div className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {audioVoiceFields.map((field) => <label key={field.key} className="block"><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{field.label}</span><input value={draft.voices[field.key]} onChange={(event) => setDraft((current) => current ? { ...current, voices: { ...current.voices, [field.key]: event.target.value } } : current)} placeholder={field.hint} className="h-10 w-full rounded-xl border border-border bg-[#fcfaf8] px-3 font-mono text-xs outline-none transition focus:border-primary focus:ring-3 focus:ring-primary/10" aria-label={`${field.label} WaveSpeed voice ID`} /><span className="mt-1 block text-[10px] text-muted-foreground">{field.hint}</span></label>)}
      </div>
      <div className="mt-5 flex flex-col justify-between gap-3 border-t border-border pt-4 sm:flex-row sm:items-center"><p className="max-w-2xl text-[11px] leading-5 text-muted-foreground">API key ตั้งใน backend secret เท่านั้น เพื่อไม่ให้หลุดไปยัง browser — หน้านี้จัดการเฉพาะ model และ voice mapping</p><Button size="sm" onClick={() => void save()} disabled={saving || !isDirty || !draft.modelId.trim()}>{saving ? <LoaderCircle size={15} className="animate-spin" /> : <Check size={15} />} {saving ? "Saving..." : "Save audio settings"}</Button></div>
    </>}
  </section>;
}

function VideoStoryboardSettingsPanel() {
  const [settings, setSettings] = useState<AdminVideoStoryboardSettings | null>(null);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void getAdminVideoStoryboardSettings().then((next) => {
      if (cancelled) return;
      setSettings(next);
      setDraft(String(next.maxScenes));
    }).catch((reason) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : "Unable to load video settings");
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const save = async () => {
    const maxScenes = Number(draft);
    const hardMax = settings?.hardMaxScenes ?? 100;
    if (!Number.isInteger(maxScenes) || maxScenes < 1 || maxScenes > hardMax) {
      setError(`Maximum scenes must be an integer from 1 to ${hardMax}.`);
      return;
    }
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const next = await updateAdminVideoStoryboardSettings(maxScenes);
      setSettings(next);
      setDraft(String(next.maxScenes));
      setMessage("Video storyboard settings saved.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save video settings");
    } finally {
      setSaving(false);
    }
  };

  const isDirty = Boolean(settings && Number(draft) !== settings.maxScenes);

  return <section aria-labelledby="video-storyboard-settings-heading" className="mb-7 rounded-3xl border border-[#eaded6] bg-white p-5 shadow-[0_8px_24px_rgba(68,49,36,0.04)] sm:p-6">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Video generation settings</p>
        <h2 id="video-storyboard-settings-heading" className="mt-1 text-xl font-bold tracking-tight">Storyboard scene limit</h2>
        <p className="mt-2 max-w-2xl text-xs leading-5 text-muted-foreground">กำหนดจำนวน Scene สูงสุดที่ผู้ใช้เพิ่มได้ใน Image to Video ทุก mode ค่าใหม่นี้มีผลกับหน้า Create และ API สำหรับงานใหม่</p>
      </div>
      <span className="rounded-full bg-[#fff0e9] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-primary">Admin configurable</span>
    </div>
    {error ? <div className="mt-4 rounded-xl border border-[#efc2c2] bg-[#fff6f6] p-3 text-xs text-[#9f3b3b]" role="alert">{error}</div> : null}
    {message ? <div className="mt-4 rounded-xl border border-[#bfe1cc] bg-[#f3fbf5] p-3 text-xs font-semibold text-[#347454]" role="status">{message}</div> : null}
    {loading || !settings ? <div className="mt-5 rounded-2xl border border-dashed border-[#d8d0ca] p-6 text-center text-xs text-muted-foreground">Loading video settings...</div> : <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <label className="block w-full max-w-xs"><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Maximum scenes</span><input type="number" min={1} max={settings.hardMaxScenes} step={1} value={draft} onChange={(event) => setDraft(event.target.value)} className="h-10 w-full rounded-xl border border-border bg-[#fcfaf8] px-3 font-mono text-sm outline-none transition focus:border-primary focus:ring-3 focus:ring-primary/10" aria-label="Maximum storyboard scenes" /><span className="mt-1 block text-[10px] text-muted-foreground">Allowed range: 1–{settings.hardMaxScenes}. Default: 12.</span></label>
      <div className="flex flex-col items-start gap-2 sm:items-end"><Button size="sm" onClick={() => void save()} disabled={saving || !isDirty}>{saving ? <LoaderCircle size={15} className="animate-spin" /> : <Check size={15} />} {saving ? "Saving..." : "Save scene limit"}</Button><span className="text-[10px] text-muted-foreground">Current limit: {settings.maxScenes} scenes</span></div>
    </div>}
  </section>;
}

const audioRoutingRows: Array<{ key: AdminAudioFeature; label: string; description: string }> = [
  { key: "textToSpeech", label: "Text to Speech", description: "Narration and voiceover generation" },
  { key: "podcastDialogue", label: "Podcast & Dialogue", description: "Multi-speaker episode rendering" },
  { key: "voiceClone", label: "Voice Clone", description: "Create and test account voices" },
  { key: "soundEffects", label: "Sound Effects", description: "Prompt-based sound generation" },
  { key: "audioCleanup", label: "Audio Cleanup", description: "Noise, clarity and reverb processing" },
];

const audioFeatureProfileRows: Array<{ key: AdminAudioFeature; label: string; description: string }> = [
  { key: "textToSpeech", label: "Text to Speech", description: "Narration and voiceover" },
  { key: "podcastDialogue", label: "Podcast & Dialogue", description: "Multi-speaker rendering" },
  { key: "voiceClone", label: "Voice Clone", description: "Clone preview synthesis" },
  { key: "soundEffects", label: "Sound Effects", description: "Prompt-based sound generation" },
  { key: "audioCleanup", label: "Audio Cleanup", description: "Internal processor" },
];

function audioProviderLabel(provider: AdminAudioProvider) {
  return provider === "wavespeed" ? "WaveSpeed" : provider === "elevenlabs" ? "ElevenLabs" : "Internal Audio Processor";
}

function audioProviderOptions(feature: AdminAudioFeature): AdminAudioProvider[] {
  if (feature === "audioCleanup") return ["internal"];
  if (feature === "voiceClone" || feature === "soundEffects") return ["wavespeed"];
  return ["elevenlabs", "wavespeed"];
}

function BackgroundMusicPresetsEditor({ presets, onChange }: { presets: AdminAudioBackgroundMusicPreset[]; onChange: (presets: AdminAudioBackgroundMusicPreset[]) => void }) {
  const updatePreset = (index: number, patch: Partial<AdminAudioBackgroundMusicPreset>) => onChange(presets.map((preset, presetIndex) => presetIndex === index ? { ...preset, ...patch } : preset));
  const addPreset = () => onChange([...presets, { key: `background_${presets.length + 1}`, name: `Background ${presets.length + 1}`, description: "", prompt: "", musicModelId: "music_v1", forceInstrumental: true, volume: 0.15, isActive: true }]);
  const removePreset = (index: number) => onChange(presets.filter((_, presetIndex) => presetIndex !== index));

  return <section className="mt-4 rounded-2xl border border-[#cfe3db] bg-[#f7fcfa] p-4" aria-labelledby="background-music-settings-heading">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#347454]">Audio background music</p><h3 id="background-music-settings-heading" className="mt-1 text-base font-bold">Auto Background Music</h3><p className="mt-1 max-w-3xl text-[11px] leading-5 text-muted-foreground">ตั้งชื่อเพลงและ prompt ให้ dropdown หน้า Create &gt; Audio ได้จาก API โดยตรง ถ้าไม่ใส่ Audio URL ระบบจะสร้าง instrumental ผ่าน WaveSpeed ตอนกด Generate</p></div><span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[#347454]">{presets.filter((preset) => preset.isActive).length} active</span></div>
    <div className="mt-4 space-y-3">{presets.length ? presets.map((preset, index) => <div key={`${preset.key}-${index}`} className="rounded-xl border border-[#cfe3db] bg-white p-3">
      <div className="mb-3 flex items-center justify-between gap-3"><span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Preset {index + 1}</span><div className="flex items-center gap-3"><label className="flex items-center gap-2 text-[10px] font-semibold text-muted-foreground"><input type="checkbox" checked={preset.isActive} onChange={(event) => updatePreset(index, { isActive: event.target.checked })} /> Active</label><button type="button" className="inline-flex items-center gap-1 text-[10px] font-bold text-[#9f3b3b] hover:underline" onClick={() => removePreset(index)}><X size={13} /> Remove</button></div></div>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4"><label><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Key</span><input value={preset.key} onChange={(event) => updatePreset(index, { key: event.target.value })} placeholder="uplifting_corporate" className="h-10 w-full rounded-xl border border-border bg-white px-3 font-mono text-xs outline-none focus:border-primary focus:ring-3 focus:ring-primary/10" /></label><label><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Display name</span><input value={preset.name} onChange={(event) => updatePreset(index, { name: event.target.value })} placeholder="Uplifting Corporate" className="h-10 w-full rounded-xl border border-border bg-white px-3 text-xs outline-none focus:border-primary focus:ring-3 focus:ring-primary/10" /></label><label><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Description</span><input value={preset.description} onChange={(event) => updatePreset(index, { description: event.target.value })} placeholder="เพลงองค์กร ฟังดูมีพลัง" className="h-10 w-full rounded-xl border border-border bg-white px-3 text-xs outline-none focus:border-primary focus:ring-3 focus:ring-primary/10" /></label><label><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Music model</span><select value={preset.musicModelId} onChange={(event) => updatePreset(index, { musicModelId: event.target.value as "music_v1" | "music_v2" })} className="h-10 w-full rounded-xl border border-border bg-white px-3 text-xs outline-none focus:border-primary focus:ring-3 focus:ring-primary/10"><option value="music_v1">Music v1</option><option value="music_v2">Music v2</option></select></label></div>
      <div className="mt-3 grid gap-3 lg:grid-cols-2"><label><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">WaveSpeed music prompt</span><textarea value={preset.prompt} onChange={(event) => updatePreset(index, { prompt: event.target.value })} placeholder="Warm instrumental background music, no vocals" rows={2} className="w-full rounded-xl border border-border bg-white px-3 py-2 font-mono text-xs outline-none focus:border-primary focus:ring-3 focus:ring-primary/10" /></label><div className="space-y-3"><label className="block"><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Audio URL (optional)</span><input value={preset.audioUrl ?? ""} onChange={(event) => updatePreset(index, { audioUrl: event.target.value || undefined })} placeholder="https://.../background.mp3" className="h-10 w-full rounded-xl border border-border bg-white px-3 font-mono text-xs outline-none focus:border-primary focus:ring-3 focus:ring-primary/10" /></label><div className="grid gap-3 sm:grid-cols-2"><label><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Music volume</span><input type="number" min="0" max="1" step="0.01" value={preset.volume} onChange={(event) => updatePreset(index, { volume: Number(event.target.value) })} className="h-10 w-full rounded-xl border border-border bg-white px-3 font-mono text-xs outline-none focus:border-primary focus:ring-3 focus:ring-primary/10" /></label><label className="flex items-center gap-2 self-end pb-2 text-xs font-semibold"><input type="checkbox" checked={preset.forceInstrumental} onChange={(event) => updatePreset(index, { forceInstrumental: event.target.checked })} /> Instrumental only</label></div></div></div>
    </div>) : <div className="rounded-xl border border-dashed border-[#b9d8ca] bg-white p-5 text-center text-xs text-muted-foreground">ยังไม่มี preset เพลง เพิ่มรายการเพื่อให้หน้า User แสดง dropdown</div>}</div>
    <button type="button" className="mt-3 inline-flex h-10 items-center gap-2 rounded-xl border border-dashed border-[#75ae91] bg-white px-4 text-xs font-bold text-[#347454] transition hover:bg-[#eef9f2]" onClick={addPreset}><span className="text-base leading-none">+</span> Add background preset</button>
  </section>;
}

function AudioProviderSettingsPanel() {
  const [settings, setSettings] = useState<AdminAudioSettings | null>(null);
  const [draft, setDraft] = useState<AdminAudioSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [generatingPreviewKey, setGeneratingPreviewKey] = useState("");
  const [selectedFeature, setSelectedFeature] = useState<AdminAudioFeature>("textToSpeech");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void getAdminAudioSettings().then((next) => {
      if (cancelled) return;
      setSettings(next);
      setDraft(next);
    }).catch((reason) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : "Unable to load audio settings");
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const next = await updateAdminAudioSettings({
        modelId: draft.modelId.trim(),
        voices: draft.voices,
        modelProfiles: draft.modelProfiles,
        featureProfiles: draft.featureProfiles,
        backgroundMusicPresets: draft.backgroundMusicPresets,
        routing: draft.routing,
        wavespeed: draft.providerSettings.wavespeed,
        elevenlabs: draft.providerSettings.elevenlabs,
        internal: draft.providerSettings.internal,
      });
      setSettings(next);
      setDraft(next);
      setMessage("Audio provider settings saved.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save audio provider settings");
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    setTesting(true);
    setMessage("");
    setError("");
    try {
      const result = draft?.routing[selectedFeature] === "elevenlabs" ? await testAdminElevenLabsConnection() : await testAdminWaveSpeedConnection();
      if (result.ok) setMessage(result.message);
      else setError(result.message);
      } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to test audio provider connection");
    } finally {
      setTesting(false);
    }
  };

  const isDirty = Boolean(settings && draft && JSON.stringify(settings) !== JSON.stringify(draft));
  const selectedFeatureProfile = draft?.featureProfiles[selectedFeature];
  const selectedFeatureModelId = selectedFeatureProfile?.modelId ?? draft?.modelId ?? "";
  const selectedFeatureProvider: "wavespeed" | "elevenlabs" = draft?.routing[selectedFeature] === "elevenlabs" ? "elevenlabs" : "wavespeed";
  const selectedProviderSettings = draft?.providerSettings[selectedFeatureProvider];
  const configuredFeatureModelIds = Object.keys(selectedFeatureProfile?.models ?? {});
  const modelOptionMap = new Map<string, { id: string; label: string }>();
  [...configuredFeatureModelIds, selectedFeatureModelId].forEach((modelId) => {
    if (modelId && !waveSpeedAudioModelOptions.some((option) => option.id === modelId)) modelOptionMap.set(modelId, { id: modelId, label: `Custom · ${modelId}` });
  });
  waveSpeedAudioModelOptions.forEach((option) => modelOptionMap.set(option.id, option));
  const modelOptions = Array.from(modelOptionMap.values());
  const activeVoices = selectedFeatureProfile?.models?.[selectedFeatureModelId]?.voices ?? selectedFeatureProfile?.voices ?? [];
  const selectFeatureModel = (modelId: string) => setDraft((current) => {
    if (!current) return current;
    const currentFeatureProfile = current.featureProfiles[selectedFeature] ?? { modelId: current.modelId, voices: [], models: {} };
    const currentModelId = currentFeatureProfile.modelId;
    const currentModelVoices = currentFeatureProfile.models?.[currentModelId]?.voices ?? currentFeatureProfile.voices ?? [];
    const models = { ...(currentFeatureProfile.models ?? {}), [currentModelId]: { voices: currentModelVoices } };
    const voices = selectedFeature === "soundEffects" || selectedFeature === "audioCleanup"
      ? []
      : models[modelId]?.voices ?? [];
    if (!models[modelId]) models[modelId] = { voices };
    return { ...current, featureProfiles: { ...current.featureProfiles, [selectedFeature]: { modelId, voices, models } } };
  });
  const updateActiveVoice = (index: number, patch: Partial<AdminAudioVoiceProfile>) => setDraft((current) => {
    if (!current) return current;
    const profile = current.featureProfiles[selectedFeature] ?? { modelId: current.modelId, voices: [], models: {} };
    const modelId = profile.modelId;
    const baseVoices = profile.models?.[modelId]?.voices ?? profile.voices ?? [];
    const voices = baseVoices.map((voice, voiceIndex) => voiceIndex === index ? { ...voice, ...patch } : voice);
    return { ...current, featureProfiles: { ...current.featureProfiles, [selectedFeature]: { ...profile, voices, models: { ...(profile.models ?? {}), [modelId]: { voices } } } } };
  });
  const generateVoicePreview = async (index: number, voice: AdminAudioVoiceProfile) => {
    const voiceId = voice.id.trim();
    if (!voiceId) {
      setError("กรุณาใส่ Voice ID ก่อนสร้าง Preview");
      return;
    }
    const feature = selectedFeature;
    const modelId = selectedFeatureModelId;
    const previewKey = `${feature}:${modelId}:${index}`;
    setGeneratingPreviewKey(previewKey);
    setMessage("");
    setError("");
    try {
      const result = await generateAdminAudioVoicePreview({ feature, modelId, voiceId });
      updateActiveVoice(index, { previewUrl: result.previewUrl, previewStorageKey: result.previewStorageKey });
      setMessage(`สร้างเสียง Preview ภาษาไทยสำหรับ ${voice.name || `Voice ${index + 1}`} แล้ว — กด Save provider settings เพื่อบันทึก`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to generate voice preview");
    } finally {
      setGeneratingPreviewKey("");
    }
  };
  const addActiveVoice = () => setDraft((current) => {
    if (!current) return current;
    if (selectedFeature === "soundEffects" || selectedFeature === "audioCleanup") return current;
    const profile = current.featureProfiles[selectedFeature] ?? { modelId: current.modelId, voices: [], models: {} };
    const modelId = profile.modelId;
    const baseVoices = profile.models?.[modelId]?.voices ?? profile.voices ?? [];
    const voices = [...baseVoices, { id: "", name: `Voice ${baseVoices.length + 1}`, description: "", imageUrl: "", previewUrl: "" }];
    return { ...current, featureProfiles: { ...current.featureProfiles, [selectedFeature]: { ...profile, voices, models: { ...(profile.models ?? {}), [modelId]: { voices } } } } };
  });
  const removeActiveVoice = (index: number) => setDraft((current) => {
    if (!current) return current;
    const profile = current.featureProfiles[selectedFeature] ?? { modelId: current.modelId, voices: [], models: {} };
    const modelId = profile.modelId;
    const baseVoices = profile.models?.[modelId]?.voices ?? profile.voices ?? [];
    const voices = baseVoices.filter((_, voiceIndex) => voiceIndex !== index);
    return { ...current, featureProfiles: { ...current.featureProfiles, [selectedFeature]: { ...profile, voices, models: { ...(profile.models ?? {}), [modelId]: { voices } } } } };
  });

  return <section aria-labelledby="audio-provider-settings-heading" className="mb-7 rounded-3xl border border-[#eaded6] bg-white p-5 shadow-[0_8px_24px_rgba(68,49,36,0.04)] sm:p-6">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Audio administration</p>
        <h2 id="audio-provider-settings-heading" className="mt-1 text-xl font-bold tracking-tight">Provider routing &amp; settings</h2>
        <p className="mt-2 max-w-2xl text-xs leading-5 text-muted-foreground">กำหนด provider ของแต่ละ tab และตั้งค่า ElevenLabs / WaveSpeed / Internal Audio Processor จากจุดเดียว</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-2 rounded-full bg-[#201d1b] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-white"><span className="h-2 w-2 rounded-full bg-[#f47d4b]" />Audio providers</span>
        <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] ${draft?.providerConfigured ? "bg-[#e3f3e9] text-[#347454]" : "bg-[#fff0e9] text-primary"}`}><span className={`h-2 w-2 rounded-full ${draft?.providerConfigured ? "bg-[#4c9b72]" : "bg-primary"}`} />ElevenLabs {draft?.providerConfigured ? "configured" : "missing"}</span>
      </div>
    </div>

    {error ? <div className="mt-4 rounded-xl border border-[#efc2c2] bg-[#fff6f6] p-3 text-xs text-[#9f3b3b]" role="alert">{error}</div> : null}
    {message ? <div className="mt-4 rounded-xl border border-[#bfe1cc] bg-[#f3fbf5] p-3 text-xs font-semibold text-[#347454]" role="status">{message}</div> : null}

    {loading || !draft ? <div className="mt-5 rounded-2xl border border-dashed border-[#d8d0ca] p-6 text-center text-xs text-muted-foreground">Loading audio provider settings...</div> : <>
      <section className="mt-5 rounded-2xl border border-border bg-[#fcfaf8] p-4" aria-labelledby="audio-routing-heading">
        <div className="flex items-start justify-between gap-3"><div><h3 id="audio-routing-heading" className="text-sm font-bold">Feature routing</h3><p className="mt-1 text-[11px] text-muted-foreground">เลือก provider ที่จะรับผิดชอบแต่ละ tab ใน Audio Studio</p></div><span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">5 features</span></div>
        <div className="mt-4 space-y-2">{audioRoutingRows.map((row) => <div key={row.key} className="flex flex-col justify-between gap-3 rounded-xl border border-border bg-white p-3 sm:flex-row sm:items-center"><div className="min-w-0"><p className="text-xs font-bold">{row.label}</p><p className="mt-0.5 text-[11px] text-muted-foreground">{row.description}</p></div><select value={draft.routing[row.key]} onChange={(event) => setDraft((current) => current ? { ...current, routing: { ...current.routing, [row.key]: event.target.value as AdminAudioProvider } } : current)} className="h-9 w-full shrink-0 rounded-lg border border-border bg-white px-2.5 text-xs font-bold outline-none focus:border-primary focus:ring-3 focus:ring-primary/10 sm:w-auto" aria-label={`${row.label} provider`}>{audioProviderOptions(row.key).map((provider) => <option key={provider} value={provider}>{audioProviderLabel(provider)}</option>)}</select></div>)}</div>
      </section>

      <section className="mt-4 rounded-2xl border border-[#f1c7b5] bg-[#fffaf7] p-4" aria-labelledby="audio-provider-details-heading">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-primary">Provider: {audioProviderLabel(selectedFeatureProvider)}</p><h3 id="audio-provider-details-heading" className="mt-1 text-base font-bold">Speech, dialogue, clone &amp; sound effects</h3><p className="mt-1 text-[11px] leading-5 text-muted-foreground">API key อยู่ใน backend secret; หน้านี้ตั้งค่า model, voice mapping และ transport ได้</p></div><Button variant="outline" size="sm" onClick={() => void testConnection()} disabled={testing}>{testing ? <LoaderCircle size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} {testing ? "Testing..." : "Test connection"}</Button></div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">{audioFeatureProfileRows.map((row) => <button key={row.key} type="button" onClick={() => setSelectedFeature(row.key)} className={`rounded-xl border px-3 py-2.5 text-left transition ${selectedFeature === row.key ? "border-primary bg-[#fff0e9]" : "border-border bg-white hover:border-primary/50"}`}><span className="block text-xs font-bold">{row.label}</span><span className="mt-0.5 block truncate text-[10px] text-muted-foreground">{draft.featureProfiles[row.key]?.modelId ?? "Not configured"}</span></button>)}</div>
        <label className="mt-4 block max-w-xl"><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{audioFeatureProfileRows.find((row) => row.key === selectedFeature)?.label} model</span><select value={selectedFeatureModelId} onChange={(event) => selectFeatureModel(event.target.value)} className="h-10 w-full rounded-xl border border-border bg-white px-3 font-mono text-xs outline-none transition focus:border-primary focus:ring-3 focus:ring-primary/10" aria-label={`${selectedFeature} model`}>{modelOptions.map((option) => <option key={option.id} value={option.id}>{option.label} ({option.id})</option>)}</select><span className="mt-1 block text-[10px] text-muted-foreground">ตั้ง model แยกเฉพาะ tab นี้</span></label>
        <div className="mt-4 grid gap-3 sm:grid-cols-2"><label><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Default format</span><select value={selectedProviderSettings?.defaultFormat ?? "mp3"} onChange={(event) => setDraft((current) => current ? { ...current, providerSettings: { ...current.providerSettings, [selectedFeatureProvider]: { ...current.providerSettings[selectedFeatureProvider], defaultFormat: event.target.value as "mp3" | "wav" | "ogg" } } } : current)} className="h-10 w-full rounded-xl border border-border bg-white px-3 text-xs font-semibold outline-none focus:border-primary focus:ring-3 focus:ring-primary/10" aria-label={`${audioProviderLabel(selectedFeatureProvider)} default format`}><option value="mp3">MP3</option><option value="wav">WAV</option><option value="ogg">OGG</option></select></label><label><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Request timeout (ms)</span><input type="number" min="1000" max="180000" step="1000" value={selectedProviderSettings?.timeoutMs ?? 60000} onChange={(event) => setDraft((current) => current ? { ...current, providerSettings: { ...current.providerSettings, [selectedFeatureProvider]: { ...current.providerSettings[selectedFeatureProvider], timeoutMs: Number(event.target.value) } } } : current)} className="h-10 w-full rounded-xl border border-border bg-white px-3 font-mono text-xs outline-none focus:border-primary focus:ring-3 focus:ring-primary/10" aria-label={`${audioProviderLabel(selectedFeatureProvider)} request timeout`} /></label></div>
        <div className="mt-4 space-y-3">
            {selectedFeature === "soundEffects" || selectedFeature === "audioCleanup" ? <div className="rounded-xl border border-dashed border-border bg-white p-4 text-xs text-muted-foreground">This tab does not use voice IDs. Configure its model above.</div> : <><div className="space-y-3">{activeVoices.length === 0 ? <div className="rounded-xl border border-dashed border-border bg-white p-4 text-xs text-muted-foreground">No voice IDs configured for this model. Add one below.</div> : activeVoices.map((voice, index) => { const previewKey = `${selectedFeature}:${selectedFeatureModelId}:${index}`; return <div key={`${selectedFeature}-${selectedFeatureModelId}-${index}`} className="rounded-xl border border-border bg-white p-3"><div className="mb-2 flex items-center justify-between gap-3"><span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Voice {index + 1}</span><button type="button" className="inline-flex items-center gap-1 text-[10px] font-bold text-[#9f3b3b] hover:underline" onClick={() => removeActiveVoice(index)}><X size={13} /> Remove</button></div><div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5"><label><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Voice ID</span><input value={voice.id} onChange={(event) => updateActiveVoice(index, { id: event.target.value })} placeholder="JBFqnCBsd6RMkjVDRZzb" className="h-10 w-full rounded-xl border border-border bg-white px-3 font-mono text-xs outline-none transition focus:border-primary focus:ring-3 focus:ring-primary/10" aria-label={`Voice ${index + 1} ID for ${selectedFeatureModelId}`} /></label><label><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Display name</span><input value={voice.name} onChange={(event) => updateActiveVoice(index, { name: event.target.value })} placeholder="Narrator" className="h-10 w-full rounded-xl border border-border bg-white px-3 text-xs outline-none transition focus:border-primary focus:ring-3 focus:ring-primary/10" aria-label={`Voice ${index + 1} name`} /></label><label><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Description</span><input value={voice.description} onChange={(event) => updateActiveVoice(index, { description: event.target.value })} placeholder="Warm and natural" className="h-10 w-full rounded-xl border border-border bg-white px-3 text-xs outline-none transition focus:border-primary focus:ring-3 focus:ring-primary/10" aria-label={`Voice ${index + 1} description`} /></label><label><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Image URL</span><input type="text" value={voice.imageUrl ?? ""} onChange={(event) => updateActiveVoice(index, { imageUrl: event.target.value })} placeholder="https://.../voice.png or /generated-assets/..." className="h-10 w-full rounded-xl border border-border bg-white px-3 text-xs outline-none transition focus:border-primary focus:ring-3 focus:ring-primary/10" aria-label={`Voice ${index + 1} image URL for ${selectedFeatureModelId}`} /></label><label><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Preview audio URL</span><div className="mt-1.5 flex gap-2"><input type="url" value={voice.previewUrl ?? ""} onChange={(event) => updateActiveVoice(index, { previewUrl: event.target.value })} placeholder="https://.../voice-preview.mp3" className="h-10 min-w-0 flex-1 rounded-xl border border-border bg-white px-3 text-xs outline-none transition focus:border-primary focus:ring-3 focus:ring-primary/10" aria-label={`Voice ${index + 1} preview audio URL for ${selectedFeatureModelId}`} /><button type="button" className="inline-flex h-10 shrink-0 items-center gap-1 rounded-xl border border-primary/50 bg-[#fff0e9] px-2.5 text-[10px] font-bold text-primary transition hover:bg-[#ffe5d9] disabled:cursor-not-allowed disabled:opacity-60" onClick={() => void generateVoicePreview(index, voice)} disabled={Boolean(generatingPreviewKey)} aria-busy={generatingPreviewKey === previewKey} title="สร้าง Preview ภาษาไทยผ่าน WaveSpeed">{generatingPreviewKey === previewKey ? <LoaderCircle size={13} className="animate-spin" /> : <AudioWaveform size={13} />} {generatingPreviewKey === previewKey ? "Generating..." : voice.previewUrl ? "Regenerate" : "Generate"}</button></div><span className="mt-1 block text-[10px] text-muted-foreground">สร้างตัวอย่างภาษาไทยผ่าน WaveSpeed และมีค่าใช้จ่ายตามจำนวนตัวอักษร</span></label></div></div>; })}</div><button type="button" className="mt-3 inline-flex h-10 items-center gap-2 rounded-xl border border-dashed border-primary/50 bg-white px-4 text-xs font-bold text-primary transition hover:bg-[#fff0e9]" onClick={addActiveVoice}><span className="text-base leading-none">+</span> Add voice ID</button></>}
        </div>
      </section>

      <BackgroundMusicPresetsEditor presets={draft.backgroundMusicPresets} onChange={(backgroundMusicPresets) => setDraft((current) => current ? { ...current, backgroundMusicPresets } : current)} />

      <section className="mt-4 rounded-2xl border border-[#ddd5ee] bg-[#faf8ff] p-4" aria-labelledby="internal-settings-heading">
        <div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#66518f]">Provider: Internal Audio Processor</p><h3 id="internal-settings-heading" className="mt-1 text-base font-bold">Audio Cleanup</h3><p className="mt-1 text-[11px] leading-5 text-muted-foreground">ใช้สำหรับ noise reduction, voice clarity และ remove reverb โดยไม่ส่ง API key ไปยัง browser</p></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3"><label><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">FFmpeg path</span><input value={draft.providerSettings.internal.ffmpegPath} onChange={(event) => setDraft((current) => current ? { ...current, providerSettings: { ...current.providerSettings, internal: { ...current.providerSettings.internal, ffmpegPath: event.target.value } } } : current)} className="h-10 w-full rounded-xl border border-border bg-white px-3 font-mono text-xs outline-none focus:border-primary focus:ring-3 focus:ring-primary/10" aria-label="FFmpeg path" /></label><label><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Max upload (MB)</span><input type="number" min="1" max="500" value={draft.providerSettings.internal.maxUploadMb} onChange={(event) => setDraft((current) => current ? { ...current, providerSettings: { ...current.providerSettings, internal: { ...current.providerSettings.internal, maxUploadMb: Number(event.target.value) } } } : current)} className="h-10 w-full rounded-xl border border-border bg-white px-3 font-mono text-xs outline-none focus:border-primary focus:ring-3 focus:ring-primary/10" aria-label="Internal processor max upload" /></label><label><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Default format</span><select value={draft.providerSettings.internal.defaultFormat} onChange={(event) => setDraft((current) => current ? { ...current, providerSettings: { ...current.providerSettings, internal: { ...current.providerSettings.internal, defaultFormat: event.target.value as "mp3" | "wav" | "ogg" } } } : current)} className="h-10 w-full rounded-xl border border-border bg-white px-3 text-xs font-semibold outline-none focus:border-primary focus:ring-3 focus:ring-primary/10" aria-label="Internal processor default format"><option value="mp3">MP3</option><option value="wav">WAV</option><option value="ogg">OGG</option></select></label></div>
      </section>

      <div className="mt-5 flex flex-col justify-between gap-3 border-t border-border pt-4 sm:flex-row sm:items-center"><p className="max-w-2xl text-[11px] leading-5 text-muted-foreground">บันทึก routing และ settings ทั้งหมดพร้อมกัน ค่า API key ยังคงอยู่ใน backend secret เท่านั้น</p><Button size="sm" onClick={() => void save()} disabled={saving || !isDirty || !draft.modelId.trim()}>{saving ? <LoaderCircle size={15} className="animate-spin" /> : <Check size={15} />} {saving ? "Saving..." : "Save provider settings"}</Button></div>
    </>}
  </section>;
}

function AdminModelRoutesContent() {
  const searchParams = useSearchParams();
  const requestedFeature = searchParams.get("feature");
  const featureParam = (requestedFeature === "video" ? "image-to-video" : requestedFeature) as FeatureId | null;
  const feature = featureParam && [...imageFunctions, ...videoFunctions, ...features].some((item) => item.id === featureParam) ? featureParam : imageFunctions[0].id;
  const [backgroundMode, setBackgroundMode] = useState<AiBackgroundMode>("remove");
  const routeKey = feature === "background-removal" ? `background-removal:${backgroundMode}` : feature;
  const [models, setModels] = useState<GenerationModelOption[]>([]);
  const [catalog, setCatalog] = useState<GenerationModelOption[]>([]);
  const [routeOverview, setRouteOverview] = useState<Record<string, GenerationModelOption[]>>({});
  const [catalogCount, setCatalogCount] = useState(0);
  const [selectedModel, setSelectedModel] = useState("");
  const [savedModel, setSavedModel] = useState("");
  const [enabledModels, setEnabledModels] = useState<string[]>([]);
  const [savedEnabledModels, setSavedEnabledModels] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [assignmentFeature, setAssignmentFeature] = useState<FeatureId>(imageFunctions[0].id);
  const [assignmentBackgroundMode, setAssignmentBackgroundMode] = useState<AiBackgroundMode>("remove");
  const [assignmentCatalog, setAssignmentCatalog] = useState<GenerationModelOption[]>([]);
  const [assignmentDrafts, setAssignmentDrafts] = useState<Record<string, AssignmentDraft>>({});
  const [savedAssignmentDrafts, setSavedAssignmentDrafts] = useState<Record<string, AssignmentDraft>>({});
  const [assignmentSaving, setAssignmentSaving] = useState(false);
  const [detailsModel, setDetailsModel] = useState<GenerationModelOption | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const overview: AdminModelRoutesOverview = await listAdminModelRoutesOverview();
      const allModels = overview.catalog;
      const next = overview.routes[routeKey] ?? overview.routes[feature] ?? [];
      setRouteOverview(overview.routes);
      setCatalog(allModels);
      setCatalogCount(allModels.length);
      const defaultModel = next.find((item) => item.isDefault)?.model ?? "";
      // The main route screen shows only models assigned to this function.
      // The full catalog remains available inside the drag-and-drop dialog.
      const assigned = next.filter((item) => item.enabled);
      setModels(assigned);
      setSelectedModel(defaultModel);
      setSavedModel(defaultModel);
      const enabled = assigned.map((item) => item.model);
      setEnabledModels(enabled);
      setSavedEnabledModels(enabled);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load model routes");
    } finally {
      setLoading(false);
    }
  }, [feature, routeKey]);

  useEffect(() => {
    const loadTimer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(loadTimer);
  }, [load]);

  const filteredModels = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return models;
    return models.filter((item) => `${item.displayName} ${item.provider} ${item.model}`.toLowerCase().includes(normalizedQuery));
  }, [models, query]);

  const enabledCount = enabledModels.length;
  const enabledChanged = enabledModels.length !== savedEnabledModels.length || enabledModels.some((model) => !savedEnabledModels.includes(model));
  const hasChanges = selectedModel !== savedModel || enabledChanged;
  const activeFeature = imageFunctions.find((item) => item.id === feature) ?? videoFunctions.find((item) => item.id === feature) ?? features.find((item) => item.id === feature) ?? imageFunctions[0];

  const save = async () => {
    if (!selectedModel || !hasChanges) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const selected = catalog.find((item) => item.model === selectedModel && isFeatureCompatible(item, feature));
      if (!selected) throw new Error("Selected model is no longer in the catalog");
      if (!enabledModels.includes(selectedModel)) throw new Error("The default model must be allowed for this feature");
      const changed = catalog.filter((item) => isFeatureCompatible(item, feature) && enabledModels.includes(item.model) !== savedEnabledModels.includes(item.model));
      const modeOptions = feature === "background-removal" ? { backgroundMode } : {};
      for (const item of changed) {
        await updateGenerationModelRoute(feature, item.model, item.provider, { ...modeOptions, enabled: enabledModels.includes(item.model), ...(item.model === selectedModel ? { isDefault: true } : {}) });
      }
      if (!changed.some((item) => item.model === selectedModel) && selectedModel !== savedModel) {
        await updateGenerationModelRoute(feature, selectedModel, selected.provider, { ...modeOptions, enabled: true, isDefault: true });
      }
      setSavedModel(selectedModel);
      setSavedEnabledModels(enabledModels);
      setMessage(`${activeFeature.label} default updated.`);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to update model route");
    } finally {
      setBusy(false);
    }
  };

  const selectModel = (model: string) => {
    setSelectedModel(model);
    if (!enabledModels.includes(model)) {
      setEnabledModels((current) => [...current, model]);
      setModels((current) => current.map((item) => item.model === model ? { ...item, enabled: true } : item));
    }
  };

  const toggleModel = (model: string) => {
    if (model === selectedModel && enabledModels.includes(model)) {
      setMessage("Choose another default model before disabling this model.");
      return;
    }
    setEnabledModels((current) => current.includes(model) ? current.filter((item) => item !== model) : [...current, model]);
    setModels((current) => current.map((item) => item.model === model ? { ...item, enabled: !item.enabled } : item));
  };

  const openAssignment = () => {
    setAssignmentFeature(feature);
    setAssignmentBackgroundMode(backgroundMode);
    const assignmentModels = [...new Map([...catalog, ...models].map((item) => [item.model, item])).values()];
    setAssignmentCatalog(assignmentModels);
    const targetFeatures = [...imageFunctions.map((item) => item.id), ...videoFunctions.map((item) => item.id), ...features.map((item) => item.id)] as FeatureId[];
    const drafts = Object.fromEntries(targetFeatures.map((target) => {
      const targetRouteKey = target === "background-removal" ? `background-removal:${backgroundMode}` : target;
      // Use the already loaded mode-specific list for the active feature. This
      // keeps the assignment dialog in sync with the cards on the main page.
      const routes = target === "background-removal"
        ? [...new Map([...models, ...(routeOverview[targetRouteKey] ?? [])].map((item) => [item.model, item])).values()]
        : routeOverview[targetRouteKey] ?? routeOverview[target] ?? [];
      return [target, { assignedModelIds: routes.filter((item) => item.enabled).map((item) => item.model), defaultModel: routes.find((item) => item.isDefault)?.model ?? "" }];
    })) as Record<string, AssignmentDraft>;
    setAssignmentDrafts(drafts);
    setSavedAssignmentDrafts(drafts);
    setAssignmentOpen(true);
  };

  const changeAssignmentBackgroundMode = (mode: AiBackgroundMode) => {
    const routes = routeOverview[`background-removal:${mode}`] ?? [];
    const draft = { assignedModelIds: routes.filter((item) => item.enabled).map((item) => item.model), defaultModel: routes.find((item) => item.isDefault)?.model ?? "" };
    setAssignmentBackgroundMode(mode);
    setAssignmentDrafts((current) => ({ ...current, "background-removal": draft }));
    setSavedAssignmentDrafts((current) => ({ ...current, "background-removal": draft }));
  };

  const saveAssignment = async () => {
    setAssignmentSaving(true);
    setError("");
    try {
      const targetFeatures = [...imageFunctions.map((item) => item.id), ...videoFunctions.map((item) => item.id), ...features.map((item) => item.id)] as FeatureId[];
      for (const target of targetFeatures) {
        const draft = assignmentDrafts[target] ?? { assignedModelIds: [], defaultModel: "" };
        if (draft.assignedModelIds.length > 0 && !draft.defaultModel) throw new Error(`${formatFeature(target)} needs a default model`);
        const original = savedAssignmentDrafts[target] ?? { assignedModelIds: [], defaultModel: "" };
        const currentCatalog = target === "background-removal" ? assignmentCatalog : catalog;
        const current = currentCatalog.filter((item) => isFeatureCompatible(item, target));
        for (const item of current) {
          const shouldBeEnabled = draft.assignedModelIds.includes(item.model);
          const wasEnabled = original.assignedModelIds.includes(item.model);
          const shouldBeDefault = draft.defaultModel === item.model;
          const wasDefault = original.defaultModel === item.model;
          if (shouldBeEnabled !== wasEnabled || shouldBeDefault !== wasDefault) {
            await updateGenerationModelRoute(target, item.model, item.provider, { ...(target === "background-removal" ? { backgroundMode: assignmentBackgroundMode } : {}), enabled: shouldBeEnabled, isDefault: shouldBeDefault });
          }
        }
      }
      setSavedAssignmentDrafts(assignmentDrafts);
      setAssignmentOpen(false);
      setMessage("Model assignments saved.");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save model assignments");
    } finally {
      setAssignmentSaving(false);
    }
  };

  const addAssignment = (target: FeatureId, model: string) => {
    setAssignmentDrafts((current) => {
      const draft = current[target] ?? { assignedModelIds: [], defaultModel: "" };
      if (draft.assignedModelIds.includes(model)) return current;
      return { ...current, [target]: { assignedModelIds: [...draft.assignedModelIds, model], defaultModel: draft.defaultModel || model } };
    });
  };

  const removeAssignment = (target: FeatureId, model: string) => {
    setAssignmentDrafts((current) => {
      const draft = current[target] ?? { assignedModelIds: [], defaultModel: "" };
      const assignedModelIds = draft.assignedModelIds.filter((item) => item !== model);
      return { ...current, [target]: { assignedModelIds, defaultModel: draft.defaultModel === model ? assignedModelIds[0] ?? "" : draft.defaultModel } };
    });
  };

  const setAssignmentDefault = (target: FeatureId, model: string) => {
    setAssignmentDrafts((current) => ({ ...current, [target]: { ...(current[target] ?? { assignedModelIds: [], defaultModel: "" }), defaultModel: model } }));
  };

  const sync = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await syncGenerationModels();
      setMessage(`${result.synced} provider models synced${result.skipped ? `, ${result.skipped} unsupported skipped` : ""}.`);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to sync model catalog");
    } finally {
      setBusy(false);
    }
  };

  const saveModelInputLimits = async (model: string, provider: string, limits: ModelUploadConstraints) => {
    setBusy(true);
    setError("");
    try {
      const overview = await updateModelInputLimits(model, provider, limits);
      setCatalog(overview.catalog);
      setCatalogCount(overview.catalog.length);
      setRouteOverview(overview.routes);
      const next = overview.routes[routeKey] ?? overview.routes[feature] ?? [];
      setModels(next.filter((item) => item.enabled));
      const updated = overview.catalog.find((item) => item.model === model && item.provider === provider);
      if (updated) setDetailsModel(updated);
      setMessage(`${updated?.displayName ?? model} upload limits saved.`);
    } catch (reason) {
      throw reason instanceof Error ? reason : new Error("Unable to save upload limits");
    } finally {
      setBusy(false);
    }
  };

  const saveModelDisplayName = async (model: string, provider: string, displayName: string) => {
    setBusy(true);
    setError("");
    try {
      const overview = await updateModelDisplayName(model, provider, displayName);
      setCatalog(overview.catalog);
      setCatalogCount(overview.catalog.length);
      setRouteOverview(overview.routes);
      const next = overview.routes[routeKey] ?? overview.routes[feature] ?? [];
      setModels(next.filter((item) => item.enabled));
      const updated = overview.catalog.find((item) => item.model === model && item.provider === provider);
      if (updated) setDetailsModel(updated);
      setMessage(`${updated?.displayName ?? displayName} display name saved.`);
    } catch (reason) {
      throw reason instanceof Error ? reason : new Error("Unable to save display name");
    } finally {
      setBusy(false);
    }
  };

  const saveModelPreview = async (model: string, provider: string, preview: { previewUrl: string | null; previewStorageKey: string | null; previewType: ModelPreviewType | null }, previewBackgroundMode?: AiBackgroundMode) => {
    setBusy(true);
    setError("");
    try {
      const overview = await updateAdminModelPreview(model, provider, feature, feature === "background-removal" ? previewBackgroundMode ?? backgroundMode : undefined, preview);
      setCatalog(overview.catalog);
      setCatalogCount(overview.catalog.length);
      setRouteOverview(overview.routes);
      const next = overview.routes[routeKey] ?? overview.routes[feature] ?? [];
      setModels(next.filter((item) => item.enabled));
      const updated = next.find((item) => item.model === model && item.provider === provider);
      if (updated) setDetailsModel(updated);
      setMessage(`${updated?.displayName ?? model} preview saved.`);
    } catch (reason) {
      throw reason instanceof Error ? reason : new Error("Unable to save model preview");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen w-full min-w-0 bg-background">
        <SidebarNavigation />
        <div className="min-w-0 lg:pl-[var(--sidebar-width)]">
          <StudioHeader />
          <main className="page-gutter mx-auto w-full max-w-[1600px] py-5 lg:py-8">
            <div className="min-h-[calc(100vh-120px)] overflow-x-clip rounded-3xl bg-[#faf8f6] px-4 pb-20 sm:px-6 lg:px-8 lg:pb-24">
      <div className="mx-auto max-w-[1180px] pt-6 lg:pt-8">
        <div className="mb-8 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
           <div><div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#201d1b] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white"><ServerCog size={13} /> Control plane</div><h1 className="max-w-xl text-3xl font-bold tracking-tight sm:text-4xl">{feature === "audio" ? "Audio provider settings" : "Generation model routes"}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{feature === "audio" ? "Configure ElevenLabs, WaveSpeed and internal audio processing for Create > Audio." : "Choose the model that powers each creative feature. Changes apply to new generations immediately."}</p></div>
           {feature === "audio" ? <span className="rounded-full bg-[#fff0e9] px-3 py-2 text-xs font-bold text-primary">ElevenLabs / WaveSpeed configuration</span> : <div className="flex flex-wrap justify-end gap-2"><Button variant="outline" size="lg" onClick={() => void openAssignment()} disabled={busy || loading}><Settings2 size={17} /> Assign models</Button><Button variant="outline" size="lg" onClick={() => void sync()} disabled={busy || loading}><CloudDownload size={17} /> {busy ? "Syncing catalog..." : "Sync provider catalog"}</Button></div>}
        </div>

        {error ? <div className="mb-5 flex items-start gap-3 rounded-2xl border border-[#efc2c2] bg-[#fff6f6] p-4 text-sm text-[#9f3b3b]" role="alert"><AlertCircle className="mt-0.5 shrink-0" size={18} /><div><p className="font-bold">Couldn&apos;t load model routes</p><p className="mt-1 text-xs leading-5">{error}</p><button type="button" className="mt-2 text-xs font-bold underline underline-offset-2" onClick={() => void load()}>Try again</button></div></div> : null}
        {message ? <div className="mb-5 flex items-center gap-3 rounded-2xl border border-[#bfe1cc] bg-[#f3fbf5] p-4 text-sm text-[#347454]" role="status"><CheckCircle2 size={18} /><p className="font-semibold">{message}</p></div> : null}

         {feature === "audio" ? <div className="mb-6 grid gap-3 sm:grid-cols-3"><StatCard label="Audio provider" value="ElevenLabs" detail="Direct API for speech" accent="orange" /><StatCard label="Voice mappings" value="Per model" detail="Add Voice IDs below" accent="green" /><StatCard label="Other audio" value="WaveSpeed / Internal" detail="Clone, effects &amp; cleanup" accent="pink" /></div> : <div className="mb-6 grid gap-3 sm:grid-cols-3"><StatCard label="Active feature" value={activeFeature.label} detail="Currently configuring" accent="orange" /><StatCard label="Allowed models" value={loading ? "—" : String(enabledCount)} detail={`${models.length} available for this function`} accent="green" /><StatCard label="All catalog models" value={loading ? "—" : String(catalogCount)} detail="Loaded before feature setup" accent="pink" /></div>}

        {feature === "audio" ? <AudioProviderSettingsPanel /> : null}
        {feature === "image-to-video" ? <VideoStoryboardSettingsPanel /> : null}

        {feature === "audio" ? null : <div className="grid gap-6 lg:grid-cols-1 lg:items-start">
          <section aria-labelledby="route-heading" className="min-w-0">
            <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Route configuration</p><h2 id="route-heading" className="mt-1 text-xl font-bold tracking-tight">{activeFeature.label}</h2></div><div className="relative w-full sm:w-60"><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search models" aria-label="Search models" className="h-9 w-full rounded-xl border border-border bg-white pl-9 pr-3 text-xs outline-none transition focus:border-primary focus:ring-3 focus:ring-primary/10" /></div></div>
            {feature === "background-removal" ? <div className="mb-4 rounded-2xl border border-[#f1c7b5] bg-[#fffaf7] p-3"><div className="mb-2 flex items-center justify-between gap-3"><div><p className="text-xs font-bold">AI Background mode</p><p className="mt-1 text-[11px] text-muted-foreground">ตั้ง model และ default แยกตามงานที่เลือก</p></div><span className="rounded-full bg-[#fff0e9] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-primary">Mode-specific</span></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="tablist" aria-label="AI Background modes">{aiBackgroundModes.map((mode) => <button key={mode.id} type="button" role="tab" aria-selected={backgroundMode === mode.id} onClick={() => { setBackgroundMode(mode.id); setQuery(""); }} className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${backgroundMode === mode.id ? "border-primary bg-primary text-white" : "border-border bg-white hover:border-primary/50"}`}><span className="block text-xs font-bold">{mode.label}</span><span className={`mt-0.5 block text-[10px] ${backgroundMode === mode.id ? "text-white/80" : "text-muted-foreground"}`}>{mode.description}</span></button>)}</div></div> : null}
            <div className="mb-4 flex items-center justify-between rounded-xl border border-[#eaded6] bg-[#fffdfb] px-4 py-3"><div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#4c9b72]" /><p className="text-xs font-semibold">{loading ? "Loading catalog..." : `${enabledCount} allowed · ${filteredModels.length} available`}</p></div><Button variant="ghost" size="sm" onClick={() => void openAssignment()} disabled={loading}><Settings2 size={14} /> Open drag &amp; drop</Button></div>
            <ModelGrid models={filteredModels} selectedModel={selectedModel} onSelect={selectModel} onToggleEnabled={toggleModel} onDetails={setDetailsModel} onOpenAssignment={openAssignment} loading={loading} query={query} />
          </section>
        </div>}
      </div>

      {feature !== "audio" ? <div className={`fixed inset-x-0 bottom-0 z-30 border-t border-border bg-white/95 px-[var(--page-gutter)] py-3 shadow-[0_-8px_30px_rgba(68,49,36,0.08)] backdrop-blur transition-transform ${hasChanges ? "translate-y-0" : "translate-y-full"}`} aria-live="polite"><div className="mx-auto flex max-w-[1180px] flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><p className="text-xs font-bold">Unsaved route changes</p><p className="mt-0.5 text-[11px] text-muted-foreground">{selectedModel ? `${enabledCount} model${enabledCount === 1 ? "" : "s"} allowed; ${formatFeature(feature)} default: ${selectedModel}.` : "Select a model to continue."}</p></div><div className="flex items-center gap-2"><Button variant="ghost" size="sm" onClick={() => { setSelectedModel(savedModel); setEnabledModels(savedEnabledModels); setModels((current) => current.map((item) => ({ ...item, enabled: savedEnabledModels.includes(item.model) }))); }} disabled={busy}>Cancel</Button><Button size="sm" onClick={() => void save()} disabled={busy || !selectedModel || !hasChanges}>{busy ? <LoaderCircle size={15} className="animate-spin" /> : <Check size={15} />} {busy ? "Saving..." : "Save route settings"}</Button></div></div></div> : null}
      {assignmentOpen ? <MultiTargetModelAssignmentDialog feature={assignmentFeature} catalog={assignmentFeature === "background-removal" ? assignmentCatalog : [...new Map([...catalog, ...models].map((item) => [item.model, item])).values()]} assignments={assignmentDrafts} backgroundMode={assignmentBackgroundMode} onFeatureChange={setAssignmentFeature} onBackgroundModeChange={changeAssignmentBackgroundMode} onAdd={addAssignment} onRemove={removeAssignment} onSetDefault={setAssignmentDefault} onClose={() => setAssignmentOpen(false)} onSave={saveAssignment} saving={assignmentSaving} /> : null}
      {detailsModel ? <ModelDetailsDialog key={`${feature}:${backgroundMode}:${detailsModel.model}:${detailsModel.provider}`} item={detailsModel} feature={feature} backgroundMode={feature === "background-removal" ? backgroundMode : undefined} onClose={() => setDetailsModel(null)} onSaveDisplayName={saveModelDisplayName} onSaveInputLimits={saveModelInputLimits} onSavePreview={saveModelPreview} /> : null}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

export default function AdminModelRoutesPage() {
  return <Suspense fallback={<div className="min-h-screen bg-background" />}><AdminModelRoutesContent /></Suspense>;
}
