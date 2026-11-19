import { X } from "lucide-react";
import { type CreditPricingPreview } from "@/lib/api/credit-pricing";
import { type PricingProperty, type PricingRow } from "./pricing.types";
import { rowKey } from "./pricing-rows";
import { formatMetric } from "./pricing-preview";
import { pricingLabel, pricingProperties } from "./pricing-parameters";

function parsePricingValue(value: string, property: PricingProperty): unknown {
  if (property.type === "integer")
    return value === "" ? undefined : Number.parseInt(value, 10);
  if (property.type === "number")
    return value === "" ? undefined : Number(value);
  if (property.type === "boolean") return value === "true";
  return value === "" ? undefined : value;
}

export function PricingVariablesPanel({
  row,
  values,
  preview,
  loading,
  onChange,
  onClose,
}: {
  row: PricingRow;
  values: Record<string, unknown>;
  preview?: CreditPricingPreview;
  loading: boolean;
  onChange: (name: string, value: unknown) => void;
  onClose: () => void;
}) {
  const properties = pricingProperties(row);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#201d1b]/45 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${rowKey(row)}-pricing-title`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="max-h-[calc(100vh-2rem)] w-full max-w-5xl overflow-y-auto rounded-3xl border border-border bg-[#fffaf7] p-4 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary">
              Pricing inputs
            </p>
            <h3
              id={`${rowKey(row)}-pricing-title`}
              className="mt-1 text-base font-bold"
            >
              {row.displayName} · Configure
            </h3>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              เลือกเฉพาะตัวแปรที่อาจทำให้ต้นทุน Provider เปลี่ยน
              ระบบจะขอราคาใหม่อัตโนมัติเมื่อเปลี่ยนค่า
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-white hover:text-foreground"
            aria-label={`Close pricing inputs for ${row.model}`}
          >
            <X size={16} />
          </button>
        </div>
        {properties.length ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {properties.map(([name, property]) => {
              const label = pricingLabel(name, property);
              const value = values[name];
              const type =
                property.type ??
                (property.enum
                  ? "string"
                  : typeof property.default === "boolean"
                    ? "boolean"
                    : typeof property.default === "number"
                      ? "number"
                      : "string");
              if (Array.isArray(property.enum) && property.enum.length > 0)
                return (
                  <label key={name} className="block text-xs font-semibold">
                    <span className="mb-1.5 block">{label}</span>
                    <select
                      value={value === undefined ? "" : String(value)}
                      onChange={(event) =>
                        onChange(
                          name,
                          parsePricingValue(event.target.value, property),
                        )
                      }
                      className="h-10 w-full rounded-xl border border-border bg-white px-3 text-sm font-semibold outline-none focus:border-primary focus:ring-3 focus:ring-primary/10"
                    >
                      <option value="">Provider default</option>
                      {property.enum.map((option) => (
                        <option key={String(option)} value={String(option)}>
                          {String(option)}
                        </option>
                      ))}
                    </select>
                    {property.description ? (
                      <span className="mt-1 block text-[11px] font-normal leading-4 text-muted-foreground">
                        {property.description}
                      </span>
                    ) : null}
                  </label>
                );
              if (type === "boolean")
                return (
                  <label
                    key={name}
                    className="flex min-h-10 items-center gap-2 rounded-xl border border-border bg-white px-3 text-xs font-semibold"
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(value)}
                      onChange={(event) => onChange(name, event.target.checked)}
                      className="h-4 w-4 accent-primary"
                    />
                    <span>{label}</span>
                  </label>
                );
              return (
                <label key={name} className="block text-xs font-semibold">
                  <span className="mb-1.5 block">{label}</span>
                  <input
                    type={
                      type === "number" || type === "integer"
                        ? "number"
                        : "text"
                    }
                    value={value === undefined ? "" : String(value)}
                    min={property.minimum}
                    max={property.maximum}
                    step={type === "integer" ? 1 : "any"}
                    placeholder={
                      property.default === undefined
                        ? "Provider default"
                        : String(property.default)
                    }
                    onChange={(event) =>
                      onChange(
                        name,
                        parsePricingValue(event.target.value, property),
                      )
                    }
                    className="h-10 w-full rounded-xl border border-border bg-white px-3 text-sm font-semibold outline-none focus:border-primary focus:ring-3 focus:ring-primary/10"
                  />
                  {property.description ? (
                    <span className="mt-1 block text-[11px] font-normal leading-4 text-muted-foreground">
                      {property.description}
                    </span>
                  ) : null}
                </label>
              );
            })}
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-dashed border-[#d8d0ca] bg-white p-4 text-xs text-muted-foreground">
            Model นี้ไม่มีตัวแปรด้านราคา ระบบจะใช้ provider default input และ
            rule margin/fixed/minimum ของ model นี้
          </div>
        )}
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <div className="rounded-xl bg-white p-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
              Provider cost
            </p>
            <p className="mt-1 font-semibold text-primary">
              {loading
                ? "Loading…"
                : preview?.status === "ready"
                  ? `${formatMetric(preview.costCredits)} credit · ฿${formatMetric(preview.providerCostThb)}`
                  : "—"}
            </p>
          </div>
          <div className="rounded-xl bg-white p-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
              Customer charge
            </p>
            <p className="mt-1 font-semibold">
              {loading
                ? "Loading…"
                : preview?.status === "ready" &&
                    preview.creditCost !== undefined
                  ? `${formatMetric(preview.creditCost)} credit · ฿${formatMetric(preview.sellingPriceThb)}`
                  : "—"}
            </p>
          </div>
          <div className="rounded-xl bg-white p-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
              Profit
            </p>
            <p className="mt-1 font-semibold text-[#347454]">
              {loading
                ? "Loading…"
                : preview?.status === "ready"
                  ? `${formatMetric(preview.profitCredits)} credit · ฿${formatMetric(preview.profitThb)}`
                  : "—"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

