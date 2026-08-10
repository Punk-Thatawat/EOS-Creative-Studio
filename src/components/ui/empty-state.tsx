import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function EmptyState({ icon: Icon, title, description, action }: { icon: LucideIcon; title: string; description: string; action?: string }) {
  return (
    <Card className="flex min-h-72 flex-col items-center justify-center border-dashed bg-[#fcfbfa] p-8 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fff0e9] text-primary"><Icon size={22} /></div>
      <h2 className="text-base font-bold">{title}</h2>
      <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{description}</p>
      {action ? <Button className="mt-5" size="sm">{action}</Button> : null}
    </Card>
  );
}
