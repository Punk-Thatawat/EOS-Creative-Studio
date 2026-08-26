import Link from "next/link";
import { ArrowLeft, AudioLines, FileText, ImageIcon, Mic2, Sparkles, Video, type LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { GenerationForm } from "./generation-form";
import { generationKindConfig } from "../config/generation-kinds";
import type { GenerationKind } from "../types/generation";
import { ImageGenerationPage } from "../image-generation/components/image-generation-page";
import { VideoGenerationPage } from "../video-generation-page";
import { AudioGenerationPage } from "../audio-generation/components/audio-generation-page";

const generationKindIcons: Record<GenerationKind, LucideIcon> = { image: ImageIcon, video: Video, "ai-presenter": Mic2, audio: AudioLines, document: FileText, workflow: Sparkles };

export function CreateGenerationPage({ kind }: { kind: GenerationKind }) {
  if (kind === "image") return <ImageGenerationPage />;
  if (kind === "video") return <VideoGenerationPage />;
  if (kind === "audio") return <AudioGenerationPage />;

  const config = generationKindConfig[kind];
  const Icon = generationKindIcons[kind];

  return <><Link href="/home" className="mb-5 inline-flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-primary"><ArrowLeft size={14} /> Back to workspace</Link><PageHeader eyebrow="New generation" title={config.title} description={config.description} action={<span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fff0e9] text-primary"><Icon size={18} /></span>} /><GenerationForm kind={kind} /></>;
}
