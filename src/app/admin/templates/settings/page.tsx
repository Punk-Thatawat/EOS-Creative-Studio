"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, LoaderCircle, Save, Settings2, Star } from "lucide-react";
import { SidebarNavigation } from "@/components/app-shell/navigation";
import { SidebarProvider } from "@/components/ui/sidebar";
import { StudioHeader } from "@/components/app-shell/studio-header";
import { Button } from "@/components/ui/button";
import { listAdminGenerationModels, type GenerationModelOption } from "@/lib/api/generation-models";
import {
  listAdminTemplateModelSettings,
  updateAdminTemplateModelSetting,
  type TemplateModelMode,
} from "@/lib/api/template-model-settings";

// The two modes of the public Templates page and the features whose models each one can offer.
const modes: Array<{ mode: TemplateModelMode; label: string; description: string; features: string[] }> = [
  {
    mode: "create",
    label: "Create Video",
    description: "Pick the models people can use when they recreate a Create Video template, and the one it starts with.",
    features: ["text-to-video"],
  },
  {
    mode: "motion",
    label: "Motion Control",
    description: "Pick the models people can use for Motion Control templates (motion transfer and objects swap), and the one it starts with.",
    features: ["motion-transfer", "video-swap"],
  },
];

type Candidate = { item: GenerationModelOption; features: string[] };
type Draft = { defaultModel: string | null; offered: string[] };
type Notice = { tone: "ok" | "error"; text: string };

function ModeCard({ mode, label, description, features }: (typeof modes)[number]) {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [draft, setDraft] = useState<Draft>({ defaultModel: null, offered: [] });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setNotice(null);
    try {
      // Every model of the catalog that can do this mode, switched on or not yet.
      const [lists, settings] = await Promise.all([Promise.all(features.map((feature) => listAdminGenerationModels(feature))), listAdminTemplateModelSettings()]);
      const merged = new Map<string, Candidate>();
      lists.forEach((list, index) => {
        for (const item of list) {
          const known = merged.get(item.model);
          if (known) {
            known.features.push(features[index]);
            if (item.enabled && !known.item.enabled) known.item = item;
          } else merged.set(item.model, { item, features: [features[index]] });
        }
      });
      // The ones already switched on come first, then the rest by name.
      const all = [...merged.values()].sort((x, y) => Number(y.item.enabled) - Number(x.item.enabled) || (x.item.displayName || x.item.model).localeCompare(y.item.displayName || y.item.model));
      setCandidates(all);
      const saved = settings.find((entry) => entry.mode === mode);
      // Nothing saved yet means every model that is already on is offered.
      const offered = saved && saved.visibleModels.length ? saved.visibleModels : all.filter((entry) => entry.item.enabled).map((entry) => entry.item.model);
      setDraft({ defaultModel: saved?.defaultModel ?? null, offered });
    } catch (reason) {
      setNotice({ tone: "error", text: reason instanceof Error ? reason.message : "Unable to load the models" });
    } finally {
      setLoading(false);
    }
  }, [features, mode]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const needle = query.trim().toLowerCase();
  // Models being offered stay in view while searching, so nothing ticked disappears.
  const shown = needle ? candidates.filter(({ item }) => draft.offered.includes(item.model) || `${item.displayName} ${item.model} ${item.provider}`.toLowerCase().includes(needle)) : candidates;
  const toggleOffered = (model: string) =>
    setDraft((current) => {
      const offered = current.offered.includes(model) ? current.offered.filter((id) => id !== model) : [...current.offered, model];
      return { offered, defaultModel: current.defaultModel && offered.includes(current.defaultModel) ? current.defaultModel : null };
    });
  const setDefault = (model: string) => setDraft((current) => ({ ...current, defaultModel: current.defaultModel === model ? null : model }));

  const save = async () => {
    if (draft.offered.length === 0) return setNotice({ tone: "error", text: "Offer at least one model." });
    setBusy(true);
    setNotice(null);
    try {
      const saved = await updateAdminTemplateModelSetting(mode, { defaultModel: draft.defaultModel, visibleModels: draft.offered });
      setDraft({ defaultModel: saved.defaultModel, offered: saved.visibleModels });
      setNotice({ tone: "ok", text: "Saved. The Templates page uses it from the next visit." });
    } catch (reason) {
      setNotice({ tone: "error", text: reason instanceof Error ? reason.message : "Unable to save" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-[#eaded6] bg-white p-5">
      <div>
        <h2 className="text-base font-bold">{label}</h2>
        <p className="mt-1 max-w-xl text-xs leading-5 text-muted-foreground">{description}</p>
      </div>

      {loading ? (
        <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground"><LoaderCircle size={14} className="animate-spin" /> Loading models</div>
      ) : candidates.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-[#d8d0ca] p-4 text-xs text-muted-foreground">No model in the catalog can run this mode yet.</p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-[11px] font-semibold text-muted-foreground">{draft.offered.length} of {candidates.length} models offered.</p>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search models"
              aria-label="Search models"
              className="h-9 w-full max-w-[260px] rounded-xl border border-border bg-[#fcfbfa] px-3 text-xs outline-none focus:border-primary"
            />
          </div>
          <ul className="mt-2 divide-y divide-border rounded-xl border border-border">
            {shown.map(({ item }) => {
              const offered = draft.offered.includes(item.model);
              const isDefault = draft.defaultModel === item.model;
              return (
                <li key={item.model} className="flex items-center gap-3 px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={offered}
                    onChange={() => toggleOffered(item.model)}
                    aria-label={`Offer ${item.displayName || item.model}`}
                    className="h-4 w-4 accent-[#f26b38]"
                  />
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-sm font-semibold ${offered ? "" : "text-muted-foreground"}`}>
                      {item.displayName || item.model}
                      {!item.enabled ? <span className="ml-2 rounded-full bg-[#f4f5f7] px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">{offered ? "Templates only" : "Not offered"}</span> : null}
                    </p>
                    <p className="truncate font-mono text-[10px] text-muted-foreground">{item.model} · {item.provider}</p>
                  </div>
                  <button
                    type="button"
                    disabled={!offered}
                    onClick={() => setDefault(item.model)}
                    aria-pressed={isDefault}
                    className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:opacity-40 ${isDefault ? "border-[#f26b38] bg-[#fff0e9] text-primary" : "border-border bg-white text-muted-foreground hover:bg-surface-muted"}`}
                  >
                    <Star size={12} className={isDefault ? "fill-primary" : ""} /> {isDefault ? "Default" : "Make default"}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className={`flex items-center gap-1.5 text-xs font-semibold ${notice?.tone === "error" ? "text-[#c0392b]" : "text-[#347454]"}`} role="status">
          {notice ? (notice.tone === "error" ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />) : null}
          {notice?.text}
        </p>
        <Button type="button" size="sm" onClick={() => void save()} disabled={busy || loading || candidates.length === 0}>
          {busy ? <LoaderCircle size={14} className="animate-spin" /> : <Save size={14} />} Save
        </Button>
      </div>
    </section>
  );
}

function SettingsContent() {
  return (
    <SidebarProvider>
      <div className="min-h-screen w-full min-w-0 bg-background">
        <SidebarNavigation />
        <div className="min-w-0 xl:pl-[var(--sidebar-width)]">
          <StudioHeader />
          <main className="page-gutter mx-auto w-full max-w-[1600px] py-5 lg:py-8">
            <div className="min-h-[calc(100vh-120px)] overflow-x-clip rounded-3xl bg-[#faf8f6] px-4 pb-20 sm:px-6 lg:px-8 lg:pb-24">
              <div className="mx-auto max-w-[900px] pt-6 lg:pt-8">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#201d1b] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white">
                  <Settings2 size={12} /> Control plane
                </div>
                <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Templates settings</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                  Choose which models the public Templates page offers for each mode and which one it starts with. This only changes the Templates page. Other pages keep their own model lists.
                </p>
                <div className="mt-6 grid gap-4">
                  {modes.map((item) => (
                    <ModeCard key={item.mode} {...item} />
                  ))}
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

export default function AdminTemplatesSettingsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <SettingsContent />
    </Suspense>
  );
}
