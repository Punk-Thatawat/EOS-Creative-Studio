import type { Metadata } from "next";
import { UsagePage } from "@/features/usage/usage-page";

export const metadata: Metadata = {
  title: "Usage & Credits",
  description: "Track, manage, and understand your EOS Creative Studio credit usage.",
};

export default function UsageRoute() {
  return <UsagePage />;
}
