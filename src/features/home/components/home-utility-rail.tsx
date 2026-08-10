import Link from "next/link";
import Image from "next/image";
import { Check, Clock3 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { activeJobs } from "@/features/home/data/active-jobs";
import { credits } from "@/features/home/data/credits";

const jobArt = { food: "bg-[#d99d62]", presenter: "bg-[#8ea6bb]", image: "bg-[#e9c8ae]" };

function CreditsCard() {
  return <Card className="relative overflow-hidden border-[#343231] bg-[#201d1b] text-white">
    <div className="absolute inset-0 bg-cover opacity-90" style={{ backgroundImage: "url('/generated-icons-v2/credits-overview-bg.png')", backgroundPosition: "right center" }} aria-hidden="true" />
    <div className="relative z-10 p-4 sm:p-5">
      <div className="flex items-center justify-between"><p className="text-[11px] font-black uppercase tracking-wide">Credits overview</p><Link href="/usage" className="text-[10px] font-bold text-primary">View details</Link></div>
      <div className="relative mt-4 min-h-[92px] pr-[82px]"><div><div className="flex items-baseline gap-2"><p className="text-4xl font-black leading-none tracking-tight">{credits.available}</p><span className="text-xs font-bold text-white">Credits</span></div><p className="mt-2 text-xs text-white/70">≈ ฿4,250.00</p></div><div className="absolute right-0 top-0 flex h-16 w-16 items-center justify-center rounded-full" style={{ background: `conic-gradient(#f26b38 ${credits.usedPercent}%, #45413e 0)` }}><span className="flex h-12 w-12 flex-col items-center justify-center rounded-full bg-[#201d1b] text-[10px] font-bold"><strong className="text-sm">{credits.usedPercent}%</strong>Used</span></div></div>
      <div className="text-[10px] font-bold">PLAN</div><div className="mt-2 flex items-center justify-between text-[11px]"><span className="font-bold">{credits.plan}</span><span className="text-white/80">{credits.renewal}</span></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/20"><div className="h-full w-[42%] rounded-full bg-primary" /></div><p className="mt-3 text-right text-xs font-bold text-white">{credits.available} / {credits.allowance} Credits</p>
    </div>
  </Card>;
}

function JobsCard() { return <Card><div className="flex items-center justify-between p-5 pb-3"><h2 className="text-sm font-black">Jobs in progress</h2><Link href="/history" className="text-[10px] font-bold text-primary">View all</Link></div><div className="space-y-1 px-5 pb-4">{activeJobs.map((job) => { const Icon = job.status === "completed" ? Check : Clock3; return <div key={job.title} className="flex gap-3 py-3"><div className={`relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl ${jobArt[job.art]}`}>{job.imageSrc ? <Image src={job.imageSrc} alt="" fill sizes="40px" className="object-cover" /> : <span className="h-5 w-5 rounded-md bg-white/70" />}</div><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><p className="truncate text-xs font-bold">{job.title}</p>{job.status === "completed" ? <span className="text-[#3a9a64]"><Check size={14} /></span> : <span className="text-[10px] font-bold text-muted-foreground">{job.elapsed}</span>}</div><p className="mt-1 truncate text-[10px] text-muted-foreground">{job.type}</p>{job.progress ? <div className="mt-2 flex items-center gap-2"><div className="h-1.5 flex-1 rounded-full bg-surface-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${job.progress}%` }} /></div><span className="text-[10px] font-bold">{job.progress}%</span></div> : <p className="mt-2 flex items-center gap-1 text-[10px] font-bold text-muted-foreground"><Icon size={11} /> {job.statusLabel}</p>}</div></div> })}</div></Card>; }

export function HomeUtilityRail() { return <aside className="relative z-10 hidden w-[clamp(220px,18vw,var(--rail-width))] shrink-0 space-y-4 xl:block"><CreditsCard /><JobsCard /><div className="relative min-h-28 overflow-hidden"><Image src="/generated-icons-v2/create-without-limits.png" alt="Create without limits" width={1942} height={810} className="absolute bottom-0 right-0 h-auto w-full max-w-none" /></div></aside>; }
