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
  Video,
  X,
} from "lucide-react";
import { SidebarNavigation } from "@/components/app-shell/navigation";
import { SidebarProvider } from "@/components/ui/sidebar";
import { StudioHeader } from "@/components/app-shell/studio-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  listAdminModelRoutesOverview,
  syncGenerationModels,
  updateModelInputLimits,
  updateGenerationModelRoute,
  type AdminModelRoutesOverview,
  type GenerationModelOption,
  type ModelUploadConstraints,
} from "@/lib/api/generation-models";
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
] as const;

const features = [
  { id: "audio", label: "Audio", description: "Create audio and music", icon: AudioWaveform },
  { id: "document", label: "Document", description: "Create documents and presentations", icon: FileText },
] as const;

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

function ModelDetailsDialog({ item, onClose, onSaveInputLimits }: { item: GenerationModelOption; onClose: () => void; onSaveInputLimits: (model: string, provider: string, limits: ModelUploadConstraints) => Promise<void> }) {
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

  return <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#201d1b]/45 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="model-details-title">
    <div className="flex max-h-[min(820px,calc(100vh-32px))] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-[#eaded6] bg-[#faf8f6] shadow-[0_24px_80px_rgba(68,49,36,0.25)]">
      <header className="flex items-start justify-between gap-4 border-b border-border bg-white px-5 py-4 sm:px-7 sm:py-5">
        <div className="flex min-w-0 items-center gap-3"><ModelInitials name={item.displayName} /><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-primary">Model details</p><h2 id="model-details-title" className="mt-1 truncate text-xl font-bold tracking-tight">{item.displayName}</h2><p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">{item.provider} · {item.model}</p></div></div>
        <button type="button" onClick={onClose} className="rounded-xl p-2 text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground" aria-label="Close model details"><X size={19} /></button>
      </header>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5 sm:p-7">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-border bg-white p-4"><p className="text-[11px] text-muted-foreground">Kind</p><p className="mt-1 font-semibold">{item.kind ?? capabilities.kind ?? "image"}</p></div>
          <div className="rounded-2xl border border-border bg-white p-4"><p className="text-[11px] text-muted-foreground">{isVideoModel ? "Supported resolutions" : "Supported sizes"}</p><p className="mt-1 font-semibold">{supportedOutputValues.length} presets</p></div>
          <div className="rounded-2xl border border-border bg-white p-4"><p className="text-[11px] text-muted-foreground">Quality</p><p className="mt-1 font-semibold">{capabilities.qualityParameter ? `Native: ${capabilities.qualityParameter}` : "Prompt fallback"}</p></div>
          <div className="rounded-2xl border border-border bg-white p-4"><p className="text-[11px] text-muted-foreground">Parameters</p><p className="mt-1 font-semibold">{capabilities.parameters.length}</p></div>
        </div>

        {capabilities.description ? <section className="rounded-2xl border border-border bg-white p-4"><h3 className="text-sm font-bold">Description</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{capabilities.description}</p></section> : null}

        <section className="rounded-2xl border border-[#f1c7b5] bg-[#fffaf7] p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-bold">Upload limits</h3><p className="mt-1 text-[11px] leading-5 text-muted-foreground">กำหนด limit ของไฟล์ input สำหรับ model นี้โดยตรง เว้นว่างเพื่อใช้ค่าเริ่มต้นของระบบ</p><p className="mt-1 text-[11px] leading-5 text-muted-foreground">Sync จะดึงค่าที่ provider ประกาศใน schema เช่น จำนวนรูปสูงสุด ส่วนขนาดไฟล์และพิกเซลต้องกำหนดเองเมื่อ provider ไม่ได้ส่งมา</p></div><span className="rounded-full bg-[#fff0e9] px-2.5 py-1 text-[10px] font-bold text-primary">Admin</span></div><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><label className="text-[11px] font-semibold text-muted-foreground">Max file size (MB)<input type="number" min="0.1" step="0.1" value={limitDraft.maxFileSizeMb} onChange={(event) => setLimitDraft((current) => ({ ...current, maxFileSizeMb: event.target.value }))} placeholder="System default" className="mt-1.5 h-9 w-full rounded-lg border border-border bg-white px-2.5 text-xs font-semibold text-foreground outline-none focus:border-primary focus:ring-3 focus:ring-primary/10" /></label><label className="text-[11px] font-semibold text-muted-foreground">Max width (px)<input type="number" min="1" step="1" value={limitDraft.maxWidth} onChange={(event) => setLimitDraft((current) => ({ ...current, maxWidth: event.target.value }))} placeholder="Not published" className="mt-1.5 h-9 w-full rounded-lg border border-border bg-white px-2.5 text-xs font-semibold text-foreground outline-none focus:border-primary focus:ring-3 focus:ring-primary/10" /></label><label className="text-[11px] font-semibold text-muted-foreground">Max height (px)<input type="number" min="1" step="1" value={limitDraft.maxHeight} onChange={(event) => setLimitDraft((current) => ({ ...current, maxHeight: event.target.value }))} placeholder="Not published" className="mt-1.5 h-9 w-full rounded-lg border border-border bg-white px-2.5 text-xs font-semibold text-foreground outline-none focus:border-primary focus:ring-3 focus:ring-primary/10" /></label><label className="text-[11px] font-semibold text-muted-foreground">Max input images<input type="number" min="1" step="1" value={limitDraft.maxImages} onChange={(event) => setLimitDraft((current) => ({ ...current, maxImages: event.target.value }))} placeholder="Schema default" className="mt-1.5 h-9 w-full rounded-lg border border-border bg-white px-2.5 text-xs font-semibold text-foreground outline-none focus:border-primary focus:ring-3 focus:ring-primary/10" /></label></div><div className="mt-3 flex flex-wrap items-center gap-3"><Button size="sm" onClick={() => void saveLimits()} disabled={savingLimits}>{savingLimits ? <LoaderCircle size={14} className="animate-spin" /> : <Check size={14} />} {savingLimits ? "Saving..." : "Save upload limits"}</Button>{limitsMessage ? <p className="text-[11px] font-semibold text-[#347454]" role="status">{limitsMessage}</p> : null}</div></section>

        <section className="rounded-2xl border border-border bg-white p-4"><div className="flex items-center justify-between gap-3"><div><h3 className="text-sm font-bold">{isVideoModel ? "Supported resolutions" : "Supported sizes"}</h3><p className="mt-1 text-[11px] text-muted-foreground">The values accepted by this model</p></div><span className="rounded-full bg-[#fff0e9] px-2.5 py-1 text-[10px] font-bold text-primary">{supportedOutputValues.length}</span></div>{supportedOutputValues.length ? <div className="mt-3 flex flex-wrap gap-2">{supportedOutputValues.map((value) => <span key={value} className="rounded-lg bg-surface-muted px-2.5 py-1.5 font-mono text-[11px] text-muted-foreground">{value}</span>)}</div> : <p className="mt-3 text-xs text-muted-foreground">This model does not publish a fixed preset list. Use its input schema controls.</p>}</section>

        <section className="rounded-2xl border border-border bg-white p-4"><div className="flex items-center justify-between gap-3"><div><h3 className="text-sm font-bold">Input schema</h3><p className="mt-1 text-[11px] text-muted-foreground">Complete provider parameters and validation rules</p></div><span className="rounded-full bg-[#e3f3e9] px-2.5 py-1 text-[10px] font-bold text-[#347454]">{propertyEntries.length} fields</span></div>{propertyEntries.length ? <div className="mt-4 space-y-3">{propertyEntries.map(([name, property]) => <div key={name} className="rounded-xl border border-border bg-[#fcfaf8] p-3"><div className="flex flex-wrap items-center gap-2"><p className="font-mono text-xs font-bold">{name}</p>{required.has(name) ? <Badge tone="orange">Required</Badge> : <Badge>Optional</Badge>}{property.type ? <span className="rounded-md bg-white px-2 py-1 font-mono text-[10px] text-muted-foreground">{property.type}</span> : null}</div>{property.description ? <p className="mt-2 text-xs leading-5 text-muted-foreground">{property.description}</p> : null}<div className="mt-2 flex flex-wrap gap-2 text-[10px] text-muted-foreground">{property.enum?.length ? <span className="rounded-md bg-white px-2 py-1">Values: {property.enum.map(displaySchemaValue).join(", ")}</span> : null}{property.default !== undefined ? <span className="rounded-md bg-white px-2 py-1">Default: {displaySchemaValue(property.default)}</span> : null}{property.minimum !== undefined || property.maximum !== undefined ? <span className="rounded-md bg-white px-2 py-1">Range: {displaySchemaValue(property.minimum)} – {displaySchemaValue(property.maximum)}</span> : null}{property.format ? <span className="rounded-md bg-white px-2 py-1">Format: {property.format}</span> : null}</div></div>)}</div> : <div className="mt-4 rounded-xl border border-dashed border-[#d8d0ca] p-5 text-center text-xs text-muted-foreground">Provider schema is not available for this model. The backend will use the known fallback capabilities.</div>}</section>

        <section className="rounded-2xl border border-border bg-white p-4"><h3 className="text-sm font-bold">Backend behavior</h3><div className="mt-3 grid gap-2 text-xs sm:grid-cols-2"><p className="rounded-lg bg-[#fcfaf8] p-3"><span className="text-muted-foreground">Quality parameter: </span><strong>{capabilities.qualityParameter ?? "none; appended to prompt"}</strong></p><p className="rounded-lg bg-[#fcfaf8] p-3"><span className="text-muted-foreground">Negative prompt: </span><strong>{capabilities.negativePromptParameter ?? "none; fallback handling"}</strong></p><p className="rounded-lg bg-[#fcfaf8] p-3"><span className="text-muted-foreground">Provider type: </span><strong>{capabilities.providerType ?? "—"}</strong></p><p className="rounded-lg bg-[#fcfaf8] p-3"><span className="text-muted-foreground">Base price: </span><strong>{displaySchemaValue(capabilities.basePrice)}</strong></p></div></section>
      </div>

      <footer className="flex justify-end border-t border-border bg-white px-5 py-4 sm:px-7"><Button variant="outline" size="sm" onClick={onClose}>Close</Button></footer>
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
  if (videoFunctions.some((item) => item.id === feature)) return capabilities.parameters.length > 0;
  if (feature === "style-transfer") return capabilities.styleTransferCompatible === true;
  if (feature === "background-removal") {
    const providerType = capabilities.providerType?.toLowerCase() ?? "";
    const hasBackgroundMode = Boolean(capabilities.backgroundModes?.length);
    return capabilities.parameters.length > 0 && Boolean(capabilities.imageParameter) && (hasBackgroundMode || Boolean(capabilities.backgroundImageParameter) || providerType.includes("background") || providerType.includes("remov"));
  }
  return true;
}

type AssignmentDraft = { assignedModelIds: string[]; defaultModel: string };

function MultiTargetModelAssignmentDialog({
  feature,
  catalog,
  assignments,
  onFeatureChange,
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
  const compatibleModels = catalog.filter((item) => isFeatureCompatible(item, feature));
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
        <label className="mt-4 block max-w-md"><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Assign to</span><select value={feature} onChange={(event) => handleFeatureChange(event.target.value as FeatureId)} className="h-10 w-full rounded-xl border border-border bg-[#fcfaf8] px-3 text-sm font-semibold outline-none focus:border-primary focus:ring-3 focus:ring-primary/10"><optgroup label="Image">{imageFunctions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</optgroup><optgroup label="Video">{videoFunctions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</optgroup>{features.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
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

function AdminModelRoutesContent() {
  const searchParams = useSearchParams();
  const requestedFeature = searchParams.get("feature");
  const featureParam = (requestedFeature === "video" ? "image-to-video" : requestedFeature) as FeatureId | null;
  const feature = featureParam && [...imageFunctions, ...videoFunctions, ...features].some((item) => item.id === featureParam) ? featureParam : imageFunctions[0].id;
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
      const next = overview.routes[feature] ?? [];
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
  }, [feature]);

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
      for (const item of changed) {
        await updateGenerationModelRoute(feature, item.model, item.provider, { enabled: enabledModels.includes(item.model), ...(item.model === selectedModel ? { isDefault: true } : {}) });
      }
      if (!changed.some((item) => item.model === selectedModel) && selectedModel !== savedModel) {
        await updateGenerationModelRoute(feature, selectedModel, selected.provider, { enabled: true, isDefault: true });
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
    const targetFeatures = [...imageFunctions.map((item) => item.id), ...videoFunctions.map((item) => item.id), ...features.map((item) => item.id)] as FeatureId[];
    const drafts = Object.fromEntries(targetFeatures.map((target) => {
      const routes = routeOverview[target] ?? [];
      return [target, { assignedModelIds: routes.filter((item) => item.enabled).map((item) => item.model), defaultModel: routes.find((item) => item.isDefault)?.model ?? "" }];
    })) as Record<string, AssignmentDraft>;
    setAssignmentDrafts(drafts);
    setSavedAssignmentDrafts(drafts);
    setAssignmentOpen(true);
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
        const current = catalog.filter((item) => isFeatureCompatible(item, target));
        for (const item of current) {
          const shouldBeEnabled = draft.assignedModelIds.includes(item.model);
          const wasEnabled = original.assignedModelIds.includes(item.model);
          const shouldBeDefault = draft.defaultModel === item.model;
          const wasDefault = original.defaultModel === item.model;
          if (shouldBeEnabled !== wasEnabled || shouldBeDefault !== wasDefault) {
            await updateGenerationModelRoute(target, item.model, item.provider, { enabled: shouldBeEnabled, isDefault: shouldBeDefault });
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
      const next = overview.routes[feature] ?? [];
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
          <div><div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#201d1b] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white"><ServerCog size={13} /> Control plane</div><h1 className="max-w-xl text-3xl font-bold tracking-tight sm:text-4xl">Generation model routes</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Choose the model that powers each creative feature. Changes apply to new generations immediately.</p></div>
          <div className="flex flex-wrap justify-end gap-2"><Button variant="outline" size="lg" onClick={() => void openAssignment()} disabled={busy || loading}><Settings2 size={17} /> Assign models</Button><Button variant="outline" size="lg" onClick={() => void sync()} disabled={busy || loading}><CloudDownload size={17} /> {busy ? "Syncing catalog..." : "Sync provider catalog"}</Button></div>
        </div>

        {error ? <div className="mb-5 flex items-start gap-3 rounded-2xl border border-[#efc2c2] bg-[#fff6f6] p-4 text-sm text-[#9f3b3b]" role="alert"><AlertCircle className="mt-0.5 shrink-0" size={18} /><div><p className="font-bold">Couldn&apos;t load model routes</p><p className="mt-1 text-xs leading-5">{error}</p><button type="button" className="mt-2 text-xs font-bold underline underline-offset-2" onClick={() => void load()}>Try again</button></div></div> : null}
        {message ? <div className="mb-5 flex items-center gap-3 rounded-2xl border border-[#bfe1cc] bg-[#f3fbf5] p-4 text-sm text-[#347454]" role="status"><CheckCircle2 size={18} /><p className="font-semibold">{message}</p></div> : null}

        <div className="mb-6 grid gap-3 sm:grid-cols-3"><StatCard label="Active feature" value={activeFeature.label} detail="Currently configuring" accent="orange" /><StatCard label="Allowed models" value={loading ? "—" : String(enabledCount)} detail={`${models.length} available for this function`} accent="green" /><StatCard label="All catalog models" value={loading ? "—" : String(catalogCount)} detail="Loaded before feature setup" accent="pink" /></div>

        <div className="grid gap-6 lg:grid-cols-1 lg:items-start">
          <section aria-labelledby="route-heading" className="min-w-0">
            <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Route configuration</p><h2 id="route-heading" className="mt-1 text-xl font-bold tracking-tight">{activeFeature.label}</h2></div><div className="relative w-full sm:w-60"><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search models" aria-label="Search models" className="h-9 w-full rounded-xl border border-border bg-white pl-9 pr-3 text-xs outline-none transition focus:border-primary focus:ring-3 focus:ring-primary/10" /></div></div>
            <div className="mb-4 flex items-center justify-between rounded-xl border border-[#eaded6] bg-[#fffdfb] px-4 py-3"><div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#4c9b72]" /><p className="text-xs font-semibold">{loading ? "Loading catalog..." : `${enabledCount} allowed · ${filteredModels.length} available`}</p></div><Button variant="ghost" size="sm" onClick={() => void openAssignment()} disabled={loading}><Settings2 size={14} /> Open drag &amp; drop</Button></div>
            <ModelGrid models={filteredModels} selectedModel={selectedModel} onSelect={selectModel} onToggleEnabled={toggleModel} onDetails={setDetailsModel} onOpenAssignment={openAssignment} loading={loading} query={query} />
          </section>
        </div>
      </div>

      <div className={`fixed inset-x-0 bottom-0 z-30 border-t border-border bg-white/95 px-[var(--page-gutter)] py-3 shadow-[0_-8px_30px_rgba(68,49,36,0.08)] backdrop-blur transition-transform ${hasChanges ? "translate-y-0" : "translate-y-full"}`} aria-live="polite"><div className="mx-auto flex max-w-[1180px] flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><p className="text-xs font-bold">Unsaved route changes</p><p className="mt-0.5 text-[11px] text-muted-foreground">{selectedModel ? `${enabledCount} model${enabledCount === 1 ? "" : "s"} allowed; ${formatFeature(feature)} default: ${selectedModel}.` : "Select a model to continue."}</p></div><div className="flex items-center gap-2"><Button variant="ghost" size="sm" onClick={() => { setSelectedModel(savedModel); setEnabledModels(savedEnabledModels); setModels((current) => current.map((item) => ({ ...item, enabled: savedEnabledModels.includes(item.model) }))); }} disabled={busy}>Cancel</Button><Button size="sm" onClick={() => void save()} disabled={busy || !selectedModel || !hasChanges}>{busy ? <LoaderCircle size={15} className="animate-spin" /> : <Check size={15} />} {busy ? "Saving..." : "Save route settings"}</Button></div></div></div>
      {assignmentOpen ? <MultiTargetModelAssignmentDialog feature={assignmentFeature} catalog={catalog} assignments={assignmentDrafts} onFeatureChange={setAssignmentFeature} onAdd={addAssignment} onRemove={removeAssignment} onSetDefault={setAssignmentDefault} onClose={() => setAssignmentOpen(false)} onSave={saveAssignment} saving={assignmentSaving} /> : null}
      {detailsModel ? <ModelDetailsDialog item={detailsModel} onClose={() => setDetailsModel(null)} onSaveInputLimits={saveModelInputLimits} /> : null}
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
