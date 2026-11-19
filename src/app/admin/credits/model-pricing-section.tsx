import { SearchInput } from "@/components/ui/search-input";
import { LoaderCircle, Plus, Save, SlidersHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type PricingCategoryFilter } from "./pricing.types";
import {
  MAX_TARGET_MARKUP_PERCENT,
  documentFeatureKeys,
  featureLabels,
  presenterFeatureKeys,
} from "./pricing.constants";
import { rowKey } from "./pricing-rows";
import { formatMetric, previewWithDraft } from "./pricing-preview";
import { pricingProperties } from "./pricing-parameters";
import { promptAddonVariableCount } from "./prompt-addons";
import { type CreditsPricingAdmin } from "./use-credits-pricing-admin";

export function ModelPricingSection({ pricing }: { pricing: CreditsPricingAdmin }) {
  const {
    roundingDecimals,
    modelRows,
    quotes,
    quotesLoading,
    openConfigKey,
    setOpenAddonKey,
    loading,
    savingKey,
    categoryFilter,
    setCategoryFilter,
    setFeatureFilter,
    modelSearch,
    setModelSearch,
    ruleFor,
    draftFor,
    toggleConfigure,
    rule,
    updateDraft,
    saveRows,
    availableFeatureKeys,
    selectedFeatureFilter,
    filteredModelRows,
    hasActiveFilters,
  } = pricing;

  return (
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
  );
}
