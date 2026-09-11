import type { Metadata } from "next";
import { LegalHubPage } from "@/features/legal/legal-page";

export const metadata: Metadata = { title: "Legal Center" };

export default function LegalPage() {
  return <LegalHubPage />;
}
