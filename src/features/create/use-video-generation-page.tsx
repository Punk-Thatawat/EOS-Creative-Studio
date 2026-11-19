import { useTemplateSettings } from "@/features/templates/use-template-settings";
import { useTemplatePrompt } from "@/features/templates/use-template-prompt";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type DragEvent, type ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import { listGenerationModels, type GenerationModelOption } from "@/lib/api/generation-models";
import { useModelCatalogRefresh } from "@/lib/use-model-catalog-refresh";
import { uploadImageAsset } from "@/lib/api/storage";
import { emitCreditBalanceChanged, requestCreditBalanceSync } from "@/lib/credits/credit-events";
import {
  createVideoStoryboard,
  getVideoStoryboardSettings,
  getVideoStoryboardStatus,
  listVideoStoryboardHistory,
  quoteVideoStoryboard,
  type VideoStoryboardHistoryItem,
  type VideoGenerationInput,
} from "@/lib/api/video-generations";
import { uploadPeopleMedia } from "@/lib/api/people-video-generations";
import { validateMediaFile } from "@/lib/media/upload-validation";
import { translateVideoSchemaLabel } from "./video-schema-copy";
import {
  emitGenerationRequestFailed,
  emitGenerationStarted,
  emitGenerationSubmitting,
  GENERATION_COMPLETED_EVENT,
} from "@/lib/generation-progress-events";
import { AUTH_SESSION_UPDATED_EVENT } from "@/lib/auth/auth-events";
import { getGenerationProgressStorageKey } from "@/lib/generation-progress-storage";
import { listGenerationHistory } from "@/lib/api/generations";
import { formatGenerationError, generationErrorFromStatus } from "@/lib/api/generation-errors";
import { useLocale } from "@/lib/i18n/locale-provider";
import {
  type ActiveVideoTab,
  type GenerationMode,
  type ReferenceImageRole,
  type ReferenceImageSlot,
  type StartFrameSource,
  type StoryboardScene,
  type StoryboardSlice,
  type VideoGenerationStatus,
} from "./video-generation.types";
import {
  DEFAULT_MAX_STORYBOARD_SCENES,
  HARD_MAX_STORYBOARD_SCENES,
  VIDEO_TAB_STORAGE_KEY,
  coreModelParameterNames,
  lastImageParameterAliases,
  referenceAudioParameterAliases,
  referenceImageParameterAliases,
  referenceImageRoles,
  referenceVideoParameterAliases,
  videoModeOptions,
} from "./video-generation.constants";
import {
  isActiveVideoTab,
  isSingleSceneGenerationMode,
  isStorylinePromptMode,
  videoModeRouteFeature,
} from "./video-mode-helpers";
import {
  closestAspectRatio,
  findModelInputParameter,
  findSchemaProperty,
  hasSchemaValue,
  isCameraFixedParameter,
  isSeedParameter,
  modelAspectRatioOptions,
  modelFamily,
  modelParamsForGeneration,
  modelSpecificDefaults,
  readImageAspectRatio,
  requiredSchemaParameters,
  schemaDefault,
  schemaProperties,
} from "./video-schema-helpers";
import { splitStoryboardSheet } from "./storyboard-split";
import styles from "./video-generation-page.module.css";

export function useVideoGenerationPage() {
  const { locale, t } = useLocale();
  const modelCatalogVersion = useModelCatalogRefresh();
  const localizedParameterLabel = (name: string, title?: string) => translateVideoSchemaLabel(name, title, t);
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedInitialTab = searchParams.get("tab");
  const initialVideoTab: ActiveVideoTab = requestedInitialTab === "lipsync"
    ? "people-video"
    : isActiveVideoTab(requestedInitialTab) ? requestedInitialTab : "image-to-video";
  const initialPeopleVideoVariant = "lipsync" as const;
  const [activeVideoTab, setActiveVideoTab] = useState<ActiveVideoTab>(() => initialVideoTab);
  const [visitedVideoTabs, setVisitedVideoTabs] = useState<Set<ActiveVideoTab>>(() => new Set([initialVideoTab]));
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [storyboardSlices, setStoryboardSlices] = useState<StoryboardSlice[]>([]);
  const [storyboardSlicesSourceFile, setStoryboardSlicesSourceFile] = useState<File | null>(null);
  const [storyboardSheetFile, setStoryboardSheetFile] = useState<File | null>(null);
  const [storyboardGridLabel, setStoryboardGridLabel] = useState<string | null>(null);
  const [storyboardQualityNote, setStoryboardQualityNote] = useState<string | null>(null);
  const [storyboardSplitting, setStoryboardSplitting] = useState(false);
  const [prompt, setPrompt] = useState("");
  useTemplatePrompt("video", setPrompt);
  const [promptOptimizerEnabled, setPromptOptimizerEnabled] = useState(false);
  const [negativePrompt, setNegativePrompt] = useState("");
  const [duration, setDuration] = useState(5);
  const [resolution, setResolution] = useState("");
  const [aspectRatio, setAspectRatio] = useState("");
  const [autoSound, setAutoSound] = useState(false);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [postAudioSfxEnabled, setPostAudioSfxEnabled] = useState(false);
  const [postAudioMusicEnabled, setPostAudioMusicEnabled] = useState(false);
  const [generationMode, setGenerationMode] = useState<GenerationMode>("image-to-video");
  const [videoMode, setVideoMode] =
    useState<(typeof videoModeOptions)[number]["value"]>("storyboard");
  const [models, setModels] = useState<GenerationModelOption[]>([]);
  const [extendModels, setExtendModels] = useState<GenerationModelOption[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [modelsLoading, setModelsLoading] = useState(true);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [modelLoadRetry, setModelLoadRetry] = useState(0);
  const [maxStoryboardScenes, setMaxStoryboardScenes] = useState(DEFAULT_MAX_STORYBOARD_SCENES);
  const [modelParams, setModelParams] = useState<Record<string, unknown>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [generationStatus, setGenerationStatus] = useState<VideoGenerationStatus>("idle");
  const generationStatusRef = useRef(generationStatus);
  const [generationProgress, setGenerationProgress] = useState({ completed: 0, total: 0 });
  const [isFinalizingVideo, setIsFinalizingVideo] = useState(false);
  const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null);
  const [previewMediaAspectRatioState, setPreviewMediaAspectRatioState] = useState<{
    mediaKey: string | null;
    ratio: string | null;
  }>({ mediaKey: null, ratio: null });
  const [latestCompletedStoryboardId, setLatestCompletedStoryboardId] = useState<string | null>(null);
  const [previewView, setPreviewView] = useState<"latest" | "library" | "model">("latest");
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
  const [referenceImageSlots, setReferenceImageSlots] = useState<Partial<Record<ReferenceImageRole, ReferenceImageSlot>>>({});
  const [detectedImageAspectRatio, setDetectedImageAspectRatio] = useState<number | null>(null);
  const [storyboardHasMixedAspectRatios, setStoryboardHasMixedAspectRatios] = useState(false);
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
  const [activeSceneIndex, setActiveSceneIndex] = useState(0);
  const [sceneImage, setSceneImage] = useState<string | null>(null);
  const [sceneImageFile, setSceneImageFile] = useState<File | null>(null);
  const [sceneStartFrameSource, setSceneStartFrameSource] =
    useState<StartFrameSource>("manual");
  const [scenePrompt, setScenePrompt] = useState("");
  const [sceneDuration, setSceneDuration] = useState(5);
  const [sceneModelParams, setSceneModelParams] = useState<Record<string, unknown>>({});
  const [sceneError, setSceneError] = useState<string | null>(null);
  const [isSourceImageDragging, setIsSourceImageDragging] = useState(false);
  const [isFrameDragging, setIsFrameDragging] = useState(false);
  const [isSceneImageDragging, setIsSceneImageDragging] = useState(false);
  const [isAudioDragging, setIsAudioDragging] = useState(false);
  const [sceneScrollState, setSceneScrollState] = useState({
    canScrollLeft: false,
    canScrollRight: false,
  });
  const detectedImageAspectRatioRef = useRef<number | null>(null);
  const selectedModelOptionRef = useRef<GenerationModelOption | undefined>(undefined);
  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const sceneRowRef = useRef<HTMLDivElement | null>(null);
  const storyboardSplitRequestRef = useRef(0);
  const storyboardPreparedFileRef = useRef<File | null>(null);
  const activateVideoTab = useCallback((tab: ActiveVideoTab) => {
    setPromptOptimizerEnabled(false);
    setActiveVideoTab(tab);
    setVisitedVideoTabs((current) => current.has(tab) ? current : new Set(current).add(tab));
  }, []);
  const restoredVideoTabRef = useRef(false);
  // A tab picked by hand is remembered, and a ?tab= link that was only the way in is dropped so a refresh does not undo the pick.
  const selectVideoTab = (tab: ActiveVideoTab) => {
    activateVideoTab(tab);
    try {
      window.localStorage.setItem(VIDEO_TAB_STORAGE_KEY, tab);
    } catch {
      // Ignore storage restrictions; the tab still changes for this visit.
    }
    const params = new URLSearchParams(window.location.search);
    if (params.has("tab")) {
      params.delete("tab");
      const query = params.toString();
      router.replace(`${window.location.pathname}${query ? `?${query}` : ""}`, { scroll: false });
    }
  };
  useEffect(() => {
    generationStatusRef.current = generationStatus;
  }, [generationStatus]);
  const referenceImageEntries = referenceImageRoles.flatMap((role) => {
    const slot = referenceImageSlots[role.key];
    return slot ? [{ ...role, ...slot }] : [];
  });
  const referenceImageUrls = referenceImageEntries.map((entry) => entry.url);
  const referenceRolePrompt = referenceImageEntries.length > 0
    ? `Reference image roles: ${referenceImageEntries.map((entry, index) => `Image ${index + 1} = ${t(entry.labelKey)}`).join("; ")}. Use each image according to its role, preserving the avatar identity and product details.`
    : "";
  const promptWithReferenceRoles = (value: string) => (generationMode === "reference-to-video" || generationMode === "single-image") && referenceRolePrompt
    ? `${value}\n\n${referenceRolePrompt}`
    : value;
  const promptForSceneGeneration = (value: string) => {
    const scenePromptValue = value.trim();
    if (!isStorylinePromptMode(generationMode) || !prompt.trim()) return promptWithReferenceRoles(scenePromptValue);
    return promptWithReferenceRoles(`Main storyline:\n${prompt.trim()}\n\nScene direction:\n${scenePromptValue}`);
  };
  const selectedModelOption = models.find((model) => model.model === selectedModel);
  useEffect(() => {
    if (!selectedModel) return;
    const timeoutId = window.setTimeout(() => {
      setPreviewView(selectedModelOption?.previewUrl ? "model" : "latest");
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [selectedModel, selectedModelOption?.previewUrl]);
  useEffect(() => {
    selectedModelOptionRef.current = selectedModelOption;
  }, [selectedModelOption]);
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
  const referenceModeHasNoModel = generationMode === "reference-to-video" && !modelsLoading && models.length === 0;
  const requiredProperties = new Set(requiredSchemaParameters(selectedModelOption));
  const durationProperty = findSchemaProperty(properties, ["duration", "duration_seconds", "durationSeconds"]);
  const resolutionProperty = findSchemaProperty(properties, ["resolution"]);
  const aspectRatioProperty = findSchemaProperty(properties, ["aspectRatio", "aspect_ratio"]);
  const aspectRatioOptions = modelAspectRatioOptions(selectedModelOption);
  const supportsAspectRatio = Boolean(aspectRatioProperty || capabilities?.aspectRatioParameter || aspectRatioOptions.length > 0);
  const canSelectAspectRatio = supportsAspectRatio && aspectRatioOptions.length > 0;
  const audioProperty = findSchemaProperty(properties, [
    "generateAudio",
    "generate_audio",
    "audio",
    "audio_enabled",
    "audioOutput",
    "audio_output",
    "includeAudio",
    "include_audio",
    "withAudio",
    "with_audio",
    "nativeAudio",
    "native_audio",
    "sound",
    "soundtrack",
  ]);
  const audioInputMode = Boolean(audioProperty && audioProperty[1].type !== "boolean");
  // Models exposing an audio control or audio input generate/handle audio
  // themselves. The post-processing audio tools are only relevant for silent
  // video models.
  const hasNativeAudio = Boolean(capabilities?.nativeAudio || audioProperty || capabilities?.audioParameter);
  const supportsPostAudioSfx = Boolean(selectedModelOption) && !hasNativeAudio && (selectedModelOption?.postAudio?.sfx ?? true);
  const supportsPostAudioMusic = Boolean(selectedModelOption) && !hasNativeAudio && (selectedModelOption?.postAudio?.music ?? true);
  const showPostAudioOptions = (activeVideoTab === "image-to-video" || activeVideoTab === "text-to-video")
    && (supportsPostAudioSfx || supportsPostAudioMusic);
  const postAudioMode = showPostAudioOptions
    ? supportsPostAudioSfx && postAudioSfxEnabled && supportsPostAudioMusic && postAudioMusicEnabled
      ? "both"
      : supportsPostAudioSfx && postAudioSfxEnabled
        ? "sfx"
        : supportsPostAudioMusic && postAudioMusicEnabled
          ? "music"
          : "none"
    : "none";
  const referenceAudiosParameter = findModelInputParameter(
    selectedModelOption,
    undefined,
    referenceAudioParameterAliases,
  );
  const referenceVideosParameter = findModelInputParameter(
    selectedModelOption,
    undefined,
    referenceVideoParameterAliases,
  );
  const modelParameterEntries = Object.entries(properties).filter(([name]) => {
    const selected = models.find((model) => model.model === selectedModel);
    const capabilities = selected?.capabilities;
    return !coreModelParameterNames.has(name)
      && name !== capabilities?.promptParameter
      && name !== capabilities?.imageParameter
      && name !== capabilities?.referenceImagesParameter
      && name !== referenceImagesParameter
      && name !== referenceAudiosParameter
      && name !== referenceVideosParameter
      && name !== lastImageParameter
      && name !== capabilities?.negativePromptParameter
      && !isCameraFixedParameter(name, properties[name]?.title)
      && !isSeedParameter(name, properties[name]?.title);
  });
  const settingsModelParameterEntries = modelParameterEntries;

  useEffect(() => {
    const requestedTab = searchParams.get("tab");
    if (!isActiveVideoTab(requestedTab)) return;
    const timeoutId = window.setTimeout(() => {
      activateVideoTab(requestedTab);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [activateVideoTab, searchParams]);

  // On a fresh load without a ?tab= link, go back to the tab that was open before the refresh.
  useEffect(() => {
    if (restoredVideoTabRef.current) return;
    if (isActiveVideoTab(searchParams.get("tab"))) {
      restoredVideoTabRef.current = true;
      return;
    }
    const timeoutId = window.setTimeout(() => {
      restoredVideoTabRef.current = true;
      try {
        const savedTab = window.localStorage.getItem(VIDEO_TAB_STORAGE_KEY);
        if (isActiveVideoTab(savedTab)) activateVideoTab(savedTab);
      } catch {
        // Ignore storage restrictions and keep the default tab.
      }
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [activateVideoTab, searchParams]);

  const loadVideoHistory = useCallback(async (workspace?: string | null) => {
    setVideoHistoryLoading(true);
    setVideoHistoryError(null);
    try {
      setVideoHistory(await listVideoStoryboardHistory(workspace));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "";
      setVideoHistoryError(/please sign in/i.test(message) ? t("create.video.common.historySignIn") : message || t("create.video.common.loadingHistory"));
    } finally {
      setVideoHistoryLoading(false);
    }
  }, [t]);

  useEffect(() => {
    const storedWorkspaceId = window.sessionStorage.getItem("eos.generation.workspace-id");
    const timeoutId = window.setTimeout(() => {
      void loadVideoHistory(storedWorkspaceId);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadVideoHistory]);
  useEffect(() => {
    const refreshHistory = () => {
      void loadVideoHistory(window.sessionStorage.getItem("eos.generation.workspace-id"));
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") refreshHistory();
    };
    window.addEventListener("focus", refreshHistory);
    window.addEventListener("pageshow", refreshHistory);
    window.addEventListener(AUTH_SESSION_UPDATED_EVENT, refreshHistory);
    window.addEventListener(GENERATION_COMPLETED_EVENT, refreshHistory);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("focus", refreshHistory);
      window.removeEventListener("pageshow", refreshHistory);
      window.removeEventListener(AUTH_SESSION_UPDATED_EVENT, refreshHistory);
      window.removeEventListener(GENERATION_COMPLETED_EVENT, refreshHistory);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [loadVideoHistory]);
  useEffect(() => {
    if (activeVideoTab !== "image-to-video") return;
    if (generationStatusRef.current === "uploading" || generationStatusRef.current === "processing" || generationStatusRef.current === "completed") return;

    let disposed = false;

    const waitForNextPoll = () => new Promise<void>((resolve) => {
      window.setTimeout(resolve, 2500);
    });

    const readPersistedStoryboard = (): { generationId: string; completed: number; total: number; videoUrl?: string } | null => {
      const values: unknown[] = [];
      const readStorage = (storage: Storage, key: string, expectsArray: boolean) => {
        try {
          const raw = storage.getItem(key);
          if (!raw) return;
          const parsed = JSON.parse(raw) as unknown;
          if (expectsArray && Array.isArray(parsed)) values.push(...parsed);
          else if (!expectsArray) values.push(parsed);
        } catch {
          // Storage can be unavailable while auth/session hydration is in progress.
        }
      };

      readStorage(window.localStorage, getGenerationProgressStorageKey(), true);
      readStorage(window.sessionStorage, "eos.generation.pending.image-to-video", false);

      const candidates = values.map((value) => {
        if (!value || typeof value !== "object") return null;
        const item = value as { feature?: unknown; pending?: unknown };
        const pending = item.pending && typeof item.pending === "object" ? item.pending as {
          generationId?: unknown;
          pollUrl?: unknown;
          status?: unknown;
          completedCount?: unknown;
          totalCount?: unknown;
          output?: unknown;
        } : value as {
          generationId?: unknown;
          pollUrl?: unknown;
          status?: unknown;
          completedCount?: unknown;
          totalCount?: unknown;
          output?: unknown;
        };
        if ((item.feature !== undefined && item.feature !== "image-to-video")
          // Completed progress snapshots have no expiry metadata. Restore only
          // active work here; completed videos come from the dated history API.
          || (pending.status !== "queued" && pending.status !== "processing")
          || typeof pending.generationId !== "string"
          || typeof pending.pollUrl !== "string"
          || !pending.pollUrl.includes("/generations/video/image-to-video/")) return null;
        const videoOutput = Array.isArray(pending.output)
          ? pending.output.find((output): output is { url: string } => Boolean(output) && typeof output === "object" && typeof (output as { type?: unknown }).type === "string" && (output as { type: string }).type === "video" && typeof (output as { url?: unknown }).url === "string")
          : undefined;
        return {
          generationId: pending.generationId,
          completed: typeof pending.completedCount === "number" ? pending.completedCount : 0,
          total: typeof pending.totalCount === "number" ? Math.max(1, pending.totalCount) : 1,
          ...(videoOutput?.url ? { videoUrl: videoOutput.url } : {}),
        };
      }).filter((item): item is { generationId: string; completed: number; total: number; videoUrl?: string } => Boolean(item));

      return candidates[candidates.length - 1] ?? null;
    };

    const readServerStoryboard = async (): Promise<{ generationId: string; completed: number; total: number; videoUrl?: string } | null> => {
      try {
        const history = await listGenerationHistory(undefined, "image-to-video");
        const generation = history.find((item) => {
          if (item.status !== "queued" && item.status !== "processing" && item.status !== "completed") return false;
          const storyboardId = item.input?.storyboard_id ?? item.input?.storyboardId;
          return typeof storyboardId !== "string" || !storyboardId.trim();
        });
        if (!generation) return null;

        const videoOutput = generation.output?.find((output) => output.type === "video" && typeof output.url === "string");
        return {
          generationId: generation.id,
          completed: generation.completedCount ?? (videoOutput ? generation.totalCount ?? 1 : 0),
          total: Math.max(1, generation.totalCount ?? generation.output?.length ?? 1),
          ...(generation.finalVideoUrl ? { videoUrl: generation.finalVideoUrl } : videoOutput?.url ? { videoUrl: videoOutput.url } : {}),
        };
      } catch {
        // The local progress card remains the fast path; history can be
        // unavailable briefly while auth/session state is being restored.
        return null;
      }
    };

    const applyProcessingStatus = (status: Awaited<ReturnType<typeof getVideoStoryboardStatus>>, generationId: string, fallback: { completed: number; total: number }) => {
      if (disposed) return;
      const total = status.totalScenes ?? fallback.total;
      const completed = status.completedScenes ?? fallback.completed;
      const audioMode = status.audioMode ?? status.audio?.mode ?? "none";
      const finalizing = status.status === "processing"
        && audioMode !== "none"
        && total > 0
        && completed >= total;
      setGenerationStatus("processing");
      setGenerationError(null);
      setGenerationProgress({
        completed,
        total,
      });
      setIsFinalizingVideo(finalizing);
      setNotice(t(finalizing ? "create.video.common.finalizingVideoDetail" : "create.video.common.generatingVideo"));
    };

    const restoreProcessingStoryboard = async () => {
      const persisted = readPersistedStoryboard() ?? await readServerStoryboard();
      if (!persisted) return;

      if (persisted.videoUrl) {
        setFinalVideoUrl(persisted.videoUrl);
        setLatestCompletedStoryboardId(persisted.generationId);
        setGenerationProgress({ completed: persisted.completed || persisted.total, total: persisted.total });
        setGenerationStatus("completed");
        setIsFinalizingVideo(false);
        setNotice(t("create.video.common.videoReady"));
        void loadVideoHistory();
        return;
      }

      setGenerationStatus("processing");
      setIsFinalizingVideo(false);
      setGenerationError(null);
      setGenerationProgress({ completed: persisted.completed, total: persisted.total });
      setNotice(t("create.video.common.generatingVideo"));

      const fetchStatusWithRetry = async (): Promise<Awaited<ReturnType<typeof getVideoStoryboardStatus>> | null> => {
        while (!disposed) {
          try {
            return await getVideoStoryboardStatus(persisted.generationId);
          } catch {
            await waitForNextPoll();
          }
        }
        return null;
      };

      let status = await fetchStatusWithRetry();
      if (!status) return;
      if (disposed) return;

      if (status.status === "processing" || status.status === "queued") applyProcessingStatus(status, persisted.generationId, persisted);
      while (!disposed && status.status !== "completed" && status.status !== "failed" && status.status !== "cancelled") {
        await waitForNextPoll();
        if (disposed) return;
        status = await fetchStatusWithRetry();
        if (!status) return;
        if (status.status === "processing" || status.status === "queued") applyProcessingStatus(status, persisted.generationId, persisted);
      }
      if (disposed) return;

      setGenerationProgress({
        completed: status.completedScenes ?? (status.status === "completed" ? status.totalScenes ?? persisted.total : persisted.completed),
        total: status.totalScenes ?? persisted.total,
      });
      if (status.status === "completed" && status.finalVideoUrl) {
        setFinalVideoUrl(status.finalVideoUrl);
        setLatestCompletedStoryboardId(persisted.generationId);
        setGenerationStatus("completed");
        setIsFinalizingVideo(false);
        setNotice(t("create.video.common.videoReady"));
        void loadVideoHistory(status.workspaceId ?? undefined);
        return;
      }
      setIsFinalizingVideo(false);
      setGenerationStatus(status.status === "cancelled" ? "cancelled" : "failed");
      setNotice(status.status === "cancelled" ? t("create.video.common.videoGenerationCancelled") : null);
    };

    void restoreProcessingStoryboard().catch(() => {
      if (!disposed) setNotice(t("create.video.common.generatingVideo"));
    });
    return () => {
      disposed = true;
    };
  }, [activeVideoTab, loadVideoHistory, t]);
  useEffect(() => {
    let active = true;
    void getVideoStoryboardSettings()
      .then((settings) => {
        if (!active) return;
        const hardMax = Number.isInteger(settings.hardMaxScenes) && settings.hardMaxScenes > 0
          ? settings.hardMaxScenes
          : HARD_MAX_STORYBOARD_SCENES;
        if (Number.isInteger(settings.maxScenes) && settings.maxScenes >= 1) {
          setMaxStoryboardScenes(Math.min(settings.maxScenes, hardMax));
        }
      })
      .catch(() => {
        // Keep the backend default while an older deployment is still migrating.
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (activeVideoTab !== "image-to-video") return undefined;
    let active = true;
    const controller = new AbortController();
    const modelFeature = videoModeRouteFeature(generationMode);
    const loadTimer = window.setTimeout(() => {
      if (!active) return;
      setModelsLoading(true);
      setModelsError(null);
      setModels([]);
      setExtendModels([]);
      setSelectedModel("");
      void listGenerationModels(modelFeature, undefined, { signal: controller.signal })
        .then((items) => {
          const eligible = items.filter((item) => item.enabled && item.capabilities.promptParameter && (
            item.capabilities.imageParameter || item.capabilities.referenceImagesParameter
          ));
          if (!active) return;
          setModels(eligible);
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

      // Extend support is optional and must not block the primary model list.
      void listGenerationModels("extend-video", undefined, { signal: controller.signal })
        .then((items) => {
          if (active) setExtendModels(items.filter((item) => item.enabled));
        })
        .catch(() => {
          // The main model list can still be used when extend discovery fails.
        });
    }, 0);
    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(loadTimer);
    };
  }, [activeVideoTab, generationMode, modelCatalogVersion, modelLoadRetry]);
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
    const nextAspectRatioOptions = modelAspectRatioOptions(selected);
    const nextCanSelectAspectRatio = Boolean(nextAspectRatio || selected?.capabilities.aspectRatioParameter || nextAspectRatioOptions.length > 0)
      && nextAspectRatioOptions.length > 0;
    const nextAudio = findSchemaProperty(nextProperties, [
      "generateAudio",
      "generate_audio",
      "audio",
      "audio_enabled",
      "audioOutput",
      "audio_output",
      "includeAudio",
      "include_audio",
      "withAudio",
      "with_audio",
      "nativeAudio",
      "native_audio",
      "sound",
      "soundtrack",
    ]);
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
      const detectedAspect = !nextCanSelectAspectRatio && detectedImageAspectRatioRef.current !== null
        ? closestAspectRatio(detectedImageAspectRatioRef.current, nextAspectRatioOptions)
        : undefined;
      setAspectRatio(detectedAspect ?? (typeof aspectDefault === "string" ? aspectDefault : nextAspectRatioOptions[0] ?? ""));
      setAutoSound(typeof audioDefault === "boolean" ? audioDefault : false);
      setAudioFile(null);
      setPostAudioSfxEnabled(false);
      setPostAudioMusicEnabled(false);
      setStoryboardScenes((current) => current.map((scene) => ({
        ...scene,
        duration: nextDurationValue || scene.duration,
      })));
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [models, selectedModel]);
  useEffect(() => {
    return () => {
      storyboardSlices.forEach((slice) => URL.revokeObjectURL(slice.image));
    };
  }, [storyboardSlices]);
  const prepareStoryboardSlices = useCallback(async (file: File) => {
    const requestId = storyboardSplitRequestRef.current + 1;
    storyboardSplitRequestRef.current = requestId;
    storyboardPreparedFileRef.current = file;
    setStoryboardSheetFile(file);
    setStoryboardSplitting(true);
    setStoryboardSlicesSourceFile(null);
    setStoryboardGridLabel(null);
    setStoryboardQualityNote(null);
    setStoryboardSlices([]);
    detectedImageAspectRatioRef.current = null;
    setDetectedImageAspectRatio(null);
    setStoryboardHasMixedAspectRatios(false);
    setActiveSceneIndex(0);
    try {
      const result = await splitStoryboardSheet(file, maxStoryboardScenes);
      if (storyboardSplitRequestRef.current !== requestId) {
        result.slices.forEach((slice) => URL.revokeObjectURL(slice.previewUrl));
        return false;
      }
      const slices = result.slices.map((slice, index) => ({
        id: `storyboard-slice-${index + 1}`,
        image: slice.previewUrl,
        file: slice.file,
      }));
      const sceneAspectRatioValues = await Promise.all(slices.map(async (slice) => {
        try {
          return await readImageAspectRatio(slice.file);
        } catch {
          return null;
        }
      }));
      if (storyboardSplitRequestRef.current !== requestId) {
        slices.forEach((slice) => URL.revokeObjectURL(slice.image));
        return false;
      }
      const validSceneRatios = sceneAspectRatioValues.filter((value): value is number => value !== null);
      const firstSceneRatio = validSceneRatios[0];
      const storyboardHasMixedRatios = validSceneRatios.length !== sceneAspectRatioValues.length
        || (firstSceneRatio !== undefined && validSceneRatios.some((value) => Math.abs(Math.log(value / firstSceneRatio)) > 0.03));
      const sceneAspectRatioOptions = modelAspectRatioOptions(selectedModelOptionRef.current);
      const sceneAspectRatios = sceneAspectRatioValues.map((value) => value === null
        ? undefined
        : closestAspectRatio(value, sceneAspectRatioOptions));
      setStoryboardHasMixedAspectRatios(storyboardHasMixedRatios);
      if (!storyboardHasMixedRatios && firstSceneRatio !== undefined) {
        detectedImageAspectRatioRef.current = firstSceneRatio;
        setDetectedImageAspectRatio(firstSceneRatio);
        const sharedAspectRatio = closestAspectRatio(firstSceneRatio, sceneAspectRatioOptions);
        if (sharedAspectRatio) setAspectRatio(sharedAspectRatio);
      }
      setStoryboardSlices(slices);
      setStoryboardSlicesSourceFile(file);
      setStoryboardGridLabel(t("create.video.common.storyboardGridLabel", { rows: result.rows, columns: result.columns, count: result.slices.length }));
      setStoryboardQualityNote(result.minSceneWidth < 768 || result.minSceneHeight < 768
        ? t("create.video.common.storyboardQualityNote", { width: result.minSceneWidth, height: result.minSceneHeight })
        : null);
      setStoryboardScenes((current) => {
        const firstScene = current[0];
        const sharedDuration = firstScene?.duration || duration;
        const sharedModelParams = firstScene?.modelParams ?? modelParams;
        return slices.map((slice, index) => ({
          id: slice.id,
          image: slice.image,
          imageFile: slice.file,
          endImage: null,
          endImageFile: null,
          prompt: "",
          duration: sharedDuration,
          ...(sceneAspectRatios[index] ? { aspectRatio: sceneAspectRatios[index] } : {}),
          startFrameSource: "manual" as const,
          modelParams: sharedModelParams,
        }));
      });
      return true;
    } catch (error: unknown) {
      if (storyboardSplitRequestRef.current === requestId) {
        setStoryboardSlices([]);
        setStoryboardSlicesSourceFile(null);
        setStoryboardQualityNote(null);
        setGenerationError(formatGenerationError(error, "Unable to split storyboard image"));
      }
      return false;
    } finally {
      if (storyboardSplitRequestRef.current === requestId) setStoryboardSplitting(false);
    }
  }, [duration, maxStoryboardScenes, modelParams, t]);
  useEffect(() => {
    if (generationMode !== "single-image") {
      storyboardSplitRequestRef.current += 1;
      storyboardPreparedFileRef.current = null;
      return;
    }
    const file = storyboardSheetFile ?? storyboardScenes[0]?.imageFile;
    if (file && storyboardPreparedFileRef.current !== file && !storyboardSplitting) void prepareStoryboardSlices(file);
  }, [generationMode, prepareStoryboardSlices, storyboardScenes, storyboardSheetFile, storyboardSplitting]);
  const clearDetectedAspectRatio = () => {
    detectedImageAspectRatioRef.current = null;
    setDetectedImageAspectRatio(null);
    setStoryboardHasMixedAspectRatios(false);
  };
  const updateAspectRatioFromImage = async (file: File) => {
    try {
      const detectedRatio = await readImageAspectRatio(file);
      detectedImageAspectRatioRef.current = detectedRatio;
      setDetectedImageAspectRatio(detectedRatio);
      if (canSelectAspectRatio) return;
      const nextAspectRatio = closestAspectRatio(detectedRatio, aspectRatioOptions);
      if (nextAspectRatio) setAspectRatio(nextAspectRatio);
    } catch {
      // Keep the model default when the browser cannot read the image dimensions.
    }
  };
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
    setActiveSceneIndex(0);
    setStoryboardScenes((current) => generationMode === "single-image"
      ? [{
        ...(current[0] ?? {
          id: "scene-1",
          image: null,
          imageFile: null,
          endImage: null,
          endImageFile: null,
          prompt,
          duration,
          startFrameSource: "manual" as const,
          modelParams,
        }),
        image: nextUrl,
        imageFile: file,
        startFrameSource: "manual" as const,
      }]
      : current.map((scene, index) => (
        index === 0 ? { ...scene, image: nextUrl, imageFile: file, startFrameSource: "manual" } : scene
      )));
    setStoryboardSheetFile(generationMode === "single-image" ? file : null);
    setGenerationError(null);
    clearDetectedAspectRatio();
    if (generationMode === "single-image") void prepareStoryboardSlices(file);
    else void updateAspectRatioFromImage(file);
  };
  const handleSourceImageDragOver = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsSourceImageDragging(true);
  };
  const handleSourceImageDragLeave = (event: DragEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setIsSourceImageDragging(false);
    }
  };
  const handleSourceImageDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setIsSourceImageDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void uploadSource(file);
  };
  const clearSource = () => {
    storyboardSplitRequestRef.current += 1;
    storyboardPreparedFileRef.current = null;
    if (sourceImage?.startsWith("blob:")) URL.revokeObjectURL(sourceImage);
    setSourceImage(null);
    setStoryboardSlices([]);
    setStoryboardSlicesSourceFile(null);
    setStoryboardSheetFile(null);
    setStoryboardGridLabel(null);
    setStoryboardQualityNote(null);
    setStoryboardSplitting(false);
    clearDetectedAspectRatio();
    setStoryboardScenes((current) => generationMode === "single-image"
      ? [{ ...(current[0] ?? {
        id: "scene-1",
        image: null,
        imageFile: null,
        endImage: null,
        endImageFile: null,
        prompt,
        duration,
        startFrameSource: "manual" as const,
        modelParams,
      }), image: null, imageFile: null, startFrameSource: "manual" }]
      : current.map((scene, index) => (
        index === 0 ? { ...scene, image: null, imageFile: null, startFrameSource: "manual" } : scene
      )));
    setActiveSceneIndex(0);
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
    setGenerationError(null);
  };
  const handleFrameDrop = (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    setIsFrameDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void addFrame(file);
  };

  const addReferenceImage = async (role: ReferenceImageRole, file: File) => {
    const validationError = await validateMediaFile(file, "image", capabilities?.uploadConstraints);
    if (validationError) {
      setGenerationError(validationError);
      return;
    }
    const existingSlot = referenceImageSlots[role];
    if (existingSlot?.url.startsWith("blob:")) URL.revokeObjectURL(existingSlot.url);
    setReferenceImageSlots((current) => ({
      ...current,
      [role]: { url: URL.createObjectURL(file), file },
    }));
    setGenerationError(null);
    if (role === "avatar" || !referenceImageSlots.avatar) void updateAspectRatioFromImage(file);
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
  const handleAudioDrop = (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    setIsAudioDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void handleAudioFile(file);
  };

  const handleSceneImageFile = async (file: File) => {
    const validationError = await validateMediaFile(file, "image", capabilities?.uploadConstraints);
    if (validationError) {
      setSceneError(validationError);
      return;
    }
    if (editingSceneIndex === null && sceneImage?.startsWith("blob:")) URL.revokeObjectURL(sceneImage);
    setSceneImage(URL.createObjectURL(file));
    setSceneImageFile(file);
    setSceneError(null);
    if (generationMode !== "reference-to-video" && (editingSceneIndex === null || editingSceneIndex === 0)) {
      void updateAspectRatioFromImage(file);
    }
  };
  const handleSceneImageDrop = (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    setIsSceneImageDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void handleSceneImageFile(file);
  };
  const clearFrameReferences = () => {
    frameReferences.forEach((source) => {
      if (source.startsWith("blob:")) URL.revokeObjectURL(source);
    });
    setFrameReferences([]);
  };

  const clearReferenceImageSlots = () => {
    Object.values(referenceImageSlots).forEach((slot) => {
      if (slot?.url.startsWith("blob:")) URL.revokeObjectURL(slot.url);
    });
    setReferenceImageSlots({});
    clearDetectedAspectRatio();
  };

  const removeReferenceImage = (role: ReferenceImageRole) => {
    const source = referenceImageSlots[role]?.url;
    if (source?.startsWith("blob:")) URL.revokeObjectURL(source);
    setReferenceImageSlots((current) => {
      const next = { ...current };
      delete next[role];
      return next;
    });
    if (role === "avatar" && referenceImageSlots.product) void updateAspectRatioFromImage(referenceImageSlots.product.file);
    else if (role === "product" && !referenceImageSlots.avatar) clearDetectedAspectRatio();
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
  const selectGenerationMode = (
    nextMode: GenerationMode,
  ) => {
    setGenerationMode(nextMode);
    // Clear the previous route's selection before the new model list loads.
    // This prevents a Reference to Video model from being quoted against the
    // Image to Video route during the mode transition.
    setModels([]);
    setSelectedModel("");
    setModelParams({});
    setModelsError(null);
    setModelsLoading(true);
    setActiveSceneIndex(0);
    if (nextMode === "multi-scene") {
      if (sourceImage?.startsWith("blob:")) URL.revokeObjectURL(sourceImage);
      setSourceImage(null);
      setStoryboardScenes([]);
      setStoryboardSheetFile(null);
      setStoryboardSlices([]);
      setStoryboardSlicesSourceFile(null);
      setStoryboardGridLabel(null);
      setStoryboardQualityNote(null);
      setStoryboardSplitting(false);
      clearDetectedAspectRatio();
    } else if (nextMode !== "single-image" && storyboardSheetFile) {
      const originalSheet = storyboardSheetFile;
      setStoryboardScenes((current) => [{
        ...(current[0] ?? {
          id: "scene-1",
          image: null,
          imageFile: null,
          endImage: null,
          endImageFile: null,
          prompt,
          duration,
          startFrameSource: "manual" as const,
          modelParams,
        }),
        image: sourceImage,
        imageFile: originalSheet,
        endImage: null,
        endImageFile: null,
        startFrameSource: "manual" as const,
      }]);
      setStoryboardSheetFile(null);
      setStoryboardSlices([]);
      setStoryboardSlicesSourceFile(null);
      setStoryboardGridLabel(null);
    }
    if (nextMode !== "multi-scene" && storyboardScenes.length === 0) {
      setStoryboardScenes([{
        id: "scene-1",
        image: null,
        imageFile: null,
        endImage: null,
        endImageFile: null,
        prompt: nextMode === "single-image" || isSingleSceneGenerationMode(nextMode) ? prompt : "",
        duration,
        startFrameSource: "manual",
        modelParams,
      }]);
    } else if (isSingleSceneGenerationMode(nextMode)) {
      setStoryboardScenes((current) => current.slice(0, 1));
    }
    const nextVideoMode = nextMode === "continuous" ? "continuous" : "storyboard";
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
  const sourcePreviewImage = generationMode === "single-image"
    ? sourceImage
    : storyboardScenes[0]?.image ?? sourceImage;
  const nativeExtendModel = selectedModelOption
    ? extendModels.find((model) => modelFamily(model.model) === modelFamily(selectedModelOption.model))
    : undefined;
  const hasNativeExtend = Boolean(nativeExtendModel);
  const hasCurrentStoryboardSlices = storyboardSlicesSourceFile !== null
    && storyboardSlicesSourceFile === storyboardSheetFile
  const generationScenes = generationMode === "single-image"
    ? hasCurrentStoryboardSlices && storyboardScenes.length > 0 ? storyboardScenes : storyboardScenes.slice(0, 1)
    : isSingleSceneGenerationMode(generationMode)
      ? storyboardScenes.slice(0, 1)
      : storyboardScenes;
  // Single-storyboard uploads always go through the 2K upscale stage before
  // video generation. This is intentional even when the source image is
  // already large enough, so every panel gets the same quality treatment.
  const shouldAutoUpscaleStoryboard = generationMode === "single-image" && generationScenes.length > 0;
  const requestModelParams = modelParamsForGeneration(modelParams, properties);
  const creditQuoteInput: Omit<VideoGenerationInput, "idempotencyKey"> | null = (() => {
    if (activeVideoTab !== "image-to-video" || !selectedModelOption || generationScenes.length === 0) return null;
    const scenes = generationScenes.map((scene, index) => {
      const startFrameSource: StartFrameSource = index === 0 || videoMode === "storyboard"
        ? "manual"
        : videoMode === "continuous"
          ? "previous_last_frame"
          : scene.startFrameSource;
      const sceneInput: VideoGenerationInput["scenes"][number] = {
        startFrameSource,
        prompt: promptForSceneGeneration(scene.prompt.trim() || prompt.trim() || "Video generation"),
        seed: -1,
      };
      if (startFrameSource === "manual" && scene.image && !scene.image.startsWith("blob:")) sceneInput.storyboardImage = scene.image;
      if ((generationMode === "reference-to-video" || generationMode === "single-image") && referenceImageUrls.length > 0) {
        sceneInput.referenceImages = referenceImageUrls;
      }
      if (negativePrompt.trim()) sceneInput.negativePrompt = negativePrompt.trim();
      if (durationProperty) sceneInput.duration = scene.duration;
      if (scene.aspectRatio) sceneInput.aspectRatio = scene.aspectRatio;
      const sceneModelParams = modelParamsForGeneration(scene.modelParams, properties);
      if (Object.keys(sceneModelParams).length) sceneInput.modelParams = sceneModelParams;
      return sceneInput;
    });
    const request: Omit<VideoGenerationInput, "idempotencyKey"> = {
      model: selectedModel,
      mode: generationMode === "single-image" || isSingleSceneGenerationMode(generationMode) ? "storyboard" : videoMode,
      generationMode,
      scenes,
      autoUpscale: shouldAutoUpscaleStoryboard,
      promptOptimizerEnabled,
    };
    if (durationProperty) request.duration = duration;
    if (resolutionProperty && resolution) request.resolution = resolution;
    if (supportsAspectRatio && aspectRatio && !storyboardHasMixedAspectRatios) request.aspectRatio = aspectRatio;
    if (postAudioMode !== "none") {
      request.audioMode = postAudioMode;
    }
    if (Object.keys(requestModelParams).length) request.modelParams = requestModelParams;
    if (audioProperty && !audioInputMode) {
      if (["generateAudio", "generate_audio"].includes(audioProperty[0])) request.generateAudio = autoSound;
      else request.modelParams = { ...(request.modelParams ?? {}), [audioProperty[0]]: autoSound };
    }
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
  const estimateDescription = generationMode === "single-image" || allScenesShareDuration
    ? t("create.video.common.scenesDuration", { count: estimateSceneCount, duration: estimateDurations[0] ?? 0 })
    : t("create.video.common.scenesDurationTotal", { count: estimateSceneCount, duration: estimateTotalDuration });
  const totalCreditEstimate = creditEstimate;
  const formattedCreditEstimate: ReactNode = creditEstimateLoading
    ? <span className={styles.creditCalculating}><LoaderCircle size={12} className={styles.creditSpinner} />{t("create.video.common.recalculatingPrice")}</span>
    : totalCreditEstimate === null
      ? t("create.video.common.pricingUnavailable")
      : `${totalCreditEstimate.toLocaleString("th-TH", { maximumFractionDigits: 2 })} ${t("create.video.common.creditsWord")}`;
  const firstScene = storyboardScenes[0];
  const firstSceneHasPrompt = isStorylinePromptMode(generationMode)
    ? Boolean(firstScene?.prompt.trim())
    : Boolean(firstScene?.prompt.trim() || prompt.trim());
  const sceneLimitReached = storyboardScenes.length >= maxStoryboardScenes;
  const canAddScene = generationMode === "multi-scene" && storyboardScenes.length === 0
    ? true
    : generationMode !== "single-image"
    && !isSingleSceneGenerationMode(generationMode)
    && !sceneLimitReached
    && Boolean(firstScene?.image && firstSceneHasPrompt);
  const addSceneDisabledReason = sceneLimitReached
    ? t("create.video.common.storyboardLimitTitle", { count: maxStoryboardScenes })
    : t("create.video.common.completeSceneShort");
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
    setActiveSceneIndex(index);
    setEditingSceneIndex(index);
    setSceneError(null);
    setScenePrompt(scene.prompt);
    setSceneDuration(scene.duration);
    setSceneImage(sceneSource === "manual" ? scene.image : null);
    setSceneImageFile(sceneSource === "manual" ? scene.imageFile : null);
    setSceneStartFrameSource(sceneSource);
    setSceneModelParams({
      ...modelSpecificDefaults(models.find((model) => model.model === selectedModel)),
      ...scene.modelParams,
    });
    setIsSceneModalOpen(true);
  };
  const deleteScene = (index: number) => {
    if (generationMode === "single-image" || isSingleSceneGenerationMode(generationMode) || index === 0) return;
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
    setStoryboardScenes((current) => current.filter((_, sceneIndex) => sceneIndex !== index));
    setActiveSceneIndex((current) => current === index ? Math.max(0, index - 1) : current > index ? current - 1 : current);
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
    setSceneStartFrameSource("manual");
    setScenePrompt("");
    setSceneModelParams({});
    setSceneError(null);
    setEditingSceneIndex(null);
    setIsSceneModalOpen(false);
  };
  const clearSceneModalImage = () => {
    if (generationMode === "single-image" && editingSceneIndex !== null) return;
    if (editingSceneIndex === null && sceneImage?.startsWith("blob:")) URL.revokeObjectURL(sceneImage);
    setSceneImage(null);
    setSceneImageFile(null);
    setSceneError(null);
  };
  const saveScene = () => {
    if (sceneStartFrameSource === "manual" && !sceneImage)
      return setSceneError(t("create.video.common.sceneImageRequired"));
    if (!scenePrompt.trim())
      return setSceneError(t("create.video.common.scenePromptRequired"));
    const missingSceneParam = modelParameterEntries.find(([name]) => {
      if (!requiredProperties.has(name)) return false;
      const value = sceneModelParams[name];
      return value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
    });
    if (missingSceneParam)
      return setSceneError(t("create.video.common.parameterRequiredForScene", { parameter: localizedParameterLabel(missingSceneParam[0], missingSceneParam[1].title) }));
    const existingScene = editingSceneIndex === null ? undefined : storyboardScenes[editingSceneIndex];
    const lockStartImage = generationMode === "single-image" && Boolean(existingScene);
    const nextScene: StoryboardScene = {
      id: editingSceneIndex === null ? crypto.randomUUID() : storyboardScenes[editingSceneIndex]?.id ?? crypto.randomUUID(),
      image: lockStartImage ? existingScene?.image ?? null : sceneStartFrameSource === "manual" ? sceneImage : null,
      imageFile: lockStartImage ? existingScene?.imageFile ?? null : sceneStartFrameSource === "manual" ? sceneImageFile : null,
      endImage: null,
      endImageFile: null,
      prompt: scenePrompt.trim(),
      duration: sceneDuration,
      startFrameSource: sceneStartFrameSource,
      modelParams: sceneModelParams,
    };
    if (editingSceneIndex === null) {
      setStoryboardScenes((current) => [...current, nextScene]);
      setActiveSceneIndex(storyboardScenes.length);
    } else {
      setStoryboardScenes((current) => current.map((scene, index) => index === editingSceneIndex ? nextScene : scene));
      setActiveSceneIndex(editingSceneIndex);
      if (editingSceneIndex === 0 && !isStorylinePromptMode(generationMode)) setPrompt(nextScene.prompt);
    }
    setIsSceneModalOpen(false);
    setEditingSceneIndex(null);
    setSceneImage(null);
    setSceneImageFile(null);
    setSceneStartFrameSource("manual");
    setScenePrompt("");
    setSceneModelParams({});
    setSceneDuration(5);
  };
  const canSaveScene =
    scenePrompt.trim().length > 0 &&
    (sceneStartFrameSource === "previous_last_frame" || Boolean(sceneImage));
  const isGeneratingVideo = generationStatus === "uploading" || generationStatus === "processing";
  const clearValues = () => {
    if (isGeneratingVideo) return;
    clearSource();
    clearFrameReferences();
    clearReferenceImageSlots();
    if (sceneImage?.startsWith("blob:")) URL.revokeObjectURL(sceneImage);
    setSceneImage(null);
    setSceneImageFile(null);
    setIsSceneModalOpen(false);
    setDeleteSceneIndex(null);
    setEditingSceneIndex(null);
    setActiveSceneIndex(0);
    setSceneStartFrameSource("manual");
    setScenePrompt("");
    setSceneDuration(5);
    setSceneModelParams({});
    setSceneError(null);
    setPrompt("");
    setPromptOptimizerEnabled(false);
    setNegativePrompt("");
    setDuration(5);
    setResolution("");
    setAspectRatio("");
    setAutoSound(false);
    setAudioFile(null);
    setPostAudioSfxEnabled(false);
    setPostAudioMusicEnabled(false);
    setGenerationMode("image-to-video");
    setVideoMode("storyboard");
    setSelectedModel(models.find((model) => model.isDefault)?.model ?? models[0]?.model ?? "");
    setModelParams({});
    setNotice(null);
    setIsFinalizingVideo(false);
    setGenerationStatus("idle");
    setGenerationProgress({ completed: 0, total: 0 });
    setFinalVideoUrl(null);
    setPreviewMediaAspectRatioState({ mediaKey: null, ratio: null });
    setLatestCompletedStoryboardId(null);
    setPreviewView("latest");
    setVideoLibraryIndex(0);
    setIsVideoFavorite(false);
    setGenerationError(null);
    setCreditEstimate(null);
    setCreditEstimateError(null);
    setStoryboardScenes([{
      id: "scene-1",
      image: null,
      imageFile: null,
      endImage: null,
      endImageFile: null,
      prompt: "",
      duration: 5,
      startFrameSource: "manual",
      modelParams: {},
    }]);
  };
  const allGenerationScenesHavePrompts = generationScenes.length > 0
    && generationScenes.every((scene) => scene.prompt.trim().length > 0);
  const allManualScenesHaveImages = generationMode === "reference-to-video"
    ? referenceImageUrls.length > 0
    : generationScenes.every((scene, index) => (
      getSceneSource(scene, index) !== "manual" || Boolean(scene.image)
    ));
  const storyboardReady = generationMode !== "single-image"
    || (!storyboardSplitting && hasCurrentStoryboardSlices);
  const missingRequiredModelParameter = settingsModelParameterEntries.find(([name]) => requiredProperties.has(name) && !hasSchemaValue(modelParams[name]));
  const requiredStructuredField = durationProperty && requiredProperties.has(durationProperty[0]) && (!Number.isFinite(duration) || duration <= 0)
    ? durationProperty[0]
    : resolutionProperty && requiredProperties.has(resolutionProperty[0]) && !hasSchemaValue(resolution)
      ? resolutionProperty[0]
      : aspectRatioProperty && requiredProperties.has(aspectRatioProperty[0]) && !hasSchemaValue(aspectRatio)
        ? aspectRatioProperty[0]
        : null;
  const videoValidationMessage = modelsLoading
    ? t("create.video.common.loadingVideoModels")
    : !selectedModel || !selectedModelOption
      ? t("create.video.common.selectVideoModel")
      : generationMode === "reference-to-video" && !supportsReferenceImages
        ? t("create.video.common.unsupportedReferenceImages")
        : generationMode === "reference-to-video" && referenceImageUrls.length === 0
          ? t("create.video.common.addReferenceImage")
          : generationMode === "single-image" && !sourcePreviewImage
            ? t("create.video.common.uploadStoryboardImage")
            : generationMode === "single-image" && storyboardSplitting
              ? t("create.video.common.preparingStoryboard")
                : generationMode === "single-image" && !hasCurrentStoryboardSlices
                  ? t("create.video.common.preparingStoryboardFromImage")
                : generationMode === "multi-scene" && generationScenes.length === 0
                  ? t("create.video.common.addFirstScene")
                : !prompt.trim()
                  ? t("create.video.common.addPrompt")
                  : !storyboardReady
                    ? t("create.video.common.finishStoryboard")
                    : !allGenerationScenesHavePrompts
                      ? t("create.video.common.everyScenePrompt")
                      : !allManualScenesHaveImages
                        ? t("create.video.common.everyManualSceneImage")
                        : requiredStructuredField
                          ? t("create.video.common.parameterRequiredForModel", { parameter: localizedParameterLabel(requiredStructuredField) })
                          : missingRequiredModelParameter
                            ? t("create.video.common.parameterRequiredForModel", { parameter: localizedParameterLabel(missingRequiredModelParameter[0], missingRequiredModelParameter[1].title) })
                            : null;
  const canGenerate = Boolean(!videoValidationMessage && !isGeneratingVideo && !creditEstimateLoading);
  const safeVideoLibraryIndex = Math.min(videoLibraryIndex, Math.max(videoHistory.length - 1, 0));
  const galleryVideoUrl = videoHistory[safeVideoLibraryIndex]?.finalVideoUrl ?? null;
  const latestVideoUrl = finalVideoUrl ?? videoHistory[0]?.finalVideoUrl ?? null;
  const displayedVideoUrl = previewView === "library"
    ? galleryVideoUrl ?? latestVideoUrl
    : previewView === "model"
      ? null
      : latestVideoUrl;
  const previewMediaKey = previewView === "model"
    ? selectedModelOption?.previewUrl ?? null
    : displayedVideoUrl;
  const detectedPreviewMediaAspectRatio = previewMediaAspectRatioState.mediaKey === previewMediaKey
    ? previewMediaAspectRatioState.ratio
    : null;
  const previewMediaAspectRatio = detectedPreviewMediaAspectRatio ?? "16 / 9";
  const handlePreviewAspectRatioChange = useCallback((ratio: string) => {
    setPreviewMediaAspectRatioState({ mediaKey: previewMediaKey, ratio });
  }, [previewMediaKey]);
  const displayedStoryboardId = previewView === "library"
    ? videoHistory[safeVideoLibraryIndex]?.storyboardId ?? latestCompletedStoryboardId
    : latestCompletedStoryboardId ?? videoHistory[0]?.storyboardId ?? null;
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
    if (!selectedModel || !selectedModelOption) {
      setGenerationError(t("create.video.common.selectModel"));
      return;
    }
    if (generationMode === "reference-to-video" && !supportsReferenceImages) {
      setGenerationError(t("create.video.common.unsupportedReferenceImages"));
      return;
    }
    if (generationMode === "reference-to-video" && referenceImageUrls.length === 0) {
      setGenerationError(t("create.video.common.addReferenceImage"));
      return;
    }
    if (!prompt.trim()) {
      setGenerationError(t("create.video.common.addPrompt"));
      return;
    }
    if (generationMode === "single-image" && storyboardSplitting) {
      setGenerationError(t("create.video.common.preparingStoryboard"));
      return;
    }
    if (generationMode === "single-image" && !hasCurrentStoryboardSlices) {
      setGenerationError(t("create.video.common.preparingStoryboardFromImage"));
      return;
    }
    if (generationMode === "multi-scene" && generationScenes.length === 0) {
      setGenerationError(t("create.video.common.addFirstScene"));
      return;
    }
    const missingRequiredParam = settingsModelParameterEntries.find(([name]) => {
      if (!requiredProperties.has(name)) return false;
      const value = modelParams[name];
      return value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
    });
    if (missingRequiredParam) {
      setGenerationError(t("create.video.common.parameterRequiredForModel", { parameter: localizedParameterLabel(missingRequiredParam[0], missingRequiredParam[1].title) }));
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
      setGenerationError(t("create.video.common.parameterRequiredForModel", { parameter: localizedParameterLabel(requiredStructuredField) }));
      return;
    }
    const sceneSources = generationScenes.map((scene, index) => getSceneSource(scene, index));
    if (generationMode !== "reference-to-video" && sceneSources.some((source, index) => source === "manual" && !generationScenes[index].image)) {
      setGenerationError(t("create.video.common.everyManualSceneImage"));
      return;
    }
    if (generationScenes.some((scene) => !scene.prompt.trim())) {
      setGenerationError(t("create.video.common.everyScenePrompt"));
      return;
    }

    setGenerationError(null);
    setFinalVideoUrl(null);
    setLatestCompletedStoryboardId(null);
    setPreviewView("latest");
    setContinuationInfo(null);
    setGenerationStatus("uploading");
    const requestId = crypto.randomUUID();
    emitGenerationSubmitting({ feature: "image-to-video", requestId });
    try {
      const uploadedImages: Array<string | undefined> = [];
      const uploadedReferenceImages: string[] = [];
      for (let index = 0; index < generationScenes.length; index += 1) {
        const scene = generationScenes[index];
        if (generationMode !== "reference-to-video" && sceneSources[index] === "manual") {
          setNotice(t("create.video.common.uploadingScene", { number: index + 1, total: generationScenes.length }));
          const file = await fileFromSceneImage(scene.image as string, index, scene.imageFile);
          uploadedImages[index] = await uploadImageAsset(file, {
            purpose: "content",
            feature: "image-to-video",
            uploadConstraints: capabilities?.uploadConstraints,
          });
        }
      }

      if ((generationMode === "reference-to-video" || generationMode === "single-image") && supportsReferenceImages) {
        for (let index = 0; index < referenceImageEntries.length; index += 1) {
          const entry = referenceImageEntries[index];
          setNotice(t("create.video.common.uploadingReference", { label: t(entry.labelKey).toLowerCase(), number: index + 1, total: referenceImageEntries.length }));
          const file = await fileFromSceneImage(entry.url, index, entry.file, "reference");
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
          prompt: promptForSceneGeneration(scene.prompt.trim()),
          seed: -1,
        };
        if (sceneSources[index] === "manual" && uploadedImages[index]) sceneInput.storyboardImage = uploadedImages[index];
        if (generationMode === "reference-to-video") {
          if (uploadedReferenceImages[0]) sceneInput.storyboardImage = uploadedReferenceImages[0];
          if (uploadedReferenceImages.length > 0) sceneInput.referenceImages = uploadedReferenceImages;
        } else if (uploadedReferenceImages.length > 0) {
          sceneInput.referenceImages = uploadedReferenceImages;
        }
        if (negativePrompt.trim()) sceneInput.negativePrompt = negativePrompt.trim();
        if (durationProperty) sceneInput.duration = scene.duration;
        if (scene.aspectRatio) sceneInput.aspectRatio = scene.aspectRatio;
        const sceneModelParams = modelParamsForGeneration(scene.modelParams, properties);
        if (Object.keys(sceneModelParams).length) sceneInput.modelParams = sceneModelParams;
        return sceneInput;
      });
      const request: VideoGenerationInput = {
        model: selectedModel,
        mode: generationMode === "single-image" || isSingleSceneGenerationMode(generationMode) ? "storyboard" : videoMode,
        generationMode,
        scenes,
        autoUpscale: shouldAutoUpscaleStoryboard,
        idempotencyKey: `video-${crypto.randomUUID()}`,
        promptOptimizerEnabled,
      };
      if (durationProperty) request.duration = duration;
      if (resolutionProperty && resolution) request.resolution = resolution;
      if (supportsAspectRatio && aspectRatio && !storyboardHasMixedAspectRatios) request.aspectRatio = aspectRatio;
      if (audioInputMode && audioFile) {
        setNotice(t("create.video.common.uploadingAudioReference"));
        request.audioUrl = await uploadPeopleMedia(audioFile, undefined, capabilities?.uploadConstraints);
      }
      if (postAudioMode !== "none") {
        request.audioMode = postAudioMode;
      }
      if (Object.keys(requestModelParams).length) request.modelParams = requestModelParams;
      if (audioProperty && !audioInputMode) {
        if (["generateAudio", "generate_audio"].includes(audioProperty[0])) request.generateAudio = autoSound;
        else request.modelParams = { ...(request.modelParams ?? {}), [audioProperty[0]]: autoSound };
      }

      setNotice(t("create.video.common.submittingVideo"));
      const created = await createVideoStoryboard(request);
      if (!created.storyboardId) throw new Error("Video generation did not return a storyboard ID");
      emitGenerationStarted({ feature: "image-to-video", requestId, generationId: created.storyboardId, pollUrl: created.pollUrl ?? `/api/v1/generations/video/image-to-video/${encodeURIComponent(created.storyboardId)}/status`, workspaceId: workspaceId ?? undefined, model: selectedModel, status: "queued", totalCount: created.totalScenes ?? scenes.length, completedCount: created.completedScenes ?? 0 });
      const returnedCreditCost = Number(created.totalCreditCost);
      const quotedVideoCreditCost = Number(creditEstimate);
      // The create response may only contain the first scene for continuous
      // jobs, so prefer the full quote shown for this request.
      const acceptedVideoCreditCost = Number.isFinite(quotedVideoCreditCost) && quotedVideoCreditCost > 0
        ? quotedVideoCreditCost
        : returnedCreditCost;
      const acceptedCreditCost = acceptedVideoCreditCost;
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
        const audioMode = status.audioMode ?? status.audio?.mode ?? postAudioMode;
        const finalizing = status.status === "processing"
          && audioMode !== "none"
          && (status.totalScenes ?? scenes.length) > 0
          && (status.completedScenes ?? 0) >= (status.totalScenes ?? scenes.length);
        setIsFinalizingVideo(finalizing);
        setGenerationProgress({ completed: status.completedScenes ?? 0, total: status.totalScenes ?? scenes.length });
        setContinuationInfo(status.continuation ?? null);
        setNotice(finalizing
          ? t("create.video.common.finalizingVideoDetail")
          : generationMode === "single-image"
          ? t("create.video.common.generatingFromStoryboardImage")
          : t("create.video.common.generatingScenesProgress", { completed: status.completedScenes ?? 0, total: status.totalScenes ?? scenes.length }));
        await new Promise((resolve) => window.setTimeout(resolve, 2500));
        status = await getVideoStoryboardStatus(created.storyboardId);
      }
      setGenerationProgress({ completed: status.completedScenes ?? scenes.length, total: status.totalScenes ?? scenes.length });
      setContinuationInfo(status.continuation ?? null);
      setIsFinalizingVideo(false);
      if (status.status !== "completed") {
        requestCreditBalanceSync(acceptedCreditCost);
        throw generationErrorFromStatus(status, status.status === "cancelled" ? "Video generation was cancelled" : "Video generation failed");
      }
      if (!status.finalVideoUrl) {
        requestCreditBalanceSync(acceptedCreditCost);
        throw new Error("Video generation completed without a final video URL");
      }
      setFinalVideoUrl(status.finalVideoUrl);
      setLatestCompletedStoryboardId(created.storyboardId);
      setPreviewView("latest");
      setGenerationStatus("completed");
      setNotice(t("create.video.common.videoReady"));
      requestCreditBalanceSync(acceptedCreditCost);
      const completedWorkspaceId = status.workspaceId ?? workspaceId ?? undefined;
      const completedHistoryItem: VideoStoryboardHistoryItem = {
        storyboardId: created.storyboardId,
        ...(completedWorkspaceId ? { workspaceId: completedWorkspaceId } : {}),
        provider: selectedModelOption?.provider,
        model: selectedModel,
        mode: request.mode,
        status: "completed",
        totalScenes: status.totalScenes ?? scenes.length,
        totalDuration: status.totalDuration ?? request.duration ?? null,
        finalVideoUrl: status.finalVideoUrl,
        createdAt: new Date().toISOString(),
      };
      setVideoHistory((current) => [
        completedHistoryItem,
        ...current.filter((item) => item.storyboardId !== completedHistoryItem.storyboardId),
      ]);
      setVideoLibraryIndex(0);
      void loadVideoHistory(completedWorkspaceId).then(() => {
        setVideoHistory((current) => current.some((item) => item.storyboardId === completedHistoryItem.storyboardId)
          ? current
          : [completedHistoryItem, ...current]);
      });
    } catch (error: unknown) {
      emitGenerationRequestFailed({ feature: "image-to-video", requestId });
      const message = formatGenerationError(error, "Unable to generate video");
      setGenerationStatus("failed");
      setGenerationError(message);
      setNotice(null);
    }
  };

  useTemplateSettings('video',{ready:!modelsLoading&&activeVideoTab==='image-to-video',model:selectedModel,models:models.map(m=>m.model),setModel:setSelectedModel,apply:(s,p)=>{
    setPrompt(p); setNegativePrompt(typeof s.negativePrompt==='string'?s.negativePrompt:'');
    if(typeof s.duration==='number')setDuration(s.duration);
    if(typeof s.resolution==='string')setResolution(s.resolution);
    if(typeof s.aspectRatio==='string')setAspectRatio(s.aspectRatio);
    const image=typeof s.sourceImage==='string'?s.sourceImage:null;
    if(image)setSourceImage(image);
    setStoryboardScenes(current=>current.map((scene,i)=>i===0&&!isStorylinePromptMode(generationMode)?{...scene,image,prompt:p,duration:typeof s.duration==='number'?s.duration:scene.duration,modelParams:s.modelParams&&typeof s.modelParams==='object'?s.modelParams as Record<string,unknown>:{}}:scene));
    if(Array.isArray(s.scenes)&&s.scenes.length) setStoryboardScenes(s.scenes.map((raw,i)=>{
      const scene=raw as Record<string,unknown>;
      return {id:`template-scene-${i+1}`,image:typeof scene.sourceImage==='string'?scene.sourceImage:null,imageFile:null,endImage:null,endImageFile:null,prompt:typeof scene.prompt==='string'?scene.prompt:'',duration:typeof scene.duration==='number'?scene.duration:5,startFrameSource:scene.startFrameSource==='previous_last_frame'?'previous_last_frame':'manual',modelParams:scene.modelParams&&typeof scene.modelParams==='object'?scene.modelParams as Record<string,unknown>:{}};
    }));
    setPromptOptimizerEnabled(s.promptOptimizerEnabled===true);
  }});

  return {
    activeVideoTab,
    visitedVideoTabs,
    storyboardSlices,
    storyboardGridLabel,
    storyboardQualityNote,
    storyboardSplitting,
    prompt,
    setPrompt,
    promptOptimizerEnabled,
    setPromptOptimizerEnabled,
    negativePrompt,
    setNegativePrompt,
    duration,
    resolution,
    setResolution,
    aspectRatio,
    setAspectRatio,
    autoSound,
    setAutoSound,
    audioFile,
    setAudioFile,
    postAudioSfxEnabled,
    setPostAudioSfxEnabled,
    postAudioMusicEnabled,
    setPostAudioMusicEnabled,
    generationMode,
    videoMode,
    models,
    selectedModel,
    setSelectedModel,
    modelsLoading,
    setModelsLoading,
    modelsError,
    setModelsError,
    setModelLoadRetry,
    maxStoryboardScenes,
    modelParams,
    notice,
    generationStatus,
    generationProgress,
    isFinalizingVideo,
    previewView,
    setPreviewView,
    setVideoLibraryIndex,
    isVideoFavorite,
    setIsVideoFavorite,
    videoRecentScrollState,
    videoHistory,
    videoHistoryLoading,
    videoHistoryError,
    continuationInfo,
    generationError,
    creditEstimateLoading,
    creditEstimateError,
    frameReferences,
    referenceImageSlots,
    detectedImageAspectRatio,
    storyboardHasMixedAspectRatios,
    storyboardScenes,
    setStoryboardScenes,
    isSceneModalOpen,
    deleteSceneIndex,
    editingSceneIndex,
    activeSceneIndex,
    sceneImage,
    sceneStartFrameSource,
    setSceneStartFrameSource,
    scenePrompt,
    setScenePrompt,
    sceneDuration,
    setSceneDuration,
    sceneModelParams,
    setSceneModelParams,
    sceneError,
    setSceneError,
    isSourceImageDragging,
    isFrameDragging,
    setIsFrameDragging,
    isSceneImageDragging,
    setIsSceneImageDragging,
    isAudioDragging,
    setIsAudioDragging,
    sceneScrollState,
    localizedParameterLabel,
    router,
    initialPeopleVideoVariant,
    videoRecentRowRef,
    audioInputRef,
    sceneRowRef,
    selectVideoTab,
    selectedModelOption,
    supportsReferenceImages,
    referenceModeHasNoModel,
    requiredProperties,
    durationProperty,
    resolutionProperty,
    aspectRatioOptions,
    supportsAspectRatio,
    canSelectAspectRatio,
    audioProperty,
    audioInputMode,
    supportsPostAudioSfx,
    supportsPostAudioMusic,
    showPostAudioOptions,
    postAudioMode,
    modelParameterEntries,
    settingsModelParameterEntries,
    uploadSource,
    handleSourceImageDragOver,
    handleSourceImageDragLeave,
    handleSourceImageDrop,
    clearSource,
    updateDuration,
    updateModelParam,
    addFrame,
    handleFrameDrop,
    addReferenceImage,
    handleAudioFile,
    handleAudioDrop,
    handleSceneImageFile,
    handleSceneImageDrop,
    clearFrameReferences,
    clearReferenceImageSlots,
    removeReferenceImage,
    scrollScenes,
    selectGenerationMode,
    updateSceneSource,
    getSceneSource,
    sourcePreviewImage,
    hasNativeExtend,
    hasCurrentStoryboardSlices,
    generationScenes,
    shouldAutoUpscaleStoryboard,
    estimateDescription,
    totalCreditEstimate,
    formattedCreditEstimate,
    sceneLimitReached,
    canAddScene,
    addSceneDisabledReason,
    selectedVideoMode,
    openSceneModal,
    openEditSceneModal,
    deleteScene,
    closeDeleteSceneDialog,
    confirmDeleteScene,
    closeSceneModal,
    clearSceneModalImage,
    saveScene,
    canSaveScene,
    isGeneratingVideo,
    clearValues,
    videoValidationMessage,
    canGenerate,
    safeVideoLibraryIndex,
    latestVideoUrl,
    displayedVideoUrl,
    previewMediaAspectRatio,
    handlePreviewAspectRatioChange,
    displayedStoryboardId,
    downloadDisplayedVideo,
    handleGenerate,
    locale,
    t,
  };
}

export type VideoGenerationPageState = ReturnType<typeof useVideoGenerationPage>;
