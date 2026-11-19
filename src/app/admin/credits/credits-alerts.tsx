import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type CreditsPricingAdmin } from "./use-credits-pricing-admin";

export function CreditsAlerts({ pricing }: { pricing: CreditsPricingAdmin }) {
  const {
    saved,
    error,
    load,
  } = pricing;

  return (
    <>
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
    </>
  );
}
