"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { ArrowRight, Download, RefreshCw, Plus, QrCode, Info, X, AlertCircle } from "lucide-react";
import { VideoFrameThumbnail } from "@/components/media/video-frame-thumbnail";
import { MonthPicker } from "./month-picker";
import { useStudioCopy } from "@/lib/i18n/studio-copy";
import { SearchInput } from "@/components/ui/search-input";
import { createBillingPortalSession, createCreditCheckoutSession, fetchCheckoutCatalog, fetchTopupReceipt, fetchUsageDashboard, type CheckoutCatalog, type TopupReceipt, type UsageDashboard } from "@/lib/api/usage";
import { activityCsv, activityLabel, calculateVat, creditLabel, csvCell, chartBounds, dateLabel, monthLabel, number, recentMonths, signed, usageLabel, visibleTrend, type Activity } from "./usage-utils";
import styles from "./usage-page.module.css";

const currentMonth = recentMonths(1)[0].value;
const icons: Record<string, string> = { image: "1-image", video: "2-video", presenter: "3-profile", audio: "4-audio", document: "5-document", custom: "6-custom-v2" };
function ToolIcon({ tool, large = false }: { tool: string; large?: boolean }) {
  return <Image src={`/generated-icons-v2-normalized/icon-${icons[tool] ?? icons.image}.png`} width={large ? 88 : 40} height={large ? 88 : 40} alt="" className={large ? styles.toolIcon : styles.activityIcon} />;
}
function ArtworkThumbnail({ item }: { item: Activity }) {
  const { c } = useStudioCopy();
  const [failed, setFailed] = useState(false);
  if (!item.artwork) return item.amount > 0 ? <span className={styles.addIcon}><Plus size={20} /></span> : <ToolIcon tool={Object.keys(icons).find(key => item.title.toLowerCase().includes(key)) ?? "image"} />;
  if (item.artwork.mediaKind === "video" && item.artwork.outputUrl) {
    return <VideoFrameThumbnail key={item.artwork.outputUrl} src={item.artwork.outputUrl} alt={c("usage.artwork.previewAlt", { name: item.artwork.name })} className={styles.artworkThumbnail} fallback={<span className={styles.artworkPlaceholder}>{c("usage.artwork.noPreview")}</span>} />;
  }
  return item.artwork.thumbnailUrl && !failed
    ? <Image unoptimized src={item.artwork.thumbnailUrl} width={48} height={48} alt={c("usage.artwork.alt", { name: item.artwork.name })} className={styles.artworkThumbnail} onError={() => setFailed(true)} />
    : <span className={styles.artworkPlaceholder}>{failed ? c("usage.artwork.loadFailed") : c("usage.artwork.noPreview")}</span>;
}
function ActivityRows({ items, history = false }: { items: Activity[]; history?: boolean }) {
  const { c, locale } = useStudioCopy();
  if (!items.length) return <p className={styles.empty}>{c("usage.activity.empty")}</p>;
  return <ul className={styles.activityList}>{items.map(item => <li key={item.id} className={styles.activityRow}>
    <ArtworkThumbnail key={item.artwork?.thumbnailUrl ?? item.id} item={item} />
    <div className={styles.activityName}><strong className={styles.artworkName}>{activityLabel(item, locale)}</strong>{item.artwork && <><span className={styles.artworkCaption}>{item.title}{item.transactionType === "refund" ? ` · ${item.artwork.name}` : ""}</span>{item.artwork.outputUrl && <a className={styles.artworkLink} href={item.artwork.outputUrl} target="_blank" rel="noopener noreferrer">{c("usage.activity.viewArtwork")}</a>}</>}{history && <details><summary>{c("usage.activity.details")}</summary><span className={styles.identifier}>{item.id}</span><span>{c("usage.activity.balanceAfter", { value: number(item.balanceAfter) })}</span></details>}</div>
    <strong className={item.amount > 0 ? styles.positive : undefined}>{signed(item.amount)} <small>{c("common.credits")}</small></strong>
    <time dateTime={item.createdAt}>{dateLabel(item.createdAt, locale)}</time>
  </li>)}</ul>;
}

function UsageChart({ dashboard }: { dashboard: UsageDashboard }) {
  const { c } = useStudioCopy();
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
  return <div className={styles.chart}><canvas ref={canvasRef} role="img" aria-label={c("usage.chart.aria", { points: visibleTrend(dashboard).map(point => c("usage.chart.point", { label: point.label, value: number(point.credits) })).join(", ") })} /><span className={styles.chartCaption}>{c("usage.chart.caption")}</span></div>;
}

function CreditTransactions({ items }: { items: Activity[] }) {
  const { c, locale } = useStudioCopy();
  if (!items.length) return <p className={styles.empty}>{c("usage.credit.empty")}</p>;
  return <div className={styles.transactionScroll}><table className={styles.transactionTable}>
    <caption className={styles.muted}>{c("usage.credit.caption")}</caption>
    <thead><tr><th scope="col">{c("usage.credit.colDate")}</th><th scope="col">{c("usage.credit.colEntry")}</th><th scope="col">{c("usage.credit.colAmount")}</th><th scope="col">{c("usage.credit.colBalance")}</th></tr></thead>
    <tbody>{items.map(item => <tr key={item.id}><td><time dateTime={item.createdAt}>{dateLabel(item.createdAt, locale)}</time></td><td><strong>{creditLabel(item, locale)}</strong><details><summary>{c("usage.credit.viewReference")}</summary><span className={styles.identifier}>{item.id}</span>{item.referenceId && <span className={styles.identifier}>{c("usage.credit.reference", { value: item.referenceId })}</span>}</details></td><td className={item.amount > 0 ? styles.positive : undefined}>{signed(item.amount)}</td><td>{number(item.balanceAfter)}</td></tr>)}</tbody>
  </table></div>;
}

function metadataNumber(item: Activity, key: string): number | null {
  const value = item.metadata[key];
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function receiptHtml(receipt: TopupReceipt) {
  const escape = (value: string | null | undefined) => (value ?? "—").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character] ?? character));
  const money = (value: number | null) => value === null ? "—" : `฿${number(value)}`;
  return `<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(receipt.receiptNumber)} · EOS Creative Studio</title><style>body{margin:0;background:#f7f3f0;color:#17171c;font-family:Arial,"Noto Sans Thai",sans-serif}.sheet{box-sizing:border-box;width:min(760px,calc(100% - 32px));margin:32px auto;padding:42px;background:#fff;border:1px solid #eadfd8;border-radius:24px;box-shadow:0 16px 40px #2b17100d}.brand{color:#ff5800;font-size:13px;font-weight:700;letter-spacing:.16em;text-transform:uppercase}.head{display:flex;justify-content:space-between;gap:24px;border-bottom:2px solid #ff5800;padding-bottom:24px}.head h1{margin:12px 0 0;font-size:30px}.meta{text-align:right;color:#67636a;font-size:13px;line-height:1.8}.status{display:inline-block;margin-top:8px;padding:5px 10px;border-radius:999px;background:#fff1eb;color:#e84d12;font-weight:700}.customer{margin:28px 0;padding:18px 20px;background:#fff8f3;border-radius:14px}.customer strong{display:block;margin-bottom:6px}.row{display:flex;justify-content:space-between;gap:24px;padding:14px 0;border-bottom:1px solid #eee7e2}.row span:first-child{color:#67636a}.total{font-size:20px;font-weight:700;border-bottom:0}.foot{margin-top:28px;color:#77727a;font-size:12px;line-height:1.7}@media print{body{background:#fff}.sheet{width:100%;margin:0;border:0;box-shadow:none}}</style></head><body><main class="sheet"><div class="head"><div><div class="brand">EOS Creative Studio</div><h1>Invoice / Receipt</h1></div><div class="meta">เลขที่ ${escape(receipt.receiptNumber)}<br>${escape(dateLabel(receipt.issuedAt))}<br><span class="status">ชำระเงินแล้ว</span></div></div><div class="customer"><strong>ผู้ชำระเงิน</strong><span>${escape(receipt.customer.name)}</span><br><span>${escape(receipt.customer.email)}</span></div><div class="row"><span>รายการ</span><strong>เติมเครดิตผ่าน ${escape(receipt.paymentMethod)}</strong></div><div class="row"><span>จำนวนเครดิต</span><strong>${number(receipt.credits)} เครดิต</strong></div><div class="row"><span>ราคาก่อน VAT</span><strong>${money(receipt.subtotalThb)}</strong></div><div class="row"><span>VAT (${number(receipt.vatPercent)}%)</span><strong>${money(receipt.vatAmountThb)}</strong></div><div class="row total"><span>ยอดชำระรวม</span><strong>${money(receipt.totalThb)}</strong></div><div class="foot">ช่องทางชำระเงิน: ${escape(receipt.paymentMethod)} ผ่าน ${escape(receipt.provider)}<br>รหัสธุรกรรม: ${escape(receipt.transactionId)}<br>เอกสารนี้ออกโดยระบบ EOS Creative Studio</div></main></body></html>`;
}

function TopupTransactions({ items }: { items: Activity[] }) {
  const { c, locale } = useStudioCopy();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [failedId, setFailedId] = useState<string | null>(null);
  if (!items.length) return <p className={styles.empty}>{c("usage.topups.empty")}</p>;
  const download = async (item: Activity) => {
    if (downloadingId) return;
    setDownloadingId(item.id); setFailedId(null);
    try {
      const receipt = await fetchTopupReceipt(item.id);
      const url = URL.createObjectURL(new Blob([receiptHtml(receipt)], { type: "text/html;charset=utf-8" }));
      const link = document.createElement("a"); link.href = url; link.download = `${receipt.receiptNumber}.html`; link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setFailedId(item.id); }
    finally { setDownloadingId(null); }
  };
  return <div className={styles.transactionScroll}><table className={styles.transactionTable}>
    <caption className={styles.muted}>{c("usage.topups.caption")}</caption>
    <thead><tr><th scope="col">{c("usage.topups.colDate")}</th><th scope="col">{c("usage.topups.colEntry")}</th><th scope="col">{c("usage.topups.colCredits")}</th><th scope="col">{c("usage.topups.colTotal")}</th><th scope="col">{c("usage.topups.colReceipt")}</th></tr></thead>
    <tbody>{items.map(item => { const total = metadataNumber(item, "total_thb"); return <tr key={item.id}><td><time dateTime={item.createdAt}>{dateLabel(item.createdAt, locale)}</time></td><td><strong>{usageLabel(locale, "stripe")}</strong><details><summary>{c("usage.credit.viewReference")}</summary><span className={styles.identifier}>{item.id}</span>{item.referenceId && <span className={styles.identifier}>{c("usage.credit.reference", { value: item.referenceId })}</span>}</details></td><td className={styles.positive}>+{number(item.amount)}</td><td>{total === null ? "—" : `฿${number(total)}`}</td><td><button className={styles.receiptButton} onClick={() => void download(item)} disabled={downloadingId !== null}>{downloadingId === item.id ? c("usage.topups.preparing") : c("usage.topups.download")}<Download size={15} /></button>{failedId === item.id && <span className={styles.receiptError} role="alert">{c("usage.topups.retry")}</span>}</td></tr>; })}</tbody>
  </table></div>;
}

function Ledger({ month, usageOnly, topupsOnly = false, refresh }: { month: string; usageOnly: boolean; topupsOnly?: boolean; refresh: number }) {
  const { c, locale } = useStudioCopy();
  const [items, setItems] = useState<Activity[]>([]), [hasMore, setHasMore] = useState(false), [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true), [error, setError] = useState(false), [retry, setRetry] = useState(0);
  const [query, setQuery] = useState(""), [kind, setKind] = useState("all");
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    fetchUsageDashboard(month, "daily", 50, offset, controller.signal).then(page => {
      if (cancelled) return;
      setItems(current => {
        const nextItems = offset === 0 ? page.recentActivity.items : [...current, ...page.recentActivity.items];
        return [...new Map(nextItems.map(item => [item.id, item])).values()];
      });
      setHasMore(page.recentActivity.pagination.hasMore);
      setError(false);
    }).catch(() => { if (!cancelled && !controller.signal.aborted) setError(true); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; controller.abort(); };
  }, [month, offset, retry, refresh]);
  const filtered = items.filter(item => (!usageOnly || item.transactionType === "usage") && (!topupsOnly || (item.referenceType === "stripe_checkout" && item.amount > 0)) && (topupsOnly || kind === "all" || (kind === "added" ? item.amount > 0 : item.amount < 0)) && `${usageOnly ? activityLabel(item, locale) : creditLabel(item, locale)} ${item.title} ${item.id} ${item.referenceId ?? ""}`.toLowerCase().includes(query.toLowerCase()));
  const download = () => { const csv = usageOnly ? activityCsv(filtered, locale) : topupsOnly ? "\uFEFF" + [[usageLabel(locale, "csvDate"), usageLabel(locale, "csvEntry"), usageLabel(locale, "csvCredits"), usageLabel(locale, "csvSubtotal"), usageLabel(locale, "csvVat"), usageLabel(locale, "csvTotal"), usageLabel(locale, "csvEntryId"), usageLabel(locale, "csvReferenceId")], ...filtered.map(item => [item.createdAt, usageLabel(locale, "stripe"), item.amount, metadataNumber(item, "subtotal_thb") ?? "", metadataNumber(item, "vat_amount_thb") ?? "", metadataNumber(item, "total_thb") ?? "", item.id, item.referenceId ?? ""])].map(row => row.map(csvCell).join(",")).join("\r\n") : "\uFEFF" + [[usageLabel(locale, "csvDate"), usageLabel(locale, "csvEntry"), usageLabel(locale, "csvAmountInOut"), usageLabel(locale, "csvBalanceAfterEntry"), usageLabel(locale, "csvEntryId"), usageLabel(locale, "csvReferenceId")], ...filtered.map(item => [item.createdAt, creditLabel(item, locale), item.amount, item.balanceAfter, item.id, item.referenceId ?? ""])].map(row => row.map(csvCell).join(",")).join("\r\n"); const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" })); const link = document.createElement("a"); link.href = url; link.download = `eos-${usageOnly ? "usage" : topupsOnly ? "topup-history" : "credit"}-${month}.csv`; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); };
  return <section className={styles.ledger}><div className={styles.sectionHeading}><h2>{topupsOnly ? c("usage.ledger.titleTopups") : usageOnly ? c("usage.ledger.titleUsage") : c("usage.ledger.titleCredit")}</h2><button className={styles.secondary} onClick={download} disabled={!filtered.length}><Download size={16} /> {c("usage.ledger.csv")}</button></div>
    <p className={styles.muted}>{topupsOnly ? c("usage.ledger.introTopups") : usageOnly ? c("usage.ledger.introUsage") : c("usage.ledger.introCredit")}</p>
    <div className={styles.filters}><SearchInput className="w-full max-w-[460px] flex-1" aria-label={c("usage.ledger.searchLabel")} placeholder={c("usage.ledger.searchPlaceholder")} value={query} onValueChange={setQuery} />{!usageOnly && !topupsOnly && <select aria-label={c("usage.ledger.typeLabel")} value={kind} onChange={e => setKind(e.target.value)}><option value="all">{c("usage.ledger.typeAll")}</option><option value="added">{c("usage.ledger.typeAdded")}</option><option value="used">{c("usage.ledger.typeUsed")}</option></select>}</div>
    <p className={styles.muted}>{topupsOnly ? c("usage.ledger.showingTopups") : usageOnly ? c("usage.ledger.showingUsage") : c("usage.ledger.showingCredit")} {c("usage.ledger.countNote", { count: filtered.length })}</p>
    {loading && !items.length ? <p role="status" className={styles.empty}>{c("usage.ledger.loading")}</p> : usageOnly ? <div className={styles.workUsage}><ActivityRows items={filtered} /></div> : topupsOnly ? <TopupTransactions items={filtered} /> : <CreditTransactions items={filtered} />}
    {error && <div role="alert" className={styles.error}>{c("usage.ledger.loadFailed")}<button onClick={() => { setLoading(true); setRetry(value => value + 1); }}>{c("usage.ledger.retry")}</button></div>}
    {hasMore && !error && <button className={styles.secondary} disabled={loading} onClick={() => { setLoading(true); setOffset(value => value + 50); }}>{loading ? c("usage.ledger.loadingShort") : c("usage.ledger.loadMore")}</button>}
  </section>;
}

function Topup({ catalog, catalogError, dashboard, onRetry, onBusyChange }: { catalog: CheckoutCatalog | null; catalogError: boolean; dashboard: UsageDashboard | null; onRetry: () => void; onBusyChange: (busy: boolean) => void }) {
  const { c } = useStudioCopy();
  const [selected, setSelected] = useState(""), [customAmount, setCustomAmount] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const customConfig = catalog?.customTopup ?? { minAmountThb: 10, maxAmountThb: 100000, creditsPerThb: 10 };
  const pack = catalog?.topups.find(item => item.id === selected);
  const parsedCustomAmount = customAmount === "" ? NaN : Number(customAmount);
  const customAmountValid = Number.isInteger(parsedCustomAmount) && parsedCustomAmount >= customConfig.minAmountThb && parsedCustomAmount <= customConfig.maxAmountThb;
  const customOrder = selected === "custom" && customAmountValid ? { amountThb: parsedCustomAmount, credits: parsedCustomAmount * customConfig.creditsPerThb } : null;
  const order = pack ?? customOrder;
  const vatPercent = catalog?.vatPercent ?? 7;
  const totals = order ? calculateVat(order.amountThb, vatPercent) : null;
  const packageTotal = (amountThb: number) => calculateVat(amountThb, vatPercent).totalThb;
  const checkout = async () => {
    if (!order || lock.current) return;
    lock.current = true; setBusy(true); onBusyChange(true); setError(null);
    try { const session = await createCreditCheckoutSession(pack?.id, customOrder?.amountThb); window.location.assign(session.url); }
    catch { setError(c("usage.topup.checkoutFailed")); lock.current = false; setBusy(false); onBusyChange(false); }
  };
  const portal = async () => { if (lock.current) return; lock.current = true; setBusy(true); onBusyChange(true); setError(null); try { const session = await createBillingPortalSession(); window.location.assign(session.url); } catch { setError(c("usage.topup.portalFailed")); lock.current = false; setBusy(false); onBusyChange(false); } };
  return <section className={styles.topup}><div><h2>{c("usage.topup.heading")}</h2><p className={styles.muted}>{c("usage.topup.intro")}</p>
    {catalogError ? <div className={styles.error} role="alert">{c("usage.topup.packagesFailed")} <button onClick={onRetry}>{c("usage.page.retry")}</button></div> : !catalog ? <p role="status">{c("usage.topup.packagesLoading")}</p> : !catalog.topups.length ? <p className={styles.empty}>{c("usage.topup.packagesEmpty")}</p> : <fieldset className={styles.packages} disabled={busy}><legend>{c("usage.topup.chooseCredits")}</legend>{catalog.topups.map(item => <label key={item.id} className={selected === item.id ? styles.selectedPack : styles.pack}><input type="radio" name="credit-pack" value={item.id} checked={selected === item.id} onChange={() => setSelected(item.id)} /><span><strong>{number(item.credits)}</strong> {c("usage.topup.creditsUnit")}<small>{c("usage.topup.inclVat", { value: number(packageTotal(item.amountThb)) })}</small></span><b>฿{number(packageTotal(item.amountThb))}</b></label>)}<label className={selected === "custom" ? styles.selectedPack : styles.pack}><input type="radio" name="credit-pack" value="custom" checked={selected === "custom"} onChange={() => setSelected("custom")} /><span><strong className={styles.customPackTitle}>{c("usage.topup.customTitle")}</strong><small>{c("usage.topup.customHint")}</small></span><b>{customOrder ? `฿${number(packageTotal(customOrder.amountThb))}` : c("usage.topup.customBadge")}</b></label>{selected === "custom" && <div className={styles.customTopup}><label htmlFor="custom-topup-amount">{c("usage.topup.customAmountLabel")}<div className={styles.customInput}><span>฿</span><input id="custom-topup-amount" type="number" min={customConfig.minAmountThb} max={customConfig.maxAmountThb} step="1" inputMode="numeric" value={customAmount} onChange={event => setCustomAmount(event.target.value)} placeholder={String(customConfig.minAmountThb)} /></div></label><p>{c("usage.topup.customSummary", { credits: customAmountValid ? number(customOrder?.credits ?? 0) : "—", min: number(customConfig.minAmountThb), max: number(customConfig.maxAmountThb) })}</p>{customAmount !== "" && !customAmountValid && <span className={styles.customError} role="alert">{c("usage.topup.customInvalid", { min: number(customConfig.minAmountThb), max: number(customConfig.maxAmountThb) })}</span>}</div>}</fieldset>}
    </div><aside className={styles.order}><QrCode size={28} /><h3>{c("usage.topup.summary")}</h3><dl><div><dt>{c("usage.topup.rowCredits")}</dt><dd>{order ? number(order.credits) : c("usage.topup.choosePack")}</dd></div><div><dt>{c("usage.topup.rowSubtotal")}</dt><dd>{totals ? `฿${number(totals.subtotalThb)}` : "—"}</dd></div><div className={styles.vatRow}><dt>{c("usage.topup.rowVat", { percent: number(vatPercent) })}</dt><dd>{totals ? `฿${number(totals.vatAmountThb)}` : "—"}</dd></div><div className={styles.totalRow}><dt>{c("usage.topup.rowTotal")}</dt><dd>{totals ? `฿${number(totals.totalThb)}` : "—"}</dd></div><div><dt>{c("usage.topup.rowMethod")}</dt><dd>PromptPay</dd></div></dl>
    <button className={styles.primaryButton} disabled={!order || busy || !catalog?.promptPay} onClick={checkout}>{busy ? c("usage.topup.opening") : totals ? c("usage.topup.pay", { value: number(totals.totalThb) }) : c("usage.topup.choosePackFirst")}<ArrowRight size={20} /></button>
    <p className={styles.muted}>{c("usage.topup.qrNote")}</p>{catalog && !catalog.promptPay && <p role="status">{c("usage.topup.promptPayDown")}</p>}{error && <p className={styles.error} role="alert">{error}</p>}
    {dashboard?.billing.customerId && <button className={styles.textButton} disabled={busy} onClick={portal}>{c("usage.topup.manage")} <ArrowRight size={16} /></button>}
    </aside></section>;
}

export function UsagePage() {
  const { c, locale } = useStudioCopy();
  const monthOptions = useMemo(() => recentMonths(12, new Date(), locale), [locale]);
  const tabs = [c("usage.tab.overview"), c("usage.tab.details"), c("usage.tab.topups"), c("usage.tab.topup")];
  const [activeTab, setActiveTab] = useState(0), [month, setMonth] = useState(currentMonth);
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [paymentReset, setPaymentReset] = useState(0);
  const [dashboard, setDashboard] = useState<UsageDashboard | null>(null), [catalog, setCatalog] = useState<CheckoutCatalog | null>(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState(false), [catalogError, setCatalogError] = useState(false), [refresh, setRefresh] = useState(0);
  const [checkoutState, setCheckoutState] = useState<string | null>(null), [pollCount, setPollCount] = useState(0);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const tabBarRef = useRef<HTMLDivElement | null>(null);

  // Bring the chosen tab fully into view when it sits past the edge of the
  // strip. This nudges the strip's own scrollLeft rather than calling
  // scrollIntoView, which would also scroll the PAGE vertically.
  const revealTab = (value: number) => {
    const bar = tabBarRef.current;
    const tab = tabRefs.current[value];
    if (!bar || !tab) return;
    const peek = 24; // leave a sliver of the neighbour showing, so it reads as scrollable
    const left = tab.offsetLeft;
    const right = left + tab.offsetWidth;
    const behavior: ScrollBehavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    if (right + peek > bar.scrollLeft + bar.clientWidth) bar.scrollTo({ left: right + peek - bar.clientWidth, behavior });
    else if (left - peek < bar.scrollLeft) bar.scrollTo({ left: Math.max(0, left - peek), behavior });
  };
  const dashboardCacheRef = useRef(new Map<string, { data: UsageDashboard; cachedAt: number }>());
  const cacheRefreshRef = useRef(refresh);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("tab") !== "topup") return;
    const timer = window.setTimeout(() => {
      setActiveTab(3);
      tabRefs.current[3]?.focus();
      tabRefs.current[3]?.scrollIntoView({ block: "start" });
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    const syncCheckoutState = () => {
      const value = new URLSearchParams(window.location.search).get("checkout");
      const nextState = value === "success" || value === "cancelled" ? value : null;
      setCheckoutState(nextState);
      setPaymentBusy(false);
      setPaymentReset(reset => reset + 1);
      if (nextState) setPollCount(0);
    };
    syncCheckoutState();
    window.addEventListener("pageshow", syncCheckoutState);
    return () => window.removeEventListener("pageshow", syncCheckoutState);
  }, []);
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    if (cacheRefreshRef.current !== refresh) {
      dashboardCacheRef.current.clear();
      cacheRefreshRef.current = refresh;
    }
    const cached = dashboardCacheRef.current.get(month);
    if (cached && Date.now() - cached.cachedAt < 30_000) {
      setDashboard(cached.data);
      setError(false);
      setLoading(false);
      return () => { cancelled = true; controller.abort(); };
    }
    void fetchUsageDashboard(month, "daily", 5, 0, controller.signal).then((nextDashboard) => {
      if (cancelled) return;
      dashboardCacheRef.current.set(month, { data: nextDashboard, cachedAt: Date.now() });
      setDashboard(nextDashboard);
      setError(false);
    }).catch(() => {
      if (!cancelled && !controller.signal.aborted) { setDashboard(null); setError(true); }
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; controller.abort(); };
  }, [month, refresh]);
  useEffect(() => {
    if (activeTab !== 3) return undefined;
    let cancelled = false;
    void fetchCheckoutCatalog().then((nextCatalog) => {
      if (!cancelled) { setCatalog(nextCatalog); setCatalogError(false); }
    }).catch(() => {
      if (!cancelled) { setCatalog(null); setCatalogError(true); }
    });
    return () => { cancelled = true; };
  }, [activeTab, refresh]);
  useEffect(() => {
    if (checkoutState !== "success" || pollCount >= 6) return;
    const timer = window.setTimeout(() => { setRefresh(value => value + 1); setPollCount(value => value + 1); }, 5000);
    return () => window.clearTimeout(timer);
  }, [checkoutState, pollCount]);
  const reload = () => { setLoading(true); setRefresh(value => value + 1); };
  const changeMonth = (value: string) => { setMonth(value); setDashboard(null); setLoading(true); };
  const selectTab = (value: number, focus = false) => { if (paymentBusy) return; setActiveTab(value); revealTab(value); if (focus) tabRefs.current[value]?.focus(); };
  const summary = dashboard?.summary;
  return <div className={styles.usagePage} data-page="usage" data-no-translate>
     <header className={`studio-hero-frame ${styles.hero}`} aria-label={c("usage.page.heroAria")}><picture className={styles.heroPicture}><source media="(max-width: 767.98px)" srcSet="/generated-assets/studio-heroes-v4/usage-mobile.webp" /><Image src="/generated-assets/studio-heroes-v4/usage-desktop.webp" alt="" width={2400} height={435} priority className={styles.heroImage} sizes="100vw" /></picture></header>
    {checkoutState && <div className={styles.notice} role="status"><Info size={18} /><span>{checkoutState === "cancelled" ? c("usage.page.cancelled") : pollCount < 6 ? c("usage.page.returned") : c("usage.page.stillWaiting")}</span><button onClick={reload} disabled={loading} aria-label={c("usage.page.refreshBalance")}><RefreshCw size={17} /></button><button aria-label={c("usage.page.dismissNotice")} onClick={() => { setCheckoutState(null); const url = new URL(window.location.href); url.searchParams.delete("checkout"); window.history.replaceState(null, "", url); }}><X size={17} /></button></div>}
    <section className={styles.summary} aria-label={c("usage.page.summaryAria")} aria-busy={loading}><div className={styles.balance}><span>{c("usage.page.available")}</span><strong>{loading ? "…" : summary ? number(summary.creditsRemaining) : "—"}</strong></div><div className={styles.periodStats}><span>{c("usage.page.used")} <b>{loading ? "…" : summary ? number(summary.creditsUsed) : "—"}</b> {c("common.credits")}</span><span>{c("usage.page.added")} <b>{loading ? "…" : summary ? number(summary.creditsAdded) : "—"}</b> {c("common.credits")}</span><small>{dashboard ? monthLabel(dashboard.period.startAt, locale) : c("usage.page.period")}</small></div><div className={styles.topupAction}><button className={styles.primaryButton} disabled={paymentBusy} onClick={() => selectTab(3, true)}>{c("usage.page.topupButton")} <ArrowRight size={24} /></button><small>{c("usage.page.payWith")}</small></div></section>
    <div ref={tabBarRef} className={styles.tabBar} role="tablist" aria-label={c("usage.page.tabsAria")}>{tabs.map((tab, index) => <button key={tab} id={`usage-tab-${index}`} ref={element => { tabRefs.current[index] = element; }} type="button" role="tab" disabled={paymentBusy} aria-selected={activeTab === index} aria-controls={`usage-panel-${index}`} tabIndex={activeTab === index ? 0 : -1} onClick={() => selectTab(index)} onKeyDown={event => { const next = event.key === "ArrowRight" ? (index + 1) % tabs.length : event.key === "ArrowLeft" ? (index + tabs.length - 1) % tabs.length : event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : null; if (next !== null) { event.preventDefault(); selectTab(next, true); } }}>{tab}</button>)}</div>
    {error && <div className={styles.error} role="alert"><AlertCircle size={20} /><span>{c("usage.page.loadFailed")}</span><a href="/login">{c("usage.page.signIn")}</a><button onClick={reload} disabled={loading}>{c("usage.page.retry")}</button></div>}
    <div role="tabpanel" id={`usage-panel-${activeTab}`} aria-labelledby={`usage-tab-${activeTab}`} tabIndex={0}>
      {activeTab !== 3 && <div className={styles.periodControl}><MonthPicker className={styles.periodDropdown} ariaLabel={c("usage.page.monthAria")} value={month} onChange={changeMonth} options={monthOptions} /><button className={styles.refresh} aria-label={c("usage.page.refresh")} disabled={loading} onClick={reload}><RefreshCw size={16} /></button></div>}
      {activeTab === 3 ? <Topup key={`topup-${paymentReset}`} catalog={catalog} catalogError={catalogError} dashboard={dashboard} onRetry={reload} onBusyChange={setPaymentBusy} /> : activeTab === 1 || activeTab === 2 ? <Ledger key={`${month}-${activeTab}`} month={month} usageOnly={activeTab === 1} topupsOnly={activeTab === 2} refresh={refresh} /> : loading ? <div className={styles.loading} role="status">{c("usage.page.loading")}</div> : dashboard && activeTab === 0 ? <><div className={styles.overview}><section aria-label={c("usage.page.chartAria")}><UsageChart dashboard={dashboard} /></section><section className={styles.recent}><div className={styles.sectionHeading}><h2>{c("usage.page.recent")}</h2><button className={styles.textButton} onClick={() => selectTab(2, true)}>{c("usage.page.viewAll")} <ArrowRight size={18} /></button></div><ActivityRows items={dashboard.recentActivity.items.slice(0, 4)} /></section></div><section className={styles.tools} aria-label={c("usage.page.byTool")}>{[...dashboard.usageByTool.items].sort((a, b) => ["image", "video", "audio", "presenter", "document", "custom"].indexOf(a.key) - ["image", "video", "audio", "presenter", "document", "custom"].indexOf(b.key)).map(item => <div key={item.key}><ToolIcon tool={item.key} large /><span><strong>{item.label}</strong><b>{number(item.credits)} <small>{c("common.credits")}</small></b></span></div>)}</section></> : null}
    </div>
  </div>;
}
