"use client";

import { Suspense, useEffect, useState } from "react";
import { AlertCircle, ArrowDown, ArrowUp, ArrowUpDown, CheckCircle2, ChevronLeft, ChevronRight, LoaderCircle, Plus, Save, Search, Trash2 } from "lucide-react";
import { SidebarNavigation } from "@/components/app-shell/navigation";
import { StudioHeader } from "@/components/app-shell/studio-header";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  getAdminAffiliateSettings,
  listAdminAffiliates,
  updateAdminAffiliateSettings,
  updateAdminAffiliateStatus,
  updateAdminAffiliateTier,
  AFFILIATE_TIERS,
  type AdminAffiliate,
  type AffiliateSettings,
  type AffiliateSort,
  type AffiliateStatus,
  type AffiliateTier,
} from "@/lib/api/affiliate";
import { WithdrawalsSection } from "./withdrawals-section";

const PAGE_SIZES = [10, 25, 50, 100];
const numberFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const dateFormat = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });

type StatusFilter = AffiliateStatus | "all";
type TierFilter = AffiliateTier | "all";
type SortOrder = "asc" | "desc";

const TIER_LABELS: Record<AffiliateTier, string> = { partner: "Partner", kol: "KOL", user: "General user" };
/** The most a tier can pay: for a member's first top-up, and for each one after it. */
const MAX_FIRST_PERCENT = 20;
const MAX_REPEAT_PERCENT = 10;
const MAX_BONUS_STEPS = 10;

/** The rates and steps as the text in their boxes, so a half-typed number is not thrown away. */
type TierRateText = Record<AffiliateTier, { first: string; repeat: string }>;
type BonusStepText = { id: number; minTopupBaht: string; percent: string };

const EMPTY_RATES: TierRateText = { partner: { first: "", repeat: "" }, kol: { first: "", repeat: "" }, user: { first: "", repeat: "" } };

function ratesText(settings: AffiliateSettings): TierRateText {
  const text = { ...EMPTY_RATES };
  for (const tier of AFFILIATE_TIERS) {
    // A server that predates tiers has one rate for every top-up.
    const rate = settings.tierRates?.[tier] ?? { firstTopupPercent: Math.min(settings.commissionPercent, MAX_FIRST_PERCENT), repeatTopupPercent: Math.min(settings.commissionPercent, MAX_REPEAT_PERCENT) };
    text[tier] = { first: String(rate.firstTopupPercent), repeat: String(rate.repeatTopupPercent) };
  }
  return text;
}

function stepsText(settings: AffiliateSettings): BonusStepText[] {
  return (settings.bonusSteps ?? []).map((step, index) => ({ id: index, minTopupBaht: String(step.minTopupBaht), percent: String(step.percent) }));
}

/** The column headings, left to right: what each is called, what the server sorts it by, and which side its numbers sit on. */
const columns: { sort: AffiliateSort; label: string; right?: boolean }[] = [
  { sort: "member", label: "Member" },
  { sort: "code", label: "Code" },
  { sort: "tier", label: "Tier" },
  { sort: "invited", label: "Invited", right: true },
  { sort: "topups", label: "Their top-ups (฿)", right: true },
  { sort: "commission", label: "Earned (฿)", right: true },
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

/** A number box for the exchange settings, with its label above it. */
function NumberField({ label, value, onChange, disabled, invalid, min, max, step }: { label: string; value: string; onChange: (value: string) => void; disabled: boolean; invalid: boolean; min: number; max: number; step: number }) {
  return (
    <label className="grid gap-1 text-xs font-semibold">
      {label}
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        inputMode="decimal"
        className="h-9 w-40 rounded-lg border border-border bg-white px-3 text-sm"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={invalid}
      />
    </label>
  );
}

const inRange = (text: string, min: number, max: number) => {
  const value = Number(text);
  return text.trim() !== "" && Number.isFinite(value) && value >= min && value <= max;
};

function AdminAffiliateContent() {
  const [enabled, setEnabled] = useState(true);
  const [tierRates, setTierRates] = useState<TierRateText>(EMPTY_RATES);
  const [bonusEnabled, setBonusEnabled] = useState(true);
  const [bonusSteps, setBonusSteps] = useState<BonusStepText[]>([]);
  const [topupEnabled, setTopupEnabled] = useState(true);
  const [usageEnabled, setUsageEnabled] = useState(false);
  const [usagePercent, setUsagePercent] = useState("3");
  const [bahtPerCredit, setBahtPerCredit] = useState("0.1");
  const [creditsPerBaht, setCreditsPerBaht] = useState("10");
  const [holdDays, setHoldDays] = useState("7");
  const [minExchangeBaht, setMinExchangeBaht] = useState("100");
  const [withdrawEnabled, setWithdrawEnabled] = useState(false);
  const [minWithdrawBaht, setMinWithdrawBaht] = useState("500");
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const [affiliates, setAffiliates] = useState<AdminAffiliate[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [tier, setTier] = useState<TierFilter>("all");
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
        setTierRates(ratesText(settings));
        setBonusEnabled(settings.bonusEnabled ?? false);
        setBonusSteps(stepsText(settings));
        setTopupEnabled(settings.topupEnabled);
        setUsageEnabled(settings.usageEnabled);
        setUsagePercent(String(settings.usageCommissionPercent));
        setBahtPerCredit(String(settings.bahtPerCredit));
        setCreditsPerBaht(String(settings.creditsPerBaht));
        setHoldDays(String(settings.holdDays));
        setMinExchangeBaht(String(settings.minExchangeBaht));
        setWithdrawEnabled(settings.withdrawEnabled ?? false);
        setMinWithdrawBaht(String(settings.minWithdrawBaht ?? 500));
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
    void listAdminAffiliates({ q: appliedQuery, status, tier, page, limit: pageSize, sort, order })
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
  }, [appliedQuery, status, tier, page, pageSize, sort, order]);

  const ratesValid = AFFILIATE_TIERS.every((name) => inRange(tierRates[name].first, 0, MAX_FIRST_PERCENT) && inRange(tierRates[name].repeat, 0, MAX_REPEAT_PERCENT));
  // Each step needs a total above 0 and a percent; a bigger total cannot pay a smaller percent, and no two start at the same total.
  const sortedSteps = [...bonusSteps].sort((a, b) => Number(a.minTopupBaht) - Number(b.minTopupBaht));
  const stepsValid =
    bonusSteps.length <= MAX_BONUS_STEPS &&
    bonusSteps.every((step) => inRange(step.minTopupBaht, 0.01, 1000000000) && inRange(step.percent, 0, 100)) &&
    sortedSteps.every((step, index) => index === 0 || (Number(step.minTopupBaht) > Number(sortedSteps[index - 1].minTopupBaht) && Number(step.percent) >= Number(sortedSteps[index - 1].percent)));
  const usagePercentValue = Number(usagePercent);
  const usagePercentValid = usagePercent.trim() !== "" && Number.isFinite(usagePercentValue) && usagePercentValue >= 0 && usagePercentValue <= 100;
  const bahtPerCreditValid = inRange(bahtPerCredit, 0.000001, 1000);
  const creditsPerBahtValid = inRange(creditsPerBaht, 0.0001, 100000);
  const holdDaysValid = inRange(holdDays, 0, 365) && Number.isInteger(Number(holdDays));
  const minExchangeValid = inRange(minExchangeBaht, 0.01, 10000000);
  const minWithdrawValid = inRange(minWithdrawBaht, 0.01, 10000000);
  const settingsValid = ratesValid && stepsValid && usagePercentValid && bahtPerCreditValid && creditsPerBahtValid && holdDaysValid && minExchangeValid && minWithdrawValid;

  async function saveSettings() {
    if (!settingsValid) return;
    setSavingSettings(true);
    setMessage(null);
    try {
      const saved = await updateAdminAffiliateSettings({
        enabled,
        topupEnabled,
        tierRates: {
          partner: { firstTopupPercent: Number(tierRates.partner.first), repeatTopupPercent: Number(tierRates.partner.repeat) },
          kol: { firstTopupPercent: Number(tierRates.kol.first), repeatTopupPercent: Number(tierRates.kol.repeat) },
          user: { firstTopupPercent: Number(tierRates.user.first), repeatTopupPercent: Number(tierRates.user.repeat) },
        },
        bonusEnabled,
        bonusSteps: sortedSteps.map((step) => ({ minTopupBaht: Number(step.minTopupBaht), percent: Number(step.percent) })),
        usageEnabled,
        usageCommissionPercent: usagePercentValue,
        bahtPerCredit: Number(bahtPerCredit),
        creditsPerBaht: Number(creditsPerBaht),
        holdDays: Number(holdDays),
        minExchangeBaht: Number(minExchangeBaht),
        withdrawEnabled,
        minWithdrawBaht: Number(minWithdrawBaht),
      });
      setEnabled(saved.enabled);
      setTierRates(ratesText(saved));
      setBonusEnabled(saved.bonusEnabled ?? false);
      setBonusSteps(stepsText(saved));
      setTopupEnabled(saved.topupEnabled);
      setUsageEnabled(saved.usageEnabled);
      setUsagePercent(String(saved.usageCommissionPercent));
      setBahtPerCredit(String(saved.bahtPerCredit));
      setCreditsPerBaht(String(saved.creditsPerBaht));
      setHoldDays(String(saved.holdDays));
      setMinExchangeBaht(String(saved.minExchangeBaht));
      setWithdrawEnabled(saved.withdrawEnabled ?? false);
      setMinWithdrawBaht(String(saved.minWithdrawBaht ?? 500));
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

  async function changeTier(item: AdminAffiliate, next: AffiliateTier) {
    if (next === (item.tier ?? "user")) return;
    setBusyId(item.id);
    setMessage(null);
    try {
      await updateAdminAffiliateTier(item.id, next);
      setAffiliates((current) => current.map((row) => (row.id === item.id ? { ...row, tier: next } : row)));
      setMessage({ tone: "ok", text: `${item.displayName || item.email || item.code} is now ${TIER_LABELS[next]}. The new rates apply from the next top-up in their line.` });
    } catch (error: unknown) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "Could not change the tier" });
    } finally {
      setBusyId(null);
    }
  }

  function setRate(name: AffiliateTier, field: "first" | "repeat", value: string) {
    setTierRates((current) => ({ ...current, [name]: { ...current[name], [field]: value } }));
  }
  function setStep(id: number, field: "minTopupBaht" | "percent", value: string) {
    setBonusSteps((current) => current.map((step) => (step.id === id ? { ...step, [field]: value } : step)));
  }
  function addStep() {
    setBonusSteps((current) => [...current, { id: current.reduce((max, step) => Math.max(max, step.id), -1) + 1, minTopupBaht: "", percent: "" }]);
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
    setOrder(column === "member" || column === "code" || column === "status" || column === "tier" ? "asc" : "desc");
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
                  Members share a link. When someone who signed up through it tops up, the member earns a percent in baht: one rate for that person&apos;s first top-up and another for every top-up after it, set per tier (Partner, KOL, General user). A step bonus is added from everything the member&apos;s whole line has topped up. After a short hold, the baht can be exchanged for credits or withdrawn.
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

                  <fieldset className="mt-4 rounded-xl border border-border p-3">
                    <legend className="px-1 text-xs font-bold">Earn from top-ups, by tier</legend>
                    <label className="flex items-center gap-2 text-xs font-semibold">
                      <input type="checkbox" checked={topupEnabled} disabled={!settingsLoaded} onChange={(event) => setTopupEnabled(event.target.checked)} />
                      Pay a commission when an invited member tops up
                    </label>
                    <div className="mt-3 overflow-x-auto">
                      <table className="w-full min-w-[420px] text-left text-xs">
                        <thead className="text-[11px] text-muted-foreground">
                          <tr className="border-b border-border">
                            <th className="py-2 pr-3 font-semibold">Tier</th>
                            <th className="py-2 pr-3 font-semibold">First top-up (0–{MAX_FIRST_PERCENT}%)</th>
                            <th className="py-2 font-semibold">2nd top-up onward (0–{MAX_REPEAT_PERCENT}%)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {AFFILIATE_TIERS.map((name) => (
                            <tr key={name} className="border-b border-border/60 last:border-0">
                              <th scope="row" className="py-2 pr-3 font-semibold">{TIER_LABELS[name]}</th>
                              <td className="py-2 pr-3">
                                <input
                                  type="number"
                                  min={0}
                                  max={MAX_FIRST_PERCENT}
                                  step={0.01}
                                  inputMode="decimal"
                                  className="h-9 w-28 rounded-lg border border-border bg-white px-3 text-sm"
                                  aria-label={`${TIER_LABELS[name]}: first top-up percent`}
                                  value={tierRates[name].first}
                                  disabled={!settingsLoaded || !topupEnabled}
                                  onChange={(event) => setRate(name, "first", event.target.value)}
                                  aria-invalid={!inRange(tierRates[name].first, 0, MAX_FIRST_PERCENT)}
                                />
                              </td>
                              <td className="py-2">
                                <input
                                  type="number"
                                  min={0}
                                  max={MAX_REPEAT_PERCENT}
                                  step={0.01}
                                  inputMode="decimal"
                                  className="h-9 w-28 rounded-lg border border-border bg-white px-3 text-sm"
                                  aria-label={`${TIER_LABELS[name]}: percent from the second top-up onward`}
                                  value={tierRates[name].repeat}
                                  disabled={!settingsLoaded || !topupEnabled}
                                  onChange={(event) => setRate(name, "repeat", event.target.value)}
                                  aria-invalid={!inRange(tierRates[name].repeat, 0, MAX_REPEAT_PERCENT)}
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="mt-2 text-[11px] text-muted-foreground">Percent of what the invited member pays, before VAT. A member&apos;s tier is set in the list below; everyone starts as a general user.</p>
                  </fieldset>

                  <fieldset className="mt-3 rounded-xl border border-border p-3">
                    <legend className="px-1 text-xs font-bold">Step bonus</legend>
                    <label className="flex items-center gap-2 text-xs font-semibold">
                      <input type="checkbox" checked={bonusEnabled} disabled={!settingsLoaded} onChange={(event) => setBonusEnabled(event.target.checked)} />
                      Pay a bonus from everything an affiliate&apos;s line has topped up
                    </label>
                    <div className="mt-3 grid gap-2">
                      {bonusSteps.map((step) => (
                        <div key={step.id} className="flex flex-wrap items-end gap-3">
                          <NumberField label="Line total from (฿)" value={step.minTopupBaht} onChange={(value) => setStep(step.id, "minTopupBaht", value)} disabled={!settingsLoaded || !bonusEnabled} invalid={!inRange(step.minTopupBaht, 0.01, 1000000000)} min={0.01} max={1000000000} step={0.01} />
                          <NumberField label="Bonus (%)" value={step.percent} onChange={(value) => setStep(step.id, "percent", value)} disabled={!settingsLoaded || !bonusEnabled} invalid={!inRange(step.percent, 0, 100)} min={0} max={100} step={0.01} />
                          <Button type="button" variant="outline" size="sm" aria-label="Remove this step" disabled={!settingsLoaded || !bonusEnabled} onClick={() => setBonusSteps((current) => current.filter((row) => row.id !== step.id))}>
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3">
                      <Button type="button" variant="outline" size="sm" disabled={!settingsLoaded || !bonusEnabled || bonusSteps.length >= MAX_BONUS_STEPS} onClick={addStep}>
                        <Plus size={14} />
                        Add a step
                      </Button>
                    </div>
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      The line total is everything the people an affiliate invited have topped up, before VAT, since they joined. When it reaches a step, the affiliate has earned that percent of the whole total: reaching a higher step pays the difference, and a top-up inside a step pays that step&apos;s percent of it. Top-ups made before the bonus was switched on count too, so the first top-up after that pays what the line has already reached.
                    </p>
                  </fieldset>

                  <div className="mt-3 grid gap-3">
                    <fieldset className="rounded-xl border border-border p-3">
                      <legend className="px-1 text-xs font-bold">Earn from usage</legend>
                      <label className="flex items-center gap-2 text-xs font-semibold">
                        <input type="checkbox" checked={usageEnabled} disabled={!settingsLoaded} onChange={(event) => setUsageEnabled(event.target.checked)} />
                        Pay a commission when an invited member creates something successfully
                      </label>
                      <label className="mt-2 grid gap-1 text-xs font-semibold">
                        Commission (% of the credits the creation cost, valued at the price per credit below)
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

                  <fieldset className="mt-3 rounded-xl border border-border p-3">
                    <legend className="px-1 text-xs font-bold">Exchange for credits</legend>
                    <div className="flex flex-wrap items-end gap-4">
                      <NumberField label="Credits per ฿1 exchanged" value={creditsPerBaht} onChange={setCreditsPerBaht} disabled={!settingsLoaded} invalid={!creditsPerBahtValid} min={0.0001} max={100000} step={0.0001} />
                      <NumberField label="Minimum per exchange (฿)" value={minExchangeBaht} onChange={setMinExchangeBaht} disabled={!settingsLoaded} invalid={!minExchangeValid} min={0.01} max={10000000} step={0.01} />
                      <NumberField label="Hold before exchange (days)" value={holdDays} onChange={setHoldDays} disabled={!settingsLoaded} invalid={!holdDaysValid} min={0} max={365} step={1} />
                      <NumberField label="Price per credit (฿), for usage" value={bahtPerCredit} onChange={setBahtPerCredit} disabled={!settingsLoaded} invalid={!bahtPerCreditValid} min={0.000001} max={1000} step={0.000001} />
                    </div>
                  </fieldset>

                  <fieldset className="mt-3 rounded-xl border border-border p-3">
                    <legend className="px-1 text-xs font-bold">Withdraw as money</legend>
                    <label className="flex items-center gap-2 text-xs font-semibold">
                      <input type="checkbox" checked={withdrawEnabled} disabled={!settingsLoaded} onChange={(event) => setWithdrawEnabled(event.target.checked)} />
                      Let members ask to withdraw their baht (you transfer it by hand, then mark it paid below)
                    </label>
                    <div className="mt-2">
                      <NumberField label="Minimum per withdrawal (฿)" value={minWithdrawBaht} onChange={setMinWithdrawBaht} disabled={!settingsLoaded || !withdrawEnabled} invalid={!minWithdrawValid} min={0.01} max={10000000} step={0.01} />
                    </div>
                    <p className="mt-2 text-[11px] text-muted-foreground">Tax withholding and bank fees are handled outside this system: the amount a member asks for is the amount to transfer. Off by default, because it pays out real money.</p>
                  </fieldset>

                  <div className="mt-4">
                    <Button type="button" size="sm" disabled={!settingsLoaded || !settingsValid || savingSettings} onClick={() => { void saveSettings(); }}>
                      {savingSettings ? <LoaderCircle size={14} className="animate-spin" /> : <Save size={14} />}
                      Save
                    </Button>
                  </div>
                  {!settingsValid ? <p className="mt-2 text-xs text-[#b8481f]">Check the highlighted fields: a first top-up rate is 0 to 20, a rate from the second top-up is 0 to 10, bonus steps need a total above 0 and a higher step cannot pay a lower percent, the other numbers must be above 0 (hold days can be 0, whole days only).</p> : null}
                  <p className="mt-3 text-[11px] text-muted-foreground">
                    A new rate or tier only applies from the next top-up or creation after you save; what was earned before keeps the rate it was earned at. Earnings wait for the hold before they can be exchanged, which covers refunds and chargebacks. The exchange rate and minimum apply at the moment a member exchanges. Usage commissions only count after the invited member has topped up at least once, so free sign-up credits never pay anyone. They are paid on the credits actually spent, net of any refund. Turning the program off stops new links and new commissions of both kinds.
                  </p>
                </section>

                <WithdrawalsSection />

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
                      <select
                        className="h-9 rounded-lg border border-border bg-white px-2 text-xs"
                        aria-label="Filter by tier"
                        value={tier}
                        onChange={(event) => {
                          setLoading(true);
                          setPage(1);
                          setTier(event.target.value as TierFilter);
                        }}
                      >
                        <option value="all">All tiers</option>
                        {AFFILIATE_TIERS.map((name) => <option key={name} value={name}>{TIER_LABELS[name]}</option>)}
                      </select>
                    </form>
                  </div>

                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full min-w-[960px] table-fixed text-left text-xs">
                      <colgroup>
                        <col className="w-[21%]" />
                        <col className="w-[10%]" />
                        <col className="w-[14%]" />
                        <col className="w-[8%]" />
                        <col className="w-[13%]" />
                        <col className="w-[11%]" />
                        <col className="w-[10%]" />
                        <col className="w-[8%]" />
                        <col className="w-[5%]" />
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
                          <tr><td colSpan={9} className="py-6 text-center text-muted-foreground">Loading…</td></tr>
                        ) : affiliates.length === 0 ? (
                          <tr><td colSpan={9} className="py-6 text-center text-muted-foreground">No affiliates found.</td></tr>
                        ) : (
                          affiliates.map((item) => (
                            <tr key={item.id} className={`border-b border-border/60 transition-opacity last:border-0 ${loading ? "opacity-50" : ""}`}>
                              <td className="py-2.5 pr-3">
                                <div className="font-semibold">{item.displayName || item.email || "—"}</div>
                                {item.displayName && item.email ? <div className="text-[11px] text-muted-foreground">{item.email}</div> : null}
                              </td>
                              <td className="py-2.5 pr-3 font-mono">{item.code}</td>
                              <td className="py-2.5 pr-3">
                                <select
                                  className="h-8 w-full rounded-lg border border-border bg-white px-1.5 text-xs"
                                  aria-label={`Tier of ${item.displayName || item.email || item.code}`}
                                  value={item.tier ?? "user"}
                                  disabled={busyId === item.id}
                                  onChange={(event) => { void changeTier(item, event.target.value as AffiliateTier); }}
                                >
                                  {AFFILIATE_TIERS.map((name) => <option key={name} value={name}>{TIER_LABELS[name]}</option>)}
                                </select>
                              </td>
                              <td className="py-2.5 pr-3 text-right tabular-nums">{numberFormat.format(item.invitedCount)}</td>
                              <td className="py-2.5 pr-3 text-right tabular-nums">{numberFormat.format(item.topupAmountThb)}</td>
                              <td className="py-2.5 pr-3 text-right tabular-nums">
                                {numberFormat.format(item.earnedBaht)}
                                {item.redeemedBaht > 0 ? <div className="text-[11px] text-muted-foreground">exchanged {numberFormat.format(item.redeemedBaht)}</div> : null}
                              </td>
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
