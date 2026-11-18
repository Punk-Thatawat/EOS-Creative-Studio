"use client";

import { useEffect, useRef, useState } from "react";
import { Check, HardDrive, LoaderCircle, RefreshCw, Save } from "lucide-react";
import { AppShell } from "@/components/app-shell/app-shell";
import { Button } from "@/components/ui/button";
import { brandKitApi, type BrandKitSettings } from "@/lib/api/brand-kit";
import { useLocale } from "@/lib/i18n/locale-provider";
import s from "./brand-kit-page.module.css";

export function AdminBrandKitPage() {
  const { locale } = useLocale();
  const th = locale === "th";
  const [settings, setSettings] = useState<BrandKitSettings | null>(null);
  const [quotaText, setQuotaText] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void brandKitApi
      .loadSettings(controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) {
          setSettings(value);
          setQuotaText(String(value.quotaMb));
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setError("load");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  const quota = Number(quotaText);
  const valid =
    settings &&
    quotaText.trim() !== "" &&
    Number.isInteger(quota) &&
    quota >= settings.minQuotaMb &&
    quota <= settings.maxQuotaMb;
  const changed = settings && quota !== settings.quotaMb;
  async function perform(save: boolean) {
    if (lock.current || (save && !valid)) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      const value = save ? await brandKitApi.saveSettings(quota) : await brandKitApi.loadSettings();
      setSettings(value);
      setQuotaText(String(value.quotaMb));
      setSaved(save);
    } catch {
      setError(save ? "save" : "load");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <div className={`${s.page} mx-auto max-w-4xl`}>
        <header className={s.header}>
          <div>
            <span className={s.eyebrow}>ADMIN · BRAND KIT</span>
            <h1>{th ? "พื้นที่จัดเก็บ Brand Kit" : "Brand Kit storage"}</h1>
            <p>
              {th
                ? "กำหนดโควตารวมสำหรับโลโก้และรูปสินค้า ต่อบัญชีสมาชิก"
                : "Set the shared logo and product image quota for each member account."}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={loading || busy}
            onClick={() => {
              void perform(false);
            }}
          >
            <RefreshCw size={16} />
            {th ? "โหลดใหม่" : "Refresh"}
          </Button>
        </header>
        {loading ? (
          <p role="status" className={s.loading}>
            <LoaderCircle className="animate-spin" />
            {th ? "กำลังโหลดการตั้งค่า…" : "Loading settings…"}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className={s.error}>
            {th
              ? "ทำรายการไม่สำเร็จ กรุณาโหลดข้อมูลใหม่แล้วลองอีกครั้ง"
              : "Unable to complete this action. Refresh and try again."}
            {!settings ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  void perform(false);
                }}
              >
                {th ? "ลองอีกครั้ง" : "Try again"}
              </Button>
            ) : null}
          </p>
        ) : null}
        <div role="status" aria-live="polite">
          {saved ? (
            <p className={s.notice}>
              <Check size={17} />
              {th
                ? "บันทึกแล้ว โควตาใหม่มีผลกับสมาชิกทุกบัญชี และแสดงเมื่อสมาชิกโหลดข้อมูลใหม่"
                : "Saved. The quota now applies to all accounts and appears when members refresh their kit."}
            </p>
          ) : null}
        </div>
        {settings ? (
          <section className={s.card} aria-labelledby="quota-heading">
            <div className={s.sectionHead}>
              <div>
                <h2 id="quota-heading">
                  <HardDrive size={20} />
                  {th ? "โควตาพื้นที่ต่อบัญชี" : "Storage per account"}
                </h2>
                <p>
                  {th
                    ? `ใช้ค่าเดียวกันกับสมาชิกทุกบัญชี ตั้งได้ ${settings.minQuotaMb}–${settings.maxQuotaMb} MB`
                    : `Applies to all accounts. Choose ${settings.minQuotaMb}–${settings.maxQuotaMb} MB.`}
                </p>
              </div>
            </div>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void perform(true);
              }}
            >
              <label htmlFor="brand-quota-mb" className="mb-2 block text-sm font-semibold">
                {th ? "พื้นที่จัดเก็บ (MB)" : "Storage quota (MB)"}
              </label>
              <div className="flex max-w-xs items-center gap-3">
                <input
                  id="brand-quota-mb"
                  type="number"
                  inputMode="numeric"
                  min={settings.minQuotaMb}
                  max={settings.maxQuotaMb}
                  step={1}
                  required
                  value={quotaText}
                  disabled={busy}
                  onChange={(event) => {
                    setQuotaText(event.target.value);
                    setSaved(false);
                  }}
                  aria-invalid={!valid}
                  aria-describedby="brand-quota-help"
                  className="min-w-0 flex-1 rounded-xl border border-border bg-background px-4 py-3 text-lg font-semibold outline-offset-2"
                />
                <span className="font-semibold text-muted-foreground">MB</span>
              </div>
              <p id="brand-quota-help" className="mt-3 text-xs leading-6 text-muted-foreground">
                {th
                  ? "นับจากขนาดภาพหลังย่อรวมกัน ไม่ใช่ขนาดต่อไฟล์ · 1 MB = 1,024 × 1,024 ไบต์"
                  : "Measured from total optimized image bytes, not per file. 1 MB = 1,024 × 1,024 bytes."}
              </p>
              {!valid ? (
                <p role="alert" className={s.validation}>
                  {th
                    ? `กรอกจำนวนเต็มตั้งแต่ ${settings.minQuotaMb} ถึง ${settings.maxQuotaMb}`
                    : `Enter a whole number between ${settings.minQuotaMb} and ${settings.maxQuotaMb}.`}
                </p>
              ) : null}
              <div className="mt-6 rounded-xl border border-orange-100 bg-orange-50 p-4 text-sm leading-7 text-foreground">
                <strong>{th ? "เมื่อลดโควตา" : "When lowering the quota"}</strong>
                <p>
                  {th
                    ? "รูปที่สมาชิกมีอยู่จะไม่ถูกลบ หากใช้พื้นที่เกินค่าใหม่ จะอัปโหลดเพิ่มไม่ได้จนกว่าจะลบรูปให้มีพื้นที่เพียงพอ"
                    : "Existing images are kept. Accounts above the new quota cannot upload more until enough storage is freed."}
                </p>
              </div>
              <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
                <span className="text-sm text-muted-foreground">
                  {th ? "ค่าที่บันทึกอยู่:" : "Currently saved:"}{" "}
                  <strong className="text-foreground">{settings.quotaMb} MB</strong>
                </span>
                <Button type="submit" disabled={busy || !valid || !changed}>
                  {busy ? <LoaderCircle size={16} className="animate-spin" /> : <Save size={16} />}
                  {th ? "บันทึกโควตา" : "Save quota"}
                </Button>
              </div>
            </form>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
