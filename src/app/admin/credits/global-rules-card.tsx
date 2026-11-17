import { Coins, Info, LoaderCircle, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MAX_TARGET_MARKUP_PERCENT } from "./pricing.constants";
import { NumberField } from "./number-field";
import { type CreditsPricingAdmin } from "./use-credits-pricing-admin";

export function GlobalRulesCard({ pricing }: { pricing: CreditsPricingAdmin }) {
  const {
    bundleCredits,
    setBundleCredits,
    bundlePrice,
    setBundlePrice,
    marginPercent,
    setMarginPercent,
    fxRate,
    setFxRate,
    fixedCost,
    setFixedCost,
    smartEnhancePrice,
    setSmartEnhancePrice,
    minimumCredits,
    setMinimumCredits,
    loading,
    savingKey,
    globalDirty,
    setGlobalDirty,
    saveGlobalFallback,
  } = pricing;

  return (
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
  );
}
