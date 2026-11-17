import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  featureOrder,
} from "./pricing.constants";
import {
  audioPricingRows,
  documentOcrPricingRows,
  matchesPricingCategory,
  modelRowsFromOverview,
  previewPricingRowsInBatches,
  rowKey,
} from "./pricing-rows";
import { previewWithDraft } from "./pricing-preview";
import { cleanScenarioValues, defaultScenarioValues } from "./pricing-parameters";
import { parsePromptAddonsJson, promptAddonsJson } from "./prompt-addons";

export function useCreditsPricingAdmin() {
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

  return {
    bundleCredits,
    setBundleCredits,
    bundlePrice,
    setBundlePrice,
    marginPercent,
    setMarginPercent,
    fxRate,
    setFxRate,
    roundingDecimals,
    fixedCost,
    setFixedCost,
    smartEnhancePrice,
    setSmartEnhancePrice,
    minimumCredits,
    setMinimumCredits,
    rateSource,
    rateUpdatedAt,
    rateStale,
    modelRows,
    quotes,
    quotesLoading,
    openConfigKey,
    setOpenConfigKey,
    setOpenAddonKey,
    scenarioLoadingKey,
    loading,
    savingKey,
    globalDirty,
    setGlobalDirty,
    saved,
    error,
    categoryFilter,
    setCategoryFilter,
    setFeatureFilter,
    modelSearch,
    setModelSearch,
    signupBonusEnabled,
    setSignupBonusEnabled,
    signupBonusCredits,
    setSignupBonusCredits,
    signupBonusStartDate,
    setSignupBonusStartDate,
    signupBonusEndDate,
    setSignupBonusEndDate,
    signupBonusDirty,
    setSignupBonusDirty,
    load,
    ruleFor,
    draftFor,
    toggleConfigure,
    updateScenarioValue,
    rule,
    updateDraft,
    saveGlobalFallback,
    saveSignupBonus,
    saveRows,
    dirtyRows,
    availableFeatureKeys,
    selectedFeatureFilter,
    filteredModelRows,
    hasActiveFilters,
    configuredRow,
    addonRow,
    addonDraft,
    configuredPreview,
    configuredValues,
  };
}

export type CreditsPricingAdmin = ReturnType<typeof useCreditsPricingAdmin>;
