"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { ProjectCard } from "@/features/home/components/project-card";
import { ProjectCarousel } from "@/features/home/components/project-carousel";
import { fetchHomeDashboard } from "@/lib/api/home";
import type { RecentProject } from "@/features/home/types/home";

export function RecentProjects() {
  const [projects, setProjects] = useState<RecentProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    void fetchHomeDashboard()
      .then((dashboard) => {
        if (active) setProjects(dashboard.recentProjects);
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return <section>
    <div className="mb-3 flex items-center justify-between gap-4"><h2 className="text-lg font-black tracking-tight">Recent projects</h2><Link href="/projects" className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-primary hover:text-[#c85427]">View all projects <ArrowRight size={13} /></Link></div>
    {isLoading ? <div className="rounded-2xl border border-dashed border-border bg-surface p-6 text-sm text-muted-foreground">Loading recent projects…</div> : projects.length > 0 ? <ProjectCarousel className="[&>a]:shrink-0 [&>a]:basis-[82%] sm:[&>a]:basis-[48%] lg:[&>a]:basis-[32%] xl:[&>a]:basis-[24%] lg:[&>a]:min-w-0">{projects.map((project) => <ProjectCard key={project.id} project={project} />)}</ProjectCarousel> : <div className="rounded-2xl border border-dashed border-border bg-surface p-6"><p className="text-sm font-bold">{error ? "Unable to load projects" : "No projects yet"}</p><p className="mt-1 text-xs text-muted-foreground">Create your first asset to start building a project.</p></div>}
  </section>;
}
