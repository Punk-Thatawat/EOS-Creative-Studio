import type { Metadata } from "next";
import { IntroVideoPage } from "@/features/landing/intro-video-page";

export const metadata: Metadata = {
  // The root layout's title template already appends the brand name, so do not repeat it here.
  title: "Introduction video",
  description: "Watch the EOS Creative Studio introduction video",
};

export default function Page() {
  return <IntroVideoPage />;
}
