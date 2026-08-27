"use client";

import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  CloudUpload,
  AlertTriangle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Heart,
  ImageIcon,
  Info,
  LoaderCircle,
  Link2,
  Mic2,
  Play,
  Plus,
  Pencil,
  Trash2,
  Users,
  WandSparkles,
  X,
} from "lucide-react";
import { listGenerationModels, type GenerationModelOption } from "@/lib/api/generation-models";
import { EosVideoPlayer } from "@/components/media/eos-video-player";
import { uploadImageAsset } from "@/lib/api/storage";
import { emitCreditBalanceChanged, requestCreditBalanceSync } from "@/lib/credits/credit-events";
import {
  createVideoStoryboard,
  getVideoStoryboardStatus,
  listVideoStoryboardHistory,
  quoteVideoStoryboard,
  type VideoStoryboardHistoryItem,
  type VideoGenerationInput,
} from "@/lib/api/video-generations";
import { TextToVideoWorkspace } from "./text-video-generation";
import { LipsyncWorkspace, PeopleVideoWorkspace } from "./people-video-generation";
import { uploadPeopleMedia } from "@/lib/api/people-video-generations";
import { validateMediaFile } from "@/lib/media/upload-validation";
import { MotionTransferWorkspace } from "./motion-transfer-generation";
import { ExtendVideoWorkspace } from "./extend-video-generation";
import { VideoPreviewPlaceholder } from "./video-preview-placeholder";
import { DurationControl } from "./components/duration-control";
import { emitGenerationStarted } from "@/lib/generation-progress-events";
import styles from "./video-generation-page.module.css";
import { modelTier, modelTierClass } from "./model-tier";

const videoModes = [
  ["Image to Video", ImageIcon],
  ["Text to Video", FileText],
  ["People Video", Users],
  ["Motion Transfer", WandSparkles],
  ["Lipsync", Mic2],
  ["Extend Video", Plus],
] as const;
const tutorials = [
  { title: "Quick Start Guide", subtitle: "", duration: "2:15" },
  {
    title: "Prompt Like a Pro",
    subtitle: "Writing Better Prompts",
    duration: "4:08",
  },
  { title: "Shot Magic", subtitle: "Camera & Movement Tips", duration: "3:42" },
  { title: "Lipsync 101", subtitle: "Make It Talk", duration: "3:05" },
  { title: "Sound On", subtitle: "Add Audio & Ambience", duration: "2:58" },
];
const tutorialImages = [
  "/generated-assets/style-cinematic.png",
  "/generated-assets/recent-6.png",
  "/generated-assets/recent-2.png",
  "/generated-assets/recent-5.png",
  "/generated-assets/preview-live.png",
];
const videoModeOptions = [
  {
    value: "storyboard",
    label: "Storyboard",
    description: "Every scene starts from its own image",
  },
  {
    value: "continuous",
    label: "Continuous",
    description: "Continue from the previous scene",
  },
  {
    value: "flexible",
    label: "Flexible Storyboard",
    description: "Choose the start frame per scene",
  },
] as const;
const generationModeOptions = [
  {
    value: "single-image",
    label: "Single Storyboard Image",
    description: "Use the full uploaded storyboard as one reference",
  },
  {
    value: "multi-scene",
    label: "Multi-Scene Storyboard",
    description: "Build the video scene by scene",
  },
  {
    value: "continuous",
    label: "Continuous",
    description: "Continue each scene from the previous frame",
  },
  {
    value: "flexible",
    label: "Flexible Storyboard",
    description: "Use one image, multiple scenes, or previous frames",
  },
] as const;
const sceneSourceOptions = [
  { value: "manual", label: "New image" },
  { value: "previous_last_frame", label: "Previous frame" },
] as const;

function SectionTitle({
  number,
  children,
}: {
  number?: string;
  children: ReactNode;
}) {
  return (
    <div className={styles.sectionTitle}>
      <h2>
        {number ? `${number}. ` : ""}
        {children}
      </h2>
    </div>
  );
}

type StartFrameSource = "manual" | "previous_last_frame";
type StoryboardScene = {
  id: string;
  image: string | null;
  imageFile: File | null;
  endImage: string | null;
  endImageFile: File | null;
  prompt: string;
  duration: number;
  startFrameSource: StartFrameSource;
  modelParams: Record<string, unknown>;
};

type SchemaProperty = {
  type?: string;
  title?: string;
  description?: string;
  default?: unknown;
  enum?: unknown[];
  minimum?: number;
  maximum?: number;
  step?: number;
  format?: string;
  items?: { type?: string; [key: string]: unknown };
  [key: string]: unknown;
};

type VideoGenerationStatus = "idle" | "uploading" | "processing" | "completed" | "failed" | "cancelled";

const coreModelParameterNames = new Set([
  "image",
  "prompt",
  "duration",
  "duration_seconds",
  "durationSeconds",
  "resolution",
  "aspectRatio",
  "aspect_ratio",
  "generateAudio",
  "generate_audio",
  "audio",
  "audio_enabled",
  "negativePrompt",
  "negative_prompt",
  "endFrameImage",
  "end_frame_image",
  "endImage",
  "end_image",
  "lastFrameImage",
  "last_frame_image",
  "lastImage",
  "last_image",
  "last_frame",
  "lastFrame",
  "end_frame",
  "endFrame",
  "reference_images",
  "referenceImages",
  "reference_image",
  "referenceImage",
  "references",
  "images",
  "image_urls",
  "imageUrls",
  "input_images",
  "inputImages",
  "init_images",
  "initImages",
]);

const referenceImageParameterAliases = [
  "reference_images",
  "referenceImages",
  "reference_image",
  "referenceImage",
  "references",
  "images",
  "image_urls",
  "imageUrls",
  "input_images",
  "inputImages",
  "init_images",
  "initImages",
];
const lastImageParameterAliases = [
  "endFrameImage",
  "end_frame_image",
  "lastFrameImage",
  "last_frame_image",
  "last_image",
  "lastImage",
  "last_frame",
  "lastFrame",
  "end_image",
  "endImage",
  "end_frame",
  "endFrame",
];

function labelFromParameterName(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function schemaProperties(model: GenerationModelOption | undefined): Record<string, SchemaProperty> {
  const properties = (model?.capabilities.apiSchema?.request_schema?.properties ?? {}) as Record<string, SchemaProperty>;
  if (Object.keys(properties).length) return properties;
  return Object.fromEntries((model?.capabilities.parameters ?? []).map((name) => [name, { type: "string" }]));
}

function requiredSchemaParameters(model: GenerationModelOption | undefined): string[] {
  return model?.capabilities.apiSchema?.request_schema?.required
    ?? model?.capabilities.requiredParameters
    ?? [];
}

function modelFamily(modelId: string): string {
  return modelId
    .toLowerCase()
    .replace(/\/(?:image-to-video|video-extend|extend-video)$/, "");
}

function schemaDefault(property: SchemaProperty | undefined): unknown {
  if (!property) return undefined;
  if (property.default !== undefined) return property.default;
  if (property.enum?.length) return property.enum[0];
  if (property.type === "boolean") return false;
  return undefined;
}

function findSchemaProperty(properties: Record<string, SchemaProperty>, names: string[]): [string, SchemaProperty] | undefined {
  for (const name of names) {
    if (properties[name]) return [name, properties[name]];
  }
  return undefined;
}

function findModelInputParameter(
  model: GenerationModelOption | undefined,
  configured: string | undefined,
  aliases: string[],
): string | undefined {
  if (configured) return configured;
  return findSchemaProperty(schemaProperties(model), aliases)?.[0];
}

function modelSpecificDefaults(model: GenerationModelOption | undefined): Record<string, unknown> {
  const properties = schemaProperties(model);
  const nextParams: Record<string, unknown> = {};
  const capabilities = model?.capabilities;
  for (const [name, property] of Object.entries(properties)) {
    if (coreModelParameterNames.has(name) || name === capabilities?.promptParameter || name === capabilities?.imageParameter || name === capabilities?.referenceImagesParameter || name === capabilities?.negativePromptParameter) continue;
    const value = schemaDefault(property);
    if (value !== undefined) nextParams[name] = value;
  }
  return nextParams;
}

function formatHistoryDate(value?: string): string {
  if (!value) return "Recently generated";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently generated";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
}

export function VideoGenerationPage() {
  const searchParams = useSearchParams();
  const [activeVideoTab, setActiveVideoTab] = useState<"image-to-video" | "text-to-video" | "people-video" | "motion-transfer" | "lipsync" | "extend-video">("image-to-video");
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [duration, setDuration] = useState(5);
  const [resolution, setResolution] = useState("");
  const [aspectRatio, setAspectRatio] = useState("");
  const [autoSound, setAutoSound] = useState(false);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [generationMode, setGenerationMode] = useState<(typeof generationModeOptions)[number]["value"]>("multi-scene");
  const [videoMode, setVideoMode] =
    useState<(typeof videoModeOptions)[number]["value"]>("storyboard");
  const [isGenerationModeMenuOpen, setIsGenerationModeMenuOpen] = useState(false);
  const [models, setModels] = useState<GenerationModelOption[]>([]);
  const [extendModels, setExtendModels] = useState<GenerationModelOption[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [modelsLoading, setModelsLoading] = useState(true);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [modelParams, setModelParams] = useState<Record<string, unknown>>({});
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [generationStatus, setGenerationStatus] = useState<VideoGenerationStatus>("idle");
  const [generationProgress, setGenerationProgress] = useState({ completed: 0, total: 0 });
  const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null);
  const [previewView, setPreviewView] = useState<"latest" | "library">("latest");
  const [videoLibraryIndex, setVideoLibraryIndex] = useState(0);
  const [isVideoFavorite, setIsVideoFavorite] = useState(false);
  const videoRecentRowRef = useRef<HTMLDivElement>(null);
  const [videoRecentScrollState, setVideoRecentScrollState] = useState({
    canScrollLeft: false,
    canScrollRight: false,
  });
  const [videoHistory, setVideoHistory] = useState<VideoStoryboardHistoryItem[]>([]);
  const [videoHistoryLoading, setVideoHistoryLoading] = useState(true);
  const [videoHistoryError, setVideoHistoryError] = useState<string | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(() => typeof window === "undefined" ? null : window.sessionStorage.getItem("eos.generation.workspace-id"));
  const [continuationInfo, setContinuationInfo] = useState<{
    strategy?: string;
    nativeExtend?: boolean;
    seamless?: boolean;
  } | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [creditEstimate, setCreditEstimate] = useState<number | null>(null);
  const [creditEstimateLoading, setCreditEstimateLoading] = useState(false);
  const [creditEstimateError, setCreditEstimateError] = useState<string | null>(null);
  const [frameReferences, setFrameReferences] = useState<string[]>([]);
  const [frameReferenceFiles, setFrameReferenceFiles] = useState<File[]>([]);
  const [storyboardScenes, setStoryboardScenes] = useState<StoryboardScene[]>([
    {
      id: "scene-1",
      image: null,
      imageFile: null,
      endImage: null,
      endImageFile: null,
      prompt,
      duration: 5,
      startFrameSource: "manual",
      modelParams: {},
    },
  ]);
  const [isSceneModalOpen, setIsSceneModalOpen] = useState(false);
  const [deleteSceneIndex, setDeleteSceneIndex] = useState<number | null>(null);
  const [editingSceneIndex, setEditingSceneIndex] = useState<number | null>(null);
  const [sceneImage, setSceneImage] = useState<string | null>(null);
  const [sceneImageFile, setSceneImageFile] = useState<File | null>(null);
  const [sceneEndImage, setSceneEndImage] = useState<string | null>(null);
  const [sceneEndImageFile, setSceneEndImageFile] = useState<File | null>(null);
  const [sceneStartFrameSource, setSceneStartFrameSource] =
    useState<StartFrameSource>("manual");
  const [scenePrompt, setScenePrompt] = useState("");
  const [sceneDuration, setSceneDuration] = useState(5);
  const [sceneModelParams, setSceneModelParams] = useState<Record<string, unknown>>({});
  const [sceneError, setSceneError] = useState<string | null>(null);
  const [sceneScrollState, setSceneScrollState] = useState({
    canScrollLeft: false,
    canScrollRight: false,
  });
  const [openSceneSourceMenu, setOpenSceneSourceMenu] = useState<number | null>(
    null,
  );
  const [sceneSourceMenuPosition, setSceneSourceMenuPosition] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const frameInputRef = useRef<HTMLInputElement | null>(null);
  const sourceInputRef = useRef<HTMLInputElement | null>(null);
  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const sourceLastImageInputRef = useRef<HTMLInputElement | null>(null);
  const sceneInputRef = useRef<HTMLInputElement | null>(null);
  const sceneEndInputRef = useRef<HTMLInputElement | null>(null);
  const sceneRowRef = useRef<HTMLDivElement | null>(null);
  const sceneSourceButtonRefs = useRef<
    Record<number, HTMLButtonElement | null>
  >({});
  const selectedModelOption = models.find((model) => model.model === selectedModel);
  const capabilities = selectedModelOption?.capabilities;
  const properties = schemaProperties(selectedModelOption);
  const referenceImagesParameter = findModelInputParameter(
    selectedModelOption,
    selectedModelOption?.capabilities.referenceImagesParameter,
    referenceImageParameterAliases,
  );
  const lastImageParameter = findModelInputParameter(
    selectedModelOption,
    selectedModelOption?.capabilities.lastImageParameter,
    lastImageParameterAliases,
  );
  const supportsReferenceImages = Boolean(referenceImagesParameter);
  const supportsLastImage = Boolean(lastImageParameter);
  const requiredProperties = new Set(requiredSchemaParameters(selectedModelOption));
  const durationProperty = findSchemaProperty(properties, ["duration", "duration_seconds", "durationSeconds"]);
  const resolutionProperty = findSchemaProperty(properties, ["resolution"]);
  const aspectRatioProperty = findSchemaProperty(properties, ["aspectRatio", "aspect_ratio"]);
  const audioProperty = findSchemaProperty(properties, ["generateAudio", "generate_audio", "audio", "audio_enabled"]);
  const audioInputMode = Boolean(audioProperty && audioProperty[1].type !== "boolean");
  const modelParameterEntries = Object.entries(properties).filter(([name]) => {
    const selected = models.find((model) => model.model === selectedModel);
    const capabilities = selected?.capabilities;
    return !coreModelParameterNames.has(name)
      && name !== capabilities?.promptParameter
      && name !== capabilities?.imageParameter
      && name !== capabilities?.referenceImagesParameter
      && name !== referenceImagesParameter
      && name !== lastImageParameter
      && name !== capabilities?.negativePromptParameter;
  });

  useEffect(() => {
    const requestedTab = searchParams.get("tab");
    if (requestedTab !== "image-to-video" && requestedTab !== "text-to-video" && requestedTab !== "people-video" && requestedTab !== "motion-transfer" && requestedTab !== "lipsync" && requestedTab !== "extend-video") return;
    const timeoutId = window.setTimeout(() => setActiveVideoTab(requestedTab), 0);
    return () => window.clearTimeout(timeoutId);
  }, [searchParams]);

  const loadVideoHistory = useCallback(async (workspace?: string | null) => {
    setVideoHistoryLoading(true);
    setVideoHistoryError(null);
    try {
      setVideoHistory(await listVideoStoryboardHistory(workspace));
    } catch (error: unknown) {
      setVideoHistoryError(error instanceof Error ? error.message : "Unable to load generated videos");
    } finally {
      setVideoHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    const storedWorkspaceId = window.sessionStorage.getItem("eos.generation.workspace-id");
    const timeoutId = window.setTimeout(() => {
      void loadVideoHistory(storedWorkspaceId);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadVideoHistory]);
  useEffect(() => {
    let active = true;
    Promise.all([
      listGenerationModels("image-to-video"),
      listGenerationModels("extend-video").catch(() => [] as GenerationModelOption[]),
    ])
      .then(([items, extendItems]) => {
        const eligible = items.filter((item) => item.enabled && item.capabilities.promptParameter && (
          item.capabilities.imageParameter || item.capabilities.referenceImagesParameter
        ));
        if (!active) return;
        setModels(eligible);
        setExtendModels(extendItems.filter((item) => item.enabled));
        setSelectedModel((current) => eligible.some((item) => item.model === current)
          ? current
          : eligible.find((item) => item.isDefault)?.model ?? eligible[0]?.model ?? "");
      })
      .catch((error: unknown) => {
        if (!active) return;
        setModelsError(error instanceof Error ? error.message : "Unable to load video models");
      })
      .finally(() => {
        if (active) setModelsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!selectedModel) return;
    const selected = models.find((model) => model.model === selectedModel);
    const nextProperties = schemaProperties(selected);
    const nextParams: Record<string, unknown> = {};
    const promptParameter = selected?.capabilities.promptParameter;
    const imageParameter = selected?.capabilities.imageParameter;
    const referenceImagesParameter = selected?.capabilities.referenceImagesParameter;
    for (const [name, property] of Object.entries(nextProperties)) {
      if (coreModelParameterNames.has(name) || name === promptParameter || name === imageParameter || name === referenceImagesParameter || name === selected?.capabilities.negativePromptParameter) continue;
      const value = schemaDefault(property);
      if (value !== undefined) nextParams[name] = value;
    }
    const nextDuration = findSchemaProperty(nextProperties, ["duration", "duration_seconds", "durationSeconds"]);
    const nextResolution = findSchemaProperty(nextProperties, ["resolution"]);
    const nextAspectRatio = findSchemaProperty(nextProperties, ["aspectRatio", "aspect_ratio"]);
    const nextAudio = findSchemaProperty(nextProperties, ["generateAudio", "generate_audio", "audio", "audio_enabled"]);
    const durationDefault = schemaDefault(nextDuration?.[1]);
    const nextDurationValue = typeof durationDefault === "number"
      ? durationDefault
      : typeof durationDefault === "string" && Number.isFinite(Number(durationDefault))
        ? Number(durationDefault)
        : nextDuration?.[1].minimum ?? 0;
    const resolutionDefault = schemaDefault(nextResolution?.[1]);
    const aspectDefault = schemaDefault(nextAspectRatio?.[1]);
    const audioDefault = schemaDefault(nextAudio?.[1]);
    const timeoutId = window.setTimeout(() => {
      setModelParams(nextParams);
      setDuration(nextDurationValue);
      setResolution(typeof resolutionDefault === "string" ? resolutionDefault : "");
      setAspectRatio(typeof aspectDefault === "string" ? aspectDefault : "");
      setAutoSound(typeof audioDefault === "boolean" ? audioDefault : false);
      setAudioFile(null);
      setStoryboardScenes((current) => current.map((scene) => ({
        ...scene,
        duration: nextDurationValue || scene.duration,
      })));
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [models, selectedModel]);
  const uploadSource = async (file: File) => {
    const validationError = await validateMediaFile(file, "image", capabilities?.uploadConstraints);
    if (validationError) {
      setGenerationError(validationError);
      return;
    }
    const nextUrl = URL.createObjectURL(file);
    setSourceImage((current) => {
      if (current) URL.revokeObjectURL(current);
      return nextUrl;
    });
    setStoryboardScenes((current) => current.map((scene, index) => (
      index === 0 ? { ...scene, image: nextUrl, imageFile: file, startFrameSource: "manual" } : scene
    )));
    setGenerationError(null);
  };
  const clearSource = () => {
    if (sourceImage?.startsWith("blob:")) URL.revokeObjectURL(sourceImage);
    setSourceImage(null);
    setStoryboardScenes((current) => current.map((scene, index) => (
      index === 0 ? { ...scene, image: null, imageFile: null, startFrameSource: "manual" } : scene
    )));
  };
  const uploadSourceLastImage = async (file: File) => {
    const validationError = await validateMediaFile(file, "image", capabilities?.uploadConstraints);
    if (validationError) {
      setGenerationError(validationError);
      return;
    }
    const currentImage = storyboardScenes[0]?.endImage;
    if (currentImage?.startsWith("blob:")) URL.revokeObjectURL(currentImage);
    const nextUrl = URL.createObjectURL(file);
    setStoryboardScenes((current) => current.map((scene, index) => (
      index === 0 ? { ...scene, endImage: nextUrl, endImageFile: file } : scene
    )));
    setGenerationError(null);
  };
  const clearSourceLastImage = () => {
    const currentImage = storyboardScenes[0]?.endImage;
    if (currentImage?.startsWith("blob:")) URL.revokeObjectURL(currentImage);
    setStoryboardScenes((current) => current.map((scene, index) => (
      index === 0 ? { ...scene, endImage: null, endImageFile: null } : scene
    )));
  };
  const updateDuration = (value: number) => {
    setDuration(value);
    if (durationProperty) {
      setStoryboardScenes((current) => current.map((scene) => ({ ...scene, duration: value })));
    }
  };
  const updateModelParam = (name: string, value: unknown) => {
    setModelParams((current) => ({ ...current, [name]: value }));
  };
  const addFrame = async (file: File) => {
    const validationError = await validateMediaFile(file, "image", capabilities?.uploadConstraints);
    if (validationError) {
      setGenerationError(validationError);
      return;
    }
    const nextUrl = URL.createObjectURL(file);
    setFrameReferences((current) => [...current, nextUrl]);
    setFrameReferenceFiles((current) => [...current, file]);
    setGenerationError(null);
  };

  const handleAudioFile = async (file: File) => {
    const validationError = await validateMediaFile(file, "audio", capabilities?.uploadConstraints);
    if (validationError) {
      setGenerationError(validationError);
      return;
    }
    setAudioFile(file);
    setGenerationError(null);
  };

  const handleSceneImageFile = async (file: File, endImage = false) => {
    const validationError = await validateMediaFile(file, "image", capabilities?.uploadConstraints);
    if (validationError) {
      setSceneError(validationError);
      return;
    }
    if (endImage) {
      if (editingSceneIndex === null && sceneEndImage?.startsWith("blob:")) URL.revokeObjectURL(sceneEndImage);
      setSceneEndImage(URL.createObjectURL(file));
      setSceneEndImageFile(file);
    } else {
      if (editingSceneIndex === null && sceneImage?.startsWith("blob:")) URL.revokeObjectURL(sceneImage);
      setSceneImage(URL.createObjectURL(file));
      setSceneImageFile(file);
    }
    setSceneError(null);
  };
  const clearFrameReferences = () => {
    frameReferences.forEach((source) => {
      if (source.startsWith("blob:")) URL.revokeObjectURL(source);
    });
    setFrameReferences([]);
    setFrameReferenceFiles([]);
  };
  const scrollScenes = (direction: "left" | "right") => {
    const row = sceneRowRef.current;
    if (!row) return;
    const step = Math.max(row.clientWidth * 0.75, 180);
    const maxScrollLeft = row.scrollWidth - row.clientWidth;
    const nextScrollLeft =
      direction === "right"
        ? Math.min(row.scrollLeft + step, maxScrollLeft)
        : Math.max(row.scrollLeft - step, 0);
    row.scrollTo({
      left: nextScrollLeft,
      behavior: "smooth",
    });
  };
  useEffect(() => {
    const row = sceneRowRef.current;
    if (!row) return;
    const updateScrollState = () => {
      const maxScrollLeft = row.scrollWidth - row.clientWidth;
      setSceneScrollState({
        canScrollLeft: row.scrollLeft > 1,
        canScrollRight: row.scrollLeft < maxScrollLeft - 1,
      });
    };
    updateScrollState();
    row.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState);
    return () => {
      row.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
    };
  }, [storyboardScenes.length, videoMode]);
  useEffect(() => {
    const row = videoRecentRowRef.current;
    if (!row) return;
    const updateVideoRecentScrollState = () => {
      const maxScrollLeft = row.scrollWidth - row.clientWidth;
      setVideoRecentScrollState({
        canScrollLeft: row.scrollLeft > 1,
        canScrollRight: row.scrollLeft < maxScrollLeft - 1,
      });
    };
    updateVideoRecentScrollState();
    row.addEventListener("scroll", updateVideoRecentScrollState, { passive: true });
    window.addEventListener("resize", updateVideoRecentScrollState);
    return () => {
      row.removeEventListener("scroll", updateVideoRecentScrollState);
      window.removeEventListener("resize", updateVideoRecentScrollState);
    };
  }, [videoHistory.length]);
  useEffect(() => {
    if (openSceneSourceMenu === null) return;
    const updateMenuPosition = () => {
      const button = sceneSourceButtonRefs.current[openSceneSourceMenu];
      if (!button) return;
      const rect = button.getBoundingClientRect();
      setSceneSourceMenuPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    };
    const row = sceneRowRef.current;
    updateMenuPosition();
    row?.addEventListener("scroll", updateMenuPosition, { passive: true });
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      row?.removeEventListener("scroll", updateMenuPosition);
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [openSceneSourceMenu]);
  const toggleSceneSourceMenu = (index: number) => {
    if (openSceneSourceMenu === index) {
      setOpenSceneSourceMenu(null);
      setSceneSourceMenuPosition(null);
      return;
    }
    const button = sceneSourceButtonRefs.current[index];
    if (button) {
      const rect = button.getBoundingClientRect();
      setSceneSourceMenuPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    }
    setOpenSceneSourceMenu(index);
  };
  const selectGenerationMode = (
    nextMode: (typeof generationModeOptions)[number]["value"],
  ) => {
    setGenerationMode(nextMode);
    setIsGenerationModeMenuOpen(false);
    setOpenSceneSourceMenu(null);
    setSceneSourceMenuPosition(null);
    const nextVideoMode = nextMode === "continuous"
      ? "continuous"
      : nextMode === "flexible"
        ? "flexible"
        : "storyboard";
    setVideoMode(nextVideoMode);
    setStoryboardScenes((current) =>
      current.map((scene, index) => ({
        ...scene,
        startFrameSource:
          index === 0 || nextVideoMode === "storyboard"
            ? "manual"
            : nextVideoMode === "continuous"
              ? "previous_last_frame"
              : scene.startFrameSource,
      })),
    );
  };
  const updateSceneSource = (index: number, source: StartFrameSource) => {
    if (index === 0) return;
    setStoryboardScenes((current) =>
      current.map((scene, sceneIndex) =>
        sceneIndex === index ? { ...scene, startFrameSource: source } : scene,
      ),
    );
  };
  const getSceneSource = (
    scene: StoryboardScene,
    index: number,
  ): StartFrameSource => {
    if (index === 0 || videoMode === "storyboard") return "manual";
    if (videoMode === "continuous") return "previous_last_frame";
    return scene.startFrameSource;
  };
  const sourcePreviewImage = storyboardScenes[0]?.image ?? sourceImage;
  const nativeExtendModel = selectedModelOption
    ? extendModels.find((model) => modelFamily(model.model) === modelFamily(selectedModelOption.model))
    : undefined;
  const hasNativeExtend = Boolean(nativeExtendModel);
  const generationScenes = generationMode === "single-image"
    ? storyboardScenes.slice(0, 1)
    : storyboardScenes;
  const creditQuoteInput: Omit<VideoGenerationInput, "idempotencyKey"> | null = (() => {
    if (activeVideoTab !== "image-to-video" || !selectedModel || generationScenes.length === 0) return null;
    const scenes = generationScenes.map((scene, index) => {
      const startFrameSource: StartFrameSource = index === 0 || videoMode === "storyboard"
        ? "manual"
        : videoMode === "continuous"
          ? "previous_last_frame"
          : scene.startFrameSource;
      const sceneInput: VideoGenerationInput["scenes"][number] = {
        startFrameSource,
        prompt: scene.prompt.trim() || prompt.trim() || "Video generation",
      };
      if (startFrameSource === "manual" && scene.image && !scene.image.startsWith("blob:")) sceneInput.storyboardImage = scene.image;
      if (scene.endImage && !scene.endImage.startsWith("blob:") && lastImageParameter) sceneInput[lastImageParameter] = scene.endImage;
      if (negativePrompt.trim()) sceneInput.negativePrompt = negativePrompt.trim();
      if (durationProperty) sceneInput.duration = scene.duration;
      if (Object.keys(scene.modelParams).length) sceneInput.modelParams = scene.modelParams;
      return sceneInput;
    });
    const request: Omit<VideoGenerationInput, "idempotencyKey"> = {
      model: selectedModel,
      mode: videoMode,
      scenes,
    };
    if (durationProperty) request.duration = duration;
    if (resolutionProperty && resolution) request.resolution = resolution;
    if (aspectRatioProperty && aspectRatio) request.aspectRatio = aspectRatio;
    if (audioProperty) request.generateAudio = autoSound;
    if (Object.keys(modelParams).length) request.modelParams = modelParams;
    return request;
  })();

  const creditQuoteKey = JSON.stringify(creditQuoteInput);

  useEffect(() => {
    let active = true;
    const request = creditQuoteKey === "null"
      ? null
      : JSON.parse(creditQuoteKey) as Omit<VideoGenerationInput, "idempotencyKey">;
    const loadingTimeoutId = window.setTimeout(() => {
      if (active && request) setCreditEstimateLoading(true);
    }, 0);
    const quoteTimeoutId = window.setTimeout(() => {
      if (!request) {
        setCreditEstimate(null);
        setCreditEstimateError(null);
        setCreditEstimateLoading(false);
        return;
      }
      setCreditEstimateError(null);
      void quoteVideoStoryboard(request)
        .then((quote) => {
          if (!active) return;
          const value = Number(quote.totalCreditCost);
          if (!Number.isFinite(value)) throw new Error("Pricing unavailable");
          setCreditEstimate(value);
        })
        .catch((error: unknown) => {
          if (!active) return;
          setCreditEstimate(null);
          setCreditEstimateError(error instanceof Error ? error.message : "Pricing unavailable");
        })
        .finally(() => {
          if (active) setCreditEstimateLoading(false);
        });
    }, 450);
    return () => {
      active = false;
      window.clearTimeout(loadingTimeoutId);
      window.clearTimeout(quoteTimeoutId);
    };
  }, [creditQuoteKey]);

  const estimateSceneCount = generationScenes.length;
  const estimateDurations = generationScenes.map((scene) => durationProperty ? scene.duration : duration);
  const estimateTotalDuration = estimateDurations.reduce((total, value) => total + (Number.isFinite(value) ? value : 0), 0);
  const allScenesShareDuration = estimateDurations.every((value) => value === estimateDurations[0]);
  const estimateDescription = generationMode === "single-image"
    ? `1 video x ${estimateDurations[0] ?? 0} sec`
    : allScenesShareDuration
    ? `${estimateSceneCount} ${estimateSceneCount === 1 ? "scene" : "scenes"} x ${estimateDurations[0] ?? 0} sec`
    : `${estimateSceneCount} scenes x ${estimateTotalDuration} sec total`;
  const formattedCreditEstimate: ReactNode = creditEstimateLoading
    ? <span className={styles.creditCalculating}><LoaderCircle size={12} className={styles.creditSpinner} />Recalculating price…</span>
    : creditEstimate === null
      ? "Pricing unavailable"
      : `${creditEstimate.toLocaleString(undefined, { maximumFractionDigits: 2 })} Credits`;
  const firstScene = storyboardScenes[0];
  const firstSceneHasPrompt = Boolean(firstScene?.prompt.trim() || prompt.trim());
  const canAddScene = generationMode !== "single-image" && Boolean(firstScene?.image && firstSceneHasPrompt);
  const selectedGenerationMode =
    generationModeOptions.find((option) => option.value === generationMode) ??
    generationModeOptions[0];
  const selectedVideoMode =
    videoModeOptions.find((option) => option.value === videoMode) ??
    videoModeOptions[0];
  const openSceneModal = () => {
    if (!canAddScene) return;
    setEditingSceneIndex(null);
    setSceneError(null);
    setScenePrompt("");
    setSceneDuration(durationProperty ? duration : 0);
    setSceneImage(null);
    setSceneImageFile(null);
    setSceneEndImage(null);
    setSceneEndImageFile(null);
    setSceneStartFrameSource(
      videoMode === "continuous" ? "previous_last_frame" : "manual",
    );
    setIsSceneModalOpen(true);
    setSceneModelParams(modelSpecificDefaults(models.find((model) => model.model === selectedModel)));
  };
  const openEditSceneModal = (index: number) => {
    const scene = storyboardScenes[index];
    if (!scene) return;
    const sceneSource = getSceneSource(scene, index);
    setEditingSceneIndex(index);
    setSceneError(null);
    setScenePrompt(scene.prompt);
    setSceneDuration(scene.duration);
    setSceneImage(sceneSource === "manual" ? scene.image : null);
    setSceneImageFile(sceneSource === "manual" ? scene.imageFile : null);
    setSceneEndImage(scene.endImage);
    setSceneEndImageFile(scene.endImageFile);
    setSceneStartFrameSource(sceneSource);
    setSceneModelParams({
      ...modelSpecificDefaults(models.find((model) => model.model === selectedModel)),
      ...scene.modelParams,
    });
    setIsSceneModalOpen(true);
  };
  const deleteScene = (index: number) => {
    if (index === 0) return;
    const scene = storyboardScenes[index];
    if (!scene) return;
    setDeleteSceneIndex(index);
  };
  const closeDeleteSceneDialog = () => setDeleteSceneIndex(null);
  const confirmDeleteScene = () => {
    const index = deleteSceneIndex;
    if (index === null) return;
    const scene = storyboardScenes[index];
    if (!scene) {
      closeDeleteSceneDialog();
      return;
    }
    if (scene.image?.startsWith("blob:")) URL.revokeObjectURL(scene.image);
    if (scene.endImage?.startsWith("blob:")) URL.revokeObjectURL(scene.endImage);
    setStoryboardScenes((current) => current.filter((_, sceneIndex) => sceneIndex !== index));
    closeDeleteSceneDialog();
  };
  useEffect(() => {
    if (deleteSceneIndex === null) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeDeleteSceneDialog();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [deleteSceneIndex]);
  const closeSceneModal = () => {
    if (editingSceneIndex === null && sceneImage?.startsWith("blob:")) URL.revokeObjectURL(sceneImage);
    setSceneImage(null);
    setSceneImageFile(null);
    setSceneEndImage(null);
    setSceneEndImageFile(null);
    setSceneStartFrameSource("manual");
    setScenePrompt("");
    setSceneModelParams({});
    setSceneError(null);
    setEditingSceneIndex(null);
    setIsSceneModalOpen(false);
  };
  const clearSceneModalImage = () => {
    if (editingSceneIndex === null && sceneImage?.startsWith("blob:")) URL.revokeObjectURL(sceneImage);
    setSceneImage(null);
    setSceneImageFile(null);
    setSceneError(null);
  };
  const clearSceneEndImage = () => {
    if (editingSceneIndex === null && sceneEndImage?.startsWith("blob:")) URL.revokeObjectURL(sceneEndImage);
    setSceneEndImage(null);
    setSceneEndImageFile(null);
    setSceneError(null);
  };
  const saveScene = () => {
    if (sceneStartFrameSource === "manual" && !sceneImage)
      return setSceneError("Please upload an image for this scene.");
    if (!scenePrompt.trim())
      return setSceneError("Please add a prompt for this scene.");
    const missingSceneParam = modelParameterEntries.find(([name]) => {
      if (!requiredProperties.has(name)) return false;
      const value = sceneModelParams[name];
      return value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
    });
    if (missingSceneParam)
      return setSceneError(`${labelFromParameterName(missingSceneParam[0])} is required for this scene.`);
    const nextScene: StoryboardScene = {
      id: editingSceneIndex === null ? crypto.randomUUID() : storyboardScenes[editingSceneIndex]?.id ?? crypto.randomUUID(),
      image: sceneStartFrameSource === "manual" ? sceneImage : null,
      imageFile: sceneStartFrameSource === "manual" ? sceneImageFile : null,
      endImage: supportsLastImage ? sceneEndImage : null,
      endImageFile: supportsLastImage ? sceneEndImageFile : null,
      prompt: scenePrompt.trim(),
      duration: sceneDuration,
      startFrameSource: sceneStartFrameSource,
      modelParams: sceneModelParams,
    };
    if (editingSceneIndex === null) {
      setStoryboardScenes((current) => [...current, nextScene]);
    } else {
      setStoryboardScenes((current) => current.map((scene, index) => index === editingSceneIndex ? nextScene : scene));
      if (editingSceneIndex === 0) setPrompt(nextScene.prompt);
    }
    setIsSceneModalOpen(false);
    setEditingSceneIndex(null);
    setSceneImage(null);
    setSceneImageFile(null);
    setSceneEndImage(null);
    setSceneEndImageFile(null);
    setSceneStartFrameSource("manual");
    setScenePrompt("");
    setSceneModelParams({});
    setSceneDuration(5);
  };
  const canSaveScene =
    scenePrompt.trim().length > 0 &&
    (sceneStartFrameSource === "previous_last_frame" || Boolean(sceneImage));
  const isGeneratingVideo = generationStatus === "uploading" || generationStatus === "processing";
  const safeVideoLibraryIndex = Math.min(videoLibraryIndex, Math.max(videoHistory.length - 1, 0));
  const galleryVideoUrl = videoHistory[safeVideoLibraryIndex]?.finalVideoUrl ?? null;
  const latestVideoUrl = finalVideoUrl ?? videoHistory[0]?.finalVideoUrl ?? null;
  const displayedVideoUrl = previewView === "library" ? galleryVideoUrl ?? latestVideoUrl : latestVideoUrl;
  const downloadDisplayedVideo = async () => {
    if (!displayedVideoUrl) return;
    try {
      const response = await fetch(displayedVideoUrl);
      if (!response.ok) throw new Error("Unable to download video");
      const blobUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = "eos-generated-video.mp4";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch {
      window.open(displayedVideoUrl, "_blank", "noopener,noreferrer");
    }
  };
  const fileFromSceneImage = async (image: string, index: number, existingFile: File | null, prefix = "scene") => {
    if (existingFile) return existingFile;
    const response = await fetch(image);
    if (!response.ok) throw new Error(`Unable to prepare ${prefix} ${index + 1} image`);
    const blob = await response.blob();
    return new File([blob], `${prefix}-${index + 1}.png`, { type: blob.type || "image/png" });
  };
  const handleGenerate = async () => {
    if (!selectedModel) {
      setGenerationError("Select a video model first.");
      return;
    }
    if (!prompt.trim()) {
      setGenerationError("Add a prompt before generating.");
      return;
    }
    const missingRequiredParam = modelParameterEntries.find(([name]) => {
      if (!requiredProperties.has(name)) return false;
      const value = modelParams[name];
      return value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
    });
    if (missingRequiredParam) {
      setGenerationError(`${labelFromParameterName(missingRequiredParam[0])} is required for this model.`);
      return;
    }
    const requiredStructuredField = durationProperty && requiredProperties.has(durationProperty[0]) && (!Number.isFinite(duration) || duration <= 0)
      ? durationProperty[0]
      : resolutionProperty && requiredProperties.has(resolutionProperty[0]) && !resolution
        ? resolutionProperty[0]
        : aspectRatioProperty && requiredProperties.has(aspectRatioProperty[0]) && !aspectRatio
          ? aspectRatioProperty[0]
          : null;
    if (requiredStructuredField) {
      setGenerationError(`${labelFromParameterName(requiredStructuredField)} is required for this model.`);
      return;
    }
    const sceneSources = generationScenes.map((scene, index) => getSceneSource(scene, index));
    if (sceneSources.some((source, index) => source === "manual" && !generationScenes[index].image)) {
      setGenerationError("Every manual scene needs a storyboard image.");
      return;
    }
    if (generationScenes.some((scene) => !scene.prompt.trim())) {
      setGenerationError("Every scene needs a prompt before generating.");
      return;
    }

    setGenerationError(null);
    setFinalVideoUrl(null);
    setPreviewView("latest");
    setContinuationInfo(null);
    setGenerationStatus("uploading");
    try {
      const uploadedImages: Array<string | undefined> = [];
      const uploadedEndImages: Array<string | undefined> = [];
      const uploadedReferenceImages: string[] = [];
      for (let index = 0; index < generationScenes.length; index += 1) {
        const scene = generationScenes[index];
        if (sceneSources[index] === "manual") {
          setNotice(generationMode === "single-image"
            ? "Uploading storyboard image…"
            : `Uploading Scene ${index + 1} of ${generationScenes.length}…`);
          const file = await fileFromSceneImage(scene.image as string, index, scene.imageFile);
          uploadedImages[index] = await uploadImageAsset(file, {
            purpose: "content",
            feature: "image-to-video",
            uploadConstraints: capabilities?.uploadConstraints,
          });
        }
        if (supportsLastImage && scene.endImage) {
          setNotice(`Uploading Scene ${index + 1} last image…`);
          const file = await fileFromSceneImage(scene.endImage, index, scene.endImageFile, "last-image");
          uploadedEndImages[index] = await uploadImageAsset(file, {
            purpose: "content",
            feature: "image-to-video",
            uploadConstraints: capabilities?.uploadConstraints,
          });
        }
      }
      if (supportsReferenceImages) {
        for (let index = 0; index < frameReferences.length; index += 1) {
          setNotice(`Uploading reference image ${index + 1} of ${frameReferences.length}…`);
          const file = await fileFromSceneImage(frameReferences[index], index, frameReferenceFiles[index] ?? null, "reference");
          uploadedReferenceImages.push(await uploadImageAsset(file, {
            purpose: "content",
            feature: "image-to-video",
            uploadConstraints: capabilities?.uploadConstraints,
          }));
        }
      }

      const scenes = generationScenes.map((scene, index) => {
        const sceneInput: VideoGenerationInput["scenes"][number] = {
          startFrameSource: sceneSources[index],
          prompt: scene.prompt.trim(),
        };
        if (sceneSources[index] === "manual" && uploadedImages[index]) sceneInput.storyboardImage = uploadedImages[index];
        if (uploadedEndImages[index] && lastImageParameter) sceneInput[lastImageParameter] = uploadedEndImages[index];
        if (uploadedReferenceImages.length > 0) sceneInput.referenceImages = uploadedReferenceImages;
        if (negativePrompt.trim()) sceneInput.negativePrompt = negativePrompt.trim();
        if (durationProperty) sceneInput.duration = scene.duration;
        if (Object.keys(scene.modelParams).length) sceneInput.modelParams = scene.modelParams;
        return sceneInput;
      });
      const request: VideoGenerationInput = {
        model: selectedModel,
        mode: generationMode === "single-image" ? "storyboard" : videoMode,
        scenes,
        idempotencyKey: `video-${crypto.randomUUID()}`,
      };
      if (durationProperty) request.duration = duration;
      if (resolutionProperty && resolution) request.resolution = resolution;
      if (aspectRatioProperty && aspectRatio) request.aspectRatio = aspectRatio;
      if (audioProperty && !audioInputMode) request.generateAudio = autoSound;
      if (audioInputMode && audioFile) {
        setNotice("Uploading audio reference…");
        request.audioUrl = await uploadPeopleMedia(audioFile, undefined, capabilities?.uploadConstraints);
      }
      if (Object.keys(modelParams).length) request.modelParams = modelParams;

      setNotice("Submitting video generation…");
      const created = await createVideoStoryboard(request);
      if (!created.storyboardId) throw new Error("Video generation did not return a storyboard ID");
      emitGenerationStarted({ feature: "image-to-video", generationId: created.storyboardId, pollUrl: created.pollUrl ?? `/api/v1/generations/video/image-to-video/${encodeURIComponent(created.storyboardId)}/status`, workspaceId: workspaceId ?? undefined, model: selectedModel, status: "queued", totalCount: created.totalScenes ?? scenes.length, completedCount: created.completedScenes ?? 0 });
      const returnedCreditCost = Number(created.totalCreditCost);
      const quotedCreditCost = Number(creditEstimate);
      // The create response may only contain the first scene for continuous
      // jobs, so prefer the full quote shown for this request.
      const acceptedCreditCost = Number.isFinite(quotedCreditCost) && quotedCreditCost > 0
        ? quotedCreditCost
        : returnedCreditCost;
      if (Number.isFinite(acceptedCreditCost) && acceptedCreditCost > 0) {
        emitCreditBalanceChanged(acceptedCreditCost);
      }
      setGenerationStatus("processing");
      setGenerationProgress({ completed: created.completedScenes ?? 0, total: created.totalScenes ?? scenes.length });
      let status = await getVideoStoryboardStatus(created.storyboardId);
      if (status.workspaceId) {
        setWorkspaceId(status.workspaceId);
        window.sessionStorage.setItem("eos.generation.workspace-id", status.workspaceId);
      }
      setContinuationInfo(status.continuation ?? created.continuation ?? null);
      while (status.status !== "completed" && status.status !== "failed" && status.status !== "cancelled") {
        setGenerationProgress({ completed: status.completedScenes ?? 0, total: status.totalScenes ?? scenes.length });
        setContinuationInfo(status.continuation ?? null);
        setNotice(generationMode === "single-image"
          ? "Generating video from storyboard image…"
          : `Generating video… ${status.completedScenes ?? 0}/${status.totalScenes ?? scenes.length} scenes complete`);
        await new Promise((resolve) => window.setTimeout(resolve, 2500));
        status = await getVideoStoryboardStatus(created.storyboardId);
      }
      setGenerationProgress({ completed: status.completedScenes ?? scenes.length, total: status.totalScenes ?? scenes.length });
      setContinuationInfo(status.continuation ?? null);
      if (status.status !== "completed") {
        requestCreditBalanceSync(acceptedCreditCost);
        throw new Error(status.status === "cancelled" ? "Video generation was cancelled" : "Video generation failed");
      }
      if (!status.finalVideoUrl) {
        requestCreditBalanceSync(acceptedCreditCost);
        throw new Error("Video generation completed without a final video URL");
      }
      setFinalVideoUrl(status.finalVideoUrl);
      setPreviewView("latest");
      setGenerationStatus("completed");
      setNotice("Video ready");
      requestCreditBalanceSync(acceptedCreditCost);
      void loadVideoHistory(status.workspaceId ?? workspaceId);
    } catch (error: unknown) {
      setGenerationStatus("failed");
      setGenerationError(error instanceof Error ? error.message : "Unable to generate video");
      setNotice(null);
    }
  };

  return (
    <div className={styles.page} data-page="gen-video">
      <div className={styles.hero}>
        <Image
          src="/generated-assets/create-video-hero-transparent-v6-eos.png"
          alt="Create video that moves"
          fill
          sizes="100vw"
        />
      </div>
      <div className={styles.workspaceCard}>
        {notice ? (
          <div className="m-3 rounded-lg border border-green-200 bg-green-50 p-3 text-xs text-green-700">
            {notice}
          </div>
        ) : null}
        <nav className={styles.tabs} aria-label="Video generation modes">
          {videoModes.map(([label, Icon]) => {
            const tab = label === "Image to Video" ? "image-to-video" : label === "Text to Video" ? "text-to-video" : label === "People Video" ? "people-video" : label === "Motion Transfer" ? "motion-transfer" : label === "Lipsync" ? "lipsync" : label === "Extend Video" ? "extend-video" : null;
            const isActive = tab === "image-to-video"
              ? activeVideoTab === "image-to-video"
              : tab === "text-to-video"
                ? activeVideoTab === "text-to-video"
                : tab === "people-video"
                  ? activeVideoTab === "people-video"
                  : tab === "motion-transfer"
                  ? activeVideoTab === "motion-transfer"
                  : tab === "lipsync"
                    ? activeVideoTab === "lipsync"
                    : tab === "extend-video"
                      ? activeVideoTab === "extend-video"
                      : false;
            return (
              <button
                key={label}
                type="button"
                className={isActive ? styles.active : undefined}
                aria-current={isActive ? "page" : undefined}
                onClick={() => {
                  if (tab) setActiveVideoTab(tab);
                }}
              >
                <Icon size={16} />
                {label}
              </button>
            );
          })}
        </nav>
        {activeVideoTab === "text-to-video" ? <TextToVideoWorkspace /> : activeVideoTab === "people-video" ? <PeopleVideoWorkspace /> : activeVideoTab === "motion-transfer" ? <MotionTransferWorkspace /> : activeVideoTab === "lipsync" ? <LipsyncWorkspace /> : activeVideoTab === "extend-video" ? <ExtendVideoWorkspace /> : <div className={styles.columns}>
          <div className={styles.leftColumn}>
            <section className={styles.panel}>
              <section
                className={styles.videoModePanel}
                aria-labelledby="video-mode-title"
              >
                <div className={styles.videoModeHeading}>
                  <h2 id="video-mode-title">GENERATION MODE</h2>
                  <Info size={11} />
                </div>
                <div className={`${styles.modelDropdown} ${styles.generationModeDropdown}`}>
                  <button
                    type="button"
                    className={styles.modelDropdownTrigger}
                    aria-haspopup="listbox"
                    aria-expanded={isGenerationModeMenuOpen}
                    onClick={() => setIsGenerationModeMenuOpen((open) => !open)}
                  >
                    <span>
                      <strong>{selectedGenerationMode.label}</strong>
                      <small>{selectedGenerationMode.description}</small>
                    </span>
                    <ChevronDown size={17} />
                  </button>
                  {isGenerationModeMenuOpen ? (
                    <div
                      className={styles.modelDropdownMenu}
                      role="listbox"
                      aria-label="Video generation mode options"
                    >
                      {generationModeOptions.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          role="option"
                          aria-selected={option.value === generationMode}
                          onClick={() => selectGenerationMode(option.value)}
                        >
                          <span>
                            <strong>{option.label}</strong>
                            <small>{option.description}</small>
                          </span>
                          {option.value === generationMode ? (
                            <span className={styles.modelCheck}>✓</span>
                          ) : null}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                {generationMode === "single-image" ? (
                  <div className={`${styles.sequenceNotice} ${styles.sequenceNoticeNative}`}>
                    <ImageIcon size={13} />
                    <span>The full storyboard image is sent as one reference with one prompt.</span>
                  </div>
                ) : null}
                {generationMode === "continuous" ? (
                  <div className={`${styles.sequenceNotice} ${hasNativeExtend ? styles.sequenceNoticeNative : styles.sequenceNoticeWarning}`}>
                    <Link2 size={13} />
                    <span>{hasNativeExtend
                      ? "Native Extend will continue scenes in order"
                      : "No Native Extend; continuation may not be seamless"}</span>
                  </div>
                ) : generationMode === "flexible" ? (
                  <div className={`${styles.sequenceNotice} ${hasNativeExtend ? styles.sequenceNoticeNative : styles.sequenceNoticeWarning}`}>
                    <Link2 size={13} />
                    <span>{hasNativeExtend
                      ? "Previous-frame scenes use Native Extend in order"
                      : "Previous-frame scenes may not continue seamlessly"}</span>
                  </div>
                ) : null}
                {continuationInfo ? (
                  <div className={styles.continuationResult}>
                    <strong>{continuationInfo.nativeExtend ? "Native Extend" : "Frame Continuation"}</strong>
                    <span>{continuationInfo.strategy ?? "Backend continuation"}</span>
                    <small>{continuationInfo.seamless === true ? "Seamless continuation" : "Continuation may use a hard cut"}</small>
                  </div>
                ) : null}
              </section>
            </section>
            <section className={styles.panel}>
              <SectionTitle number="1">PROMPT</SectionTitle>
              <label className="block text-[10px] font-bold">
                Prompt <small>(Required)</small>
                <textarea
                  value={prompt}
                  onChange={(event) => {
                    const value = event.target.value;
                    setPrompt(value);
                    setStoryboardScenes((current) => current.map((scene, index) => index === 0 ? { ...scene, prompt: value } : scene));
                  }}
                  placeholder="Describe your video"
                />
              </label>
              <span className={styles.counter}>{prompt.length} / 2000</span>
              <label className="block text-[10px] font-bold">
                Negative Prompt <small>(Optional)</small>
                <input
                  value={negativePrompt}
                  onChange={(event) => setNegativePrompt(event.target.value)}
                  placeholder="e.g. blurry, low quality, watermark"
                />
              </label>
            </section>
            <section className={styles.panel}>
              <SectionTitle number="2">{generationMode === "single-image" ? "STORYBOARD IMAGE" : "SOURCE"}</SectionTitle>
              <label className="mb-2 block text-[10px] font-bold">
                {generationMode === "single-image" ? "Storyboard Sheet" : "Start Frame"} <small>(Required)</small>
              </label>
              {sourcePreviewImage ? (
                <div className={styles.sourcePreview}>
                  <Image
                    src={sourcePreviewImage}
                    alt="Uploaded start frame"
                    fill
                    unoptimized
                    className="object-cover"
                  />
                  <div className={styles.sourceImageActions}>
                    <button type="button" onClick={() => sourceInputRef.current?.click()}>Replace</button>
                    <button type="button" onClick={clearSource}>Remove</button>
                  </div>
                </div>
              ) : (
                <label className={styles.upload}>
                  <CloudUpload size={22} />
                  <strong>{generationMode === "single-image" ? "Upload Storyboard Sheet" : "Upload Image"}</strong>
                  <small>PNG / JPG / WEBP</small>
                  <input
                    ref={sourceInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void uploadSource(file);
                      event.currentTarget.value = "";
                    }}
                  />
                </label>
              )}
              {sourcePreviewImage ? (
                <input
                  ref={sourceInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void uploadSource(file);
                    event.currentTarget.value = "";
                  }}
                />
              ) : null}
              {generationMode === "single-image" ? (
                <p className={styles.sourceModeNote}>The uploaded storyboard image is sent as one reference image with your prompt.</p>
              ) : null}
              {supportsLastImage ? (
                <div className={styles.sourceLastImage}>
                  <label className={styles.sourceLastImageLabel}>
                    Last image <small>(Optional · Scene 1)</small>
                  </label>
                  {storyboardScenes[0]?.endImage ? (
                    <div className={styles.sourcePreview}>
                      <Image
                        src={storyboardScenes[0].endImage}
                        alt="Scene 1 last image"
                        fill
                        unoptimized
                        className="object-cover"
                      />
                      <div className={styles.sourceImageActions}>
                        <button type="button" onClick={() => sourceLastImageInputRef.current?.click()}>Replace</button>
                        <button type="button" onClick={clearSourceLastImage}>Remove</button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className={styles.upload}
                      onClick={() => sourceLastImageInputRef.current?.click()}
                    >
                      <CloudUpload size={22} />
                      <strong>Upload Image</strong>
                      <small>PNG / JPG / WEBP</small>
                    </button>
                  )}
                  <input
                    ref={sourceLastImageInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void uploadSourceLastImage(file);
                      event.currentTarget.value = "";
                    }}
                  />
                </div>
              ) : null}
            </section>
          </div>
          <div className={styles.centerColumn}>
            <section className={styles.previewPanel}>
              <SectionTitle>PREVIEW</SectionTitle>
              <div className={styles.videoPreview}>
                {isGeneratingVideo ? (
                  <div className={styles.videoGeneratingPreview} aria-busy="true">
                    <WandSparkles size={26} />
                    <strong>{generationStatus === "uploading" ? "PREPARING VIDEO" : "GENERATING VIDEO"}</strong>
                    <span>{generationStatus === "uploading"
                      ? generationMode === "single-image" ? "Uploading storyboard image…" : "Uploading scene assets…"
                      : generationMode === "single-image" ? "Generating from the storyboard image…" : "Your scenes are being generated in order…"}</span>
                    <div className={styles.videoGenerationProgress}>
                      <i style={{ width: `${generationProgress.total ? Math.round((generationProgress.completed / generationProgress.total) * 100) : 12}%` }} />
                    </div>
                    <small>{generationProgress.completed}/{generationProgress.total || generationScenes.length} {generationMode === "single-image" ? "video" : "scenes"} complete</small>
                  </div>
                ) : displayedVideoUrl ? (
                  <EosVideoPlayer
                    key={displayedVideoUrl}
                    src={displayedVideoUrl}
                    className={styles.generatedVideoPlayer}
                    ariaLabel="Generated video"
                  />
                ) : (
                  <VideoPreviewPlaceholder showActions={false} />
                )}
                <div className={styles.videoPreviewOverlayActions}>
                  <button
                    type="button"
                    onClick={() => void downloadDisplayedVideo()}
                    disabled={!displayedVideoUrl}
                    aria-label="Download video"
                    title="Download video"
                  >
                    <Download size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsVideoFavorite((favorite) => !favorite)}
                    disabled={!displayedVideoUrl}
                    aria-label="Favorite video"
                    title="Favorite video"
                    className={isVideoFavorite ? styles.videoFavoriteActive : undefined}
                  >
                    <Heart size={16} fill={isVideoFavorite ? "currentColor" : "none"} />
                  </button>
                </div>
              </div>
              <div className={styles.previewViewTabs} role="tablist" aria-label="Video preview views">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={previewView === "latest"}
                      className={previewView === "latest" ? styles.previewViewTabActive : undefined}
                      onClick={() => setPreviewView("latest")}
                    >
                      Latest result
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={previewView === "library"}
                      className={previewView === "library" ? styles.previewViewTabActive : undefined}
                      onClick={() => setPreviewView("library")}
                    >
                      Video library
                    </button>
              </div>
              <div className={styles.videoGalleryGrid}>
                  <div className={styles.videoGalleryColumn}>
                    <div className={styles.videoGalleryHeading}>
                      <h3>CURRENT VIDEO</h3>
                    </div>
                    <div className={styles.videoCurrentGallery}>
                      {latestVideoUrl ? (
                        <button
                          type="button"
                          className={styles.videoCurrentCard}
                          onClick={() => setPreviewView("latest")}
                          aria-label="Show latest generated video"
                          aria-pressed={previewView === "latest"}
                        >
                          <span className={styles.videoGalleryThumb}>
                            <video src={latestVideoUrl} muted playsInline preload="metadata" controls={false} disablePictureInPicture disableRemotePlayback tabIndex={-1} aria-hidden="true" />
                            <span className={styles.videoGalleryPlay}><Play size={14} fill="currentColor" /></span>
                          </span>
                          <span className={styles.videoGalleryStatus}>Latest generated video</span>
                        </button>
                      ) : (
                        <div className={styles.videoGalleryEmpty}>Latest generated video will appear here.</div>
                      )}
                    </div>
                  </div>
                  <div className={`${styles.videoGalleryColumn} ${styles.videoRecentColumn}`}>
                    <div className={styles.videoGalleryHeading}>
                      <h3>RECENT VIDEOS</h3>
                      <button
                        type="button"
                        onClick={() => {
                          setPreviewView("library");
                          void loadVideoHistory(workspaceId);
                        }}
                      >
                        View history
                      </button>
                    </div>
                    <div className={styles.videoRecentGallery}>
                      <div className={styles.videoRecentRow} ref={videoRecentRowRef}>
                        {videoHistoryLoading && videoHistory.length === 0 ? (
                          <div className={styles.videoGalleryEmpty}>Loading video history…</div>
                        ) : videoHistoryError ? (
                          <div className={`${styles.videoGalleryEmpty} ${styles.videoGalleryError}`} role="alert">
                            {videoHistoryError}
                          </div>
                        ) : videoHistory.length > 0 ? (
                          videoHistory.map((item, itemIndex) => {
                            const selected = previewView === "library"
                              ? safeVideoLibraryIndex === itemIndex
                              : finalVideoUrl === item.finalVideoUrl;
                            return (
                              <button
                                key={item.storyboardId}
                                type="button"
                                className={`${styles.videoRecentCard} ${selected ? styles.videoRecentCardSelected : ""}`}
                                onClick={() => {
                                  setVideoLibraryIndex(itemIndex);
                                  setPreviewView("library");
                                }}
                                aria-label={`Open generated video from ${formatHistoryDate(item.createdAt)}`}
                                aria-pressed={selected}
                              >
                                <span className={styles.videoGalleryThumb}>
                                  <video src={item.finalVideoUrl} muted playsInline preload="metadata" controls={false} disablePictureInPicture disableRemotePlayback tabIndex={-1} aria-hidden="true" />
                                  <span className={styles.videoGalleryPlay}><Play size={13} fill="currentColor" /></span>
                                </span>
                              </button>
                            );
                          })
                        ) : (
                          <div className={styles.videoGalleryEmpty}>No generated videos yet.</div>
                        )}
                      </div>
                      {videoHistory.length > 3 ? (
                        <>
                          {videoRecentScrollState.canScrollLeft ? (
                            <button
                              type="button"
                              className={styles.videoGalleryPrev}
                              onClick={() => videoRecentRowRef.current?.scrollBy({ left: -290, behavior: "smooth" })}
                              aria-label="Previous recent videos"
                            >
                              <ChevronLeft size={18} />
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className={styles.videoGalleryNext}
                            onClick={() => videoRecentRowRef.current?.scrollBy({ left: 290, behavior: "smooth" })}
                            aria-label="Next recent videos"
                            disabled={!videoRecentScrollState.canScrollRight}
                          >
                            <ChevronRight size={18} />
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>
              </div>
            </section>
            <section className={styles.stripSection}>
              <div className={styles.subheading}>
                SHOT / FRAME REFERENCES <small>{supportsReferenceImages ? "(Optional · shared across scenes)" : "(Not supported by this model)"}</small>
              </div>
              {supportsReferenceImages ? (
                <div className={styles.thumbRow}>
                  <button
                    type="button"
                    className={styles.addFrame}
                    onClick={() => frameInputRef.current?.click()}
                  >
                    <Plus size={16} /> Add Frame
                  </button>
                  <input
                    ref={frameInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void addFrame(file);
                      event.currentTarget.value = "";
                    }}
                  />
                  {frameReferences.map((src, index) => (
                    <div className={styles.thumb} key={src}>
                      <Image
                        src={src}
                        alt={`Reference ${index + 1}`}
                        width={92}
                        height={62}
                        unoptimized
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <p className={styles.referenceHint}>Reference images are hidden because the selected model does not expose a reference-image input.</p>
              )}
            </section>
            {generationMode !== "single-image" ? <section className={styles.stripSection}>
              <div className={styles.subheading}>
                STORYBOARD <small>(Optional)</small>
              </div>
              <div className={styles.sceneScroller}>
                <div ref={sceneRowRef} className={styles.sceneRow}>
                  {storyboardScenes.map((scene, index) => {
                    const source = getSceneSource(scene, index);
                    const nextSource =
                      index < storyboardScenes.length - 1
                        ? getSceneSource(storyboardScenes[index + 1], index + 1)
                        : null;
                    return (
                      <div className={styles.sceneFlowItem} key={scene.id}>
                        <article
                          className={`${styles.scene} ${index === 0 ? styles.selected : ""}`}
                        >
                          <div className={styles.sceneCardHeader}>
                            <span>Scene {index + 1}</span>
                            <div className={styles.sceneCardMeta}>
                              {durationProperty ? <small>{scene.duration}s</small> : null}
                              <button
                                type="button"
                                className={styles.sceneEdit}
                                aria-label={`Edit Scene ${index + 1}`}
                                title={`Edit Scene ${index + 1}`}
                                onClick={() => openEditSceneModal(index)}
                              >
                                <Pencil size={10} />
                              </button>
                              {index > 0 ? (
                                <button
                                  type="button"
                                  className={styles.sceneDelete}
                                  aria-label={`Delete Scene ${index + 1}`}
                                  title={`Delete Scene ${index + 1}`}
                                  onClick={() => deleteScene(index)}
                                >
                                  <Trash2 size={10} />
                                </button>
                              ) : null}
                            </div>
                          </div>
                          {source === "manual" && scene.image ? (
                            <Image
                              src={scene.image}
                              alt={`Scene ${index + 1}`}
                              width={112}
                              height={58}
                              unoptimized
                              className="h-[58px] w-full object-cover"
                            />
                          ) : source === "manual" ? (
                            <div className={styles.missingFrame}>
                              <CloudUpload size={15} />
                              <span>Upload image</span>
                            </div>
                          ) : (
                            <div className={styles.previousFrame}>
                              <Link2 size={16} />
                              <span>Previous last frame</span>
                            </div>
                          )}
                          <div className={styles.sceneCardFooter}>
                            {index > 0 && videoMode === "flexible" ? (
                              <div className={styles.sceneSourceDropdown}>
                                <button
                                  ref={(element) => {
                                    sceneSourceButtonRefs.current[index] =
                                      element;
                                  }}
                                  type="button"
                                  className={styles.sceneSourceTrigger}
                                  aria-haspopup="listbox"
                                  aria-expanded={openSceneSourceMenu === index}
                                  onClick={() => toggleSceneSourceMenu(index)}
                                >
                                  <span>
                                    {sceneSourceOptions.find(
                                      (option) =>
                                        option.value === scene.startFrameSource,
                                    )?.label ?? "New image"}
                                  </span>
                                  <ChevronDown size={13} />
                                </button>
                              </div>
                            ) : (
                              <em className={styles.sceneAutoNote}>
                                {index > 0 && videoMode === "continuous"
                                  ? "Auto from previous"
                                  : "Start frame"}
                              </em>
                            )}
                          </div>
                        </article>
                        {nextSource === "previous_last_frame" ? (
                          <div
                            className={styles.sceneConnector}
                            aria-label={`Scene ${index + 2} continues from Scene ${index + 1}`}
                          >
                            <Link2 size={14} />
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                  <button
                    type="button"
                    className={styles.addScene}
                    onClick={openSceneModal}
                    disabled={!canAddScene}
                    title={canAddScene ? "Add another scene" : "Complete Scene 1 with a start image and prompt first"}
                  >
                    <Plus size={16} /> Add Scene
                  </button>
                </div>
                {!canAddScene ? <p className={styles.sceneRequirement}>Complete Scene 1 with a start image and prompt before adding another scene.</p> : null}
                {sceneScrollState.canScrollLeft ||
                sceneScrollState.canScrollRight ? (
                  <>
                    <button
                      type="button"
                      className={styles.scenePrev}
                      onClick={() => scrollScenes("left")}
                      aria-label="Scroll storyboard scenes left"
                      disabled={!sceneScrollState.canScrollLeft}
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <button
                      type="button"
                      className={styles.sceneNext}
                      onClick={() => scrollScenes("right")}
                      aria-label="Scroll storyboard scenes"
                      aria-disabled={!sceneScrollState.canScrollRight}
                    >
                      <ChevronRight size={20} />
                    </button>
                  </>
                ) : null}
              </div>
              {openSceneSourceMenu !== null && sceneSourceMenuPosition ? (
                <div
                  className={styles.sceneSourceMenu}
                  role="listbox"
                  aria-label={`Start frame source for Scene ${openSceneSourceMenu + 1}`}
                  style={{
                    top: sceneSourceMenuPosition.top,
                    left: sceneSourceMenuPosition.left,
                    width: sceneSourceMenuPosition.width,
                  }}
                >
                  {sceneSourceOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      role="option"
                      aria-selected={
                        storyboardScenes[openSceneSourceMenu]
                          ?.startFrameSource === option.value
                      }
                      onClick={() => {
                        updateSceneSource(openSceneSourceMenu, option.value);
                        setOpenSceneSourceMenu(null);
                        setSceneSourceMenuPosition(null);
                      }}
                    >
                      <span>{option.label}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </section> : null}
          </div>
          <aside className={styles.settings}>
            <SectionTitle number="3">SETTINGS</SectionTitle>
            <label className="mb-2 flex items-center gap-1 text-[10px] font-bold">
              Model <Info size={11} />
            </label>
            <div className={styles.modelDropdown}>
              <button
                type="button"
                className={styles.modelDropdownTrigger}
                aria-haspopup="listbox"
                aria-expanded={isModelMenuOpen}
                disabled={modelsLoading || models.length === 0}
                onClick={() => setIsModelMenuOpen((open) => !open)}
              >
                <span>
                  <strong>
                    {modelsLoading
                      ? "Loading video models…"
                      : selectedModelOption?.displayName ?? "No compatible model"}
                  </strong>
                  <span className={styles.modelProviderRow}>
                    {selectedModelOption ? <b className={`${styles.modelTierBadge} ${styles[modelTierClass(modelTier(selectedModelOption, Math.max(0, models.findIndex((item) => item.model === selectedModel))))]}`}>{modelTier(selectedModelOption, Math.max(0, models.findIndex((item) => item.model === selectedModel)))}</b> : null}
                    {!modelsLoading && selectedModelOption ? (
                      <b className={`${styles.modelCapabilityBadge} ${nativeExtendModel ? styles.modelCapabilityBadgeNative : styles.modelCapabilityBadgeContinuation}`}>
                        {nativeExtendModel ? "Native Extend" : "Frame Continuation"}
                      </b>
                    ) : null}
                  </span>
                </span>
                <ChevronDown size={17} />
              </button>
              {isModelMenuOpen ? (
                <div
                  className={styles.modelDropdownMenu}
                  role="listbox"
                  aria-label="Video model options"
                >
                  {models.map((option) => {
                    const optionHasNativeExtend = extendModels.some((model) => modelFamily(model.model) === modelFamily(option.model));
                    return (
                      <button
                        key={option.model}
                        type="button"
                        role="option"
                        aria-selected={option.model === selectedModel}
                        onClick={() => {
                          const optionReferenceParameter = findModelInputParameter(
                            option,
                            option.capabilities.referenceImagesParameter,
                            referenceImageParameterAliases,
                          );
                          if (!optionReferenceParameter) clearFrameReferences();
                          setSelectedModel(option.model);
                          setIsModelMenuOpen(false);
                        }}
                      >
                        <span>
                          <strong>{option.displayName}</strong>
                          <span className={styles.modelProviderRow}>
                            <b className={`${styles.modelTierBadge} ${styles[modelTierClass(modelTier(option, models.indexOf(option)))]}`}>{modelTier(option, models.indexOf(option))}</b>
                            <b className={`${styles.modelCapabilityBadge} ${optionHasNativeExtend ? styles.modelCapabilityBadgeNative : styles.modelCapabilityBadgeContinuation}`}>
                              {optionHasNativeExtend ? "Native Extend" : "Frame Continuation"}
                            </b>
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
            {modelsError ? <p className={styles.settingsError}>{modelsError}</p> : null}
            {durationProperty ? (
              <DurationControl
                property={durationProperty[1]}
                value={duration}
                required={requiredProperties.has(durationProperty[0])}
                onChange={updateDuration}
              />
            ) : null}
            {resolutionProperty ? (
              <div className={styles.settingBlock}>
                <div className={styles.settingLabel}>{resolutionProperty[1].title ?? "Resolution"} <Info size={11} /></div>
                <select
                  className={styles.dynamicSelect}
                  value={resolution}
                  onChange={(event) => setResolution(event.target.value)}
                  aria-required={requiredProperties.has(resolutionProperty[0])}
                >
                  <option value="" disabled>Select resolution</option>
                  {(resolutionProperty[1].enum ?? []).map((value) => (
                    <option key={String(value)} value={String(value)}>{String(value)}</option>
                  ))}
                </select>
              </div>
            ) : null}
            {aspectRatioProperty ? (
              <div className={styles.settingBlock}>
                <div className={styles.settingLabel}>{aspectRatioProperty[1].title ?? "Aspect Ratio"} <Info size={11} /></div>
                <div className={styles.ratios}>
                  {(aspectRatioProperty[1].enum ?? []).map((value) => {
                    const ratio = String(value);
                    return (
                      <button
                        type="button"
                        className={aspectRatio === ratio ? styles.ratioSelected : ""}
                        onClick={() => setAspectRatio(ratio)}
                        key={ratio}
                      >
                        <i className={ratio === "1:1" ? styles.square : styles.landscape} />
                        {ratio}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
            {audioProperty && !audioInputMode ? (
              <div className={styles.toggleRow}>
                {audioProperty[1].title ?? "Audio"}{" "}
                <button
                  type="button"
                  className={styles.toggle}
                  aria-pressed={autoSound}
                  onClick={() => setAutoSound((value) => !value)}
                >
                  <i />
                </button>
              </div>
            ) : null}
            {audioInputMode ? (
              <div className={styles.audioReferenceField}>
                <div className={styles.settingLabel}><span>Audio Reference</span><small>Optional</small></div>
                {audioFile ? <div className={styles.peopleNotice}><Mic2 size={13} /> {audioFile.name}<button type="button" onClick={() => setAudioFile(null)} aria-label="Remove audio"><X size={13} /></button></div> : <button type="button" className={styles.upload} onClick={() => audioInputRef.current?.click()}><CloudUpload size={18} /><strong>Upload audio reference</strong><small>MP3 / WAV / M4A</small></button>}
                <input ref={audioInputRef} type="file" accept="audio/mpeg,audio/wav,audio/x-wav,audio/mp4" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleAudioFile(file); event.currentTarget.value = ""; }} />
              </div>
            ) : null}
            {modelParameterEntries.map(([name, property]) => {
              const value = modelParams[name];
              const isRequired = requiredProperties.has(name);
              const label = property.title ?? labelFromParameterName(name);
              if (property.enum?.length) {
                return (
                  <label className={styles.dynamicField} key={name}>
                    <span>{label}{isRequired ? <b>*</b> : null}</span>
                    <select
                      className={styles.dynamicSelect}
                      value={value === undefined ? "" : String(value)}
                      onChange={(event) => updateModelParam(name, event.target.value)}
                      aria-required={isRequired}
                    >
                      {!isRequired ? <option value="">Select {label.toLowerCase()}</option> : null}
                      {property.enum.map((option) => <option key={String(option)} value={String(option)}>{String(option)}</option>)}
                    </select>
                    {property.description ? <small>{property.description}</small> : null}
                  </label>
                );
              }
              if (property.type === "boolean") {
                return (
                  <div className={styles.toggleRow} key={name}>
                    {label}{isRequired ? <b>*</b> : null}
                    <button
                      type="button"
                      className={styles.toggle}
                      aria-pressed={Boolean(value)}
                      onClick={() => updateModelParam(name, !Boolean(value))}
                    ><i /></button>
                  </div>
                );
              }
              if (property.type === "array") {
                return (
                  <label className={styles.dynamicField} key={name}>
                    <span>{label}{isRequired ? <b>*</b> : null}</span>
                    <input
                      className={styles.dynamicInput}
                      value={Array.isArray(value) ? value.join(", ") : ""}
                      placeholder="Add values separated by commas"
                      onChange={(event) => updateModelParam(name, event.target.value.split(",").map((item) => item.trim()).filter(Boolean))}
                      aria-required={isRequired}
                    />
                  </label>
                );
              }
              if (property.type === "integer" || property.type === "number") {
                return (
                  <label className={styles.dynamicField} key={name}>
                    <span>{label}{isRequired ? <b>*</b> : null}</span>
                    <input
                      className={styles.dynamicInput}
                      type="number"
                      min={property.minimum}
                      max={property.maximum}
                      step={property.step ?? (property.type === "integer" ? 1 : 0.01)}
                      value={value === undefined ? "" : String(value)}
                      onChange={(event) => updateModelParam(name, event.target.value === "" ? undefined : Number(event.target.value))}
                      aria-required={isRequired}
                    />
                  </label>
                );
              }
              return (
                <label className={styles.dynamicField} key={name}>
                  <span>{label}{isRequired ? <b>*</b> : null}</span>
                  <input
                    className={styles.dynamicInput}
                    type="text"
                    value={value === undefined ? "" : String(value)}
                    onChange={(event) => updateModelParam(name, event.target.value)}
                    aria-required={isRequired}
                  />
                </label>
              );
            })}
            <div className={styles.estimate} title={creditEstimateError ?? undefined}>
              <div>
                ESTIMATED CREDITS <Info size={11} />
              </div>
              <span>{estimateDescription}<strong>{creditEstimateLoading || creditEstimate === null ? formattedCreditEstimate : `= ${formattedCreditEstimate}`}</strong></span>
            </div>
            <button
              type="button"
              className={styles.generate}
              onClick={handleGenerate}
              disabled={modelsLoading || !selectedModel || generationStatus === "uploading" || generationStatus === "processing"}
            >
              <WandSparkles size={18} /> {generationStatus === "uploading" || generationStatus === "processing" ? "GENERATING…" : "GENERATE VIDEO"}
            </button>
            {generationProgress.total > 0 && (generationStatus === "uploading" || generationStatus === "processing" || generationStatus === "completed") ? (
              <p className={styles.generationProgress}>{generationProgress.completed}/{generationProgress.total} {generationMode === "single-image" ? "video" : "scenes"} complete</p>
            ) : null}
            {generationError ? <p className={styles.settingsError} role="alert">{generationError}</p> : null}
            <p className={styles.privateNote}>
              ใช้เวลาโดยประมาณ 1–3 นาที <Info size={10} />
            </p>
          </aside>
          <section className={styles.tutorials}>
            <div className={styles.tutorialTitle}>
              <h2>
                TUTORIAL &amp; IDEAS
                <span className={styles.annotation} aria-hidden="true" />
              </h2>
              <a href="#tutorials">View all tutorials →</a>
            </div>
            <div className={styles.tutorialRow}>
              {tutorials.map((item, index) => (
                <button type="button" key={item.title}>
                  <Image
                    src={tutorialImages[index] ?? tutorialImages[0]}
                    alt=""
                    width={130}
                    height={55}
                    className="h-[55px] w-full object-cover"
                  />
                  <b>{item.title}</b>
                  {item.subtitle ? <small>{item.subtitle}</small> : null}
                  <time>{item.duration}</time>
                </button>
              ))}
              <button type="button" className={styles.inspirationCard}>
                <b>NEED INSPIRATION?</b>
                <span>Explore Templates</span>
                <i>→</i>
              </button>
            </div>
          </section>
        </div>}
      </div>
      {isSceneModalOpen ? (
        <div
          className={styles.sceneModalBackdrop}
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeSceneModal();
          }}
        >
          <div
            className={styles.sceneModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="scene-modal-title"
          >
            <div className={styles.sceneModalHeader}>
              <div>
                <h2 id="scene-modal-title">{editingSceneIndex === null ? "Add Scene" : `Edit Scene ${editingSceneIndex + 1}`}</h2>
                <p>
                  {videoMode === "continuous"
                    ? "Describe the motion. The previous scene's last frame is used automatically."
                    : videoMode === "flexible"
                      ? "Choose how this scene starts, then describe the motion."
                      : "Upload a storyboard image and describe the motion."}
                </p>
              </div>
              <button
                type="button"
                className={styles.sceneModalClose}
                onClick={closeSceneModal}
                aria-label={editingSceneIndex === null ? "Close add scene dialog" : "Close edit scene dialog"}
              >
                <X size={18} />
              </button>
            </div>
            <div className={`${styles.sceneModalMode} ${styles[`sceneModalMode${selectedVideoMode.label}`]}`}>
              <strong>{selectedVideoMode.label} mode</strong>
              <span>
                {videoMode === "storyboard"
                  ? "This scene starts from its own image."
                  : videoMode === "continuous"
                    ? "This scene starts from the previous scene's last frame."
                    : "Choose whether this scene starts with a new image or the previous frame."}
              </span>
            </div>
            {sceneError ? (
              <div className={styles.sceneModalError}>{sceneError}</div>
            ) : null}
            <div className={styles.sceneModalUpload}>
              {sceneStartFrameSource === "manual" && sceneImage ? (
                <div className={styles.sceneModalImagePreview}>
                  <Image
                    src={sceneImage}
                    alt="New scene"
                    fill
                    unoptimized
                    className="object-cover"
                    onError={clearSceneModalImage}
                  />
                  <div className={styles.sceneModalImageActions}>
                    <button
                      type="button"
                      onClick={() => sceneInputRef.current?.click()}
                    >
                      Replace
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        clearSceneModalImage();
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : sceneStartFrameSource === "previous_last_frame" ? (
                <div className={styles.sceneModalPreviousFrame}>
                  <Link2 size={22} />
                  <strong>Previous scene frame</strong>
                  <small>This scene continues automatically</small>
                </div>
              ) : (
                <button
                  type="button"
                  className={styles.sceneModalUploadButton}
                  onClick={() => sceneInputRef.current?.click()}
                >
                  <CloudUpload size={24} />
                  <strong>Upload scene image</strong>
                  <small>PNG / JPG / WEBP</small>
                </button>
              )}
              <input
                ref={sceneInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void handleSceneImageFile(file);
                  event.currentTarget.value = "";
                }}
              />
            </div>
            {videoMode === "flexible" ? (
              <div className={styles.sceneModalSourceField}>
                <div className={styles.sceneModalSourceHeader}>
                  <span>Start frame</span>
                  <small>Choose how this scene begins</small>
                </div>
                <div className={styles.sceneModalSourceOptions}>
                  <button
                    type="button"
                    className={
                      sceneStartFrameSource === "manual"
                        ? styles.sceneModalSourceSelected
                        : undefined
                    }
                    onClick={() => {
                      setSceneStartFrameSource("manual");
                      setSceneError(null);
                    }}
                  >
                    <strong>New image</strong>
                    <small>Upload a new start frame</small>
                  </button>
                  <button
                    type="button"
                    className={
                      sceneStartFrameSource === "previous_last_frame"
                        ? styles.sceneModalSourceSelected
                        : undefined
                    }
                    onClick={() => {
                      setSceneStartFrameSource("previous_last_frame");
                      clearSceneModalImage();
                      setSceneError(null);
                    }}
                  >
                    <strong>Previous frame</strong>
                    <small>Continue from the scene before</small>
                  </button>
                </div>
              </div>
            ) : null}
            {videoMode === "continuous" ? (
              <div className={styles.sceneModalPreviousNote}>
                <Link2 size={13} /> This scene will use the previous
                scene&apos;s last frame.
              </div>
            ) : null}
            {supportsLastImage ? (
              <div className={styles.sceneModalSourceField}>
                <div className={styles.sceneModalSourceHeader}>
                  <span>Last image <small>(Optional)</small></span>
                  <small>{lastImageParameter ? labelFromParameterName(lastImageParameter) : "Model-supported"}</small>
                </div>
                <div className={`${styles.sceneModalUpload} ${styles.sceneModalLastImageUpload}`}>
                  {sceneEndImage ? (
                    <div className={styles.sceneModalImagePreview}>
                      <Image
                        src={sceneEndImage}
                        alt="Last image"
                        fill
                        unoptimized
                        className="object-cover"
                        onError={clearSceneEndImage}
                      />
                      <div className={styles.sceneModalImageActions}>
                        <button type="button" onClick={() => sceneEndInputRef.current?.click()}>Replace</button>
                        <button type="button" onClick={clearSceneEndImage}>Remove</button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className={styles.sceneModalUploadButton}
                      onClick={() => sceneEndInputRef.current?.click()}
                    >
                      <CloudUpload size={22} />
                      <strong>Upload Image</strong>
                      <small>PNG / JPG / WEBP</small>
                    </button>
                  )}
                  <input
                    ref={sceneEndInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void handleSceneImageFile(file, true);
                      event.currentTarget.value = "";
                    }}
                  />
                </div>
              </div>
            ) : null}
            <label className={styles.sceneModalField}>
              <span className={styles.sceneModalFieldHeader}>
                <span>
                  Prompt <b>*</b>
                </span>
                <small>{scenePrompt.length} / 2000</small>
              </span>
              <textarea
                value={scenePrompt}
                onChange={(event) => setScenePrompt(event.target.value)}
                placeholder="Camera slowly moves forward"
                maxLength={2000}
              />
            </label>
            {durationProperty ? (
              <DurationControl
                property={durationProperty[1]}
                value={sceneDuration}
                required={requiredProperties.has(durationProperty[0])}
                onChange={setSceneDuration}
                variant="scene"
              />
            ) : null}
            {modelParameterEntries.length ? (
              <div className={styles.sceneModelParams}>
                <div className={styles.sceneModelParamsTitle}>MODEL PARAMETERS</div>
                {modelParameterEntries.map(([name, property]) => {
                  const value = sceneModelParams[name];
                  const isRequired = requiredProperties.has(name);
                  const label = property.title ?? labelFromParameterName(name);
                  if (property.enum?.length) {
                    return (
                      <label className={styles.dynamicField} key={name}>
                        <span>{label}{isRequired ? <b>*</b> : null}</span>
                        <select
                          className={styles.dynamicSelect}
                          value={value === undefined ? "" : String(value)}
                          onChange={(event) => setSceneModelParams((current) => ({ ...current, [name]: event.target.value }))}
                          aria-required={isRequired}
                        >
                          {!isRequired ? <option value="">Select {label.toLowerCase()}</option> : null}
                          {property.enum.map((option) => <option key={String(option)} value={String(option)}>{String(option)}</option>)}
                        </select>
                      </label>
                    );
                  }
                  if (property.type === "boolean") {
                    return (
                      <div className={styles.toggleRow} key={name}>
                        {label}{isRequired ? <b>*</b> : null}
                        <button
                          type="button"
                          className={styles.toggle}
                          aria-pressed={Boolean(value)}
                          onClick={() => setSceneModelParams((current) => ({ ...current, [name]: !Boolean(value) }))}
                        ><i /></button>
                      </div>
                    );
                  }
                  if (property.type === "array") {
                    return (
                      <label className={styles.dynamicField} key={name}>
                        <span>{label}{isRequired ? <b>*</b> : null}</span>
                        <input
                          className={styles.dynamicInput}
                          value={Array.isArray(value) ? value.join(", ") : ""}
                          placeholder="Add values separated by commas"
                          onChange={(event) => setSceneModelParams((current) => ({ ...current, [name]: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) }))}
                          aria-required={isRequired}
                        />
                      </label>
                    );
                  }
                  if (property.type === "integer" || property.type === "number") {
                    return (
                      <label className={styles.dynamicField} key={name}>
                        <span>{label}{isRequired ? <b>*</b> : null}</span>
                        <input
                          className={styles.dynamicInput}
                          type="number"
                          min={property.minimum}
                          max={property.maximum}
                          step={property.step ?? (property.type === "integer" ? 1 : 0.01)}
                          value={value === undefined ? "" : String(value)}
                          onChange={(event) => setSceneModelParams((current) => ({ ...current, [name]: event.target.value === "" ? undefined : Number(event.target.value) }))}
                          aria-required={isRequired}
                        />
                      </label>
                    );
                  }
                  return (
                    <label className={styles.dynamicField} key={name}>
                      <span>{label}{isRequired ? <b>*</b> : null}</span>
                      <input
                        className={styles.dynamicInput}
                        type="text"
                        value={value === undefined ? "" : String(value)}
                        onChange={(event) => setSceneModelParams((current) => ({ ...current, [name]: event.target.value }))}
                        aria-required={isRequired}
                      />
                    </label>
                  );
                })}
              </div>
            ) : null}
            <div className={styles.sceneModalActions}>
              <button
                type="button"
                className={styles.sceneModalCancel}
                onClick={closeSceneModal}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.sceneModalSave}
                onClick={saveScene}
                disabled={!canSaveScene}
              >
                {editingSceneIndex === null ? "Save Scene" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {deleteSceneIndex !== null ? (
        <div
          className={styles.confirmModalBackdrop}
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeDeleteSceneDialog();
          }}
        >
          <div
            className={styles.confirmModal}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-scene-title"
            aria-describedby="delete-scene-description"
          >
            <div className={styles.confirmModalIcon} aria-hidden="true">
              <AlertTriangle size={20} />
            </div>
            <div className={styles.confirmModalCopy}>
              <h2 id="delete-scene-title">Delete Scene {deleteSceneIndex + 1}?</h2>
              <p id="delete-scene-description">
                This scene and its uploaded images will be removed from the storyboard.
              </p>
            </div>
            <div className={styles.confirmModalActions}>
              <button
                type="button"
                className={styles.confirmModalCancel}
                onClick={closeDeleteSceneDialog}
                autoFocus
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.confirmModalDelete}
                onClick={confirmDeleteScene}
              >
                Delete Scene
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
