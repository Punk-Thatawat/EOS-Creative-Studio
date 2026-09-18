import { notFound } from "next/navigation";
import { generationKinds, isGenerationKind } from "@/features/create/config/generation-kinds";

export const generateStaticParams = () => generationKinds.map((kind) => ({ kind }));
export default async function GenerationPage({ params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  if (!isGenerationKind(kind)) notFound();
  return null;
}
