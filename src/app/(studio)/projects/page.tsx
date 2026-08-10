import Link from "next/link";
import { ArrowUpRight, FolderKanban, Plus } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Projects" };
const projects = [{ id: "spring-campaign", name: "Spring campaign concepts", description: "Launch visuals and social variations", assets: 24, updated: "12 min ago", tone: "orange" as const }, { id: "brand-story", name: "Brand story v2", description: "A warmer, more human brand direction", assets: 18, updated: "2 days ago", tone: "pink" as const }, { id: "product-launch", name: "Product launch", description: "Campaign kit for the new collection", assets: 42, updated: "Last week", tone: "success" as const }];

export default function ProjectsPage() { return <><PageHeader eyebrow="Workspace" title="Projects" description="Keep every idea, brief, and generated asset organized in one place." action={<Button><Plus size={17} /> New project</Button>} /><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{projects.map((project) => <Link key={project.id} href={`/projects/${project.id}`}><Card className="group h-full p-5 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]"><div className={`flex h-32 items-end rounded-2xl p-4 ${project.tone === "orange" ? "bg-[#ffdfd0]" : project.tone === "pink" ? "bg-[#f5d8e1]" : "bg-[#d9eedf]"}`}><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/80 text-foreground"><FolderKanban size={18} /></span></div><div className="mt-5 flex items-start justify-between gap-3"><div><h3 className="font-bold">{project.name}</h3><p className="mt-1 text-xs text-muted-foreground">{project.description}</p></div><ArrowUpRight className="text-muted-foreground transition group-hover:text-primary" size={17} /></div><div className="mt-5 flex items-center justify-between border-t border-border pt-4"><Badge tone={project.tone}>{project.assets} assets</Badge><span className="text-[11px] text-muted-foreground">{project.updated}</span></div></Card></Link>)}</div></> }
