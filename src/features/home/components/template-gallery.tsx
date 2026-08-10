import { SectionHeading } from "@/features/home/components/section-heading";
import { TemplateCard } from "@/features/home/components/template-card";
import { templates } from "@/features/home/data/templates";

export function TemplateGallery() { return <section><SectionHeading title="Templates & inspiration" href="/templates" action="View all templates" /><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">{templates.map((template) => <TemplateCard key={template.title} template={template} />)}</div></section>; }
