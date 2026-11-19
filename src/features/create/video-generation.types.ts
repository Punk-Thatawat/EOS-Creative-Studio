import {
  generationModeOptions,
  referenceImageRoles,
  videoModeOptions,
  videoTabValues,
} from "./video-generation.constants";

export type ActiveVideoTab = (typeof videoTabValues)[keyof typeof videoTabValues];

export type VideoModeCopyValue = (typeof videoModeOptions)[number]["value"] | (typeof generationModeOptions)[number]["value"];

export type GenerationMode = (typeof generationModeOptions)[number]["value"];

export type ReferenceImageRole = (typeof referenceImageRoles)[number]["key"];

export type ReferenceImageSlot = {
  url: string;
  file: File;
};

export type StartFrameSource = "manual" | "previous_last_frame";

export type StoryboardScene = {
  id: string;
  image: string | null;
  imageFile: File | null;
  endImage: string | null;
  endImageFile: File | null;
  prompt: string;
  duration: number;
  aspectRatio?: string;
  startFrameSource: StartFrameSource;
  modelParams: Record<string, unknown>;
};

export type StoryboardSlice = {
  id: string;
  image: string;
  file: File;
};

export type AxisGap = {
  start: number;
  end: number;
};

export type StoryboardFrameSide = "left" | "right" | "top" | "bottom";

export type StoryboardEdgeStats = {
  mean: number;
  stdev: number;
  saturation: number;
};

export type SchemaProperty = {
  type?: string;
  title?: string;
  description?: string;
  default?: unknown;
  enum?: unknown[];
  maxItems?: number;
  minimum?: number;
  maximum?: number;
  step?: number;
  format?: string;
  items?: { type?: string; [key: string]: unknown };
  [key: string]: unknown;
};

export type VideoGenerationStatus = "idle" | "uploading" | "processing" | "completed" | "failed" | "cancelled";
