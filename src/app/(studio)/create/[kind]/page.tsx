import { notFound } from "next/navigation";
import { generationKinds, isGenerationKind } from "@/features/create/config/generation-kinds";

export const generateStaticParams = () => generationKinds.map((kind) => ({ kind }));
export default async function GenerationPage({ params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  if (!isGenerationKind(kind)) notFound();
  // The parent create layout owns the persistent client workspace so changing
  // Image / Video / Audio does not unmount and recreate the active editor.
  return null;
}
