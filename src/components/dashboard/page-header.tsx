import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function PageHeader({ eyebrow, title, description, action, className }: { eyebrow?: string; title: string; description?: string; action?: ReactNode; className?: string }) {
  return <div className={cn("mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end", className)}><div>{eyebrow ? <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-primary">{eyebrow}</p> : null}<h2 className="text-2xl font-bold tracking-tight sm:text-[28px]">{title}</h2>{description ? <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p> : null}</div>{action ? <div className="shrink-0">{action}</div> : null}</div>;
}
