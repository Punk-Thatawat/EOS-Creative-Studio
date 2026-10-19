"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { ArrowRight, AudioLines, Check, ChevronDown, CloudUpload, Copy, GripVertical, LoaderCircle, LockKeyhole, MoreHorizontal, Plus, Sparkles, Video, WandSparkles, X } from "lucide-react";
import { EosVideoPlayer } from "@/components/media/eos-video-player";
import { useLocale } from "@/lib/i18n/locale-provider";
import { createTextToSpeech, listAudioModels, listAudioVoices, quoteTextToSpeech, type AudioCreditQuote, type AudioModel, type AudioVoice } from "@/lib/api/audio";
import { createLipsyncGeneration, getLipsyncGenerationStatus, type LipsyncGenerationResponse, type LipsyncGenerationStatus } from "@/lib/api/lipsync-generations";
import { listGenerationModels, type GenerationModelOption } from "@/lib/api/generation-models";
import { uploadPeopleMedia } from "@/lib/api/people-video-generations";
import { quoteDirectVideoGeneration } from "@/lib/api/video-generations";
import { emitGenerationCompleted, emitGenerationRequestFailed, emitGenerationRequestFinished, emitGenerationStarted, emitGenerationSubmitting } from "@/lib/generation-progress-events";
import { formatGenerationError, generationErrorFromStatus } from "@/lib/api/generation-errors";
import { useVideoGenerationResume, type ResumableVideoStatus } from "@/features/create/use-video-generation-resume";
import { VideoPreviewLiveBadge, VideoPreviewOverlayActions, VideoPreviewPlaceholder } from "../video-preview-placeholder";
import videoPreviewStyles from "../video-generation-page.module.css";
import styles from "./ai-presenter-page.module.css";

const sampleScript = "Welcome to EOS Creative Studio. Turn your ideas into stories, and your stories into impact.";
const defaultPresenterImage = "/ai-presenter/presenter-mouth-open.png";
const toneOptions = [
  { label: "Corporate", value: "Premium" },
  { label: "Friendly", value: "Friendly" },
  { label: "Confident", value: "Dramatic" },
  { label: "Energetic", value: "Energetic" },
] as const;
const aspectOptions = ["16:9", "9:16", "1:1"] as const;
const elevenLabsModelAliases = new Set([
  "eleven_multilingual_v2",
  "eleven_flash_v2_5",
  "eleven_turbo_v2_5",
  "eleven_v3",
  "elevenlabs_multilingual_v2",
  "elevenlabs_flash_v2_5",
  "elevenlabs_turbo_v2_5",
  "elevenlabs_v3",
]);

type SourceMedia = { file?: File; fileName: string; previewUrl: string; kind: "image" | "video"; remoteUrl?: string; defaultAsset?: string; uploading: boolean; error?: string };
type SpeechPreview = { key: string; blob: Blob; url: string; durationSeconds?: number; remoteUrl?: string };
type PresenterScene = { id: string; title: string; script: string };

const presenterOptions = [
  { id: "eos-host", name: "EOS Host", style: "Corporate", image: defaultPresenterImage, objectPosition: "center 28%" },
  { id: "news-host", name: "News Host", style: "Studio", image: "/generated-icons-v2/jobs/ai-presenter-video.png", objectPosition: "center 24%" },
  { id: "office-host", name: "Office Host", style: "Business", image: "/generated-icons-v2/projects/ai-presenter.png", objectPosition: "64% 40%" },
  { id: "training-host", name: "Training Host", style: "Training", image: "/generated-icons-v2/templates/training-video.png", objectPosition: "43% 25%" },
] as const;

function estimatedDuration(script: string, language: string): number {
  const text = script.trim();
  if (!text) return 3;
  const spokenUnits = language === "th" ? text.replace(/\s/g, "").length / 12 : text.split(/\s+/).length;
  return Math.max(3, Math.min(60, Math.ceil(spokenUnits / (language === "th" ? 1 : 2.45))));
}

function formatTimelineTime(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  return `${Math.floor(safeSeconds / 60).toString().padStart(2, "0")}:${(safeSeconds % 60).toString().padStart(2, "0")}`;
}

function outputVideoUrl(status: ResumableVideoStatus | LipsyncGenerationResponse | LipsyncGenerationStatus): string | undefined {
  if ("finalVideoUrl" in status && typeof status.finalVideoUrl === "string") return status.finalVideoUrl;
  if ("videoUrl" in status && typeof status.videoUrl === "string") return status.videoUrl;
  const output = "output" in status && Array.isArray(status.output) ? status.output : [];
  const item = output.find((entry) => typeof entry?.url === "string" && entry.url);
  return item?.url;
}

function progressPercent(status: { status?: string; progress?: number }, fallback: number): number {
  if (status.status === "completed") return 100;
  const progress = Number(status.progress);
  if (!Number.isFinite(progress)) return fallback;
  return Math.max(0, Math.min(99, Math.round(progress <= 1 ? progress * 100 : progress)));
}

function readAudioDuration(blob: Blob): Promise<number | undefined> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const audio = new Audio();
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      const duration = Number.isFinite(audio.duration) ? Math.max(1, Math.ceil(audio.duration)) : undefined;
      URL.revokeObjectURL(url);
      resolve(duration);
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(undefined);
    };
    audio.src = url;
  });
}

function waitForPoll(signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Generation cancelled", "AbortError"));
      return;
    }
    const timer = window.setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, 2500);
    const onAbort = () => {
      window.clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      reject(new DOMException("Generation cancelled", "AbortError"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function modelSupports(model: GenerationModelOption, kind: SourceMedia["kind"] | undefined): boolean {
  const capabilities = model.capabilities;
  const parameters = capabilities.parameters ?? [];
  if (parameters.length === 0) return false;
  if (!capabilities.audioParameter) return false;
  if (kind === "image") return Boolean(capabilities.imageParameter || capabilities.referenceImagesParameter);
  if (kind === "video") return Boolean(capabilities.videoParameter);
  return Boolean(capabilities.imageParameter || capabilities.referenceImagesParameter || capabilities.videoParameter);
}

function isElevenLabsSpeechModel(model: AudioModel): boolean {
  const key = model.key.trim().toLowerCase();
  return key.startsWith("elevenlabs/") || elevenLabsModelAliases.has(key);
}

export function AiPresenterPage() {
  const { locale } = useLocale();
  const isThai = locale === "th";
  const sourceInputRef = useRef<HTMLInputElement>(null);
  const uploadControllerRef = useRef<AbortController | null>(null);
  const generationControllerRef = useRef<AbortController | null>(null);
  const [scenes, setScenes] = useState<PresenterScene[]>([{ id: "scene-1", title: "Intro", script: sampleScript }]);
  const [activeSceneId, setActiveSceneId] = useState("scene-1");
  const [showAllPresenters, setShowAllPresenters] = useState(false);
  const [isReorderingScenes, setIsReorderingScenes] = useState(false);
  const [tone, setTone] = useState<(typeof toneOptions)[number]["value"]>("Premium");
  const [language, setLanguage] = useState("en");
  const [pronunciation, setPronunciation] = useState("");
  const [sourceMedia, setSourceMedia] = useState<SourceMedia | null>({
    fileName: "AI Presenter reference.png",
    previewUrl: defaultPresenterImage,
    kind: "image",
    defaultAsset: defaultPresenterImage,
    uploading: false,
  });
  const [lipsyncModels, setLipsyncModels] = useState<GenerationModelOption[]>([]);
  const [audioModels, setAudioModels] = useState<AudioModel[]>([]);
  const [voices, setVoices] = useState<AudioVoice[]>([]);
  const [selectedLipsyncModel, setSelectedLipsyncModel] = useState("");
  const [selectedAudioModel, setSelectedAudioModel] = useState("");
  const [selectedVoice, setSelectedVoice] = useState("");
  const [aspect, setAspect] = useState<(typeof aspectOptions)[number]>("16:9");
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [catalogError, setCatalogError] = useState("");
  const [speechQuote, setSpeechQuote] = useState<AudioCreditQuote | null>(null);
  const [speechQuoteLoading, setSpeechQuoteLoading] = useState(false);
  const [speech, setSpeech] = useState<SpeechPreview | null>(null);
  const [speechBusy, setSpeechBusy] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<"idle" | "uploading" | "processing" | "completed" | "failed">("idle");
  const [generationProgress, setGenerationProgress] = useState(0);
  const [finalVideoUrl, setFinalVideoUrl] = useState("");
  const [generationError, setGenerationError] = useState("");
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState(false);

  const script = useMemo(() => scenes.map((scene) => scene.script).join("\n\n").trim(), [scenes]);
  const activeScene = scenes.find((scene) => scene.id === activeSceneId) ?? scenes[0];
  const allScenesHaveScript = scenes.every((scene) => Boolean(scene.script.trim()));
  const sceneTimeline = useMemo(() => {
    let elapsedSeconds = 0;
    return scenes.map((scene) => {
      const start = elapsedSeconds;
      const durationSeconds = scene.script.trim() ? estimatedDuration(scene.script, language) : 0;
      elapsedSeconds += durationSeconds;
      return { scene, start, end: elapsedSeconds };
    });
  }, [language, scenes]);
  const otherSceneTextLength = scenes.reduce((length, scene) => scene.id === activeScene?.id ? length : length + scene.script.length, 0) + Math.max(0, scenes.length - 1) * 2;
  const activeSceneMaxLength = Math.max(activeScene?.script.length ?? 0, 5000 - otherSceneTextLength);
  const canAddScene = scenes.length < 6 && script.length + 2 <= 5000;

  const availableAudioModels = useMemo(() => audioModels.filter(isElevenLabsSpeechModel), [audioModels]);
  const availableLipsyncModels = useMemo(
    () => lipsyncModels.filter((model) => model.enabled && modelSupports(model, sourceMedia?.kind)),
    [lipsyncModels, sourceMedia?.kind],
  );
  const selectedVideoModel = availableLipsyncModels.find((model) => model.model === selectedLipsyncModel);
  const duration = speech?.key === JSON.stringify([script, selectedVoice, selectedAudioModel, language, tone, pronunciation.trim()]) && speech.durationSeconds
    ? speech.durationSeconds
    : estimatedDuration(script, language);
  const speechKey = JSON.stringify([script, selectedVoice, selectedAudioModel, language, tone, pronunciation.trim()]);
  const currentSpeech = speech?.key === speechKey ? speech : null;
  const isGenerating = generationStatus === "uploading" || generationStatus === "processing";
  const isLocked = isGenerating || speechBusy;

  useEffect(() => {
    let active = true;
    void Promise.allSettled([listGenerationModels("lipsync"), listAudioModels("textToSpeech")]).then(([videoResult, audioResult]) => {
      if (!active) return;
      const errors: string[] = [];
      if (videoResult.status === "fulfilled") {
        const models = videoResult.value.filter((model) => model.enabled);
        setLipsyncModels(models);
        setSelectedLipsyncModel(models.find((model) => model.isDefault && modelSupports(model, undefined))?.model ?? models.find((model) => modelSupports(model, undefined))?.model ?? "");
      } else errors.push(isThai ? "โหลดโมเดลวิดีโอไม่สำเร็จ" : "Could not load presenter video models");
      if (audioResult.status === "fulfilled") {
        const models = audioResult.value.filter(isElevenLabsSpeechModel);
        setAudioModels(models);
        const selectedModel = models.find((model) => model.isActive)
          ?? models.find((model) => model.key.toLowerCase() === "eleven_v3")
          ?? models[0];
        setSelectedAudioModel(selectedModel?.key ?? "");
        if (!models.length) errors.push(isThai ? "ไม่พบโมเดลเสียง ElevenLabs ที่เปิดใช้งาน" : "No ElevenLabs speech model is available");
      } else errors.push(isThai ? "โหลดโมเดลเสียงไม่สำเร็จ" : "Could not load speech models");
      setCatalogError(errors.join(" · "));
      setCatalogLoading(false);
    });
    return () => { active = false; };
  }, [isThai]);

  useEffect(() => {
    if (!selectedAudioModel) {
      setVoices([]);
      setSelectedVoice("");
      return;
    }
    let active = true;
    setVoiceLoading(true);
    void listAudioVoices(selectedAudioModel, "textToSpeech").then((items) => {
      if (!active) return;
      setVoices(items);
      setSelectedVoice((current) => items.some((voice) => voice.key === current) ? current : (items[0]?.key ?? ""));
      setVoiceLoading(false);
    }).catch(() => {
      if (!active) return;
      setVoices([]);
      setSelectedVoice("");
      setVoiceLoading(false);
    });
    return () => { active = false; };
  }, [selectedAudioModel]);

  useEffect(() => {
    if (!selectedVideoModel) return;
    const ratios = selectedVideoModel.capabilities.supportedRatios ?? [];
    const supported = aspectOptions.filter((value) => ratios.some((ratio) => ratio.toLowerCase() === value.toLowerCase()));
    if (supported.length && !supported.includes(aspect)) setAspect(supported[0]);
  }, [selectedVideoModel, aspect]);

  useEffect(() => {
    if (selectedLipsyncModel && !availableLipsyncModels.some((model) => model.model === selectedLipsyncModel)) {
      setSelectedLipsyncModel(availableLipsyncModels.find((model) => model.isDefault)?.model ?? availableLipsyncModels[0]?.model ?? "");
    }
  }, [availableLipsyncModels, selectedLipsyncModel]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const ready = Boolean(script.trim() && allScenesHaveScript && selectedVoice && selectedAudioModel);
    if (!ready) {
      setSpeechQuote(null);
      setSpeechQuoteLoading(false);
      return () => { active = false; controller.abort(); };
    }
    setSpeechQuoteLoading(true);
    const timer = window.setTimeout(() => {
      void quoteTextToSpeech({
        text: script.trim(), voice: selectedVoice, modelId: selectedAudioModel, outputFormat: "mp3", languageCode: language,
        tone, speed: 1, pronunciationHint: pronunciation.trim() || undefined,
      }, controller.signal).then((quote) => {
        if (active) setSpeechQuote(quote);
      }).catch(() => {
        if (active) setSpeechQuote(null);
      }).finally(() => {
        if (active) setSpeechQuoteLoading(false);
      });
    }, 350);
    return () => { active = false; controller.abort(); window.clearTimeout(timer); };
  }, [script, allScenesHaveScript, selectedVoice, selectedAudioModel, language, tone, pronunciation]);

  useEffect(() => {
    const previewUrl = sourceMedia?.previewUrl;
    return () => { if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl); };
  }, [sourceMedia?.previewUrl]);

  useEffect(() => {
    const previewUrl = speech?.url;
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); };
  }, [speech?.url]);

  const applyResumedStatus = useCallback((status: ResumableVideoStatus) => {
    const id = status.id ?? status.generationId;
    if (status.status === "completed") {
      const url = outputVideoUrl(status);
      if (url) setFinalVideoUrl(url);
      setGenerationProgress(100);
      setGenerationStatus("completed");
      setGenerationError("");
      setNotice(isThai ? "วิดีโอพร้อมแล้ว" : "Your presenter video is ready.");
      if (id) emitGenerationCompleted({ feature: "lipsync", generationId: id });
      return;
    }
    if (status.status === "failed" || status.status === "cancelled") {
      setGenerationStatus("failed");
      setGenerationError(formatGenerationError(generationErrorFromStatus(status, "Presenter video generation failed"), isThai ? "สร้างวิดีโอไม่สำเร็จ" : "Unable to generate the presenter video"));
      return;
    }
    setGenerationStatus("processing");
    setGenerationProgress(progressPercent(status, 8));
  }, [isThai]);

  useVideoGenerationResume({
    feature: "lipsync",
    isGenerating,
    loadStatus: (pollUrl, signal) => getLipsyncGenerationStatus(pollUrl, signal),
    onStatus: (status) => applyResumedStatus(status),
  });

  useEffect(() => {
    if (speech && speech.key !== speechKey) {
      URL.revokeObjectURL(speech.url);
      setSpeech(null);
    }
  }, [speech, speechKey]);

  useEffect(() => {
    setFinalVideoUrl("");
    setGenerationError("");
    setNotice("");
    setGenerationStatus((status) => status === "completed" || status === "failed" ? "idle" : status);
  }, [speechKey, selectedLipsyncModel, aspect, sourceMedia?.remoteUrl]);

  const videoQuoteInput = useMemo(() => {
    if (!sourceMedia || !selectedVideoModel || !script.trim()) return null;
    return {
      feature: "lipsync" as const,
      model: selectedVideoModel.model,
      prompt: script.trim(),
      duration,
      aspectRatio: aspect,
      ...(sourceMedia.remoteUrl ? (sourceMedia.kind === "image" ? { sourceImage: sourceMedia.remoteUrl } : { sourceVideo: sourceMedia.remoteUrl }) : {}),
    };
  }, [sourceMedia, selectedVideoModel, script, duration, aspect]);
  const [videoCreditCost, setVideoCreditCost] = useState<number | null>(null);
  const [videoQuoteLoading, setVideoQuoteLoading] = useState(false);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    if (!videoQuoteInput) {
      setVideoCreditCost(null);
      setVideoQuoteLoading(false);
      return () => { active = false; controller.abort(); };
    }
    setVideoQuoteLoading(true);
    void quoteDirectVideoGeneration(videoQuoteInput, controller.signal).then((quote) => {
      if (active) setVideoCreditCost(Number.isFinite(Number(quote.creditCost)) ? Number(quote.creditCost) : null);
    }).catch(() => {
      if (active) setVideoCreditCost(null);
    }).finally(() => { if (active) setVideoQuoteLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [videoQuoteInput]);

  const handleSourceChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    uploadControllerRef.current?.abort();
    const controller = new AbortController();
    uploadControllerRef.current = controller;
    const previewUrl = URL.createObjectURL(file);
    const next: SourceMedia = { file, fileName: file.name, previewUrl, kind: file.type.startsWith("video/") ? "video" : "image", uploading: true };
    setSourceMedia(next);
    setFinalVideoUrl("");
    setGenerationError("");
    try {
      const remoteUrl = await uploadPeopleMedia(file, controller.signal, selectedVideoModel?.capabilities.uploadConstraints);
      if (controller.signal.aborted) return;
      setSourceMedia((current) => current?.file === file ? { ...current, remoteUrl, uploading: false } : current);
    } catch (error) {
      if (controller.signal.aborted) return;
      setSourceMedia((current) => current?.file === file ? { ...current, uploading: false, error: error instanceof Error ? error.message : "Media upload failed" } : current);
    }
  };

  const handleRemoveSource = () => {
    uploadControllerRef.current?.abort();
    if (sourceMedia?.previewUrl.startsWith("blob:")) URL.revokeObjectURL(sourceMedia.previewUrl);
    setSourceMedia(null);
    setFinalVideoUrl("");
  };

  const choosePresenter = (presenter: (typeof presenterOptions)[number]) => {
    uploadControllerRef.current?.abort();
    setSourceMedia({
      fileName: `${presenter.name}.png`,
      previewUrl: presenter.image,
      kind: "image",
      defaultAsset: presenter.image,
      uploading: false,
    });
    setFinalVideoUrl("");
    setGenerationError("");
    setNotice("");
  };

  const updateActiveScene = (update: Partial<PresenterScene>) => {
    if (!activeScene) return;
    setScenes((current) => current.map((scene) => scene.id === activeScene.id ? { ...scene, ...update } : scene));
    setFinalVideoUrl("");
    setGenerationError("");
  };

  const addScene = () => {
    if (!canAddScene) return;
    const id = crypto.randomUUID();
    setScenes((current) => [...current, { id, title: `Scene ${current.length + 1}`, script: "" }]);
    setActiveSceneId(id);
    setFinalVideoUrl("");
    setGenerationError("");
  };

  const removeScene = (sceneId: string) => {
    if (scenes.length <= 1) return;
    const removedIndex = scenes.findIndex((scene) => scene.id === sceneId);
    const nextScenes = scenes.filter((scene) => scene.id !== sceneId);
    setScenes(nextScenes);
    if (activeSceneId === sceneId) setActiveSceneId(nextScenes[Math.max(0, removedIndex - 1)]?.id ?? nextScenes[0]!.id);
    setFinalVideoUrl("");
    setGenerationError("");
  };

  const reorderScenes = (draggedId: string, targetId: string) => {
    if (!draggedId || draggedId === targetId) return;
    setScenes((current) => {
      const fromIndex = current.findIndex((scene) => scene.id === draggedId);
      const toIndex = current.findIndex((scene) => scene.id === targetId);
      if (fromIndex < 0 || toIndex < 0) return current;
      const next = [...current];
      const [draggedScene] = next.splice(fromIndex, 1);
      if (!draggedScene) return current;
      next.splice(toIndex, 0, draggedScene);
      return next;
    });
    setFinalVideoUrl("");
  };

  const generateSpeech = async (): Promise<SpeechPreview> => {
    const result = await createTextToSpeech({
      text: script.trim(), voice: selectedVoice, modelId: selectedAudioModel, outputFormat: "mp3", languageCode: language,
      tone, speed: 1, pronunciationHint: pronunciation.trim() || undefined, idempotencyKey: crypto.randomUUID(),
    });
    const url = URL.createObjectURL(result.blob);
    const durationSeconds = await readAudioDuration(result.blob);
    const next = { key: speechKey, blob: result.blob, url, durationSeconds };
    setSpeech((current) => { if (current) URL.revokeObjectURL(current.url); return next; });
    return next;
  };

  const handleGenerateSpeech = async () => {
    if (!script.trim() || !allScenesHaveScript || !selectedVoice || currentSpeech || speechBusy || isGenerating) return;
    setSpeechBusy(true);
    setGenerationError("");
    setNotice(isThai ? "กำลังสร้างเสียงพูดและคิดเครดิตเสียง" : "Generating speech audio. Speech credits will be charged.");
    try {
      await generateSpeech();
      setNotice(isThai ? "สร้างเสียงแล้ว ฟังตัวอย่างได้ด้านล่าง" : "Speech is ready. Preview it below.");
    } catch (error) {
      setGenerationError(formatGenerationError(error, isThai ? "สร้างเสียงไม่สำเร็จ" : "Could not generate speech"));
      setNotice("");
    } finally {
      setSpeechBusy(false);
    }
  };

  const handleGenerateVideo = async () => {
    if (!sourceMedia || (!sourceMedia.remoteUrl && !sourceMedia.defaultAsset) || !script.trim() || !allScenesHaveScript || !selectedVideoModel || !selectedVoice || sourceMedia.uploading || sourceMedia.error || isGenerating) return;
    const controller = new AbortController();
    generationControllerRef.current = controller;
    const requestId = crypto.randomUUID();
    emitGenerationSubmitting({ feature: "lipsync", requestId });
    setGenerationError("");
    setFinalVideoUrl("");
    setGenerationProgress(4);
    setGenerationStatus("uploading");
    setNotice(isThai ? "เตรียมไฟล์และเสียงพูด…" : "Preparing your media and voice track…");
    try {
      let sourceUrl = sourceMedia.remoteUrl;
      if (!sourceUrl && sourceMedia.defaultAsset) {
        setNotice(isThai ? "กำลังเตรียมภาพพรีเซนเตอร์…" : "Preparing the presenter image…");
        const imageResponse = await fetch(sourceMedia.defaultAsset, { signal: controller.signal });
        if (!imageResponse.ok) throw new Error("Could not load the presenter image");
        const imageBlob = await imageResponse.blob();
        const imageFile = new File([imageBlob], sourceMedia.fileName, { type: imageBlob.type || "image/png" });
        sourceUrl = await uploadPeopleMedia(imageFile, controller.signal, selectedVideoModel.capabilities.uploadConstraints);
        if (controller.signal.aborted) return;
        setSourceMedia((current) => current?.defaultAsset === sourceMedia.defaultAsset ? { ...current, remoteUrl: sourceUrl, error: undefined } : current);
      }
      if (!sourceUrl) throw new Error("Presenter image is not ready");

      let current = currentSpeech;
      if (!current) {
        setNotice(isThai ? "กำลังสร้างเสียงพูดด้วย ElevenLabs…" : "Generating ElevenLabs speech…");
        current = await generateSpeech();
        if (controller.signal.aborted) return;
      }
      let audioUrl = current.remoteUrl;
      if (!audioUrl) {
        setNotice(isThai ? "กำลังอัปโหลดเสียงพูด…" : "Uploading the generated voice track…");
        const audioFile = new File([current.blob], "presenter-speech.mp3", { type: current.blob.type || "audio/mpeg" });
        audioUrl = await uploadPeopleMedia(audioFile, controller.signal);
        if (controller.signal.aborted) return;
        setSpeech((value) => value?.key === speechKey ? { ...value, remoteUrl: audioUrl } : value);
      }
      setGenerationStatus("processing");
      setNotice(isThai ? "ส่งงานสร้างวิดีโอแล้ว กำลังประมวลผล…" : "Video job submitted. Processing…");
      const lipsyncAcceptsScript = Boolean(selectedVideoModel.capabilities.scriptParameter || selectedVideoModel.capabilities.promptParameter);
      const created = await createLipsyncGeneration({
        model: selectedVideoModel.model,
        ...(sourceMedia.kind === "image" ? { sourceImage: sourceUrl } : { sourceVideo: sourceUrl }),
        ...(lipsyncAcceptsScript ? { script: script.trim() } : {}),
        audioUrl, duration: current.durationSeconds ?? duration, aspectRatio: aspect,
        voiceLanguage: language, voiceSpeed: 1, idempotencyKey: requestId,
      }, controller.signal);
      const generationId = created.generationId ?? created.id;
      const pollUrl = created.pollUrl ?? (generationId ? "/generations/" + encodeURIComponent(generationId) + "/status" : "");
      if (generationId && pollUrl) emitGenerationStarted({ feature: "lipsync", requestId, generationId, pollUrl, model: selectedVideoModel.model, status: created.status === "processing" ? "processing" : "queued" });
      let status: LipsyncGenerationStatus = { ...created, status: created.status ?? "processing" };
      let lastProgress = 4;
      while (status.status !== "completed" && status.status !== "failed" && status.status !== "cancelled") {
        if (!pollUrl) throw new Error("Presenter video request did not return a polling URL");
        status = await getLipsyncGenerationStatus(pollUrl, controller.signal);
        lastProgress = Math.max(lastProgress, progressPercent(status, Math.min(97, lastProgress + 4)));
        setGenerationProgress(Math.min(97, lastProgress));
        if (status.status === "completed" || status.status === "failed" || status.status === "cancelled") break;
        await waitForPoll(controller.signal);
      }
      if (status.status !== "completed") throw generationErrorFromStatus(status as ResumableVideoStatus, "Presenter video generation " + status.status);
      const videoUrl = outputVideoUrl(status);
      if (!videoUrl) throw new Error("Presenter video completed without an output URL");
      setFinalVideoUrl(videoUrl);
      setGenerationProgress(100);
      setGenerationStatus("completed");
      setNotice(isThai ? "วิดีโอพร้อมแล้ว" : "Your presenter video is ready.");
      if (generationId) emitGenerationCompleted({ feature: "lipsync", generationId });
    } catch (error) {
      emitGenerationRequestFailed({ feature: "lipsync", requestId });
      if (controller.signal.aborted) return;
      setGenerationStatus("failed");
      setNotice("");
      setGenerationError(formatGenerationError(error, isThai ? "สร้างวิดีโอไม่สำเร็จ" : "Unable to generate the presenter video"));
    } finally {
      emitGenerationRequestFinished({ feature: "lipsync", requestId });
      if (generationControllerRef.current === controller) generationControllerRef.current = null;
    }
  };

  const handleCopyScript = async () => {
    try {
      await navigator.clipboard.writeText(script);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setNotice(isThai ? "คัดลอกข้อความไม่ได้ในเบราว์เซอร์นี้" : "Clipboard access is unavailable in this browser.");
    }
  };

  const supportedRatios = selectedVideoModel?.capabilities.supportedRatios?.filter((value) => aspectOptions.some((ratio) => ratio === value)) ?? [];
  const estimatedCredits = (speechQuote?.creditCost ?? null) !== null && videoCreditCost !== null
    ? (speechQuote?.creditCost ?? 0) + videoCreditCost
    : null;
  const canGenerate = Boolean(sourceMedia && (sourceMedia.remoteUrl || sourceMedia.defaultAsset) && !sourceMedia.error && script.trim() && allScenesHaveScript && selectedVideoModel && selectedVoice && !sourceMedia.uploading && !isGenerating && !speechBusy && !catalogLoading && !voiceLoading && !speechQuoteLoading && !videoQuoteLoading);

  return (
    <div className={styles.page}>
      <section className={styles.hero} aria-label="AI Presenter">
        <div className={styles.heroArtwork}><Image src="/generated-icons-v2/projects/ai-presenter.png" alt="AI presenter in a modern studio" fill priority sizes="(max-width: 760px) 100vw, 65vw" /></div>
        <div className={styles.heroWash} />
        <div className={styles.heroCopy}>
          <span className={styles.heroEyebrow}><Sparkles size={13} /> AI VIDEO STUDIO</span>
          <h1>GEN AI<br /><span>PRESENTER</span></h1>
          <p>{isThai ? "ใส่สคริปต์ เลือกเสียง แล้วสร้างวิดีโอพรีเซนเตอร์จากรูปหรือวิดีโอของคุณ" : "Add a script, choose a voice, and make a presenter video from your media."}</p>
          <span className={styles.heroPill}><span /> {isThai ? "เชื่อมต่อระบบสร้างจริง" : "Live generation"}</span>
        </div>
        <div className={styles.heroCallout}><AudioLines size={22} /><span>MAKE IT<br /><strong>SPEAK.</strong></span></div>
      </section>

      <div className={styles.prototypeNotice} role="status">
        <span className={styles.prototypeDot} />
        {isThai ? "แบ่งสคริปต์เป็นฉากได้ · สร้างเป็นวิดีโอพรีเซนเตอร์ต่อเนื่อง 1 คลิป โดยคิดเครดิตเสียงและวิดีโอแยกกัน" : "Organize the script into scenes · generation creates one continuous presenter video, with separate speech and video credits."}
      </div>

      <section className={styles.workspace} aria-label={isThai ? "พื้นที่สร้าง AI Presenter" : "AI Presenter workspace"}>
        <nav className={styles.modeTabs} aria-label={isThai ? "โหมด AI Presenter" : "AI Presenter modes"}>
          <span className={`${styles.modeTab} ${styles.modeTabActive}`}><Video size={16} /><span>Presenter Video</span></span>
          <span className={styles.mvpTag}>{isThai ? "สคริปต์หลายฉาก" : "Multi-scene script"}</span>
        </nav>

        <div className={styles.workspaceGrid}>
          <section className={styles.scriptPanel} aria-labelledby="presenter-script-heading">
            <div className={styles.panelTitle}>
              <div><span className={styles.stepNumber}>1.</span><h2 id="presenter-script-heading">SCRIPT / CONTENT</h2></div>
              <button type="button" className={styles.iconButton} aria-label={isThai ? "คัดลอกสคริปต์" : "Copy script"} onClick={() => void handleCopyScript()} title={copied ? "Copied" : "Copy script"}>{copied ? <Check size={15} /> : <Copy size={15} />}</button>
            </div>
            <p className={styles.panelHint}>{isThai ? "สคริปต์นี้จะถูกแปลงเป็นเสียงพูดก่อนนำไปซิงก์กับภาพ" : "Your script is converted to speech, then synced to the source media."}</p>
            <label className={styles.formGroup}>
              <span className={styles.formLabel}>{isThai ? "ชื่อฉาก" : "Scene title"}</span>
              <input className={styles.textInput} value={activeScene?.title ?? ""} onChange={(event) => updateActiveScene({ title: event.target.value.slice(0, 40) })} maxLength={40} disabled={isLocked} />
            </label>
            <textarea className={styles.scriptInput} value={activeScene?.script ?? ""} onChange={(event) => updateActiveScene({ script: event.target.value.slice(0, activeSceneMaxLength) })} maxLength={activeSceneMaxLength} disabled={isLocked} placeholder={isThai ? "เขียนบทพูดสำหรับฉากนี้" : "Write the presenter script for this scene"} aria-label={isThai ? "สคริปต์สำหรับพรีเซนเตอร์" : "Presenter script"} />
            <div className={styles.characterCount}>{script.length.toLocaleString()} / 5,000 {isThai ? "ตัวอักษรรวม" : "total characters"}</div>
            {!allScenesHaveScript ? <p className={styles.formError}>{isThai ? "เพิ่มบทพูดให้ครบทุกฉากก่อนสร้างเสียงและวิดีโอ" : "Add script to every scene before generating speech and video."}</p> : null}

            <div className={styles.formGroup}>
              <div className={styles.formLabel}><span>{isThai ? "โทนเสียง" : "Speech tone"}</span></div>
              <div className={styles.chipRow}>{toneOptions.map((option) => <button type="button" key={option.value} className={`${styles.toneChip} ${tone === option.value ? styles.toneChipActive : ""}`} onClick={() => setTone(option.value)} disabled={isLocked} aria-pressed={tone === option.value}>{option.label}</button>)}</div>
            </div>

            <div className={styles.twoFields}>
              <label className={styles.formGroup}>
                <span className={styles.formLabel}>{isThai ? "ภาษา" : "Language"}</span>
                <span className={styles.selectWrap}><select value={language} onChange={(event) => setLanguage(event.target.value)} disabled={isLocked}><option value="en">English</option><option value="th">ไทย</option><option value="ja">日本語</option></select><ChevronDown size={14} /></span>
              </label>
              <label className={styles.formGroup}>
                <span className={styles.formLabel}>{isThai ? "คำอ่านเพิ่มเติม" : "Pronunciation hints"}</span>
                <input className={styles.textInput} value={pronunciation} onChange={(event) => setPronunciation(event.target.value)} placeholder={isThai ? "ชื่อแบรนด์หรือคำย่อ" : "Brand names, acronyms"} disabled={isLocked} />
              </label>
            </div>

            <div className={styles.formGroup}>
              <div className={styles.formLabel}>{isThai ? "ภาพหรือวิดีโอต้นแบบ" : "Presenter image or video"}</div>
              <input ref={sourceInputRef} className={styles.hiddenInput} type="file" accept="image/png,image/jpeg,image/webp,video/mp4,video/webm" onChange={(event) => void handleSourceChange(event)} disabled={isLocked} />
              {sourceMedia ? (
                <div className={styles.sourceFileCard}>
                  {sourceMedia.kind === "image" ? <span className={styles.sourceThumb}><Image src={sourceMedia.previewUrl} alt={sourceMedia.fileName} fill unoptimized sizes="80px" loading="eager" /></span> : <video src={sourceMedia.previewUrl} muted playsInline />}
                  <div><strong>{sourceMedia.fileName}</strong><small>{sourceMedia.uploading ? (isThai ? "กำลังอัปโหลด…" : "Uploading…") : sourceMedia.error ? sourceMedia.error : sourceMedia.remoteUrl ? (isThai ? "อัปโหลดพร้อมแล้ว" : "Upload ready") : sourceMedia.defaultAsset ? (isThai ? "พร้อมอัปโหลดเมื่อกดสร้าง" : "Ready to upload when you generate") : ""}</small></div>
                  <button type="button" onClick={handleRemoveSource} disabled={isLocked} aria-label={isThai ? "นำไฟล์ออก" : "Remove source media"}><X size={15} /></button>
                </div>
              ) : (
                <button type="button" className={styles.uploadBox} onClick={() => sourceInputRef.current?.click()} disabled={isLocked}><CloudUpload size={19} /><span>{isThai ? "เลือกรูปหรือวิดีโอ" : "Choose an image or video"}</span><small>PNG, JPG, WEBP, MP4, WEBM</small></button>
              )}
              {sourceMedia?.error ? <button type="button" className={styles.retryUpload} onClick={() => sourceInputRef.current?.click()}>{isThai ? "ลองอัปโหลดใหม่" : "Choose another file"}</button> : null}
            </div>
          </section>

          <section className={styles.previewPanel} aria-labelledby="presenter-preview-heading">
            <div className={styles.panelTitle}><div><span className={styles.stepNumber}>2.</span><h2 id="presenter-preview-heading">PREVIEW</h2></div><span className={`${styles.previewBadge} ${finalVideoUrl ? styles.previewReady : ""}`}><span />{finalVideoUrl ? (isThai ? "วิดีโอที่สร้างแล้ว" : "GENERATED") : (isThai ? "ตัวอย่างต้นแบบ" : "SOURCE PREVIEW")}</span></div>
            <div className={styles.videoFrame}>
              <VideoPreviewLiveBadge />
              {isGenerating ? (
                <div className={videoPreviewStyles.videoGeneratingPreview} aria-busy="true">
                  <WandSparkles size={26} />
                  <strong>{generationStatus === "uploading" ? (isThai ? "กำลังเตรียมไฟล์" : "Preparing files") : (isThai ? "กำลังสร้างวิดีโอ" : "Generating video")}</strong>
                  <span>{notice ?? (isThai ? "กำลังซิงก์เสียงพูดกับภาพพรีเซนเตอร์" : "Syncing the speech with your presenter.")}</span>
                  <div className={videoPreviewStyles.videoGenerationProgress}><i style={{ width: `${Math.max(8, generationProgress)}%` }} /></div>
                  <small>{isThai ? `เสร็จแล้ว ${generationProgress}%` : `${generationProgress}% complete`}</small>
                </div>
              ) : finalVideoUrl ? (
                <EosVideoPlayer
                  key={finalVideoUrl}
                  src={finalVideoUrl}
                  className={`${videoPreviewStyles.generatedVideoPlayer} ${videoPreviewStyles.peopleGeneratedVideoPlayer}`}
                  mediaFrameClassName={videoPreviewStyles.videoPreviewMediaFrame}
                  ariaLabel={isThai ? "วิดีโอพรีเซนเตอร์ที่สร้างแล้ว" : "Generated presenter video"}
                />
              ) : sourceMedia?.kind === "video" ? (
                <EosVideoPlayer
                  key={sourceMedia.previewUrl}
                  src={sourceMedia.previewUrl}
                  muted
                  className={`${videoPreviewStyles.generatedVideoPlayer} ${videoPreviewStyles.peopleGeneratedVideoPlayer}`}
                  mediaFrameClassName={videoPreviewStyles.videoPreviewMediaFrame}
                  ariaLabel={isThai ? "วิดีโอต้นแบบ" : "Presenter source video"}
                />
              ) : sourceMedia?.kind === "image" ? (
                <Image src={sourceMedia.previewUrl} alt={isThai ? "ภาพต้นแบบพรีเซนเตอร์" : "Presenter source image"} fill unoptimized sizes="(max-width: 760px) 100vw, 60vw" className={styles.sourcePreviewImage} />
              ) : (
                <VideoPreviewPlaceholder showActions={false} />
              )}
              {finalVideoUrl && !isGenerating ? <VideoPreviewOverlayActions videoUrl={finalVideoUrl} /> : null}
              {finalVideoUrl ? <span className={styles.videoWatermark}>EOS CREATIVE STUDIO</span> : null}
            </div>
            <div className={styles.presenterPicker}>
              <div className={styles.sectionHeading}>
                <h3>{isThai ? "เลือกพรีเซนเตอร์ / อวาตาร์" : "Choose Presenter / Avatar"}</h3>
                <button type="button" className={styles.textButton} onClick={() => setShowAllPresenters(true)} disabled={isLocked}>{isThai ? "เปลี่ยนพรีเซนเตอร์" : "Change Presenter"}</button>
              </div>
              <div className={styles.presenterList}>
                {presenterOptions.slice(0, showAllPresenters ? presenterOptions.length : 3).map((presenter) => {
                  const isSelected = sourceMedia?.defaultAsset === presenter.image;
                  return (
                    <button
                      type="button"
                      key={presenter.id}
                      className={`${styles.presenterCard} ${isSelected ? styles.presenterCardActive : ""}`}
                      onClick={() => choosePresenter(presenter)}
                      disabled={isLocked}
                      aria-pressed={isSelected}
                      title={`${presenter.name} · ${presenter.style}`}
                    >
                      <span className={styles.presenterImage}><Image src={presenter.image} alt={presenter.name} fill unoptimized sizes="49px" style={{ objectPosition: presenter.objectPosition }} /></span>
                      <strong>{presenter.name}</strong>
                      <small>{presenter.style}</small>
                      {isSelected ? <span className={styles.presenterCheck}><Check size={9} /></span> : null}
                    </button>
                  );
                })}
                <button type="button" className={`${styles.presenterCard} ${styles.morePresenter}`} onClick={() => setShowAllPresenters((expanded) => !expanded)} disabled={isLocked} aria-expanded={showAllPresenters}>
                  <MoreHorizontal size={18} />
                  <strong>{showAllPresenters ? (isThai ? "น้อยลง" : "Less") : (isThai ? "เพิ่มเติม" : "More")}</strong>
                </button>
                {showAllPresenters ? (
                  <button type="button" className={`${styles.presenterCard} ${styles.morePresenter}`} onClick={() => sourceInputRef.current?.click()} disabled={isLocked}>
                    <CloudUpload size={17} />
                    <strong>{isThai ? "อัปโหลด" : "Upload"}</strong>
                    <small>{isThai ? "รูปหรือวิดีโอ" : "Photo or video"}</small>
                  </button>
                ) : null}
              </div>
            </div>
            <div className={styles.timelineHeader}>
              <div className={styles.sectionHeading}>
                <h3>{isThai ? "ไทม์ไลน์ฉาก" : "Scene Timeline"}</h3>
                <span className={styles.sceneCount}>{scenes.length} / 6 · ~{duration}s</span>
              </div>
              <button type="button" className={styles.textButton} onClick={() => setIsReorderingScenes((current) => !current)} disabled={isLocked || scenes.length < 2} aria-pressed={isReorderingScenes}>
                {isReorderingScenes ? (isThai ? "เสร็จสิ้น" : "Done") : (isThai ? "เรียงฉากใหม่" : "Reorder Scenes")}
              </button>
            </div>
            <p className={styles.timelineNote}>{isReorderingScenes ? (isThai ? "ลากฉากเพื่อเปลี่ยนลำดับ" : "Drag scenes to change their order.") : (isThai ? "ฉากจะพูดต่อกันตามลำดับในวิดีโอเดียว โดยใช้พรีเซนเตอร์ที่เลือก" : "Scenes are spoken in order in one continuous video using the selected presenter.")}</p>
            <div className={styles.sceneTimeline} aria-label={isThai ? "ไทม์ไลน์ฉาก" : "Scene timeline"}>
              {sceneTimeline.map(({ scene, start, end }, index) => (
                <div
                  key={scene.id}
                  className={styles.sceneItem}
                  draggable={isReorderingScenes}
                  onDragStart={(event) => {
                    if (!isReorderingScenes) return;
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", scene.id);
                  }}
                  onDragOver={(event) => { if (isReorderingScenes) { event.preventDefault(); event.dataTransfer.dropEffect = "move"; } }}
                  onDrop={(event) => {
                    if (!isReorderingScenes) return;
                    event.preventDefault();
                    reorderScenes(event.dataTransfer.getData("text/plain"), scene.id);
                  }}
                >
                  <div className={`${styles.sceneCard} ${activeSceneId === scene.id ? styles.sceneCardActive : ""}`}>
                    <button type="button" className={styles.sceneSelect} onClick={() => setActiveSceneId(scene.id)} aria-pressed={activeSceneId === scene.id} disabled={isLocked}>
                      <span className={styles.sceneImage}>
                        {sourceMedia?.kind === "image" ? <Image src={sourceMedia.previewUrl} alt="" fill unoptimized sizes="43px" /> : sourceMedia?.kind === "video" ? <video src={sourceMedia.previewUrl} muted playsInline /> : <Video size={16} />}
                      </span>
                      <span className={styles.sceneCopy}>
                        <strong>{scene.title || `${isThai ? "ฉาก" : "Scene"} ${index + 1}`}</strong>
                        <small>{formatTimelineTime(start)} – {formatTimelineTime(end)}</small>
                        <em>{scene.script.trim() || (isThai ? "เพิ่มบทพูดในฉากนี้" : "Add script for this scene")}</em>
                      </span>
                    </button>
                    {isReorderingScenes ? <span className={styles.sceneMore}><GripVertical size={13} /></span> : scenes.length > 1 ? <button type="button" className={styles.sceneMore} onClick={() => removeScene(scene.id)} aria-label={isThai ? `ลบฉาก ${index + 1}` : `Remove scene ${index + 1}`} title={isThai ? "ลบฉาก" : "Remove scene"} disabled={isLocked}><X size={12} /></button> : <span className={styles.sceneMore}><MoreHorizontal size={14} /></span>}
                  </div>
                  {index < scenes.length - 1 ? <ArrowRight className={styles.sceneArrow} size={13} /> : null}
                </div>
              ))}
              <button type="button" className={styles.addScene} onClick={addScene} disabled={!canAddScene || isLocked}>
                <Plus size={15} />
                <span>{isThai ? "เพิ่มฉาก" : "Add Scene"}</span>
              </button>
            </div>
            {currentSpeech ? <div className={styles.speechPreview}><div><AudioLines size={15} /><strong>{isThai ? "เสียงพูดที่สร้างแล้ว" : "Generated speech"}</strong><span>{currentSpeech.durationSeconds ? currentSpeech.durationSeconds + "s" : "MP3"}</span></div><audio controls src={currentSpeech.url} /></div> : null}
            {generationError ? <div className={styles.errorCard} role="alert">{generationError}</div> : null}
            {notice ? <p className={styles.statusNote} role="status">{notice}</p> : null}
          </section>

          <aside className={styles.settingsPanel} aria-labelledby="presenter-settings-heading">
            <div className={styles.panelTitle}><div><span className={styles.stepNumber}>3.</span><h2 id="presenter-settings-heading">SETTINGS</h2></div><Sparkles size={15} className={styles.settingsSparkle} /></div>

            <label className={styles.settingCard}>
              <span className={styles.settingLabel}>{isThai ? "โมเดลสร้างวิดีโอ" : "Presenter video model"}</span>
              <span className={styles.settingSelect}><Video size={14} /><select value={selectedLipsyncModel} onChange={(event) => setSelectedLipsyncModel(event.target.value)} disabled={catalogLoading || isLocked}><option value="">{catalogLoading ? (isThai ? "กำลังโหลดโมเดล…" : "Loading models…") : (isThai ? "เลือกโมเดล" : "Select a model")}</option>{availableLipsyncModels.map((model) => <option key={model.model} value={model.model}>{model.displayName}</option>)}</select><ChevronDown size={14} /></span>
            </label>
            <label className={styles.settingCard}>
              <span className={styles.settingLabel}>{isThai ? "โมเดลเสียงพูด (ElevenLabs)" : "Speech model (ElevenLabs)"}</span>
              <span className={styles.selectWrap}><select value={selectedAudioModel} onChange={(event) => setSelectedAudioModel(event.target.value)} disabled={catalogLoading || isLocked}>{availableAudioModels.map((model) => <option key={model.key} value={model.key}>{model.name}</option>)}</select><ChevronDown size={14} /></span>
            </label>
            <label className={styles.settingCard}>
              <span className={styles.settingLabel}>{isThai ? "เสียงพรีเซนเตอร์" : "Presenter voice"}</span>
              <span className={styles.selectWrap}><select value={selectedVoice} onChange={(event) => setSelectedVoice(event.target.value)} disabled={voiceLoading || !voices.length || isLocked}><option value="">{voiceLoading ? (isThai ? "กำลังโหลดเสียง…" : "Loading voices…") : (isThai ? "เลือกเสียง" : "Select a voice")}</option>{voices.map((voice) => <option key={voice.key} value={voice.key}>{voice.name}</option>)}</select><ChevronDown size={14} /></span>
            </label>
            <div className={styles.settingCard}>
              <div className={styles.settingLabel}>{isThai ? "สัดส่วนวิดีโอ" : "Video format"}</div>
              <div className={styles.formatChoices}>{(supportedRatios.length ? supportedRatios : aspectOptions).map((value) => <button key={value} type="button" className={`${styles.formatOption} ${aspect === value ? styles.formatOptionActive : ""}`} onClick={() => setAspect(value as (typeof aspectOptions)[number])} disabled={isLocked}><span className={`${styles.formatShape} ${value === "9:16" ? styles.formatPortrait : value === "1:1" ? styles.formatSquare : ""}`} /><strong>{value}</strong><small>{value === "16:9" ? "Landscape" : value === "9:16" ? "Portrait" : "Square"}</small></button>)}</div>
            </div>

            <div className={styles.estimateCard}>
              <div><strong>{isThai ? "เครดิตโดยประมาณ" : "Estimated credits"}</strong><span className={styles.estimateIcon}><Sparkles size={18} /></span></div>
              <div className={styles.estimateLine}><span>{isThai ? "เสียงพูด" : "Speech"}</span><b>{speechQuoteLoading ? "…" : speechQuote ? speechQuote.creditCost.toLocaleString() : "—"}</b></div>
              <div className={styles.estimateLine}><span>{isThai ? "วิดีโอ" : "Video"}</span><b>{videoQuoteLoading ? "…" : videoCreditCost === null ? "—" : videoCreditCost.toLocaleString()}</b></div>
              <b className={styles.estimateTotal}>{estimatedCredits === null ? "—" : estimatedCredits.toLocaleString()} <small>{isThai ? "เครดิตรวม" : "credits total"}</small></b>
              <span>{isThai ? `ความยาวประมาณ ${duration} วินาที · คิดเครดิตแยกตามงาน` : `About ${duration} seconds · each step is charged separately`}</span>
            </div>

            <button type="button" className={styles.secondaryAction} onClick={() => void handleGenerateSpeech()} disabled={!script.trim() || !allScenesHaveScript || !selectedVoice || Boolean(currentSpeech) || speechBusy || isGenerating}>
              {speechBusy ? <LoaderCircle size={16} className={styles.spin} /> : currentSpeech ? <Check size={16} /> : <AudioLines size={16} />}{speechBusy ? (isThai ? "กำลังสร้างเสียง…" : "Generating speech…") : currentSpeech ? (isThai ? "เสียงพร้อมแล้ว" : "Speech is ready") : (isThai ? "สร้างเสียงตัวอย่าง" : "Generate speech preview")}
            </button>
            <button type="button" className={styles.generateButton} onClick={() => void handleGenerateVideo()} disabled={!canGenerate}>
              {isGenerating ? <LoaderCircle size={17} className={styles.spin} /> : <Sparkles size={17} />}{isGenerating ? (isThai ? "กำลังสร้างวิดีโอ…" : "Generating video…") : (isThai ? "สร้างพรีเซนเตอร์" : "Generate presenter")}
            </button>
            {catalogError ? <p className={styles.formError}>{catalogError}</p> : null}
            {!catalogLoading && !availableLipsyncModels.length ? <p className={styles.formError}>{isThai ? "ไม่มีโมเดลที่รองรับรูปแบบไฟล์นี้และเสียงพูด กรุณาเลือกไฟล์อื่นหรือตรวจสอบการตั้งค่าโมเดล" : "No enabled model supports this media type and speech input. Choose another file or check model routing."}</p> : null}
            {!voiceLoading && selectedAudioModel && !voices.length ? <p className={styles.formError}>{isThai ? "ไม่พบเสียงที่ใช้งานได้ในโมเดลนี้" : "No available voices for this speech model."}</p> : null}
            <p className={styles.securityNote}><LockKeyhole size={12} /> {isThai ? "สคริปต์และไฟล์จะส่งไปยังผู้ให้บริการเพื่อสร้างงาน" : "Your script and media are sent to generation providers."}</p>
          </aside>
        </div>
      </section>

      <section className={styles.bottomShelf} aria-label={isThai ? "ขั้นตอนการสร้าง" : "Generation workflow"}>
        <div className={styles.workflowStep}><span>01</span><div><strong>{isThai ? "อัปโหลดต้นแบบ" : "Upload source media"}</strong><small>{isThai ? "รูปภาพหรือวิดีโอที่คุณมีสิทธิ์ใช้งาน" : "Use an image or video you have rights to use."}</small></div></div>
        <div className={styles.workflowStep}><span>02</span><div><strong>{isThai ? "สร้างเสียงพูด" : "Generate speech"}</strong><small>{isThai ? "เลือกภาษา น้ำเสียง และเสียงพูด" : "Choose a language, tone, and voice."}</small></div></div>
        <div className={styles.workflowStep}><span>03</span><div><strong>{isThai ? "สร้างวิดีโอ" : "Generate presenter video"}</strong><small>{isThai ? "ซิงก์เสียงกับภาพและรับผลลัพธ์ในหน้านี้" : "Sync the voice to your media and preview the result here."}</small></div></div>
      </section>
    </div>
  );
}
