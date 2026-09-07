"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ArrowRight, Download, RefreshCw, Plus, Search, QrCode, Info, X, AlertCircle } from "lucide-react";
import { createBillingPortalSession, createCreditCheckoutSession, fetchCheckoutCatalog, fetchUsageDashboard, type CheckoutCatalog, type UsageDashboard, type UsagePeriodKey } from "@/lib/api/usage";
import { activityCsv, activityLabel, creditLabel, csvCell, chartBounds, dateLabel, monthLabel, number, signed, visibleTrend, type Activity } from "./usage-utils";
import styles from "./usage-page.module.css";

const tabs = ["ภาพรวม", "รายละเอียดการใช้", "ประวัติเครดิต", "เติมเครดิต"];
const icons: Record<string, string> = { image: "1-image", video: "2-video", presenter: "3-profile", audio: "4-audio", document: "5-document", custom: "6-custom-v2" };
function ToolIcon({ tool, large = false }: { tool: string; large?: boolean }) {
  return <Image src={`/generated-icons-v2-normalized/icon-${icons[tool] ?? icons.image}.png`} width={large ? 88 : 40} height={large ? 88 : 40} alt="" className={large ? styles.toolIcon : styles.activityIcon} />;
}
function ArtworkThumbnail({ item }: { item: Activity }) {
  const [failed, setFailed] = useState(false);
  if (!item.artwork) return item.amount > 0 ? <span className={styles.addIcon}><Plus size={20} /></span> : <ToolIcon tool={Object.keys(icons).find(key => item.title.toLowerCase().includes(key)) ?? "image"} />;
  return item.artwork.thumbnailUrl && !failed
    ? <Image unoptimized src={item.artwork.thumbnailUrl} width={48} height={48} alt={`ผลงาน ${item.artwork.name}`} className={styles.artworkThumbnail} onError={() => setFailed(true)} />
    : <span className={styles.artworkPlaceholder}>{failed ? "โหลดภาพไม่ได้" : "ไม่มีภาพตัวอย่าง"}</span>;
}
function ActivityRows({ items, history = false }: { items: Activity[]; history?: boolean }) {
  if (!items.length) return <p className={styles.empty}>ยังไม่มีรายการในช่วงเวลานี้</p>;
  return <ul className={styles.activityList}>{items.map(item => <li key={item.id} className={styles.activityRow}>
    <ArtworkThumbnail key={item.artwork?.thumbnailUrl ?? item.id} item={item} />
    <div className={styles.activityName}><strong className={styles.artworkName}>{activityLabel(item)}</strong>{item.artwork && <><span className={styles.artworkCaption}>{item.title}{item.transactionType === "refund" ? ` · ${item.artwork.name}` : ""}</span>{item.artwork.outputUrl && <a className={styles.artworkLink} href={item.artwork.outputUrl} target="_blank" rel="noopener noreferrer">ดูผลงาน ↗</a>}</>}{history && <details><summary>รายละเอียดรายการ</summary><span className={styles.identifier}>{item.id}</span><span>ยอดหลังรายการ {number(item.balanceAfter)} เครดิต</span></details>}</div>
    <strong className={item.amount > 0 ? styles.positive : undefined}>{signed(item.amount)} <small>เครดิต</small></strong>
    <time dateTime={item.createdAt}>{dateLabel(item.createdAt)}</time>
  </li>)}</ul>;
}

function UsageChart({ dashboard }: { dashboard: UsageDashboard }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const points = visibleTrend(dashboard);
    const render = () => {
      const rect = canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr; canvas.height = rect.height * dpr;
      const ctx = canvas.getContext("2d"); if (!ctx) return;
      ctx.scale(dpr, dpr);
      const width = rect.width, height = rect.height, left = 40, right = width - 20, top = 28, bottom = height - 35;
      const { min, max } = chartBounds(points.map(point => point.credits));
      const y = (value: number) => bottom - (value - min) / (max - min) * (bottom - top);
      const x = (index: number) => left + index / Math.max(points.length - 1, 1) * (right - left);
      ctx.font = "13px Arial, sans-serif"; ctx.textBaseline = "middle";
      for (let i = 0; i < 4; i++) {
        const value = min + (max - min) * i / 3;
        ctx.fillStyle = "#53535d"; ctx.textAlign = "left"; ctx.fillText(number(value), 0, y(value));
        ctx.beginPath(); ctx.setLineDash([3, 4]); ctx.strokeStyle = "#e8e8ed"; ctx.moveTo(left, y(value)); ctx.lineTo(right, y(value)); ctx.stroke();
      }
      ctx.setLineDash([]); ctx.strokeStyle = "#ff5800"; ctx.lineWidth = 2; ctx.beginPath();
      points.forEach((point, index) => { if (index === 0) ctx.moveTo(x(index), y(point.credits)); else ctx.lineTo(x(index), y(point.credits)); }); ctx.stroke();
      const peak = Math.max(...points.map(point => point.credits));
      points.forEach((point, index) => {
        ctx.beginPath(); ctx.arc(x(index), y(point.credits), 3.5, 0, Math.PI * 2); ctx.fillStyle = "#fff"; ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#53535d"; ctx.textAlign = "center";
        ctx.fillText(new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(point.date)), x(index), height - 12);
        if (point.credits === peak && peak > 0) { ctx.fillStyle = "#d60076"; ctx.font = "bold 15px Arial"; ctx.fillText(number(peak), x(index), y(peak) - 15); ctx.font = "13px Arial"; }
      });
    };
    render(); const observer = new ResizeObserver(render); observer.observe(canvas); return () => observer.disconnect();
  }, [dashboard]);
  return <div className={styles.chart}><canvas ref={canvasRef} role="img" aria-label={`การใช้เครดิต 7 วันล่าสุดในช่วงที่เลือก: ${visibleTrend(dashboard).map(point => `${point.label} ${number(point.credits)} เครดิต`).join(", ")}`} /><span className={styles.chartCaption}>การใช้เครดิตรายวัน · 7 วันล่าสุดในช่วงที่เลือก</span></div>;
}

function CreditTransactions({ items }: { items: Activity[] }) {
  if (!items.length) return <p className={styles.empty}>ไม่พบรายการเครดิตในช่วงเวลาหรือตัวกรองนี้</p>;
  return <div className={styles.transactionScroll}><table className={styles.transactionTable}>
    <caption className={styles.muted}>รายการเคลื่อนไหวเครดิต · เรียงจากล่าสุด</caption>
    <thead><tr><th scope="col">วันที่</th><th scope="col">รายการ / อ้างอิง</th><th scope="col">เครดิตเข้า–ออก</th><th scope="col">คงเหลือหลังรายการ</th></tr></thead>
    <tbody>{items.map(item => <tr key={item.id}><td><time dateTime={item.createdAt}>{dateLabel(item.createdAt)}</time></td><td><strong>{creditLabel(item)}</strong><details><summary>ดูรหัสอ้างอิง</summary><span className={styles.identifier}>{item.id}</span>{item.referenceId && <span className={styles.identifier}>อ้างอิง: {item.referenceId}</span>}</details></td><td className={item.amount > 0 ? styles.positive : undefined}>{signed(item.amount)}</td><td>{number(item.balanceAfter)}</td></tr>)}</tbody>
  </table></div>;
}

function Ledger({ period, usageOnly, refresh }: { period: UsagePeriodKey; usageOnly: boolean; refresh: number }) {
  const [items, setItems] = useState<Activity[]>([]), [hasMore, setHasMore] = useState(false), [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true), [error, setError] = useState(false), [retry, setRetry] = useState(0);
  const [query, setQuery] = useState(""), [kind, setKind] = useState("all");
  useEffect(() => {
    let cancelled = false;
    Promise.all(Array.from({ length: offset / 50 + 1 }, (_, index) => fetchUsageDashboard(period, "daily", 50, index * 50))).then(pages => { if (cancelled) return; setItems([...new Map(pages.flatMap(page => page.recentActivity.items).map(item => [item.id, item])).values()]); setHasMore(pages[pages.length - 1].recentActivity.pagination.hasMore); setError(false); }).catch(() => { if (!cancelled) setError(true); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [period, offset, retry, refresh]);
  const filtered = items.filter(item => (!usageOnly || item.transactionType === "usage") && (kind === "all" || (kind === "added" ? item.amount > 0 : item.amount < 0)) && `${usageOnly ? activityLabel(item) : creditLabel(item)} ${item.title} ${item.id} ${item.referenceId ?? ""}`.toLowerCase().includes(query.toLowerCase()));
  const download = () => { const csv = usageOnly ? activityCsv(filtered) : "\uFEFF" + [["วันที่", "รายการ", "เครดิตเข้า–ออก", "คงเหลือหลังรายการ", "รหัสรายการ", "รหัสอ้างอิง"], ...filtered.map(item => [item.createdAt, creditLabel(item), item.amount, item.balanceAfter, item.id, item.referenceId ?? ""])].map(row => row.map(csvCell).join(",")).join("\r\n"); const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" })); const link = document.createElement("a"); link.href = url; link.download = `eos-${usageOnly ? "usage" : "credit"}-${period}.csv`; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); };
  return <section className={styles.ledger}><div className={styles.sectionHeading}><h2>{usageOnly ? "รายละเอียดการใช้เครดิต" : "ประวัติเครดิต"}</h2><button className={styles.secondary} onClick={download} disabled={!filtered.length}><Download size={16} /> CSV รายการที่แสดง</button></div>
    <p className={styles.muted}>{usageOnly ? "ดูผลงานที่สร้าง เครื่องมือที่ใช้ และเครดิตที่หักในแต่ละงาน" : "ตรวจสอบเครดิตเข้า–ออก ทั้งการเติม หัก คืน และปรับยอด พร้อมยอดคงเหลือหลังแต่ละรายการ"}</p>
    <div className={styles.filters}><label className={styles.search}><Search size={17} /><input aria-label="ค้นหารายการที่โหลดแล้ว" placeholder="ค้นหาชื่อหรือรหัสรายการ" value={query} onChange={e => setQuery(e.target.value)} /></label>{!usageOnly && <select aria-label="ประเภทรายการ" value={kind} onChange={e => setKind(e.target.value)}><option value="all">ทุกประเภท</option><option value="added">เครดิตเพิ่ม</option><option value="used">เครดิตลด</option></select>}</div>
    <p className={styles.muted}>{usageOnly ? "แสดงการใช้งาน" : "แสดงประวัติเครดิต"} {filtered.length} รายการ · ค้นหาและส่งออกเฉพาะรายการที่โหลดแล้ว</p>
    {loading && !items.length ? <p role="status" className={styles.empty}>กำลังโหลดประวัติ…</p> : usageOnly ? <div className={styles.workUsage}><ActivityRows items={filtered} /></div> : <CreditTransactions items={filtered} />}
    {error && <div role="alert" className={styles.error}>โหลดประวัติไม่สำเร็จ<button onClick={() => { setLoading(true); setRetry(value => value + 1); }}>ลองอีกครั้ง</button></div>}
    {hasMore && !error && <button className={styles.secondary} disabled={loading} onClick={() => { setLoading(true); setOffset(value => value + 50); }}>{loading ? "กำลังโหลด…" : "โหลดรายการเพิ่มเติม"}</button>}
  </section>;
}

function Topup({ catalog, catalogError, dashboard, onRetry, onBusyChange }: { catalog: CheckoutCatalog | null; catalogError: boolean; dashboard: UsageDashboard | null; onRetry: () => void; onBusyChange: (busy: boolean) => void }) {
  const [selected, setSelected] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const pack = catalog?.topups.find(item => item.id === selected);
  const checkout = async () => {
    if (!pack || lock.current) return; lock.current = true; setBusy(true); onBusyChange(true); setError(null);
    try { const session = await createCreditCheckoutSession(pack.id); window.location.assign(session.url); }
    catch { setError("เปิดหน้าชำระเงินไม่สำเร็จ กรุณาลองอีกครั้ง"); lock.current = false; setBusy(false); onBusyChange(false); }
  };
  const portal = async () => { if (lock.current) return; lock.current = true; setBusy(true); onBusyChange(true); setError(null); try { const session = await createBillingPortalSession(); window.location.assign(session.url); } catch { setError("เปิดหน้าจัดการการชำระเงินไม่สำเร็จ"); lock.current = false; setBusy(false); onBusyChange(false); } };
  return <section className={styles.topup}><div><h2>เติมพลังให้ไอเดียของคุณ</h2><p className={styles.muted}>เลือกแพ็กเกจเครดิต · ชำระครั้งเดียวด้วย PromptPay ผ่าน Stripe</p>
    {catalogError ? <div className={styles.error} role="alert">โหลดแพ็กเกจไม่สำเร็จ <button onClick={onRetry}>ลองอีกครั้ง</button></div> : !catalog ? <p role="status">กำลังโหลดแพ็กเกจ…</p> : !catalog.topups.length ? <p className={styles.empty}>ยังไม่มีแพ็กเกจให้เลือกในขณะนี้</p> : <fieldset className={styles.packages} disabled={busy}><legend>เลือกจำนวนเครดิต</legend>{catalog.topups.map(item => <label key={item.id} className={selected === item.id ? styles.selectedPack : styles.pack}><input type="radio" name="credit-pack" value={item.id} checked={selected === item.id} onChange={() => setSelected(item.id)} /><span><strong>{number(item.credits)}</strong> เครดิต</span><b>฿{number(item.amountThb)}</b></label>)}</fieldset>}
    </div><aside className={styles.order}><QrCode size={28} /><h3>สรุปรายการ</h3><dl><div><dt>จำนวนเครดิต</dt><dd>{pack ? number(pack.credits) : "เลือกแพ็กเกจ"}</dd></div><div><dt>ยอดชำระ</dt><dd>{pack ? `฿${number(pack.amountThb)}` : "—"}</dd></div><div><dt>ช่องทาง</dt><dd>PromptPay</dd></div></dl>
    <button className={styles.primaryButton} disabled={!pack || busy || !catalog?.promptPay} onClick={checkout}>{busy ? "กำลังเปิด Stripe…" : pack ? `ไปชำระเงิน ฿${number(pack.amountThb)}` : "เลือกแพ็กเกจก่อนชำระ"}<ArrowRight size={20} /></button>
    <p className={styles.muted}>Stripe จะแสดง QR สำหรับสแกน เครดิตจะเพิ่มหลังระบบยืนยันการชำระเงินแล้วเท่านั้น</p>{catalog && !catalog.promptPay && <p role="status">PromptPay ยังไม่พร้อมให้บริการ</p>}{error && <p className={styles.error} role="alert">{error}</p>}
    {dashboard?.billing.customerId && <button className={styles.textButton} disabled={busy} onClick={portal}>จัดการข้อมูลการชำระเงิน <ArrowRight size={16} /></button>}
    </aside></section>;
}

export function UsagePage() {
  const [activeTab, setActiveTab] = useState(0), [period, setPeriod] = useState<UsagePeriodKey>("current");
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [dashboard, setDashboard] = useState<UsageDashboard | null>(null), [catalog, setCatalog] = useState<CheckoutCatalog | null>(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState(false), [catalogError, setCatalogError] = useState(false), [refresh, setRefresh] = useState(0);
  const [checkoutState, setCheckoutState] = useState<string | null>(null), [pollCount, setPollCount] = useState(0);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("tab") !== "topup") return;
    const timer = window.setTimeout(() => {
      setActiveTab(3);
      tabRefs.current[3]?.focus();
      tabRefs.current[3]?.scrollIntoView({ block: "start" });
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => { const value = new URLSearchParams(window.location.search).get("checkout"); setCheckoutState(value === "success" || value === "cancelled" ? value : null); }, 0); return () => window.clearTimeout(timer); }, []);
  useEffect(() => {
    let cancelled = false;
    void Promise.allSettled([fetchUsageDashboard(period, "daily"), fetchCheckoutCatalog()]).then(([usage, packs]) => {
      if (cancelled) return;
      if (usage.status === "fulfilled") { setDashboard(usage.value); setError(false); } else { setDashboard(null); setError(true); }
      if (packs.status === "fulfilled") { setCatalog(packs.value); setCatalogError(false); } else { setCatalog(null); setCatalogError(true); }
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [period, refresh]);
  useEffect(() => {
    if (checkoutState !== "success" || pollCount >= 6) return;
    const timer = window.setTimeout(() => { setRefresh(value => value + 1); setPollCount(value => value + 1); }, 5000);
    return () => window.clearTimeout(timer);
  }, [checkoutState, pollCount]);
  const reload = () => { setLoading(true); setRefresh(value => value + 1); };
  const changePeriod = (value: UsagePeriodKey) => { setPeriod(value); setDashboard(null); setLoading(true); };
  const selectTab = (value: number, focus = false) => { if (paymentBusy) return; setActiveTab(value); if (focus) tabRefs.current[value]?.focus(); };
  const summary = dashboard?.summary;
  return <div className={styles.usagePage} data-page="usage" data-no-translate>
    <header className={styles.hero}><div className={styles.heroCopy}><h1>YOUR CREATIVE<br />PULSE<span>.</span></h1><p>การใช้งานและเครดิต</p></div><Image src="/generated-assets/usage-hero-art-v2.png" alt="" width={1984} height={794} priority className={styles.heroImage} sizes="(max-width: 600px) 100vw, 50vw" /></header>
    {checkoutState && <div className={styles.notice} role="status"><Info size={18} /><span>{checkoutState === "cancelled" ? "คุณกลับจากหน้าชำระเงิน หากยังไม่ได้ชำระ สามารถเลือกแพ็กเกจเพื่อทำรายการใหม่ได้" : pollCount < 6 ? "กลับจาก Stripe แล้ว กำลังอัปเดตยอดเครดิต โปรดรอการยืนยันการชำระเงินจากระบบ" : "หากเครดิตยังไม่เพิ่ม ให้ตรวจสอบสถานะการชำระเงินและลองรีเฟรชอีกครั้ง"}</span><button onClick={reload} disabled={loading} aria-label="รีเฟรชยอดเครดิต"><RefreshCw size={17} /></button><button aria-label="ปิดข้อความการชำระเงิน" onClick={() => { setCheckoutState(null); const url = new URL(window.location.href); url.searchParams.delete("checkout"); window.history.replaceState(null, "", url); }}><X size={17} /></button></div>}
    <section className={styles.summary} aria-label="สรุปเครดิต" aria-busy={loading}><div className={styles.balance}><span>เครดิตพร้อมใช้</span><strong>{loading ? "…" : summary ? number(summary.creditsRemaining) : "—"}</strong></div><div className={styles.periodStats}><span>ใช้แล้ว <b>{loading ? "…" : summary ? number(summary.creditsUsed) : "—"}</b> เครดิต</span><span>เพิ่มแล้ว <b>{loading ? "…" : summary ? number(summary.creditsAdded) : "—"}</b> เครดิต</span><small>{dashboard ? monthLabel(dashboard.period.startAt) : "ช่วงเวลาที่เลือก"}</small></div><div className={styles.topupAction}><button className={styles.primaryButton} disabled={paymentBusy} onClick={() => selectTab(3, true)}>เติมเครดิต <ArrowRight size={24} /></button><small>ชำระด้วย PromptPay ผ่าน Stripe</small></div></section>
    <div className={styles.tabBar} role="tablist" aria-label="ส่วนการใช้งานและเครดิต">{tabs.map((tab, index) => <button key={tab} id={`usage-tab-${index}`} ref={element => { tabRefs.current[index] = element; }} type="button" role="tab" disabled={paymentBusy} aria-selected={activeTab === index} aria-controls={`usage-panel-${index}`} tabIndex={activeTab === index ? 0 : -1} onClick={() => selectTab(index)} onKeyDown={event => { const next = event.key === "ArrowRight" ? (index + 1) % tabs.length : event.key === "ArrowLeft" ? (index + tabs.length - 1) % tabs.length : event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : null; if (next !== null) { event.preventDefault(); selectTab(next, true); } }}>{tab}</button>)}</div>
    {error && <div className={styles.error} role="alert"><AlertCircle size={20} /><span>โหลดข้อมูลเครดิตไม่สำเร็จ กรุณาตรวจสอบการเข้าสู่ระบบแล้วลองอีกครั้ง</span><a href="/login">เข้าสู่ระบบ</a><button onClick={reload} disabled={loading}>ลองอีกครั้ง</button></div>}
    <div role="tabpanel" id={`usage-panel-${activeTab}`} aria-labelledby={`usage-tab-${activeTab}`} tabIndex={0}>
      {activeTab !== 3 && <div className={styles.periodControl}><label htmlFor="usage-period" className={styles.srOnly}>ช่วงเวลารายงาน</label><select id="usage-period" value={period} onChange={e => changePeriod(e.target.value as UsagePeriodKey)}><option value="current">{period === "current" && dashboard ? monthLabel(dashboard.period.startAt) : "เดือนปัจจุบัน"}</option><option value="previous">{period === "previous" && dashboard ? monthLabel(dashboard.period.startAt) : "เดือนก่อนหน้า"}</option></select><button className={styles.refresh} aria-label="รีเฟรชข้อมูล" disabled={loading} onClick={reload}><RefreshCw size={16} /></button></div>}
      {activeTab === 3 ? <Topup catalog={catalog} catalogError={catalogError} dashboard={dashboard} onRetry={reload} onBusyChange={setPaymentBusy} /> : activeTab === 1 || activeTab === 2 ? <Ledger key={`${period}-${activeTab}`} period={period} usageOnly={activeTab === 1} refresh={refresh} /> : loading ? <div className={styles.loading} role="status">กำลังโหลดข้อมูลเครดิต…</div> : dashboard && activeTab === 0 ? <><div className={styles.overview}><section aria-label="กราฟการใช้เครดิต"><UsageChart dashboard={dashboard} /></section><section className={styles.recent}><div className={styles.sectionHeading}><h2>กิจกรรมล่าสุด</h2><button className={styles.textButton} onClick={() => selectTab(2, true)}>ดูประวัติทั้งหมด <ArrowRight size={18} /></button></div><ActivityRows items={dashboard.recentActivity.items.slice(0, 4)} /></section></div><section className={styles.tools} aria-label="การใช้งานตามเครื่องมือ">{[...dashboard.usageByTool.items].sort((a, b) => ["image", "video", "audio", "presenter", "document", "custom"].indexOf(a.key) - ["image", "video", "audio", "presenter", "document", "custom"].indexOf(b.key)).map(item => <div key={item.key}><ToolIcon tool={item.key} large /><span><strong>{item.label}</strong><b>{number(item.credits)} <small>เครดิต</small></b></span></div>)}</section></> : null}
    </div>
  </div>;
}
