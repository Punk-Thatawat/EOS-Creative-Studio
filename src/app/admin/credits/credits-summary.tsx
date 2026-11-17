import { Calculator, Coins, DollarSign, Percent } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SummaryCard } from "./summary-card";
import { type CreditsPricingAdmin } from "./use-credits-pricing-admin";

export function CreditsSummary({ pricing }: { pricing: CreditsPricingAdmin }) {
  const {
    bundleCredits,
    bundlePrice,
    marginPercent,
    fxRate,
    minimumCredits,
    rateSource,
    rateUpdatedAt,
    rateStale,
    rule,
  } = pricing;

  return (
    <>
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
    </>
  );
}
