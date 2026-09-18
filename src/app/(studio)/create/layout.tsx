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

  // The child page validates the dynamic segment. Keep the layout neutral for
  // invalid routes so not-found rendering is not covered by the creator shell.
  if (!kind) return children;
  return <><CreateGenerationPage kind={kind} />{children}</>;
}
