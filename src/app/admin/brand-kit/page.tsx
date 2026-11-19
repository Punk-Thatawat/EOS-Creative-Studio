import { Suspense } from "react";
import type { Metadata } from "next";
import { AdminBrandKitPage } from "@/features/brand-kit/admin-brand-kit-page";

export const metadata: Metadata = { title: "Brand Kit settings" };
export default function Page() {
  return (
    <Suspense>
      <AdminBrandKitPage />
    </Suspense>
  );
}
