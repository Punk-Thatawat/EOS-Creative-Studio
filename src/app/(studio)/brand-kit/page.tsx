import type { Metadata } from "next";
import { BrandKitPage } from "@/features/brand-kit/brand-kit-page";

export const metadata: Metadata = { title: "Brand Kit" };
export default async function Page({ searchParams }: {
  searchParams: Promise<{ folder?: string | string[]; create?: string | string[] }>;
}) {
  const { folder, create } = await searchParams;
  return <BrandKitPage initialFolderId={typeof folder === "string" ? folder : undefined} startCreating={create === "1"} />;
}
