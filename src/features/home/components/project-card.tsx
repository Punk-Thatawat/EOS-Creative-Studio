/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { RecentProject } from "@/features/home/types/home";

const artClasses = { cosmetic: "bg-[#e9c8ae]", protein: "bg-[#37332e]", presenter: "bg-[#8ea6bb]", food: "bg-[#d99d62]" };
const statusTone = { in_progress: "orange" as const, in_review: "warning" as const, completed: "success" as const, draft: "neutral" as const, queued: "pink" as const, failed: "neutral" as const };

export function ProjectCard({ project }: { project: RecentProject }) {
  return <Link href={`/projects/${project.id}`} className="group block min-w-[220px] snap-start rounded-2xl border border-border bg-surface p-2 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)] sm:min-w-[250px]">
    <div className={`relative h-28 overflow-hidden rounded-xl ${artClasses[project.art]}`}>
      {project.imageSrc ? <img src={project.imageSrc} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-105" /> : null}
      <div className="absolute left-2 top-2"><Badge tone={statusTone[project.status]}>{project.statusLabel}</Badge></div>
      <button type="button" className="absolute right-2 top-2 rounded-lg bg-white/80 p-1.5 text-foreground opacity-0 transition group-hover:opacity-100" aria-label={`More options for ${project.title}`}><MoreHorizontal size={14} /></button>
    </div>
    <div className="px-1 pb-1 pt-3"><h3 className="truncate text-xs font-bold">{project.title}</h3><p className="mt-1 text-[10px] text-muted-foreground">By {project.owner} · {project.updated}</p><div className="mt-3 flex items-center gap-2"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-muted"><div className={`h-full rounded-full ${project.status === "completed" ? "bg-[#e9bd45]" : "bg-primary"}`} style={{ width: `${project.progress ?? 0}%` }} /></div><span className="text-[10px] font-bold text-muted-foreground">{project.progress ?? 0}%</span></div></div>
  </Link>;
}
