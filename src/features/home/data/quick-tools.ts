import { AudioWaveform, Crop, Eraser, Expand, Images, WandSparkles } from "lucide-react";
import type { CreativeTool } from "@/features/home/types/home";

export const quickTools: CreativeTool[] = [
  { name: "Remove background", description: "Clean cutouts", href: "/create/image", icon: Eraser, accent: "orange" },
  { name: "Upscale image", description: "Sharper details", href: "/create/image", icon: Expand, accent: "pink" },
  { name: "Generate variations", description: "Explore directions", href: "/create/image", icon: Images, accent: "yellow" },
  { name: "Animate image", description: "Add movement", href: "/create/video", icon: WandSparkles, accent: "green" },
  { name: "Create voiceover", description: "Natural voices", href: "/create/audio", icon: AudioWaveform, accent: "black" },
  { name: "Resize content", description: "Fit every channel", href: "/create/image", icon: Crop, accent: "blue" },
];
