"use client";

import { useMemo, useState } from "react";
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

const tabs: UsageTab[] = ["Overview", "Usage Details", "Credit History", "Team Usage", "Billing & Plan"];

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

function UsageByTool({ period, onPeriodChange }: { period: SelectValue; onPeriodChange: (value: SelectValue) => void }) {
  return (
    <Card className={styles.panel}>
      <SectionHeading
        title="Usage by tool"
        info
        action={<SelectControl value={period} options={["This billing cycle", "Last billing cycle"]} onChange={onPeriodChange} />}
      />
      <div className={styles.toolList}>
        {toolUsage.map((tool) => {
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
        <strong>1,750 <small>Credits</small></strong>
      </div>
    </Card>
  );
}

function UsageChart({ range, onRangeChange }: { range: SelectValue; onRangeChange: (value: SelectValue) => void }) {
  const points = useMemo(() => chartValues.map((value, index) => `${24 + index * 83},${190 - (value / 700) * 150}`).join(" "), []);
  return (
    <Card className={cn(styles.panel, styles.trendPanel)}>
      <SectionHeading title="Usage trend" info action={<SelectControl value={range} options={["Daily", "Weekly"]} onChange={onRangeChange} />} />
      <div className={styles.chartWrap}>
        <div className={styles.chartYAxis}><span>800</span><span>600</span><span>400</span><span>200</span><span>0</span></div>
        <svg className={styles.chart} viewBox="0 0 560 220" role="img" aria-label="Usage trend from 26 April to 2 May">
          <defs>
            <linearGradient id="usage-area-gradient" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="#ffb269" stopOpacity=".42" />
              <stop offset="1" stopColor="#ffb269" stopOpacity=".08" />
            </linearGradient>
          </defs>
          {[25, 65, 105, 145, 185].map((y) => <line key={y} x1="24" x2="540" y1={y} y2={y} stroke="#ece9e5" strokeDasharray="2 3" />)}
          <polygon points={`24,190 ${points} 522,190`} fill="url(#usage-area-gradient)" />
          <polyline points={points} fill="none" stroke="#ff6414" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
          {chartValues.map((value, index) => {
            const x = 24 + index * 83;
            const y = 190 - (value / 700) * 150;
            return <circle key={value + index} cx={x} cy={y} fill="#fff" r="4.5" stroke="#ff6414" strokeWidth="3" />;
          })}
          <g className={styles.chartTooltip} transform="translate(386 13)">
            <rect width="111" height="43" rx="7" fill="#111" />
            <text x="11" y="17" fill="#fff" fontSize="10" fontWeight="700">1 May 2025</text>
            <text x="11" y="32" fill="#fff" fontSize="10">620 Credits</text>
          </g>
        </svg>
        <div className={styles.chartXAxis}>{chartLabels.map((label) => <span key={label}>{label}</span>)}</div>
      </div>
      <div className={styles.chartStats}>
        <div><span>Daily average</span><strong>250 <small>Credits</small></strong><div className={styles.sparklinePink}>⌁⌁⌁</div></div>
        <div><span>Peak usage</span><strong>620 <small>Credits</small></strong><small>1 May 2025</small><div className={styles.sparklineOrange}>⌁⌁⌁</div></div>
      </div>
    </Card>
  );
}

function SummaryCard() {
  return (
    <Card className={styles.summaryCard}>
      <div className={styles.summaryHeader}>
        <div><p>Total credits</p><strong>4,250</strong><span>≈ ฿4,250.00</span><b>Available</b><small>Expires on 1 Jun 2025</small></div>
        <div className={styles.donut} aria-label="42 percent credits used"><div><strong>42%</strong><span>Used</span></div></div>
        <div className={styles.summaryMetric}><span>Credits used</span><strong>1,750 <em>42%</em></strong><small>This billing cycle</small></div>
        <div className={styles.summaryMetric}><span>Credits remaining</span><strong>4,250 <em>58%</em></strong><small>Out of 10,000</small></div>
        <div className={styles.summaryMetric}><span>Resets on</span><strong className={styles.resetDate}><CalendarDays size={18} /> 1 Jun 2025</strong><small>13 days left</small></div>
      </div>
    </Card>
  );
}

function PlanCard() {
  return (
    <Card className={styles.planCard}>
      <SectionHeading title="Plan & credit summary" />
      <div className={styles.planInner}>
        <div className={styles.planTopline}><span>Enterprise plan</span><span className={styles.planSpark}>✦</span></div>
        <p className={styles.planAllowance}>10,000 Credits <span>/ month</span></p>
        <strong className={styles.planCredits}>4,250</strong>
        <p className={styles.planAvailable}>Credits Available</p>
        <div className={styles.planProgress}><span /></div>
        <p className={styles.planRenew}>Renews on 1 Jun 2025</p>
        <div className={styles.planAsset} aria-hidden="true"><Image src="/generated-icons-v2/icon-6-custom-v2.png" alt="" fill sizes="96px" /></div>
        <button className={styles.outlineButton}>Manage plan</button>
        <button className={styles.gradientButton}>Buy more credits <ArrowUpRight size={16} /></button>
      </div>
    </Card>
  );
}

function ActivityCard() {
  return (
    <Card className={styles.activityCard}>
      <div className={styles.activityHeader}><h2>Recent credit activity</h2><button>View all</button></div>
      <div className={styles.activityList}>
        {activities.map((activity) => {
          const Icon = activity.icon;
          const isAdded = activity.iconClass === "added";
          return <div className={styles.activityRow} key={`${activity.title}-${activity.time}`}><span className={cn(styles.toolIcon, styles[activity.iconClass])}><Icon size={16} /></span><div><strong>{activity.title}</strong><span>{activity.project}</span></div><div className={cn(styles.activityAmount, isAdded && styles.positive)}><strong>{activity.credits}</strong><span>{activity.time}</span></div></div>;
        })}
      </div>
      <p className={styles.activityFooter}>Showing 1–5 of 28 activities</p>
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

function BillingPlanTab() {
  return <div className={styles.tabContent}>
    <TabHeader title="Billing & plan" description="Manage your plan, payment method, and credit top-ups." action={<button type="button" className={styles.lightAction}><CreditCard size={14} /> Manage billing</button>} />
    <div className={styles.billingGrid}>
      <Card className={styles.currentPlanPanel}>
        <div className={styles.billingPanelTop}><div><span className={styles.eyebrow}>Current plan</span><h3>Enterprise</h3><p>10,000 credits / month</p></div><span className={styles.planBadge}>Active</span></div>
        <div className={styles.billingPlanPrice}><strong>฿10,000</strong><span>/ month</span></div>
        <div className={styles.billingProgress}><span /></div><div className={styles.billingProgressMeta}><span>4,250 credits remaining</span><strong>42% used</strong></div>
        <div className={styles.billingRenew}><CalendarDays size={15} /><span>Renews on 1 Jun 2025</span><Check size={15} /></div>
        <button type="button" className={styles.gradientButton}>Change plan <ArrowUpRight size={15} /></button>
      </Card>
      <Card className={styles.billingInfoPanel}>
        <div className={styles.dataPanelHeading}><div><h3>Payment method</h3><p>Your default billing details</p></div><span className={styles.qrPill}>QR code</span></div>
        <div className={styles.paymentMethodQr}><span className={styles.paymentQrIcon}><QrCode size={20} /></span><div><strong>QR code payment</strong><span>Scan a QR code to pay your invoice securely.</span></div><span className={styles.qrAvailable}>Available</span></div>
        <div className={styles.invoiceRow}><ReceiptLine /><div><strong>Next invoice</strong><span>1 Jun 2025</span></div><strong>฿10,000</strong></div>
        <button type="button" className={styles.outlineLightButton}>View payment QR code</button>
      </Card>
    </div>
    <Card className={styles.dataPanel}>
      <div className={styles.dataPanelHeading}><div><h3>Buy more credits</h3><p>Top up your workspace when you need extra creative power.</p></div><span className={styles.creditHint}>Credits never expire</span></div>
      <div className={styles.creditPackGrid}>
        <button type="button" className={styles.creditPack}><strong>1,000</strong><span>Credits</span><b>฿1,000</b></button>
        <button type="button" className={cn(styles.creditPack, styles.featuredPack)}><em>Most popular</em><strong>5,000</strong><span>Credits</span><b>฿4,500</b></button>
        <button type="button" className={styles.creditPack}><strong>10,000</strong><span>Credits</span><b>฿8,000</b></button>
      </div>
    </Card>
  </div>;
}

function ReceiptLine() {
  return <span className={styles.receiptIcon}><FileText size={16} /></span>;
}

function PlaceholderTab({ tab }: { tab: Exclude<UsageTab, "Overview"> }) {
  const [period, setPeriod] = useState<SelectValue>("This billing cycle");
  if (tab === "Usage Details") return <UsageDetailsTab period={period} onPeriodChange={setPeriod} />;
  if (tab === "Credit History") return <CreditHistoryTab period={period} onPeriodChange={setPeriod} />;
  if (tab === "Team Usage") return <TeamUsageTab period={period} onPeriodChange={setPeriod} />;
  return <BillingPlanTab />;
}

export function UsagePage() {
  const [activeTab, setActiveTab] = useState<UsageTab>("Overview");
  const [toolPeriod, setToolPeriod] = useState<SelectValue>("This billing cycle");
  const [chartRange, setChartRange] = useState<SelectValue>("Daily");

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

          {activeTab === "Overview" ? <>
            <SummaryCard />
            <div className={styles.twoColumnPanels}><UsageByTool period={toolPeriod} onPeriodChange={setToolPeriod} /><UsageChart range={chartRange} onRangeChange={setChartRange} /></div>
          </> : <PlaceholderTab tab={activeTab as Exclude<UsageTab, "Overview">} />}
        </div>

        <div className={styles.sideColumn}><PlanCard /><ActivityCard /></div>
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
