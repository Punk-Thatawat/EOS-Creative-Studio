"use client";

/* eslint-disable @next/next/no-img-element */

import Image from "next/image";
import Link from "next/link";
import { Check, Clock3 } from "lucide-react";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { fetchHomeDashboard, type HomeCredits } from "@/lib/api/home";
import type { ActiveJob } from "@/features/home/types/home";

const jobArt = { food: "bg-[#d99d62]", presenter: "bg-[#8ea6bb]", image: "bg-[#e9c8ae]" };

function formatNumber(value: number): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function formatRenewal(value: string | null): string {
  if (!value) return "No renewal date";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : `Renews ${date.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}`;
}

function CreditsCard({ credits }: { credits: HomeCredits | null }) {
  const usedPercent = credits?.usedPercent ?? 0;
  const available = credits?.available ?? 0;
  const allowance = credits?.allowance ?? 0;

  return <Card className="relative overflow-hidden border-[#343231] bg-[#201d1b] text-white">
    <div className="absolute inset-0 bg-cover opacity-90" style={{ backgroundImage: "url('/generated-icons-v2/credits-overview-bg.png')", backgroundPosition: "right center" }} aria-hidden="true" />
    <div className="relative z-10 p-4 sm:p-5">
      <div className="flex items-center justify-between"><p className="text-[11px] font-black uppercase tracking-wide">Credits overview</p><Link href="/usage" className="text-[10px] font-bold text-primary">View details</Link></div>
      <div className="relative mt-4 min-h-[92px] pr-[82px]"><div><div className="flex items-baseline gap-2"><p className="text-4xl font-black leading-none tracking-tight">{credits ? formatNumber(available) : "—"}</p><span className="text-xs font-bold text-white">Credits</span></div><p className="mt-2 text-xs text-white/70">{credits ? `≈ ฿${formatNumber(credits.walletValueThb)}` : "Loading balance…"}</p></div><div className="absolute right-0 top-0 flex h-16 w-16 items-center justify-center rounded-full" style={{ background: `conic-gradient(#f26b38 ${usedPercent}%, #45413e 0)` }}><span className="flex h-12 w-12 flex-col items-center justify-center rounded-full bg-[#201d1b] text-[10px] font-bold"><strong className="text-sm">{credits ? `${usedPercent}%` : "—"}</strong>Used</span></div></div>
      <div className="text-[10px] font-bold">PLAN</div><div className="mt-2 flex items-center justify-between gap-2 text-[11px]"><span className="truncate font-bold">{credits?.plan ?? "Loading plan…"}</span><span className="shrink-0 text-white/80">{formatRenewal(credits?.renewal ?? null)}</span></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/20"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${usedPercent}%` }} /></div><p className="mt-3 text-right text-xs font-bold text-white">{credits ? `${formatNumber(available)}${allowance > 0 ? ` / ${formatNumber(allowance)}` : ""} Credits` : "—"}</p>
    </div>
  </Card>;
}

function JobsCard({ jobs, isLoading, showingRecent }: { jobs: ActiveJob[]; isLoading: boolean; showingRecent: boolean }) {
  return <Card><div className="flex items-center justify-between p-5 pb-3"><h2 className="text-sm font-black">{showingRecent ? "Recent jobs" : "Jobs in progress"}</h2><Link href="/history" className="text-[10px] font-bold text-primary">View all</Link></div><div className="space-y-1 px-5 pb-4">{isLoading ? <p className="py-3 text-xs text-muted-foreground">Loading jobs…</p> : jobs.length === 0 ? <p className="py-3 text-xs text-muted-foreground">No jobs yet.</p> : jobs.map((job, index) => { const Icon = job.status === "completed" ? Check : Clock3; return <div key={`${job.title}-${index}`} className="flex gap-3 py-3"><div className={`relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl ${jobArt[job.art]}`}>{job.imageSrc ? <img src={job.imageSrc} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" /> : <span className="h-5 w-5 rounded-md bg-white/70" />}</div><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><p className="truncate text-xs font-bold">{job.title}</p>{job.status === "completed" ? <span className="text-[#3a9a64]"><Check size={14} /></span> : <span className="text-[10px] font-bold text-muted-foreground">{job.elapsed}</span>}</div><p className="mt-1 truncate text-[10px] text-muted-foreground">{job.type}</p>{job.progress ? <div className="mt-2 flex items-center gap-2"><div className="h-1.5 flex-1 rounded-full bg-surface-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${job.progress}%` }} /></div><span className="text-[10px] font-bold">{job.progress}%</span></div> : <p className="mt-2 flex items-center gap-1 text-[10px] font-bold text-muted-foreground"><Icon size={11} /> {job.statusLabel}</p>}</div></div>; })}</div></Card>;
}

export function HomeUtilityRail() {
  const [credits, setCredits] = useState<HomeCredits | null>(null);
  const [jobs, setJobs] = useState<ActiveJob[]>([]);
  const [showingRecentJobs, setShowingRecentJobs] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void fetchHomeDashboard()
      .then((dashboard) => {
        if (!active) return;
        setCredits(dashboard.credits);
        const hasActiveJobs = dashboard.activeJobs.length > 0;
        setJobs(hasActiveJobs ? dashboard.activeJobs : dashboard.recentJobs);
        setShowingRecentJobs(!hasActiveJobs && dashboard.recentJobs.length > 0);
      })
      .catch(() => {
        if (!active) return;
        setCredits(null);
        setJobs([]);
        setShowingRecentJobs(false);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return <aside className="relative z-10 hidden w-[clamp(220px,18vw,var(--rail-width))] shrink-0 space-y-4 xl:block"><CreditsCard credits={credits} /><JobsCard jobs={jobs} isLoading={isLoading} showingRecent={showingRecentJobs} /><div className="relative min-h-28 overflow-hidden"><Image src="/generated-icons-v2/create-without-limits.png" alt="Create without limits" width={1942} height={810} className="absolute bottom-0 right-0 h-auto w-full max-w-none" /></div></aside>;
}
