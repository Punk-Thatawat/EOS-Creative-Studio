import type { ActiveJob } from "@/features/home/types/home";

export const activeJobs: ActiveJob[] = [
  { title: "Product Launch", type: "Video · 1080p · 16:9 · 15s", status: "generating", statusLabel: "Generating", elapsed: "02:45", progress: 45, art: "food", imageSrc: "/generated-icons-v2/jobs/product-launch.png" },
  { title: "Image Generate", type: "FLUX · High Quality", status: "completed", statusLabel: "Completed", elapsed: "Just now", art: "image", imageSrc: "/generated-icons-v2/jobs/image-generate.png" },
  { title: "AI Presenter Video", type: "1080p · 16:9 · 30s", status: "preparing", statusLabel: "Step 2 / 3", elapsed: "01:18", art: "presenter", imageSrc: "/generated-icons-v2/jobs/ai-presenter-video.png" },
];
