"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import { useEffect, useMemo, useState } from "react";
import type { GenerationKind } from "../types/generation";

const CreatePageLoading = () => <div className="flex min-h-[calc(100vh-220px)] items-center justify-center rounded-3xl border border-[#eaded6] bg-[#fffdfb] p-8" aria-busy="true" role="status"><div className="flex items-center gap-3 text-sm font-semibold text-[#6f625b]"><span className="size-4 animate-spin rounded-full border-2 border-[#f26b38] border-r-transparent" />กำลังเปิดเครื่องมือสร้าง…</div></div>;
const ImageGenerationPage = dynamic(() => import("../image-generation/components/image-generation-page").then((module) => module.ImageGenerationPage), { loading: CreatePageLoading });
const VideoGenerationPage = dynamic(() => import("../video-generation-page").then((module) => module.VideoGenerationPage), { loading: CreatePageLoading });
const AudioGenerationPage = dynamic(() => import("../audio-generation/components/audio-generation-page").then((module) => module.AudioGenerationPage), { loading: CreatePageLoading });
const pageByKind: Record<GenerationKind, ComponentType> = {
  image: ImageGenerationPage,
  video: VideoGenerationPage,
  audio: AudioGenerationPage,
};

export function CreateGenerationPage({ kind }: { kind: GenerationKind }) {
  const [visitedKinds, setVisitedKinds] = useState<Set<GenerationKind>>(() => new Set([kind]));
  const renderedKinds = useMemo(() => {
    if (visitedKinds.has(kind)) return visitedKinds;
    return new Set([...visitedKinds, kind]);
  }, [kind, visitedKinds]);

  useEffect(() => {
    if (visitedKinds.has(kind)) return;
    // Keep already opened creator pages mounted so switching back does not
    // recreate their large state tree and refetch its catalogs.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVisitedKinds(renderedKinds);
  }, [kind, renderedKinds, visitedKinds]);

  return <div data-create-pages>
    {[...renderedKinds].map((renderedKind) => {
      const Page = pageByKind[renderedKind];
      return <div key={renderedKind} hidden={renderedKind !== kind} aria-hidden={renderedKind !== kind} data-create-page={renderedKind}><Page /></div>;
    })}
  </div>;
}
