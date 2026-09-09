import Link from "next/link";
import Image from "next/image";
import { FeatureStatusBadge, FeatureStatusDescription, FeatureStatusCta } from "@/features/home/components/feature-status-copy";
import type { CreativeTool } from "@/features/home/types/home";

const accentClasses = { orange: "bg-[#fff0e9] text-primary", pink: "bg-[#f9e5eb] text-[#ae5572]", yellow: "bg-[#fff3cc] text-[#a67c17]", green: "bg-[#e3f3e9] text-[#43855f]", blue: "bg-[#e7f1f7] text-[#42738e]", black: "bg-[#201d1b] text-white" };

export function CreativeToolCard({ tool }: { tool: CreativeTool }) {
  const cardClassName = `group relative flex min-h-[180px] min-w-0 flex-col items-center overflow-visible rounded-[12px] border border-border bg-surface px-3 pb-3 pt-24 text-center transition ${tool.comingSoon ? "cursor-default opacity-90" : "hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[var(--shadow-md)]"}`;
  const content = <>
    {tool.comingSoon ? <FeatureStatusBadge /> : tool.badge ? <span className="absolute left-2 top-2 z-10 rounded-full bg-primary px-2 py-1 text-[10px] font-bold text-white">{tool.badge}</span> : null}
    <div className="absolute left-1/2 top-[-10px] h-32 w-32 -translate-x-1/2">{tool.imageSrc ? <Image src={tool.imageSrc} alt="" width={136} height={136} className="h-32 w-32 object-contain transition-transform group-hover:scale-105" /> : <span className={`flex h-12 w-12 items-center justify-center rounded-xl ${accentClasses[tool.accent]}`}><tool.icon size={18} /></span>}</div>
    <h3 className="text-base font-bold leading-5">{tool.name}</h3>
    <p className="mt-2 max-w-[150px] text-xs leading-5 text-muted-foreground">{tool.comingSoon ? <FeatureStatusDescription /> : tool.description}</p>
    {tool.comingSoon ? <FeatureStatusCta /> : null}
  </>;

  return tool.comingSoon ? <div className={cardClassName} aria-disabled="true">{content}</div> : <Link href={tool.href} className={cardClassName}>{content}</Link>;
}
