import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";

export function StatCard({ label, value, detail, icon: Icon, tone = "orange" }: { label: string; value: string; detail: string; icon: LucideIcon; tone?: "orange" | "pink" | "green" | "yellow" }) {
  const colors = { orange: "bg-[#fff0e9] text-primary", pink: "bg-[#f9e5eb] text-[#bd5a78]", green: "bg-[#e3f3e9] text-[#43855f]", yellow: "bg-[#fff3cc] text-[#a67c17]" };
  return <Card className="p-5"><div className="flex items-start justify-between"><div><p className="text-xs font-medium text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-bold tracking-tight">{value}</p></div><span className={cn("flex h-9 w-9 items-center justify-center rounded-xl", colors[tone])}><Icon size={17} /></span></div><p className="mt-4 text-[11px] text-muted-foreground">{detail}</p></Card>;
}
