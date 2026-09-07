"use client";
import { useEffect, useState } from "react";
import { fetchHistory, type HistoryItem, type HistoryType } from "@/lib/api/history";
import type { TemplateAdminInput } from "@/lib/api/templates";
import { templateCopy } from './template-copy';

export function GeneratedWorkPicker({ onSelect }: { onSelect: (patch: Partial<TemplateAdminInput>) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [type, setType] = useState<HistoryType>("all");
  const [offset, setOffset] = useState(0);
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState("");
  useEffect(() => {
    if (!open) return;
    let active = true;
    const timer = setTimeout(() => {
      setLoading(true); setError("");
      void fetchHistory({search, type, status:"completed", limit:12, offset}).then(result => {
        if (!active) return;
        setItems(result.items); setMore(result.pagination.hasMore);
      }).catch(() => { if (active) setError("โหลดผลงานไม่สำเร็จ กรุณาปิดแล้วเปิดใหม่"); })
        .finally(() => { if (active) setLoading(false); });
    }, 200);
    return () => { active = false; clearTimeout(timer); };
  }, [open, search, type, offset]);
  function choose(item: HistoryItem) {
    const copy = templateCopy(item.title,item.title,item.feature,item.mediaKind);
    const route = `/create/${item.mediaKind}`;
    const videoTab = ["image-to-video", "text-to-video", "people-video", "motion-transfer", "lipsync", "extend-video"].includes(item.feature) ? item.feature : "text-to-video";
    const imageTab = ["text-to-image", "image-to-image", "extend-image", "background-removal", "upscale"].includes(item.feature) ? item.feature : "text-to-image";
    onSelect({ title:copy.title.slice(0,80), description:copy.description.slice(0,240),
      kind:item.mediaKind, category:item.mediaKind, format:item.mediaKind,
      prompt:item.prompt ?? "", thumbnailUrl:item.mediaKind === "image" ? item.outputUrl! : "",
      previewUrl:item.mediaKind === "image" ? "" : item.outputUrl!,
      targetPath:route + (item.mediaKind === "audio" ? "" : `?tab=${item.mediaKind === "video" ? videoTab : imageTab}`),
      slug:`work-${item.id.replace(/[^a-zA-Z0-9-]/g,"-").toLowerCase()}`.slice(0,80),
      enabled:false,
      settings:item.settings ?? {},
    });
    setSelected(item.title); setOpen(false);
  }
  return <section data-no-translate className="rounded-2xl border border-orange-200 bg-orange-50 p-4">
    <h3 className="text-sm font-bold">เลือกจากผลงานที่เคยสร้าง</h3>
    <p className="my-2 text-xs leading-5">คัดลอกผลงานและ prompt มาเป็นฉบับร่าง ตรวจข้อมูลก่อนเปิด Published เพื่อเผยแพร่ให้ผู้ใช้เห็น ไม่เปลี่ยนงานต้นฉบับ</p>
    <button type="button" onClick={()=>setOpen(!open)} className="rounded-lg bg-white px-4 py-2 text-sm border">{open?"ปิดรายการ":"เลือกผลงานในระบบ"}</button>
    {selected && <p role="status" className="mt-2 text-xs">เลือก: {selected} · หาก prompt ว่าง งานเก่าไม่ได้เก็บข้อความต้นฉบับ กรุณาเติมเอง สำหรับวิดีโอ/เสียงให้เลือกภาพปกด้วย และตรวจว่าลิงก์ไฟล์ไม่หมดอายุก่อนเผยแพร่</p>}
    {open && <div className="mt-3 space-y-3">
      <input aria-label="ค้นหาผลงานต้นฉบับ" placeholder="ค้นหางานของบัญชีนี้" value={search} onChange={e=>{setSearch(e.target.value);setOffset(0);}} className="w-full rounded-lg border bg-white p-2 text-sm"/>
      <select aria-label="ประเภทผลงานต้นฉบับ" value={type} onChange={e=>{setType(e.target.value as HistoryType);setOffset(0);}} className="rounded-lg border bg-white p-2 text-sm"><option value="all">ทั้งหมด</option><option value="image">ภาพ</option><option value="video">วิดีโอ</option><option value="audio">เสียง</option></select>
      {loading?<p role="status">กำลังโหลด…</p>:error?<p role="alert">{error}</p>:<div className="max-h-72 overflow-y-auto space-y-2">{items.length===0?<p>ไม่พบงานที่เสร็จแล้ว</p>:items.map(item=><button type="button" key={item.source+item.id} disabled={!item.outputUrl} onClick={()=>choose(item)} className="flex w-full items-start gap-3 rounded-lg border bg-white p-3 text-left disabled:opacity-40">{item.mediaKind==="image" && item.outputUrl && <span role="img" aria-label={item.title} className="h-14 w-14 shrink-0 rounded bg-cover bg-center" style={{backgroundImage:`url(${JSON.stringify(item.outputUrl)})`}}/>}<span className="min-w-0"><b className="block line-clamp-2 text-xs">{item.title}</b><small>{item.mediaKind} · {new Date(item.createdAt).toLocaleDateString("th-TH")}</small><small className="block">{item.prompt?"มี prompt ต้นฉบับ":"ไม่มี prompt ต้นฉบับ — ต้องเติมเอง"}{!item.outputUrl?" · ไม่มีไฟล์พร้อมใช้":""}</small></span></button>)}</div>}
      <div className="flex gap-3"><button type="button" disabled={loading||offset===0} onClick={()=>setOffset(n=>Math.max(0,n-12))}>ก่อนหน้า</button><button type="button" disabled={loading||!more} onClick={()=>setOffset(n=>n+12)}>ถัดไป</button></div>
    </div>}
  </section>;
}
