"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { AudioLines, Check, ChevronDown, CloudUpload, Copy, LoaderCircle, LockKeyhole, Sparkles, UserRound, Video, X } from "lucide-react";
import { useLocale } from "@/lib/i18n/locale-provider";
import { createTextToSpeech, getAudioCreditBalance, listAudioModels, listAudioVoices, quoteTextToSpeech, type AudioCreditQuote, type AudioModel, type AudioVoice } from "@/lib/api/audio";
import { createLipsyncGeneration, getLipsyncGenerationStatus, type LipsyncGenerationResponse, type LipsyncGenerationStatus } from "@/lib/api/lipsync-generations";
import { listGenerationModels, type GenerationModelOption } from "@/lib/api/generation-models";
import { uploadPeopleMedia } from "@/lib/api/people-video-generations";
import { quoteDirectVideoGeneration } from "@/lib/api/video-generations";
import { emitGenerationCompleted, emitGenerationRequestFailed, emitGenerationRequestFinished, emitGenerationStarted, emitGenerationSubmitting } from "@/lib/generation-progress-events";
import { formatGenerationError, generationErrorFromStatus } from "@/lib/api/generation-errors";
import { useVideoGenerationResume, type ResumableVideoStatus } from "@/features/create/use-video-generation-resume";
import styles from "./ai-presenter-page.module.css";

const sampleScript = "Welcome to EOS Creative Studio. Turn your ideas into stories, and your stories into impact.";
const voicePreviewScript = "นี่คือตัวอย่างเสียงภาษาไทยสำหรับตรวจสอบโทนเสียงและคุณภาพการพูด";
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

type SourceMedia = { file: File; previewUrl: string; kind: "image" | "video"; remoteUrl?: string; uploading: boolean; error?: string };
type SpeechPreview = { key: string; blob: Blob; url: string; durationSeconds?: number; remoteUrl?: string };

function baselineDuration(script: string, language: string): number {
  const text = script.trim();
  if (!text) return 3;
  const spokenUnits = language === "th" ? text.replace(/\s/g, "").length / 12 : text.split(/\s+/).length;
  return Math.max(3, Math.min(60, Math.ceil(spokenUnits / (language === "th" ? 1 : 2.45))));
}

function estimatedDuration(script: string, language: string, voicePace = 1): number {
  return Math.max(3, Math.min(60, Math.ceil(baselineDuration(script, language) * voicePace)));
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
  const [script, setScript] = useState(sampleScript);
  const [tone, setTone] = useState<(typeof toneOptions)[number]["value"]>("Premium");
  const [language, setLanguage] = useState("en");
  const [pronunciation, setPronunciation] = useState("");
  const [sourceMedia, setSourceMedia] = useState<SourceMedia | null>(null);
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
  const [creditCheckBusy, setCreditCheckBusy] = useState(false);
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [voiceSample, setVoiceSample] = useState<{ key: string; durationSeconds: number } | null>(null);
  const [generationStatus, setGenerationStatus] = useState<"idle" | "uploading" | "processing" | "completed" | "failed">("idle");
  const [generationProgress, setGenerationProgress] = useState(0);
  const [finalVideoUrl, setFinalVideoUrl] = useState("");
  const [generationError, setGenerationError] = useState("");
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState(false);

  const availableAudioModels = useMemo(() => audioModels.filter(isElevenLabsSpeechModel), [audioModels]);
  const availableLipsyncModels = useMemo(
    () => lipsyncModels.filter((model) => model.enabled && modelSupports(model, sourceMedia?.kind)),
    [lipsyncModels, sourceMedia?.kind],
  );
  const selectedVideoModel = availableLipsyncModels.find((model) => model.model === selectedLipsyncModel);
  const selectedVoiceInfo = voices.find((voice) => voice.key === selectedVoice);
  const voiceSampleKey = JSON.stringify([selectedAudioModel, selectedVoice]);
  const sampleDuration = voiceSample?.key === voiceSampleKey ? voiceSample.durationSeconds : null;
  const voicePace = sampleDuration
    ? Math.max(0.65, Math.min(1.8, sampleDuration / baselineDuration(voicePreviewScript, "th")))
    : 1;
  const speechQuoteInput = useMemo(() => {
    if (!script.trim() || !selectedVoice || !selectedAudioModel) return null;
    return {
      text: script.trim(), voice: selectedVoice, modelId: selectedAudioModel, outputFormat: "mp3" as const, languageCode: language,
      tone, speed: 1, pronunciationHint: pronunciation.trim() || undefined,
    };
  }, [script, selectedVoice, selectedAudioModel, language, tone, pronunciation]);
  const duration = speech?.key === JSON.stringify([script, selectedVoice, selectedAudioModel, language, tone, pronunciation.trim()]) && speech.durationSeconds
    ? speech.durationSeconds
    : estimatedDuration(script, language, voicePace);
  const speechKey = JSON.stringify([script, selectedVoice, selectedAudioModel, language, tone, pronunciation.trim()]);
  const currentSpeech = speech?.key === speechKey ? speech : null;
  const isGenerating = generationStatus === "uploading" || generationStatus === "processing";
  const isLocked = isGenerating || creditCheckBusy;

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
    const controller = new AbortController();
    void getAudioCreditBalance(controller.signal).then(({ balance }) => {
      setCreditBalance(balance);
    }).catch(() => {
      if (!controller.signal.aborted) setCreditBalance(null);
    });
    return () => controller.abort();
  }, []);

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
    if (!speechQuoteInput) {
      setSpeechQuote(null);
      setSpeechQuoteLoading(false);
      return () => { active = false; controller.abort(); };
    }
    setSpeechQuoteLoading(true);
    const timer = window.setTimeout(() => {
      void quoteTextToSpeech(speechQuoteInput, controller.signal).then((quote) => {
        if (active) setSpeechQuote(quote);
      }).catch(() => {
        if (active) setSpeechQuote(null);
      }).finally(() => {
        if (active) setSpeechQuoteLoading(false);
      });
    }, 350);
    return () => { active = false; controller.abort(); window.clearTimeout(timer); };
  }, [speechQuoteInput]);

  useEffect(() => {
    const previewUrl = sourceMedia?.previewUrl;
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); };
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
    if (!sourceMedia?.remoteUrl || !selectedVideoModel || !script.trim()) return null;
    return {
      feature: "lipsync" as const,
      model: selectedVideoModel.model,
      prompt: script.trim(),
      duration,
      aspectRatio: aspect,
      ...(sourceMedia.kind === "image" ? { sourceImage: sourceMedia.remoteUrl } : { sourceVideo: sourceMedia.remoteUrl }),
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
    const next: SourceMedia = { file, previewUrl, kind: file.type.startsWith("video/") ? "video" : "image", uploading: true };
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
    if (sourceMedia?.previewUrl) URL.revokeObjectURL(sourceMedia.previewUrl);
    setSourceMedia(null);
    setFinalVideoUrl("");
  };

  const generateSpeech = async (signal?: AbortSignal): Promise<SpeechPreview> => {
    const result = await createTextToSpeech({
      text: script.trim(), voice: selectedVoice, modelId: selectedAudioModel, outputFormat: "mp3", languageCode: language,
      tone, speed: 1, pronunciationHint: pronunciation.trim() || undefined, idempotencyKey: crypto.randomUUID(),
    }, signal);
    const url = URL.createObjectURL(result.blob);
    const durationSeconds = await readAudioDuration(result.blob);
    const next = { key: speechKey, blob: result.blob, url, durationSeconds };
    setSpeech((current) => { if (current) URL.revokeObjectURL(current.url); return next; });
    return next;
  };

  const handleGenerateVideo = async () => {
    if (!sourceMedia?.remoteUrl || !script.trim() || !selectedVideoModel || !selectedVoice || sourceMedia.uploading || isGenerating || creditCheckBusy || !speechQuoteInput || !videoQuoteInput) return;
    const controller = new AbortController();
    generationControllerRef.current = controller;
    let requestId: string | null = null;
    setCreditCheckBusy(true);
    setGenerationError("");
    setFinalVideoUrl("");
    setNotice(isThai ? "กำลังตรวจสอบเครดิตและราคาล่าสุด…" : "Checking your balance and the latest total price…");
    try {
      const [latestSpeechQuote, latestVideoQuote, { balance }] = await Promise.all([
        quoteTextToSpeech(speechQuoteInput, controller.signal),
        quoteDirectVideoGeneration(videoQuoteInput, controller.signal),
        getAudioCreditBalance(controller.signal),
      ]);
      if (controller.signal.aborted) return;

      const speechCost = currentSpeech ? 0 : Number(latestSpeechQuote.creditCost);
      const videoCost = Number(latestVideoQuote.creditCost);
      if (!Number.isFinite(speechCost) || !Number.isFinite(videoCost)) throw new Error(isThai ? "ตรวจสอบราคารวมไม่ได้ จึงยังไม่เริ่มสร้าง" : "Could not verify the total price, so generation was not started.");
      const totalCost = speechCost + videoCost;
      setSpeechQuote(latestSpeechQuote);
      setVideoCreditCost(videoCost);
      setCreditBalance(balance);
      if (balance < totalCost) {
        throw new Error(isThai
          ? `เครดิตไม่พอสำหรับงานนี้ ต้องใช้ประมาณ ${totalCost.toLocaleString()} เครดิต แต่มี ${balance.toLocaleString()} เครดิต ยังไม่ได้สร้างเสียงหรือวิดีโอ`
          : `Not enough credits. This job needs about ${totalCost.toLocaleString()} credits and your balance is ${balance.toLocaleString()}. No audio or video was generated.`);
      }

      setCreditCheckBusy(false);
      requestId = crypto.randomUUID();
      emitGenerationSubmitting({ feature: "lipsync", requestId });
      setGenerationProgress(4);
      setGenerationStatus("uploading");
      setNotice(isThai ? "เครดิตพอแล้ว กำลังสร้างเสียงและเตรียมไฟล์…" : "Credits confirmed. Generating the speech and preparing your media…");
      let current = currentSpeech;
      if (!current) {
        current = await generateSpeech(controller.signal);
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
      const created = await createLipsyncGeneration({
        model: selectedVideoModel.model,
        ...(sourceMedia.kind === "image" ? { sourceImage: sourceMedia.remoteUrl } : { sourceVideo: sourceMedia.remoteUrl }),
        script: script.trim(), audioUrl, duration: current.durationSeconds ?? duration, aspectRatio: aspect,
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
      if (requestId) emitGenerationRequestFailed({ feature: "lipsync", requestId });
      if (controller.signal.aborted) return;
      if (requestId) setGenerationStatus("failed");
      setNotice("");
      setGenerationError(formatGenerationError(error, isThai ? "สร้างวิดีโอไม่สำเร็จ" : "Unable to generate the presenter video"));
    } finally {
      if (requestId) emitGenerationRequestFinished({ feature: "lipsync", requestId });
      if (requestId) void getAudioCreditBalance().then(({ balance }) => setCreditBalance(balance)).catch(() => undefined);
      setCreditCheckBusy(false);
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
  const speechCostEstimate = currentSpeech ? 0 : speechQuote?.creditCost ?? null;
  const estimatedCredits = speechCostEstimate !== null && videoCreditCost !== null
    ? speechCostEstimate + videoCreditCost
    : null;
  const canGenerate = Boolean(sourceMedia?.remoteUrl && script.trim() && selectedVideoModel && selectedVoice && !sourceMedia.uploading && !isGenerating && !creditCheckBusy && !catalogLoading && !voiceLoading && !speechQuoteLoading && !videoQuoteLoading);

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
        {isThai ? "รุ่นเริ่มต้น: 1 ฉาก · ตรวจเครดิตรวมก่อนสร้างเสียงและวิดีโอจริง" : "MVP: one scene · total credits are checked before speech and video generation."}
      </div>

      <section className={styles.workspace} aria-label={isThai ? "พื้นที่สร้าง AI Presenter" : "AI Presenter workspace"}>
        <nav className={styles.modeTabs} aria-label={isThai ? "โหมด AI Presenter" : "AI Presenter modes"}>
          <span className={`${styles.modeTab} ${styles.modeTabActive}`}><Video size={16} /><span>Presenter Video</span></span>
          <span className={styles.mvpTag}>{isThai ? "MVP · ฉากเดียว" : "MVP · one scene"}</span>
        </nav>

        <div className={styles.workspaceGrid}>
          <section className={styles.scriptPanel} aria-labelledby="presenter-script-heading">
            <div className={styles.panelTitle}>
              <div><span className={styles.stepNumber}>1.</span><h2 id="presenter-script-heading">SCRIPT / CONTENT</h2></div>
              <button type="button" className={styles.iconButton} aria-label={isThai ? "คัดลอกสคริปต์" : "Copy script"} onClick={() => void handleCopyScript()} title={copied ? "Copied" : "Copy script"}>{copied ? <Check size={15} /> : <Copy size={15} />}</button>
            </div>
            <p className={styles.panelHint}>{isThai ? "สคริปต์นี้จะถูกแปลงเป็นเสียงพูดก่อนนำไปซิงก์กับภาพ" : "Your script is converted to speech, then synced to the source media."}</p>
            <textarea className={styles.scriptInput} value={script} onChange={(event) => { setScript(event.target.value.slice(0, 5000)); setFinalVideoUrl(""); }} maxLength={5000} disabled={isLocked} aria-label={isThai ? "สคริปต์สำหรับพรีเซนเตอร์" : "Presenter script"} />
            <div className={styles.characterCount}>{script.length.toLocaleString()} / 5,000</div>

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
                  {sourceMedia.kind === "image" ? <span className={styles.sourceThumb}><Image src={sourceMedia.previewUrl} alt={sourceMedia.file.name} fill unoptimized sizes="80px" /></span> : <video src={sourceMedia.previewUrl} muted playsInline />}
                  <div><strong>{sourceMedia.file.name}</strong><small>{sourceMedia.uploading ? (isThai ? "กำลังอัปโหลด…" : "Uploading…") : sourceMedia.error ? sourceMedia.error : sourceMedia.remoteUrl ? (isThai ? "อัปโหลดพร้อมแล้ว" : "Upload ready") : ""}</small></div>
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
              {finalVideoUrl ? <video key={finalVideoUrl} controls playsInline src={finalVideoUrl} aria-label={isThai ? "วิดีโอพรีเซนเตอร์ที่สร้างแล้ว" : "Generated presenter video"} /> : sourceMedia?.kind === "video" ? <video key={sourceMedia.previewUrl} controls muted playsInline src={sourceMedia.previewUrl} aria-label={isThai ? "วิดีโอต้นแบบ" : "Presenter source video"} /> : sourceMedia?.kind === "image" ? <Image src={sourceMedia.previewUrl} alt={isThai ? "ภาพต้นแบบพรีเซนเตอร์" : "Presenter source image"} fill unoptimized sizes="(max-width: 760px) 100vw, 60vw" className={styles.sourcePreviewImage} /> : <div className={styles.previewPlaceholder}><UserRound size={42} /><strong>{isThai ? "ตัวอย่างพรีเซนเตอร์" : "Presenter preview"}</strong><span>{isThai ? "อัปโหลดรูปหรือวิดีโอเพื่อเริ่มต้น" : "Upload an image or video to get started."}</span></div>}
              {finalVideoUrl ? <span className={styles.videoWatermark}>EOS CREATIVE STUDIO</span> : null}
            </div>
            {currentSpeech ? <div className={styles.speechPreview}><div><AudioLines size={15} /><strong>{isThai ? "เสียงพูดที่สร้างแล้ว" : "Generated speech"}</strong><span>{currentSpeech.durationSeconds ? currentSpeech.durationSeconds + "s" : "MP3"}</span></div><audio controls src={currentSpeech.url} /></div> : null}
            {isGenerating ? <div className={styles.progressCard} role="status"><div><LoaderCircle size={16} className={styles.spin} /><strong>{generationStatus === "uploading" ? (isThai ? "กำลังเตรียมไฟล์" : "Preparing files") : (isThai ? "กำลังสร้างวิดีโอ" : "Generating video")}</strong><span>{generationProgress}%</span></div><span className={styles.progressTrack}><i style={{ width: `${Math.max(8, generationProgress)}%` }} /></span></div> : null}
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
            {selectedVoiceInfo?.previewUrl ? (
              <div className={styles.voiceSampleCard}>
                <div><AudioLines size={14} /><strong>{isThai ? "ตัวอย่างเสียงฟรี" : "Free voice sample"}</strong><span>{sampleDuration ? `${Math.ceil(sampleDuration)}s` : (isThai ? "กำลังอ่านความยาว…" : "Reading duration…")}</span></div>
                <audio
                  key={`${selectedAudioModel}:${selectedVoiceInfo.key}`}
                  controls
                  preload="metadata"
                  src={selectedVoiceInfo.previewUrl}
                  aria-label={isThai ? `ตัวอย่างเสียง ${selectedVoiceInfo.name}` : `${selectedVoiceInfo.name} voice sample`}
                  onLoadedMetadata={(event) => {
                    const measuredDuration = event.currentTarget.duration;
                    if (Number.isFinite(measuredDuration) && measuredDuration > 0) setVoiceSample({ key: JSON.stringify([selectedAudioModel, selectedVoiceInfo.key]), durationSeconds: measuredDuration });
                  }}
                />
                <small>{isThai ? "เทียบจังหวะกับข้อความตัวอย่างมาตรฐาน ความยาวจริงอาจต่างตามภาษาและการอ่าน" : "Pacing is compared with the standard sample text; actual duration can vary by language and delivery."}</small>
              </div>
            ) : (
              <p className={styles.voiceSampleMissing}>{isThai ? "เสียงนี้ไม่มีไฟล์ตัวอย่าง ใช้ความเร็วพูดมาตรฐานในการประเมิน" : "No sample is configured for this voice; duration uses a standard speaking pace."}</p>
            )}
            <div className={styles.settingCard}>
              <div className={styles.settingLabel}>{isThai ? "สัดส่วนวิดีโอ" : "Video format"}</div>
              <div className={styles.formatChoices}>{(supportedRatios.length ? supportedRatios : aspectOptions).map((value) => <button key={value} type="button" className={`${styles.formatOption} ${aspect === value ? styles.formatOptionActive : ""}`} onClick={() => setAspect(value as (typeof aspectOptions)[number])} disabled={isLocked}><span className={`${styles.formatShape} ${value === "9:16" ? styles.formatPortrait : value === "1:1" ? styles.formatSquare : ""}`} /><strong>{value}</strong><small>{value === "16:9" ? "Landscape" : value === "9:16" ? "Portrait" : "Square"}</small></button>)}</div>
            </div>

            <div className={styles.estimateCard}>
              <div><strong>{isThai ? "เครดิตโดยประมาณ" : "Estimated credits"}</strong><span className={styles.estimateIcon}><Sparkles size={18} /></span></div>
              <div className={styles.estimateLine}><span>{isThai ? (currentSpeech ? "เสียงพูด (พร้อมแล้ว)" : "เสียงพูด") : (currentSpeech ? "Speech (ready)" : "Speech")}</span><b>{speechQuoteLoading ? "…" : currentSpeech ? "0" : speechQuote ? speechQuote.creditCost.toLocaleString() : "—"}</b></div>
              <div className={styles.estimateLine}><span>{isThai ? "วิดีโอ" : "Video"}</span><b>{videoQuoteLoading ? "…" : videoCreditCost === null ? "—" : videoCreditCost.toLocaleString()}</b></div>
              <div className={styles.estimateLine}><span>{isThai ? "เครดิตคงเหลือ" : "Available balance"}</span><b>{creditBalance === null ? (isThai ? "ตรวจตอนกดสร้าง" : "Checked on create") : creditBalance.toLocaleString()}</b></div>
              <b className={styles.estimateTotal}>{estimatedCredits === null ? "—" : estimatedCredits.toLocaleString()} <small>{isThai ? "เครดิตรวม" : "credits total"}</small></b>
              <span>{isThai ? `ประมาณ ${duration} วินาที · จะตรวจราคาและเครดิตรวมซ้ำก่อนเริ่มสร้าง` : `About ${duration} seconds · price and total balance are checked again before generation`}</span>
            </div>

            <p className={styles.creditNote}>{isThai ? "การฟังตัวอย่างไม่เสียเครดิต · สร้างเสียงจากบทเมื่อกดสร้างพรีเซนเตอร์เท่านั้น" : "Listening to the sample is free. Script audio is generated only after you create the presenter."}</p>
            <button type="button" className={styles.generateButton} onClick={() => void handleGenerateVideo()} disabled={!canGenerate}>
              {creditCheckBusy ? <LoaderCircle size={17} className={styles.spin} /> : isGenerating ? <LoaderCircle size={17} className={styles.spin} /> : <Sparkles size={17} />}{creditCheckBusy ? (isThai ? "กำลังตรวจเครดิต…" : "Checking credits…") : isGenerating ? (isThai ? "กำลังสร้างวิดีโอ…" : "Generating video…") : (isThai ? "สร้างพรีเซนเตอร์" : "Generate presenter")}
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
        <div className={styles.workflowStep}><span>02</span><div><strong>{isThai ? "ฟังตัวอย่างเสียง" : "Preview the voice"}</strong><small>{isThai ? "ฟังไฟล์ตัวอย่างที่ตั้งไว้ได้ฟรี และใช้ช่วยประเมินเวลา" : "Listen to the configured sample for free; its pace informs the estimate."}</small></div></div>
        <div className={styles.workflowStep}><span>03</span><div><strong>{isThai ? "ตรวจเครดิตแล้วสร้าง" : "Check credits and create"}</strong><small>{isThai ? "ตรวจราคารวมก่อนสร้างเสียงและวิดีโอจริง" : "Verify the combined price before generating speech and video."}</small></div></div>
      </section>
    </div>
  );
}
