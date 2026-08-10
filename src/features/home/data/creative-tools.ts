import { AudioLines, FileText, ImageIcon, Sparkles, UserRound, Video } from "lucide-react";
import type { CreativeTool } from "@/features/home/types/home";

export const creativeTools: CreativeTool[] = [
  { name: "Image", description: "Generate stunning images with AI", href: "/create/image", icon: ImageIcon, imageSrc: "/generated-icons-v2/icon-1-image.png", accent: "orange" },
  { name: "Video", description: "Create engaging videos in minutes", href: "/create/video", icon: Video, imageSrc: "/generated-icons-v2/icon-2-video.png", accent: "pink", badge: "Popular" },
  { name: "AI Presenter", description: "AI presenters that represent you", href: "/create/ai-presenter", icon: UserRound, imageSrc: "/generated-icons-v2/icon-3-profile.png", accent: "green" },
  { name: "Audio", description: "Generate voiceovers and music", href: "/create/audio", icon: AudioLines, imageSrc: "/generated-icons-v2/icon-4-audio.png", accent: "black" },
  { name: "Document", description: "Smart docs with AI & OCR", href: "/create/document", icon: FileText, imageSrc: "/generated-icons-v2/icon-5-document.png", accent: "blue", badge: "New" },
  { name: "Custom", description: "Build custom AI workflows", href: "/create/workflow", icon: Sparkles, imageSrc: "/generated-icons-v2/icon-6-custom-v2.png", accent: "yellow" },
];
