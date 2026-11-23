"use client";

import { useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Folder,
  Orbit,
  WandSparkles,
  type LucideIcon,
} from "lucide-react";
import {
  listTemplates,
  type CreativeTemplate as Template,
  type TemplatePagination,
} from "@/lib/api/templates";
import { CategoryChips } from "./category-chips";
import { categoryLabel } from "./template-categories";
import { useExtensionQueue } from "./long-clip";
import { listMyTemplateLikes, setTemplateLike } from "@/lib/api/template-likes";
import {
  GENERATION_COMPLETED_EVENT,
  GENERATION_STARTED_EVENT,
} from "@/lib/generation-progress-events";
import { useStudioCopy, type StudioCopyKey } from "@/lib/i18n/studio-copy";
import s from "./templates-page.module.css";
import {
  DEFAULT_MODE,
  laneOptions,
  laneQuery,
  type Lane,
  type Mode,
  workflowEvent,
} from "./library-modes";
import { isProductTemplate, modeOf } from "./template-text";
import { LikesContext } from "./likes-context";
import { WORK_ID } from "./saved-works";
import { type StyleChoice } from "./custom-styles";
import { clearRecent, readRecent, rememberTemplate } from "./recent-templates";
import { Tile } from "./template-media";
import { RecreateDialog } from "./recreate-dialog";
import { Composer } from "./composer";
import { LibraryHero } from "./library-hero";
import { HistoryPanel } from "./history-panel";
import { StylesPanel } from "./styles-panel";
import { HowItWorks } from "./how-it-works";
import { Preview } from "./template-preview";

const skeletonHeights = [210, 150, 260, 180, 230, 140, 200, 170, 250, 160];

export function TemplatesPageClient() {
  const { c, locale } = useStudioCopy();
  useExtensionQueue();
  const [items, setItems] = useState<Template[]>([]);
  const [addedImages, setAddedImages] = useState<{ key: number; templateId: string; files: File[] } | null>(null);
  const [recreating, setRecreating] = useState<Template | null>(null);
  const [likedSlugs, setLikedSlugs] = useState<Set<string>>(new Set());
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  useEffect(() => {
    let alive = true;
    listMyTemplateLikes()
      .then((slugs) => {
        if (alive) setLikedSlugs(new Set(slugs));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  // Optimistic: the heart and count change at once, then follow what the server says (or go back if it refuses).
  const toggleLike = (t: Template) => {
    const wasLiked = likedSlugs.has(t.slug);
    const before = likeCounts[t.slug] ?? t.likeCount ?? 0;
    const next = new Set(likedSlugs);
    if (wasLiked) next.delete(t.slug);
    else next.add(t.slug);
    setLikedSlugs(next);
    setLikeCounts({ ...likeCounts, [t.slug]: Math.max(before + (wasLiked ? -1 : 1), 0) });
    setTemplateLike(t.slug, !wasLiked)
      .then((result) => setLikeCounts((current) => ({ ...current, [t.slug]: result.likeCount })))
      .catch(() => {
        setLikedSlugs((current) => {
          const back = new Set(current);
          if (wasLiked) back.add(t.slug);
          else back.delete(t.slug);
          return back;
        });
        setLikeCounts((current) => ({ ...current, [t.slug]: before }));
      });
  };
  const [q, setQ] = useState(""),
    [mode, setMode] = useState<Mode>(DEFAULT_MODE),
    [category, setCategory] = useState("all"),
    [categories, setCategories] = useState<string[]>([]),
    [lane, setLane] = useState<Lane>("eos"),
    [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<TemplatePagination>({ page: 1, limit: 24, total: 0, totalPages: 1 }),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(false),
    [retry, setRetry] = useState(0),
    [preview, setPreview] = useState<Template | null>(null),
    [selectedId, setSelectedId] = useState<string | null>(null),
    [panel, setPanel] = useState<"history" | "library" | "styles" | "how">("library"),
    [style, setStyle] = useState<StyleChoice | null>(null),
    [recent, setRecent] = useState<Template[]>([]),
    [community, setCommunity] = useState<Template[]>([]),
    [draft, setDraft] = useState<Template | null>(null);
  // What was opened lately is read once the page is in the browser.
  useEffect(() => {
    const timer = window.setTimeout(() => setRecent(readRecent()), 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    const c = new AbortController();
    const timer = setTimeout(
      () => {
        setLoading(true);
        setError(false);
        listTemplates({ search: q, category, ...laneQuery[lane], page, limit: 24, signal: c.signal })
          .then((r) => {
            if (c.signal.aborted) return;
            setItems(r.templates);
            setPagination(r.pagination ?? { page: 1, limit: 24, total: r.templates.length, totalPages: 1 });
          })
          .catch(() => {
            if (!c.signal.aborted) setError(true);
          })
          .finally(() => {
            if (!c.signal.aborted) setLoading(false);
          });
      },
      q ? 250 : 0,
    );
    return () => {
      c.abort();
      clearTimeout(timer);
    };
  }, [q, category, lane, page, retry]);
  // The categories that have something in the open list and mode, so a chip never leads to an empty page.
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const found = new Set<string>();
        for (let pageNo = 1; pageNo <= 10; pageNo += 1) {
          const r = await listTemplates({ ...laneQuery[lane], page: pageNo, limit: 50, signal: controller.signal });
          r.templates.filter((t) => (mode === "create" ? t.kind === "video" && modeOf(t) === "create" : modeOf(t) === mode)).forEach((t) => t.category && found.add(t.category));
          if (pageNo >= (r.pagination?.totalPages ?? 1)) break;
        }
        if (!controller.signal.aborted) setCategories([...found].sort((a, b) => a.localeCompare(b)));
      } catch {
        // The chips are a convenience; the list works without them.
      }
    })();
    return () => controller.abort();
  }, [lane, mode, retry]);
  // The community's templates, so a clip that already became one is recognised whichever list is open.
  useEffect(() => {
    const controller = new AbortController();
    listTemplates({ source: "community", sort: "newest", limit: 50, signal: controller.signal })
      .then((r) => setCommunity(r.templates))
      .catch(() => {});
    return () => controller.abort();
  }, [retry]);
  // The first work on the page is the chosen one until a tile is clicked.
  const ofMode = items.filter((t) => {
    if (mode === "create") return t.kind === "video" && modeOf(t) === "create";
    return modeOf(t) === mode;
  });
  const visible = ofMode;
  const recentForMode = recent.filter((t) =>
    mode === "create" ? t.kind === "video" && modeOf(t) === "create" : modeOf(t) === mode,
  );
  // "" means the template was taken off the panel with its cross; null means nothing was chosen yet (the first one shows).
  const selected =
    selectedId === ""
      ? undefined
      : (draft && draft.id === selectedId ? draft : (visible.find((t) => t.id === selectedId) ?? recentForMode.find((t) => t.id === selectedId) ?? visible[0]));
  useEffect(() => {
    const showResult = () => setPanel("history");
    window.addEventListener(GENERATION_COMPLETED_EVENT, showResult);
    window.addEventListener(GENERATION_STARTED_EVENT, showResult);
    window.addEventListener(workflowEvent, showResult);
    return () => {
      window.removeEventListener(GENERATION_COMPLETED_EVENT, showResult);
      window.removeEventListener(GENERATION_STARTED_EVENT, showResult);
      window.removeEventListener(workflowEvent, showResult);
    };
  }, []);
  const switchMode = (nextMode: Mode) => {
    setMode(nextMode);
    setCategory("all");
    setPanel(nextMode === "motion" ? "how" : "history");
  };
  // The Recreate button of a tile: a product template opens its own window, any other one goes to the create panel.
  const recreateTemplate = (t: Template) => (isProductTemplate(t) ? setRecreating(t) : setSelectedId(t.id));
  const change = () => {
    setPage(1);
    setLoading(true);
  };
  const reset = () => {
    setQ("");
    setCategory("all");
    setLane("eos");
    setRetry((n) => n + 1);
    change();
  };
  const pages = [
    ...new Set([1, ...Array.from({ length: 5 }, (_, i) => pagination.page + i - 2), pagination.totalPages]),
  ]
    .filter((n) => n > 0 && n <= pagination.totalPages)
    .sort((a, b) => a - b);
  // Like the real thing, each mode has its own right-hand tabs: editing only has history and how it works.
  type PanelId = "history" | "library" | "styles" | "how";
  const tabHistory: [PanelId, StudioCopyKey] = ["history", "templates.tab.history"];
  const tabLibrary: [PanelId, StudioCopyKey] = ["library", "templates.tab.library"];
  const tabStyles: [PanelId, StudioCopyKey] = ["styles", "templates.tab.styles"];
  const tabHow: [PanelId, StudioCopyKey] = ["how", "templates.tab.how"];
  const panelIcons: Record<PanelId, LucideIcon> = { history: Folder, library: Orbit, styles: WandSparkles, how: BookOpen };
  // Editing has its own library of sample edits, named for what it holds; the motion mode keeps its gallery under "how it works".
  const tabEditLibrary: [PanelId, StudioCopyKey] = ["library", "templates.tab.editLibrary"];
  const panelTabs: Array<[PanelId, StudioCopyKey]> =
    mode === "edit"
      ? [tabHistory, tabEditLibrary, tabHow]
      : mode === "motion"
        ? [tabHistory, tabHow]
        : [tabHistory, tabLibrary, tabStyles, tabHow];
  const activePanel = panelTabs.some(([id]) => id === panel) ? panel : mode === "motion" ? "how" : "history";
  // The three lists of the library; the motion gallery has them too.
  const laneToolbar = (
      <section className={s.toolbar} aria-label={c("templates.filtersAria")}>
        <div className={s.tabs}>
          {laneOptions.map(([id, key, LaneIcon]) => (
            <button
              key={id}
              type="button"
              aria-pressed={lane === id}
              onClick={() => {
                if (lane === id) return;
                setLane(id);
                setCategory("all");
                change();
              }}
            >
              <LaneIcon size={14} aria-hidden="true" />
              {c(key)}
            </button>
          ))}
        </div>
        {categories.length > 0 && (
          <CategoryChips
            names={["all", ...categories]}
            active={category}
            onSelect={(name) => {
              if (category === name) return;
              setCategory(name);
              change();
            }}
            labelOf={(name) => (name === "all" ? c("templates.category.all") : categoryLabel(name, locale))}
            ariaLabel={c("templates.categoryAria")}
            scrollLeftLabel={c("templates.category.scrollLeft")}
            scrollRightLabel={c("templates.category.scrollRight")}
          />
        )}
      </section>
  );
  const libraryBody = loading ? (
    <div role="status" aria-label={c("templates.loading")} className={s.masonry}>
      {skeletonHeights.map((h, i) => (
        <div key={i} className={s.skeleton} style={{ height: h }} />
      ))}
    </div>
  ) : error ? (
    <div role="alert" className={s.empty}>
      {c("templates.loadFailed")}{" "}
      <button type="button" onClick={() => setRetry((n) => n + 1)}>
        {c("templates.retry")}
      </button>
    </div>
  ) : !visible.length ? (
    <div className={s.empty}>
      <h2>{c("templates.emptyTitle")}</h2>
      {items.length > 0 ? (
        <p>{c("templates.mode.emptyBody")}</p>
      ) : (
        <>
          <p>{c("templates.emptyBody")}</p>
          <button type="button" onClick={reset}>
            {c("templates.showAll")}
          </button>
        </>
      )}
    </div>
  ) : (
    <section className={s.masonry} aria-label={c("templates.libraryAria")}>
      {visible.map((t) => (
        // In Edit Video the left panel is the tool list, so "Recreate" opens the sample's details, with the button to edit it.
        <Tile key={t.id} t={t} selected={t.id === selected?.id} onSelect={(x) => (mode === "edit" || mode === "motion" ? setPreview(x) : setSelectedId(x.id))} onExpand={setPreview} onRecreate={mode === "create" ? recreateTemplate : undefined} />
      ))}
    </section>
  );
  return (
    <LikesContext.Provider value={{ liked: likedSlugs, counts: likeCounts, toggle: toggleLike }}>
    <div className={s.page} data-page="templates" data-no-translate>
      <div className={s.workspace}>
        <Composer
          t={selected ?? (mode === "edit" ? items.find((item) => item.kind === "video") : undefined)}
          mode={mode}
          onMode={switchMode}
          options={ofMode}
          onSelect={setSelectedId}
          onClear={() => setSelectedId("")}
          style={style}
          onChangeStyle={() => setPanel("styles")}
          onClearStyle={() => setStyle(null)}
          onUse={(t) => setRecent(rememberTemplate(t))}
          onExpand={setPreview}
          incoming={addedImages}
        />
        <section className={s.libraryPanel}>
          <div className={s.panelTopbar}>
            <div className={s.panelTabs} role="tablist">
              {panelTabs.map(([id, label]) => (
                <button key={id} type="button" role="tab" aria-selected={activePanel === id} onClick={() => setPanel(id)}>
                  {(() => {
                    const TabIcon = panelIcons[id];
                    return <TabIcon size={14} aria-hidden="true" />;
                  })()}
                  {c(label)}
                  {id === "styles" && <em>{c("templates.tab.new")}</em>}
                </button>
              ))}
            </div>
          </div>
          {activePanel === "how" ? (
            <>
              <HowItWorks key={mode} mode={mode} items={visible} onSelect={(item) => mode === "motion" ? setPreview(item) : setSelectedId(item.id)} />
            </>
          ) : activePanel === "history" ? (
            <HistoryPanel
              mode={mode}
              recent={recentForMode}
              onClearRecent={() => { clearRecent(); setRecent([]); }}
              items={visible}
              onSelect={(t) => mode === "motion" ? setPreview(t) : setSelectedId(t.id)}
              onExpand={setPreview}
              onRecreate={mode === "create" ? recreateTemplate : undefined}
              savedSlugs={new Set([...items, ...community].map((item) => item.slug))}
              onUseSaved={(slug) => {
                const found = [...items, ...community].find((item) => item.slug === slug);
                if (found) {
                  setRecent(rememberTemplate(found));
                  setSelectedId(found.id);
                }
              }}
              onOpenSaved={() => {
                setLane("communityNew");
                setPage(1);
                setPanel("library");
              }}
              onTemplateCreated={() => setRetry((n) => n + 1)}
            />
          ) : activePanel === "styles" ? (
            <StylesPanel chosen={style} onPick={setStyle} />
          ) : (
            <>
              <LibraryHero mode={mode} items={visible} />
              {laneToolbar}
              {libraryBody}
              {!loading && !error && pagination.totalPages >= 1 && (
                <nav className={s.pagination} aria-label={c("templates.paginationAria")}>
                  <button
                    type="button"
                    disabled={pagination.page === 1}
                    aria-label={c("templates.prev")}
                    onClick={() => {
                      setPage(pagination.page - 1);
                      setLoading(true);
                    }}
                  >
                    <ChevronLeft size={18} aria-hidden="true" />
                  </button>
                  {pages.map((n, i) => (
                    <span key={n}>
                      {i > 0 && n - pages[i - 1] > 1 && <span>…</span>}
                      <button
                        type="button"
                        aria-current={n === pagination.page ? "page" : undefined}
                        onClick={() => {
                          if (n === pagination.page) return;
                          setPage(n);
                          setLoading(true);
                        }}
                      >
                        {n}
                      </button>
                    </span>
                  ))}
                  <button
                    type="button"
                    disabled={pagination.page === pagination.totalPages}
                    aria-label={c("templates.next")}
                    onClick={() => {
                      setPage(pagination.page + 1);
                      setLoading(true);
                    }}
                  >
                    <ChevronRight size={18} aria-hidden="true" />
                  </button>
                </nav>
              )}
            </>
          )}
        </section>
      </div>
      {recreating && (
        <RecreateDialog
          t={recreating}
          onClose={() => setRecreating(null)}
          onStarted={(t) => {
            setRecent(rememberTemplate(t));
            setRecreating(null);
          }}
        />
      )}
      {preview && (
        <Preview
          t={preview}
          close={() => setPreview(null)}
          onEdit={(t, files) => {
            // A product template asks for the visitor's own product first, unless images were already added in the details.
            if (!files?.length && mode === "create" && isProductTemplate(t)) {
              setPreview(null);
              setRecreating(t);
              return;
            }
            // Editing a clip happens here: its template opens in the create panel beside the library.
            // A member's own clip is not in the library: its prompt, model and images open in the panel as they were.
            if (t.id.startsWith(WORK_ID)) setDraft(t);
            else setRecent(rememberTemplate(t));
            setAddedImages(files?.length ? { key: Date.now(), templateId: t.id, files } : null);
            setMode(modeOf(t));
            setPanel("history");
            setSelectedId(t.id);
            setPreview(null);
          }}
        />
      )}
    </div>
    </LikesContext.Provider>
  );
}
