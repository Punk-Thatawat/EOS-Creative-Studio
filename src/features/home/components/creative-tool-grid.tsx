import { SectionHeading } from "@/features/home/components/section-heading";
import { CreativeToolCard } from "@/features/home/components/creative-tool-card";
import { creativeTools } from "@/features/home/data/creative-tools";

export function CreativeToolGrid() { return <section className="-mt-8 sm:-mt-12 lg:-mt-16"><SectionHeading title="CREATE SOMETHING BOLD" decorationSrc="/generated-icons-v2/arrow-swoosh.png" /><div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">{creativeTools.map((tool) => <CreativeToolCard key={tool.name} tool={tool} />)}</div></section>; }
