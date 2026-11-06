"use client";

import { Suspense, useEffect, useState } from "react";
import { AlertCircle, ArrowDown, ArrowUp, ArrowUpDown, CheckCircle2, ChevronLeft, ChevronRight, LoaderCircle, Save, Search } from "lucide-react";
import { SidebarNavigation } from "@/components/app-shell/navigation";
import { StudioHeader } from "@/components/app-shell/studio-header";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  getAdminAffiliateSettings,
  listAdminAffiliates,
  updateAdminAffiliateSettings,
  updateAdminAffiliateStatus,
  type AdminAffiliate,
  type AffiliateSort,
  type AffiliateStatus,
} from "@/lib/api/affiliate";

const PAGE_SIZES = [10, 25, 50, 100];
const numberFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const dateFormat = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });

type StatusFilter = AffiliateStatus | "all";
type SortOrder = "asc" | "desc";

/** The column headings, left to right: what each is called, what the server sorts it by, and which side its numbers sit on. */
const columns: { sort: AffiliateSort; label: string; right?: boolean }[] = [
  { sort: "member", label: "Member" },
  { sort: "code", label: "Code" },
  { sort: "invited", label: "Invited", right: true },
  { sort: "topups", label: "Their top-ups (฿)", right: true },
  { sort: "commission", label: "Credits earned", right: true },
  { sort: "joined", label: "Joined" },
  { sort: "status", label: "Status" },
];

/** The page numbers to show: the first, the last and the ones around the current page, with gaps marked. */
function pageNumbers(current: number, last: number): (number | "gap")[] {
  const wanted = new Set([1, last, current - 1, current, current + 1]);
  const sorted = [...wanted].filter((value) => value >= 1 && value <= last).sort((a, b) => a - b);
  const result: (number | "gap")[] = [];
  sorted.forEach((value, index) => {
    if (index > 0 && value - sorted[index - 1] > 1) result.push("gap");
    result.push(value);
  });
  return result;
}

function AdminAffiliateContent() {
  const [enabled, setEnabled] = useState(true);
  const [percent, setPercent] = useState("10");
  const [topupEnabled, setTopupEnabled] = useState(true);
  const [usageEnabled, setUsageEnabled] = useState(false);
  const [usagePercent, setUsagePercent] = useState("3");
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const [affiliates, setAffiliates] = useState<AdminAffiliate[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [pageSize, setPageSize] = useState(25);
  const [sort, setSort] = useState<AffiliateSort>("joined");
  const [order, setOrder] = useState<SortOrder>("desc");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void getAdminAffiliateSettings()
      .then((settings) => {
        if (!active) return;
        setEnabled(settings.enabled);
        setPercent(String(settings.commissionPercent));
        setTopupEnabled(settings.topupEnabled);
        setUsageEnabled(settings.usageEnabled);
        setUsagePercent(String(settings.usageCommissionPercent));
        setSettingsLoaded(true);
      })
      .catch((error: unknown) => {
        if (active) setMessage({ tone: "error", text: error instanceof Error ? error.message : "Could not load the settings" });
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    void listAdminAffiliates({ q: appliedQuery, status, page, limit: pageSize, sort, order })
      .then((result) => {
        if (!active) return;
        setAffiliates(result.affiliates);
        setTotal(result.total);
      })
      .catch((error: unknown) => {
        if (active) setMessage({ tone: "error", text: error instanceof Error ? error.message : "Could not load the affiliates" });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [appliedQuery, status, page, pageSize, sort, order]);

  const percentValue = Number(percent);
  const percentValid = percent.trim() !== "" && Number.isFinite(percentValue) && percentValue >= 0 && percentValue <= 100;
  const usagePercentValue = Number(usagePercent);
  const usagePercentValid = usagePercent.trim() !== "" && Number.isFinite(usagePercentValue) && usagePercentValue >= 0 && usagePercentValue <= 100;
  const settingsValid = percentValid && usagePercentValid;

  async function saveSettings() {
    if (!settingsValid) return;
    setSavingSettings(true);
    setMessage(null);
    try {
      const saved = await updateAdminAffiliateSettings({
        enabled,
        topupEnabled,
        commissionPercent: percentValue,
        usageEnabled,
        usageCommissionPercent: usagePercentValue,
      });
      setEnabled(saved.enabled);
      setPercent(String(saved.commissionPercent));
      setTopupEnabled(saved.topupEnabled);
      setUsageEnabled(saved.usageEnabled);
      setUsagePercent(String(saved.usageCommissionPercent));
      setMessage({ tone: "ok", text: "Saved. The new settings apply from now on." });
    } catch (error: unknown) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "Could not save the settings" });
    } finally {
      setSavingSettings(false);
    }
  }

  async function toggleStatus(item: AdminAffiliate) {
    const next: AffiliateStatus = item.status === "active" ? "suspended" : "active";
    setBusyId(item.id);
    setMessage(null);
    try {
      await updateAdminAffiliateStatus(item.id, next);
      setAffiliates((current) => current.map((row) => (row.id === item.id ? { ...row, status: next } : row)));
    } catch (error: unknown) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "Could not change the status" });
    } finally {
      setBusyId(null);
    }
  }

  const pages = Math.max(1, Math.ceil(total / pageSize));
  const firstShown = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastShown = Math.min(total, page * pageSize);

  // A click sorts by that column (text from A, numbers from the most, dates from the newest); a second click turns it round.
  function sortBy(column: AffiliateSort) {
    setLoading(true);
    setPage(1);
    if (column === sort) {
      setOrder((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSort(column);
    setOrder(column === "member" || column === "code" || column === "status" ? "asc" : "desc");
  }
  function goTo(next: number) {
    if (next < 1 || next > pages || next === page) return;
    setLoading(true);
    setPage(next);
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen w-full min-w-0 bg-background">
        <SidebarNavigation />
        <div className="min-w-0 xl:pl-[var(--sidebar-width)]">
          <StudioHeader />
          <main className="page-gutter mx-auto w-full max-w-[1600px] py-5 lg:py-8">
            <div className="min-h-[calc(100vh-120px)] overflow-x-clip rounded-3xl bg-[#faf8f6] px-4 pb-20 pt-6 sm:px-6 lg:px-8 lg:pb-24">
              <div className="mx-auto max-w-5xl">
                <h1 className="text-xl font-extrabold">Affiliate</h1>
                <p className="mt-1 text-xs text-muted-foreground">
                  Members share a link; when someone who signed up through it tops up, the member is credited a percent of the credits they bought.
                </p>

                {message ? (
                  <div
                    className={`mt-4 flex items-center gap-2 rounded-xl border px-3 py-2 text-xs ${message.tone === "ok" ? "border-[#cfe6d6] bg-[#f1f9f3] text-[#2f7d46]" : "border-[#f2b49b] bg-[#fff8f3] text-[#b8481f]"}`}
                    role={message.tone === "ok" ? "status" : "alert"}
                  >
                    {message.tone === "ok" ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                    {message.text}
                  </div>
                ) : null}

                <section className="mt-5 rounded-2xl border border-border bg-white p-4 sm:p-5" aria-labelledby="affiliate-settings-heading">
                  <h2 id="affiliate-settings-heading" className="text-sm font-bold">Program settings</h2>
                  <label className="mt-3 flex items-center gap-2 text-xs font-semibold">
                    <input type="checkbox" checked={enabled} disabled={!settingsLoaded} onChange={(event) => setEnabled(event.target.checked)} />
                    Program is on
                  </label>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <fieldset className="rounded-xl border border-border p-3">
                      <legend className="px-1 text-xs font-bold">Earn from top-ups</legend>
                      <label className="flex items-center gap-2 text-xs font-semibold">
                        <input type="checkbox" checked={topupEnabled} disabled={!settingsLoaded} onChange={(event) => setTopupEnabled(event.target.checked)} />
                        Pay a commission when an invited member tops up
                      </label>
                      <label className="mt-2 grid gap-1 text-xs font-semibold">
                        Commission (% of the credits topped up)
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={0.01}
                          inputMode="decimal"
                          className="h-9 w-40 rounded-lg border border-border bg-white px-3 text-sm"
                          value={percent}
                          disabled={!settingsLoaded || !topupEnabled}
                          onChange={(event) => setPercent(event.target.value)}
                          aria-invalid={!percentValid}
                        />
                      </label>
                    </fieldset>

                    <fieldset className="rounded-xl border border-border p-3">
                      <legend className="px-1 text-xs font-bold">Earn from usage</legend>
                      <label className="flex items-center gap-2 text-xs font-semibold">
                        <input type="checkbox" checked={usageEnabled} disabled={!settingsLoaded} onChange={(event) => setUsageEnabled(event.target.checked)} />
                        Pay a commission when an invited member creates something successfully
                      </label>
                      <label className="mt-2 grid gap-1 text-xs font-semibold">
                        Commission (% of the credits the creation cost)
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={0.01}
                          inputMode="decimal"
                          className="h-9 w-40 rounded-lg border border-border bg-white px-3 text-sm"
                          value={usagePercent}
                          disabled={!settingsLoaded || !usageEnabled}
                          onChange={(event) => setUsagePercent(event.target.value)}
                          aria-invalid={!usagePercentValid}
                        />
                      </label>
                    </fieldset>
                  </div>

                  <div className="mt-4">
                    <Button type="button" size="sm" disabled={!settingsLoaded || !settingsValid || savingSettings} onClick={() => { void saveSettings(); }}>
                      {savingSettings ? <LoaderCircle size={14} className="animate-spin" /> : <Save size={14} />}
                      Save
                    </Button>
                  </div>
                  {!settingsValid ? <p className="mt-2 text-xs text-[#b8481f]">Enter a number from 0 to 100 in each percent field.</p> : null}
                  <p className="mt-3 text-[11px] text-muted-foreground">
                    A new rate only applies from the next top-up or creation after you save; what was earned before keeps the rate it was earned at. Usage commissions only count after the invited member has topped up at least once, so free sign-up credits never pay anyone. They are paid on the credits actually spent, net of any refund. Turning the program off stops new links and new commissions of both kinds.
                  </p>
                </section>

                <section className="mt-5 rounded-2xl border border-border bg-white p-4 sm:p-5" aria-labelledby="affiliate-list-heading">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 id="affiliate-list-heading" className="text-sm font-bold">Affiliates ({numberFormat.format(total)})</h2>
                    <form
                      className="flex flex-wrap items-center gap-2"
                      onSubmit={(event) => {
                        event.preventDefault();
                        setLoading(true);
                        setPage(1);
                        setAppliedQuery(query);
                      }}
                    >
                      <label className="relative">
                        <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input
                          className="h-9 w-56 rounded-lg border border-border bg-white pl-8 pr-3 text-xs"
                          placeholder="Search email, name or code"
                          aria-label="Search affiliates"
                          value={query}
                          onChange={(event) => setQuery(event.target.value)}
                        />
                      </label>
                      <select
                        className="h-9 rounded-lg border border-border bg-white px-2 text-xs"
                        aria-label="Filter by status"
                        value={status}
                        onChange={(event) => {
                          setLoading(true);
                          setPage(1);
                          setStatus(event.target.value as StatusFilter);
                        }}
                      >
                        <option value="all">All statuses</option>
                        <option value="active">Active</option>
                        <option value="suspended">Suspended</option>
                      </select>
                    </form>
                  </div>

                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full min-w-[820px] table-fixed text-left text-xs">
                      <colgroup>
                        <col className="w-[25%]" />
                        <col className="w-[12%]" />
                        <col className="w-[9%]" />
                        <col className="w-[15%]" />
                        <col className="w-[13%]" />
                        <col className="w-[11%]" />
                        <col className="w-[9%]" />
                        <col className="w-[6%]" />
                      </colgroup>
                      <thead className="text-[11px] text-muted-foreground">
                        <tr className="border-b border-border">
                          {columns.map((column) => {
                            const active = sort === column.sort;
                            const Arrow = !active ? ArrowUpDown : order === "asc" ? ArrowUp : ArrowDown;
                            return (
                              <th key={column.sort} className={`py-2 pr-3 font-semibold ${column.right ? "text-right" : ""}`} aria-sort={active ? (order === "asc" ? "ascending" : "descending") : "none"}>
                                <button
                                  type="button"
                                  className={`inline-flex items-center gap-1 rounded-md font-semibold transition-colors hover:text-foreground ${active ? "text-foreground" : ""}`}
                                  onClick={() => sortBy(column.sort)}
                                >
                                  {column.label}
                                  <Arrow size={12} className={active ? "text-[#f26b38]" : "opacity-50"} aria-hidden="true" />
                                </button>
                              </th>
                            );
                          })}
                          <th className="py-2 text-right font-semibold"><span className="sr-only">Action</span></th>
                        </tr>
                      </thead>
                      <tbody>
                        {loading && affiliates.length === 0 ? (
                          <tr><td colSpan={8} className="py-6 text-center text-muted-foreground">Loading…</td></tr>
                        ) : affiliates.length === 0 ? (
                          <tr><td colSpan={8} className="py-6 text-center text-muted-foreground">No affiliates found.</td></tr>
                        ) : (
                          affiliates.map((item) => (
                            <tr key={item.id} className={`border-b border-border/60 transition-opacity last:border-0 ${loading ? "opacity-50" : ""}`}>
                              <td className="py-2.5 pr-3">
                                <div className="font-semibold">{item.displayName || item.email || "—"}</div>
                                {item.displayName && item.email ? <div className="text-[11px] text-muted-foreground">{item.email}</div> : null}
                              </td>
                              <td className="py-2.5 pr-3 font-mono">{item.code}</td>
                              <td className="py-2.5 pr-3 text-right tabular-nums">{numberFormat.format(item.invitedCount)}</td>
                              <td className="py-2.5 pr-3 text-right tabular-nums">{numberFormat.format(item.topupAmountThb)}</td>
                              <td className="py-2.5 pr-3 text-right tabular-nums">{numberFormat.format(item.commissionCredits)}</td>
                              <td className="py-2.5 pr-3">{dateFormat.format(new Date(item.createdAt))}</td>
                              <td className="py-2.5 pr-3">
                                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${item.status === "active" ? "bg-[#eaf5ec] text-[#2f7d46]" : "bg-[#fff0e9] text-[#b8481f]"}`}>
                                  {item.status === "active" ? "Active" : "Suspended"}
                                </span>
                              </td>
                              <td className="py-2.5 text-right">
                                <Button type="button" variant="outline" size="sm" disabled={busyId === item.id} onClick={() => { void toggleStatus(item); }}>
                                  {item.status === "active" ? "Suspend" : "Reactivate"}
                                </Button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  <nav className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs" aria-label="Affiliate pages">
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <span>Showing {numberFormat.format(firstShown)}–{numberFormat.format(lastShown)} of {numberFormat.format(total)}</span>
                      <label className="flex items-center gap-1.5">
                        Rows
                        <select
                          className="h-8 rounded-lg border border-border bg-white px-1.5 text-xs text-foreground"
                          value={pageSize}
                          onChange={(event) => {
                            setLoading(true);
                            setPage(1);
                            setPageSize(Number(event.target.value));
                          }}
                        >
                          {PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
                        </select>
                      </label>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button type="button" variant="outline" size="sm" aria-label="Previous page" disabled={page <= 1 || loading} onClick={() => goTo(page - 1)}>
                        <ChevronLeft size={14} />
                      </Button>
                      {pageNumbers(page, pages).map((entry, index) =>
                        entry === "gap" ? (
                          <span key={`gap-${index}`} className="px-1 text-muted-foreground">…</span>
                        ) : (
                          <Button
                            key={entry}
                            type="button"
                            size="sm"
                            variant={entry === page ? "default" : "outline"}
                            aria-label={`Page ${entry}`}
                            aria-current={entry === page ? "page" : undefined}
                            disabled={loading && entry !== page}
                            onClick={() => goTo(entry)}
                          >
                            {entry}
                          </Button>
                        ),
                      )}
                      <Button type="button" variant="outline" size="sm" aria-label="Next page" disabled={page >= pages || loading} onClick={() => goTo(page + 1)}>
                        <ChevronRight size={14} />
                      </Button>
                    </div>
                  </nav>
                </section>
              </div>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

export default function AdminAffiliatePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <AdminAffiliateContent />
    </Suspense>
  );
}
