import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLegalDocument, legalDocuments } from "@/features/legal/legal-documents";
import { LegalDocumentPage } from "@/features/legal/legal-page";

export function generateStaticParams() {
  return legalDocuments.map((document) => ({ slug: document.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const document = getLegalDocument(slug);
  return document ? { title: document.title } : { title: "Legal Center" };
}

export default async function LegalDocumentRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const document = getLegalDocument(slug);
  if (!document) notFound();
  return <LegalDocumentPage document={document} />;
}
