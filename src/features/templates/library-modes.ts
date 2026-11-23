import {
  Clock,
  Crop,
  Eraser,
  Expand,
  FastForward,
  Gauge,
  ScanLine,
  Sun,
  TrendingUp,
  WandSparkles,
  type LucideIcon,
} from "lucide-react";
import { type TemplateKind } from "@/lib/api/templates";
import { type StudioCopyKey } from "@/lib/i18n/studio-copy";

export const kindKeys: Record<TemplateKind | "all", StudioCopyKey> = {
  all: "templates.kind.all",
  image: "templates.kind.image",
  video: "templates.kind.video",
  audio: "templates.kind.audio",
  document: "templates.kind.document",
};

export type CopyLocale = "th" | "en";

/** The three modes of the control column, named like the creation page's own tools. */
export type Mode = "create" | "edit" | "motion";

// The Edit video tab is hidden until the team decides what it should do (its layout and tools are kept in the code).
export const modes: Mode[] = ["create", "motion"];

export const DEFAULT_MODE: Mode = "create";

export const modeKeys: Record<Mode, StudioCopyKey> = {
  create: "templates.mode.create",
  edit: "templates.mode.edit",
  motion: "templates.mode.motion",
};

export const heroKeys: Record<Mode, { tag: StudioCopyKey; title: StudioCopyKey; body: StudioCopyKey }> = {
  create: { tag: "templates.hero.video.tag", title: "templates.hero.video.title", body: "templates.hero.video.body" },
  edit: { tag: "templates.hero.edit.tag", title: "templates.hero.edit.title", body: "templates.hero.edit.body" },
  motion: { tag: "templates.hero.motion.tag", title: "templates.hero.motion.title", body: "templates.hero.motion.body" },
};

/** The three steps of each mode, shown under "How it works" and as the invitation on "History". */
export const stepsByMode: Record<Mode, Array<[StudioCopyKey, StudioCopyKey]>> = {
  create: [
    ["templates.how.step1.title", "templates.how.step1.body"],
    ["templates.how.step2.title", "templates.how.step2.body"],
    ["templates.how.step3.title", "templates.how.step3.body"],
  ],
  edit: [
    ["templates.how.edit.step1.title", "templates.how.edit.step1.body"],
    ["templates.how.edit.step2.title", "templates.how.edit.step2.body"],
    ["templates.how.edit.step3.title", "templates.how.edit.step3.body"],
  ],
  motion: [
    ["templates.how.motion.step1.title", "templates.how.motion.step1.body"],
    ["templates.how.motion.step2.title", "templates.how.motion.step2.body"],
    ["templates.how.motion.step3.title", "templates.how.motion.step3.body"],
  ],
};

/** The three lists of the library, like the example's: the studio's own templates, then the community's, trending and new. */
export type Lane = "eos" | "communityTrending" | "communityNew";

export const laneQuery: Record<Lane, { source: "official" | "community"; sort: "recommended" | "popular" | "newest" }> = {
  eos: { source: "official", sort: "recommended" },
  communityTrending: { source: "community", sort: "popular" },
  communityNew: { source: "community", sort: "newest" },
};

export const laneOptions: Array<[Lane, StudioCopyKey, LucideIcon]> = [
  ["eos", "templates.source.eos", WandSparkles],
  ["communityTrending", "templates.source.communityTrending", TrendingUp],
  ["communityNew", "templates.source.communityNew", Clock],
];

/** Editing tools shown in the reference UI; destinations are ready to be wired to their EOS tools. */
export type EditToolId = "edit" | "extend" | "reframe" | "upscale" | "removeBackground" | "sdrToHdr" | "fpsBoost" | "depthMap";

export const editTools: Array<{ id: EditToolId; icon: LucideIcon; title: StudioCopyKey; desc: StudioCopyKey; href: string; isNew?: boolean }> = [
  { id: "edit", icon: WandSparkles, title: "templates.edit.edit.title", desc: "templates.edit.edit.desc", href: "/create/video?tool=edit" },
  { id: "extend", icon: FastForward, title: "templates.edit.extend.title", desc: "templates.edit.extend.desc", href: "/create/video?tab=extend-video" },
  { id: "reframe", icon: Crop, title: "templates.edit.reframe.title", desc: "templates.edit.reframe.desc", href: "/create/video?tool=reframe" },
  { id: "upscale", icon: Expand, title: "templates.edit.upscale.title", desc: "templates.edit.upscale.desc", href: "/create/video?tool=upscale" },
  { id: "removeBackground", icon: Eraser, title: "templates.edit.removeBackground.title", desc: "templates.edit.removeBackground.desc", href: "/create/video?tool=remove-background", isNew: true },
  { id: "sdrToHdr", icon: Sun, title: "templates.edit.sdrToHdr.title", desc: "templates.edit.sdrToHdr.desc", href: "/create/video?tool=sdr-to-hdr", isNew: true },
  { id: "fpsBoost", icon: Gauge, title: "templates.edit.fpsBoost.title", desc: "templates.edit.fpsBoost.desc", href: "/create/video?tool=fps-boost", isNew: true },
  { id: "depthMap", icon: ScanLine, title: "templates.edit.depthMap.title", desc: "templates.edit.depthMap.desc", href: "/create/video?tool=depth-map", isNew: true },
];

// The creator features each mode produces, to pick this mode's videos out of the account history.
export const modeFeatures: Record<Mode, string[]> = {
  create: ["text-to-video", "image-to-video"],
  edit: ["extend-video", "lipsync", "people-video"],
  motion: ["motion-transfer", "video-swap"],
};

/** Sent when a workflow run starts, so the History tab shows it and follows it. */
export const workflowEvent = "eos:template-workflow-changed";

export const modeCategory: Record<Mode, string> = { create: "Video", edit: "Edit video", motion: "Motion" };

export const modeCover: Record<Mode, string> = {
  create: "/generated-icons-v2/templates/ai-presenter-video.png",
  edit: "/generated-icons-v2/templates/training-video.png",
  motion: "/generated-icons-v2/templates/product-ad.png",
};
