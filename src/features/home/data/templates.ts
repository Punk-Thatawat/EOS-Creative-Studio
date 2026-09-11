import type { TemplateItem } from "@/features/home/types/home";

export const templates: TemplateItem[] = [
  { title: "Social media post", category: "Social", format: "1:1 · 4:5", art: "social", imageSrc: "/generated-icons-v2/templates/social-media.png", href: "/create/image?template=social-media-post" },
  { title: "Product ad", category: "Advertising", format: "16:9 · 9:16", art: "product", imageSrc: "/generated-icons-v2/templates/product-ad.png", href: "/create/image?template=product-ad" },
  { title: "AI presenter video", category: "Presenter", format: "16:9 · 30 sec", art: "presenter", imageSrc: "/generated-icons-v2/templates/ai-presenter-video.png", href: "/create/video?template=ai-presenter-video" },
  { title: "Podcast & dialogue", category: "Audio", format: "Voiceover", art: "podcast", imageSrc: "/generated-icons-v2/templates/podcast-dialogue.png", href: "/create/audio?template=podcast-dialogue" },
  { title: "Training video", category: "Learning", format: "16:9 · 60 sec", art: "training", imageSrc: "/generated-icons-v2/templates/training-video.png", href: "/create/video?template=training-video" },
];
