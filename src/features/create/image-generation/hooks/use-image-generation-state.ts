"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cancelGeneration, createBackgroundGeneration, createExtendImage, createImageToImage, createStyleTransfer, createTextToImage, createUpscale, listGenerationHistory, resumeGeneration, resumeTextToImage, type GenerationHistoryItem, type GenerationProgress, type GenerationStatus, type ImageCreditQuoteInput, type PendingGeneration, type TextToImageOutput } from "@/lib/api/generations";
import { listGenerationModels, type GenerationModelOption } from "@/lib/api/generation-models";
import { listStylePresets, type GenerationStylePreset, type StylePresetFeature } from "@/lib/api/style-presets";
import { uploadImageAsset, uploadMaskAsset } from "@/lib/api/storage";
import { useImageCreditEstimate } from "./use-image-credit-estimate";
import {
  imageCountOptions,
  imageGenerationTabs,
  imageRatios,
  type BackgroundMode,
  type ExtendAmount,
  type ExtendDirection,
  type MaskTool,
  promptQualityOptions,
  qualityOptions,
  imageResolutionOptions,
  supportedQualityOptions,
  supportedRatiosForModel,
  supportedResolutionOptions,
  stylePresetImages,
  stylePresets,
  styleTransferPresets,
  type ImageCount,
  type ImageGenerationTab,
  type ImageQuality,
  type ImageRatio,
  type StylePreset,
  type StyleSourceMode,
  type StyleTransferPreset,
} from "../config";

const pendingGenerationStorageKey = "eos.generation.pending";
const imageGenerationDraftStorageKey = "eos.generation.image-draft.v1";
const imageToImageSourceImageStorageKey = "eos.generation.source-image.image-to-image";
const imageToImageSourceImagesStorageKey = "eos.generation.source-images.image-to-image";
const styleTransferSourceImageStorageKey = "eos.generation.source-image.style-transfer";
const backgroundSourceImageStorageKey = "eos.generation.source-image.background";
  const upscaleSourceImageStorageKey = "eos.generation.source-image.upscale";
const extendSourceImageStorageKey = "eos.generation.source-image.extend";
const styleReferenceImageStorageKey = "eos.generation.style-reference-image";
const providerControlledModelParameters = new Set(["enable_sync_mode", "enable_base64_output", "output_format", "outputFormat", "format"]);

const fallbackStylePresetOptions: GenerationStylePreset[] = stylePresets.map((name, index) => ({ id: `fallback-${name}`, slug: name.toLowerCase().replace(/\s+/g, "-"), name, prompt: name, imageUrl: stylePresetImages[index] ?? null, features: ["text-to-image", "image-to-image", "background-removal"], enabled: true, sortOrder: (index + 1) * 10, createdAt: "", updatedAt: "" }));
fallbackStylePresetOptions.push(...styleTransferPresets.map((preset, index) => ({ id: `fallback-style-${preset.name}`, slug: preset.name.toLowerCase().replace(/\s+/g, "-"), name: preset.name, prompt: preset.name, imageUrl: preset.image, features: ["style-transfer"] as StylePresetFeature[], enabled: true, sortOrder: 110 + index * 10, createdAt: "", updatedAt: "" })));

function pendingGenerationStorageKeyForFeature(feature: string): string {
  return feature === "text-to-image" ? pendingGenerationStorageKey : `${pendingGenerationStorageKey}.${feature}`;
}

function readStoredImageUrl(key: string): string | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(key);
}

function readStoredImageUrls(key: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(key) ?? "null");
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string" && value.length > 0) : [];
  } catch {
    return [];
  }
}

function storeImageUrl(key: string, imageUrl: string | null): void {
  if (typeof window === "undefined") return;
  if (imageUrl) window.sessionStorage.setItem(key, imageUrl);
  else window.sessionStorage.removeItem(key);
}

function storeImageUrls(key: string, imageUrls: string[]): void {
  if (typeof window === "undefined") return;
  if (imageUrls.length > 0) window.sessionStorage.setItem(key, JSON.stringify(imageUrls));
  else window.sessionStorage.removeItem(key);
}

function readPendingGeneration(feature = "text-to-image"): PendingGeneration | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(pendingGenerationStorageKeyForFeature(feature));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingGeneration>;
    if (typeof parsed.generationId !== "string" || typeof parsed.pollUrl !== "string" || typeof parsed.workspaceId !== "string" || typeof parsed.provider !== "string" || typeof parsed.model !== "string" || (parsed.status !== "queued" && parsed.status !== "processing" && parsed.status !== "completed") || !Array.isArray(parsed.output)) return null;
    return { generationId: parsed.generationId, pollUrl: parsed.pollUrl, workspaceId: parsed.workspaceId, provider: parsed.provider, model: parsed.model, status: parsed.status, totalCount: typeof parsed.totalCount === "number" ? parsed.totalCount : 1, completedCount: typeof parsed.completedCount === "number" ? parsed.completedCount : parsed.output.length, output: parsed.output as PendingGeneration["output"] };
  } catch {
    window.sessionStorage.removeItem(pendingGenerationStorageKeyForFeature(feature));
    return null;
  }
}

function isPendingGenerationActive(pending: PendingGeneration | null): boolean {
  return pending?.status === "queued" || pending?.status === "processing";
}

function savePendingGeneration(progress: GenerationProgress, feature = "text-to-image"): PendingGeneration | null {
  if (typeof window === "undefined") return null;
  if (progress.status === "failed" || progress.status === "cancelled") {
    window.sessionStorage.removeItem(pendingGenerationStorageKeyForFeature(feature));
    return null;
  }

  const pendingGeneration: PendingGeneration = {
    generationId: progress.generationId,
    pollUrl: progress.pollUrl ?? `/api/v1/generations/${progress.generationId}/status`,
    workspaceId: progress.workspaceId ?? "",
    provider: progress.provider ?? "",
    model: progress.model ?? "",
    status: progress.status,
    totalCount: progress.totalCount,
    completedCount: progress.completedCount,
    output: progress.output,
  };
  window.sessionStorage.setItem(pendingGenerationStorageKeyForFeature(feature), JSON.stringify(pendingGeneration));
  if (progress.workspaceId) window.sessionStorage.setItem("eos.generation.workspace-id", progress.workspaceId);
  return pendingGeneration;
}

function featureKeyForTab(tab: ImageGenerationTab): string {
  switch (tab) {
    case "Text to Image": return "text-to-image";
    case "Image to Image": return "image-to-image";
    case "AI Style Transfer": return "style-transfer";
    case "AI Background": return "background-removal";
    case "Upscale": return "upscale";
    case "Extend Image": return "extend-image";
  }
}

function supportsBackgroundMode(model: GenerationModelOption, mode: BackgroundMode, hasMask = false): boolean {
  const configuredModes = model.capabilities?.backgroundModes ?? [];
  // Prefer a model's native Solid Color capability. Models without it use
  // the transparent-cutout fallback and are composited locally.
  if (mode === "solid" && configuredModes.includes("solid")) return true;
  const capabilityMode = mode;
  if (capabilityMode === "solid") return supportsBackgroundMode(model, "remove", hasMask);
  if (configuredModes.length > 0 && !configuredModes.includes(capabilityMode)) return false;
  if (capabilityMode === "remove") {
    const maskParameter = model.capabilities?.maskParameter;
    const requiredMask = Boolean(maskParameter && model.capabilities?.requiredParameters?.includes(maskParameter));
    if (requiredMask && !hasMask) return false;
    if (configuredModes.length > 0) return true;
    return /background.?remover|remove.?background|feynobg/i.test(model.model);
  }
  if (configuredModes.length > 0) return true;
  return Boolean(model.capabilities?.promptParameter || model.capabilities?.backgroundImageParameter);
}

async function createSolidBackgroundFile(imageUrl: string, color: string, outputFormat?: string): Promise<File> {
  const response = await fetch(imageUrl);
  if (!response.ok) throw new Error("Unable to download the transparent cutout");
  const bitmap = await createImageBitmap(await response.blob());
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("Unable to prepare the solid background");
  }
  context.fillStyle = /^#[0-9a-f]{6}$/i.test(color) ? color : "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  const normalizedFormat = outputFormat?.toLowerCase();
  const mimeType = normalizedFormat === "jpeg" || normalizedFormat === "jpg"
    ? "image/jpeg"
    : normalizedFormat === "webp"
      ? "image/webp"
      : "image/png";
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("Unable to export the solid background")), mimeType, mimeType === "image/png" ? undefined : 0.92));
  const extension = mimeType === "image/jpeg" ? "jpg" : mimeType.slice("image/".length);
  return new File([blob], `solid-background-${crypto.randomUUID()}.${extension}`, { type: mimeType });
}

function pendingGenerationFromHistory(generation: GenerationHistoryItem & { status: "queued" | "processing" }, fallbackWorkspaceId: string): PendingGeneration {
  return {
    generationId: generation.id,
    pollUrl: generation.pollUrl ?? `/api/v1/generations/${generation.id}/status`,
    workspaceId: generation.workspaceId ?? fallbackWorkspaceId,
    provider: generation.provider ?? "",
    model: generation.model ?? "",
    status: generation.status,
    totalCount: generation.totalCount ?? Math.max(1, generation.output?.length ?? 1),
    completedCount: generation.completedCount ?? generation.output?.length ?? 0,
    output: generation.output ?? [],
  };
}

type GenerationCancelTarget = Pick<PendingGeneration, "generationId" | "workspaceId">;

type ImageGenerationDraft = {
  activeTab: ImageGenerationTab;
  style: string | null;
  ratio: string;
  quality: string;
  resolution: string;
  selectedModel: string;
  selectedImageToImageModel: string;
  selectedStyleTransferModel: string;
  selectedBackgroundModel: string;
  selectedUpscaleModel: string;
  selectedExtendModel: string;
  outputFormat: string | null;
  modelParams: Record<string, unknown>;
  count: string;
  prompt: string;
  imageToImagePrompt: string;
  styleTransferPrompt: string;
  backgroundPrompt: string;
  extendPrompt: string;
  negativePrompt: string;
  smartEnhance: boolean;
  imageToImageSourceImage: string | null;
  imageToImageSourceImages: string[];
  styleTransferSourceImage: string | null;
  backgroundSourceImage: string | null;
  upscaleSourceImage: string | null;
  extendSourceImage: string | null;
  extendDirection: string;
  extendAmount: string;
  styleSourceMode: string;
  styleTransferPreset: string;
  styleReferenceImage: string | null;
  backgroundReferenceImage: string | null;
  backgroundMode: string;
  backgroundColor: string;
  maskTool: string;
  brushSize: number;
  preserveSubject: boolean;
  edgeCleanup: boolean;
  addShadow: boolean;
  matchLighting: boolean;
  imageStrength: number;
  contentPreservation: number;
  facePreservation: boolean;
  seed: string;
  selectedVariation: number;
  generated: boolean;
  generatedImageUrls: string[];
  imageToImageGenerated: boolean;
  imageToImageUrls: string[];
  styleTransferGenerated: boolean;
  styleTransferUrls: string[];
  backgroundGenerated: boolean;
  backgroundUrls: string[];
  extendGenerated: boolean;
  extendUrls: string[];
  upscaleGenerated: boolean;
  upscaleUrls: string[];
};

function readImageGenerationDraft(): Partial<ImageGenerationDraft> | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(imageGenerationDraftStorageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Partial<ImageGenerationDraft>
      : null;
  } catch {
    window.sessionStorage.removeItem(imageGenerationDraftStorageKey);
    return null;
  }
}

function writeImageGenerationDraft(draft: ImageGenerationDraft): void {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(imageGenerationDraftStorageKey, JSON.stringify(draft));
  } catch {
    // Session storage can be unavailable or full; the in-memory form still works.
  }
}

export function useImageGenerationState() {
  // Keep the first render deterministic for SSR. Browser storage is restored
  // after hydration in the effect below.
  const [pendingGeneration, setPendingGeneration] = useState<PendingGeneration | null>(null);
  const initialPendingIsActive = pendingGeneration?.status === "queued" || pendingGeneration?.status === "processing";
  const [activeTab, setActiveTab] = useState<ImageGenerationTab>(imageGenerationTabs[0]);
  const [style, setStyle] = useState<StylePreset | null>(null);
  const [ratio, setRatio] = useState<ImageRatio>("16:9");
  const [quality, setQuality] = useState<ImageQuality>("medium");
  const [resolution, setResolution] = useState(imageResolutionOptions["16:9"][0] ?? "720p");
  const [isLoadingModels, setIsLoadingModels] = useState(true);
  const [modelOptions, setModelOptions] = useState<GenerationModelOption[]>([]);
  const [imageToImageModelOptions, setImageToImageModelOptions] = useState<GenerationModelOption[]>([]);
  const [styleTransferModelOptions, setStyleTransferModelOptions] = useState<GenerationModelOption[]>([]);
  const [backgroundModelOptions, setBackgroundModelOptions] = useState<GenerationModelOption[]>([]);
  const [upscaleModelOptions, setUpscaleModelOptions] = useState<GenerationModelOption[]>([]);
  const [extendModelOptions, setExtendModelOptions] = useState<GenerationModelOption[]>([]);
  const [stylePresetOptions, setStylePresetOptions] = useState<GenerationStylePreset[]>(fallbackStylePresetOptions);
  const [selectedModel, setSelectedModel] = useState("");
  const [selectedImageToImageModel, setSelectedImageToImageModel] = useState("");
  const [selectedStyleTransferModel, setSelectedStyleTransferModel] = useState("");
  const [selectedBackgroundModel, setSelectedBackgroundModel] = useState("");
  const [selectedUpscaleModel, setSelectedUpscaleModel] = useState("");
  const [selectedExtendModel, setSelectedExtendModel] = useState("");
  const [outputFormat, setOutputFormat] = useState<string | null>(null);
  const [modelParams, setModelParams] = useState<Record<string, unknown>>({});
  const [count, setCount] = useState<ImageCount>(imageCountOptions[0]);
  const [prompt, setPrompt] = useState("");
  const [imageToImagePrompt, setImageToImagePrompt] = useState("");
  const [styleTransferPrompt, setStyleTransferPrompt] = useState("");
  const [backgroundPrompt, setBackgroundPrompt] = useState("");
  const [extendPrompt, setExtendPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("low quality, blurry, text, watermark, logo, deformed...");
  const [smartEnhance, setSmartEnhance] = useState(true);
  const [imageToImageSourceImage, setImageToImageSourceImage] = useState<string | null>(null);
  const [imageToImageSourceImages, setImageToImageSourceImages] = useState<string[]>([]);
  const [styleTransferSourceImage, setStyleTransferSourceImage] = useState<string | null>(null);
  const [backgroundSourceImage, setBackgroundSourceImage] = useState<string | null>(null);
  const [upscaleSourceImage, setUpscaleSourceImage] = useState<string | null>(null);
  const [extendSourceImage, setExtendSourceImage] = useState<string | null>(null);
  const [extendDirection, setExtendDirection] = useState<ExtendDirection>("right");
  const [extendAmount, setExtendAmount] = useState<ExtendAmount>("50%");
  const [styleSourceMode, setStyleSourceMode] = useState<StyleSourceMode>("preset");
  const [styleTransferPreset, setStyleTransferPreset] = useState<StyleTransferPreset>("Anime");
  const [styleReferenceImage, setStyleReferenceImage] = useState<string | null>(null);
  const [backgroundReferenceImage, setBackgroundReferenceImage] = useState<string | null>(null);
  const [backgroundMode, setBackgroundMode] = useState<BackgroundMode>("remove");
  const [backgroundColor, setBackgroundColor] = useState("#ffffff");
  const [maskTool, setMaskTool] = useState<MaskTool>("brush");
  const [brushSize, setBrushSize] = useState(42);
  const [backgroundMask, setBackgroundMask] = useState<string | null>(null);
  const [preserveSubject, setPreserveSubject] = useState(true);
  const [edgeCleanup, setEdgeCleanup] = useState(true);
  const [addShadow, setAddShadow] = useState(false);
  const [matchLighting, setMatchLighting] = useState(true);
  const [imageStrength, setImageStrength] = useState(65);
  const [contentPreservation, setContentPreservation] = useState(75);
  const [facePreservation, setFacePreservation] = useState(true);
  const [seed, setSeed] = useState("");
  const [selectedVariation, setSelectedVariation] = useState(0);
  const [generated, setGenerated] = useState(false);
  const [generatedImageUrls, setGeneratedImageUrls] = useState<string[]>([]);
  const [imageToImageGenerated, setImageToImageGenerated] = useState(false);
  const [imageToImageUrls, setImageToImageUrls] = useState<string[]>([]);
  const [imageToImagePendingGeneration, setImageToImagePendingGeneration] = useState<PendingGeneration | null>(null);
  const [selectedRecentImageUrl, setSelectedRecentImageUrl] = useState<string | null>(null);
  const [recentGenerationUrls, setRecentGenerationUrls] = useState<string[]>([]);
  // The backend resolves the workspace from the authenticated user. Do not
  // seed this from a build-time workspace id because it can belong to a
  // deleted user/workspace after a local database reset.
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [isLoadingRecent, setIsLoadingRecent] = useState(false);
  const [recentError, setRecentError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(initialPendingIsActive);
  const [generationId, setGenerationId] = useState<string | null>(pendingGeneration?.generationId ?? null);
  const [generationStatus, setGenerationStatus] = useState<GenerationStatus>(pendingGeneration?.status ?? "idle");
  const [generationTotalCount, setGenerationTotalCount] = useState(pendingGeneration?.totalCount ?? 0);
  const [generationCompletedCount, setGenerationCompletedCount] = useState(pendingGeneration?.completedCount ?? 0);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [imageToImageIsGenerating, setImageToImageIsGenerating] = useState(false);
  const [imageToImageStatus, setImageToImageStatus] = useState<GenerationStatus>("idle");
  const [imageToImageTotalCount, setImageToImageTotalCount] = useState(0);
  const [imageToImageCompletedCount, setImageToImageCompletedCount] = useState(0);
  const [imageToImageError, setImageToImageError] = useState<string | null>(null);
  const [styleTransferGenerated, setStyleTransferGenerated] = useState(false);
  const [styleTransferUrls, setStyleTransferUrls] = useState<string[]>([]);
  const [styleTransferPendingGeneration, setStyleTransferPendingGeneration] = useState<PendingGeneration | null>(null);
  const [styleTransferIsGenerating, setStyleTransferIsGenerating] = useState(false);
  const [styleTransferStatus, setStyleTransferStatus] = useState<GenerationStatus>("idle");
  const [styleTransferTotalCount, setStyleTransferTotalCount] = useState(0);
  const [styleTransferCompletedCount, setStyleTransferCompletedCount] = useState(0);
  const [styleTransferError, setStyleTransferError] = useState<string | null>(null);
  const [backgroundGenerated, setBackgroundGenerated] = useState(false);
  const [backgroundUrls, setBackgroundUrls] = useState<string[]>([]);
  const [backgroundIsGenerating, setBackgroundIsGenerating] = useState(false);
  const [backgroundStatus, setBackgroundStatus] = useState<GenerationStatus>("idle");
  const [backgroundTotalCount, setBackgroundTotalCount] = useState(0);
  const [backgroundCompletedCount, setBackgroundCompletedCount] = useState(0);
  const [backgroundError, setBackgroundError] = useState<string | null>(null);
  const [extendGenerated, setExtendGenerated] = useState(false);
  const [extendUrls, setExtendUrls] = useState<string[]>([]);
  const [extendPendingGeneration, setExtendPendingGeneration] = useState<PendingGeneration | null>(null);
  const [extendIsGenerating, setExtendIsGenerating] = useState(false);
  const [extendStatus, setExtendStatus] = useState<GenerationStatus>("idle");
  const [extendTotalCount, setExtendTotalCount] = useState(0);
  const [extendCompletedCount, setExtendCompletedCount] = useState(0);
  const [extendError, setExtendError] = useState<string | null>(null);
  const [upscaleGenerated, setUpscaleGenerated] = useState(false);
  const [upscaleUrls, setUpscaleUrls] = useState<string[]>([]);
  const [upscalePendingGeneration, setUpscalePendingGeneration] = useState<PendingGeneration | null>(null);
  const [upscaleIsGenerating, setUpscaleIsGenerating] = useState(false);
  const [upscaleStatus, setUpscaleStatus] = useState<GenerationStatus>("idle");
  const [upscaleTotalCount, setUpscaleTotalCount] = useState(0);
  const [upscaleCompletedCount, setUpscaleCompletedCount] = useState(0);
  const [upscaleError, setUpscaleError] = useState<string | null>(null);
  const [imageMimeTypes, setImageMimeTypes] = useState<Record<string, string>>({});
  const [imageSizeOpen, setImageSizeOpen] = useState(false);
  const resumeStartedRef = useRef(false);
  const generationRunRef = useRef(false);
  const generationAbortRef = useRef<AbortController | null>(null);
  const generationCancelRequestedRef = useRef(false);
  const imageToImageResumeStartedRef = useRef(false);
  const imageToImageRunRef = useRef(false);
  const styleTransferResumeStartedRef = useRef(false);
  const styleTransferRunRef = useRef(false);
  const imageToImageAbortRef = useRef<AbortController | null>(null);
  const imageToImageCancelRequestedRef = useRef(false);
  const styleTransferAbortRef = useRef<AbortController | null>(null);
  const styleTransferCancelRequestedRef = useRef(false);
  const backgroundAbortRef = useRef<AbortController | null>(null);
  const backgroundCancelRequestedRef = useRef(false);
  const extendResumeStartedRef = useRef(false);
  const extendRunRef = useRef(false);
  const extendAbortRef = useRef<AbortController | null>(null);
  const extendCancelRequestedRef = useRef(false);
  const upscaleResumeStartedRef = useRef(false);
  const upscaleRunRef = useRef(false);
  const upscaleAbortRef = useRef<AbortController | null>(null);
  const upscaleCancelRequestedRef = useRef(false);
  const recentRequestRef = useRef(0);
  const activeTabRef = useRef(activeTab);
  const draftRestoreCompleteRef = useRef(false);

  const rememberImageMimeTypes = useCallback((outputs: TextToImageOutput[]) => {
    const entries = outputs
      .filter((output) => Boolean(output.url && output.mimeType))
      .map((output) => [output.url, output.mimeType as string] as const);
    if (entries.length === 0) return;
    setImageMimeTypes((current) => ({ ...current, ...Object.fromEntries(entries) }));
  }, []);

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      if (generationRunRef.current) return;

      const storedDraft = readImageGenerationDraft();
      if (storedDraft) {
        if (typeof storedDraft.activeTab === "string" && imageGenerationTabs.includes(storedDraft.activeTab as ImageGenerationTab)) setActiveTab(storedDraft.activeTab as ImageGenerationTab);
        if (storedDraft.style === null || typeof storedDraft.style === "string") setStyle(storedDraft.style ?? null);
        if (typeof storedDraft.ratio === "string" && imageRatios.includes(storedDraft.ratio as ImageRatio)) setRatio(storedDraft.ratio as ImageRatio);
        if (typeof storedDraft.quality === "string") setQuality(storedDraft.quality);
        if (typeof storedDraft.resolution === "string") setResolution(storedDraft.resolution);
        if (typeof storedDraft.selectedModel === "string") setSelectedModel(storedDraft.selectedModel);
        if (typeof storedDraft.selectedImageToImageModel === "string") setSelectedImageToImageModel(storedDraft.selectedImageToImageModel);
        if (typeof storedDraft.selectedStyleTransferModel === "string") setSelectedStyleTransferModel(storedDraft.selectedStyleTransferModel);
        if (typeof storedDraft.selectedBackgroundModel === "string") setSelectedBackgroundModel(storedDraft.selectedBackgroundModel);
        if (typeof storedDraft.selectedUpscaleModel === "string") setSelectedUpscaleModel(storedDraft.selectedUpscaleModel);
        if (typeof storedDraft.selectedExtendModel === "string") setSelectedExtendModel(storedDraft.selectedExtendModel);
        if (storedDraft.outputFormat === null || typeof storedDraft.outputFormat === "string") setOutputFormat(storedDraft.outputFormat ?? null);
        if (storedDraft.modelParams && typeof storedDraft.modelParams === "object" && !Array.isArray(storedDraft.modelParams)) setModelParams(storedDraft.modelParams);
        if (typeof storedDraft.count === "string") setCount(storedDraft.count);
        if (typeof storedDraft.prompt === "string") setPrompt(storedDraft.prompt);
        if (typeof storedDraft.imageToImagePrompt === "string") setImageToImagePrompt(storedDraft.imageToImagePrompt);
        if (Array.isArray(storedDraft.imageToImageSourceImages)) setImageToImageSourceImages(storedDraft.imageToImageSourceImages.filter((url): url is string => typeof url === "string"));
        if (typeof storedDraft.styleTransferPrompt === "string") setStyleTransferPrompt(storedDraft.styleTransferPrompt);
        if (typeof storedDraft.backgroundPrompt === "string") setBackgroundPrompt(storedDraft.backgroundPrompt);
        if (typeof storedDraft.extendPrompt === "string") setExtendPrompt(storedDraft.extendPrompt);
        if (typeof storedDraft.negativePrompt === "string") setNegativePrompt(storedDraft.negativePrompt);
        if (typeof storedDraft.smartEnhance === "boolean") setSmartEnhance(storedDraft.smartEnhance);
        if (typeof storedDraft.extendDirection === "string" && ["left", "right", "top", "bottom", "all"].includes(storedDraft.extendDirection)) setExtendDirection(storedDraft.extendDirection as ExtendDirection);
        if (typeof storedDraft.extendAmount === "string" && ["25%", "50%", "100%"].includes(storedDraft.extendAmount)) setExtendAmount(storedDraft.extendAmount as ExtendAmount);
        if (storedDraft.styleSourceMode === "preset" || storedDraft.styleSourceMode === "reference") setStyleSourceMode(storedDraft.styleSourceMode);
        if (typeof storedDraft.styleTransferPreset === "string") setStyleTransferPreset(storedDraft.styleTransferPreset);
        if (storedDraft.styleReferenceImage === null || typeof storedDraft.styleReferenceImage === "string") setStyleReferenceImage(storedDraft.styleReferenceImage ?? null);
        if (storedDraft.backgroundReferenceImage === null || typeof storedDraft.backgroundReferenceImage === "string") setBackgroundReferenceImage(storedDraft.backgroundReferenceImage ?? null);
        if (typeof storedDraft.backgroundMode === "string" && ["remove", "replace", "generate", "solid"].includes(storedDraft.backgroundMode)) setBackgroundMode(storedDraft.backgroundMode as BackgroundMode);
        if (typeof storedDraft.backgroundColor === "string") setBackgroundColor(storedDraft.backgroundColor);
        if (typeof storedDraft.maskTool === "string" && ["brush", "lasso", "eraser"].includes(storedDraft.maskTool)) setMaskTool(storedDraft.maskTool as MaskTool);
        if (typeof storedDraft.brushSize === "number" && Number.isFinite(storedDraft.brushSize)) setBrushSize(storedDraft.brushSize);
        if (typeof storedDraft.preserveSubject === "boolean") setPreserveSubject(storedDraft.preserveSubject);
        if (typeof storedDraft.edgeCleanup === "boolean") setEdgeCleanup(storedDraft.edgeCleanup);
        if (typeof storedDraft.addShadow === "boolean") setAddShadow(storedDraft.addShadow);
        if (typeof storedDraft.matchLighting === "boolean") setMatchLighting(storedDraft.matchLighting);
        if (typeof storedDraft.imageStrength === "number" && Number.isFinite(storedDraft.imageStrength)) setImageStrength(storedDraft.imageStrength);
        if (typeof storedDraft.contentPreservation === "number" && Number.isFinite(storedDraft.contentPreservation)) setContentPreservation(storedDraft.contentPreservation);
        if (typeof storedDraft.facePreservation === "boolean") setFacePreservation(storedDraft.facePreservation);
        if (typeof storedDraft.seed === "string") setSeed(storedDraft.seed);
        if (typeof storedDraft.selectedVariation === "number" && Number.isFinite(storedDraft.selectedVariation)) setSelectedVariation(storedDraft.selectedVariation);
        if (typeof storedDraft.generated === "boolean") setGenerated(storedDraft.generated);
        if (Array.isArray(storedDraft.generatedImageUrls)) setGeneratedImageUrls(storedDraft.generatedImageUrls.filter((url): url is string => typeof url === "string"));
        if (typeof storedDraft.imageToImageGenerated === "boolean") setImageToImageGenerated(storedDraft.imageToImageGenerated);
        if (Array.isArray(storedDraft.imageToImageUrls)) setImageToImageUrls(storedDraft.imageToImageUrls.filter((url): url is string => typeof url === "string"));
        if (typeof storedDraft.styleTransferGenerated === "boolean") setStyleTransferGenerated(storedDraft.styleTransferGenerated);
        if (Array.isArray(storedDraft.styleTransferUrls)) setStyleTransferUrls(storedDraft.styleTransferUrls.filter((url): url is string => typeof url === "string"));
        if (typeof storedDraft.backgroundGenerated === "boolean") setBackgroundGenerated(storedDraft.backgroundGenerated);
        if (Array.isArray(storedDraft.backgroundUrls)) setBackgroundUrls(storedDraft.backgroundUrls.filter((url): url is string => typeof url === "string"));
        if (typeof storedDraft.extendGenerated === "boolean") setExtendGenerated(storedDraft.extendGenerated);
        if (Array.isArray(storedDraft.extendUrls)) setExtendUrls(storedDraft.extendUrls.filter((url): url is string => typeof url === "string"));
        if (typeof storedDraft.upscaleGenerated === "boolean") setUpscaleGenerated(storedDraft.upscaleGenerated);
        if (Array.isArray(storedDraft.upscaleUrls)) setUpscaleUrls(storedDraft.upscaleUrls.filter((url): url is string => typeof url === "string"));
        // Recent generations are account-owned server data. Do not restore
        // cached URLs from localStorage because that cache is not user-scoped.
      }

      const storedPendingGeneration = readPendingGeneration();
      const storedImageToImagePendingGeneration = readPendingGeneration("image-to-image");
      const storedStyleTransferPendingGeneration = readPendingGeneration("style-transfer");
      const storedBackgroundPendingGeneration = readPendingGeneration("background-removal");
      const storedExtendPendingGeneration = readPendingGeneration("extend-image");
      const storedUpscalePendingGeneration = readPendingGeneration("upscale");
      const storedImageToImageSourceImage = readStoredImageUrl(imageToImageSourceImageStorageKey);
      const storedStyleTransferSourceImage = readStoredImageUrl(styleTransferSourceImageStorageKey);
      const storedBackgroundSourceImage = readStoredImageUrl(backgroundSourceImageStorageKey);
      const storedUpscaleSourceImage = readStoredImageUrl(upscaleSourceImageStorageKey);
      const storedExtendSourceImage = readStoredImageUrl(extendSourceImageStorageKey);
      const storedStyleReferenceImage = readStoredImageUrl(styleReferenceImageStorageKey);
      const storedImageToImageSourceImages = readStoredImageUrls(imageToImageSourceImagesStorageKey);
      if (storedImageToImageSourceImages.length > 0) {
        setImageToImageSourceImages(storedImageToImageSourceImages);
        setImageToImageSourceImage(storedImageToImageSourceImages[0]);
      } else if (storedImageToImageSourceImage) {
        setImageToImageSourceImages([storedImageToImageSourceImage]);
        setImageToImageSourceImage(storedImageToImageSourceImage);
      }
      if (storedStyleTransferSourceImage) setStyleTransferSourceImage(storedStyleTransferSourceImage);
      if (storedBackgroundSourceImage) setBackgroundSourceImage(storedBackgroundSourceImage);
      if (storedUpscaleSourceImage) setUpscaleSourceImage(storedUpscaleSourceImage);
      if (storedExtendSourceImage) setExtendSourceImage(storedExtendSourceImage);
      if (storedStyleReferenceImage) setStyleReferenceImage(storedStyleReferenceImage);

      if (storedPendingGeneration) {
        setPendingGeneration(storedPendingGeneration);
        setGenerationId(storedPendingGeneration.generationId);
        setGenerationStatus(storedPendingGeneration.status);
        setGenerationTotalCount(storedPendingGeneration.totalCount);
        setGenerationCompletedCount(storedPendingGeneration.completedCount);
        setGeneratedImageUrls(storedPendingGeneration.output.map((output) => output.url).filter(Boolean));
        setGenerated(storedPendingGeneration.output.length > 0);
        setIsGenerating(storedPendingGeneration.status === "queued" || storedPendingGeneration.status === "processing");
      }

      if (storedImageToImagePendingGeneration) {
        setImageToImagePendingGeneration(storedImageToImagePendingGeneration);
        setImageToImageStatus(storedImageToImagePendingGeneration.status);
        setImageToImageTotalCount(storedImageToImagePendingGeneration.totalCount);
        setImageToImageCompletedCount(storedImageToImagePendingGeneration.completedCount);
        setImageToImageUrls(storedImageToImagePendingGeneration.output.map((output) => output.url).filter(Boolean));
        setImageToImageGenerated(storedImageToImagePendingGeneration.output.length > 0);
        setImageToImageIsGenerating(storedImageToImagePendingGeneration.status === "queued" || storedImageToImagePendingGeneration.status === "processing");
      }

      if (storedStyleTransferPendingGeneration) {
        setStyleTransferPendingGeneration(storedStyleTransferPendingGeneration);
        setStyleTransferStatus(storedStyleTransferPendingGeneration.status);
        setStyleTransferTotalCount(storedStyleTransferPendingGeneration.totalCount);
        setStyleTransferCompletedCount(storedStyleTransferPendingGeneration.completedCount);
        setStyleTransferUrls(storedStyleTransferPendingGeneration.output.map((output) => output.url).filter(Boolean));
        setStyleTransferGenerated(storedStyleTransferPendingGeneration.output.length > 0);
        setStyleTransferIsGenerating(storedStyleTransferPendingGeneration.status === "queued" || storedStyleTransferPendingGeneration.status === "processing");
      }

      if (storedBackgroundPendingGeneration) {
        setBackgroundStatus(storedBackgroundPendingGeneration.status);
        setBackgroundTotalCount(storedBackgroundPendingGeneration.totalCount);
        setBackgroundCompletedCount(storedBackgroundPendingGeneration.completedCount);
        setBackgroundUrls(storedBackgroundPendingGeneration.output.map((output) => output.url).filter(Boolean));
        setBackgroundGenerated(storedBackgroundPendingGeneration.output.length > 0);
        setBackgroundIsGenerating(storedBackgroundPendingGeneration.status === "queued" || storedBackgroundPendingGeneration.status === "processing");
      }

      if (storedExtendPendingGeneration) {
        setExtendPendingGeneration(storedExtendPendingGeneration);
        setExtendStatus(storedExtendPendingGeneration.status);
        setExtendTotalCount(storedExtendPendingGeneration.totalCount);
        setExtendCompletedCount(storedExtendPendingGeneration.completedCount);
        setExtendUrls(storedExtendPendingGeneration.output.map((output) => output.url).filter(Boolean));
        setExtendGenerated(storedExtendPendingGeneration.output.length > 0);
        setExtendIsGenerating(storedExtendPendingGeneration.status === "queued" || storedExtendPendingGeneration.status === "processing");
      }

      if (storedUpscalePendingGeneration) {
        setUpscalePendingGeneration(storedUpscalePendingGeneration);
        setUpscaleStatus(storedUpscalePendingGeneration.status);
        setUpscaleTotalCount(storedUpscalePendingGeneration.totalCount);
        setUpscaleCompletedCount(storedUpscalePendingGeneration.completedCount);
        setUpscaleUrls(storedUpscalePendingGeneration.output.map((output) => output.url).filter(Boolean));
        setUpscaleGenerated(storedUpscalePendingGeneration.output.length > 0);
        setUpscaleIsGenerating(storedUpscalePendingGeneration.status === "queued" || storedUpscalePendingGeneration.status === "processing");
      }

      draftRestoreCompleteRef.current = true;
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    if (!draftRestoreCompleteRef.current) return;

    writeImageGenerationDraft({
      activeTab,
      style,
      ratio,
      quality,
      resolution,
      selectedModel,
      selectedImageToImageModel,
      selectedStyleTransferModel,
      selectedBackgroundModel,
      selectedUpscaleModel,
      selectedExtendModel,
      outputFormat,
      modelParams,
      count,
      prompt,
      imageToImagePrompt,
      styleTransferPrompt,
      backgroundPrompt,
      extendPrompt,
      negativePrompt,
      smartEnhance,
      imageToImageSourceImages,
      imageToImageSourceImage,
      styleTransferSourceImage,
      backgroundSourceImage,
      upscaleSourceImage,
      extendSourceImage,
      extendDirection,
      extendAmount,
      styleSourceMode,
      styleTransferPreset,
      styleReferenceImage,
      backgroundReferenceImage,
      backgroundMode,
      backgroundColor,
      maskTool,
      brushSize,
      preserveSubject,
      edgeCleanup,
      addShadow,
      matchLighting,
      imageStrength,
      contentPreservation,
      facePreservation,
      seed,
      selectedVariation,
      generated,
      generatedImageUrls,
      imageToImageGenerated,
      imageToImageUrls,
      styleTransferGenerated,
      styleTransferUrls,
      backgroundGenerated,
      backgroundUrls,
      extendGenerated,
      extendUrls,
      upscaleGenerated,
      upscaleUrls,
    });
  }, [
    activeTab,
    style,
    ratio,
    quality,
    resolution,
    selectedModel,
    selectedImageToImageModel,
    selectedStyleTransferModel,
    selectedBackgroundModel,
    selectedUpscaleModel,
    selectedExtendModel,
    outputFormat,
    modelParams,
    count,
    prompt,
    imageToImagePrompt,
    styleTransferPrompt,
    backgroundPrompt,
    extendPrompt,
    negativePrompt,
    smartEnhance,
    imageToImageSourceImage,
    imageToImageSourceImages,
    styleTransferSourceImage,
    backgroundSourceImage,
    upscaleSourceImage,
    extendSourceImage,
    extendDirection,
    extendAmount,
    styleSourceMode,
    styleTransferPreset,
    styleReferenceImage,
    backgroundReferenceImage,
    backgroundMode,
    backgroundColor,
    maskTool,
    brushSize,
    preserveSubject,
    edgeCleanup,
    addShadow,
    matchLighting,
    imageStrength,
    contentPreservation,
    facePreservation,
    seed,
    selectedVariation,
    generated,
    generatedImageUrls,
    imageToImageGenerated,
    imageToImageUrls,
    styleTransferGenerated,
    styleTransferUrls,
    backgroundGenerated,
    backgroundUrls,
    extendGenerated,
    extendUrls,
    upscaleGenerated,
    upscaleUrls,
  ]);

  useEffect(() => {
    let remainingModelLoads = 5;
    let isMounted = true;
    const finishModelLoad = () => {
      remainingModelLoads -= 1;
      if (isMounted && remainingModelLoads === 0) setIsLoadingModels(false);
    };

    void listGenerationModels("text-to-image").then((models) => {
      setModelOptions(models);
      const defaultModel = models.find((item) => item.isDefault);
    if (defaultModel) setSelectedModel((current) => current || defaultModel.model);
    }).catch(() => {
      // The backend still resolves its configured default if the catalog is unavailable.
    }).finally(finishModelLoad);
    void listGenerationModels("image-to-image").then((models) => {
      setImageToImageModelOptions(models);
      const defaultModel = models.find((item) => item.isDefault);
      if (defaultModel) setSelectedImageToImageModel((current) => current || defaultModel.model);
    }).catch(() => {
      // The backend still resolves its configured default if the catalog is unavailable.
    }).finally(finishModelLoad);
    void listGenerationModels("style-transfer").then((models) => {
      setStyleTransferModelOptions(models);
      const defaultModel = models.find((item) => item.isDefault);
      if (defaultModel) setSelectedStyleTransferModel((current) => current || defaultModel.model);
    }).catch(() => {
      // The backend still resolves its configured default if the catalog is unavailable.
    }).finally(finishModelLoad);
    void listGenerationModels("upscale").then((models) => {
      setUpscaleModelOptions(models);
      const defaultModel = models.find((item) => item.isDefault);
      if (defaultModel) setSelectedUpscaleModel((current) => current || defaultModel.model);
    }).catch(() => {
      // The UI remains available while the backend route is being configured.
    }).finally(finishModelLoad);
    void listGenerationModels("extend-image").then((models) => {
      setExtendModelOptions(models);
      const defaultModel = models.find((item) => item.isDefault);
      if (defaultModel) setSelectedExtendModel((current) => current || defaultModel.model);
    }).catch(() => {
      // The UI remains available while the backend route is being configured.
    }).finally(finishModelLoad);
    void listStylePresets().then((presets) => {
      if (presets.length > 0) setStylePresetOptions(presets);
    }).catch(() => {
      // Keep the local presets as a short-lived fallback while the API is unavailable.
    });
    return () => {
      isMounted = false;
      generationAbortRef.current?.abort();
      imageToImageAbortRef.current?.abort();
      styleTransferAbortRef.current?.abort();
      backgroundAbortRef.current?.abort();
      extendAbortRef.current?.abort();
      upscaleAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    void listGenerationModels("background-removal", backgroundMode).then((models) => {
      if (!isMounted) return;
      setBackgroundModelOptions(models);
      const defaultModel = models.find((item) => item.isDefault);
      setSelectedBackgroundModel((current) => models.some((item) => item.model === current) ? current : defaultModel?.model ?? models[0]?.model ?? "");
    }).catch(() => {
      // The backend still resolves the configured background model on generation.
    });
    return () => { isMounted = false; };
  }, [backgroundMode]);

  const modeBackgroundModelOptions = backgroundModelOptions.filter((model) => supportsBackgroundMode(model, backgroundMode, Boolean(backgroundMask)));

  useEffect(() => {
    if (activeTab !== "AI Background" || modeBackgroundModelOptions.length === 0) return;
    if (modeBackgroundModelOptions.some((model) => model.model === selectedBackgroundModel)) return;
    const nextModel = modeBackgroundModelOptions.find((model) => model.isDefault) ?? modeBackgroundModelOptions[0];
    if (!nextModel) return;
    const timeoutId = window.setTimeout(() => setSelectedBackgroundModel(nextModel.model), 0);
    return () => window.clearTimeout(timeoutId);
  }, [activeTab, backgroundMode, backgroundMask, modeBackgroundModelOptions, selectedBackgroundModel]);

  const activeModelOptions = activeTab === "Image to Image" ? imageToImageModelOptions : activeTab === "AI Style Transfer" ? styleTransferModelOptions : activeTab === "AI Background" ? modeBackgroundModelOptions : activeTab === "Upscale" ? upscaleModelOptions : activeTab === "Extend Image" ? extendModelOptions : modelOptions;
  const activeSelectedModel = activeTab === "Image to Image" ? selectedImageToImageModel : activeTab === "AI Style Transfer" ? selectedStyleTransferModel : activeTab === "AI Background" && modeBackgroundModelOptions.some((model) => model.model === selectedBackgroundModel) ? selectedBackgroundModel : activeTab === "AI Background" ? "" : activeTab === "Upscale" ? selectedUpscaleModel : activeTab === "Extend Image" ? selectedExtendModel : selectedModel;
  const activeSourceImage = activeTab === "Image to Image" ? imageToImageSourceImage : activeTab === "AI Style Transfer" ? styleTransferSourceImage : activeTab === "AI Background" ? backgroundSourceImage : activeTab === "Upscale" ? upscaleSourceImage : activeTab === "Extend Image" ? extendSourceImage : null;
  const selectedModelCapabilities = activeModelOptions.find((item) => item.model === activeSelectedModel)?.capabilities;
  const activeModelParameters = selectedModelCapabilities?.parameters ?? [];
  const imageToImageSupportsInput = activeTab !== "Image to Image" || !activeSelectedModel || !selectedModelCapabilities || activeModelParameters.length === 0 || activeModelParameters.some((parameter) => /image|source|input/i.test(parameter)) || Boolean(selectedModelCapabilities.imagesParameter || selectedModelCapabilities.imageParameter || selectedModelCapabilities.inputImageParameter || selectedModelCapabilities.inputParameter);
  const imageToImageSupportsStrength = activeTab !== "Image to Image" || !activeSelectedModel || !selectedModelCapabilities || activeModelParameters.length === 0 || Boolean(selectedModelCapabilities.strengthParameter) || activeModelParameters.some((parameter) => /strength|denoise|image.?strength/i.test(parameter));
  const styleTransferSupportsInput = activeTab !== "AI Style Transfer" || !activeSelectedModel || activeModelParameters.length === 0 || activeModelParameters.some((parameter) => /image|source|input/i.test(parameter)) || Boolean(selectedModelCapabilities?.referenceImagesParameter || selectedModelCapabilities?.styleImageParameter);
  const styleTransferSupportsReference = activeTab !== "AI Style Transfer" || !activeSelectedModel || activeModelParameters.length === 0 || Boolean(selectedModelCapabilities?.referenceImagesParameter || selectedModelCapabilities?.styleImageParameter) || activeModelParameters.some((parameter) => /reference|style.?image/i.test(parameter));
  const styleTransferSupportsStrength = activeTab !== "AI Style Transfer" || !activeSelectedModel || activeModelParameters.length === 0 || Boolean(selectedModelCapabilities?.strengthParameter) || activeModelParameters.some((parameter) => /strength|denoise|style.?strength/i.test(parameter));
  const styleTransferSupportsContentPreservation = activeTab !== "AI Style Transfer" || !activeSelectedModel || activeModelParameters.length === 0 || Boolean(selectedModelCapabilities?.contentPreservationParameter) || activeModelParameters.some((parameter) => /content.?preservation|preserve/i.test(parameter));
  const backgroundSupportsInput = activeTab !== "AI Background" || !activeSelectedModel || activeModelParameters.length === 0 || activeModelParameters.some((parameter) => /image|source|input/i.test(parameter)) || Boolean(selectedModelCapabilities?.imageParameter || selectedModelCapabilities?.imagesParameter || selectedModelCapabilities?.inputImageParameter || selectedModelCapabilities?.inputParameter);
  const backgroundSupportsPrompt = activeTab !== "AI Background" || !activeSelectedModel || !selectedModelCapabilities || activeModelParameters.length === 0 || Boolean(selectedModelCapabilities.promptParameter) || activeModelParameters.some((parameter) => /prompt|instruction|text/i.test(parameter));
  const extendSupportsInput = activeTab !== "Extend Image" || !activeSelectedModel || !selectedModelCapabilities || activeModelParameters.length === 0 || activeModelParameters.some((parameter) => /image|source|input/i.test(parameter)) || Boolean(selectedModelCapabilities.imageParameter || selectedModelCapabilities.imagesParameter || selectedModelCapabilities.inputImageParameter || selectedModelCapabilities.inputParameter);
  const availableRatioOptions = supportedRatiosForModel(selectedModelCapabilities?.supportedSizes, selectedModelCapabilities?.supportedRatios ?? selectedModelCapabilities?.supportedAspectRatios);
  const effectiveRatio = availableRatioOptions.includes(ratio) ? ratio : availableRatioOptions[0] ?? "1:1";
  const availableResolutionOptions = selectedModelCapabilities?.fixedUpscale
    ? ["4x"]
    : supportedResolutionOptions(effectiveRatio, selectedModelCapabilities?.supportedSizes, selectedModelCapabilities?.supportedResolutions);
  const schemaProperties = selectedModelCapabilities?.apiSchema?.request_schema?.properties;
  const imageToImageInputParameter = selectedModelCapabilities?.referenceImagesParameter ?? selectedModelCapabilities?.imageParameter;
  const imageToImageInputProperty = imageToImageInputParameter ? schemaProperties?.[imageToImageInputParameter] : undefined;
  const imageToImageInputIsArray = imageToImageInputProperty?.type === "array";
  const configuredMaxSourceImages = typeof selectedModelCapabilities?.uploadConstraints?.maxImages === "number"
    ? selectedModelCapabilities.uploadConstraints.maxImages
    : undefined;
  const schemaMaxSourceImages = typeof imageToImageInputProperty?.maxItems === "number" ? imageToImageInputProperty.maxItems : 8;
  const imageToImageMaxSourceImages = activeTab === "Image to Image" && imageToImageInputIsArray
    ? Math.max(1, Math.min(16, configuredMaxSourceImages ?? schemaMaxSourceImages))
    : 1;
  const qualitySchemaProperty = Object.entries(schemaProperties ?? {}).find(([name]) => /quality/i.test(name));
  const schemaQualityValues = qualitySchemaProperty?.[1]?.enum?.map((value) => String(value)).filter(Boolean) ?? [];
  const promptBasedImageTab = activeTab === "Text to Image" || activeTab === "Image to Image" || activeTab === "AI Style Transfer" || activeTab === "Extend Image";
  const hasNativeQualityParameter = Boolean(selectedModelCapabilities?.qualityParameter || qualitySchemaProperty);
  const availableQualityOptions = activeSelectedModel && selectedModelCapabilities
    ? hasNativeQualityParameter
      ? supportedQualityOptions(Array.from(new Set([...(selectedModelCapabilities.qualityValues ?? []), ...schemaQualityValues])))
      : [...promptQualityOptions]
    : [...qualityOptions];
  const qualityEnabled = activeTab === "AI Background" && backgroundMode === "solid"
    ? false
    : activeTab === "Upscale"
    ? Boolean(activeSelectedModel && selectedModelCapabilities && (selectedModelCapabilities.qualityParameter || qualitySchemaProperty))
    : promptBasedImageTab
    ? Boolean(activeSelectedModel && selectedModelCapabilities)
    : Boolean(activeSelectedModel && selectedModelCapabilities && (selectedModelCapabilities.qualityParameter || qualitySchemaProperty));
  const availableCountOptions = (() => {
    const countProperty = Object.entries(schemaProperties ?? {}).find(([name]) => /count|number.?of.?images|num.?images/i.test(name));
    const values = countProperty?.[1]?.enum?.map((value) => String(value)).filter(Boolean) ?? [];
    if (activeTab === "Text to Image" && activeSelectedModel && selectedModelCapabilities && !selectedModelCapabilities.countParameter && values.length === 0) return [];
    return values.length > 0 ? Array.from(new Set(values)) : [...imageCountOptions];
  })();
  const effectiveCount = availableCountOptions.includes(count) ? count : availableCountOptions[0] ?? "1";
  const effectiveResolution = availableResolutionOptions.includes(resolution) ? resolution : availableResolutionOptions[0] ?? "HD";
  const effectiveQuality = qualityEnabled && availableQualityOptions.includes(quality) ? quality : availableQualityOptions[0] ?? quality;
  const modelOutputFormats = Array.from(new Set((selectedModelCapabilities?.outputFormatValues ?? []).map((value) => String(value).trim()).filter(Boolean)));
  const requiresTransparentOutput = activeTab === "AI Background" && backgroundMode === "remove";
  const availableOutputFormats = requiresTransparentOutput
    ? modelOutputFormats.filter((value) => value.toLowerCase() === "png" || value.toLowerCase() === "webp")
    : modelOutputFormats;
  const selectedOutputFormat = outputFormat ? availableOutputFormats.find((value) => value.toLowerCase() === outputFormat.toLowerCase()) : undefined;
  const transparentDefaultFormat = availableOutputFormats.find((value) => value.toLowerCase() === "png") ?? availableOutputFormats.find((value) => value.toLowerCase() === "webp");
  const effectiveOutputFormat = selectedOutputFormat ?? (requiresTransparentOutput ? transparentDefaultFormat : availableOutputFormats[0]);
  const supportsNativeSolidBackground = activeTab === "AI Background"
    && backgroundMode === "solid"
    && Boolean(selectedModelCapabilities?.backgroundModes?.includes("solid"));
  const isLocalSolidBackground = activeTab === "AI Background" && backgroundMode === "solid" && !supportsNativeSolidBackground;
  // Models without a native Solid Color mode still use the transparent-cutout
  // fallback. Native prompt-capable models receive the real solid mode and
  // selected color so their central prompt is applied server-side.
  const providerOutputFormat = isLocalSolidBackground ? "png" : effectiveOutputFormat;
  const requestModelParams = Object.fromEntries(Object.entries(modelParams).filter(([name]) => !providerControlledModelParameters.has(name)));
  const imageCreditQuoteInput: ImageCreditQuoteInput | null = (() => {
    // Credit estimates should be visible before the user fills the form. The
    // backend can quote the selected/default route from the current settings;
    // source images and prompts are still required only when generating.
    const shared = {
      model: activeSelectedModel || undefined,
      ratio: effectiveRatio,
      resolution: effectiveResolution,
      ...(qualityEnabled ? { quality: effectiveQuality } : {}),
      ...(providerOutputFormat ? { outputFormat: providerOutputFormat } : {}),
      ...(Object.keys(requestModelParams).length ? { modelParams: requestModelParams } : {}),
    };
    switch (activeTab) {
      case "Text to Image":
        return { feature: "text-to-image", ...shared, prompt: prompt.trim() || "Image generation", ...(style ? { style } : {}), count: effectiveCount, smartEnhance, negativePrompt };
      case "Image to Image":
        return { feature: "image-to-image", ...shared, sourceImage: imageToImageSourceImage, ...(imageToImageSourceImages.length > 0 ? { sourceImages: imageToImageSourceImages } : {}), prompt: imageToImagePrompt.trim() || "Transform the source image", ...(style ? { style } : {}), ...(imageToImageSupportsStrength ? { strength: imageStrength / 100 } : {}), count: effectiveCount, smartEnhance, negativePrompt };
      case "AI Style Transfer":
        return { feature: "style-transfer", ...shared, sourceImage: styleTransferSourceImage, ...(styleSourceMode === "preset" && styleTransferPreset ? { stylePreset: styleTransferPreset } : {}), ...(styleSourceMode === "reference" && styleReferenceImage ? { styleReferenceImage } : {}), ...(styleTransferPrompt.trim() ? { prompt: styleTransferPrompt.trim() } : {}), ...(styleTransferSupportsStrength ? { styleStrength: imageStrength / 100 } : {}), ...(styleTransferSupportsContentPreservation ? { contentPreservation: contentPreservation / 100 } : {}), count: effectiveCount, smartEnhance, negativePrompt };
      case "AI Background":
        return { feature: "background-removal", ...shared, mode: isLocalSolidBackground ? "remove" : backgroundMode, sourceImage: backgroundSourceImage, ...(backgroundReferenceImage ? { backgroundReferenceImage } : {}), ...(backgroundSupportsPrompt && (backgroundMode === "replace" || backgroundMode === "generate") && backgroundPrompt.trim() ? { prompt: backgroundPrompt.trim() } : {}), ...(style ? { style } : {}), ...(backgroundMask ? { mask: backgroundMask } : {}), ...((backgroundMode === "remove" || isLocalSolidBackground) ? { autoDetectSubject: !backgroundMask } : {}), transparent: backgroundMode === "remove" || isLocalSolidBackground, ...(supportsNativeSolidBackground ? { backgroundColor } : {}), preserveSubject, edgeCleanup, addShadow, matchLighting, count: effectiveCount };
      case "Extend Image":
        return { feature: "extend-image", ...shared, sourceImage: extendSourceImage, ...(extendPrompt.trim() ? { prompt: extendPrompt.trim() } : {}), direction: extendDirection, amount: extendAmount, count: effectiveCount, smartEnhance, negativePrompt };
      case "Upscale":
        return { feature: "upscale", model: activeSelectedModel || undefined, sourceImage: upscaleSourceImage, targetResolution: effectiveResolution, ...(qualityEnabled ? { quality: effectiveQuality } : {}), ...(effectiveOutputFormat ? { outputFormat: effectiveOutputFormat } : {}), ...(Object.keys(requestModelParams).length ? { modelParams: requestModelParams } : {}) };
    }
  })();
  const imageCreditEstimate = useImageCreditEstimate(imageCreditQuoteInput);

  useEffect(() => {
    const properties = selectedModelCapabilities?.apiSchema?.request_schema?.properties ?? {};
    const timeoutId = window.setTimeout(() => {
      setModelParams((current) => {
        const next: Record<string, unknown> = {};
        for (const [name, property] of Object.entries(properties)) {
          if (providerControlledModelParameters.has(name)) continue;
          const enumValues = Array.isArray(property.enum) ? property.enum : undefined;
          if (current[name] !== undefined && (!enumValues || enumValues.some((value) => String(value) === String(current[name])))) next[name] = current[name];
          else if (property.default !== undefined) next[name] = property.default;
          else if (/^(aspect[_-]?ratio|aspectRatio|ratio)$/i.test(name) && enumValues?.length) next[name] = enumValues[0];
        }
        return next;
      });
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [activeTab, activeSelectedModel, selectedModelCapabilities]);

  const loadRecentGenerations = useCallback(async (requestedWorkspaceId: string | null | undefined, requestedFeature = featureKeyForTab(activeTab)) => {
    const requestId = recentRequestRef.current + 1;
    recentRequestRef.current = requestId;
    setIsLoadingRecent(true);
    setRecentError(null);
    try {
      // Recent Generations belongs to the active image tool. Query only that
      // feature so results from other tabs cannot leak into this panel. The
      // backend resolves the workspace from the token when the client has not
      // restored workspaceId yet.
      const generations = (await listGenerationHistory(requestedWorkspaceId, requestedFeature))
        .sort((left, right) => (Date.parse(right.createdAt ?? "") || 0) - (Date.parse(left.createdAt ?? "") || 0));
      if (requestId !== recentRequestRef.current || featureKeyForTab(activeTabRef.current) !== requestedFeature) return;
      const completedOutputs = generations
        .filter((generation) => generation.status === "completed")
        .flatMap((generation) => generation.output ?? [])
        .filter((output) => !output.type || output.type === "image");
      rememberImageMimeTypes(completedOutputs);
      const historyUrls = completedOutputs.map((output) => output.url).filter(Boolean);
      // Replace the list instead of merging with local state. This prevents
      // stale URLs from a previous account/browser session leaking into the
      // current user's Recent Generations panel.
      setRecentGenerationUrls(historyUrls);
      setSelectedRecentImageUrl((currentUrl) => currentUrl && historyUrls.includes(currentUrl) ? currentUrl : null);

      const activeGeneration = generations.find((generation): generation is GenerationHistoryItem & { status: "queued" | "processing" } =>
        (generation.status === "queued" || generation.status === "processing") && (!generation.feature || generation.feature === requestedFeature),
      );
      if (!activeGeneration) return;
      const nextPendingGeneration = pendingGenerationFromHistory(activeGeneration, requestedWorkspaceId ?? "");
      rememberImageMimeTypes(nextPendingGeneration.output);

      if (requestedFeature === "text-to-image" && !generationRunRef.current && !resumeStartedRef.current) {
        setGenerationId(nextPendingGeneration.generationId);
        setGenerationStatus(nextPendingGeneration.status);
        setGenerationTotalCount(nextPendingGeneration.totalCount);
        setGenerationCompletedCount(nextPendingGeneration.completedCount);
        setGeneratedImageUrls(nextPendingGeneration.output.map((output) => output.url).filter(Boolean));
        setGenerated(nextPendingGeneration.output.length > 0);
        setIsGenerating(true);
        window.sessionStorage.setItem(pendingGenerationStorageKey, JSON.stringify(nextPendingGeneration));
        setPendingGeneration(nextPendingGeneration);
      } else if (requestedFeature === "image-to-image" && !imageToImageRunRef.current && !imageToImageResumeStartedRef.current) {
        setImageToImagePendingGeneration(nextPendingGeneration);
        setImageToImageStatus(nextPendingGeneration.status);
        setImageToImageTotalCount(nextPendingGeneration.totalCount);
        setImageToImageCompletedCount(nextPendingGeneration.completedCount);
        setImageToImageUrls(nextPendingGeneration.output.map((output) => output.url).filter(Boolean));
        setImageToImageGenerated(nextPendingGeneration.output.length > 0);
        setImageToImageIsGenerating(true);
        window.sessionStorage.setItem(pendingGenerationStorageKeyForFeature(requestedFeature), JSON.stringify(nextPendingGeneration));
      } else if (requestedFeature === "style-transfer" && !styleTransferRunRef.current && !styleTransferResumeStartedRef.current) {
        setStyleTransferPendingGeneration(nextPendingGeneration);
        setStyleTransferStatus(nextPendingGeneration.status);
        setStyleTransferTotalCount(nextPendingGeneration.totalCount);
        setStyleTransferCompletedCount(nextPendingGeneration.completedCount);
        setStyleTransferUrls(nextPendingGeneration.output.map((output) => output.url).filter(Boolean));
        setStyleTransferGenerated(nextPendingGeneration.output.length > 0);
        setStyleTransferIsGenerating(true);
        window.sessionStorage.setItem(pendingGenerationStorageKeyForFeature(requestedFeature), JSON.stringify(nextPendingGeneration));
      } else if (requestedFeature === "extend-image" && !extendRunRef.current && !extendResumeStartedRef.current) {
        setExtendPendingGeneration(nextPendingGeneration);
        setExtendStatus(nextPendingGeneration.status);
        setExtendTotalCount(nextPendingGeneration.totalCount);
        setExtendCompletedCount(nextPendingGeneration.completedCount);
        setExtendUrls(nextPendingGeneration.output.map((output) => output.url).filter(Boolean));
        setExtendGenerated(nextPendingGeneration.output.length > 0);
        setExtendIsGenerating(true);
        window.sessionStorage.setItem(pendingGenerationStorageKeyForFeature(requestedFeature), JSON.stringify(nextPendingGeneration));
      }
    } catch (error) {
      if (requestId !== recentRequestRef.current || featureKeyForTab(activeTabRef.current) !== requestedFeature) return;
      setRecentError(error instanceof Error ? error.message : "Unable to load recent generations");
    } finally {
      if (requestId === recentRequestRef.current) setIsLoadingRecent(false);
    }
  }, [activeTab, rememberImageMimeTypes]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadRecentGenerations(workspaceId ?? undefined);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadRecentGenerations, workspaceId]);

  const refreshRecentGenerations = useCallback(async () => {
    await loadRecentGenerations(workspaceId ?? undefined);
  }, [loadRecentGenerations, workspaceId]);

  const selectRecentGeneration = useCallback((url: string) => {
    setSelectedRecentImageUrl(url);
    setSelectedVariation(-1);
  }, []);

  const clearRecentSelection = useCallback(() => {
    setSelectedRecentImageUrl(null);
    setSelectedVariation(0);
  }, []);

  const selectVariation = useCallback((index: number) => {
    setSelectedVariation(index);
    setSelectedRecentImageUrl(null);
  }, []);

  const setImageToImageSourceImageAndPersist = useCallback((imageUrl: string | null) => {
    setImageToImageSourceImage(imageUrl);
    setImageToImageSourceImages(imageUrl ? [imageUrl] : []);
    storeImageUrl(imageToImageSourceImageStorageKey, imageUrl);
    storeImageUrls(imageToImageSourceImagesStorageKey, imageUrl ? [imageUrl] : []);
  }, []);

  const setImageToImageSourceImagesAndPersist = useCallback((imageUrls: string[]) => {
    const nextUrls = Array.from(new Set(imageUrls.filter(Boolean)));
    setImageToImageSourceImages(nextUrls);
    setImageToImageSourceImage(nextUrls[0] ?? null);
    storeImageUrl(imageToImageSourceImageStorageKey, nextUrls[0] ?? null);
    storeImageUrls(imageToImageSourceImagesStorageKey, nextUrls);
  }, []);

  const setStyleTransferSourceImageAndPersist = useCallback((imageUrl: string | null) => {
    setStyleTransferSourceImage(imageUrl);
    storeImageUrl(styleTransferSourceImageStorageKey, imageUrl);
  }, []);

  const setBackgroundSourceImageAndPersist = useCallback((imageUrl: string | null) => {
    setBackgroundSourceImage(imageUrl);
    storeImageUrl(backgroundSourceImageStorageKey, imageUrl);
    setBackgroundMask(null);
    setBackgroundGenerated(false);
    setBackgroundUrls([]);
    setBackgroundError(null);
    setSelectedRecentImageUrl(null);
    setSelectedVariation(0);
  }, []);

  const setExtendSourceImageAndPersist = useCallback((imageUrl: string | null) => {
    setExtendSourceImage(imageUrl);
    storeImageUrl(extendSourceImageStorageKey, imageUrl);
    setExtendGenerated(false);
    setExtendUrls([]);
    setExtendError(null);
    setSelectedRecentImageUrl(null);
    setSelectedVariation(0);
  }, []);

  const setUpscaleSourceImageAndPersist = useCallback((imageUrl: string | null) => {
    setUpscaleSourceImage(imageUrl);
    storeImageUrl(upscaleSourceImageStorageKey, imageUrl);
    setUpscaleGenerated(false);
    setUpscaleUrls([]);
    setUpscaleError(null);
    setSelectedRecentImageUrl(null);
    setSelectedVariation(0);
  }, []);

  const setStyleReferenceImageAndPersist = useCallback((imageUrl: string | null) => {
    setStyleReferenceImage(imageUrl);
    storeImageUrl(styleReferenceImageStorageKey, imageUrl);
  }, []);

  const restorePendingForTab = useCallback((tab: ImageGenerationTab) => {
    const pending = readPendingGeneration(featureKeyForTab(tab));
    if (!pending || pending.status === "completed") return;

    if (tab === "Image to Image") {
      setImageToImagePendingGeneration(pending);
      setImageToImageStatus(pending.status);
      setImageToImageTotalCount(pending.totalCount);
      setImageToImageCompletedCount(pending.completedCount);
      setImageToImageUrls(pending.output.map((output) => output.url).filter(Boolean));
      setImageToImageGenerated(pending.output.length > 0);
      setImageToImageIsGenerating(true);
    } else if (tab === "AI Style Transfer") {
      setStyleTransferPendingGeneration(pending);
      setStyleTransferStatus(pending.status);
      setStyleTransferTotalCount(pending.totalCount);
      setStyleTransferCompletedCount(pending.completedCount);
      setStyleTransferUrls(pending.output.map((output) => output.url).filter(Boolean));
      setStyleTransferGenerated(pending.output.length > 0);
      setStyleTransferIsGenerating(true);
    } else if (tab === "Text to Image") {
      setPendingGeneration(pending);
      setGenerationId(pending.generationId);
      setGenerationStatus(pending.status);
      setGenerationTotalCount(pending.totalCount);
      setGenerationCompletedCount(pending.completedCount);
      setGeneratedImageUrls(pending.output.map((output) => output.url).filter(Boolean));
      setGenerated(pending.output.length > 0);
      setIsGenerating(true);
    } else if (tab === "AI Background") {
      setBackgroundStatus(pending.status);
      setBackgroundTotalCount(pending.totalCount);
      setBackgroundCompletedCount(pending.completedCount);
      setBackgroundUrls(pending.output.map((output) => output.url).filter(Boolean));
      setBackgroundGenerated(pending.output.length > 0);
      setBackgroundIsGenerating(true);
    } else if (tab === "Extend Image") {
      setExtendPendingGeneration(pending);
      setExtendStatus(pending.status);
      setExtendTotalCount(pending.totalCount);
      setExtendCompletedCount(pending.completedCount);
      setExtendUrls(pending.output.map((output) => output.url).filter(Boolean));
      setExtendGenerated(pending.output.length > 0);
      setExtendIsGenerating(true);
    } else if (tab === "Upscale") {
      setUpscalePendingGeneration(pending);
      setUpscaleStatus(pending.status);
      setUpscaleTotalCount(pending.totalCount);
      setUpscaleCompletedCount(pending.completedCount);
      setUpscaleUrls(pending.output.map((output) => output.url).filter(Boolean));
      setUpscaleGenerated(pending.output.length > 0);
      setUpscaleIsGenerating(true);
    }
  }, []);

  const hasActiveGenerationForTab = useCallback((tab: ImageGenerationTab) => {
    const isGeneratingInMemory = tab === "Text to Image"
      ? isGenerating
      : tab === "Image to Image"
        ? imageToImageIsGenerating
        : tab === "AI Style Transfer"
          ? styleTransferIsGenerating
          : tab === "AI Background"
            ? backgroundIsGenerating
            : tab === "Extend Image"
              ? extendIsGenerating
              : upscaleIsGenerating;

    return isGeneratingInMemory || isPendingGenerationActive(readPendingGeneration(featureKeyForTab(tab)));
  }, [backgroundIsGenerating, extendIsGenerating, imageToImageIsGenerating, isGenerating, styleTransferIsGenerating, upscaleIsGenerating]);

  const clearSourceImageForTab = useCallback((tab: ImageGenerationTab) => {
    if (tab === "Image to Image") {
      setImageToImageSourceImage(null);
      setImageToImageSourceImages([]);
      storeImageUrl(imageToImageSourceImageStorageKey, null);
      storeImageUrls(imageToImageSourceImagesStorageKey, []);
    } else if (tab === "AI Style Transfer") {
      setStyleTransferSourceImage(null);
      storeImageUrl(styleTransferSourceImageStorageKey, null);
    } else if (tab === "AI Background") {
      setBackgroundSourceImage(null);
      storeImageUrl(backgroundSourceImageStorageKey, null);
      setBackgroundMask(null);
    } else if (tab === "Extend Image") {
      setExtendSourceImage(null);
      storeImageUrl(extendSourceImageStorageKey, null);
    } else if (tab === "Upscale") {
      setUpscaleSourceImage(null);
      storeImageUrl(upscaleSourceImageStorageKey, null);
    }
  }, []);

  const applyGenerationProgress = useCallback((progress: GenerationProgress) => {
    setIsGenerating(progress.status === "queued" || progress.status === "processing");
    setGenerationStatus(progress.status);
    setGenerationId(progress.generationId);
    setGenerationTotalCount(progress.totalCount);
    setGenerationCompletedCount(progress.completedCount);
    const urls = progress.output.map((output) => output.url).filter(Boolean);
    rememberImageMimeTypes(progress.output);
    if (urls.length > 0) {
      setGeneratedImageUrls((currentUrls) => Array.from(new Set([...currentUrls, ...urls])));
      setGenerated(true);
    }
    setPendingGeneration(savePendingGeneration(progress));
  }, [rememberImageMimeTypes]);

  const applyImageToImageProgress = useCallback((progress: GenerationProgress) => {
    setImageToImageIsGenerating(progress.status === "queued" || progress.status === "processing");
    setImageToImageStatus(progress.status);
    setImageToImageTotalCount(progress.totalCount);
    setImageToImageCompletedCount(progress.completedCount);
    setImageToImagePendingGeneration(savePendingGeneration(progress, "image-to-image"));
    const urls = progress.output.map((output) => output.url).filter(Boolean);
    rememberImageMimeTypes(progress.output);
    if (urls.length > 0) {
      setImageToImageUrls((currentUrls) => Array.from(new Set([...currentUrls, ...urls])));
      setImageToImageGenerated(true);
    }
  }, [rememberImageMimeTypes]);

  const applyStyleTransferProgress = useCallback((progress: GenerationProgress) => {
    setStyleTransferIsGenerating(progress.status === "queued" || progress.status === "processing");
    setStyleTransferStatus(progress.status);
    setStyleTransferTotalCount(progress.totalCount);
    setStyleTransferCompletedCount(progress.completedCount);
    setStyleTransferPendingGeneration(savePendingGeneration(progress, "style-transfer"));
    const urls = progress.output.map((output) => output.url).filter(Boolean);
    rememberImageMimeTypes(progress.output);
    if (urls.length > 0) {
      setStyleTransferUrls((currentUrls) => Array.from(new Set([...currentUrls, ...urls])));
      setStyleTransferGenerated(true);
    }
  }, [rememberImageMimeTypes]);

  const applyBackgroundProgress = useCallback((progress: GenerationProgress) => {
    setBackgroundIsGenerating(progress.status === "queued" || progress.status === "processing");
    setBackgroundStatus(progress.status);
    setBackgroundTotalCount(progress.totalCount);
    setBackgroundCompletedCount(progress.completedCount);
    const pending = savePendingGeneration(progress, "background-removal");
    const urls = progress.output.map((output) => output.url).filter(Boolean);
    rememberImageMimeTypes(progress.output);
    if (urls.length > 0) {
      setBackgroundUrls((currentUrls) => Array.from(new Set([...currentUrls, ...urls])));
      setBackgroundGenerated(true);
    }
    if (!pending) window.sessionStorage.removeItem(pendingGenerationStorageKeyForFeature("background-removal"));
  }, [rememberImageMimeTypes]);

  const applyExtendProgress = useCallback((progress: GenerationProgress) => {
    setExtendIsGenerating(progress.status === "queued" || progress.status === "processing");
    setExtendStatus(progress.status);
    setExtendTotalCount(progress.totalCount);
    setExtendCompletedCount(progress.completedCount);
    setExtendPendingGeneration(savePendingGeneration(progress, "extend-image"));
    const urls = progress.output.map((output) => output.url).filter(Boolean);
    rememberImageMimeTypes(progress.output);
    if (urls.length > 0) {
      setExtendUrls((currentUrls) => Array.from(new Set([...currentUrls, ...urls])));
      setExtendGenerated(true);
    }
  }, [rememberImageMimeTypes]);

  const applyUpscaleProgress = useCallback((progress: GenerationProgress) => {
    setUpscaleIsGenerating(progress.status === "queued" || progress.status === "processing");
    setUpscaleStatus(progress.status);
    setUpscaleTotalCount(progress.totalCount);
    setUpscaleCompletedCount(progress.completedCount);
    setUpscalePendingGeneration(savePendingGeneration(progress, "upscale"));
    const urls = progress.output.map((output) => output.url).filter(Boolean);
    rememberImageMimeTypes(progress.output);
    if (urls.length > 0) {
      setUpscaleUrls((currentUrls) => Array.from(new Set([...currentUrls, ...urls])));
      setUpscaleGenerated(true);
    }
  }, [rememberImageMimeTypes]);

  useEffect(() => {
    if (!pendingGeneration || resumeStartedRef.current || generationRunRef.current) return;
    const pending = pendingGeneration;
    resumeStartedRef.current = true;
    setGenerationError(null);
    setGeneratedImageUrls(pending.output.map((output) => output.url).filter(Boolean));
    setGenerated(pending.output.length > 0);
    setSelectedRecentImageUrl(null);
    setSelectedVariation(0);
    setGenerationId(pending.generationId);
    setGenerationStatus(pending.status);
    setGenerationTotalCount(pending.totalCount);
    setGenerationCompletedCount(pending.completedCount);
    setWorkspaceId(pending.workspaceId);
    window.sessionStorage.setItem("eos.generation.workspace-id", pending.workspaceId);

    if (pending.status === "completed") {
      window.setTimeout(() => void loadRecentGenerations(pending.workspaceId), 0);
      return;
    }

    generationRunRef.current = true;
    const abortController = new AbortController();
    generationAbortRef.current = abortController;
    generationCancelRequestedRef.current = false;

    void resumeTextToImage(pending, applyGenerationProgress, abortController.signal).then(async (result) => {
      const urls = result.data.output.map((output) => output.url).filter(Boolean);
      setGeneratedImageUrls(urls);
      setGenerated(urls.length > 0);
      await loadRecentGenerations(result.data.workspaceId);
      setRecentGenerationUrls((currentUrls) => Array.from(new Set([...urls, ...currentUrls])));
    }).catch((error) => {
      if (abortController.signal.aborted || generationCancelRequestedRef.current) {
        setGenerationStatus("cancelled");
      } else {
        setGenerationStatus("failed");
        setGenerationError(error instanceof Error ? error.message : "Unable to resume image generation");
      }
      window.sessionStorage.removeItem(pendingGenerationStorageKey);
      setPendingGeneration(null);
    }).finally(() => {
      if (generationAbortRef.current === abortController) generationAbortRef.current = null;
      setIsGenerating(false);
    });
  }, [applyGenerationProgress, loadRecentGenerations, pendingGeneration]);

  useEffect(() => {
    if (!imageToImagePendingGeneration || imageToImageResumeStartedRef.current || imageToImageRunRef.current) return;
    const pending = imageToImagePendingGeneration;
    imageToImageResumeStartedRef.current = true;
    setImageToImageError(null);
    setImageToImageUrls(pending.output.map((output) => output.url).filter(Boolean));
    setImageToImageGenerated(pending.output.length > 0);
    setImageToImageStatus(pending.status);
    setImageToImageTotalCount(pending.totalCount);
    setImageToImageCompletedCount(pending.completedCount);

    if (pending.status === "completed") {
      return;
    }

    imageToImageRunRef.current = true;
    const abortController = new AbortController();
    imageToImageAbortRef.current = abortController;
    imageToImageCancelRequestedRef.current = false;

    void resumeGeneration(pending, applyImageToImageProgress, abortController.signal).then(async (result) => {
      const urls = result.data.output.map((output) => output.url).filter(Boolean);
      setWorkspaceId(result.data.workspaceId);
      window.sessionStorage.setItem("eos.generation.workspace-id", result.data.workspaceId);
      setImageToImageUrls(urls);
      setImageToImageGenerated(urls.length > 0);
      setImageToImageStatus("completed");
      setImageToImageCompletedCount(urls.length);
      await loadRecentGenerations(result.data.workspaceId, "image-to-image");
      setRecentGenerationUrls((currentUrls) => Array.from(new Set([...urls, ...currentUrls])));
    }).catch((error) => {
      if (abortController.signal.aborted || imageToImageCancelRequestedRef.current) {
        setImageToImageStatus("cancelled");
      } else {
        setImageToImageStatus("failed");
        setImageToImageError(error instanceof Error ? error.message : "Unable to resume image transformation");
      }
      window.sessionStorage.removeItem(pendingGenerationStorageKeyForFeature("image-to-image"));
      setImageToImagePendingGeneration(null);
    }).finally(() => {
      if (imageToImageAbortRef.current === abortController) imageToImageAbortRef.current = null;
      setImageToImageIsGenerating(false);
    });
  }, [applyImageToImageProgress, imageToImagePendingGeneration, loadRecentGenerations]);

  useEffect(() => {
    if (!styleTransferPendingGeneration || styleTransferResumeStartedRef.current || styleTransferRunRef.current) return;
    const pending = styleTransferPendingGeneration;
    styleTransferResumeStartedRef.current = true;
    setStyleTransferError(null);
    setStyleTransferUrls(pending.output.map((output) => output.url).filter(Boolean));
    setStyleTransferGenerated(pending.output.length > 0);
    setStyleTransferStatus(pending.status);
    setStyleTransferTotalCount(pending.totalCount);
    setStyleTransferCompletedCount(pending.completedCount);

    if (pending.status === "completed") {
      return;
    }

    styleTransferRunRef.current = true;
    const abortController = new AbortController();
    styleTransferAbortRef.current = abortController;
    styleTransferCancelRequestedRef.current = false;

    void resumeGeneration(pending, applyStyleTransferProgress, abortController.signal).then(async (result) => {
      const urls = result.data.output.map((output) => output.url).filter(Boolean);
      setWorkspaceId(result.data.workspaceId);
      window.sessionStorage.setItem("eos.generation.workspace-id", result.data.workspaceId);
      setStyleTransferUrls(urls);
      setStyleTransferGenerated(urls.length > 0);
      setStyleTransferStatus("completed");
      setStyleTransferCompletedCount(urls.length);
      await loadRecentGenerations(result.data.workspaceId, "style-transfer");
      setRecentGenerationUrls((currentUrls) => Array.from(new Set([...urls, ...currentUrls])));
    }).catch((error) => {
      if (abortController.signal.aborted || styleTransferCancelRequestedRef.current) {
        setStyleTransferStatus("cancelled");
      } else {
        setStyleTransferStatus("failed");
        setStyleTransferError(error instanceof Error ? error.message : "Unable to resume style transfer");
      }
      window.sessionStorage.removeItem(pendingGenerationStorageKeyForFeature("style-transfer"));
      setStyleTransferPendingGeneration(null);
    }).finally(() => {
      if (styleTransferAbortRef.current === abortController) styleTransferAbortRef.current = null;
      setStyleTransferIsGenerating(false);
    });
  }, [applyStyleTransferProgress, loadRecentGenerations, styleTransferPendingGeneration]);

  useEffect(() => {
    if (!extendPendingGeneration || extendResumeStartedRef.current || extendRunRef.current) return;
    const pending = extendPendingGeneration;
    extendResumeStartedRef.current = true;
    setExtendError(null);
    setExtendUrls(pending.output.map((output) => output.url).filter(Boolean));
    setExtendGenerated(pending.output.length > 0);
    setExtendStatus(pending.status);
    setExtendTotalCount(pending.totalCount);
    setExtendCompletedCount(pending.completedCount);

    if (pending.status === "completed") {
      return;
    }

    extendRunRef.current = true;
    const abortController = new AbortController();
    extendAbortRef.current = abortController;
    extendCancelRequestedRef.current = false;

    void resumeGeneration(pending, applyExtendProgress, abortController.signal).then(async (result) => {
      const urls = result.data.output.map((output) => output.url).filter(Boolean);
      setWorkspaceId(result.data.workspaceId);
      window.sessionStorage.setItem("eos.generation.workspace-id", result.data.workspaceId);
      setExtendUrls(urls);
      setExtendGenerated(urls.length > 0);
      setExtendStatus("completed");
      setExtendCompletedCount(urls.length);
      await loadRecentGenerations(result.data.workspaceId, "extend-image");
      setRecentGenerationUrls((currentUrls) => Array.from(new Set([...urls, ...currentUrls])));
    }).catch((error) => {
      if (abortController.signal.aborted || extendCancelRequestedRef.current) {
        setExtendStatus("cancelled");
      } else {
        setExtendStatus("failed");
        setExtendError(error instanceof Error ? error.message : "Unable to resume image extension");
      }
      window.sessionStorage.removeItem(pendingGenerationStorageKeyForFeature("extend-image"));
      setExtendPendingGeneration(null);
    }).finally(() => {
      if (extendAbortRef.current === abortController) extendAbortRef.current = null;
      setExtendIsGenerating(false);
    });
  }, [applyExtendProgress, extendPendingGeneration, loadRecentGenerations]);

  useEffect(() => {
    if (!upscalePendingGeneration || upscaleResumeStartedRef.current || upscaleRunRef.current) return;
    const pending = upscalePendingGeneration;
    upscaleResumeStartedRef.current = true;
    setUpscaleError(null);
    setUpscaleUrls(pending.output.map((output) => output.url).filter(Boolean));
    setUpscaleGenerated(pending.output.length > 0);
    setUpscaleStatus(pending.status);
    setUpscaleTotalCount(pending.totalCount);
    setUpscaleCompletedCount(pending.completedCount);

    if (pending.status === "completed") {
      return;
    }

    upscaleRunRef.current = true;
    const abortController = new AbortController();
    upscaleAbortRef.current = abortController;
    upscaleCancelRequestedRef.current = false;

    void resumeGeneration(pending, applyUpscaleProgress, abortController.signal).then(async (result) => {
      const urls = result.data.output.map((output) => output.url).filter(Boolean);
      setWorkspaceId(result.data.workspaceId);
      window.sessionStorage.setItem("eos.generation.workspace-id", result.data.workspaceId);
      setUpscaleUrls(urls);
      setUpscaleGenerated(urls.length > 0);
      setUpscaleStatus("completed");
      setUpscaleCompletedCount(urls.length);
      await loadRecentGenerations(result.data.workspaceId, "upscale");
      setRecentGenerationUrls((currentUrls) => Array.from(new Set([...urls, ...currentUrls])));
    }).catch((error) => {
      if (abortController.signal.aborted || upscaleCancelRequestedRef.current) {
        setUpscaleStatus("cancelled");
      } else {
        setUpscaleStatus("failed");
        setUpscaleError(error instanceof Error ? error.message : "Unable to resume image upscaling");
      }
      window.sessionStorage.removeItem(pendingGenerationStorageKeyForFeature("upscale"));
      setUpscalePendingGeneration(null);
    }).finally(() => {
      if (upscaleAbortRef.current === abortController) upscaleAbortRef.current = null;
      setUpscaleIsGenerating(false);
    });
  }, [applyUpscaleProgress, loadRecentGenerations, upscalePendingGeneration]);

  const requestGenerationCancellation = useCallback(async (
    target: GenerationCancelTarget | null,
    onCancelled: () => void,
    onError: (message: string) => void,
  ) => {
    // A request may still be waiting for the enqueue response. In that case
    // there is no server generation id yet, so abort the client request only.
    if (!target?.generationId || !target.workspaceId) {
      onCancelled();
      return;
    }

    try {
      await cancelGeneration(target.generationId, target.workspaceId);
      onCancelled();
    } catch (error) {
      onError(error instanceof Error ? error.message : "Unable to cancel generation");
    }
  }, []);

  const cancelTextToImage = useCallback(async () => {
    if (!isGenerating) return;
    const target = pendingGeneration ?? (generationId ? { generationId, workspaceId: workspaceId ?? "" } : null);
    await requestGenerationCancellation(target, () => {
      generationCancelRequestedRef.current = true;
      generationAbortRef.current?.abort();
      setIsGenerating(false);
      setGenerationStatus("cancelled");
      window.sessionStorage.removeItem(pendingGenerationStorageKey);
      setPendingGeneration(null);
    }, setGenerationError);
  }, [generationId, isGenerating, pendingGeneration, requestGenerationCancellation, workspaceId]);

  const cancelImageToImage = useCallback(async () => {
    if (!imageToImageIsGenerating) return;
    const target = imageToImagePendingGeneration;
    await requestGenerationCancellation(target, () => {
      imageToImageCancelRequestedRef.current = true;
      imageToImageAbortRef.current?.abort();
      setImageToImageIsGenerating(false);
      setImageToImageStatus("cancelled");
      window.sessionStorage.removeItem(pendingGenerationStorageKeyForFeature("image-to-image"));
      setImageToImagePendingGeneration(null);
    }, setImageToImageError);
  }, [imageToImageIsGenerating, imageToImagePendingGeneration, requestGenerationCancellation]);

  const cancelStyleTransfer = useCallback(async () => {
    if (!styleTransferIsGenerating) return;
    const target = styleTransferPendingGeneration;
    await requestGenerationCancellation(target, () => {
      styleTransferCancelRequestedRef.current = true;
      styleTransferAbortRef.current?.abort();
      setStyleTransferIsGenerating(false);
      setStyleTransferStatus("cancelled");
      window.sessionStorage.removeItem(pendingGenerationStorageKeyForFeature("style-transfer"));
      setStyleTransferPendingGeneration(null);
    }, setStyleTransferError);
  }, [requestGenerationCancellation, styleTransferIsGenerating, styleTransferPendingGeneration]);

  const cancelBackground = useCallback(async () => {
    if (!backgroundIsGenerating) return;
    const pending = readPendingGeneration("background-removal");
    await requestGenerationCancellation(pending, () => {
      backgroundCancelRequestedRef.current = true;
      backgroundAbortRef.current?.abort();
      setBackgroundIsGenerating(false);
      setBackgroundStatus("cancelled");
      window.sessionStorage.removeItem(pendingGenerationStorageKeyForFeature("background-removal"));
    }, setBackgroundError);
  }, [backgroundIsGenerating, requestGenerationCancellation]);

  const cancelExtend = useCallback(async () => {
    if (!extendIsGenerating) return;
    const target = extendPendingGeneration;
    await requestGenerationCancellation(target, () => {
      extendCancelRequestedRef.current = true;
      extendAbortRef.current?.abort();
      setExtendIsGenerating(false);
      setExtendStatus("cancelled");
      window.sessionStorage.removeItem(pendingGenerationStorageKeyForFeature("extend-image"));
      setExtendPendingGeneration(null);
    }, setExtendError);
  }, [extendIsGenerating, extendPendingGeneration, requestGenerationCancellation]);

  const cancelUpscale = useCallback(async () => {
    if (!upscaleIsGenerating) return;
    const target = upscalePendingGeneration;
    await requestGenerationCancellation(target, () => {
      upscaleCancelRequestedRef.current = true;
      upscaleAbortRef.current?.abort();
      setUpscaleIsGenerating(false);
      setUpscaleStatus("cancelled");
      window.sessionStorage.removeItem(pendingGenerationStorageKeyForFeature("upscale"));
      setUpscalePendingGeneration(null);
    }, setUpscaleError);
  }, [requestGenerationCancellation, upscaleIsGenerating, upscalePendingGeneration]);

  return {
    activeTab,
    count: effectiveCount,
    generated,
    generatedImageUrls,
    imageToImageGenerated,
    imageToImageUrls,
    selectedRecentImageUrl,
    recentGenerationUrls,
    imageMimeTypes,
    recentError,
    generationError,
    imageSizeOpen,
    isGenerating,
    generationId,
    generationStatus,
    generationTotalCount,
    generationCompletedCount,
    isLoadingRecent,
    imageToImageIsGenerating,
    imageToImageStatus,
    imageToImageTotalCount,
    imageToImageCompletedCount,
    imageToImageError,
    styleTransferGenerated,
    styleTransferUrls,
    styleTransferIsGenerating,
    styleTransferStatus,
    styleTransferTotalCount,
    styleTransferCompletedCount,
    styleTransferError,
    backgroundGenerated,
    backgroundUrls,
    backgroundIsGenerating,
    backgroundStatus,
    backgroundTotalCount,
    backgroundCompletedCount,
    backgroundError,
    extendGenerated,
    extendUrls,
    extendIsGenerating,
    extendStatus,
    extendTotalCount,
    extendCompletedCount,
    extendError,
    upscaleGenerated,
    upscaleUrls,
    upscaleIsGenerating,
    upscaleStatus,
    upscaleTotalCount,
    upscaleCompletedCount,
    upscaleError,
    negativePrompt,
    prompt,
    imageToImagePrompt,
    styleTransferPrompt,
    backgroundPrompt,
    extendPrompt,
    extendDirection,
    extendAmount,
    quality: effectiveQuality,
    resolution: effectiveResolution,
    isLoadingModels,
    modelOptions,
    imageToImageModelOptions,
    styleTransferModelOptions,
    backgroundModelOptions,
    upscaleModelOptions,
    extendModelOptions,
    stylePresetOptions,
    modelCapabilities: selectedModelCapabilities,
    modelParams,
    selectedModel,
    selectedImageToImageModel,
    selectedStyleTransferModel,
    selectedBackgroundModel,
    selectedUpscaleModel,
    selectedExtendModel,
    activeModelOptions,
    imageToImageSupportsInput,
    backgroundSupportsInput,
    backgroundSupportsPrompt,
    extendSupportsInput,
    imageToImageSupportsStrength,
    styleTransferSupportsInput,
    styleTransferSupportsReference,
    styleTransferSupportsStrength,
    styleTransferSupportsContentPreservation,
    availableResolutionOptions,
    availableRatioOptions,
    availableQualityOptions,
    availableOutputFormats,
    outputFormat: effectiveOutputFormat ?? null,
    qualityEnabled,
    imageCreditEstimate: imageCreditEstimate.creditCost,
    imageCreditEstimateLoading: imageCreditEstimate.isLoading,
    imageCreditEstimateError: imageCreditEstimate.error,
    availableCountOptions,
    imageStrength,
    ratio: effectiveRatio,
    selectedVariation,
    sourceImage: activeSourceImage,
    imageToImageSourceImage,
    imageToImageSourceImages,
    imageToImageMaxSourceImages,
    styleTransferSourceImage,
    backgroundSourceImage,
    upscaleSourceImage,
    extendSourceImage,
    workspaceId,
    styleSourceMode,
    styleTransferPreset,
    styleReferenceImage,
    backgroundReferenceImage,
    backgroundMode,
    backgroundColor,
    maskTool,
    brushSize,
    backgroundMask,
    preserveSubject,
    edgeCleanup,
    addShadow,
    matchLighting,
    smartEnhance,
    contentPreservation,
    facePreservation,
    seed,
    style,
    setActiveTab: (nextTab: ImageGenerationTab) => {
      const previousTab = activeTabRef.current;
      if (previousTab !== nextTab) {
        if (!hasActiveGenerationForTab(previousTab)) {
          clearSourceImageForTab(previousTab);
        }
        setRecentGenerationUrls([]);
        setSelectedRecentImageUrl(null);
        setRecentError(null);
      }
      activeTabRef.current = nextTab;
      restorePendingForTab(nextTab);
      setActiveTab(nextTab);
    },
    setCount,
    setGenerated,
    setImageToImageGenerated,
    setImageToImageUrls,
    setImageToImageError,
    setStyleTransferGenerated,
    setStyleTransferUrls,
    setStyleTransferError,
    setBackgroundGenerated,
    setBackgroundUrls,
    setBackgroundError,
    setUpscaleGenerated,
    setUpscaleUrls,
    setUpscaleError,
    setNegativePrompt,
    setPrompt,
    setImageToImagePrompt,
    setStyleTransferPrompt,
    setBackgroundPrompt,
    setExtendPrompt,
    setExtendDirection,
    setExtendAmount,
    setQuality,
    setOutputFormat,
    setSmartEnhance,
    setStyle,
    selectRecentGeneration,
    clearRecentSelection,
    selectVariation,
    setImageStrength,
    setImageToImageSourceImage: setImageToImageSourceImageAndPersist,
    setImageToImageSourceImages: setImageToImageSourceImagesAndPersist,
    setStyleTransferSourceImage: setStyleTransferSourceImageAndPersist,
    setBackgroundSourceImage: setBackgroundSourceImageAndPersist,
    setUpscaleSourceImage: setUpscaleSourceImageAndPersist,
    setExtendSourceImage: setExtendSourceImageAndPersist,
    setExtendGenerated,
    setExtendUrls,
    setExtendError,
    setStyleSourceMode,
    setStyleTransferPreset,
    setStyleReferenceImage: setStyleReferenceImageAndPersist,
    setBackgroundReferenceImage,
    setBackgroundMode,
    setBackgroundColor,
    setMaskTool,
    setBrushSize,
    setBackgroundMask,
    setPreserveSubject,
    setEdgeCleanup,
    setAddShadow,
    setMatchLighting,
    setContentPreservation,
    setFacePreservation,
    setSeed,
    refreshRecentGenerations,
    generateImage: async () => {
      if (activeTab !== "Text to Image" || isGenerating) return;
      generationRunRef.current = true;
      setPendingGeneration(null);
      window.sessionStorage.removeItem(pendingGenerationStorageKey);
      setIsGenerating(true);
      setGenerationError(null);
      setGenerated(false);
      setGeneratedImageUrls([]);
      setSelectedRecentImageUrl(null);
      setSelectedVariation(0);
      setGenerationId(null);
      setGenerationStatus("idle");
      setGenerationTotalCount(Number(effectiveCount));
      setGenerationCompletedCount(0);
      generationAbortRef.current?.abort();
      const abortController = new AbortController();
      generationAbortRef.current = abortController;
      generationCancelRequestedRef.current = false;
      let terminalStatus: "failed" | "cancelled" | null = null;
      try {
        const handleProgress = (progress: GenerationProgress) => {
          applyGenerationProgress(progress);
          if (progress.status === "failed" || progress.status === "cancelled") terminalStatus = progress.status;
        };
        const result = await createTextToImage({ prompt, ...(style ? { style } : {}), ...(selectedModelCapabilities?.aspectRatioParameter ? {} : { ratio: effectiveRatio }), resolution: effectiveResolution, ...(qualityEnabled ? { quality: effectiveQuality } : {}), ...(effectiveOutputFormat ? { outputFormat: effectiveOutputFormat } : {}), count: effectiveCount, smartEnhance, negativePrompt, ...(Object.keys(requestModelParams).length ? { modelParams: requestModelParams } : {}), ...(selectedModel ? { model: selectedModel } : {}), idempotencyKey: crypto.randomUUID() }, handleProgress, abortController.signal);
        const urls = result.data.output.map((output) => output.url).filter(Boolean);
        setWorkspaceId(result.data.workspaceId);
        window.sessionStorage.setItem("eos.generation.workspace-id", result.data.workspaceId);
        setGeneratedImageUrls(urls);
        setGenerated(urls.length > 0);
        await loadRecentGenerations(result.data.workspaceId);
        setRecentGenerationUrls((currentUrls) => Array.from(new Set([...urls, ...currentUrls])));
      } catch (error) {
        if (abortController.signal.aborted || generationCancelRequestedRef.current) {
          setGenerationStatus("cancelled");
        } else {
          setGenerationStatus(terminalStatus ?? "failed");
          setGenerationError(error instanceof Error ? error.message : "Image generation failed");
        }
      } finally {
        if (generationAbortRef.current === abortController) generationAbortRef.current = null;
        setIsGenerating(false);
      }
    },
    extendImage: async () => {
      if (activeTab !== "Extend Image" || extendIsGenerating || !extendSourceImage || !extendSupportsInput) return;
      extendRunRef.current = true;
      setExtendPendingGeneration(null);
      window.sessionStorage.removeItem(pendingGenerationStorageKeyForFeature("extend-image"));
      extendAbortRef.current?.abort();
      const abortController = new AbortController();
      extendAbortRef.current = abortController;
      extendCancelRequestedRef.current = false;
      setExtendIsGenerating(true);
      setExtendStatus("queued");
      setExtendError(null);
      setExtendGenerated(false);
      setExtendUrls([]);
      setSelectedRecentImageUrl(null);
      setSelectedVariation(0);
      setExtendTotalCount(Number(effectiveCount));
      setExtendCompletedCount(0);
      try {
        const result = await createExtendImage({
          workspaceId,
          sourceImage: extendSourceImage,
          prompt: extendPrompt,
          direction: extendDirection,
          amount: extendAmount,
          ratio: effectiveRatio,
          resolution: effectiveResolution,
          ...(qualityEnabled ? { quality: effectiveQuality } : {}),
          count: effectiveCount,
          smartEnhance,
          negativePrompt,
          ...(effectiveOutputFormat ? { outputFormat: effectiveOutputFormat } : {}),
          ...(Object.keys(requestModelParams).length ? { modelParams: requestModelParams } : {}),
          ...(selectedExtendModel ? { model: selectedExtendModel } : {}),
          idempotencyKey: crypto.randomUUID(),
        }, applyExtendProgress, abortController.signal);
        const urls = result.data.output.map((output) => output.url).filter(Boolean);
        setWorkspaceId(result.data.workspaceId);
        window.sessionStorage.setItem("eos.generation.workspace-id", result.data.workspaceId);
        setExtendUrls(urls);
        setExtendGenerated(urls.length > 0);
        setExtendStatus("completed");
        setExtendCompletedCount(urls.length);
        await loadRecentGenerations(result.data.workspaceId, "extend-image");
        setRecentGenerationUrls((currentUrls) => Array.from(new Set([...urls, ...currentUrls])));
      } catch (error) {
        if (abortController.signal.aborted || extendCancelRequestedRef.current) {
          setExtendStatus("cancelled");
        } else {
          setExtendStatus("failed");
          setExtendError(error instanceof Error ? error.message : "Image extension failed");
        }
        window.sessionStorage.removeItem(pendingGenerationStorageKeyForFeature("extend-image"));
        setExtendPendingGeneration(null);
      } finally {
        if (extendAbortRef.current === abortController) extendAbortRef.current = null;
        setExtendIsGenerating(false);
      }
    },
    generateUpscale: async () => {
      if (activeTab !== "Upscale" || upscaleIsGenerating || !upscaleSourceImage) return;
      upscaleRunRef.current = true;
      setUpscalePendingGeneration(null);
      window.sessionStorage.removeItem(pendingGenerationStorageKeyForFeature("upscale"));
      upscaleAbortRef.current?.abort();
      const abortController = new AbortController();
      upscaleAbortRef.current = abortController;
      upscaleCancelRequestedRef.current = false;
      setUpscaleIsGenerating(true);
      setUpscaleStatus("queued");
      setUpscaleError(null);
      setUpscaleGenerated(false);
      setUpscaleUrls([]);
      setSelectedRecentImageUrl(null);
      setSelectedVariation(0);
      setUpscaleTotalCount(1);
      setUpscaleCompletedCount(0);
      try {
        const result = await createUpscale({
          workspaceId,
          sourceImage: upscaleSourceImage,
          targetResolution: effectiveResolution,
          ...(qualityEnabled ? { quality: effectiveQuality } : {}),
          ...(effectiveOutputFormat ? { outputFormat: effectiveOutputFormat } : {}),
          ...(Object.keys(requestModelParams).length ? { modelParams: requestModelParams } : {}),
          ...(selectedUpscaleModel ? { model: selectedUpscaleModel } : {}),
          idempotencyKey: crypto.randomUUID(),
        }, applyUpscaleProgress, abortController.signal);
        const urls = result.data.output.map((output) => output.url).filter(Boolean);
        setWorkspaceId(result.data.workspaceId);
        window.sessionStorage.setItem("eos.generation.workspace-id", result.data.workspaceId);
        setUpscaleUrls(urls);
        setUpscaleGenerated(urls.length > 0);
        setUpscaleStatus("completed");
        setUpscaleCompletedCount(urls.length);
        await loadRecentGenerations(result.data.workspaceId, "upscale");
        setRecentGenerationUrls((currentUrls) => Array.from(new Set([...urls, ...currentUrls])));
      } catch (error) {
        if (abortController.signal.aborted || upscaleCancelRequestedRef.current) {
          setUpscaleStatus("cancelled");
        } else {
          setUpscaleStatus("failed");
          setUpscaleError(error instanceof Error ? error.message : "Image upscaling failed");
        }
        window.sessionStorage.removeItem(pendingGenerationStorageKeyForFeature("upscale"));
        setUpscalePendingGeneration(null);
      } finally {
        if (upscaleAbortRef.current === abortController) upscaleAbortRef.current = null;
        setUpscaleIsGenerating(false);
      }
    },
    transformImage: async () => {
      if (activeTab !== "Image to Image" || imageToImageIsGenerating || !imageToImageSourceImage || !imageToImagePrompt.trim()) return;
      imageToImageRunRef.current = true;
      setImageToImagePendingGeneration(null);
      window.sessionStorage.removeItem(pendingGenerationStorageKeyForFeature("image-to-image"));
      imageToImageAbortRef.current?.abort();
      const abortController = new AbortController();
      imageToImageAbortRef.current = abortController;
      imageToImageCancelRequestedRef.current = false;
      setImageToImageIsGenerating(true);
      setImageToImageStatus("queued");
      setImageToImageError(null);
      setImageToImageGenerated(false);
      setImageToImageUrls([]);
      setImageToImageTotalCount(Number(count));
      setImageToImageCompletedCount(0);
      try {
        const result = await createImageToImage({ workspaceId, sourceImage: imageToImageSourceImage, ...(imageToImageSourceImages.length > 0 ? { sourceImages: imageToImageSourceImages } : {}), prompt: imageToImagePrompt, ...(style ? { style } : {}), ...(imageToImageSupportsStrength ? { strength: imageStrength } : {}), ratio: effectiveRatio, resolution: effectiveResolution, ...(qualityEnabled ? { quality: effectiveQuality } : {}), ...(effectiveOutputFormat ? { outputFormat: effectiveOutputFormat } : {}), count, smartEnhance, negativePrompt, ...(Object.keys(requestModelParams).length ? { modelParams: requestModelParams } : {}), ...(selectedImageToImageModel ? { model: selectedImageToImageModel } : {}), idempotencyKey: crypto.randomUUID() }, applyImageToImageProgress, abortController.signal);
        const urls = result.data.output.map((output) => output.url).filter(Boolean);
        setWorkspaceId(result.data.workspaceId);
        window.sessionStorage.setItem("eos.generation.workspace-id", result.data.workspaceId);
        setImageToImageUrls(urls);
        setImageToImageGenerated(urls.length > 0);
        setImageToImageStatus("completed");
        setImageToImageCompletedCount(urls.length);
        await loadRecentGenerations(result.data.workspaceId, "image-to-image");
        setRecentGenerationUrls((currentUrls) => Array.from(new Set([...urls, ...currentUrls])));
      } catch (error) {
        if (abortController.signal.aborted || imageToImageCancelRequestedRef.current) {
          setImageToImageStatus("cancelled");
        } else {
          setImageToImageStatus("failed");
          setImageToImageError(error instanceof Error ? error.message : "Image transformation failed");
        }
        window.sessionStorage.removeItem(pendingGenerationStorageKeyForFeature("image-to-image"));
        setImageToImagePendingGeneration(null);
      } finally {
        if (imageToImageAbortRef.current === abortController) imageToImageAbortRef.current = null;
        setImageToImageIsGenerating(false);
      }
    },
    generateStyleTransfer: async () => {
      const hasStyleInstruction = (styleSourceMode === "preset" && Boolean(styleTransferPreset)) || (styleSourceMode === "reference" && Boolean(styleReferenceImage)) || Boolean(styleTransferPrompt.trim());
      if (activeTab !== "AI Style Transfer" || styleTransferIsGenerating || !styleTransferSourceImage || !styleTransferSupportsInput || !hasStyleInstruction) return;
      styleTransferRunRef.current = true;
      setStyleTransferPendingGeneration(null);
      window.sessionStorage.removeItem(pendingGenerationStorageKeyForFeature("style-transfer"));
      styleTransferAbortRef.current?.abort();
      const abortController = new AbortController();
      styleTransferAbortRef.current = abortController;
      styleTransferCancelRequestedRef.current = false;
      setStyleTransferIsGenerating(true);
      setStyleTransferStatus("queued");
      setStyleTransferError(null);
      setStyleTransferGenerated(false);
      setStyleTransferUrls([]);
      setStyleTransferTotalCount(Number(count));
      setStyleTransferCompletedCount(0);
      try {
        const result = await createStyleTransfer({
          workspaceId,
          sourceImage: styleTransferSourceImage,
          styleReferenceImage: styleSourceMode === "reference" ? styleReferenceImage : null,
          stylePreset: styleSourceMode === "preset" ? styleTransferPreset : undefined,
          prompt: styleTransferPrompt,
          styleStrength: imageStrength / 100,
          contentPreservation: contentPreservation / 100,
          ratio: effectiveRatio,
          resolution: effectiveResolution,
          quality,
          ...(effectiveOutputFormat ? { outputFormat: effectiveOutputFormat } : {}),
          count,
          smartEnhance,
          negativePrompt,
          ...(Object.keys(requestModelParams).length ? { modelParams: requestModelParams } : {}),
          ...(selectedStyleTransferModel ? { model: selectedStyleTransferModel } : {}),
          idempotencyKey: crypto.randomUUID(),
        }, applyStyleTransferProgress, abortController.signal);
        const urls = result.data.output.map((output) => output.url).filter(Boolean);
        setWorkspaceId(result.data.workspaceId);
        window.sessionStorage.setItem("eos.generation.workspace-id", result.data.workspaceId);
        setStyleTransferUrls(urls);
        setStyleTransferGenerated(urls.length > 0);
        setStyleTransferStatus("completed");
        setStyleTransferCompletedCount(urls.length);
        await loadRecentGenerations(result.data.workspaceId, "style-transfer");
        setRecentGenerationUrls((currentUrls) => Array.from(new Set([...urls, ...currentUrls])));
      } catch (error) {
        if (abortController.signal.aborted || styleTransferCancelRequestedRef.current) {
          setStyleTransferStatus("cancelled");
        } else {
          setStyleTransferStatus("failed");
          setStyleTransferError(error instanceof Error ? error.message : "Style transfer failed");
        }
        window.sessionStorage.removeItem(pendingGenerationStorageKeyForFeature("style-transfer"));
        setStyleTransferPendingGeneration(null);
      } finally {
        if (styleTransferAbortRef.current === abortController) styleTransferAbortRef.current = null;
        setStyleTransferIsGenerating(false);
      }
    },
    generateBackground: async () => {
      const hasModeInstruction = backgroundMode === "remove" || backgroundMode === "solid" || (backgroundSupportsPrompt && Boolean(backgroundPrompt.trim())) || Boolean(backgroundReferenceImage);
      if (activeTab !== "AI Background" || backgroundIsGenerating || !backgroundSourceImage || !backgroundSupportsInput || !hasModeInstruction) return;
      window.sessionStorage.removeItem(pendingGenerationStorageKeyForFeature("background-removal"));
      backgroundAbortRef.current?.abort();
      const abortController = new AbortController();
      backgroundAbortRef.current = abortController;
      backgroundCancelRequestedRef.current = false;
      setBackgroundIsGenerating(true);
      setBackgroundStatus("queued");
      setBackgroundError(null);
      setBackgroundGenerated(false);
      setBackgroundUrls([]);
      setSelectedRecentImageUrl(null);
      setSelectedVariation(0);
      setBackgroundTotalCount(Number(effectiveCount));
      setBackgroundCompletedCount(0);
      try {
        const uploadedMask = backgroundMask ? await uploadMaskAsset(backgroundMask, workspaceId) : null;
        const requestMode: BackgroundMode = isLocalSolidBackground ? "remove" : backgroundMode;
        const result = await createBackgroundGeneration({
          workspaceId,
          mode: requestMode,
          sourceImage: backgroundSourceImage,
          backgroundReferenceImage: requestMode === "replace" ? backgroundReferenceImage : null,
          prompt: backgroundSupportsPrompt && (requestMode === "replace" || requestMode === "generate") ? backgroundPrompt : undefined,
          style: requestMode === "generate" ? style : undefined,
          mask: uploadedMask,
          autoDetectSubject: requestMode === "remove",
          transparent: requestMode === "remove",
          backgroundColor: supportsNativeSolidBackground ? backgroundColor : null,
          preserveSubject,
          edgeCleanup,
          addShadow,
          matchLighting,
          ratio: effectiveRatio,
          resolution: effectiveResolution,
          ...(qualityEnabled ? { quality: effectiveQuality } : {}),
          ...(providerOutputFormat ? { outputFormat: providerOutputFormat } : {}),
          count: effectiveCount,
          ...(requestMode !== "remove" && Object.keys(requestModelParams).length ? { modelParams: requestModelParams } : {}),
          ...(activeSelectedModel ? { model: activeSelectedModel } : {}),
          idempotencyKey: crypto.randomUUID(),
        }, applyBackgroundProgress, abortController.signal);
        const rawUrls = result.data.output.map((output) => output.url).filter(Boolean);
        const urls = isLocalSolidBackground
          ? await Promise.all(rawUrls.map(async (url) => uploadImageAsset(await createSolidBackgroundFile(url, backgroundColor, effectiveOutputFormat), { purpose: "content", feature: "background-removal", workspaceId: result.data.workspaceId })))
          : rawUrls;
        setWorkspaceId(result.data.workspaceId);
        window.sessionStorage.setItem("eos.generation.workspace-id", result.data.workspaceId);
        setBackgroundUrls(urls);
        setBackgroundGenerated(urls.length > 0);
        setBackgroundStatus("completed");
        setBackgroundCompletedCount(urls.length);
        // Solid Color may replace the provider output with a locally composited
        // asset. Do not restore the provider's raw pending output after reload.
        window.sessionStorage.removeItem(pendingGenerationStorageKeyForFeature("background-removal"));
        await loadRecentGenerations(result.data.workspaceId, "background-removal");
        setRecentGenerationUrls((currentUrls) => Array.from(new Set([...urls, ...currentUrls])));
      } catch (error) {
        if (abortController.signal.aborted || backgroundCancelRequestedRef.current) {
          setBackgroundStatus("cancelled");
        } else {
          setBackgroundStatus("failed");
          setBackgroundError(error instanceof Error ? error.message : "Background generation failed");
        }
        window.sessionStorage.removeItem(pendingGenerationStorageKeyForFeature("background-removal"));
      } finally {
        if (backgroundAbortRef.current === abortController) backgroundAbortRef.current = null;
        setBackgroundIsGenerating(false);
      }
    },
    cancelTextToImage,
    cancelImageToImage,
    cancelStyleTransfer,
    cancelBackground,
    cancelExtend,
    cancelUpscale,
    selectRatio: (nextRatio: ImageRatio) => {
      const safeRatio = availableRatioOptions.includes(nextRatio) ? nextRatio : availableRatioOptions[0] ?? nextRatio;
      setRatio(safeRatio);
      setResolution(supportedResolutionOptions(safeRatio, selectedModelCapabilities?.supportedSizes, selectedModelCapabilities?.supportedResolutions)[0] ?? "HD");
      setImageSizeOpen(false);
    },
    setResolution,
    setSelectedModel,
    setSelectedImageToImageModel,
    setSelectedStyleTransferModel,
    setSelectedBackgroundModel,
    setSelectedUpscaleModel,
    setSelectedExtendModel,
    setModelParam: (name: string, value: unknown) => {
      if (providerControlledModelParameters.has(name)) return;
      setModelParams((current) => {
        if (value === undefined || value === "") {
          const next = { ...current };
          delete next[name];
          return next;
        }
        return { ...current, [name]: value };
      });
    },
    toggleImageSize: () => setImageSizeOpen((open) => !open),
  };
}
