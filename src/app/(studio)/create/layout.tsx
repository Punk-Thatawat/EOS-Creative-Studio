"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { CreateGenerationPage } from "@/features/create/components/create-generation-page";
import type { GenerationKind } from "@/features/create/types/generation";

function generationKindFromPath(pathname: string | null): GenerationKind | null {
  const kind = pathname?.match(/^\/create\/(image|video|audio)(?:\/|$)/)?.[1];
  return kind === "image" || kind === "video" || kind === "audio" ? kind : null;
}

export default function CreateLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const kind = generationKindFromPath(pathname);

  if (!kind) return children;
  return (
    <>
      <CreateGenerationPage kind={kind} />
      {children}
    </>
  );
}
