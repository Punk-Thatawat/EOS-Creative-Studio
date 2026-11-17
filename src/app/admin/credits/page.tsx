"use client";

import { TopupPackages } from "./topup-packages";
import { SearchInput } from "@/components/ui/search-input";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Calculator,
  CheckCircle2,
  Coins,
  DollarSign,
  Info,
  LoaderCircle,
  Percent,
  Plus,
  RefreshCw,
  Save,
  Settings2,
  SlidersHorizontal,
} from "lucide-react";
import { SidebarNavigation } from "@/components/app-shell/navigation";
import { StudioHeader } from "@/components/app-shell/studio-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SidebarProvider } from "@/components/ui/sidebar";
import {
  listAdminModelRoutesOverview,
  type AdminModelRoutesOverview,
} from "@/lib/api/generation-models";
import { getAdminAudioSettings, type AdminAudioSettings } from "@/lib/api/audio";
import { listDocumentOcrTypes, type OcrDocumentTypeInfo } from "@/lib/api/document-ocr";
import {
  listAdminCreditPricingRules,
  getAdminSignupCreditGrant,
  previewAdminCreditPricingRules,
  updateAdminSignupCreditGrant,
  upsertAdminCreditPricingDefaults,
  upsertAdminCreditPricingRule,
  type CreditPricingPreview,
  type CreditPricingRule,
  type CreditPricingSettings,
  type SignupCreditGrantSettings,
} from "@/lib/api/credit-pricing";
import { type PricingCategoryFilter, type PricingRow, type RuleDraft } from "./pricing.types";
import {
  MAX_TARGET_MARKUP_PERCENT,
  MAX_TARGET_MARKUP_RATIO,
  audioFeatureGroups,
  audioFeatureKeys,
  documentFeatureKeys,
  fallbackModelRows,
  featureLabels,
  featureOrder,
  presenterFeatureKeys,
} from "./pricing.constants";
import {
  audioPricingRows,
  documentOcrPricingRows,
  matchesPricingCategory,
  modelRowsFromOverview,
  previewPricingRowsInBatches,
  rowKey,
} from "./pricing-rows";
import { formatMetric, previewWithDraft } from "./pricing-preview";
import {
  cleanScenarioValues,
  defaultScenarioValues,
  pricingProperties,
} from "./pricing-parameters";
import { parsePromptAddonsJson, promptAddonVariableCount, promptAddonsJson } from "./prompt-addons";
import { NumberField } from "./number-field";
import { SummaryCard } from "./summary-card";
import { PromptAddonsDialog } from "./prompt-addons-dialog";
import { PricingVariablesPanel } from "./pricing-variables-panel";

function AdminCreditsContent() {
  const [bundleCredits, setBundleCredits] = useState("5000");
  const [bundlePrice, setBundlePrice] = useState("500");
  const [marginPercent, setMarginPercent] = useState("40");
  const [fxRate, setFxRate] = useState("33.50");
  const [roundingDecimals, setRoundingDecimals] = useState(0);
  const [fixedCost, setFixedCost] = useState("0");
  const [smartEnhancePrice, setSmartEnhancePrice] = useState("0");
  const [minimumCredits, setMinimumCredits] = useState("1");
  const [rateSource, setRateSource] = useState("Environment fallback");
  const [rateUpdatedAt, setRateUpdatedAt] = useState("");
  const [rateStale, setRateStale] = useState(false);
  const [modelRows, setModelRows] = useState<PricingRow[]>(fallbackModelRows);
  const [quotes, setQuotes] = useState<Record<string, CreditPricingPreview>>(
    {},
  );
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [scenarioValues, setScenarioValues] = useState<
    Record<string, Record<string, unknown>>
  >({});
  const [openConfigKey, setOpenConfigKey] = useState("");
  const [openAddonKey, setOpenAddonKey] = useState("");
  const [scenarioLoadingKey, setScenarioLoadingKey] = useState("");
  const scenarioTimer = useRef<number | undefined>(undefined);
  const [pricingRules, setPricingRules] = useState<CreditPricingRule[]>([]);
  const [drafts, setDrafts] = useState<Record<string, RuleDraft>>({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState("");
  const [globalDirty, setGlobalDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [categoryFilter, setCategoryFilter] =
    useState<PricingCategoryFilter>("all");
  const [featureFilter, setFeatureFilter] = useState("all");
  const [modelSearch, setModelSearch] = useState("");
  const [signupBonusEnabled, setSignupBonusEnabled] = useState(false);
  const [signupBonusCredits, setSignupBonusCredits] = useState("0");
  const [signupBonusStartDate, setSignupBonusStartDate] = useState("");
  const [signupBonusEndDate, setSignupBonusEndDate] = useState("");
  const [signupBonusDirty, setSignupBonusDirty] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [settings, overview, audioSettings, documentOcrTypes]: [
        CreditPricingSettings,
        AdminModelRoutesOverview,
        AdminAudioSettings,
        OcrDocumentTypeInfo[],
      ] = await Promise.all([
        listAdminCreditPricingRules(),
        listAdminModelRoutesOverview(),
        getAdminAudioSettings(),
        listDocumentOcrTypes().catch(() => []),
      ]);
      const signupBonus: SignupCreditGrantSettings = await getAdminSignupCreditGrant();
      setPricingRules(settings.rules);
      setMarginPercent(String(settings.defaults.targetMargin * 100));
      setFxRate(settings.defaults.exchangeRateThbPerUsd.toFixed(4));
      setRateSource(
        settings.defaults.exchangeRateSource ?? "Environment fallback",
      );
      setRateUpdatedAt(settings.defaults.exchangeRateFetchedAt ?? "");
      setRateStale(settings.defaults.exchangeRateStale === true);
      setFixedCost(String(settings.defaults.fixedCostThb));
      setSmartEnhancePrice(String(settings.defaults.smartEnhancePriceThb ?? 0));
      setMinimumCredits(String(settings.defaults.minimumCreditCost));
      setRoundingDecimals(settings.defaults.roundingDecimals);
      setSignupBonusEnabled(signupBonus.enabled);
      setSignupBonusCredits(String(signupBonus.credits));
      setSignupBonusStartDate(signupBonus.startDate ?? "");
      setSignupBonusEndDate(signupBonus.endDate ?? "");
      setSignupBonusDirty(false);
      setGlobalDirty(false);
      const nextRows = [
        ...modelRowsFromOverview(overview),
        ...audioPricingRows(audioSettings),
        ...documentOcrPricingRows(documentOcrTypes),
      ];
      const rowsForPreview = nextRows.length > 0 ? nextRows : fallbackModelRows;
      if (nextRows.length > 0) setModelRows(nextRows);
      setScenarioValues(
        Object.fromEntries(
          rowsForPreview.map((row) => [
            rowKey(row),
            defaultScenarioValues(row),
          ]),
        ),
      );
      setQuotesLoading(true);
      void previewPricingRowsInBatches(
        rowsForPreview.map((row) => ({
          provider: row.provider,
          model: row.model,
          featureKey: row.featureKey,
          input: cleanScenarioValues(defaultScenarioValues(row)),
        })),
      )
        .then((previews) => {
          setQuotes(
            Object.fromEntries(
              previews.map((preview) => [
                `${preview.provider}:${preview.model}:${preview.featureKey ?? ""}`,
                preview,
              ]),
            ),
          );
        })
        .catch(() => {
          setQuotes({});
        })
        .finally(() => {
          setQuotesLoading(false);
        });
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to load pricing rules",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(loadTimer);
  }, [load]);

  useEffect(
    () => () => {
      if (scenarioTimer.current !== undefined)
        window.clearTimeout(scenarioTimer.current);
    },
    [],
  );

  const ruleFor = useCallback(
    (row: PricingRow): CreditPricingRule | undefined => {
      return (
        pricingRules.find(
          (rule) =>
            rule.provider === row.provider &&
            rule.model === row.model &&
            rule.featureKey === row.featureKey,
        ) ??
        pricingRules.find(
          (rule) =>
            rule.provider === row.provider &&
            rule.model === row.model &&
            !rule.featureKey,
        )
      );
    },
    [pricingRules],
  );

  const draftFor = useCallback(
    (row: PricingRow): RuleDraft => {
      const existingDraft = drafts[rowKey(row)];
      if (existingDraft) return existingDraft;
      const rule = ruleFor(row);
      return {
        targetMargin: rule
          ? String(rule.targetMargin * 100)
          : String(Number(marginPercent) || 0),
        fixedCostThb: String(rule?.fixedCostThb ?? (Number(fixedCost) || 0)),
        minimumCreditCost: String(
          rule?.minimumCreditCost ?? (Number(minimumCredits) || 1),
        ),
        promptAddonsJson: promptAddonsJson(rule?.promptAddons),
      };
    },
    [drafts, fixedCost, marginPercent, minimumCredits, ruleFor],
  );

  const refreshScenarioQuote = useCallback(
    async (row: PricingRow, values: Record<string, unknown>) => {
      const key = rowKey(row);
      setScenarioLoadingKey(key);
      try {
        const previews = await previewAdminCreditPricingRules([
          {
            provider: row.provider,
            model: row.model,
            featureKey: row.featureKey,
            input: cleanScenarioValues(values),
          },
        ]);
        const preview = previews[0];
        if (preview) setQuotes((current) => ({ ...current, [key]: preview }));
      } catch {
        // Keep the last successful quote visible while a scenario request is unavailable.
      } finally {
        setScenarioLoadingKey((current) => (current === key ? "" : current));
      }
    },
    [],
  );

  const toggleConfigure = (row: PricingRow) => {
    const key = rowKey(row);
    setScenarioValues((current) =>
      current[key]
        ? current
        : { ...current, [key]: defaultScenarioValues(row) },
    );
    setOpenConfigKey((current) => (current === key ? "" : key));
  };

  const updateScenarioValue = (
    row: PricingRow,
    name: string,
    value: unknown,
  ) => {
    const key = rowKey(row);
    const nextValues = {
      ...(scenarioValues[key] ?? defaultScenarioValues(row)),
      [name]: value,
    };
    setScenarioValues((current) => ({ ...current, [key]: nextValues }));
    if (scenarioTimer.current !== undefined)
      window.clearTimeout(scenarioTimer.current);
    scenarioTimer.current = window.setTimeout(() => {
      void refreshScenarioQuote(row, nextValues);
    }, 450);
  };

  const rule = useMemo(() => {
    const credits = Number(bundleCredits) || 0;
    const price = Number(bundlePrice) || 0;
    const creditValue = credits > 0 ? price / credits : 0;
    const providerUsd = 0.04;
    const providerThb = providerUsd * (Number(fxRate) || 0);
    const markup = Math.min(
      Math.max((Number(marginPercent) || 0) / 100, 0),
      MAX_TARGET_MARKUP_RATIO,
    );
    const sellingBeforeRound =
      (providerThb + (Number(fixedCost) || 0)) * (1 + markup);
    const chargedCredits =
      creditValue > 0
        ? Math.max(
            Number(minimumCredits) || 1,
            Math.ceil(sellingBeforeRound / creditValue),
          )
        : 0;
    const chargedThb = chargedCredits * creditValue;
    return {
      creditValue,
      providerUsd,
      providerThb,
      sellingBeforeRound,
      chargedCredits,
      chargedThb,
      profit: chargedThb - providerThb,
    };
  }, [
    bundleCredits,
    bundlePrice,
    marginPercent,
    fxRate,
    fixedCost,
    minimumCredits,
  ]);

  const updateDraft = (row: PricingRow, patch: Partial<RuleDraft>) => {
    const key = rowKey(row);
    setDrafts((current) => ({
      ...current,
      [key]: { ...draftFor(row), ...patch, dirty: true },
    }));
  };

  const saveGlobalFallback = async () => {
    const targetMargin = Number(marginPercent) / 100;
    const fixed = Number(fixedCost);
    const smartEnhance = Number(smartEnhancePrice);
    const minimum = Number(minimumCredits);
    if (!Number.isFinite(targetMargin) || targetMargin < 0 || targetMargin > MAX_TARGET_MARKUP_RATIO) {
      setError(`Global markup must be between 0% and ${MAX_TARGET_MARKUP_PERCENT}%`);
      return;
    }
    if (!Number.isFinite(fixed) || fixed < 0) {
      setError("Global fixed cost must be zero or greater");
      return;
    }
    if (!Number.isFinite(smartEnhance) || smartEnhance < 0) {
      setError("Smart Enhance price must be zero or greater");
      return;
    }
    if (!Number.isFinite(minimum) || minimum <= 0) {
      setError("Global minimum credits must be greater than zero");
      return;
    }
    setSavingKey("defaults");
    setError("");
    try {
      const defaults = await upsertAdminCreditPricingDefaults({
        targetMargin,
        fixedCostThb: fixed,
        smartEnhancePriceThb: smartEnhance,
        minimumCreditCost: minimum,
      });
      setMarginPercent(String(defaults.targetMargin * 100));
      setFixedCost(String(defaults.fixedCostThb));
      setSmartEnhancePrice(String(defaults.smartEnhancePriceThb));
      setMinimumCredits(String(defaults.minimumCreditCost));
      setGlobalDirty(false);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2800);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save global pricing defaults");
    } finally {
      setSavingKey("");
    }
  };

  const saveSignupBonus = async () => {
    const credits = Number(signupBonusCredits);
    if (!Number.isFinite(credits) || credits < 0 || credits > 1000000) {
      setError("Welcome credits must be between 0 and 1,000,000");
      return;
    }
    if (signupBonusStartDate && signupBonusEndDate && signupBonusEndDate < signupBonusStartDate) {
      setError("End date must be on or after the start date");
      return;
    }
    setSavingKey("signup-bonus");
    setError("");
    try {
      const savedSettings = await updateAdminSignupCreditGrant({
        enabled: signupBonusEnabled,
        credits,
        startDate: signupBonusStartDate || null,
        endDate: signupBonusEndDate || null,
      });
      setSignupBonusEnabled(savedSettings.enabled);
      setSignupBonusCredits(String(savedSettings.credits));
      setSignupBonusStartDate(savedSettings.startDate ?? "");
      setSignupBonusEndDate(savedSettings.endDate ?? "");
      setSignupBonusDirty(false);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2800);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save welcome credits");
    } finally {
      setSavingKey("");
    }
  };

  const saveRows = async (rows: PricingRow[]) => {
    if (rows.length === 0) {
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2800);
      return;
    }
    setSavingKey("all");
    setError("");
    try {
      const results = await Promise.all(
        rows.map(async (row) => {
          const draft = draftFor(row);
          const targetMargin = Number(draft.targetMargin) / 100;
          if (
            !Number.isFinite(targetMargin) ||
            targetMargin < 0 ||
            targetMargin > MAX_TARGET_MARKUP_RATIO
          )
            throw new Error(
              `${row.displayName}: markup must be between 0% and ${MAX_TARGET_MARKUP_PERCENT}%`,
            );
          const fixed = Number(draft.fixedCostThb);
          const minimum = Number(draft.minimumCreditCost);
          let promptAddons: Record<string, Record<string, number>>;
          try {
            promptAddons = parsePromptAddonsJson(draft.promptAddonsJson);
          } catch (reason) {
            throw new Error(`${row.displayName}: ${reason instanceof Error ? reason.message : "invalid prompt add-ons JSON"}`);
          }
          if (!Number.isFinite(fixed) || fixed < 0)
            throw new Error(
              `${row.displayName}: fixed cost must be zero or greater`,
            );
          if (!Number.isFinite(minimum) || minimum <= 0)
            throw new Error(
              `${row.displayName}: minimum credits must be greater than zero`,
            );
          return {
            row,
            rule: await upsertAdminCreditPricingRule({
              provider: row.provider,
              model: row.model,
              featureKey: row.featureKey,
              targetMargin,
              fixedCostThb: fixed,
              minimumCreditCost: minimum,
              promptAddons,
              enabled: true,
            }),
          };
        }),
      );
      setPricingRules((current) =>
        results.reduce(
          (next, result) => [
            ...next.filter(
              (item) =>
                !(
                  item.provider === result.rule.provider &&
                  item.model === result.rule.model &&
                  item.featureKey === result.rule.featureKey
                ),
            ),
            result.rule,
          ],
          current,
        ),
      );
      setDrafts((current) => {
        const next = { ...current };
        for (const result of results)
          next[rowKey(result.row)] = {
            targetMargin: String(result.rule.targetMargin * 100),
            fixedCostThb: String(result.rule.fixedCostThb),
            minimumCreditCost: String(result.rule.minimumCreditCost),
            promptAddonsJson: promptAddonsJson(result.rule.promptAddons),
            dirty: false,
          };
        return next;
      });
      await load();
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2800);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to save pricing rules",
      );
    } finally {
      setSavingKey("");
    }
  };

  const dirtyRows = modelRows.filter(
    (row) => draftFor(row).dirty && !documentFeatureKeys.has(row.featureKey),
  );
  const availableFeatureKeys = useMemo(
    () => {
      const rowMatchesCategory = (featureKey: string) => matchesPricingCategory(featureKey, categoryFilter);
      const groupHasRows = (featureKeys: readonly string[]) =>
        modelRows.some((row) => featureKeys.includes(row.featureKey) && rowMatchesCategory(row.featureKey));

      if (categoryFilter === "audio") {
        return audioFeatureGroups
          .filter((group) => groupHasRows(group.featureKeys))
          .map((group) => group.key);
      }

      const available: string[] = [];
      const seenGroups = new Set<string>();
      for (const featureKey of featureOrder) {
        if (audioFeatureKeys.has(featureKey)) {
          const group = audioFeatureGroups.find((candidate) => candidate.featureKeys.includes(featureKey));
          if (!group || seenGroups.has(group.key)) continue;
          seenGroups.add(group.key);
          if (groupHasRows(group.featureKeys)) available.push(group.key);
          continue;
        }
        if (modelRows.some((row) => row.featureKey === featureKey && rowMatchesCategory(featureKey))) {
          available.push(featureKey);
        }
      }
      return available;
    },
    [categoryFilter, modelRows],
  );
  const selectedFeatureFilter = availableFeatureKeys.includes(featureFilter)
    ? featureFilter
    : "all";
  const selectedFeatureKeys = audioFeatureGroups.find(
    (group) => group.key === selectedFeatureFilter,
  )?.featureKeys;
  const filteredModelRows = useMemo(() => {
    const normalizedSearch = modelSearch.trim().toLowerCase();
    return modelRows.filter((row) => {
      const matchesCategory = matchesPricingCategory(row.featureKey, categoryFilter);
      const matchesFeature =
        selectedFeatureFilter === "all" ||
        (selectedFeatureKeys ?? [selectedFeatureFilter]).includes(row.featureKey);
      const searchable =
        `${row.feature} ${row.displayName} ${row.provider} ${row.model}`.toLowerCase();
      return (
        matchesCategory &&
        matchesFeature &&
        (!normalizedSearch || searchable.includes(normalizedSearch))
      );
    });
  }, [categoryFilter, modelRows, modelSearch, selectedFeatureFilter, selectedFeatureKeys]);
  const hasActiveFilters =
    categoryFilter !== "all" ||
    selectedFeatureFilter !== "all" ||
    modelSearch.trim() !== "";
  const configuredRow = modelRows.find((row) => rowKey(row) === openConfigKey);
  const addonRow = modelRows.find((row) => rowKey(row) === openAddonKey);
  const configuredDraft = configuredRow ? draftFor(configuredRow) : undefined;
  const addonDraft = addonRow ? draftFor(addonRow) : undefined;
  const configuredPreview =
    configuredRow && configuredDraft
      ? previewWithDraft(
          quotes[openConfigKey],
          configuredDraft,
          rule.creditValue,
          roundingDecimals,
        )
      : undefined;
  const configuredValues = configuredRow
    ? (scenarioValues[openConfigKey] ?? defaultScenarioValues(configuredRow))
    : {};

  return (
    <SidebarProvider>
      <div className="min-h-screen w-full min-w-0 bg-background">
        <SidebarNavigation />
        <div className="min-w-0 xl:pl-[var(--sidebar-width)]">
          <StudioHeader />
          <main data-no-translate className="page-gutter mx-auto w-full max-w-[1600px] py-5 lg:py-8">
            <TopupPackages />
            <div className="min-h-[calc(100vh-120px)] overflow-x-clip rounded-3xl bg-[#faf8f6] px-4 pb-20 sm:px-6 lg:px-8 lg:pb-24">
              <div className="mx-auto max-w-[1240px] pt-6 lg:pt-8">
                <div className="mb-8 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
                  <div>
                    <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#201d1b] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white">
                      <Settings2 size={13} /> Operations
                    </div>
                    <h1 className="max-w-xl text-3xl font-bold tracking-tight sm:text-4xl">
                      Credits &amp; billing rules
                    </h1>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                      กำหนดราคาขาย credit และกำไรแยกตาม model จากต้นทุนจริงของ
                      Provider
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Badge tone="success">Admin API</Badge>
                    <Button
                      size="lg"
                      onClick={() => void saveRows(dirtyRows)}
                      disabled={savingKey !== "" || loading}
                    >
                      <Save size={16} />{" "}
                      {savingKey === "all"
                        ? "Saving…"
                        : `Save ${dirtyRows.length || "all"} model rules`}
                    </Button>
                  </div>
                </div>

                {saved ? (
                  <div
                    className="mb-5 flex items-center gap-3 rounded-2xl border border-[#bfe1cc] bg-[#f3fbf5] p-4 text-sm text-[#347454]"
                    role="status"
                  >
                    <CheckCircle2 size={18} />
                    <p className="font-semibold">
                      บันทึกกฎราคาแล้ว
                    </p>
                  </div>
                ) : null}
                {error ? (
                  <div
                    className="mb-5 flex items-center justify-between gap-3 rounded-2xl border border-[#f1c5b5] bg-[#fff5f1] p-4 text-sm text-[#a94725]"
                    role="alert"
                  >
                    <p>{error}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void load()}
                    >
                      Retry
                    </Button>
                  </div>
                ) : null}

                <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <SummaryCard
                    icon={Coins}
                    label="Credit value"
                    value={`฿${rule.creditValue.toFixed(2)}`}
                    detail={`${Number(bundleCredits || 0).toLocaleString()} credits = ฿${Number(bundlePrice || 0).toLocaleString()}`}
                    tone="orange"
                  />
                  <SummaryCard
                    icon={Percent}
                    label="Global markup"
                    value={`${Number(marginPercent || 0)}%`}
                    detail="Fallback when model has no override"
                    tone="green"
                  />
                  <SummaryCard
                    icon={DollarSign}
                    label="USD / THB rate"
                    value={Number(fxRate || 0).toFixed(2)}
                    detail={
                      rateStale
                        ? "Auto rate unavailable · using fallback"
                        : "Auto rate · Bank of Thailand"
                    }
                    tone="pink"
                  />
                  <SummaryCard
                    icon={Calculator}
                    label="Global minimum"
                    value={`${Number(minimumCredits || 0)} credit`}
                    detail="Model rules can override this"
                    tone="orange"
                  />
                </div>
                <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge tone={rateStale ? "warning" : "success"}>
                    {rateStale ? "FX fallback" : "FX auto"}
                  </Badge>
                  <span>{rateSource}</span>
                  {rateUpdatedAt ? (
                    <span>
                      · updated{" "}
                      {new Date(rateUpdatedAt).toLocaleString("th-TH")}
                    </span>
                  ) : null}
                </div>

                <Card className="mb-6 border-[#f1c7b5] bg-[#fffaf7] p-5 sm:p-6">
                  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">
                        New user credit campaign
                      </p>
                      <h2 className="mt-1 text-xl font-bold tracking-tight">
                        แคมเปญเครดิตผู้สมัครใหม่
                      </h2>
                      <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">
                        แจกเครดิตครั้งเดียวให้ผู้สมัครใหม่ เฉพาะผู้ที่สมัครภายในช่วงวันที่กำหนด
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant={signupBonusDirty ? "default" : "outline"}
                      onClick={() => void saveSignupBonus()}
                      disabled={!signupBonusDirty || savingKey !== "" || loading}
                    >
                      {savingKey === "signup-bonus" ? <LoaderCircle size={13} className="animate-spin" /> : <Save size={13} />}
                      {savingKey === "signup-bonus" ? "Saving…" : "Save welcome credits"}
                    </Button>
                  </div>
                  <div className="mt-5 grid gap-4 sm:grid-cols-[minmax(0,220px)_minmax(0,1fr)] sm:items-end">
                    <NumberField
                      label="Credits per new user"
                      value={signupBonusCredits}
                      suffix="credits"
                      onChange={(value) => {
                        setSignupBonusCredits(value);
                        setSignupBonusDirty(true);
                      }}
                      help="ตั้งเป็น 0 เพื่อไม่แจกเครดิต"
                    />
                    <label className="flex min-h-11 items-center gap-3 rounded-xl border border-border bg-white px-3 text-xs font-semibold text-foreground">
                      <input
                        type="checkbox"
                        checked={signupBonusEnabled}
                        onChange={(event) => {
                          setSignupBonusEnabled(event.target.checked);
                          setSignupBonusDirty(true);
                        }}
                        className="h-4 w-4 accent-[#f26b38]"
                      />
                      เปิดใช้งานการแจกเครดิตอัตโนมัติ
                    </label>
                  </div>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <label className="block text-xs font-semibold text-foreground">
                      วันเริ่มแคมเปญ
                      <input
                        type="date"
                        value={signupBonusStartDate}
                        max={signupBonusEndDate || undefined}
                        onChange={(event) => {
                          setSignupBonusStartDate(event.target.value);
                          setSignupBonusDirty(true);
                        }}
                        className="mt-2 h-11 w-full rounded-xl border border-border bg-white px-3 text-sm outline-none focus:border-primary focus:ring-3 focus:ring-primary/10"
                      />
                    </label>
                    <label className="block text-xs font-semibold text-foreground">
                      วันสิ้นสุดแคมเปญ
                      <input
                        type="date"
                        value={signupBonusEndDate}
                        min={signupBonusStartDate || undefined}
                        onChange={(event) => {
                          setSignupBonusEndDate(event.target.value);
                          setSignupBonusDirty(true);
                        }}
                        className="mt-2 h-11 w-full rounded-xl border border-border bg-white px-3 text-sm outline-none focus:border-primary focus:ring-3 focus:ring-primary/10"
                      />
                    </label>
                    <p className="text-xs leading-5 text-muted-foreground sm:col-span-2">
                      ระบบนับรวมวันเริ่มต้นและวันสิ้นสุดตามเวลาไทย เว้นวันที่ว่างไว้หากต้องการให้แคมเปญไม่มีวันจำกัด
                    </p>
                  </div>
                </Card>

                <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)] lg:items-start">
                  <Card className="bg-white p-5 sm:p-6">
                    <div className="mb-5 flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">
                          Global fallback
                        </p>
                        <h2 className="mt-1 text-xl font-bold tracking-tight">
                          Customer credit pricing
                        </h2>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          ใช้เมื่อ model ยังไม่มี rule เฉพาะ โดยค่าที่แก้ราย
                          model ด้านล่างจะ override ส่วนนี้
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Coins className="text-primary" size={22} />
                        <Button
                          size="sm"
                          variant={globalDirty ? "default" : "outline"}
                          onClick={() => void saveGlobalFallback()}
                          disabled={!globalDirty || savingKey !== "" || loading}
                        >
                          {savingKey === "defaults" ? <LoaderCircle size={13} className="animate-spin" /> : <Save size={13} />}
                          {savingKey === "defaults" ? "Saving…" : "Save fallback"}
                        </Button>
                      </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <NumberField
                        label="Credit bundle"
                        value={bundleCredits}
                        suffix="credits"
                        onChange={setBundleCredits}
                        help="จำนวน credit ใน package อ้างอิง"
                      />
                      <NumberField
                        label="Bundle price"
                        value={bundlePrice}
                        suffix="THB"
                        onChange={setBundlePrice}
                        help="ราคาที่ผู้ใช้จ่ายจริง"
                      />
                      <NumberField
                        label="Target markup"
                        value={marginPercent}
                        suffix="%"
                        max={MAX_TARGET_MARKUP_PERCENT}
                        step={0.01}
                        onChange={(value) => {
                          setMarginPercent(value);
                          setGlobalDirty(true);
                        }}
                        help="คิด markup จากต้นทุน: 100% = กำไรเท่ากับต้นทุน"
                      />
                      <NumberField
                        label="Fixed cost"
                        value={fixedCost}
                        suffix="THB"
                        onChange={(value) => {
                          setFixedCost(value);
                          setGlobalDirty(true);
                        }}
                        help="ค่าใช้จ่ายคงที่ต่อ generation"
                      />
                      <NumberField
                        label="Smart Enhance price"
                        value={smartEnhancePrice}
                        suffix="THB / run"
                        onChange={(value) => {
                          setSmartEnhancePrice(value);
                          setGlobalDirty(true);
                        }}
                        help="คิดเพิ่มเมื่อเปิด Smart Enhance โดยคิด 1 ครั้งต่อ generation"
                      />
                      <NumberField
                        label="USD / THB rate"
                        value={fxRate}
                        suffix="THB"
                        onChange={setFxRate}
                        help="อัตราที่ใช้ใน pricing window ปัจจุบัน"
                      />
                      <NumberField
                        label="Minimum charge"
                        value={minimumCredits}
                        suffix="credit"
                        onChange={(value) => {
                          setMinimumCredits(value);
                          setGlobalDirty(true);
                        }}
                        help="ราคาขั้นต่ำต่อ generation"
                      />
                    </div>
                    <div className="mt-5 rounded-2xl border border-[#eaded6] bg-[#fffaf7] p-4">
                      <div className="flex items-start gap-3">
                        <Info
                          className="mt-0.5 shrink-0 text-primary"
                          size={16}
                        />
                        <div>
                          <p className="text-xs font-bold">Pricing formula</p>
                          <p className="mt-1 font-mono text-[11px] leading-6 text-muted-foreground">
                            selling price = (provider cost × FX + fixed cost) ×
                            (1 + markup)
                            <br />
                            Smart Enhance = เพิ่มตามราคาที่ตั้งไว้ เมื่อเปิดใช้งาน
                            <br />
                            credits = ceil(selling price ÷ credit value)
                          </p>
                        </div>
                      </div>
                    </div>
                  </Card>

                  <Card className="overflow-hidden bg-[#201d1b] text-white">
                    <div className="border-b border-white/10 p-5 sm:p-6">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#ffb38b]">
                            Global fallback preview
                          </p>
                          <h2 className="mt-1 text-xl font-bold tracking-tight">
                            Fallback · one generation
                          </h2>
                          <p className="mt-1 text-xs leading-5 text-white/60">
                            ใช้เมื่อยังไม่มี provider quote ของ model นั้น
                            ส่วนตารางด้านล่างใช้ราคาของแต่ละ model
                          </p>
                        </div>
                        <RefreshCw size={19} className="text-[#ffb38b]" />
                      </div>
                      <div className="mt-5 rounded-2xl bg-white/10 p-4">
                        <div className="flex items-end justify-between gap-4">
                          <div>
                            <p className="text-[11px] text-white/60">
                              Provider cost
                            </p>
                            <p className="mt-1 text-2xl font-bold">
                              ${rule.providerUsd.toFixed(3)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-[11px] text-white/60">
                              Model input
                            </p>
                            <p className="mt-1 text-xs font-semibold">
                              1 generation · provider default input
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-4 p-5 sm:p-6">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-white/60">
                          Provider cost in THB
                        </span>
                        <strong>฿{rule.providerThb.toFixed(2)}</strong>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-white/60">
                          Price before rounding
                        </span>
                        <strong>฿{rule.sellingBeforeRound.toFixed(2)}</strong>
                      </div>
                      <div className="flex items-center justify-between border-t border-white/10 pt-4">
                        <span className="font-semibold">Customer pays</span>
                        <strong className="text-2xl text-[#ffb38b]">
                          {rule.chargedCredits} credits
                        </strong>
                      </div>
                      <div className="flex items-center justify-between rounded-xl bg-[#2e2926] px-3 py-2 text-xs">
                        <span className="text-white/60">Selling value</span>
                        <strong>
                          ฿{rule.chargedThb.toFixed(2)} · profit ฿
                          {rule.profit.toFixed(2)}
                        </strong>
                      </div>
                      <p className="text-[11px] leading-5 text-white/50">
                        ราคาจริงจะถูก snapshot ตอนสร้าง generation
                        และใช้ราคาเดิมตอน worker ทำงาน
                      </p>
                    </div>
                  </Card>
                </div>

                <section
                  className="mt-4 overflow-hidden rounded-2xl border border-border bg-white"
                  aria-labelledby="model-pricing-heading"
                >
                  <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary">
                        Per-model overrides
                      </p>
                      <h2
                        id="model-pricing-heading"
                        className="mt-0.5 text-lg font-bold tracking-tight"
                      >
                        Model rules
                      </h2>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        ตั้งค่า markup และตัวแปรราคาแยกตาม model
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone="success">
                        {loading
                          ? "Loading…"
                          : `${filteredModelRows.length}${hasActiveFilters ? ` / ${modelRows.length}` : ""} models`}
                      </Badge>
                      {quotesLoading ? (
                        <LoaderCircle
                          size={14}
                          className="animate-spin text-primary"
                        />
                      ) : null}
                      {savingKey === "all" ? (
                        <LoaderCircle
                          size={14}
                          className="animate-spin text-primary"
                        />
                      ) : null}
                    </div>
                  </div>
                  <div className="border-b border-border bg-[#fffaf7] px-4 py-2 text-[10px] text-muted-foreground sm:px-5">
                    ต้นทุนและกำไรอิงค่าเริ่มต้นของแต่ละ model · กด Configure
                    เพื่อเปลี่ยนตัวแปรและดูราคาใหม่
                  </div>
                  <div className="flex flex-wrap items-end gap-2 border-b border-border bg-white px-4 py-3 sm:px-5">
                    <label className="min-w-[130px] flex-1 sm:flex-none">
                      <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                        Type
                      </span>
                      <select
                        aria-label="Filter by type"
                        value={categoryFilter}
                        onChange={(event) =>
                          setCategoryFilter(
                            event.target.value as PricingCategoryFilter,
                          )
                        }
                        className="h-8 w-full rounded-lg border border-border bg-[#fcfaf8] px-2 text-xs font-semibold outline-none focus:border-primary focus:ring-3 focus:ring-primary/10"
                      >
                        <option value="all">All types</option>
                        <option value="image">Image</option>
                        <option value="video">Video</option>
                        <option value="audio">Audio</option>
                        <option value="document">Document</option>
                        <option value="presenter">AI Presenter</option>
                      </select>
                    </label>
                    <label className="min-w-[170px] flex-1 sm:flex-none">
                      <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                        Feature
                      </span>
                      <select
                        aria-label="Filter by feature"
                        value={selectedFeatureFilter}
                        onChange={(event) =>
                          setFeatureFilter(event.target.value)
                        }
                        className="h-8 w-full rounded-lg border border-border bg-[#fcfaf8] px-2 text-xs font-semibold outline-none focus:border-primary focus:ring-3 focus:ring-primary/10"
                      >
                        <option value="all">All features</option>
                        {availableFeatureKeys.map((featureKey) => (
                          <option key={featureKey} value={featureKey}>
                            {featureLabels[featureKey] ?? featureKey}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="min-w-[220px] flex-1">
                      <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                        Search
                      </span>
                      <SearchInput size="compact" aria-label="Search models" value={modelSearch} onValueChange={setModelSearch} placeholder="Model or provider" />
                    </label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 px-2 text-[10px]"
                      onClick={() => {
                        setCategoryFilter("all");
                        setFeatureFilter("all");
                        setModelSearch("");
                      }}
                      disabled={!hasActiveFilters}
                    >
                      Clear
                    </Button>
                  </div>
                  <div className="overflow-hidden">
                    <table className="w-full table-fixed text-left text-[11px]">
                      <colgroup>
                        <col className="w-[24%]" />
                        <col className="w-[12%]" />
                        <col className="w-[12%]" />
                        <col className="w-[11%]" />
                        <col className="w-[8%]" />
                        <col className="w-[7%]" />
                        <col className="w-[16%]" />
                        <col className="w-[10%]" />
                      </colgroup>
                      <thead className="bg-[#fcfaf8] text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2">Feature / model</th>
                          <th className="px-3 py-2">Provider cost</th>
                          <th className="px-3 py-2">Profit</th>
                          <th className="px-3 py-2">Target markup</th>
                          <th className="px-3 py-2">Fixed cost</th>
                          <th className="px-3 py-2">Minimum</th>
                          <th className="px-3 py-2">Prompt add-ons</th>
                          <th className="px-3 py-2 text-right">Rule</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredModelRows.length ? (
                          filteredModelRows.map((row) => {
                            const key = rowKey(row);
                            const draft = draftFor(row);
                            const existing = ruleFor(row);
                            const dirty = Boolean(draft.dirty);
                            const fields = pricingProperties(row);
                            const addonCount = promptAddonVariableCount(
                              draft.promptAddonsJson,
                            );
                            const rawPreview = quotes[key];
                            const preview = previewWithDraft(
                              rawPreview,
                              draft,
                              rule.creditValue,
                              roundingDecimals,
                            );
                            const previewLoading = quotesLoading && !preview;
                            const unavailable =
                              !previewLoading && preview?.status !== "ready";
                            return (
                              <tr
                                key={key}
                                className="border-t border-border align-top"
                              >
                                <td className="px-3 py-2">
                                  <p
                                    className="truncate font-semibold text-[11px]"
                                    title={`${row.feature} · ${row.displayName}`}
                                  >
                                    {row.feature}{" "}
                                    <span className="font-normal text-muted-foreground">
                                      · {row.displayName}
                                    </span>
                                    {fields.length ? (
                                      <span className="ml-1 rounded-full bg-[#fff0e9] px-1.5 py-0.5 text-[9px] font-bold text-primary">
                                        Variable · {fields.length}
                                      </span>
                                    ) : (
                                      <span className="ml-1 rounded-full bg-[#f2ece7] px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground">
                                        Fixed
                                      </span>
                                    )}
                                  </p>
                                  <p className="mt-0.5 break-all font-mono text-[9px] leading-3 text-muted-foreground">
                                    {row.provider} · {row.model}
                                  </p>
                                  {(documentFeatureKeys.has(row.featureKey) || presenterFeatureKeys.has(row.featureKey)) ? (
                                    <p className="mt-1 text-[9px] leading-3 text-muted-foreground" title={row.note}>
                                      {row.note}
                                    </p>
                                  ) : null}
                                </td>
                                <td className="px-3 py-2">
                                  {previewLoading ? (
                                    <p className="font-semibold text-primary">
                                      Loading…
                                    </p>
                                  ) : preview?.status === "ready" ? (
                                    <>
                                      <p className="font-semibold text-primary">
                                        {formatMetric(preview.costCredits)}{" "}
                                        credit
                                      </p>
                                      <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                                        ฿{formatMetric(preview.providerCostThb)}
                                        {preview.providerCostUsd !== undefined ? ` · $${formatMetric(preview.providerCostUsd, 4)}` : ""}
                                      </p>
                                    </>
                                  ) : preview?.status === "internal" ? (
                                    <>
                                      <p className="font-semibold text-muted-foreground">
                                        Internal
                                      </p>
                                      <p
                                        className="mt-0.5 text-[9px] text-muted-foreground"
                                        title={preview.message}
                                      >
                                        No provider charge
                                      </p>
                                    </>
                                  ) : (
                                    <>
                                      <p className="font-semibold">—</p>
                                      {unavailable ? (
                                        <p
                                          className="mt-0.5 text-[9px] text-muted-foreground"
                                          title={preview?.message}
                                        >
                                          Unavailable
                                        </p>
                                      ) : null}
                                    </>
                                  )}
                                </td>
                                <td className="px-3 py-2">
                                  {previewLoading ? (
                                    <p className="font-semibold text-[#347454]">
                                      Loading…
                                    </p>
                                  ) : preview?.status === "ready" ? (
                                    <>
                                      <p className="font-semibold text-[#347454]">
                                        {formatMetric(preview.profitCredits)}{" "}
                                        credit
                                      </p>
                                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                                        ฿{formatMetric(preview.profitThb)}
                                      </p>
                                    </>
                                  ) : (
                                    <p className="font-semibold text-[#347454]">
                                      —
                                    </p>
                                  )}
                                </td>
                                <td className="px-3 py-2">
                                  <label
                                    className="sr-only"
                                    htmlFor={`${key}-margin`}
                                  >
                                    Target markup for {row.model}
                                  </label>
                                  <div className="relative">
                                    <input
                                      id={`${key}-margin`}
                                      type="number"
                                      min="0"
                                      max={MAX_TARGET_MARKUP_PERCENT}
                                      step="0.01"
                                      value={draft.targetMargin}
                                      onChange={(event) =>
                                        updateDraft(row, {
                                          targetMargin: event.target.value,
                                        })
                                      }
                                      className="h-8 w-full rounded-lg border border-border bg-[#fcfaf8] px-2 pr-6 text-xs font-semibold outline-none focus:border-primary focus:ring-3 focus:ring-primary/10"
                                    />
                                    <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                                      %
                                    </span>
                                  </div>
                                </td>
                                <td className="px-3 py-2">
                                  <label
                                    className="sr-only"
                                    htmlFor={`${key}-fixed`}
                                  >
                                    Fixed cost for {row.model}
                                  </label>
                                  <div className="relative">
                                    <input
                                      id={`${key}-fixed`}
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={draft.fixedCostThb}
                                      onChange={(event) =>
                                        updateDraft(row, {
                                          fixedCostThb: event.target.value,
                                        })
                                      }
                                      className="h-8 w-full rounded-lg border border-border bg-[#fcfaf8] px-2 pr-5 text-xs font-semibold outline-none focus:border-primary focus:ring-3 focus:ring-primary/10"
                                    />
                                    <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                                      ฿
                                    </span>
                                  </div>
                                </td>
                                <td className="px-3 py-2">
                                  <label
                                    className="sr-only"
                                    htmlFor={`${key}-minimum`}
                                  >
                                    Minimum credits for {row.model}
                                  </label>
                                  <input
                                    id={`${key}-minimum`}
                                    type="number"
                                    min="1"
                                    step="1"
                                    value={draft.minimumCreditCost}
                                    onChange={(event) =>
                                      updateDraft(row, {
                                        minimumCreditCost: event.target.value,
                                      })
                                    }
                                    className="h-8 w-full rounded-lg border border-border bg-[#fcfaf8] px-2 text-xs font-semibold outline-none focus:border-primary focus:ring-3 focus:ring-primary/10"
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  <button
                                    type="button"
                                    onClick={() => setOpenAddonKey(key)}
                                    className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-[#f1c5b5] bg-[#fffaf7] px-2 text-[10px] font-bold text-primary transition hover:border-primary hover:bg-[#fff0e9]"
                                  >
                                    <Plus size={13} />
                                    {addonCount ? "Edit add-ons" : "Add add-on"}
                                  </button>
                                  <p className="mt-1 text-center text-[9px] leading-3 text-muted-foreground">
                                    {addonCount
                                      ? `${addonCount} variable(s) · THB/image`
                                      : "No add-ons configured"}
                                  </p>
                                </td>
                                <td className="px-3 py-2 text-right">
                                  <div className="flex flex-wrap items-center justify-end gap-1">
                                    {existing ? (
                                      <Badge
                                        tone={
                                          existing.featureKey
                                            ? "success"
                                            : "warning"
                                        }
                                      >
                                        {existing.featureKey
                                          ? "Override"
                                          : "Global"}
                                      </Badge>
                                    ) : (
                                      <Badge>Global</Badge>
                                    )}
                                    {fields.length ? (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-7 px-1.5 text-[10px]"
                                        onClick={() => toggleConfigure(row)}
                                      >
                                        <SlidersHorizontal size={12} />{" "}
                                        {openConfigKey === key
                                          ? "Close"
                                          : "Configure"}
                                      </Button>
                                    ) : null}
                                    <Button
                                      size="sm"
                                      variant={dirty ? "default" : "outline"}
                                      className="h-7 px-1.5 text-[10px]"
                                      onClick={() => void saveRows([row])}
                                      disabled={!dirty || savingKey !== "" || documentFeatureKeys.has(row.featureKey)}
                                      title={documentFeatureKeys.has(row.featureKey) ? "Preview only; Document uses its existing fixed-credit billing" : "Save pricing rule"}
                                    >
                                      {savingKey === "all" ? (
                                        <LoaderCircle
                                          size={12}
                                          className="animate-spin"
                                        />
                                      ) : (
                                        <Save size={12} />
                                      )}{" "}
                                      Save
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td
                              colSpan={8}
                              className="px-4 py-12 text-center text-xs text-muted-foreground"
                            >
                              No models match these filters.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
                {addonRow && addonDraft ? (
                  <PromptAddonsDialog
                    key={rowKey(addonRow)}
                    row={addonRow}
                    value={addonDraft.promptAddonsJson}
                    onApply={(nextValue) => {
                      updateDraft(addonRow, { promptAddonsJson: nextValue });
                      setOpenAddonKey("");
                    }}
                    onClose={() => setOpenAddonKey("")}
                  />
                ) : null}
                {configuredRow ? (
                  <PricingVariablesPanel
                    row={configuredRow}
                    values={configuredValues}
                    preview={configuredPreview}
                    loading={
                      (quotesLoading && !quotes[openConfigKey]) ||
                      scenarioLoadingKey === openConfigKey
                    }
                    onChange={(name, value) =>
                      updateScenarioValue(configuredRow, name, value)
                    }
                    onClose={() => setOpenConfigKey("")}
                  />
                ) : null}

                <div className="mt-5 flex items-start gap-3 rounded-2xl border border-[#eaded6] bg-[#fffdfb] p-4 text-xs text-muted-foreground">
                  <Info className="mt-0.5 shrink-0 text-primary" size={16} />
                  <p>
                    <strong className="text-foreground">วิธีเลือกกฎ:</strong>{" "}
                    ระบบจะหา rule ที่ตรงกับ{" "}
                    <code className="rounded bg-[#f2ece7] px-1 py-0.5 text-[11px]">
                      provider + model + feature
                    </code>{" "}
                    ก่อน ถ้าไม่มีจะใช้ rule ของ model และสุดท้ายจึงใช้ global
                    fallback จาก environment เช่น{" "}
                    <code className="rounded bg-[#f2ece7] px-1 py-0.5 text-[11px]">
                      CREDIT_TARGET_MARGIN
                    </code>{" "}
                    และ{" "}
                    <code className="rounded bg-[#f2ece7] px-1 py-0.5 text-[11px]">
                      USD_THB_RATE
                    </code>
                  </p>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

export default function AdminCreditsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <AdminCreditsContent />
    </Suspense>
  );
}
