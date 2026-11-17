import { RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { type CreditsPricingAdmin } from "./use-credits-pricing-admin";

export function PricingPreviewCard({ pricing }: { pricing: CreditsPricingAdmin }) {
  const {
    rule,
  } = pricing;

  return (
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
  );
}
