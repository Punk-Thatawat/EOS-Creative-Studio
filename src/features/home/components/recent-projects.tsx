import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ProjectCard } from "@/features/home/components/project-card";
import { ProjectCarousel } from "@/features/home/components/project-carousel";
import { recentProjects } from "@/features/home/data/recent-projects";

export function RecentProjects() { return <section><div className="mb-3 flex items-center justify-between gap-4"><h2 className="text-lg font-black tracking-tight">Recent projects</h2><Link href="/projects" className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-primary hover:text-[#c85427]">View all projects <ArrowRight size={13} /></Link></div><ProjectCarousel className="[&>a]:shrink-0 [&>a]:basis-[82%] sm:[&>a]:basis-[48%] lg:[&>a]:basis-[32%] xl:[&>a]:basis-[24%] lg:[&>a]:min-w-0">{recentProjects.map((project) => <ProjectCard key={project.id} project={project} />)}</ProjectCarousel></section>; }
