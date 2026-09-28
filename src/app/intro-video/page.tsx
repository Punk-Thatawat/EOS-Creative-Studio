import type { Metadata } from "next";
import { IntroVideoPage } from "@/features/landing/intro-video-page";

export const metadata: Metadata = {
  title: "วิดีโอแนะนำ EOS Creative Studio",
  description: "รับชมวิดีโอแนะนำ EOS Creative Studio",
};

export default function Page() {
  return <IntroVideoPage />;
}
