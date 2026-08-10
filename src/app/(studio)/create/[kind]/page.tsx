import Link from "next/link";
import { ArrowLeft, AudioLines, FileText, ImageIcon, Mic2, Sparkles, Video } from "lucide-react";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/dashboard/page-header";
import { GenerationForm } from "@/components/generation/generation-form";
import { GenImagePage } from "@/features/create/gen-image-page";

const kinds = { image: { title: "Generate an image", description: "Create a focused visual brief with the direction and format you need.", icon: ImageIcon }, video: { title: "Generate a video", description: "Define the story, pacing, and visual direction for your next video concept.", icon: Video }, "ai-presenter": { title: "Create an AI presenter", description: "Prepare a presenter-led content brief for a future generation workflow.", icon: Mic2 }, audio: { title: "Generate audio", description: "Set the voice, feeling, and format for your audio idea.", icon: AudioLines }, document: { title: "Create a document", description: "Build a structured document brief with AI and OCR-ready inputs.", icon: FileText }, workflow: { title: "Build a custom workflow", description: "Design a repeatable creative workflow for your team.", icon: Sparkles } } as const;
type Kind = keyof typeof kinds;
export const generateStaticParams = () => Object.keys(kinds).map((kind) => ({ kind }));
export default async function GenerationPage({ params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  if (!(kind in kinds)) notFound();
  if (kind === "image") return <GenImagePage />;
  const config = kinds[kind as Kind];
  return <><Link href="/create" className="mb-5 inline-flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-primary"><ArrowLeft size={14} /> Creation studio</Link><PageHeader eyebrow="New generation" title={config.title} description={config.description} action={<span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fff0e9] text-primary"><config.icon size={18} /></span>} /><GenerationForm kind={kind as "image" | "video" | "ai-presenter" | "audio" | "document" | "workflow"} /></>;
}
