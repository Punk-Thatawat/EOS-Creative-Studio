import { Coins } from "lucide-react";
import { Card } from "@/components/ui/card";

export function SummaryCard({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: typeof Coins;
  label: string;
  value: string;
  detail: string;
  tone: "orange" | "green" | "pink";
}) {
  const toneClass = {
    orange: "bg-[#fff0e9] text-[#c85427]",
    green: "bg-[#e3f3e9] text-[#347454]",
    pink: "bg-[#f9e5eb] text-[#ae5572]",
  }[tone];
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-xl ${toneClass}`}
        >
          <Icon size={17} />
        </span>
        <span className="h-2 w-2 rounded-full bg-[#4c9b72]" />
      </div>
      <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </Card>
  );
}
