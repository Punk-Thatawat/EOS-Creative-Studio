"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AlertCircle, ArrowRight, AudioLines, Check, ChevronLeft, ChevronRight, Clock3, ExternalLink, FileClock, Image as ImageIcon, LoaderCircle, RefreshCw, Search, SlidersHorizontal, Sparkles, Video, X } from "lucide-react";
import { fetchHistory, type HistoryItem, type HistoryResponse, type HistoryStatus, type HistoryType } from "@/lib/api/history";
import { templateCopy } from "@/features/templates/template-copy";
import s from "./history-page.module.css";

const PAGE_SIZE = 24;
const types = [{ value: "all", label: "ทั้งหมด", icon: Sparkles }, { value: "image", label: "ภาพ", icon: ImageIcon }, { value: "video", label: "วิดีโอ", icon: Video }, { value: "audio", label: "เสียง", icon: AudioLines }] as const;
const statuses = { all: "ทุกสถานะ", queued: "รอคิว", processing: "กำลังสร้าง", completed: "สำเร็จ", failed: "ไม่สำเร็จ", cancelled: "ยกเลิกแล้ว" };
const features: Record<string, string> = { "text-to-image": "สร้างภาพจากข้อความ", "image-to-image": "ปรับแต่งภาพ", "style-transfer": "เปลี่ยนสไตล์", "background-removal": "พื้นหลัง AI", "extend-image": "ขยายภาพ", upscale: "เพิ่มความละเอียด", "image-to-video": "ภาพเป็นวิดีโอ", "text-to-video": "ข้อความเป็นวิดีโอ", "reference-to-video": "วิดีโอจากภาพอ้างอิง", "people-video": "พรีเซนเตอร์ AI", lipsync: "ลิปซิงก์", "motion-transfer": "ถ่ายทอดการเคลื่อนไหว", tts: "เสียงบรรยาย", dialogue: "พอดแคสต์", "voice-clone": "โคลนเสียง", "sound-effects": "เอฟเฟกต์เสียง", "audio-cleanup": "ปรับคุณภาพเสียง" };
const featureLabel = (item: HistoryItem) => features[item.feature] ?? item.feature;
const title = (item: HistoryItem) => templateCopy(item.title, "", item.feature, item.mediaKind).title || featureLabel(item);
const dateLabel = (value: string) => Number.isNaN(Date.parse(value)) ? "ไม่ระบุวันที่" : new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
function creatorHref(item: HistoryItem) {
  if (item.mediaKind !== "image") return `/create/${item.mediaKind}`;
  return `/create/image?tab=${encodeURIComponent(item.feature === "style-transfer" ? "image-to-image" : item.feature)}`;
}
function Status({ item }: { item: HistoryItem }) {
  const Icon = item.status === "completed" ? Check : item.status === "failed" ? AlertCircle : item.status === "cancelled" ? X : item.status === "queued" ? Clock3 : LoaderCircle;
  return <span className={`${s.status} ${s[item.status]}`}><Icon size={13} className={item.status === "processing" ? s.spin : undefined} />{statuses[item.status]}</span>;
}
function Media({ item, large = false }: { item: HistoryItem; large?: boolean }) {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const Icon = item.mediaKind === "image" ? ImageIcon : item.mediaKind === "video" ? Video : AudioLines;
  if (failed || !item.outputUrl) return <div className={s.mediaFallback}><Icon size={32} /><strong>{failed || item.status === "completed" ? "ยังแสดงตัวอย่างไม่ได้" : statuses[item.status]}</strong><span>{item.status === "queued" || item.status === "processing" ? "ผลงานจะแสดงเมื่อสร้างเสร็จ" : "สถานะงานยังคงเดิม"}</span>{failed && <button onClick={() => { setFailed(false); setAttempt(v => v + 1); }}>ลองโหลดใหม่</button>}</div>;
  if (item.mediaKind === "image") return <img key={attempt} src={item.outputUrl} alt={title(item)} loading="lazy" onError={() => setFailed(true)} className={large ? s.fullImage : s.cardImage} />;
  if (item.mediaKind === "video") return <video key={attempt} src={item.outputUrl} controls playsInline preload="metadata" onError={() => setFailed(true)} aria-label={`วิดีโอ ${title(item)}`} className={s.video} />;
  return <div className={s.audio}><AudioLines size={42} /><span>เสียงของไอเดียคุณ</span><audio key={attempt} src={item.outputUrl} controls preload="none" onError={() => setFailed(true)} aria-label={`เสียง ${title(item)}`} /></div>;
}
function WorkDialog({ item, close }: { item: HistoryItem; close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    dialog?.showModal(); document.body.style.overflow = "hidden";
    return () => { dialog?.close(); document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  return <dialog ref={ref} className={s.dialog} aria-labelledby="history-work-title" onCancel={close} onClick={event => { if (event.target === ref.current) close(); }}>
    <div className={s.dialogLayout}><div className={s.dialogMedia}><Media key={item.outputUrl ?? item.id} item={item} large /></div><div className={s.dialogInfo}>
      <button className={s.close} onClick={close} aria-label="ปิดตัวอย่าง" autoFocus><X size={21} /></button>
      <span className={s.eyebrow}>YOUR CREATIVE ARCHIVE</span><Status item={item} /><h2 id="history-work-title">{title(item)}</h2><p>{featureLabel(item)}</p>
      <dl><div><dt>สร้างเมื่อ</dt><dd>{dateLabel(item.createdAt)}</dd></div><div><dt>โมเดล</dt><dd>{item.model || "ไม่ระบุ"}</dd></div><div><dt>จำนวนผลงาน</dt><dd>{item.outputCount} ไฟล์{item.outputCount > 1 ? " · แสดงตัวอย่างไฟล์แรก" : ""}</dd></div>{item.creditCost != null && <div><dt>เครดิตที่ใช้</dt><dd>{item.creditCost.toLocaleString()} เครดิต</dd></div>}</dl>
      {item.errorMessage && <details className={s.errorDetails}><summary>รายละเอียดข้อผิดพลาด</summary><p>{item.errorMessage}</p></details>}
      <div className={s.dialogActions}>{item.outputUrl && <a href={item.outputUrl} target="_blank" rel="noreferrer" className={s.primary}>เปิดไฟล์ต้นฉบับ <ExternalLink size={16} /></a>}<Link href={creatorHref(item)} className={s.secondary}>ไปหน้าสร้างงาน <ArrowRight size={16} /></Link><small>เปิดดูผลงานได้โดยไม่ใช้เครดิต</small></div>
    </div></div>
  </dialog>;
}
function WorkCard({ item, open }: { item: HistoryItem; open: () => void }) {
  return <article className={s.card}><div className={s.cardMedia}><Media key={item.outputUrl ?? item.id} item={item} /><div className={s.cardBadge}><Status item={item} /></div>{item.outputCount > 1 && <span className={s.outputCount}>{item.outputCount} ไฟล์</span>}</div><div className={s.cardBody}><div className={s.feature}><span>{featureLabel(item)}</span>{item.creditCost != null && <span>{item.creditCost.toLocaleString()} เครดิต</span>}</div><button className={s.cardTitle} onClick={open}>{title(item)}</button><p className={s.model} title={item.model}>{item.model || "—"}</p><div className={s.cardFooter}><time dateTime={item.createdAt}>{dateLabel(item.createdAt)}</time><button onClick={open} aria-label={`ดูรายละเอียด ${title(item)}`}>ดูงาน <ArrowRight size={15} /></button></div></div></article>;
}
type Query = { type: HistoryType; status: HistoryStatus; search: string; offset: number };
export function HistoryPageClient() {
  const [query, setQuery] = useState<Query>({ type: "all", status: "all", search: "", offset: 0 });
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [loadedQuery, setLoadedQuery] = useState<Query | null>(null);
  const [busy, setLoading] = useState(true);
  const loading = busy && (!data || loadedQuery !== query);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [selected, setSelected] = useState<HistoryItem | null>(null);
  const results = useRef<HTMLElement>(null);
  const fetching = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    fetching.current = true;
    const timer = window.setTimeout(() => {
      setLoading(true); setError(null);
      fetchHistory({ ...query, limit: PAGE_SIZE, signal: controller.signal }).then(next => {
        if (controller.signal.aborted) return;
        if (query.offset > 0 && next.items.length === 0) { setQuery(current => ({ ...current, offset: Math.max(0, Math.ceil(next.pagination.total / PAGE_SIZE) - 1) * PAGE_SIZE })); return; }
        setData(next); setLoadedQuery(query);
      }).catch((reason: unknown) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "โหลดประวัติไม่สำเร็จ"); }).finally(() => { if (!controller.signal.aborted) { fetching.current = false; setLoading(false); } });
    }, query.search ? 250 : 0);
    return () => { controller.abort(); fetching.current = false; window.clearTimeout(timer); };
  }, [query, refresh]);
  useEffect(() => {
    const reloadOnFocus = () => { if (document.visibilityState === "visible" && !fetching.current) setRefresh(v => v + 1); };
    window.addEventListener("focus", reloadOnFocus);
    const timer = data?.summary.inProgress ? window.setInterval(reloadOnFocus, 8000) : undefined;
    return () => { window.removeEventListener("focus", reloadOnFocus); window.clearInterval(timer); };
  }, [data?.summary.inProgress]);
  const change = (patch: Partial<Query>) => { setLoading(true); setQuery(current => ({ ...current, ...patch, offset: patch.offset ?? 0 })); };
  const reset = () => change({ type: "all", status: "all", search: "" });
  const hasFilters = query.type !== "all" || query.status !== "all" || Boolean(query.search.trim());
  const count = (n?: number) => n == null || error ? "—" : n.toLocaleString();
  const summary = data?.summary;
  const page = Math.floor(query.offset / PAGE_SIZE) + 1;
  const pageCount = Math.max(1, Math.ceil((data?.pagination.total ?? 0) / PAGE_SIZE));
  const goPage = (offset: number) => { change({ offset }); results.current?.focus(); results.current?.scrollIntoView({ block: "start" }); };
  return <div className={s.page} data-no-translate data-page="history">
    <header className={s.hero}><div><span className={s.eyebrow}>EOS / YOUR CREATIVE ARCHIVE</span><h1>ทุกไอเดีย<span>มีเรื่องราว.</span></h1><p>ประวัติการสร้าง · รวมภาพ วิดีโอ และเสียงของคุณไว้ในที่เดียว</p></div></header>
    <section className={s.stats} aria-label="สรุปงานทั้งหมดในเวิร์กสเปซ"><div><FileClock size={18} /><span>งานทั้งหมด</span><strong>{count(summary?.total)}</strong></div><div><Check size={18} /><span>สำเร็จ</span><strong>{count(summary?.completed)}</strong></div><div><Clock3 size={18} /><span>กำลังดำเนินการ</span><strong>{count(summary?.inProgress)}</strong></div><div><AlertCircle size={18} /><span>ไม่สำเร็จ / ยกเลิก</span><strong>{count(summary?.failed)}</strong></div></section>
    <section className={s.library} aria-label="คลังประวัติผลงาน" ref={results} tabIndex={-1}>
      <div className={s.toolbar}><div className={s.typeFilters} role="group" aria-label="ประเภทผลงาน">{types.map(({ value, label, icon: Icon }) => <button key={value} aria-pressed={query.type === value} onClick={() => change({ type: value })}><Icon size={16} />{label}</button>)}</div><label className={s.search}><Search size={17} /><input value={query.search} onChange={event => change({ search: event.target.value })} placeholder="ค้นหาชื่อผลงานหรือโมเดล…" aria-label="ค้นหาประวัติผลงาน" />{query.search && <button onClick={() => change({ search: "" })} aria-label="ล้างคำค้นหา"><X size={16} /></button>}</label></div>
      <div className={s.resultBar}><div><h2>รายการของคุณ</h2><span role="status">{loading ? "กำลังอัปเดต…" : error ? "โหลดไม่สำเร็จ" : `${data?.pagination.total.toLocaleString() ?? 0} รายการ`}</span></div><div className={s.controls}><label><SlidersHorizontal size={15} /><span className={s.srOnly}>กรองตามสถานะ</span><select value={query.status} onChange={event => change({ status: event.target.value as HistoryStatus })}>{Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><button onClick={() => setRefresh(v => v + 1)} disabled={busy} aria-label="รีเฟรชประวัติ"><RefreshCw size={16} className={busy ? s.spin : undefined} /></button></div></div>
      {hasFilters && <div className={s.filterNotice}><span>กำลังกรอง{query.type !== "all" ? ` · ${types.find(t => t.value === query.type)?.label}` : ""}{query.status !== "all" ? ` · ${statuses[query.status]}` : ""}{query.search.trim() ? ` · “${query.search.trim()}”` : ""}</span><button onClick={reset}>ล้างตัวกรอง <X size={13} /></button></div>}
      <div aria-busy={busy}>
        {loading ? <div className={s.list} aria-label="กำลังโหลดประวัติ">{[0, 1, 2].map(i => <div className={s.skeleton} key={i}><div /><span /><span /></div>)}</div> : error ? <div className={s.empty} role="alert"><AlertCircle size={34} /><h3>โหลดประวัติไม่สำเร็จ</h3><p>{error}</p><button className={s.secondary} onClick={() => setRefresh(v => v + 1)}><RefreshCw size={16} />ลองอีกครั้ง</button></div> : data?.items.length ? <><div className={s.list}>{data.items.map(item => <WorkCard key={`${item.source}-${item.id}`} item={item} open={() => setSelected(item)} />)}</div><nav className={s.pagination} aria-label="แบ่งหน้าประวัติ"><span>แสดง {query.offset + 1}–{query.offset + data.items.length} จาก {data.pagination.total.toLocaleString()} รายการ</span><div><button disabled={query.offset === 0} onClick={() => goPage(Math.max(0, query.offset - PAGE_SIZE))} aria-label="หน้าก่อนหน้า"><ChevronLeft size={17} /></button><span>หน้า {page} / {pageCount}</span><button disabled={!data.pagination.hasMore} onClick={() => goPage(query.offset + PAGE_SIZE)} aria-label="หน้าถัดไป"><ChevronRight size={17} /></button></div></nav></> : <div className={s.empty}><FileClock size={36} /><h3>{hasFilters ? "ยังไม่พบงานที่ตรงกับตัวกรอง" : "ไอเดียแรกของคุณ เริ่มได้ที่นี่"}</h3><p>{hasFilters ? "ลองเปลี่ยนคำค้นหา หรือแสดงผลงานทั้งหมด" : "เมื่อสร้างงานแล้ว ผลงานและสถานะจะปรากฏในหน้านี้"}</p>{hasFilters ? <button className={s.secondary} onClick={reset}>แสดงผลงานทั้งหมด</button> : <Link href="/create/image" className={s.primary}>สร้างภาพแรก <ArrowRight size={16} /></Link>}</div>}
      </div>
    </section>{selected && <WorkDialog item={data?.items.find(item => item.id === selected.id && item.source === selected.source) ?? selected} close={() => setSelected(null)} />}
  </div>;
}
