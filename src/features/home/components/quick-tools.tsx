import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { quickTools } from "@/features/home/data/quick-tools";
import { SectionHeading } from "@/features/home/components/section-heading";

export function QuickTools() { return <section><SectionHeading title="Quick tools" eyebrow="For the finishing touches" /><div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">{quickTools.map((tool) => <Link href={tool.href} key={tool.name} className="group flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-3 hover:border-primary/40"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-foreground"><tool.icon size={15} /></span><span className="min-w-0 flex-1"><span className="block truncate text-[11px] font-bold">{tool.name}</span><span className="block truncate text-[10px] text-muted-foreground">{tool.description}</span></span><ArrowUpRight className="shrink-0 text-muted-foreground group-hover:text-primary" size={13} /></Link>)}</div></section>; }
