"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { Check, FileText, LoaderCircle, RefreshCw, Save } from "lucide-react";
import { SidebarNavigation } from "@/components/app-shell/navigation";
import { SidebarProvider } from "@/components/ui/sidebar";
import { StudioHeader } from "@/components/app-shell/studio-header";
import { Button } from "@/components/ui/button";
import { listAdminPromptTemplates, updateAdminPromptTemplate, type PromptTemplate } from "@/lib/api/prompt-templates";

function PromptTemplateCard({ template, busy, onChange, onSave }: { template: PromptTemplate; busy: boolean; onChange: (next: PromptTemplate) => void; onSave: () => void }) {
  return <article className="rounded-2xl border border-[#eaded6] bg-white p-5 shadow-[0_8px_24px_rgba(68,49,36,0.05)] sm:p-6">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><div className="flex items-center gap-2"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#fff0e9] text-primary"><FileText size={17} /></span><div><h2 className="text-base font-bold tracking-tight">{template.name}</h2><p className="font-mono text-[10px] text-muted-foreground">{template.feature}</p></div></div><p className="mt-3 text-xs leading-5 text-muted-foreground">This instruction is applied server-side before the user prompt. Keep it focused on the job this tab performs.</p></div><button type="button" onClick={() => onChange({ ...template, enabled: !template.enabled })} className={`flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] transition-colors ${template.enabled ? "border-[#bfe1cc] bg-[#f3fbf5] text-[#347454]" : "border-border bg-surface-muted text-muted-foreground"}`} aria-pressed={template.enabled}><span className={`flex h-4 w-4 items-center justify-center rounded-full border ${template.enabled ? "border-[#4c9b72] bg-[#4c9b72] text-white" : "border-border bg-white"}`}>{template.enabled ? <Check size={10} strokeWidth={3} /> : null}</span>{template.enabled ? "Enabled" : "Disabled"}</button></div>
    <label className="mt-5 block text-xs font-semibold">Prompt กลาง<textarea value={template.prompt} onChange={(event) => onChange({ ...template, prompt: event.target.value })} className="mt-2 min-h-32 w-full resize-y rounded-xl border border-border bg-[#fcfbfa] p-3 text-sm leading-6 outline-none transition-colors focus:border-primary focus:bg-white" placeholder="Write the server-side instruction..." maxLength={4000} /></label>
    <div className="mt-4 flex items-center justify-between gap-3"><span className="text-[11px] text-muted-foreground">{template.prompt.length}/4000 characters</span><Button size="sm" onClick={onSave} disabled={busy || !template.prompt.trim()}>{busy ? <LoaderCircle size={15} className="animate-spin" /> : <Save size={15} />}{busy ? "Saving..." : "Save template"}</Button></div>
  </article>;
}

const backgroundPromptModes = [
  { feature: "background-remove", label: "Remove" },
  { feature: "background-replace", label: "Replace" },
  { feature: "background-generate", label: "Generate" },
  { feature: "background-solid", label: "Solid Color" },
] as const;

function BackgroundPromptTemplateCard({ templates, busyFeature, onChange, onSave }: { templates: PromptTemplate[]; busyFeature: string | null; onChange: (next: PromptTemplate) => void; onSave: (template: PromptTemplate) => void }) {
  const [selectedFeature, setSelectedFeature] = useState<(typeof backgroundPromptModes)[number]["feature"]>("background-remove");
  const activeTemplate = templates.find((template) => template.feature === selectedFeature);
  if (!activeTemplate) return null;
  return <article className="rounded-2xl border border-[#eaded6] bg-white p-5 shadow-[0_8px_24px_rgba(68,49,36,0.05)] sm:p-6">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><div className="flex items-center gap-2"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#fff0e9] text-primary"><FileText size={17} /></span><div><h2 className="text-base font-bold tracking-tight">AI Background</h2><p className="font-mono text-[10px] text-muted-foreground">4 mode-specific prompt templates</p></div></div><p className="mt-3 text-xs leading-5 text-muted-foreground">Each mode has its own server-side instruction, so the prompt matches the actual background operation.</p></div><button type="button" onClick={() => onChange({ ...activeTemplate, enabled: !activeTemplate.enabled })} className={`flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] transition-colors ${activeTemplate.enabled ? "border-[#bfe1cc] bg-[#f3fbf5] text-[#347454]" : "border-border bg-surface-muted text-muted-foreground"}`} aria-pressed={activeTemplate.enabled}><span className={`flex h-4 w-4 items-center justify-center rounded-full border ${activeTemplate.enabled ? "border-[#4c9b72] bg-[#4c9b72] text-white" : "border-border bg-white"}`}>{activeTemplate.enabled ? <Check size={10} strokeWidth={3} /> : null}</span>{activeTemplate.enabled ? "Enabled" : "Disabled"}</button></div>
    <div className="mt-5 grid grid-cols-2 gap-2 rounded-xl bg-[#f7f3f0] p-1 sm:grid-cols-4" role="tablist" aria-label="AI Background modes">{backgroundPromptModes.map((mode) => <button type="button" key={mode.feature} role="tab" aria-selected={selectedFeature === mode.feature} onClick={() => setSelectedFeature(mode.feature)} className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${selectedFeature === mode.feature ? "bg-white text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>{mode.label}</button>)}</div>
    <label className="mt-5 block text-xs font-semibold">Prompt กลาง · {backgroundPromptModes.find((mode) => mode.feature === selectedFeature)?.label}<textarea value={activeTemplate.prompt} onChange={(event) => onChange({ ...activeTemplate, prompt: event.target.value })} className="mt-2 min-h-32 w-full resize-y rounded-xl border border-border bg-[#fcfbfa] p-3 text-sm leading-6 outline-none transition-colors focus:border-primary focus:bg-white" placeholder="Write the server-side instruction..." maxLength={4000} /></label>
    <div className="mt-4 flex items-center justify-between gap-3"><span className="text-[11px] text-muted-foreground">{activeTemplate.prompt.length}/4000 characters</span><Button size="sm" onClick={() => onSave(activeTemplate)} disabled={busyFeature === activeTemplate.feature || !activeTemplate.prompt.trim()}>{busyFeature === activeTemplate.feature ? <LoaderCircle size={15} className="animate-spin" /> : <Save size={15} />}{busyFeature === activeTemplate.feature ? "Saving..." : "Save template"}</Button></div>
  </article>;
}

function AdminPromptTemplatesContent() {
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyFeature, setBusyFeature] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setTemplates(await listAdminPromptTemplates()); } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to load prompt templates"); } finally { setLoading(false); }
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);

  const updateTemplate = (next: PromptTemplate) => setTemplates((current) => current.map((item) => item.feature === next.feature ? next : item));
  const save = async (template: PromptTemplate) => {
    setBusyFeature(template.feature); setError(""); setMessage("");
    try { const saved = await updateAdminPromptTemplate(template.feature, { prompt: template.prompt, enabled: template.enabled }); updateTemplate(saved); setMessage(`${saved.name} saved.`); } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to save prompt template"); } finally { setBusyFeature(null); }
  };

  const backgroundTemplates = templates.filter((template) => template.feature.startsWith("background-"));
  const regularTemplates = templates.filter((template) => !template.feature.startsWith("background-"));

  return <SidebarProvider><div className="min-h-screen w-full min-w-0 bg-background"><SidebarNavigation /><div className="min-w-0 lg:pl-[var(--sidebar-width)]"><StudioHeader /><main className="page-gutter mx-auto w-full max-w-[1320px] py-5 lg:py-8"><div className="min-h-[calc(100vh-120px)] overflow-x-clip rounded-3xl bg-[#faf8f6] px-4 pb-20 sm:px-6 lg:px-8 lg:pb-24"><div className="mx-auto max-w-5xl py-6 sm:py-8"><div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#201d1b] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white"><FileText size={13} /> Control plane</div><h1 className="max-w-xl text-3xl font-bold tracking-tight sm:text-4xl">Prompt Templates</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Control the server-side prompt instruction for each image creation tab. User prompts and model-specific parameters are added after this layer.</p></div><Button variant="outline" size="lg" onClick={() => void load()} disabled={loading || Boolean(busyFeature)}><RefreshCw size={16} className={loading ? "animate-spin" : undefined} /> Refresh</Button></div>{message && <p className="mb-5 rounded-xl border border-[#bfe1cc] bg-[#f3fbf5] px-4 py-3 text-xs font-semibold text-[#347454]" role="status">{message}</p>}{error && <p className="mb-5 rounded-xl border border-[#f3b5a1] bg-[#fff4ef] px-4 py-3 text-xs font-semibold text-[#bd4e2a]" role="alert">{error}</p>}<div className="mb-5 rounded-2xl border border-[#e8d7cc] bg-[#fff8f3] px-4 py-3 text-xs leading-5 text-[#765d50]"><b>How it works:</b> The template is added on the backend, so users cannot remove the core instruction by changing the prompt. Disable a template to fall back to the built-in instruction.</div>{loading ? <div className="flex items-center justify-center rounded-2xl border border-border bg-white py-16 text-sm text-muted-foreground"><LoaderCircle size={18} className="mr-2 animate-spin" /> Loading prompt templates...</div> : templates.length === 0 ? <div className="rounded-2xl border border-dashed border-border bg-white py-16 text-center text-sm text-muted-foreground">No prompt templates configured.</div> : <div className="grid gap-5">{regularTemplates.map((template) => <PromptTemplateCard key={template.feature} template={template} busy={busyFeature === template.feature} onChange={updateTemplate} onSave={() => void save(template)} />)}{backgroundTemplates.length > 0 && <BackgroundPromptTemplateCard templates={backgroundTemplates} busyFeature={busyFeature} onChange={updateTemplate} onSave={(template) => void save(template)} />}</div>}</div></div></main></div></div></SidebarProvider>;
}

export default function AdminPromptTemplatesPage() {
  return <Suspense fallback={<div className="min-h-screen bg-background" />}><AdminPromptTemplatesContent /></Suspense>;
}
