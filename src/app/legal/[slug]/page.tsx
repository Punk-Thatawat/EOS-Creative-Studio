import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLegalDocument, legalDocuments, type LegalDocument } from "@/features/legal/legal-documents";
import { LegalDocumentPage } from "@/features/legal/legal-page";

export const dynamic = "force-dynamic";

async function getPublishedLegalDocument(slug: string): Promise<LegalDocument | undefined> {
  const backendUrl = (process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000").replace(/\/+$/, "").replace(/\/api\/v1$/, "");
  try {
    const response = await fetch(`${backendUrl}/api/v1/legal/${encodeURIComponent(slug)}`, { cache: "no-store", headers: { Accept: "application/json" } });
    if (!response.ok) return undefined;
    const payload = await response.json() as { data?: LegalDocument };
    return payload.data;
  } catch {
    return undefined;
  }
}

export function generateStaticParams() {
  return legalDocuments.map((document) => ({ slug: document.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const fallback = getLegalDocument(slug);
  const document = fallback ? await getPublishedLegalDocument(slug) ?? fallback : undefined;
  return document ? { title: document.title } : { title: "Legal Center" };
}

export default async function LegalDocumentRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const fallback = getLegalDocument(slug);
  if (!fallback) notFound();
  const document = await getPublishedLegalDocument(slug) ?? fallback;
  return <LegalDocumentPage document={document} />;
}
