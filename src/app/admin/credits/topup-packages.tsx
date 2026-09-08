"use client";

import { useEffect, useState } from 'react';
import { getAdminTopups, saveAdminTopups, type TopupPackage } from '@/lib/api/credit-pricing';

export function TopupPackages() {
  const [rows, setRows] = useState<TopupPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    let active = true;
    getAdminTopups().then(data => { if (active) setRows(data); }).catch(e => { if (active) setError(e instanceof Error ? e.message : 'โหลดแพ็กเกจไม่สำเร็จ'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const edit = (id: string, patch: Partial<TopupPackage>) => { setMessage(''); setRows(items => items.map(row => row.id === id ? { ...row, ...patch } : row)); };
  return <section className="mb-6 rounded-2xl border border-orange-100 bg-white p-5" data-no-translate>
    <h2 className="text-lg font-bold">แพ็กเกจเติมเครดิต</h2>
    <p className="mt-1 text-sm text-muted-foreground">1 บาท = 10 เครดิต · ตั้งราคาแล้วระบบคำนวณเครดิตอัตโนมัติ</p>
    {loading ? <p role="status">กำลังโหลดแพ็กเกจ...</p> : <form onSubmit={async e => {
      e.preventDefault(); setSaving(true); setError(''); setMessage('');
      try { setRows(await saveAdminTopups(rows)); setMessage('บันทึกแพ็กเกจแล้ว'); }
      catch (reason) { setError(reason instanceof Error ? reason.message : 'บันทึกไม่สำเร็จ'); }
      finally { setSaving(false); }
    }}>
      <fieldset disabled={saving} className="mt-4 space-y-3">
        {rows.map(row => <div key={row.id} className="grid items-end gap-3 rounded-xl border p-3 sm:grid-cols-[2fr_1fr_1fr_auto_auto]">
          <label className="text-sm">ชื่อแพ็กเกจ<input required maxLength={80} value={row.label} onChange={e => edit(row.id, { label: e.target.value })} className="mt-1 block h-10 w-full rounded-lg border px-3" /></label>
          <label className="text-sm">ราคา (บาท)<input required type="number" min={10} max={100000} step={1} value={row.amountThb || ''} onChange={e => edit(row.id, { amountThb: Number(e.target.value), credits: Number(e.target.value) * 10 })} className="mt-1 block h-10 w-full rounded-lg border px-3" /></label>
          <p className="py-2 text-sm font-bold text-orange-600">{(row.amountThb * 10).toLocaleString()} เครดิต</p>
          <label className="py-2 text-sm"><input type="checkbox" checked={!!row.featured} onChange={e => edit(row.id, { featured: e.target.checked })} /> แนะนำ</label>
          <button type="button" aria-label={`ลบแพ็กเกจ ${row.label}`} disabled={rows.length <= 1} className="h-10 rounded-lg border px-3 text-red-600 disabled:opacity-40" onClick={() => { setRows(items => items.filter(item => item.id !== row.id)); setMessage(''); }}>ลบ</button>
        </div>)}
        <div className="flex flex-wrap gap-3">
          <button type="button" disabled={rows.length >= 20} className="rounded-lg border px-4 py-2 disabled:opacity-40" onClick={() => { setRows(items => [...items, { id: `topup_${crypto.randomUUID()}`, label: 'แพ็กเกจใหม่', amountThb: 100, credits: 1000 }]); setMessage(''); }}>+ เพิ่มแพ็กเกจ</button>
          <button disabled={!rows.length} className="rounded-lg bg-orange-600 px-4 py-2 font-bold text-white disabled:opacity-40">{saving ? 'กำลังบันทึก...' : 'บันทึกแพ็กเกจ'}</button>
        </div>
      </fieldset>
    </form>}
    {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
    {message && <p role="status" className="mt-3 text-sm text-green-700">{message}</p>}
  </section>;
}
