import { cn } from "@/lib/cn";

type BadgeTone = "neutral" | "success" | "warning" | "pink" | "orange";

const tones: Record<BadgeTone, string> = {
  neutral: "bg-surface-muted text-muted-foreground",
  success: "bg-[#e3f3e9] text-[#347454]",
  warning: "bg-[#fff3cc] text-[#967119]",
  pink: "bg-[#f9e5eb] text-[#ae5572]",
  orange: "bg-[#fff0e9] text-[#c85427]",
};

export function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: BadgeTone }) {
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold", tones[tone])}>{children}</span>;
}
