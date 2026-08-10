import type { LucideIcon } from "lucide-react";

export interface NavigationItem {
  readonly label: string;
  readonly href: string;
  readonly icon: LucideIcon;
  readonly badge?: string;
}
