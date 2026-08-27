"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  ArrowUpRight,
  AudioLines,
  CalendarDays,
  Check,
  ChevronDown,
  CircleHelp,
  CreditCard,
  Download,
  FileText,
  Filter,
  ImageIcon,
  Info,
  MoreHorizontal,
  Plus,
  QrCode,
  Search,
  Sparkles,
  UserRound,
  Users,
  UsersRound,
  Video,
  WalletCards,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  createBillingPortalSession,
  createCreditCheckoutSession,
  fetchBilling,
  fetchCheckoutCatalog,
  fetchUsageDashboard,
  type BillingSnapshot,
  type CheckoutCatalog,
  type UsageDashboard,
} from "@/lib/api/usage";
import { Card } from "@/components/ui/card";
import styles from "./usage-page.module.css";

type UsageTab = "Overview" | "Usage Details" | "Credit History" | "Team Usage" | "Billing & Plan";
type SelectValue = "This billing cycle" | "Last billing cycle" | "Daily" | "Weekly";

type ToolUsage = {
  name: string;
  description: string;
  credits: string;
  percent: number;
  color: string;
  icon: LucideIcon;
  iconClass: string;
};

const tabs: UsageTab[] = ["Overview", "Usage Details", "Credit History", "Billing & Plan"];

const toolUsage: ToolUsage[] = [
  { name: "AI Video", description: "Generate engaging videos", credits: "650", percent: 37, color: "#f51591", icon: Video, iconClass: "video" },
  { name: "AI Image", description: "Create stunning images", credits: "480", percent: 27, color: "#ff6b18", icon: ImageIcon, iconClass: "image" },
  { name: "AI Presenter", description: "Create AI presenters", credits: "320", percent: 18, color: "#13c9b2", icon: UserRound, iconClass: "presenter" },
  { name: "AI Audio", description: "Generate voiceovers & music", credits: "180", percent: 10, color: "#5d1db8", icon: AudioLines, iconClass: "audio" },
  { name: "AI Document", description: "Smart docs with AI & OCR", credits: "120", percent: 7, color: "#1687d9", icon: FileText, iconClass: "document" },
  { name: "Custom AI", description: "Custom AI workflows", credits: "—", percent: 1, color: "#e8bd35", icon: Sparkles, iconClass: "custom" },
];

const activities = [
  { title: "AI Video Generation", project: "Product: Product Launch", credits: "-150", time: "2 May 2025, 10:45 AM", icon: Video, iconClass: "video" },
  { title: "AI Image Generation", project: "Project: Social Post", credits: "-80", time: "2 May 2025, 09:30 AM", icon: ImageIcon, iconClass: "image" },
  { title: "AI Presenter Generation", project: "Project: Company Intro", credits: "-120", time: "1 May 2025, 04:20 PM", icon: UserRound, iconClass: "presenter" },
  { title: "Credits Added", project: "Manual top-up", credits: "+2,000", time: "30 Apr 2025, 11:10 AM", icon: Plus, iconClass: "added" },
  { title: "AI Document (OCR)", project: "Project: Report", credits: "-40", time: "30 Apr 2025, 10:05 AM", icon: FileText, iconClass: "document" },
];

const chartValues = [150, 320, 210, 270, 390, 620, 300];
const chartLabels = ["26 Apr", "27 Apr", "28 Apr", "29 Apr", "30 Apr", "1 May", "2 May"];

const usageDetails = [
  { title: "AI Video Generation", project: "Product Launch", detail: "2 May 2025 · 10:45 AM", usage: "1 generation", credits: "-150", icon: Video, iconClass: "video" },
  { title: "AI Image Generation", project: "Social Post", detail: "2 May 2025 · 09:30 AM", usage: "4 images", credits: "-80", icon: ImageIcon, iconClass: "image" },
  { title: "AI Presenter Generation", project: "Company Intro", detail: "1 May 2025 · 04:20 PM", usage: "1 presenter", credits: "-120", icon: UserRound, iconClass: "presenter" },
  { title: "AI Audio Generation", project: "Brand Voice", detail: "1 May 2025 · 01:10 PM", usage: "2 minutes", credits: "-65", icon: AudioLines, iconClass: "audio" },
  { title: "AI Document (OCR)", project: "Quarterly Report", detail: "30 Apr 2025 · 10:05 AM", usage: "12 pages", credits: "-40", icon: FileText, iconClass: "document" },
  { title: "Custom AI Workflow", project: "Campaign Toolkit", detail: "29 Apr 2025 · 03:50 PM", usage: "1 workflow", credits: "-25", icon: Sparkles, iconClass: "custom" },
];

const creditEvents = [
  { title: "Credits used", description: "AI Video Generation · Product Launch", date: "2 May 2025, 10:45 AM", amount: "-150", balance: "4,250", icon: Video, iconClass: "video" },
  { title: "Credits used", description: "AI Image Generation · Social Post", date: "2 May 2025, 09:30 AM", amount: "-80", balance: "4,400", icon: ImageIcon, iconClass: "image" },
  { title: "Credits added", description: "Manual top-up · 2,000 credits", date: "30 Apr 2025, 11:10 AM", amount: "+2,000", balance: "4,480", icon: Plus, iconClass: "added" },
  { title: "Monthly credits renewed", description: "Enterprise plan · May 2025", date: "1 May 2025, 12:00 AM", amount: "+10,000", balance: "2,480", icon: Sparkles, iconClass: "custom" },
  { title: "Credits used", description: "AI Document (OCR) · Quarterly Report", date: "30 Apr 2025, 10:05 AM", amount: "-40", balance: "2,480", icon: FileText, iconClass: "document" },
];

const teamMembers = [
  { name: "EOS Admin", email: "admin@eoscreative.studio", role: "Owner", credits: "820", percent: 47, color: "#f51591", initials: "EA" },
  { name: "Nina S.", email: "nina@eoscreative.studio", role: "Editor", credits: "510", percent: 29, color: "#ff6414", initials: "NS" },
  { name: "Mark T.", email: "mark@eoscreative.studio", role: "Editor", credits: "280", percent: 16, color: "#13c9b2", initials: "MT" },
  { name: "Ploy K.", email: "ploy@eoscreative.studio", role: "Viewer", credits: "140", percent: 8, color: "#5d1db8", initials: "PK" },
];

const toolColors: Record<string, string> = { video: "#f51591", image: "#ff6b18", presenter: "#13c9b2", audio: "#5d1db8", document: "#1687d9", custom: "#e8bd35" };
const toolIcons: Record<string, { icon: LucideIcon; iconClass: string }> = {
  video: { icon: Video, iconClass: "video" },
  image: { icon: ImageIcon, iconClass: "image" },
  presenter: { icon: UserRound, iconClass: "presenter" },
  audio: { icon: AudioLines, iconClass: "audio" },
  document: { icon: FileText, iconClass: "document" },
  custom: { icon: Sparkles, iconClass: "custom" },
};

function formatCredits(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}

function formatActivityDate(value: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function formatMoney(amountMinor: number | null, currency: string | null): string {
  if (amountMinor === null || !currency) return "—";
  return new Intl.NumberFormat("th-TH", { style: "currency", currency, maximumFractionDigits: 2 }).format(amountMinor / 100);
}

function getToolUsageRows(dashboard: UsageDashboard | null): ToolUsage[] {
  if (!dashboard) return toolUsage;
  return dashboard.usageByTool.items.map((item) => {
    const visual = toolIcons[item.key] ?? toolIcons.custom;
    return { name: item.label, description: item.description, credits: formatCredits(item.credits), percent: item.percent, color: toolColors[item.key] ?? toolColors.custom, icon: visual.icon, iconClass: visual.iconClass };
  });
}

function getActivityVisual(title: string): { icon: LucideIcon; iconClass: string } {
  const lower = title.toLowerCase();
  if (lower.includes("video")) return toolIcons.video;
  if (lower.includes("image")) return toolIcons.image;
  if (lower.includes("presenter")) return toolIcons.presenter;
  if (lower.includes("audio")) return toolIcons.audio;
  if (lower.includes("document") || lower.includes("ocr")) return toolIcons.document;
  if (lower.includes("added") || lower.includes("purchased")) return { icon: Plus, iconClass: "added" };
  return toolIcons.custom;
}

function SelectControl({ value, options, onChange }: { value: SelectValue; options: SelectValue[]; onChange: (value: SelectValue) => void }) {
  return (
    <label className={styles.selectControl}>
      <span className="sr-only">Select usage period</span>
      <select value={value} onChange={(event) => onChange(event.target.value as SelectValue)}>
        {options.map((option) => <option key={option}>{option}</option>)}
      </select>
      <ChevronDown size={15} aria-hidden="true" />
    </label>
  );
}

function SectionHeading({ title, description, info = false, action }: { title: string; description?: string; info?: boolean; action?: React.ReactNode }) {
  return (
    <div className={styles.sectionHeading}>
      <div>
        <div className={styles.sectionTitleRow}>
          <h2>{title}</h2>
          {info ? <Info size={13} aria-label={`About ${title}`} /> : null}
        </div>
        {description ? <p>{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

function UsageByTool({ period, onPeriodChange, dashboard }: { period: SelectValue; onPeriodChange: (value: SelectValue) => void; dashboard: UsageDashboard | null }) {
  const rows = getToolUsageRows(dashboard);
  return (
    <Card className={styles.panel}>
      <SectionHeading
        title="Usage by tool"
        info
        action={<SelectControl value={period} options={["This billing cycle", "Last billing cycle"]} onChange={onPeriodChange} />}
      />
      <div className={styles.toolList}>
        {rows.map((tool) => {
          const Icon = tool.icon;
          return (
            <div className={styles.toolRow} key={tool.name}>
              <span className={cn(styles.toolIcon, styles[tool.iconClass])}><Icon size={17} /></span>
              <div className={styles.toolCopy}>
                <strong>{tool.name}</strong>
                <span>{tool.description}</span>
              </div>
              <div className={styles.toolBar} aria-label={`${tool.name}: ${tool.percent}%`}><span style={{ width: `${tool.percent}%`, backgroundColor: tool.color }} /></div>
              <div className={styles.toolAmount}><strong>{tool.credits}</strong><span>Credits</span></div>
              <span className={styles.toolPercent}>{tool.percent}%</span>
            </div>
          );
        })}
      </div>
      <div className={styles.toolTotal}>
        <span>Total Used</span>
        <strong>{formatCredits(dashboard?.usageByTool.totalUsed ?? 1750)} <small>Credits</small></strong>
      </div>
    </Card>
  );
}

function UsageChart({ range, onRangeChange, dashboard }: { range: SelectValue; onRangeChange: (value: SelectValue) => void; dashboard: UsageDashboard | null }) {
  const trendPoints = dashboard?.trend.points ?? chartValues.map((credits, index) => ({ date: `2025-05-${String(index + 1).padStart(2, "0")}`, label: chartLabels[index], credits }));
  const maxCredits = Math.max(800, ...trendPoints.map((point) => point.credits));
  const points = useMemo(() => trendPoints.map((point, index) => {
    const x = trendPoints.length === 1 ? 24 : 24 + (index * 498) / (trendPoints.length - 1);
    return `${x},${190 - (point.credits / maxCredits) * 150}`;
  }).join(" "), [maxCredits, trendPoints]);
  const labels = trendPoints.length > 7 ? trendPoints.filter((_, index) => index === 0 || index === trendPoints.length - 1 || index % Math.ceil(trendPoints.length / 6) === 0).map((point) => point.label) : trendPoints.map((point) => point.label);
  const peak = dashboard?.trend.peakAt ? { date: dashboard.trend.peakAt, credits: dashboard.trend.peakCredits } : trendPoints.reduce((best, point) => point.credits > best.credits ? point : best, trendPoints[0]);
  return (
    <Card className={cn(styles.panel, styles.trendPanel)}>
      <SectionHeading title="Usage trend" info action={<SelectControl value={range} options={["Daily", "Weekly"]} onChange={onRangeChange} />} />
      <div className={styles.chartWrap}>
        <div className={styles.chartYAxis}><span>800</span><span>600</span><span>400</span><span>200</span><span>0</span></div>
        <svg className={styles.chart} viewBox="0 0 560 220" role="img" aria-label={`Usage trend for ${range.toLowerCase()}`}>
          <defs>
            <linearGradient id="usage-area-gradient" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="#ffb269" stopOpacity=".42" />
              <stop offset="1" stopColor="#ffb269" stopOpacity=".08" />
            </linearGradient>
          </defs>
          {[25, 65, 105, 145, 185].map((y) => <line key={y} x1="24" x2="540" y1={y} y2={y} stroke="#ece9e5" strokeDasharray="2 3" />)}
          <polygon points={`24,190 ${points} 522,190`} fill="url(#usage-area-gradient)" />
          <polyline points={points} fill="none" stroke="#ff6414" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
          {trendPoints.map((point, index) => {
            const x = trendPoints.length === 1 ? 24 : 24 + (index * 498) / (trendPoints.length - 1);
            const y = 190 - (point.credits / maxCredits) * 150;
            return <circle key={point.date + index} cx={x} cy={y} fill="#fff" r="4.5" stroke="#ff6414" strokeWidth="3" />;
          })}
          <g className={styles.chartTooltip} transform="translate(386 13)">
            <rect width="111" height="43" rx="7" fill="#111" />
            <text x="11" y="17" fill="#fff" fontSize="10" fontWeight="700">{formatDate(peak?.date ?? null)}</text>
            <text x="11" y="32" fill="#fff" fontSize="10">{formatCredits(peak?.credits ?? 0)} Credits</text>
          </g>
        </svg>
        <div className={styles.chartXAxis}>{labels.map((label, index) => <span key={`${label}-${index}`}>{label}</span>)}</div>
      </div>
      <div className={styles.chartStats}>
        <div><span>{range === "Weekly" ? "Weekly average" : "Daily average"}</span><strong>{formatCredits(dashboard?.trend.averageCredits ?? 250)} <small>Credits</small></strong><div className={styles.sparklinePink}>⌁⌁⌁</div></div>
        <div><span>Peak usage</span><strong>{formatCredits(peak?.credits ?? 0)} <small>Credits</small></strong><small>{formatDate(peak?.date ?? null)}</small><div className={styles.sparklineOrange}>⌁⌁⌁</div></div>
      </div>
    </Card>
  );
}

function SummaryCard({ dashboard }: { dashboard: UsageDashboard | null }) {
  const summary = dashboard?.summary ?? { totalCredits: 4250, creditsUsed: 1750, creditsRemaining: 4250, creditsAdded: 2000, planCredits: 10000, usedPercent: 42, remainingPercent: 58, walletValueThb: 4250, walletUpdatedAt: null, transactionCount: 28 };
  const usedPercent = summary.usedPercent;
  return (
    <Card className={styles.summaryCard}>
      <div className={styles.summaryHeader}>
        <div><p>Total credits</p><strong>{formatCredits(summary.totalCredits)}</strong><span>≈ ฿{formatCredits(summary.walletValueThb)}</span><b>Available</b><small>Updated {formatDate(summary.walletUpdatedAt)}</small></div>
        <div className={styles.donut} style={{ background: `conic-gradient(#ff6414 0 ${usedPercent}%, #4b4b4b ${usedPercent}% 100%)` }} aria-label={`${usedPercent} percent credits used`}><div><strong>{usedPercent}%</strong><span>Used</span></div></div>
        <div className={styles.summaryMetric}><span>Credits used</span><strong>{formatCredits(summary.creditsUsed)} <em>{usedPercent}%</em></strong><small>{dashboard?.period.label ?? "This billing cycle"}</small></div>
        <div className={styles.summaryMetric}><span>Credits remaining</span><strong>{formatCredits(summary.creditsRemaining)} <em>{summary.remainingPercent}%</em></strong><small>{summary.planCredits > 0 ? `Out of ${formatCredits(summary.planCredits)}` : "Wallet balance"}</small></div>
        <div className={styles.summaryMetric}><span>Resets on</span><strong className={styles.resetDate}><CalendarDays size={18} /> {formatDate(dashboard?.period.endAt ?? null)}</strong><small>{dashboard?.period.endAt ? "End of billing cycle" : "—"}</small></div>
      </div>
    </Card>
  );
}

function PlanCard({ dashboard, onManage, onBuy, catalog, busy }: { dashboard: UsageDashboard | null; onManage: () => void; onBuy: (packageId: string) => void; catalog: CheckoutCatalog | null; busy: boolean }) {
  const plan = dashboard?.plan;
  const topup = catalog?.topups.find((item) => item.featured) ?? catalog?.topups[0];
  return (
    <Card className={styles.planCard}>
      <SectionHeading title="Plan & credit summary" />
      <div className={styles.planInner}>
        <div className={styles.planTopline}><span>{plan?.name ?? "Stripe plan"}</span><span className={styles.planSpark}>✦</span></div>
        <p className={styles.planAllowance}>{plan?.creditsPerCycle ? `${formatCredits(plan.creditsPerCycle)} Credits` : "Credits"} <span>{plan?.cycle ? `/ ${plan.cycle}` : ""}</span></p>
        <strong className={styles.planCredits}>{formatCredits(dashboard?.summary.creditsRemaining ?? 4250)}</strong>
        <p className={styles.planAvailable}>Credits Available</p>
        <div className={styles.planProgress}><span style={{ width: `${dashboard?.summary.usedPercent ?? 42}%` }} /></div>
        <p className={styles.planRenew}>{plan?.renewsAt ? `Renews on ${formatDate(plan.renewsAt)}` : "Stripe billing is not configured"}</p>
        <div className={styles.planAsset} aria-hidden="true"><Image src="/generated-icons-v2/icon-6-custom-v2.png" alt="" fill sizes="96px" /></div>
        <button type="button" className={styles.outlineButton} onClick={onManage}>Manage plan</button>
        <button type="button" className={styles.gradientButton} onClick={() => topup && onBuy(topup.id)} disabled={!topup || busy}>Buy more credits <ArrowUpRight size={16} /></button>
      </div>
    </Card>
  );
}

function ActivityCard({ dashboard }: { dashboard: UsageDashboard | null }) {
  const items = dashboard?.recentActivity.items;
  return (
    <Card className={styles.activityCard}>
      <div className={styles.activityHeader}><h2>Recent credit activity</h2><button>View all</button></div>
      <div className={styles.activityList}>
        {(items ?? activities).map((activity) => {
          const title = activity.title;
          const visual = "icon" in activity ? { icon: activity.icon, iconClass: activity.iconClass } : getActivityVisual(title);
          const Icon = visual.icon;
          const amount = "amount" in activity ? activity.amount : Number(activity.credits.replace(",", ""));
          const subtitle = "subtitle" in activity ? activity.subtitle : activity.project;
          const createdAt = "createdAt" in activity ? formatActivityDate(activity.createdAt) : activity.time;
          return <div className={styles.activityRow} key={"id" in activity ? activity.id : `${activity.title}-${createdAt}`}><span className={cn(styles.toolIcon, styles[visual.iconClass])}><Icon size={16} /></span><div><strong>{title}</strong><span>{subtitle}</span></div><div className={cn(styles.activityAmount, amount >= 0 && styles.positive)}><strong>{amount >= 0 ? "+" : ""}{formatCredits(amount)}</strong><span>{createdAt}</span></div></div>;
        })}
      </div>
      <p className={styles.activityFooter}>Showing {items?.length ?? 5} of {dashboard?.recentActivity.pagination.total ?? 28} activities</p>
    </Card>
  );
}

function TabKpi({ label, value, detail, tone = "neutral" }: { label: string; value: string; detail: string; tone?: "neutral" | "pink" | "orange" | "green" }) {
  return <div className={cn(styles.tabKpi, styles[tone])}><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>;
}

function TabHeader({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return <div className={styles.tabHeader}><div><h2>{title}</h2><p>{description}</p></div>{action ? <div className={styles.tabActions}>{action}</div> : null}</div>;
}

function UsageDetailsTab({ period, onPeriodChange }: { period: SelectValue; onPeriodChange: (value: SelectValue) => void }) {
  return <div className={styles.tabContent}>
    <TabHeader
      title="Usage details"
      description="Review every generation and see exactly where your credits are going."
      action={<><SelectControl value={period} options={["This billing cycle", "Last billing cycle"]} onChange={onPeriodChange} /><button type="button" className={styles.softButton}><Filter size={14} /> Filter</button><button type="button" className={styles.lightAction}><Download size={14} /> Export report</button></>}
    />
    <div className={styles.kpiGrid}>
      <TabKpi label="Credits used" value="1,750" detail="This billing cycle" tone="pink" />
      <TabKpi label="Generations" value="128" detail="Across 6 tools" tone="orange" />
      <TabKpi label="Top tool" value="AI Video" detail="37% of usage" tone="green" />
      <TabKpi label="Average / day" value="250" detail="Credits per day" />
    </div>
    <Card className={styles.dataPanel}>
      <div className={styles.dataPanelHeading}><div><h3>Generation activity</h3><p>Latest usage from your workspace</p></div><button type="button" className={styles.iconButton} aria-label="Search usage"><Search size={16} /></button></div>
      <div className={styles.dataTable}>
        <div className={styles.dataTableHeader}><span>Activity</span><span>Usage</span><span>Credits</span><span>Status</span><span aria-hidden="true" /></div>
        {usageDetails.map((item) => {
          const Icon = item.icon;
          return <div className={styles.dataTableRow} key={`${item.title}-${item.detail}`}>
            <div className={styles.tableActivity}><span className={cn(styles.toolIcon, styles[item.iconClass])}><Icon size={16} /></span><div><strong>{item.title}</strong><span>{item.project} · {item.detail}</span></div></div>
            <span className={styles.tableMuted}>{item.usage}</span>
            <strong className={styles.tableAmount}>{item.credits}</strong>
            <span className={styles.statusPill}><Check size={12} /> Completed</span>
            <button type="button" className={styles.moreButton} aria-label={`More options for ${item.title}`}><MoreHorizontal size={16} /></button>
          </div>;
        })}
      </div>
      <div className={styles.dataPanelFooter}><span>Showing 1–6 of 128 generations</span><button type="button">View all usage <ArrowUpRight size={14} /></button></div>
    </Card>
  </div>;
}

function CreditHistoryTab({ period, onPeriodChange }: { period: SelectValue; onPeriodChange: (value: SelectValue) => void }) {
  return <div className={styles.tabContent}>
    <TabHeader
      title="Credit history"
      description="A clear timeline of credits added, renewed, and spent."
      action={<><SelectControl value={period} options={["This billing cycle", "Last billing cycle"]} onChange={onPeriodChange} /><button type="button" className={styles.lightAction}><Download size={14} /> Download history</button></>}
    />
    <div className={styles.historySummary}>
      <div className={styles.historyBalance}><div><span>Current balance</span><strong>4,250 <small>Credits</small></strong><p>Available until 1 Jun 2025</p></div><div className={styles.historyBalanceArt}><WalletCards size={38} /></div></div>
      <TabKpi label="Added this cycle" value="12,000" detail="Credits" tone="green" />
      <TabKpi label="Used this cycle" value="1,750" detail="Credits" tone="orange" />
    </div>
    <Card className={styles.dataPanel}>
      <div className={styles.dataPanelHeading}><div><h3>Credit movements</h3><p>All balance changes in your workspace</p></div><span className={styles.balanceLabel}>Balance after activity</span></div>
      <div className={styles.historyList}>
        {creditEvents.map((event) => {
          const Icon = event.icon;
          const isPositive = event.amount.startsWith("+");
          return <div className={styles.historyRow} key={`${event.title}-${event.date}`}><span className={cn(styles.toolIcon, styles[event.iconClass])}><Icon size={16} /></span><div className={styles.historyCopy}><strong>{event.title}</strong><span>{event.description}</span><small>{event.date}</small></div><strong className={cn(styles.historyAmount, isPositive && styles.positive)}>{event.amount}</strong><span className={styles.historyBalanceValue}>{event.balance}</span></div>;
        })}
      </div>
      <div className={styles.dataPanelFooter}><span>Showing 1–5 of 28 credit movements</span><button type="button">View full history <ArrowUpRight size={14} /></button></div>
    </Card>
  </div>;
}

function TeamUsageTab({ period, onPeriodChange }: { period: SelectValue; onPeriodChange: (value: SelectValue) => void }) {
  return <div className={styles.tabContent}>
    <TabHeader
      title="Team usage"
      description="See how your team creates together and keep usage balanced."
      action={<><SelectControl value={period} options={["This billing cycle", "Last billing cycle"]} onChange={onPeriodChange} /><button type="button" className={styles.lightAction}><UsersRound size={14} /> Invite teammate</button></>}
    />
    <div className={styles.kpiGrid}>
      <TabKpi label="Team credits used" value="1,750" detail="42% of allowance" tone="pink" />
      <TabKpi label="Active creators" value="4" detail="Out of 8 seats" tone="green" />
      <TabKpi label="Average / member" value="438" detail="Credits this cycle" tone="orange" />
      <TabKpi label="Most active" value="EOS Admin" detail="47% of team usage" />
    </div>
    <Card className={styles.dataPanel}>
      <div className={styles.dataPanelHeading}><div><h3>Usage by member</h3><p>Credits used during this billing cycle</p></div><button type="button" className={styles.iconButton} aria-label="Team settings"><Users size={16} /></button></div>
      <div className={styles.memberTable}>
        <div className={styles.memberTableHeader}><span>Member</span><span>Role</span><span>Usage</span><span>Share</span><span aria-hidden="true" /></div>
        {teamMembers.map((member) => <div className={styles.memberRow} key={member.email}>
          <div className={styles.memberIdentity}><span className={styles.memberAvatar} style={{ backgroundColor: member.color }}>{member.initials}</span><div><strong>{member.name}</strong><span>{member.email}</span></div></div>
          <span className={styles.rolePill}>{member.role}</span>
          <div className={styles.memberUsage}><strong>{member.credits} <small>Credits</small></strong><span><i style={{ width: `${member.percent}%`, backgroundColor: member.color }} /></span></div>
          <strong className={styles.memberPercent}>{member.percent}%</strong>
          <button type="button" className={styles.moreButton} aria-label={`More options for ${member.name}`}><MoreHorizontal size={16} /></button>
        </div>)}
      </div>
      <div className={styles.dataPanelFooter}><span>4 active members · 8 total seats</span><button type="button">Manage team <ArrowUpRight size={14} /></button></div>
    </Card>
  </div>;
}

function BillingPlanTab({ dashboard, billing, catalog, onManage, onBuy, busy, error }: { dashboard: UsageDashboard | null; billing: BillingSnapshot | null; catalog: CheckoutCatalog | null; onManage: () => void; onBuy: (packageId: string) => void; busy: boolean; error: string | null }) {
  const plan = dashboard?.plan;
  const summary = dashboard?.summary;
  const currentBilling = billing ?? dashboard?.billing;
  const topups = catalog?.topups ?? [];
  return <div className={styles.tabContent}>
    <TabHeader title="Billing & plan" description="Manage your plan, payment method, and credit top-ups." action={<button type="button" className={styles.lightAction} onClick={onManage}><CreditCard size={14} /> Manage billing</button>} />
    <div className={styles.billingGrid}>
      <Card className={styles.currentPlanPanel}>
        <div className={styles.billingPanelTop}><div><span className={styles.eyebrow}>Current plan</span><h3>{plan?.name ?? "No active plan"}</h3><p>{plan?.creditsPerCycle ? `${formatCredits(plan.creditsPerCycle)} credits / ${plan.cycle ?? "cycle"}` : "Stripe subscription not configured"}</p></div><span className={styles.planBadge}>{currentBilling?.status ?? "—"}</span></div>
        <div className={styles.billingPlanPrice}><strong>{formatMoney(currentBilling?.unitAmount ?? null, currentBilling?.currency ?? null)}</strong><span>{currentBilling?.interval ? `/ ${currentBilling.interval}` : ""}</span></div>
        <div className={styles.billingProgress}><span style={{ width: `${summary?.usedPercent ?? 0}%` }} /></div><div className={styles.billingProgressMeta}><span>{formatCredits(summary?.creditsRemaining ?? 0)} credits remaining</span><strong>{summary?.usedPercent ?? 0}% used</strong></div>
        <div className={styles.billingRenew}><CalendarDays size={15} /><span>{plan?.renewsAt ? `Renews on ${formatDate(plan.renewsAt)}` : "No renewal date"}</span><Check size={15} /></div>
        <button type="button" className={styles.gradientButton} onClick={onManage}>Manage Stripe billing <ArrowUpRight size={15} /></button>
      </Card>
      <Card className={styles.billingInfoPanel}>
        <div className={styles.dataPanelHeading}><div><h3>PromptPay QR</h3><p>Secure payment through Stripe Checkout</p></div><span className={styles.qrPill}>QR code</span></div>
        <div className={styles.paymentMethodQr}><span className={styles.paymentQrIcon}><QrCode size={20} /></span><div><strong>Pay with PromptPay</strong><span>Stripe will show a QR code after you select a credit pack.</span></div><span className={styles.qrAvailable}>{catalog?.promptPay ? "Available" : "Setup needed"}</span></div>
        <div className={styles.invoiceRow}><ReceiptLine /><div><strong>Payment provider</strong><span>Stripe · PromptPay</span></div><strong>THB</strong></div>
        <button type="button" className={styles.outlineLightButton} onClick={() => topups[0] && onBuy(topups[0].id)} disabled={!topups[0] || busy}><QrCode size={14} /> View payment QR code</button>
      </Card>
    </div>
    <Card className={styles.dataPanel}>
      <div className={styles.dataPanelHeading}><div><h3>Buy more credits</h3><p>Top up your workspace when you need extra creative power.</p></div><span className={styles.creditHint}>Credits never expire</span></div>
      <div className={styles.creditPackGrid}>
        {topups.map((topup) => <button key={topup.id} type="button" className={cn(styles.creditPack, topup.featured && styles.featuredPack)} onClick={() => onBuy(topup.id)} disabled={busy}><>{topup.featured ? <em>Most popular</em> : null}</><strong>{formatCredits(topup.credits)}</strong><span>Credits</span><b>฿{formatCredits(topup.amountThb)} · PromptPay QR</b></button>)}
      </div>
      {topups.length === 0 ? <p className={styles.billingError}>No credit packages are available yet.</p> : null}
      {error ? <p className={styles.billingError}>{error}</p> : null}
    </Card>
  </div>;
}

function ReceiptLine() {
  return <span className={styles.receiptIcon}><FileText size={16} /></span>;
}

function PlaceholderTab({ tab, dashboard, billing, catalog, onManage, onBuy, busy, error }: { tab: Exclude<UsageTab, "Overview">; dashboard: UsageDashboard | null; billing: BillingSnapshot | null; catalog: CheckoutCatalog | null; onManage: () => void; onBuy: (packageId: string) => void; busy: boolean; error: string | null }) {
  const [period, setPeriod] = useState<SelectValue>("This billing cycle");
  if (tab === "Usage Details") return <UsageDetailsTab period={period} onPeriodChange={setPeriod} />;
  if (tab === "Credit History") return <CreditHistoryTab period={period} onPeriodChange={setPeriod} />;
  if (tab === "Team Usage") return <TeamUsageTab period={period} onPeriodChange={setPeriod} />;
  return <BillingPlanTab dashboard={dashboard} billing={billing} catalog={catalog} onManage={onManage} onBuy={onBuy} busy={busy} error={error} />;
}

export function UsagePage() {
  const [activeTab, setActiveTab] = useState<UsageTab>("Overview");
  const [toolPeriod, setToolPeriod] = useState<SelectValue>("This billing cycle");
  const [chartRange, setChartRange] = useState<SelectValue>("Daily");
  const [dashboard, setDashboard] = useState<UsageDashboard | null>(null);
  const [billing, setBilling] = useState<BillingSnapshot | null>(null);
  const [catalog, setCatalog] = useState<CheckoutCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const period = toolPeriod === "Last billing cycle" ? "previous" : "current";
    const trend = chartRange === "Weekly" ? "weekly" : "daily";

    void Promise.allSettled([fetchUsageDashboard(period, trend), fetchBilling(), fetchCheckoutCatalog()]).then(([usageResult, billingResult, catalogResult]) => {
      if (cancelled) return;
      if (usageResult.status === "fulfilled") {
        setDashboard(usageResult.value);
        setBilling(usageResult.value.billing);
      } else {
        setLoadError(usageResult.reason instanceof Error ? usageResult.reason.message : "Unable to load usage data");
      }
      if (billingResult.status === "fulfilled") setBilling(billingResult.value);
      if (catalogResult.status === "fulfilled") setCatalog(catalogResult.value);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [chartRange, toolPeriod]);

  const handleManageBilling = async () => {
    setBillingError(null);
    setBusyAction(true);
    try {
      const session = await createBillingPortalSession();
      window.location.assign(session.url);
    } catch (error) {
      setBillingError(error instanceof Error ? error.message : "Unable to open Stripe billing");
    } finally {
      setBusyAction(false);
    }
  };

  const handleBuyCredits = async (packageId: string) => {
    setBillingError(null);
    setBusyAction(true);
    try {
      const session = await createCreditCheckoutSession(packageId);
      window.location.assign(session.url);
    } catch (error) {
      setBillingError(error instanceof Error ? error.message : "Unable to open PromptPay checkout");
      setBusyAction(false);
    }
  };

  return (
    <div className={styles.usagePage} data-page="usage">
      <div className={styles.pageLayout}>
        <div className={styles.primaryColumn}>
          <div className={styles.pageIntro}>
            <div className={styles.titleBlock}>
              <h1>Usage &amp; Credit <Zap aria-hidden="true" /></h1>
              <p>Track. Manage. Create <em>without limits.</em></p>
            </div>
            <div className={styles.introDecoration} aria-hidden="true"><span /><i /><b /></div>
          </div>

          <div className={styles.tabBar} role="tablist" aria-label="Usage sections">
            {tabs.map((tab) => <button key={tab} role="tab" aria-selected={activeTab === tab} className={cn(activeTab === tab && styles.activeTab)} onClick={() => setActiveTab(tab)}>{tab}</button>)}
          </div>

          {loadError ? <Card className={styles.dataPanel}><p className={styles.billingError}>{loadError}</p></Card> : null}
          {activeTab === "Overview" ? <>
            {loading && !dashboard ? <Card className={styles.dataPanel}><p>Loading live usage data…</p></Card> : null}
            <SummaryCard dashboard={dashboard} />
            <div className={styles.twoColumnPanels}><UsageByTool period={toolPeriod} onPeriodChange={setToolPeriod} dashboard={dashboard} /><UsageChart range={chartRange} onRangeChange={setChartRange} dashboard={dashboard} /></div>
          </> : <PlaceholderTab tab={activeTab as Exclude<UsageTab, "Overview">} dashboard={dashboard} billing={billing} catalog={catalog} onManage={handleManageBilling} onBuy={handleBuyCredits} busy={busyAction} error={billingError} />}
        </div>

        <div className={styles.sideColumn}><PlanCard dashboard={dashboard} onManage={handleManageBilling} onBuy={handleBuyCredits} catalog={catalog} busy={busyAction} /><ActivityCard dashboard={dashboard} /></div>
      </div>

      {activeTab === "Overview" ? <div className={styles.upgradeBanner}>
        <Image className={styles.bannerArtwork} src="/generated-assets/landing-cta-artwork-transparent-v2.png" alt="" fill sizes="(min-width: 1024px) 1230px, 100vw" priority />
        <div className={styles.bannerMark}>MAKE<br /><b>IT</b><br /><strong>LOUD.</strong></div><div className={styles.bannerCopy}><p>Need more power?</p><strong>Upgrade your plan and unlock <em>more credits.</em></strong></div><button className={styles.bannerButton}>Upgrade now <ArrowUpRight size={16} /></button><div className={styles.bannerScribble} aria-hidden="true">⌁</div>
      </div> : null}

      {/* Keep the help affordance below the full overview canvas. */}
      <div className={styles.helperLink}><CircleHelp size={14} /><span>Need a hand?</span><a href="/settings">Help center</a></div>
    </div>
  );
}
