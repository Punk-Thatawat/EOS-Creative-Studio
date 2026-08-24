"use client";

import { useMemo, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpRight,
  AudioLines,
  BarChart3,
  CalendarDays,
  ChevronDown,
  CircleHelp,
  CreditCard,
  FileText,
  ImageIcon,
  Info,
  Plus,
  Sparkles,
  UserRound,
  Users,
  Video,
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

function AssetPlaceholder({ label, className }: { label: string; className?: string }) {
  return (
    <div className={cn(styles.assetPlaceholder, className)} aria-label={`${label} asset placeholder`}>
      <Sparkles size={17} />
      <span>{label}</span>
    </div>
  );
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
        <div className={styles.planAsset}><AssetPlaceholder label="Plan visual asset" /></div>
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

function PlaceholderTab({ tab }: { tab: Exclude<UsageTab, "Overview"> }) {
  const copy: Record<Exclude<UsageTab, "Overview">, { title: string; description: string; button: string; icon: LucideIcon }> = {
    "Usage Details": { title: "Usage details are ready to explore", description: "Break down every generation by tool, project, and date range when the usage data source is connected.", button: "Export usage report", icon: ArrowDownToLine },
    "Credit History": { title: "Your credit history", description: "Review top-ups, renewals, and adjustments in one clean timeline.", button: "Download history", icon: ArrowDownToLine },
    "Team Usage": { title: "See how your team creates", description: "Compare credit usage across members and keep creative work moving together.", button: "Invite a teammate", icon: Users },
    "Billing & Plan": { title: "Plan and billing controls", description: "Manage your plan, payment method, and credit top-ups from one place.", button: "Manage billing", icon: CreditCard },
  };
  const item = copy[tab];
  const Icon = item.icon;
  return <Card className={styles.placeholderTab}><span className={styles.placeholderIcon}><BarChart3 size={25} /></span><h2>{item.title}</h2><p>{item.description}</p><button className={styles.gradientButton}>{item.button}<Icon size={15} /></button></Card>;
}

export function UsagePage() {
  const [activeTab, setActiveTab] = useState<UsageTab>("Overview");
  const [toolPeriod, setToolPeriod] = useState<SelectValue>("This billing cycle");
  const [chartRange, setChartRange] = useState<SelectValue>("Daily");

  return (
    <div className={styles.usagePage} data-page="usage">
      <div className={styles.pageIntro}>
        <div className={styles.titleBlock}>
          <h1>Usage &amp; Credits <span>ϟ</span></h1>
          <p>Track. Manage. Create <em>without limits.</em></p>
        </div>
        <div className={styles.introDecoration} aria-hidden="true"><span /><i /><b /></div>
      </div>

      <div className={styles.tabBar} role="tablist" aria-label="Usage sections">
        {tabs.map((tab) => <button key={tab} role="tab" aria-selected={activeTab === tab} className={cn(activeTab === tab && styles.activeTab)} onClick={() => setActiveTab(tab)}>{tab}</button>)}
      </div>

      {activeTab === "Overview" ? <>
        <SummaryCard />
        <div className={styles.contentGrid}>
          <div className={styles.mainColumn}>
            <div className={styles.twoColumnPanels}><UsageByTool period={toolPeriod} onPeriodChange={setToolPeriod} /><UsageChart range={chartRange} onRangeChange={setChartRange} /></div>
          </div>
          <div className={styles.sideColumn}><PlanCard /><ActivityCard /></div>
        </div>
        <div className={styles.upgradeBanner}><div className={styles.bannerMark}>MAKE<br /><b>IT</b><br /><strong>LOUD.</strong></div><div><p>Need more power?</p><strong>Upgrade your plan and unlock <em>more credits.</em></strong></div><button className={styles.bannerButton}>Upgrade now <ArrowUpRight size={16} /></button><div className={styles.bannerScribble}>⌁</div></div>
      </> : <PlaceholderTab tab={activeTab as Exclude<UsageTab, "Overview">} />}

      <div className={styles.helperLink}><CircleHelp size={14} /><span>Need a hand?</span><a href="/settings">Help center</a></div>
    </div>
  );
}
