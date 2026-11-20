import type { Metadata } from "next";
import { BrandKitPage } from "@/features/brand-kit/brand-kit-page";

export const metadata: Metadata = { title: "Brand Kit" };
export default async function Page({ searchParams }: { searchParams: Promise<{ folder?: string | string[] }> }) {
  const { folder } = await searchParams;
  return <BrandKitPage initialFolderId={typeof folder === "string" ? folder : undefined} />;
}
