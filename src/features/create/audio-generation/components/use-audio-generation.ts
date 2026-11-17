import { useTemplateSettings } from "@/features/templates/use-template-settings";
import { useTemplatePrompt } from "@/features/templates/use-template-prompt";
import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import { useLocale } from "@/lib/i18n/locale-provider";
import {
  createTextToSpeech,
  createTextToSpeechScenes,
  deleteAudioHistory,
  fetchAudioHistoryAudio,
  listAudioHistory,
  listAudioModels,
  listAudioVoices,
  listVoiceClones,
  previewVoiceClone,
  quoteTextToSpeech,
  quoteTextToSpeechScenes,
  saveAudioHistory,
  type AudioCreditQuote,
  type AudioHistoryEntry,
  type AudioModel,
  type AudioVoice,
  type SaveAudioHistoryInput,
  type TextToSpeechResponse,
  type VoiceCloneListItem,
} from "@/lib/api/audio";
import {
  type AudioHistoryItem,
  type AudioScene,
  type AudioTab,
  type MiniMaxSpeechEmotion,
} from "./audio-generation.types";
import {
  AUDIO_HISTORY_LIMIT,
  AUDIO_TAB_STORAGE_KEY,
  DEFAULT_AUDIO_PROMPT,
  MINIMAX_TEXT_TO_SPEECH_MODEL_KEYS,
  VOICE_PAGE_SIZE,
  defaultAudioScenes,
  tones,
  visibleTabs,
} from "./audio-generation.constants";
import {
  createAudioIdempotencyKey,
  failAudioProgress,
  finishAudioProgress,
  pickTextToSpeechModels,
  startAudioProgress,
  supportsMiniMaxSpeechTuning,
} from "./audio-generation.helpers";

export function useAudioGeneration() {
  const { locale, t } = useLocale();
  const [activeTab, setActiveTab] = useState<AudioTab>("Text to Speech");
  const [prompt, setPrompt] = useState(DEFAULT_AUDIO_PROMPT);
  const [tone, setTone] = useState<"Energetic" | "Friendly" | "Premium" | "Dramatic" | "">("");
  const [voiceMode, setVoiceMode] = useState<"tone" | "cloned">("tone");
  const [savedVoices, setSavedVoices] = useState<VoiceCloneListItem[]>([]);
  const [language, setLanguage] = useState("Thai");
  const [pronunciation, setPronunciation] = useState("");
  const [chosenModel, setSelectedModel] = useState("");
  const [availableModels, setAvailableModels] = useState<AudioModel[]>([]);
  // Cloned voices are registered with MiniMax Speech 2.8 HD, so that model is fixed while cloned voices are in use.
  const clonedVoiceModelKey = availableModels.find((model) =>
    MINIMAX_TEXT_TO_SPEECH_MODEL_KEYS.includes(model.key),
  )?.key;
  const isModelLockedToClonedVoice = voiceMode === "cloned" && Boolean(clonedVoiceModelKey);
  // MiniMax is only used through cloned voices, so the tone-voice list offers the other models.
  const toneVoiceModels = availableModels.filter((model) => !MINIMAX_TEXT_TO_SPEECH_MODEL_KEYS.includes(model.key));
  const selectableModels = toneVoiceModels;
  const selectedModel =
    isModelLockedToClonedVoice && clonedVoiceModelKey
      ? clonedVoiceModelKey
      : selectableModels.some((model) => model.key === chosenModel)
        ? chosenModel
        : (selectableModels[0]?.key ?? "");
  const [modelLoadState, setModelLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [selectedVoice, setSelectedVoice] = useState("");
  const [availableVoices, setAvailableVoices] = useState<AudioVoice[]>([]);
  const [voiceLoadState, setVoiceLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [canScrollVoicesLeft, setCanScrollVoicesLeft] = useState(false);
  const [canScrollVoicesRight, setCanScrollVoicesRight] = useState(false);
  const [format, setFormat] = useState("MP3");
  const [speed, setSpeed] = useState(0.95);
  const [pitch, setPitch] = useState(0);
  const [synthVolume, setSynthVolume] = useState(1);
  const [speechEmotion, setSpeechEmotion] = useState<MiniMaxSpeechEmotion | "">("");
  const [englishNormalization, setEnglishNormalization] = useState(false);
  const [ttsLanguageBoost, setTtsLanguageBoost] = useState<"Thai" | "English">("Thai");
  const [ttsSampleRate, setTtsSampleRate] = useState("");
  const [ttsBitrate, setTtsBitrate] = useState("");
  const [ttsChannel, setTtsChannel] = useState<"" | "1" | "2">("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioHistory, setAudioHistory] = useState<AudioHistoryItem[]>([]);
  const [historyLoadingId, setHistoryLoadingId] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(78);
  const [creditEstimate, setCreditEstimate] = useState<AudioCreditQuote | null>(null);
  const [creditEstimateLoading, setCreditEstimateLoading] = useState(false);
  const [creditEstimateError, setCreditEstimateError] = useState<string | null>(null);
  const [audioScenes, setAudioScenes] = useState<AudioScene[]>(defaultAudioScenes);
  // selectedSceneId/selectedScene/sceneError are kept in sync (see addAudioScene,
  // handleGenerateScenes below) but not yet read back by the UI — no scene-list
  // selection highlighting or scene-specific error message is wired up yet.
  const [selectedSceneId, setSelectedSceneId] = useState(defaultAudioScenes[0]!.id);
  void selectedSceneId;
  const [sceneGenerationStatus, setSceneGenerationStatus] = useState<"idle" | "generating" | "complete" | "error">(
    "idle",
  );
  const [sceneError, setSceneError] = useState<string | null>(null);
  void sceneError;
  const [status, setStatus] = useState<"idle" | "generating" | "complete" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedScene, setSelectedScene] = useState("01");
  void selectedScene;
  const audioRef = useRef<HTMLAudioElement>(null);
  const voicePreviewAudioRef = useRef<HTMLAudioElement>(null);
  const durationRef = useRef(0);
  const playbackFrameRef = useRef<number | null>(null);
  const voiceRowRef = useRef<HTMLDivElement>(null);
  const voiceScrollTargetRef = useRef(0);
  const voiceScrollUserMovedRef = useRef(false);
  const audioHistoryRef = useRef<AudioHistoryItem[]>([]);
  const historySequenceRef = useRef(0);
  const historyPlaybackRequestRef = useRef(0);
  const pendingHistoryPlaybackUrlRef = useRef<string | null>(null);
  // Mirrors savedVoices so loadVoices (deps: []) can tell a cloned voice_id
  // apart from a stale preset selection without re-running on every refresh.
  const savedVoicesRef = useRef<VoiceCloneListItem[]>([]);
  // A voice that was just opened from the Voice Clone tab; it can be missing from savedVoices until the list refreshes.
  const pendingClonedVoiceRef = useRef<string | null>(null);
  const [previewingVoiceKey, setPreviewingVoiceKey] = useState<string | null>(null);
  // The click handlers read this instead of the state above: state lags a render behind, so a quick second
  // click on a playing voice would otherwise start it again rather than stop it.
  const previewingVoiceKeyRef = useRef<string | null>(null);
  const updatePreviewingVoiceKey = useCallback((key: string | null) => {
    previewingVoiceKeyRef.current = key;
    setPreviewingVoiceKey(key);
  }, []);
  const [previewLoadingKey, setPreviewLoadingKey] = useState<string | null>(null);
  const clonePreviewUrlsRef = useRef(new Map<string, string>());

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const savedTab = window.localStorage.getItem(AUDIO_TAB_STORAGE_KEY);
        if (savedTab && visibleTabs.includes(savedTab as AudioTab)) setActiveTab(savedTab as AudioTab);
      } catch {
        // Ignore storage restrictions and keep the default tab.
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const tabBodyRef = useRef<HTMLDivElement>(null);
  const [tabBodyMinHeight, setTabBodyMinHeight] = useState<number | null>(null);

  const changeActiveTab = (tab: AudioTab) => {
    // A shorter tab would shrink the page and the browser would clamp the scroll position, jerking the banner and tab
    // bar upwards. While the page is scrolled, the tab being left holds its height so the new one opens where it was.
    const body = tabBodyRef.current;
    if (body && window.scrollY > 0) {
      const lockedHeight = body.style.minHeight;
      body.style.minHeight = "";
      setTabBodyMinHeight(body.offsetHeight);
      body.style.minHeight = lockedHeight;
    } else {
      setTabBodyMinHeight(null);
    }
    setActiveTab(tab);
    try {
      window.localStorage.setItem(AUDIO_TAB_STORAGE_KEY, tab);
    } catch {
      // Ignore storage restrictions; the tab still changes for this session.
    }
  };

  const openClonedVoiceInTextToSpeech = (voiceId?: string | null) => {
    pendingClonedVoiceRef.current = voiceId ?? null;
    setVoiceMode("cloned");
    if (voiceId) setSelectedVoice(voiceId);
    changeActiveTab("Text to Speech");
  };

  useTemplatePrompt("audio", (value) => {
    setPrompt(value);
    setAudioScenes((current) => current.map((scene, index) => (index === 0 ? { ...scene, text: value } : scene)));
  });

  useEffect(() => {
    return () => {
      historyPlaybackRequestRef.current += 1;
      audioHistoryRef.current.filter((item) => item.localUrl).forEach((item) => URL.revokeObjectURL(item.url));
    };
  }, []);

  useEffect(() => {
    if (!audioUrl || pendingHistoryPlaybackUrlRef.current !== audioUrl) return;
    pendingHistoryPlaybackUrlRef.current = null;
    const audio = audioRef.current;
    if (!audio) { setHistoryLoadingId(null); return; }
    let active = true;
    void audio.play().then(() => {
      if (active) { setIsPlaying(true); setHistoryLoadingId(null); }
    }).catch(() => {
      if (active) { setIsPlaying(false); setHistoryLoadingId(null); }
    });
    return () => { active = false; };
  }, [audioUrl]);

  useEffect(() => {
    if (activeTab !== "Text to Speech") return undefined;
    let cancelled = false;
    const timer = window.setTimeout(
      () =>
        void listAudioHistory({ limit: AUDIO_HISTORY_LIMIT })
          .then((items) => {
            if (cancelled) return;
            const history = items.map((item) => ({
              ...item,
              url: item.url ?? item.audioUrl ?? item.downloadUrl ?? "",
              localUrl: false,
              persisted: true,
            }));
            audioHistoryRef.current = history;
            setAudioHistory(history);
          })
          .catch(() => undefined),
      600,
    );
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [activeTab]);

  const loadModels = useCallback(async () => {
    setModelLoadState("loading");
    try {
      const items = await listAudioModels("textToSpeech");
      const eligible = pickTextToSpeechModels(items);
      setAvailableModels(eligible);
      setSelectedModel((current) => (eligible.some((model) => model.key === current) ? current : (eligible[0]?.key ?? "")));
      setModelLoadState("ready");
    } catch {
      setAvailableModels([]);
      setModelLoadState("error");
    }
  }, []);

  const loadVoices = useCallback(
    async (modelId?: string) => {
      voicePreviewAudioRef.current?.pause();
      updatePreviewingVoiceKey(null);
      setVoiceLoadState("loading");
      setVoiceError(null);
      try {
        const items = await listAudioVoices(modelId, "textToSpeech");
        setAvailableVoices(items);
        setSelectedVoice((current) => {
          const isPreset = items.some((voice) => voice.key === current);
          const isClonedVoice = savedVoicesRef.current.some((item) => item.voiceId === current);
          return isPreset || isClonedVoice || current === pendingClonedVoiceRef.current
            ? current
            : (items[0]?.key ?? "");
        });
        setVoiceLoadState("ready");
      } catch (error) {
        setAvailableVoices([]);
        setSelectedVoice("");
        setVoiceLoadState("error");
        setVoiceError(error instanceof Error ? error.message : "Unable to load voices");
      }
    },
    [updatePreviewingVoiceKey],
  );

  useEffect(() => {
    if (activeTab !== "Text to Speech") return undefined;
    const timer = window.setTimeout(() => void loadModels(), 0);
    return () => window.clearTimeout(timer);
  }, [activeTab, loadModels]);

  useEffect(() => {
    if (activeTab !== "Text to Speech") return undefined;
    const timer = window.setTimeout(() => void loadVoices(selectedModel || undefined), 0);
    return () => window.clearTimeout(timer);
  }, [activeTab, loadVoices, selectedModel]);

  const refreshSavedVoices = useCallback(async () => {
    try {
      const result = await listVoiceClones();
      savedVoicesRef.current = result.voices;
      setSavedVoices(result.voices);
    } catch {
      // Saved-voices list is a convenience; ignore load failures silently.
      // Do not keep waiting for a voice that never arrives.
      pendingClonedVoiceRef.current = null;
      setSavedVoices((current) => [...current]);
    }
  }, []);

  useEffect(() => {
    if (activeTab !== "Text to Speech") return undefined;
    const timer = window.setTimeout(() => void refreshSavedVoices(), 0);
    return () => window.clearTimeout(timer);
  }, [activeTab, refreshSavedVoices]);

  useEffect(() => {
    if (!availableVoices.length) return;
    // Voice metadata arrives asynchronously; reconcile persisted scene voices
    // after the external catalog has loaded.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAudioScenes((current) =>
      current.map((scene, index) =>
        availableVoices.some((voice) => voice.key === scene.voice)
          ? scene
          : { ...scene, voice: availableVoices[index % availableVoices.length]!.key },
      ),
    );
  }, [availableVoices]);

  const updateVoiceScrollButtons = useCallback(() => {
    const row = voiceRowRef.current;
    if (!row) return;
    const maxScrollLeft = Math.max(0, row.scrollWidth - row.clientWidth);
    const currentScrollLeft = Math.min(maxScrollLeft, Math.max(0, row.scrollLeft));
    voiceScrollTargetRef.current = currentScrollLeft;
    setCanScrollVoicesLeft(voiceScrollUserMovedRef.current && currentScrollLeft > 1);
    setCanScrollVoicesRight(maxScrollLeft - currentScrollLeft > 1);
  }, []);

  const scrollVoices = (direction: -1 | 1) => {
    const row = voiceRowRef.current;
    if (!row) return;
    const maxScrollLeft = Math.max(0, row.scrollWidth - row.clientWidth);
    const currentTarget = Math.min(maxScrollLeft, Math.max(0, voiceScrollTargetRef.current));
    const nextTarget = Math.min(maxScrollLeft, Math.max(0, currentTarget + direction * Math.max(row.clientWidth, 180)));
    voiceScrollTargetRef.current = nextTarget;
    if (direction > 0 && nextTarget > 1) voiceScrollUserMovedRef.current = true;
    if (direction < 0 && nextTarget <= 1) voiceScrollUserMovedRef.current = false;
    row.scrollTo({ left: nextTarget, behavior: "smooth" });
    setCanScrollVoicesLeft(voiceScrollUserMovedRef.current && nextTarget > 1);
    setCanScrollVoicesRight(maxScrollLeft - nextTarget > 1);
    window.setTimeout(updateVoiceScrollButtons, 450);
  };

  useEffect(() => {
    const row = voiceRowRef.current;
    if (!row) return;
    // A model switch or async voice refresh can preserve the old horizontal
    // offset. Always start the newly loaded catalog at page one; the left
    // control should only become visible after the user moves right.
    row.scrollLeft = 0;
    voiceScrollTargetRef.current = 0;
    voiceScrollUserMovedRef.current = false;
    setCanScrollVoicesLeft(false);
    updateVoiceScrollButtons();
    row.addEventListener("scroll", updateVoiceScrollButtons, { passive: true });
    const resizeObserver = new ResizeObserver(updateVoiceScrollButtons);
    resizeObserver.observe(row);
    return () => {
      row.removeEventListener("scroll", updateVoiceScrollButtons);
      resizeObserver.disconnect();
    };
  }, [availableVoices.length, savedVoices.length, voiceMode, selectedModel, voiceLoadState, updateVoiceScrollButtons]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (voiceMode === "cloned") {
        const pendingVoice = pendingClonedVoiceRef.current;
        // Keep the voice that was just opened until the saved list has loaded and shows it.
        if (pendingVoice && !savedVoices.some((item) => item.voiceId === pendingVoice)) return;
        pendingClonedVoiceRef.current = null;
        if (!savedVoices.some((item) => item.voiceId === selectedVoice)) {
          setSelectedVoice(savedVoices[0]?.voiceId ?? "");
        }
      } else if (availableVoices.length && !availableVoices.some((voice) => voice.key === selectedVoice)) {
        setSelectedVoice(availableVoices[0]!.key);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [voiceMode, savedVoices, availableVoices, selectedVoice]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed;
  }, [speed, audioUrl]);

  useEffect(
    () => () => {
      voicePreviewAudioRef.current?.pause();
    },
    [],
  );

  const stopVoicePreview = useCallback(
    (audio: HTMLAudioElement) => {
      audio.pause();
      audio.currentTime = 0;
      updatePreviewingVoiceKey(null);
    },
    [updatePreviewingVoiceKey],
  );

  const startVoicePreview = useCallback(
    (audio: HTMLAudioElement, key: string, url: string) => {
      audio.pause();
      audio.src = url;
      audio.currentTime = 0;
      updatePreviewingVoiceKey(key);
      void audio.play().catch((error: unknown) => {
        // Stopping or starting another voice interrupts this request; only a real failure of the latest one resets the button.
        const interrupted = error instanceof DOMException && error.name === "AbortError";
        if (!interrupted && previewingVoiceKeyRef.current === key) updatePreviewingVoiceKey(null);
      });
    },
    [updatePreviewingVoiceKey],
  );

  const toggleVoicePreview = useCallback(
    (voice: AudioVoice) => {
      const audio = voicePreviewAudioRef.current;
      if (!audio || !voice.previewUrl) return;
      if (previewingVoiceKeyRef.current === voice.key) {
        stopVoicePreview(audio);
        return;
      }
      startVoicePreview(audio, voice.key, voice.previewUrl);
    },
    [startVoicePreview, stopVoicePreview],
  );

  // Cloned voices have no stored sample, so generate a short one on first play and reuse it afterwards.
  const toggleClonePreview = useCallback(
    async (voiceKey: string) => {
      const audio = voicePreviewAudioRef.current;
      if (!audio) return;
      if (previewingVoiceKeyRef.current === voiceKey) {
        stopVoicePreview(audio);
        return;
      }
      audio.pause();
      updatePreviewingVoiceKey(null);
      let url = clonePreviewUrlsRef.current.get(voiceKey);
      if (!url) {
        setPreviewLoadingKey(voiceKey);
        setErrorMessage(null);
        try {
          const result = await previewVoiceClone(voiceKey, {
            text: language === "Thai" ? "สวัสดีครับ ยินดีต้อนรับสู่ อี-โอ-เอส ครีเอทีฟ สตูดิโอ" : "Hello, welcome to EOS Creative Studio.",
            outputFormat: "mp3",
          });
          url = URL.createObjectURL(result.blob);
          clonePreviewUrlsRef.current.set(voiceKey, url);
        } catch (error) {
          setErrorMessage(error instanceof Error ? (error.message === "Insufficient credits" ? t("create.audio.error.insufficientCredits") : error.message) : "Unable to preview this voice");
          return;
        } finally {
          setPreviewLoadingKey(null);
        }
      }
      startVoicePreview(audio, voiceKey, url);
    },
    [language, startVoicePreview, stopVoicePreview, t, updatePreviewingVoiceKey],
  );

  useEffect(() => {
    const previews = clonePreviewUrlsRef.current;
    return () => previews.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const handleVoicePreviewClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const voiceKey = event.currentTarget.dataset.voiceKey;
      if (voiceMode === "cloned") {
        if (voiceKey) {
          setSelectedVoice(voiceKey);
          void toggleClonePreview(voiceKey);
        }
        return;
      }
      const voice = availableVoices.find((item) => item.key === voiceKey);
      if (voice) {
        setSelectedVoice(voice.key);
        toggleVoicePreview(voice);
      }
    },
    [availableVoices, toggleVoicePreview, toggleClonePreview, voiceMode],
  );

  const syncAudioDuration = useCallback((audio: HTMLAudioElement) => {
    const nextDuration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0;
    if (!nextDuration) return;
    durationRef.current = nextDuration;
    setDuration(nextDuration);
    const nextTime = Number.isFinite(audio.currentTime) ? Math.min(audio.currentTime, nextDuration) : 0;
    setCurrentTime(nextTime);
    setProgress(Math.min(100, (nextTime / nextDuration) * 100));
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    durationRef.current = 0;
    if (!audioUrl) return;
    if (!audio) return;
    if (audio.readyState >= 1) syncAudioDuration(audio);
    else audio.load();
  }, [audioUrl, syncAudioDuration]);

  useEffect(() => {
    if (!isPlaying) {
      if (playbackFrameRef.current !== null) window.cancelAnimationFrame(playbackFrameRef.current);
      playbackFrameRef.current = null;
      return;
    }
    const updatePlaybackFrame = () => {
      const audio = audioRef.current;
      if (!audio || audio.paused) {
        playbackFrameRef.current = null;
        return;
      }
      const nextTime = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
      const nextDuration = durationRef.current || (Number.isFinite(audio.duration) ? audio.duration : 0);
      if (nextDuration > 0 && durationRef.current !== nextDuration) {
        durationRef.current = nextDuration;
        setDuration(nextDuration);
      }
      setCurrentTime(nextTime);
      setProgress(nextDuration ? Math.min(100, (nextTime / nextDuration) * 100) : 0);
      playbackFrameRef.current = window.requestAnimationFrame(updatePlaybackFrame);
    };
    playbackFrameRef.current = window.requestAnimationFrame(updatePlaybackFrame);
    return () => {
      if (playbackFrameRef.current !== null) window.cancelAnimationFrame(playbackFrameRef.current);
      playbackFrameRef.current = null;
    };
  }, [isPlaying]);

  // In "cloned" mode the Voice / Speaker carousel lists the user's saved clones instead of the presets.
  // A clone's voiceId is what the Voice Clone tab and the backend use to look it up (the API has no separate provider id).
  const clonedVoices: AudioVoice[] = savedVoices.map((item) => ({
    key: item.voiceId,
    name: item.name,
    description: item.character || item.description || t("create.audio.clone.characterNatural"),
    imageUrl: null,
    previewUrl: null,
  }));
  const carouselVoices = voiceMode === "cloned" ? clonedVoices : availableVoices;
  const voicePages = Array.from({ length: Math.ceil(carouselVoices.length / VOICE_PAGE_SIZE) }, (_, pageIndex) =>
    carouselVoices.slice(pageIndex * VOICE_PAGE_SIZE, pageIndex * VOICE_PAGE_SIZE + VOICE_PAGE_SIZE),
  );
  const carouselLoadState = voiceMode === "cloned" ? "ready" : voiceLoadState;
  // The history also lists the newest cloned voices, the same way the Voice Clone tab does, newest first.
  const historyRows = [
    ...audioHistory.map((item) => ({ kind: "entry" as const, key: item.id, createdAt: item.createdAt, item })),
    ...savedVoices.slice(0, AUDIO_HISTORY_LIMIT).map((voice) => ({
      kind: "voice" as const,
      key: `voice:${voice.voiceId}`,
      createdAt: voice.createdAt,
      voice,
    })),
  ].sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
  const isSceneMode = activeTab === "Podcast & Dialogue" && audioScenes.length > 0;
  const hasIncompleteScene = audioScenes.some((scene) => !scene.text.trim() || !scene.voice.trim());
  const isGenerating = status === "generating" || sceneGenerationStatus === "generating";
  const clearValues = () => {
    // The button stays visually independent of Generate; ignore clicks while a request is in flight.
    if (isGenerating) return;
    audioRef.current?.pause();
    voicePreviewAudioRef.current?.pause();
    setPrompt("");
    setTone("");
    setVoiceMode("tone");
    setLanguage("Thai");
    setPronunciation("");
    setSelectedModel(availableModels[0]?.key ?? "");
    setSelectedVoice(availableVoices[0]?.key ?? "");
    setFormat("MP3");
    setSpeed(0.95);
    setPitch(0);
    setSynthVolume(1);
    setAudioScenes(defaultAudioScenes.map((scene) => ({ ...scene, text: "", voice: availableVoices[0]?.key ?? "" })));
    setSelectedSceneId(defaultAudioScenes[0]!.id);
    setSelectedScene(defaultAudioScenes[0]!.id);
    setAudioUrl(null);
    setIsPlaying(false);
    setProgress(0);
    setDuration(0);
    setCurrentTime(0);
    durationRef.current = 0;
    setVolume(78);
    setHistoryLoadingId(null);
    updatePreviewingVoiceKey(null);
    setCreditEstimate(null);
    setCreditEstimateError(null);
    setErrorMessage(null);
    setSceneError(null);
    setStatus("idle");
    setSceneGenerationStatus("idle");
  };
  const generationValidationMessage = modelLoadState !== "loading" && !selectedModel
    ? t("create.audio.validation.noModel")
    : isSceneMode
    ? hasIncompleteScene
      ? t("create.audio.validation.completeScenes")
      : null
    : !prompt.trim()
      ? t("create.audio.validation.addScript")
      : voiceLoadState === "ready" && !selectedVoice
        ? t("create.audio.validation.selectVoice")
        : null;
  const creditQuoteRequest =
    selectedModel && (isSceneMode ? !hasIncompleteScene : Boolean(prompt.trim() && selectedVoice))
      ? isSceneMode
        ? {
            type: "scenes" as const,
            input: {
              scenes: audioScenes.map(({ title, text, voice }) => ({ title, text, voice })),
              modelId: selectedModel,
              outputFormat: format.toLowerCase() as "mp3" | "wav" | "ogg",
              languageCode: language === "Thai" ? "th" : language === "Japanese" ? "ja" : "en",
              ...(tone ? { tone } : {}),
              speed,
              pronunciationHint: pronunciation.trim() || undefined,
              pauseSeconds: 0.25,
            },
          }
        : {
            type: "single" as const,
            input: {
              text: prompt,
              voice: selectedVoice,
              modelId: selectedModel,
              outputFormat: format.toLowerCase() as "mp3" | "wav" | "ogg",
              languageCode: language === "Thai" ? "th" : language === "Japanese" ? "ja" : "en",
              ...(tone ? { tone } : {}),
              speed,
              pronunciationHint: pronunciation.trim() || undefined,
            },
          }
      : null;
  const creditQuoteKey = JSON.stringify(creditQuoteRequest);

  useEffect(() => {
    let active = true;
    const request =
      creditQuoteKey === "null" ? null : (JSON.parse(creditQuoteKey) as NonNullable<typeof creditQuoteRequest>);
    if (!request) {
      const resetTimer = window.setTimeout(() => {
        if (!active) return;
        setCreditEstimate(null);
        setCreditEstimateError(null);
        setCreditEstimateLoading(false);
      }, 0);
      return () => {
        active = false;
        window.clearTimeout(resetTimer);
      };
    }
    const timer = window.setTimeout(() => {
      setCreditEstimateLoading(true);
      setCreditEstimateError(null);
      const quotePromise =
        request.type === "scenes" ? quoteTextToSpeechScenes(request.input) : quoteTextToSpeech(request.input);
      void quotePromise
        .then((quote) => {
          if (!active) return;
          setCreditEstimate(quote);
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
      window.clearTimeout(timer);
    };
  }, [creditQuoteKey]);

  const addAudioScene = () => {
    if (audioScenes.length >= 20) return;
    const nextNumber = audioScenes.reduce((highest, scene) => Math.max(highest, Number(scene.id) || 0), 0) + 1;
    const nextScene: AudioScene = {
      id: String(nextNumber).padStart(2, "0"),
      title: t("create.audio.scenes.sceneNumber", { index: nextNumber }),
      durationSeconds: 6,
      text: audioScenes.length === 0 ? prompt : "",
      voice: selectedVoice || availableVoices[0]?.key || "",
    };
    setAudioScenes((current) => [...current, nextScene]);
    setSelectedSceneId(nextScene.id);
    setSceneGenerationStatus("idle");
    setSceneError(null);
  };
  // Not wired to a button yet — multi-scene TTS has no "add scene" UI hook.
  void addAudioScene;

  const formatTime = (seconds: number) => {
    if (!Number.isFinite(seconds) || seconds <= 0) return "00:00";
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
  };

  const appendHistory = (item: AudioHistoryItem) => {
    const nextHistory = [item, ...audioHistoryRef.current];
    const removedItems = nextHistory.slice(AUDIO_HISTORY_LIMIT);
    removedItems.filter((removed) => removed.localUrl).forEach((removed) => URL.revokeObjectURL(removed.url));
    const limitedHistory = nextHistory.slice(0, AUDIO_HISTORY_LIMIT);
    audioHistoryRef.current = limitedHistory;
    setAudioHistory(limitedHistory);
  };

  const persistGeneratedAudio = async (input: SaveAudioHistoryInput): Promise<AudioHistoryEntry | null> => {
    try {
      const saved = await saveAudioHistory(input);
      appendHistory({
        ...saved,
        url: saved.url ?? saved.audioUrl ?? saved.downloadUrl ?? "",
        localUrl: false,
        persisted: true,
      });
      return saved;
    } catch (cause) {
      console.warn("Unable to persist generated audio history", cause);
      // Generation preview remains available when persistent history storage is unavailable.
      return null;
    }
  };

  const setGeneratedAudioResult = (
    result: TextToSpeechResponse,
    label: string,
    voice: string,
    metadata: Record<string, unknown> = {},
  ) => {
    const nextUrl = URL.createObjectURL(result.blob);
    audioRef.current?.pause();
    historySequenceRef.current += 1;
    const localHistoryItem: AudioHistoryItem = {
      id: `${Date.now()}-${historySequenceRef.current}`,
      url: nextUrl,
      label,
      createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      feature: "tts",
      provider: "wavespeed",
      outputFormat: format.toLowerCase() as "mp3" | "wav" | "ogg",
      mimeType: result.contentType,
      sizeBytes: result.blob.size,
      metadata,
      voice,
      localUrl: true,
      persisted: false,
    };
    const historyItem = result.localHistoryId
      ? { ...localHistoryItem, id: result.localHistoryId, persisted: true }
      : localHistoryItem;
    appendHistory(historyItem);
    setAudioUrl(nextUrl);
    setCurrentTime(0);
    durationRef.current = 0;
    setDuration(0);
    setProgress(0);
    setIsPlaying(false);
  };

  const handleGenerate = async () => {
    setStatus("generating");
    setErrorMessage(null);
    const requestId = startAudioProgress("audio-text-to-speech");
    try {
      const result = await createTextToSpeech({
        text: prompt,
        voice: selectedVoice,
        modelId: selectedModel,
        outputFormat: format.toLowerCase() as "mp3" | "wav" | "ogg",
        languageCode: language === "Thai" ? "th" : language === "Japanese" ? "ja" : "en",
        ...(voiceMode === "tone" && tone ? { tone } : {}),
        speed,
        ...(supportsMiniMaxSpeechTuning(selectedModel)
          ? {
              pitch,
              volume: synthVolume,
              englishNormalization,
              ...(speechEmotion ? { emotion: speechEmotion } : {}),
              languageBoost: ttsLanguageBoost,
              ...(ttsSampleRate ? { sampleRate: Number(ttsSampleRate) as 8000 | 16000 | 22050 | 24000 | 32000 | 44100 } : {}),
              ...(ttsBitrate ? { bitrate: Number(ttsBitrate) as 32000 | 64000 | 128000 | 256000 } : {}),
              ...(ttsChannel ? { channel: ttsChannel } : {}),
            }
          : {}),
        pronunciationHint: pronunciation.trim() || undefined,
        idempotencyKey: createAudioIdempotencyKey(),
      });
      setGeneratedAudioResult(result, `Generation ${historySequenceRef.current + 1}`, selectedVoice);
      setStatus("complete");
      finishAudioProgress("audio-text-to-speech", requestId);
    } catch (error) {
      failAudioProgress("audio-text-to-speech", requestId);
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Audio generation failed");
    }
  };

  const handleGenerateScenes = async () => {
    const scenesToGenerate = audioScenes;
    if (!selectedModel || !availableVoices.length) {
      setSceneError("เลือก Voice Model และ Voice ก่อน Generate");
      setSceneGenerationStatus("error");
      return;
    }
    if (scenesToGenerate.some((scene) => !scene.text.trim())) {
      setSceneError("กรุณาใส่ข้อความให้ทุก Scene");
      setSceneGenerationStatus("error");
      return;
    }
    if (scenesToGenerate.some((scene) => !scene.voice.trim())) {
      setSceneError("กรุณาเลือก Voice ให้ทุก Scene");
      setSceneGenerationStatus("error");
      return;
    }
    if (!scenesToGenerate.length) {
      setSceneError("กรุณาใส่ข้อความอย่างน้อย 1 Scene");
      setSceneGenerationStatus("error");
      return;
    }
    setSceneGenerationStatus("generating");
    setStatus("generating");
    setSceneError(null);
    setErrorMessage(null);
    const requestId = startAudioProgress("audio-scenes");
    try {
      const result = await createTextToSpeechScenes({
        scenes: scenesToGenerate.map(({ title, text, voice }) => ({ title, text, voice })),
        modelId: selectedModel,
        outputFormat: format.toLowerCase() as "mp3" | "wav" | "ogg",
        languageCode: language === "Thai" ? "th" : language === "Japanese" ? "ja" : "en",
        ...(voiceMode === "tone" && tone ? { tone } : {}),
        speed,
        ...(supportsMiniMaxSpeechTuning(selectedModel)
          ? {
              pitch,
              volume: synthVolume,
              englishNormalization,
              ...(speechEmotion ? { emotion: speechEmotion } : {}),
              languageBoost: ttsLanguageBoost,
              ...(ttsSampleRate ? { sampleRate: Number(ttsSampleRate) as 8000 | 16000 | 22050 | 24000 | 32000 | 44100 } : {}),
              ...(ttsBitrate ? { bitrate: Number(ttsBitrate) as 32000 | 64000 | 128000 | 256000 } : {}),
              ...(ttsChannel ? { channel: ttsChannel } : {}),
            }
          : {}),
        pronunciationHint: pronunciation.trim() || undefined,
        pauseSeconds: 0.25,
        idempotencyKey: createAudioIdempotencyKey(),
      });
      setGeneratedAudioResult(result, `Scenes · ${scenesToGenerate.length} scenes`, scenesToGenerate[0]!.voice, {
        sceneCount: scenesToGenerate.length,
      });
      setSceneGenerationStatus("complete");
      setStatus("complete");
      finishAudioProgress("audio-scenes", requestId);
    } catch (error) {
      failAudioProgress("audio-scenes", requestId);
      setSceneGenerationStatus("error");
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Scene generation failed");
      setSceneError(error instanceof Error ? error.message : "Scene generation failed");
    }
  };

  const playHistoryUrl = (nextUrl: string) => {
    pendingHistoryPlaybackUrlRef.current = nextUrl;
    setAudioUrl(nextUrl);
  };

  const selectHistoryItem = (item: AudioHistoryItem) => {
    if (!item.id) return;
    const requestId = ++historyPlaybackRequestRef.current;
    const audio = audioRef.current;
    const isCurrentItem = Boolean(item.url && item.url === audioUrl);
    if (isCurrentItem && audio) {
      setHistoryLoadingId(null);
      if (audio.paused) {
        if (audio.ended || (durationRef.current > 0 && audio.currentTime >= durationRef.current)) audio.currentTime = 0;
        void audio
          .play()
          .then(() => setIsPlaying(true))
          .catch(() => setIsPlaying(false));
      } else {
        audio.pause();
        setIsPlaying(false);
      }
      return;
    }
    setHistoryLoadingId(item.id);
    audio?.pause();
    setCurrentTime(0);
    durationRef.current = 0;
    setDuration(0);
    setProgress(0);
    setIsPlaying(false);
    setErrorMessage(null);
    if (item.url && (item.localUrl || !item.persisted)) {
      playHistoryUrl(item.url);
      return;
    }
    void fetchAudioHistoryAudio(item.id)
      .then((result) => {
        if (requestId !== historyPlaybackRequestRef.current) return;
        const nextUrl = URL.createObjectURL(result.blob);
        const nextHistory = audioHistoryRef.current.map((historyItem) =>
          historyItem.id === item.id ? { ...historyItem, url: nextUrl, localUrl: true } : historyItem,
        );
        audioHistoryRef.current = nextHistory;
        setAudioHistory(nextHistory);
        playHistoryUrl(nextUrl);
      })
      .catch((error) => {
        if (requestId !== historyPlaybackRequestRef.current) return;
        setHistoryLoadingId(null);
        setErrorMessage(error instanceof Error ? error.message : "Unable to load saved audio");
      });
  };

  /* Two pieces of state, not one: `open` drives the close animation while the
     pending item has to outlive it, or the copy blanks out mid-fade. */
  const [pendingHistoryDelete, setPendingHistoryDelete] = useState<AudioHistoryItem | null>(null);
  const [historyDeleteOpen, setHistoryDeleteOpen] = useState(false);

  const removeHistoryItem = (item: AudioHistoryItem) => {
    const removeFromView = () => {
      if (item.localUrl && item.url) URL.revokeObjectURL(item.url);
      const nextHistory = audioHistoryRef.current.filter((historyItem) => historyItem.id !== item.id);
      audioHistoryRef.current = nextHistory;
      setAudioHistory(nextHistory);
      if (audioUrl === item.url) {
        audioRef.current?.pause();
        setAudioUrl(null);
        setCurrentTime(0);
        durationRef.current = 0;
        setDuration(0);
        setProgress(0);
        setIsPlaying(false);
        setStatus("idle");
      }
    };
    if (!item.persisted) {
      removeFromView();
      return;
    }
    void deleteAudioHistory(item.id)
      .then(removeFromView)
      .catch((error) => {
        setErrorMessage(error instanceof Error ? error.message : "Unable to delete saved audio");
      });
  };

  const togglePlayback = () => {
    const audio = audioRef.current;
    if (!audioUrl || !audio) return;
    if (audio.paused)
      void audio
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    else {
      audio.pause();
      setIsPlaying(false);
    }
  };

  const downloadAudio = () => {
    if (!audioUrl) return;
    const link = document.createElement("a");
    link.href = audioUrl;
    link.download = `eos-audio-${Date.now()}.${format.toLowerCase()}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const seekBy = (amount: number) => {
    if (!audioRef.current) return;
    const audioDuration = durationRef.current || duration;
    audioRef.current.currentTime = Math.max(0, Math.min(audioDuration, audioRef.current.currentTime + amount));
  };

  useTemplateSettings("audio", {
    ready: modelLoadState === "ready" && voiceLoadState === "ready",
    model: selectedModel,
    models: availableModels.map((m) => m.key),
    setModel: setSelectedModel,
    fixedModel: true,
    apply: (s, p) => {
      setPrompt(p);
      setAudioScenes((current) => current.map((scene, i) => (i === 0 ? { ...scene, text: p } : scene)));
      if (typeof s.voice === "string") {
        if (availableVoices.some((v) => v.key === s.voice)) setSelectedVoice(s.voice);
        else {
          setSelectedVoice("");
          window.alert("เสียงในเทมเพลตไม่พร้อมใช้ กรุณาเลือกเสียงใหม่ก่อนสร้าง");
        }
      }
      if (typeof s.outputFormat === "string") setFormat(s.outputFormat.toUpperCase());
      if (typeof s.speed === "number") setSpeed(s.speed);
      if (typeof s.tone === "string" && tones.some(({ label }) => label === s.tone))
        setTone(s.tone as Exclude<typeof tone, "">);
      if (typeof s.languageCode === "string")
        setLanguage(s.languageCode === "th" ? "Thai" : s.languageCode === "ja" ? "Japanese" : "English (US)");
      if (typeof s.pronunciationHint === "string") setPronunciation(s.pronunciationHint);
    },
  });

  return {
    activeTab,
    setActiveTab,
    prompt,
    setPrompt,
    tone,
    setTone,
    voiceMode,
    setVoiceMode,
    language,
    setLanguage,
    pronunciation,
    setPronunciation,
    setSelectedModel,
    availableModels,
    modelLoadState,
    selectedVoice,
    setSelectedVoice,
    voiceLoadState,
    voiceError,
    canScrollVoicesLeft,
    canScrollVoicesRight,
    format,
    setFormat,
    speed,
    setSpeed,
    pitch,
    setPitch,
    synthVolume,
    setSynthVolume,
    speechEmotion,
    setSpeechEmotion,
    englishNormalization,
    setEnglishNormalization,
    ttsLanguageBoost,
    setTtsLanguageBoost,
    ttsSampleRate,
    setTtsSampleRate,
    ttsBitrate,
    setTtsBitrate,
    ttsChannel,
    setTtsChannel,
    isPlaying,
    setIsPlaying,
    progress,
    setProgress,
    audioUrl,
    historyLoadingId,
    duration,
    setDuration,
    currentTime,
    setCurrentTime,
    volume,
    setVolume,
    creditEstimate,
    creditEstimateLoading,
    creditEstimateError,
    audioScenes,
    setAudioScenes,
    errorMessage,
    previewingVoiceKey,
    previewLoadingKey,
    tabBodyMinHeight,
    pendingHistoryDelete,
    setPendingHistoryDelete,
    historyDeleteOpen,
    setHistoryDeleteOpen,
    isModelLockedToClonedVoice,
    selectableModels,
    selectedModel,
    audioRef,
    voicePreviewAudioRef,
    durationRef,
    voiceRowRef,
    voiceScrollUserMovedRef,
    updatePreviewingVoiceKey,
    tabBodyRef,
    changeActiveTab,
    openClonedVoiceInTextToSpeech,
    loadVoices,
    scrollVoices,
    handleVoicePreviewClick,
    syncAudioDuration,
    carouselVoices,
    voicePages,
    carouselLoadState,
    historyRows,
    isSceneMode,
    hasIncompleteScene,
    isGenerating,
    clearValues,
    generationValidationMessage,
    formatTime,
    persistGeneratedAudio,
    handleGenerate,
    handleGenerateScenes,
    selectHistoryItem,
    removeHistoryItem,
    togglePlayback,
    downloadAudio,
    seekBy,
    locale,
    t,
  };
}

export type AudioGeneration = ReturnType<typeof useAudioGeneration>;
