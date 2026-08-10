import type { RecentProject } from "@/features/home/types/home";

export const recentProjects: RecentProject[] = [
  { id: "cosmetic-ad", title: "Cosmetic Ad Campaign", type: "Image + Video", status: "in_progress", statusLabel: "In progress", owner: "Marketing Team", updated: "1h ago", progress: 60, art: "cosmetic", imageSrc: "/generated-icons-v2/projects/cosmetic-ad.png" },
  { id: "whey-promotion", title: "Whey Protein Promotion", type: "Product visual", status: "in_review", statusLabel: "In review", owner: "Marketing Team", updated: "1 day ago", progress: 80, art: "protein", imageSrc: "/generated-icons-v2/projects/whey-protein.png" },
  { id: "company-intro", title: "AI Presenter - Company Intro", type: "AI Presenter", status: "completed", statusLabel: "Completed", owner: "Corporate Comms", updated: "3 days ago", progress: 100, art: "presenter", imageSrc: "/generated-icons-v2/projects/ai-presenter.png" },
  { id: "food-story", title: "Food Story Video", type: "Video", status: "in_progress", statusLabel: "In progress", owner: "Content Team", updated: "3 days ago", progress: 40, art: "food", imageSrc: "/generated-icons-v2/projects/food-story.png" },
  { id: "campaign-launch", title: "Campaign Launch Kit", type: "Image + Video", status: "in_review", statusLabel: "In review", owner: "Creative Team", updated: "5 days ago", progress: 70, art: "cosmetic" },
];
