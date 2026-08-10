import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import type { TemplateItem } from "@/features/home/types/home";

const templateArt = { social: "bg-[#f6b0c9]", product: "bg-[#f0b46f]", presenter: "bg-[#6dd4c3]", podcast: "bg-[#d583b6]", training: "bg-[#30302d]" };

export function TemplateCard({ template }: { template: TemplateItem }) { return <div className="group min-w-[166px] snap-start overflow-hidden rounded-2xl border border-border bg-surface transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)] sm:min-w-0"><div className={`relative h-24 overflow-hidden ${templateArt[template.art]}`}>{template.imageSrc ? <Image src={template.imageSrc} alt="" fill sizes="(max-width: 640px) 80vw, 20vw" className="object-cover transition duration-300 group-hover:scale-105" /> : null}</div><div className="p-3"><h3 className="truncate text-xs font-bold capitalize">{template.title}</h3><p className="mt-1 text-[10px] text-muted-foreground">{template.category} · {template.format}</p><button type="button" className="mt-3 inline-flex items-center gap-1 text-[10px] font-bold text-primary opacity-0 transition group-hover:opacity-100">Use template <ArrowUpRight size={12} /></button></div></div>; }
