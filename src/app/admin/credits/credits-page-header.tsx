import { Save, Settings2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type CreditsPricingAdmin } from "./use-credits-pricing-admin";

export function CreditsPageHeader({ pricing }: { pricing: CreditsPricingAdmin }) {
  const {
    loading,
    savingKey,
    saveRows,
    dirtyRows,
  } = pricing;

  return (
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
  );
}
