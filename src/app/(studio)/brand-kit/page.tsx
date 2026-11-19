import type { Metadata } from "next";
import { BrandKitPage } from "@/features/brand-kit/brand-kit-page";

export const metadata: Metadata = { title: "Brand Kit" };
export default function Page() {
  return <BrandKitPage />;
}
