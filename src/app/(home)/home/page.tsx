import { HomeHero } from "@/features/home/components/home-hero";
import { CreativeToolGrid } from "@/features/home/components/creative-tool-grid";
import { RecentProjects } from "@/features/home/components/recent-projects";
import { TemplateGallery } from "@/features/home/components/template-gallery";

export const metadata = { title: "Home" };

export default function HomePage() {
  return <div className="space-y-7"><HomeHero /><CreativeToolGrid /><RecentProjects /><TemplateGallery /></div>;
}
