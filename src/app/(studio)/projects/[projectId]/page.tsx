import Link from "next/link";
import { ArrowLeft, ImageIcon, MoreHorizontal, Plus } from "lucide-react";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata = { title: "Project" };
export default async function ProjectPage({ params }: { params: Promise<{ projectId: string }> }) { const { projectId } = await params; if (!projectId) notFound(); return <><Link href="/projects" className="mb-5 inline-flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-primary"><ArrowLeft size={14} /> All projects</Link><PageHeader eyebrow="Project" title="Spring campaign concepts" description="Launch visuals and social variations · Updated 12 minutes ago" action={<div className="flex gap-2"><Button variant="outline" size="sm"><MoreHorizontal size={16} /> Options</Button><Link href="/create"><Button size="sm"><Plus size={16} /> Create asset</Button></Link></div>} /><div className="mb-5 flex gap-2 border-b border-border"><button className="border-b-2 border-primary px-1 pb-3 text-xs font-bold text-primary">Overview</button><button className="px-1 pb-3 text-xs font-bold text-muted-foreground">Assets</button><button className="px-1 pb-3 text-xs font-bold text-muted-foreground">Activity</button></div><Card><EmptyState icon={ImageIcon} title="Your project canvas is ready" description="Generated images, videos, audio, and documents will appear here as your team creates them." action="Create your first asset" /></Card></> }
