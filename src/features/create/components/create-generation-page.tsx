"use client";

import dynamic from "next/dynamic";
import type { GenerationKind } from "../types/generation";

const CreatePageLoading = () => <div className="flex min-h-[calc(100vh-220px)] items-center justify-center rounded-3xl border border-[#eaded6] bg-[#fffdfb] p-8" aria-busy="true" role="status"><div className="flex items-center gap-3 text-sm font-semibold text-[#6f625b]"><span className="size-4 animate-spin rounded-full border-2 border-[#f26b38] border-r-transparent" />กำลังเปิดเครื่องมือสร้าง…</div></div>;
const ImageGenerationPage = dynamic(() => import("../image-generation/components/image-generation-page").then((module) => module.ImageGenerationPage), { loading: CreatePageLoading });
const VideoGenerationPage = dynamic(() => import("../video-generation-page").then((module) => module.VideoGenerationPage), { loading: CreatePageLoading });
const AudioGenerationPage = dynamic(() => import("../audio-generation/components/audio-generation-page").then((module) => module.AudioGenerationPage), { loading: CreatePageLoading });

export function CreateGenerationPage({ kind }: { kind: GenerationKind }) {
  if (kind === "image") return <ImageGenerationPage />;
  if (kind === "video") return <VideoGenerationPage />;
  if (kind === "audio") return <AudioGenerationPage />;
  return null;
}
