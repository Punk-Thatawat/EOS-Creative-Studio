import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { generationKinds, isGenerationKind } from "@/features/create/config/generation-kinds";

export const generateStaticParams = () => generationKinds.map((kind) => ({ kind }));

const kindTitles = { image: "Create Image", video: "Create Video", audio: "Create Audio" } as const;

export async function generateMetadata({ params }: { params: Promise<{ kind: string }> }): Promise<Metadata> {
  const { kind } = await params;
  return isGenerationKind(kind) ? { title: kindTitles[kind] } : {};
}

export default async function GenerationPage({ params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  if (!isGenerationKind(kind)) notFound();
  return null;
}
