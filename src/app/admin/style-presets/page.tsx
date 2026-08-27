"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, CheckCircle2, ImagePlus, LoaderCircle, Palette, Plus, RefreshCw, Save, Trash2, X } from "lucide-react";
import { SidebarNavigation } from "@/components/app-shell/navigation";
import { SidebarProvider } from "@/components/ui/sidebar";
import { StudioHeader } from "@/components/app-shell/studio-header";
import { Button } from "@/components/ui/button";
import { createAdminStylePreset, deleteAdminStylePresetImage, disableAdminStylePreset, listAdminStylePresets, stylePresetFeatureOptions, updateAdminStylePreset, uploadAdminStylePresetImage, type GenerationStylePreset, type SaveStylePresetInput, type StylePresetFeature } from "@/lib/api/style-presets";

const featureLabels: Record<StylePresetFeature, string> = {
  "text-to-image": "Text to Image",
  "image-to-image": "Image to Image",
  "background-removal": "AI Background",
  "style-transfer": "Style Transfer",
};

type Draft = SaveStylePresetInput & { id?: string };

const emptyDraft: Draft = {
  name: "",
  prompt: "",
  imageUrl: "",
  features: ["text-to-image", "image-to-image", "background-removal"],
  enabled: true,
  sortOrder: 60,
};

function thumbStyle(imageUrl: string | null | undefined): { backgroundImage: string; backgroundSize: string; backgroundPosition: string } | undefined {
  if (!imageUrl) return undefined;
  return { backgroundImage: `url("${imageUrl.replaceAll('"', "\\\"")}")`, backgroundSize: "cover", backgroundPosition: "center" };
}

function PresetEditor({ draft, busy, uploading, onChange, onUpload, onSave, onClose }: { draft: Draft; busy: boolean; uploading: boolean; onChange: (next: Draft) => void; onUpload: (file: File) => void; onSave: () => void; onClose: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toggleFeature = (feature: StylePresetFeature) => onChange({ ...draft, features: draft.features.includes(feature) ? draft.features.filter((item) => item !== feature) : [...draft.features, feature] });
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#201d1b]/45 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="style-preset-editor-title">
    <div className="flex max-h-[min(760px,calc(100vh-32px))] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-[#eaded6] bg-[#faf8f6] shadow-[0_24px_80px_rgba(68,49,36,0.25)]">
      <header className="flex items-start justify-between gap-4 border-b border-border bg-white px-5 py-4 sm:px-7 sm:py-5"><div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-primary">Style preset editor</p><h2 id="style-preset-editor-title" className="mt-1 text-xl font-bold tracking-tight">{draft.id ? "Edit style preset" : "Create style preset"}</h2><p className="mt-1 text-xs text-muted-foreground">The prompt is applied server-side when this preset is selected.</p></div><button type="button" onClick={onClose} className="rounded-xl p-2 text-muted-foreground hover:bg-surface-muted" aria-label="Close style preset editor"><X size={19} /></button></header>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5 sm:p-7">
        <div className="grid gap-4 sm:grid-cols-2"><label className="text-xs font-semibold">Name<input value={draft.name} onChange={(event) => onChange({ ...draft, name: event.target.value })} className="mt-2 h-10 w-full rounded-xl border border-border bg-white px-3 text-sm outline-none focus:border-primary" placeholder="Editorial" /></label><label className="text-xs font-semibold">Slug <span className="font-normal text-muted-foreground">(optional)</span><input value={draft.slug ?? ""} onChange={(event) => onChange({ ...draft, slug: event.target.value })} className="mt-2 h-10 w-full rounded-xl border border-border bg-white px-3 font-mono text-sm outline-none focus:border-primary" placeholder="editorial" /></label></div>
        <label className="block text-xs font-semibold">Prompt instruction<textarea value={draft.prompt} onChange={(event) => onChange({ ...draft, prompt: event.target.value })} className="mt-2 min-h-28 w-full resize-y rounded-xl border border-border bg-white p-3 text-sm leading-6 outline-none focus:border-primary" placeholder="Premium editorial photography, soft directional light..." /></label>
        <div className="grid gap-4 sm:grid-cols-[1fr_150px]"><div><label className="block text-xs font-semibold">Preview image URL<input value={draft.imageUrl ?? ""} onChange={(event) => onChange({ ...draft, imageUrl: event.target.value, imageStorageKey: undefined })} className="mt-2 h-10 w-full rounded-xl border border-border bg-white px-3 text-sm outline-none focus:border-primary" placeholder="/generated-assets/style-cinematic.png" /></label><input ref={fileInputRef} type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) onUpload(file); event.currentTarget.value = ""; }} /><Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => fileInputRef.current?.click()} disabled={busy || uploading}><ImagePlus size={15} />{uploading ? "Uploading…" : "Upload image"}</Button><p className="mt-1 text-[10px] font-normal text-muted-foreground">JPG, PNG, or WebP · max 10 MB</p></div><label className="text-xs font-semibold">Sort order<input type="number" min={0} value={draft.sortOrder ?? 0} onChange={(event) => onChange({ ...draft, sortOrder: Number(event.target.value) })} className="mt-2 h-10 w-full rounded-xl border border-border bg-white px-3 text-sm outline-none focus:border-primary" /></label></div>
        <section><p className="text-xs font-semibold">Show preset in</p><div className="mt-2 grid gap-2 sm:grid-cols-2">{stylePresetFeatureOptions.map((feature) => <button type="button" key={feature} onClick={() => toggleFeature(feature)} className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-xs font-semibold transition-colors ${draft.features.includes(feature) ? "border-primary bg-[#fff0e9] text-primary" : "border-border bg-white text-muted-foreground"}`} aria-pressed={draft.features.includes(feature)}><span className={`flex h-5 w-5 items-center justify-center rounded-md border ${draft.features.includes(feature) ? "border-primary bg-primary text-white" : "border-border"}`}>{draft.features.includes(feature) ? <Check size={13} strokeWidth={3} /> : null}</span>{featureLabels[feature]}</button>)}</div></section>
        <button type="button" onClick={() => onChange({ ...draft, enabled: !draft.enabled })} className={`flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left text-xs font-semibold ${draft.enabled ? "border-[#bfe1cc] bg-[#f3fbf5] text-[#347454]" : "border-border bg-white text-muted-foreground"}`} aria-pressed={draft.enabled}><span><b>{draft.enabled ? "Enabled" : "Disabled"}</b><small className="mt-1 block font-normal">Disabled presets are hidden and cannot be selected for new generations.</small></span><span className={`flex h-5 w-5 items-center justify-center rounded-full border ${draft.enabled ? "border-[#4c9b72] bg-[#4c9b72] text-white" : "border-border"}`}>{draft.enabled ? <Check size={13} strokeWidth={3} /> : null}</span></button>
      </div>
      <footer className="flex justify-end gap-2 border-t border-border bg-white px-5 py-4 sm:px-7"><Button variant="ghost" size="sm" onClick={onClose} disabled={busy}>Cancel</Button><Button size="sm" onClick={onSave} disabled={busy || !draft.name.trim() || !draft.prompt.trim() || draft.features.length === 0}>{busy ? <LoaderCircle size={15} className="animate-spin" /> : <Save size={15} />} {busy ? "Saving..." : "Save preset"}</Button></footer>
    </div>
  </div>;
}

function AdminStylePresetsContent() {
  const [presets, setPresets] = useState<GenerationStylePreset[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [filter, setFilter] = useState<StylePresetFeature | "all">("all");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const uploadedImageKeysRef = useRef<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setPresets(await listAdminStylePresets()); } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to load style presets"); } finally { setLoading(false); }
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);

  const filtered = useMemo(() => filter === "all" ? presets : presets.filter((preset) => preset.features.includes(filter)), [filter, presets]);
  const save = async () => {
    if (!draft || uploading) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const input: SaveStylePresetInput = { slug: draft.slug, name: draft.name, prompt: draft.prompt, imageUrl: draft.imageUrl ?? "", imageStorageKey: draft.imageStorageKey ?? undefined, features: draft.features, enabled: draft.enabled, sortOrder: draft.sortOrder };
      const saved = draft.id ? await updateAdminStylePreset(draft.id, input) : await createAdminStylePreset(input);
      await Promise.allSettled([...uploadedImageKeysRef.current].filter((key) => key !== saved.imageStorageKey).map((key) => deleteAdminStylePresetImage(key)));
      uploadedImageKeysRef.current.clear();
      setPresets((current) => draft.id ? current.map((item) => item.id === saved.id ? saved : item) : [...current, saved].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)));
      setDraft(null); setMessage(`${saved.name} saved.`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to save style preset"); } finally { setBusy(false); }
  };

  const uploadImage = async (file: File) => {
    setUploading(true); setError(""); setMessage("");
    try {
      const uploaded = await uploadAdminStylePresetImage(file);
      uploadedImageKeysRef.current.add(uploaded.storageKey);
      setDraft((current) => current ? { ...current, imageUrl: uploaded.previewUrl ?? "", imageStorageKey: uploaded.storageKey } : current);
      setMessage("Image uploaded. Save the preset to apply it.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to upload style preset image"); } finally { setUploading(false); }
  };

  const closeDraft = async () => {
    if (uploading) return;
    setBusy(true); setError("");
    await Promise.allSettled([...uploadedImageKeysRef.current].map((key) => deleteAdminStylePresetImage(key)));
    uploadedImageKeysRef.current.clear();
    setDraft(null); setBusy(false);
  };

  const disable = async (preset: GenerationStylePreset) => {
    if (!window.confirm(`Disable ${preset.name}? It will disappear from the creator.`)) return;
    setBusy(true); setError(""); setMessage("");
    try { const updated = await disableAdminStylePreset(preset.id); setPresets((current) => current.map((item) => item.id === updated.id ? updated : item)); setMessage(`${preset.name} disabled.`); } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to disable style preset"); } finally { setBusy(false); }
  };

  return <SidebarProvider><div className="min-h-screen w-full min-w-0 bg-background"><SidebarNavigation /><div className="min-w-0 lg:pl-[var(--sidebar-width)]"><StudioHeader /><main className="page-gutter mx-auto w-full max-w-[1600px] py-5 lg:py-8"><div className="min-h-[calc(100vh-120px)] overflow-x-clip rounded-3xl bg-[#faf8f6] px-4 pb-20 sm:px-6 lg:px-8 lg:pb-24"><div className="mx-auto max-w-[1180px] pt-6 lg:pt-8">
    <div className="mb-8 flex flex-col justify-between gap-5 lg:flex-row lg:items-end"><div><div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#201d1b] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white"><Palette size={13} /> Control plane</div><h1 className="max-w-xl text-3xl font-bold tracking-tight sm:text-4xl">Style presets</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Manage the style names, prompt instructions, preview images, and creator features from one place.</p></div><div className="flex flex-wrap justify-end gap-2"><Button variant="outline" size="lg" onClick={() => void load()} disabled={loading || busy}><RefreshCw size={16} className={loading ? "animate-spin" : undefined} /> Refresh</Button><Button size="lg" onClick={() => setDraft({ ...emptyDraft })} disabled={busy}><Plus size={17} /> New preset</Button></div></div>
    {error ? <div className="mb-5 rounded-2xl border border-[#efc2c2] bg-[#fff6f6] p-4 text-sm text-[#9f3b3b]" role="alert">{error}</div> : null}{message ? <div className="mb-5 flex items-center gap-3 rounded-2xl border border-[#bfe1cc] bg-[#f3fbf5] p-4 text-sm text-[#347454]" role="status"><CheckCircle2 size={18} /><p className="font-semibold">{message}</p></div> : null}
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><p className="text-xs font-semibold">{loading ? "Loading presets..." : `${filtered.length} preset${filtered.length === 1 ? "" : "s"}`}</p><select value={filter} onChange={(event) => setFilter(event.target.value as StylePresetFeature | "all")} className="h-9 rounded-xl border border-border bg-white px-3 text-xs outline-none focus:border-primary"><option value="all">All creator features</option>{stylePresetFeatureOptions.map((feature) => <option key={feature} value={feature}>{featureLabels[feature]}</option>)}</select></div>
    {loading ? <div className="grid gap-4 md:grid-cols-2"><div className="h-52 animate-pulse rounded-2xl border border-border bg-white" /><div className="h-52 animate-pulse rounded-2xl border border-border bg-white" /></div> : filtered.length === 0 ? <div className="rounded-2xl border border-dashed border-[#d8d0ca] bg-white p-12 text-center"><ImagePlus className="mx-auto text-primary" size={28} /><p className="mt-3 text-sm font-bold">No style presets</p><p className="mt-1 text-xs text-muted-foreground">Create the first preset to show it in the creator.</p></div> : <div className="grid gap-4 md:grid-cols-2">{filtered.map((preset) => <article key={preset.id} className={`rounded-2xl border bg-white p-5 ${preset.enabled ? "border-border" : "border-dashed border-[#d8d0ca] opacity-70"}`}><div className="flex gap-4"><span className="h-16 w-20 shrink-0 rounded-xl border border-border bg-surface-muted" style={thumbStyle(preset.imageUrl)} role="img" aria-label={`${preset.name} preview`} /><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div><h2 className="truncate text-base font-bold">{preset.name}</h2><p className="mt-1 font-mono text-[10px] text-muted-foreground">{preset.slug}</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${preset.enabled ? "bg-[#e3f3e9] text-[#347454]" : "bg-surface-muted text-muted-foreground"}`}>{preset.enabled ? "Enabled" : "Disabled"}</span></div><p className="mt-3 line-clamp-3 text-xs leading-5 text-muted-foreground">{preset.prompt}</p></div></div><div className="mt-4 flex flex-wrap gap-1.5">{preset.features.map((feature) => <span key={feature} className="rounded-md bg-[#fff0e9] px-2 py-1 text-[10px] font-semibold text-primary">{featureLabels[feature]}</span>)}</div><div className="mt-4 flex items-center justify-between border-t border-border pt-3"><span className="text-[10px] text-muted-foreground">Order {preset.sortOrder}</span><div className="flex gap-1"><Button variant="ghost" size="sm" onClick={() => setDraft({ ...preset, imageUrl: preset.imageUrl ?? "", imageStorageKey: preset.imageStorageKey ?? undefined })} disabled={busy}>Edit</Button>{preset.enabled ? <Button variant="ghost" size="sm" onClick={() => void disable(preset)} disabled={busy}><Trash2 size={14} /> Disable</Button> : null}</div></div></article>)}</div>}
    </div></div></main></div></div>{draft ? <PresetEditor draft={draft} busy={busy || uploading} uploading={uploading} onChange={setDraft} onUpload={(file) => void uploadImage(file)} onSave={() => void save()} onClose={() => void closeDraft()} /> : null}</SidebarProvider>;
}

export default function AdminStylePresetsPage() {
  return <Suspense fallback={<div className="min-h-screen bg-background" />}><AdminStylePresetsContent /></Suspense>;
}
