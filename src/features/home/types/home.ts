import type { LucideIcon } from "lucide-react";

export type JobStatus = "queued" | "preparing" | "generating" | "finalizing" | "completed";
export type ProjectStatus = "draft" | "queued" | "in_progress" | "in_review" | "completed" | "failed";

export interface CreativeTool {
  readonly name: string;
  readonly description: string;
  readonly href: string;
  readonly icon: LucideIcon;
  readonly imageSrc?: string;
  readonly accent: "orange" | "pink" | "yellow" | "green" | "blue" | "black";
  readonly badge?: string;
}

export interface RecentProject {
  readonly id: string;
  readonly title: string;
  readonly type: string;
  readonly status: ProjectStatus;
  readonly statusLabel: string;
  readonly owner: string;
  readonly updated: string;
  readonly progress?: number;
  readonly art: "cosmetic" | "protein" | "presenter" | "food";
  readonly imageSrc?: string;
}

export interface TemplateItem {
  readonly title: string;
  readonly category: string;
  readonly format: string;
  readonly art: "social" | "product" | "presenter" | "podcast" | "training";
  readonly imageSrc?: string;
}

export interface ActiveJob {
  readonly title: string;
  readonly type: string;
  readonly status: JobStatus;
  readonly statusLabel: string;
  readonly elapsed: string;
  readonly progress?: number;
  readonly art: "food" | "presenter" | "image";
  readonly imageSrc?: string;
}

export interface ActivityItem {
  readonly actor: string;
  readonly action: string;
  readonly target: string;
  readonly time: string;
  readonly kind: "upload" | "generation" | "comment";
}
