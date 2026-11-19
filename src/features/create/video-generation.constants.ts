import { ImageIcon, Mic2, WandSparkles, type LucideIcon } from "lucide-react";
import { type TranslationKey } from "@/lib/i18n/locale-provider";
import { type VideoModeCopyValue } from "./video-generation.types";

export const videoModes = [
  "Image to Video",
  "Text to Video",
  "Motion Transfer",
  "Lipsync",
  "Extend Video",
] as const;

export const videoTabValues = {
  "Image to Video": "image-to-video",
  "Text to Video": "text-to-video",
  "Motion Transfer": "motion-transfer",
  Lipsync: "people-video",
  "Extend Video": "extend-video",
} as const;

export const videoTabKeys = {
  "Image to Video": "create.video.tabs.imageToVideo",
  "Text to Video": "create.video.tabs.textToVideo",
  "Motion Transfer": "create.video.tabs.motionTransfer",
  Lipsync: "create.video.tabs.lipsync",
  "Extend Video": "create.video.tabs.extendVideo",
} as const;

export const videoModeIcons: Record<typeof videoModes[number], LucideIcon> = {
  "Image to Video": ImageIcon,
  "Text to Video": WandSparkles,
  "Motion Transfer": WandSparkles,
  Lipsync: Mic2,
  "Extend Video": ImageIcon,
};

export const mobileVideoModeOptions = [
  { value: "image-to-video", label: "Image to Video", icon: videoModeIcons["Image to Video"] },
  { value: "text-to-video", label: "Text to Video", icon: videoModeIcons["Text to Video"] },
  { value: "motion-transfer", label: "Motion Transfer", icon: videoModeIcons["Motion Transfer"] },
  { value: "people-video", label: "Lipsync", icon: videoModeIcons.Lipsync },
  { value: "extend-video", label: "Extend Video", icon: videoModeIcons["Extend Video"] },
] as const;

/** The tab last picked in this browser, so a refresh opens the same tool again. */
export const VIDEO_TAB_STORAGE_KEY = "eos.video.active-tab";

export const videoModeOptions = [
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

export const generationModeOptions = [
  {
    value: "image-to-video",
    label: "Image to Video",
    description: "Generate one video from one image",
  },
  {
    value: "reference-to-video",
    label: "Reference to Video",
    description: "Use reference images to guide one video",
  },
  {
    value: "single-image",
    label: "Single Storyboard Image",
    description: "Split the uploaded sheet into scenes automatically",
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
] as const;

export const generationModeCopyKeys: Record<VideoModeCopyValue, { labelKey: TranslationKey; descriptionKey: TranslationKey }> = {
  storyboard: { labelKey: "create.video.generationModes.storyboard", descriptionKey: "create.video.generationModes.storyboardDescription" },
  continuous: { labelKey: "create.video.generationModes.continuous", descriptionKey: "create.video.generationModes.continuousDescription" },
  flexible: { labelKey: "create.video.generationModes.flexible", descriptionKey: "create.video.generationModes.flexibleDescription" },
  "image-to-video": { labelKey: "create.video.generationModes.imageToVideo", descriptionKey: "create.video.generationModes.imageToVideoDescription" },
  "reference-to-video": { labelKey: "create.video.generationModes.referenceToVideo", descriptionKey: "create.video.generationModes.referenceToVideoDescription" },
  "single-image": { labelKey: "create.video.generationModes.singleImage", descriptionKey: "create.video.generationModes.singleImageDescription" },
  "multi-scene": { labelKey: "create.video.generationModes.multiScene", descriptionKey: "create.video.generationModes.multiSceneDescription" },
};

export const sceneSourceOptions = [
  { value: "manual", label: "New image" },
  { value: "previous_last_frame", label: "Previous frame" },
] as const;

export const referenceImageRoles = [
  { key: "avatar", labelKey: "create.video.common.avatar", descriptionKey: "create.video.common.avatarDescription" },
  { key: "product", labelKey: "create.video.common.product", descriptionKey: "create.video.common.productDescription" },
] as const;

export const DEFAULT_MAX_STORYBOARD_SCENES = 12;

export const HARD_MAX_STORYBOARD_SCENES = 100;

export const coreModelParameterNames = new Set([
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

export const referenceImageParameterAliases = [
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

export const lastImageParameterAliases = [
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

export const referenceAudioParameterAliases = [
  "reference_audios",
  "referenceAudios",
  "reference_audio",
  "referenceAudio",
];

export const referenceVideoParameterAliases = [
  "reference_videos",
  "referenceVideos",
  "reference_video",
  "referenceVideo",
];
