import { HomeHero } from "@/features/home/components/home-hero";
import { CreativeToolGrid } from "@/features/home/components/creative-tool-grid";
import { RecentAssets } from "@/features/home/components/recent-assets";

export const metadata = { title: "Home" };

export default function HomePage() {
  return <div className="space-y-7"><HomeHero /><CreativeToolGrid /><RecentAssets /></div>;
}
