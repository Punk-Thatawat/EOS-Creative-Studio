import type { Metadata } from "next";
import { AffiliatePage } from "@/features/affiliate/affiliate-page";

export const metadata: Metadata = {
  title: "Affiliate",
  description: "Your affiliate link, what it earned, and exchanging it for credits.",
};

export default function AffiliateRoute() {
  return <AffiliatePage />;
}
