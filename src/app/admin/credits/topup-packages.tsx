"use client";

import { useEffect, useState } from "react";
import {
  getAdminBillingSettings,
  getAdminTopups,
  saveAdminBillingSettings,
  saveAdminTopups,
  type TopupPackage,
} from "@/lib/api/credit-pricing";
import { calculateVat } from "@/features/usage/usage-utils";

export function TopupPackages() {
  const [rows, setRows] = useState<TopupPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [vatPercent, setVatPercent] = useState("7");
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [vatSaving, setVatSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [vatError, setVatError] = useState("");
  const [vatMessage, setVatMessage] = useState("");
  useEffect(() => {
    let active = true;
    Promise.all([getAdminTopups(), getAdminBillingSettings()])
      .then(([data, settings]) => {
        if (!active) return;
        setRows(data);
        setVatPercent(String(settings.vatPercent));
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : "โหลดข้อมูลราคาไม่สำเร็จ");
      })
      .finally(() => {
        if (active) {
          setLoading(false);
          setSettingsLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);
  const edit = (id: string, patch: Partial<TopupPackage>) => {
    setMessage("");
    setRows((items) => items.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };
  const parsedVat = Number(vatPercent);
  const vatValid = Number.isFinite(parsedVat) && parsedVat >= 0 && parsedVat <= 100;
  return (
    <section className="mb-6 rounded-2xl border border-orange-100 bg-white p-5" data-no-translate>
      <h2 className="text-lg font-bold">แพ็กเกจเติมเครดิต</h2>
      <p className="mt-1 text-sm text-muted-foreground">1 บาท = 10 เครดิต · ราคาด้านล่างเป็นราคาก่อน VAT</p>
      <form
        className="mt-4 rounded-xl border border-orange-100 bg-orange-50/40 p-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!vatValid) {
            setVatError("VAT ต้องอยู่ระหว่าง 0–100%");
            return;
          }
          setVatSaving(true);
          setVatError("");
          setVatMessage("");
          try {
            const saved = await saveAdminBillingSettings({ vatPercent: Math.round(parsedVat * 100) / 100 });
            setVatPercent(String(saved.vatPercent));
            setVatMessage("บันทึก VAT แล้ว");
          } catch (reason) {
            setVatError(reason instanceof Error ? reason.message : "บันทึก VAT ไม่สำเร็จ");
          } finally {
            setVatSaving(false);
          }
        }}
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <label className="text-sm font-semibold">
            VAT (%)
            <input
              required
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={vatPercent}
              disabled={settingsLoading || vatSaving}
              onChange={(e) => {
                setVatPercent(e.target.value);
                setVatError("");
                setVatMessage("");
              }}
              className="mt-1 block h-10 w-36 rounded-lg border bg-white px-3"
            />
          </label>
          <p className="text-sm text-muted-foreground">
            ลูกค้าจะชำระราคาก่อน VAT + VAT ตามค่านี้ เช่น 100 บาท →{" "}
            {vatValid ? calculateVat(100, parsedVat).totalThb : "—"} บาท
          </p>
          <button
            disabled={settingsLoading || vatSaving || !vatValid}
            className="rounded-lg bg-orange-600 px-4 py-2 font-bold text-white disabled:opacity-40"
          >
            {vatSaving ? "กำลังบันทึก..." : "บันทึก VAT"}
          </button>
        </div>
        {vatError && (
          <p role="alert" className="mt-3 text-sm text-red-600">
            {vatError}
          </p>
        )}
        {vatMessage && (
          <p role="status" className="mt-3 text-sm text-green-700">
            {vatMessage}
          </p>
        )}
      </form>
      {loading ? (
        <p role="status">กำลังโหลดแพ็กเกจ...</p>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setSaving(true);
            setError("");
            setMessage("");
            try {
              setRows(await saveAdminTopups(rows));
              setMessage("บันทึกแพ็กเกจแล้ว");
            } catch (reason) {
              setError(reason instanceof Error ? reason.message : "บันทึกไม่สำเร็จ");
            } finally {
              setSaving(false);
            }
          }}
        >
          <fieldset disabled={saving} className="mt-4 space-y-3">
            {rows.map((row) => (
              <div
                key={row.id}
                className="grid items-end gap-3 rounded-xl border p-3 sm:grid-cols-[2fr_1fr_1fr_1fr_auto_auto]"
              >
                <label className="text-sm">
                  ชื่อแพ็กเกจ
                  <input
                    required
                    maxLength={80}
                    value={row.label}
                    onChange={(e) => edit(row.id, { label: e.target.value })}
                    className="mt-1 block h-10 w-full rounded-lg border px-3"
                  />
                </label>
                <label className="text-sm">
                  ราคา (ก่อน VAT)
                  <input
                    required
                    type="number"
                    min={10}
                    max={100000}
                    step={1}
                    value={row.amountThb || ""}
                    onChange={(e) =>
                      edit(row.id, { amountThb: Number(e.target.value), credits: Number(e.target.value) * 10 })
                    }
                    className="mt-1 block h-10 w-full rounded-lg border px-3"
                  />
                </label>
                <p className="py-2 text-sm font-bold text-orange-600">{(row.amountThb * 10).toLocaleString()} เครดิต</p>
                <p className="py-2 text-sm font-bold text-pink-600">
                  รวม VAT{" "}
                  {vatValid
                    ? calculateVat(row.amountThb, parsedVat).totalThb.toLocaleString("th-TH", {
                        maximumFractionDigits: 2,
                      })
                    : "—"}{" "}
                  บาท
                </p>
                <label className="py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={!!row.featured}
                    onChange={(e) => edit(row.id, { featured: e.target.checked })}
                  />{" "}
                  แนะนำ
                </label>
                <button
                  type="button"
                  aria-label={`ลบแพ็กเกจ ${row.label}`}
                  disabled={rows.length <= 1}
                  className="h-10 rounded-lg border px-3 text-red-600 disabled:opacity-40"
                  onClick={() => {
                    setRows((items) => items.filter((item) => item.id !== row.id));
                    setMessage("");
                  }}
                >
                  ลบ
                </button>
              </div>
            ))}
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                disabled={rows.length >= 20}
                className="rounded-lg border px-4 py-2 disabled:opacity-40"
                onClick={() => {
                  setRows((items) => [
                    ...items,
                    { id: `topup_${crypto.randomUUID()}`, label: "แพ็กเกจใหม่", amountThb: 100, credits: 1000 },
                  ]);
                  setMessage("");
                }}
              >
                + เพิ่มแพ็กเกจ
              </button>
              <button
                disabled={!rows.length}
                className="rounded-lg bg-orange-600 px-4 py-2 font-bold text-white disabled:opacity-40"
              >
                {saving ? "กำลังบันทึก..." : "บันทึกแพ็กเกจ"}
              </button>
            </div>
          </fieldset>
        </form>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="mt-3 text-sm text-green-700">
          {message}
        </p>
      )}
    </section>
  );
}
