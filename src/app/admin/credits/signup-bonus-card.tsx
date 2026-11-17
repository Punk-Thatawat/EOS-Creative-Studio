import { LoaderCircle, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { NumberField } from "./number-field";
import { type CreditsPricingAdmin } from "./use-credits-pricing-admin";

export function SignupBonusCard({ pricing }: { pricing: CreditsPricingAdmin }) {
  const {
    loading,
    savingKey,
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
    saveSignupBonus,
  } = pricing;

  return (
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
  );
}
