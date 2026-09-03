"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import {
  AudioLines,
  AudioWaveform,
  Bookmark,
  Check,
  Clapperboard,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  CloudUpload,
  Copy,
  Download,
  Gauge,
  GripVertical,
  History,
  FileAudio,
  Info,
  LockKeyhole,
  Maximize2,
  Mic2,
  MoreHorizontal,
  Pause,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  RotateCw,
  Settings2,
  Smile,
  Sparkles,
  Star,
  Trash2,
  Volume2,
  WandSparkles,
  Waves,
  Zap,
} from "lucide-react";
import styles from "./audio-generation-page.module.css";
import { createDialogue, createSoundEffects, createTextToSpeech, createTextToSpeechScenes, createVoiceClone, deleteAudioHistory, fetchAudioHistoryAudio, getAudioCreditBalance, listAudioBackgroundMusic, listAudioHistory, listAudioModels, listAudioVoices, previewVoiceClone, quoteTextToSpeech, quoteTextToSpeechScenes, saveAudioHistory, type AudioBackgroundMusic, type AudioCreditQuote, type AudioHistoryEntry, type AudioModel, type AudioVoice, type SaveAudioHistoryInput, type SoundEffectVariant, type TextToSpeechResponse } from "@/lib/api/audio";

const tabs = [
  "Text to Speech",
  "Podcast & Dialogue",
  "Voice Clone",
  "Sound Effects",
  "Audio Cleanup",
] as const;

const tones = [
  { label: "Energetic", icon: Zap },
  { label: "Friendly", icon: Smile },
  { label: "Premium", icon: Star },
  { label: "Dramatic", icon: Clapperboard },
] as const;

const voiceImages = [
  "/generated-assets/audio-ui/audio-voice-female-warm.png",
  "/generated-assets/audio-ui/audio-voice-male-bold.png",
  "/generated-assets/audio-ui/audio-voice-youthful.png",
  "/generated-assets/audio-ui/audio-voice-corporate.png",
  "/generated-assets/audio-ui/audio-voice-podcast-host.png",
] as const;

const tutorials = [
  "/generated-assets/audio-ui/audio-guide-quick-start.png",
  "/generated-assets/audio-ui/audio-guide-prompt.png",
  "/generated-assets/audio-ui/audio-guide-podcast.png",
  "/generated-assets/audio-ui/audio-guide-sound-fx.png",
] as const;

const waveformBars = Array.from({ length: 88 }, (_, index) => Math.round(24 + Math.abs(Math.sin(index * 0.37)) * 48 + Math.abs(Math.sin(index * 0.91)) * 20));

type AudioHistoryItem = Omit<AudioHistoryEntry, "url"> & { url: string; localUrl?: boolean; persisted?: boolean };
const AUDIO_HISTORY_LIMIT = 10;
type SaveHistoryCallback = (input: SaveAudioHistoryInput) => Promise<void>;
type AudioScene = { id: string; title: string; durationSeconds: number; text: string; voice: string };
type PodcastSpeaker = { id: string; role: string; name: string; voice: string; image: string };
type PodcastLine = { id: string; speakerId: string; text: string; durationSeconds: number };

const DEFAULT_AUDIO_PROMPT = "Introducing EOS Creative Studio — your all-in-one platform to create, communicate, and captivate. From stunning visuals to powerful voices, we help your ideas hit harder and connect deeper.";
const defaultAudioScenes: AudioScene[] = [
  { id: "01", title: "Scene 1", durationSeconds: 12, text: DEFAULT_AUDIO_PROMPT, voice: "" },
];
const podcastSpeakerTones = ["orange", "blue", "green", "purple", "pink"] as const;
const defaultPodcastSpeakers: PodcastSpeaker[] = [
  { id: "host", role: "Host", name: "Nattapong", voice: "Female Warm", image: voiceImages[0] },
  { id: "guest-1", role: "Guest 1", name: "Supiticha", voice: "Female Bright", image: voiceImages[2] },
  { id: "guest-2", role: "Guest 2", name: "Thanakrit", voice: "Male Bold", image: voiceImages[1] },
  { id: "co-host", role: "Co-host", name: "Pimchanok", voice: "Podcast Host", image: voiceImages[4] },
];
const defaultPodcastLines: PodcastLine[] = [
  { id: "line-1", speakerId: "host", text: "สวัสดีครับทุกคน ยินดีต้อนรับเข้าสู่พอดแคสต์เปิดโลก AI สำหรับครีเอเตอร์ครับ", durationSeconds: 3.2 },
  { id: "line-2", speakerId: "guest-1", text: "สวัสดีค่ะ วันนี้เราจะมาคุยกันเรื่อง AI ที่ช่วยให้การทำงานคอนเทนต์ง่ายขึ้นค่ะ", durationSeconds: 4.6 },
  { id: "line-3", speakerId: "guest-2", text: "ใช่ครับ โดยเฉพาะเครื่องมือที่ช่วยสร้างเสียงและพอดแคสต์อัตโนมัติ", durationSeconds: 4.1 },
  { id: "line-4", speakerId: "co-host", text: "เดี๋ยวเรามาเริ่มกันที่พื้นฐานกันก่อนเลยดีกว่าว่า AI ทำงานยังไงบ้างนะคะ", durationSeconds: 4.8 },
];

function formatSceneSeconds(seconds: number): string {
  const safeSeconds = Math.max(0, Math.round(seconds));
  return `${String(Math.floor(safeSeconds / 60)).padStart(2, "0")}:${String(safeSeconds % 60).padStart(2, "0")}`;
}

function formatCreditAmount(value: number): string {
  return value.toLocaleString("th-TH", { maximumFractionDigits: 2 });
}

function createAudioIdempotencyKey(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function sceneTimeRange(items: AudioScene[], index: number): string {
  const start = items.slice(0, index).reduce((total, scene) => total + scene.durationSeconds, 0);
  return `${formatSceneSeconds(start)} – ${formatSceneSeconds(start + items[index]!.durationSeconds)}`;
}

function FieldLabel({ children, hint }: { children: ReactNode; hint?: string }) {
  return <div className={styles.fieldLabel}><span>{children}</span>{hint ? <small>{hint}</small> : null}</div>;
}

function SelectField({ label, children, value, onChange, disabled = false }: { label: string; children: ReactNode; value: string; onChange: (value: string) => void; disabled?: boolean }) {
  return <label className={styles.selectField}>
    <FieldLabel>{label}</FieldLabel>
    <span className={styles.selectWrap}>
      <select value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled}>{children}</select>
      <ChevronDown size={15} aria-hidden="true" />
    </span>
  </label>;
}

function PreviewWaveform({ audioUrl, progress, isPlaying }: { audioUrl: string | null; progress: number; isPlaying: boolean }) {
  const safeProgress = Math.min(100, Math.max(0, progress));
  return <div className={`${styles.waveform} ${isPlaying ? styles.waveformPlaying : ""}`} aria-label="Audio waveform preview">
    <div className={styles.waveformBars} aria-hidden="true">
      {waveformBars.map((height, index) => {
        const barProgress = (index / Math.max(1, waveformBars.length - 1)) * 100;
        return <span
          key={`${height}-${index}`}
          className={`${styles.waveformBar} ${audioUrl && barProgress <= safeProgress ? styles.waveformBarPlayed : ""}`}
          style={{ height: `${height}%`, animationDelay: `${(index % 12) * -75}ms`, animationDuration: `${0.86 + (index % 5) * 0.08}s` }}
        />;
      })}
    </div>
    {audioUrl ? <span className={styles.waveformPlayhead} style={{ left: `${safeProgress}%` }} aria-hidden="true" /> : null}
  </div>;
}

function AlternateHeading({ eyebrow, title, description, icon }: { eyebrow: string; title: string; description: string; icon: ReactNode }) {
  return <div className={styles.alternateHeading}>
    <div><span>{eyebrow}</span><h2>{title}</h2><p>{description}</p></div>
    <div className={styles.alternateHeadingIcon}>{icon}</div>
  </div>;
}

function AltWaveform({ label = "LIVE PREVIEW" }: { label?: string }) {
  return <div className={styles.altWaveform}>
    <Image src="/generated-assets/audio-ui/audio-waveform.png" alt="" fill unoptimized sizes="700px" />
    <span>{label}</span>
  </div>;
}

function PodcastDialogueLayout({ onHistorySaved, scenesTimeline }: { onHistorySaved?: SaveHistoryCallback; scenesTimeline: ReactNode }) {
  const [speakers, setSpeakers] = useState(defaultPodcastSpeakers);
  const [lines, setLines] = useState(defaultPodcastLines);
  const [activeSpeakerId, setActiveSpeakerId] = useState(defaultPodcastSpeakers[0]!.id);
  const [speakingStyle, setSpeakingStyle] = useState<"Interview" | "Roundtable" | "Storytelling">("Interview");
  const [language, setLanguage] = useState("Thai (ไทย)");
  const [outputFormat, setOutputFormat] = useState<"mp3" | "wav" | "ogg">("mp3");
  const [speed, setSpeed] = useState(1);
  const [backgroundMusic, setBackgroundMusic] = useState(true);
  const [normalizeAudio, setNormalizeAudio] = useState(true);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "generating" | "ready" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [previewProgress, setPreviewProgress] = useState(0);
  const [previewCurrentTime, setPreviewCurrentTime] = useState(0);
  const [previewDuration, setPreviewDuration] = useState(0);
  const [volume, setVolume] = useState(72);
  const previewAudioRef = useRef<HTMLAudioElement>(null);

  const totalDuration = lines.reduce((total, line) => total + line.durationSeconds, 0);
  const episodeScript = lines.map((line) => `${speakers.find((speaker) => speaker.id === line.speakerId)?.role ?? "Speaker"}: ${line.text.trim()}`).filter((line) => line.split(": ")[1]?.trim()).join("\n");
  const estimatedCredits = Math.max(1, Math.ceil(episodeScript.length / 18));

  useEffect(() => () => { if (audioUrl) URL.revokeObjectURL(audioUrl); }, [audioUrl]);

  const handleGenerate = async () => {
    if (!episodeScript.trim()) return;
    setStatus("generating");
    setError(null);
    try {
      const result = await createDialogue({
        script: episodeScript,
        speakers: speakers.map(({ role, voice }) => ({ name: role, voice })),
        conversationStyle: speakingStyle,
        languageCode: language.startsWith("Thai") ? "th" : "en",
        emotion: 0.64,
        pauseSeconds: 0.4,
        autoDirect: true,
        outputFormat,
      });
      const nextUrl = URL.createObjectURL(result.blob);
      setAudioUrl((previous) => { if (previous) URL.revokeObjectURL(previous); return nextUrl; });
      void onHistorySaved?.({ audio: result.blob, feature: "dialogue", label: "Podcast Episode 01", outputFormat, metadata: { speakingStyle, speakerCount: `${speakers.length} Speakers`, language, backgroundMusic, normalizeAudio, speed } });
      setStatus("ready");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Podcast generation failed");
      setStatus("error");
    }
  };

  const addSpeaker = () => {
    const nextNumber = speakers.length + 1;
    const nextSpeaker: PodcastSpeaker = { id: `speaker-${nextNumber}`, role: `Guest ${nextNumber - 1}`, name: `New Speaker ${nextNumber}`, voice: nextNumber % 2 === 0 ? "Male Bold" : "Female Warm", image: voiceImages[(nextNumber - 1) % voiceImages.length] };
    setSpeakers((current) => [...current, nextSpeaker]);
    setActiveSpeakerId(nextSpeaker.id);
  };

  const addLine = () => setLines((current) => [...current, { id: `line-${Date.now()}`, speakerId: activeSpeakerId || speakers[0]!.id, text: "เพิ่มบทพูดสำหรับบรรทัดนี้", durationSeconds: 4 }]);
  const updateLine = (id: string, changes: Partial<PodcastLine>) => setLines((current) => current.map((line) => line.id === id ? { ...line, ...changes } : line));
  const duplicateLine = (line: PodcastLine) => setLines((current) => { const index = current.findIndex((item) => item.id === line.id); const copy = { ...line, id: `line-${Date.now()}` }; return [...current.slice(0, index + 1), copy, ...current.slice(index + 1)]; });
  const removeLine = (id: string) => setLines((current) => current.length > 1 ? current.filter((line) => line.id !== id) : current);
  const togglePreview = async () => {
    if (!audioUrl) { await handleGenerate(); return; }
    const audio = previewAudioRef.current;
    if (!audio) return;
    if (audio.paused) await audio.play(); else audio.pause();
  };
  const downloadAudio = () => {
    if (!audioUrl) return;
    const link = document.createElement("a");
    link.href = audioUrl;
    link.download = `podcast-episode-01.${outputFormat}`;
    link.click();
  };

  return <div className={styles.podcastLayout}>
    <main className={styles.podcastMainColumn}>
      <section className={styles.podcastHeaderSection}>
        <div className={styles.podcastTitleGroup}><div className={styles.podcastTitleIcon}><Sparkles size={21} /></div><div><span className={styles.podcastEyebrow}>PODCAST &amp; DIALOGUE</span><h1>Podcast &amp; Dialogue</h1><p>Create natural conversations with multiple speakers.</p></div></div>
        <div className={styles.podcastHeaderActions}><button type="button" className={styles.podcastEpisodeButton}>Ep.01 เปิดโลก AI สำหรับครีเอเตอร์ <Pencil size={12} /></button><button type="button" className={styles.podcastToolbarButton}><CloudUpload size={15} /> Import Script</button><button type="button" className={styles.podcastToolbarButton}><Sparkles size={15} /> AI Assist</button><button type="button" className={styles.podcastToolbarButton}><Bookmark size={15} /> Save Draft</button></div>
      </section>

      <section className={styles.podcastSection} aria-label="Podcast speakers">
        <div className={styles.podcastSectionHeader}><h2>Speakers</h2><span>{speakers.length} people</span></div>
        <div className={styles.podcastSpeakerRow}>{speakers.map((speaker, index) => <button type="button" key={speaker.id} className={`${styles.podcastSpeakerCard} ${activeSpeakerId === speaker.id ? styles.podcastSpeakerCardActive : ""}`} onClick={() => setActiveSpeakerId(speaker.id)} aria-pressed={activeSpeakerId === speaker.id}><span className={styles.podcastSpeakerAvatar}><Image src={speaker.image} alt="" fill unoptimized sizes="54px" /></span><span className={styles.podcastSpeakerCopy}><small>{speaker.role}</small><strong>{speaker.name}</strong><em>{speaker.voice}</em></span><i data-tone={podcastSpeakerTones[index % podcastSpeakerTones.length]} /></button>)}<button type="button" className={styles.podcastAddSpeakerCard} onClick={addSpeaker}><Plus size={18} /><span>Add Speaker</span></button></div>
      </section>

      <section className={styles.podcastSection} aria-label="Dialogue lines">
        <div className={styles.podcastSectionHeader}><h2>Dialogue</h2><span>{lines.length} lines · {formatSceneSeconds(totalDuration)}</span></div>
        <div className={styles.podcastLineList}>{lines.map((line, index) => { const speaker = speakers.find((item) => item.id === line.speakerId) ?? speakers[0]!; const start = lines.slice(0, index).reduce((total, item) => total + item.durationSeconds, 0); return <div className={`${styles.podcastLineRow} ${index === 0 ? styles.podcastLineRowActive : ""}`} key={line.id}>
          <button type="button" className={styles.podcastDragHandle} aria-label={`Reorder line ${index + 1}`}><GripVertical size={15} /></button>
          <span className={styles.podcastLineAvatar}><Image src={speaker.image} alt="" fill unoptimized sizes="34px" /></span>
          <time>{formatSceneSeconds(start)}</time>
          <span className={styles.podcastSpeakerChip} data-tone={podcastSpeakerTones[speakers.findIndex((item) => item.id === speaker.id) % podcastSpeakerTones.length]}>{speaker.role}</span>
          <input className={styles.podcastLineInput} value={line.text} onChange={(event) => updateLine(line.id, { text: event.target.value })} aria-label={`Dialogue line ${index + 1}`} />
          <input className={styles.podcastLineDuration} type="number" min="0.5" max="120" step="0.1" value={line.durationSeconds} onChange={(event) => updateLine(line.id, { durationSeconds: Math.max(0.5, Number(event.target.value) || 0.5) })} aria-label={`Duration for line ${index + 1}`} />
          <button type="button" className={`${styles.podcastLineAction} ${styles.podcastLineCopyAction}`} onClick={() => duplicateLine(line)} aria-label={`Duplicate line ${index + 1}`}><Copy size={15} /></button>
          <button type="button" className={styles.podcastLineActionDanger} onClick={() => removeLine(line.id)} disabled={lines.length <= 1} aria-label={`Delete line ${index + 1}`}><Trash2 size={15} /></button>
          <button type="button" className={`${styles.podcastLineAction} ${styles.podcastLineMoreAction}`} aria-label={`More actions for line ${index + 1}`}><MoreHorizontal size={15} /></button>
        </div>; })}</div>
        <button type="button" className={styles.podcastAddLine} onClick={addLine}><Plus size={15} /> Add Next Line</button>
      </section>

      <section className={styles.podcastPreviewCard} aria-label="Audio preview">
        <div className={styles.podcastSectionHeader}><h2>Audio Preview <span className={styles.podcastBeta}>Beta</span></h2><div className={styles.podcastPreviewActions}><button type="button" className={styles.podcastToolbarButton} onClick={downloadAudio} disabled={!audioUrl}><Download size={15} /> Download</button><button type="button" className={styles.podcastLineAction} aria-label="Fullscreen audio preview"><Maximize2 size={15} /></button></div></div>
        <div className={styles.podcastAudioPlayer}><button type="button" className={styles.podcastPlayButton} onClick={() => void togglePreview()} disabled={status === "generating"}><span>{isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}</span></button><div className={styles.podcastWaveformWrap}><PreviewWaveform audioUrl={audioUrl} progress={previewProgress} isPlaying={isPlaying} /><div className={styles.podcastAudioMeta}><span>{formatSceneSeconds(previewCurrentTime)} / {formatSceneSeconds(previewDuration || totalDuration)}</span><input type="range" min="0" max="100" value={previewProgress} onChange={(event) => { const nextProgress = Number(event.target.value); setPreviewProgress(nextProgress); if (previewAudioRef.current && previewDuration) previewAudioRef.current.currentTime = nextProgress / 100 * previewDuration; }} aria-label="Audio progress" disabled={!audioUrl} /></div></div><Volume2 size={16} className={styles.podcastVolumeIcon} /><input className={styles.podcastVolumeSlider} type="range" min="0" max="100" value={volume} onChange={(event) => { const nextVolume = Number(event.target.value); setVolume(nextVolume); if (previewAudioRef.current) previewAudioRef.current.volume = nextVolume / 100; }} aria-label="Volume" /><audio ref={previewAudioRef} src={audioUrl ?? undefined} preload="metadata" onLoadedMetadata={(event) => { setPreviewDuration(event.currentTarget.duration); event.currentTarget.volume = volume / 100; }} onTimeUpdate={(event) => { const current = event.currentTarget.currentTime; const duration = event.currentTarget.duration || previewDuration; setPreviewCurrentTime(current); setPreviewProgress(duration ? current / duration * 100 : 0); }} onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} onEnded={() => { setIsPlaying(false); setPreviewProgress(100); }} /></div>
        {status === "error" || error ? <p className={styles.podcastError} role="alert">{error}</p> : null}
      </section>
      {scenesTimeline}
    </main>

    <aside className={styles.podcastSettingsCard} aria-label="Podcast settings">
      <div className={styles.podcastSettingsHeader}><h2>Podcast Settings</h2><AudioWaveform size={18} /></div>
      <div className={styles.podcastSettingGroup}><span className={styles.podcastFieldLabel}>OUTPUT FORMAT</span><div className={styles.podcastFormatRow}>{(["mp3", "wav", "ogg"] as const).map((format) => <button type="button" key={format} className={outputFormat === format ? styles.podcastFormatActive : styles.podcastFormatButton} onClick={() => setOutputFormat(format)}>{format.toUpperCase()}</button>)}</div></div>
      <label className={styles.podcastSelectField}><span className={styles.podcastFieldLabel}>LANGUAGE</span><select value={language} onChange={(event) => setLanguage(event.target.value)}><option>Thai (ไทย)</option><option>English (US)</option><option>English (UK)</option></select><ChevronDown size={14} /></label>
      <label className={styles.podcastSelectField}><span className={styles.podcastFieldLabel}>SPEAKING STYLE</span><select value={speakingStyle} onChange={(event) => setSpeakingStyle(event.target.value as typeof speakingStyle)}><option value="Interview">Conversational</option><option value="Roundtable">Roundtable</option><option value="Storytelling">Storytelling</option></select><ChevronDown size={14} /></label>
      <div className={styles.podcastSettingGroup}><div className={styles.podcastSpeedHeader}><span className={styles.podcastFieldLabel}>PACING / SPEED</span><b>{speed.toFixed(2)}x</b></div><input className={styles.podcastSpeedSlider} type="range" min="0.5" max="2" step="0.05" value={speed} onChange={(event) => setSpeed(Number(event.target.value))} /><div className={styles.podcastSpeedLabels}><span>0.5x</span><span>1x</span><span>1.5x</span><span>2x</span></div></div>
      <div className={styles.podcastToggleGroup}><label><span><strong>Background Music</strong><small>เพิ่มเพลงประกอบระหว่างบทพูด</small></span><button type="button" className={backgroundMusic ? styles.podcastToggleOn : styles.podcastToggleOff} onClick={() => setBackgroundMusic((current) => !current)} aria-pressed={backgroundMusic}><i /></button></label><label><span><strong>Normalize Audio</strong><small>ปรับระดับเสียงให้สม่ำเสมอ</small></span><button type="button" className={normalizeAudio ? styles.podcastToggleOn : styles.podcastToggleOff} onClick={() => setNormalizeAudio((current) => !current)} aria-pressed={normalizeAudio}><i /></button></label></div>
      <div className={styles.podcastEstimate}><div><span>Estimated Duration</span><strong>{formatSceneSeconds(totalDuration)}</strong></div><div><span>Estimated Credits</span><strong>~ {estimatedCredits} Credits</strong></div><small>{estimatedCredits} Credits available · Failed generations refunded</small></div>
      <button type="button" className={styles.podcastGenerateButton} onClick={() => void handleGenerate()} disabled={status === "generating" || !episodeScript.trim()}>{status === "generating" ? "GENERATING..." : "Generate Podcast"} <Sparkles size={16} /></button>
      <p className={styles.podcastSecurityNote}><LockKeyhole size={11} /> Secure generation. Your data is private.</p>
    </aside>
  </div>;
}

function VoiceCloneLayout({ onHistorySaved }: { onHistorySaved?: SaveHistoryCallback }) {
  const [sampleReady, setSampleReady] = useState(false);
  const [sampleFile, setSampleFile] = useState<File | null>(null);
  const [voiceName, setVoiceName] = useState("EOS Narrator");
  const [character, setCharacter] = useState("Natural");
  const [consent, setConsent] = useState(true);
  const [voiceId, setVoiceId] = useState<string | null>(null);
  const [testPhrase, setTestPhrase] = useState("Your ideas deserve a voice that people remember.");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "creating" | "ready" | "previewing" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const sampleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => { if (audioUrl) URL.revokeObjectURL(audioUrl); }, [audioUrl]);

  const handleSample = (file: File | undefined) => {
    if (!file) return;
    setSampleFile(file);
    setSampleReady(true);
    setVoiceId(null);
    setStatus("idle");
  };

  const handleCreate = async () => {
    if (!sampleFile) { setError("Please choose a voice sample first"); setStatus("error"); return; }
    if (!consent) { setError("Please confirm permission to use this voice sample"); setStatus("error"); return; }
    setStatus("creating");
    setError(null);
    try {
      const result = await createVoiceClone({ name: voiceName, character, consentConfirmed: consent, files: [sampleFile] });
      setVoiceId(result.voiceId);
      setStatus("ready");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Voice clone failed");
      setStatus("error");
    }
  };

  const handlePreview = async () => {
    if (!voiceId) { setError("Create the voice before playing a test phrase"); setStatus("error"); return; }
    setStatus("previewing");
    setError(null);
    try {
      const result = await previewVoiceClone(voiceId, { text: testPhrase, outputFormat: "mp3", languageCode: "en" });
      const nextUrl = URL.createObjectURL(result.blob);
      setAudioUrl((previous) => { if (previous) URL.revokeObjectURL(previous); return nextUrl; });
      void onHistorySaved?.({ audio: result.blob, feature: "voice-clone", label: `${voiceName} preview`, outputFormat: "mp3", voice: voiceId, metadata: { character } });
      setStatus("ready");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Voice preview failed");
      setStatus("error");
    }
  };

  return <div className={styles.alternateLayout}>
    <section className={`${styles.alternatePanel} ${styles.alternateFormPanel}`}>
      <AlternateHeading eyebrow="VOICE CLONE" title="Create a voice identity" description="Upload a clean sample and tune a voice for your next project." icon={<WandSparkles size={24} />} />
      <input ref={sampleInputRef} hidden type="file" accept="audio/wav,audio/mpeg,audio/ogg,audio/*" onChange={(event) => handleSample(event.target.files?.[0])} />
      <button type="button" className={`${styles.cloneDropzone} ${sampleReady ? styles.cloneDropzoneReady : ""}`} onClick={() => sampleInputRef.current?.click()}><span className={styles.cloneIcon}><CloudUpload size={23} /></span><strong>{sampleReady ? "Voice sample ready" : "Drop a voice sample here"}</strong><small>{sampleReady ? `${sampleFile?.name ?? "sample-voice.wav"} · ready to upload` : "WAV or MP3 · 10–60 seconds"}</small><em>{sampleReady ? "Click to replace" : "Browse files"}</em></button>
      <label className={styles.altTextField}><span>VOICE NAME</span><input value={voiceName} onChange={(event) => setVoiceName(event.target.value)} /></label>
      <div className={styles.altFieldGroup}><span className={styles.altFieldLabel}>VOICE CHARACTER</span><div className={styles.altChoiceRow}>{["Natural", "Cinematic", "Expressive"].map((item) => <button type="button" key={item} className={character === item ? styles.altChoiceActive : styles.altChoice} onClick={() => setCharacter(item)}>{item}</button>)}</div></div>
      <label className={styles.altConsent}><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /> I have permission to use this voice sample</label>
    </section>

    <section className={`${styles.alternatePanel} ${styles.alternateCenterPanel}`}>
      <div className={styles.altPanelHeader}><div><span className={styles.altEyebrow}>VOICE PREVIEW</span><h2>CLONE PLAYGROUND</h2></div><span className={styles.altStatus}><span /> {voiceId ? "Voice ready" : "Sample loaded"}</span></div>
      <div className={styles.mockNotice}><LockKeyhole size={13} /><span>{status === "creating" ? "CREATING VOICE VIA BACKEND" : error ?? (voiceId ? "VOICE READY" : "BACKEND VOICE CLONE API")}</span></div>
      <div className={styles.clonePreviewCard}><div className={styles.clonePortrait}><Mic2 size={25} /><span>EOS</span></div><div><strong>{voiceName}</strong><small>{character} · English (US)</small><div className={styles.cloneMeta}><span>Warm</span><span>Clear</span><span>Studio</span></div></div><button type="button" className={styles.altRoundButton} onClick={() => void handlePreview()} disabled={!voiceId || status === "previewing"}><Play size={17} fill="currentColor" /></button></div>
      <AltWaveform label="VOICE SAMPLE" />
      {audioUrl ? <audio controls src={audioUrl} style={{ width: "100%" }} /> : null}
      <div className={styles.altTimeline}><span>00:00</span><div><i style={{ width: "58%" }} /><b /><b /></div><span>00:34</span></div>
      <label className={styles.altTextField}><span>TEST PHRASE</span><textarea value={testPhrase} onChange={(event) => setTestPhrase(event.target.value)} maxLength={2000} /></label>
      <div className={styles.altActionRow}><button type="button" className={styles.altPrimaryButton} onClick={() => void handlePreview()} disabled={!voiceId || status === "previewing"}><Play size={15} fill="currentColor" /> {status === "previewing" ? "Generating..." : "Play test phrase"}</button><button type="button" className={styles.altSecondaryButton} onClick={() => void handleCreate()} disabled={status === "creating" || !sampleFile}>{status === "creating" ? "Creating..." : "Save voice"}</button></div>
    </section>

    <aside className={styles.alternateSettings}>
      <div className={styles.altPanelHeader}><h2>CLONE SETTINGS</h2><Settings2 size={20} /></div>
      <div className={styles.altSettingBlock}><div className={styles.altSettingHeading}><span>SIMILARITY</span><b>88%</b></div><input className={styles.altRange} type="range" min="0" max="100" defaultValue="88" /></div>
      <div className={styles.altSettingBlock}><div className={styles.altSettingHeading}><span>EXPRESSIVENESS</span><b>64%</b></div><input className={styles.altRange} type="range" min="0" max="100" defaultValue="64" /></div>
      <label className={styles.altField}><span>LANGUAGE</span><select defaultValue="English (US)"><option>English (US)</option><option>English (UK)</option><option>Thai</option></select></label>
      <div className={styles.altSettingBlock}><span className={styles.altFieldLabel}>OUTPUT FORMAT</span><div className={styles.altFormatGrid}><button type="button" className={styles.altFormatActive}>MP3</button><button type="button" className={styles.altFormat}>WAV</button><button type="button" className={styles.altFormat}>OGG</button></div></div>
      <button type="button" className={styles.altGenerateButton} onClick={() => void handleCreate()} disabled={status === "creating" || !sampleFile}>{status === "creating" ? "CREATING..." : "CREATE VOICE"} <Sparkles size={16} /></button>
    </aside>
  </div>;
}

function SoundEffectsLayout({ onHistorySaved }: { onHistorySaved?: SaveHistoryCallback }) {
  const [effectType, setEffectType] = useState("Cinematic");
  const [description, setDescription] = useState("A cinematic whoosh that rises quickly, hits with a soft impact, and fades into a deep room tone.");
  const [duration, setDuration] = useState(4);
  const [variationCount, setVariationCount] = useState(4);
  const [variants, setVariants] = useState<SoundEffectVariant[]>([]);
  const [audioUrls, setAudioUrls] = useState<Record<number, string>>({});
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [status, setStatus] = useState<"idle" | "generating" | "ready" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => { Object.values(audioUrls).forEach((url) => URL.revokeObjectURL(url)); }, [audioUrls]);

  const handleGenerate = async () => {
    setStatus("generating");
    setError(null);
    try {
      const nextVariants = await createSoundEffects({ description, category: effectType, durationSeconds: duration, variationCount, intensity: 0.72, promptInfluence: 0.48, loop: false, normalizeLoudness: true, outputFormat: "mp3" });
      const nextUrls: Record<number, string> = {};
      nextVariants.forEach((variant) => {
        const binary = Uint8Array.from(atob(variant.audioBase64), (character) => character.charCodeAt(0));
        const blob = new Blob([binary.buffer as ArrayBuffer], { type: variant.contentType });
        nextUrls[variant.index] = URL.createObjectURL(blob);
        void onHistorySaved?.({ audio: blob, feature: "sound-effects", label: `${effectType} variation ${variant.index}`, outputFormat: "mp3", metadata: { description, durationSeconds: duration, variation: variant.index } });
      });
      setVariants(nextVariants);
      setAudioUrls(nextUrls);
      setSelectedIndex(nextVariants[0]?.index ?? 0);
      setStatus("ready");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sound effect generation failed");
      setStatus("error");
    }
  };

  const selectedUrl = audioUrls[selectedIndex];
  const downloadSelected = () => {
    if (!selectedUrl) return;
    const link = document.createElement("a");
    link.href = selectedUrl;
    link.download = `sound-effect-${selectedIndex}.mp3`;
    link.click();
  };

  return <div className={styles.alternateLayout}>
    <section className={`${styles.alternatePanel} ${styles.alternateFormPanel}`}>
      <AlternateHeading eyebrow="SOUND EFFECTS" title="Design the moment" description="Describe a sound and create variations ready for your edit." icon={<AudioLines size={24} />} />
      <label className={styles.altTextField}><span>SOUND DESCRIPTION</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1000} /></label>
      <div className={styles.altFieldGroup}><span className={styles.altFieldLabel}>EFFECT CATEGORY</span><div className={styles.altChoiceRow}>{["Cinematic", "Nature", "UI / Tech", "Impact"].map((item) => <button type="button" key={item} className={effectType === item ? styles.altChoiceActive : styles.altChoice} onClick={() => setEffectType(item)}>{item}</button>)}</div></div>
      <div className={styles.altTwoFields}><label className={styles.altField}><span>DURATION</span><select value={String(duration)} onChange={(event) => setDuration(Number(event.target.value))}><option value="2">02 seconds</option><option value="4">04 seconds</option><option value="8">08 seconds</option></select></label><label className={styles.altField}><span>VARIATIONS</span><select value={String(variationCount)} onChange={(event) => setVariationCount(Number(event.target.value))}><option value="2">2 variations</option><option value="4">4 variations</option><option value="6">6 variations</option></select></label></div>
      <button disabled type="button" className={styles.altUploadButton}><CloudUpload size={17} /> Use reference audio</button>
    </section>

    <section className={`${styles.alternatePanel} ${styles.alternateCenterPanel}`}>
      <div className={styles.altPanelHeader}><div><span className={styles.altEyebrow}>{variants.length || variationCount} VARIATIONS</span><h2>SOUND PREVIEW</h2></div><span className={styles.altStatus}><span /> {status === "generating" ? "Generating" : "Ready"}</span></div>
      <div className={styles.mockNotice}><LockKeyhole size={13} /><span>{status === "generating" ? "GENERATING VIA BACKEND" : error ?? "BACKEND SOUND EFFECTS API"}</span></div>
      <AltWaveform label="CINEMATIC WHOOSH" />
      {selectedUrl ? <audio controls src={selectedUrl} style={{ width: "100%" }} /> : null}
      <div className={styles.effectPlayer}><button type="button" className={styles.altRoundButton} onClick={() => selectedUrl ? void new Audio(selectedUrl).play() : void handleGenerate()} disabled={status === "generating"}><Play size={18} fill="currentColor" /></button><div><strong>{selectedIndex ? `Sound Effect ${selectedIndex}` : "Generate a sound effect"}</strong><small>{duration.toString().padStart(2, "0")}s · {effectType} · MP3</small></div><MoreHorizontal size={17} /></div>
      <div className={styles.effectVariationGrid}>{variants.map((variant) => <button type="button" key={variant.index} className={selectedIndex === variant.index ? styles.effectCardActive : styles.effectCard} onClick={() => setSelectedIndex(variant.index)}><span className={styles.effectMiniWave} /><strong>Variation {variant.index}</strong><small>{duration.toString().padStart(2, "0")}s</small><Play size={12} fill="currentColor" /></button>)}</div>
      <div className={styles.altActionRow}><button type="button" className={styles.altPrimaryButton} onClick={downloadSelected} disabled={!selectedUrl}><Download size={15} /> Download selected</button><button type="button" className={styles.altSecondaryButton} onClick={() => void handleGenerate()} disabled={status === "generating"}>Regenerate</button></div>
    </section>

    <aside className={styles.alternateSettings}>
      <div className={styles.altPanelHeader}><h2>EFFECT SETTINGS</h2><Settings2 size={20} /></div>
      <div className={styles.altSettingBlock}><div className={styles.altSettingHeading}><span>INTENSITY</span><b>72%</b></div><input className={styles.altRange} type="range" min="0" max="100" defaultValue="72" /></div>
      <div className={styles.altSettingBlock}><div className={styles.altSettingHeading}><span>VARIATION</span><b>Balanced</b></div><input className={styles.altRange} type="range" min="0" max="100" defaultValue="52" /></div>
      <label className={styles.altToggleRow}><span>Seamless loop</span><button disabled type="button" className={styles.altToggleOff}><i /></button></label>
      <label className={styles.altToggleRow}><span>Normalize loudness</span><button disabled type="button" className={styles.altToggleOn}><i /></button></label>
      <div className={styles.altSettingBlock}><span className={styles.altFieldLabel}>OUTPUT FORMAT</span><div className={styles.altFormatGrid}><button disabled type="button" className={styles.altFormat}>WAV</button><button disabled type="button" className={styles.altFormatActive}>MP3</button><button disabled type="button" className={styles.altFormat}>OGG</button></div></div>
      <button type="button" className={styles.altGenerateButton} onClick={() => void handleGenerate()} disabled={status === "generating" || !description.trim()}>{status === "generating" ? "GENERATING..." : "GENERATE SOUND"} <Sparkles size={16} /></button>
    </aside>
  </div>;
}

function AudioCleanupLayout() {
  return <div className={styles.alternateLayout}>
    <section className={`${styles.alternatePanel} ${styles.alternateFormPanel}`}>
      <AlternateHeading eyebrow="AUDIO CLEANUP" title="Polish every recording" description="Remove noise and restore clarity without losing the character of the voice." icon={<Waves size={24} />} />
      <button disabled type="button" className={`${styles.cleanupUpload} ${styles.cleanupUploadReady}`}><span className={styles.cleanupFileIcon}><FileAudio size={21} /></span><span><strong>interview-recording.wav</strong><small>WAV · 00:42 · 18.4 MB</small></span><Check size={17} /></button>
      <div className={styles.altFieldGroup}><span className={styles.altFieldLabel}>CLEANUP TOOLS</span><div className={styles.cleanupToolList}><label><input disabled type="checkbox" defaultChecked /><span><strong>Noise reduction</strong><small>Remove room tone and hiss</small></span></label><label><input disabled type="checkbox" defaultChecked /><span><strong>Voice clarity</strong><small>Bring speech forward</small></span></label><label><input disabled type="checkbox" /><span><strong>Remove reverb</strong><small>Tighten the recording space</small></span></label></div></div>
      <button disabled type="button" className={styles.altUploadButton}><CloudUpload size={17} /> Replace audio file</button>
    </section>

    <section className={`${styles.alternatePanel} ${styles.alternateCenterPanel}`}>
      <div className={styles.altPanelHeader}><div><span className={styles.altEyebrow}>CLEANUP PREVIEW</span><h2>BEFORE &amp; AFTER</h2></div><span className={styles.altStatus}><span /> Coming soon</span></div>
      <div className={styles.mockNotice}><LockKeyhole size={13} /><span>COMING SOON · API PENDING</span></div>
      <div className={styles.cleanupCompare}><div><span>ORIGINAL</span><AltWaveform label="ROOM NOISE" /></div><div><span>CLEANED</span><AltWaveform label="VOICE CLARITY" /></div></div>
      <div className={styles.cleanupStats}><div><strong>−18 dB</strong><small>Noise floor</small></div><div><strong>+24%</strong><small>Speech clarity</small></div><div><strong>−2.4 LUFS</strong><small>Loudness change</small></div></div>
      <div className={styles.altActionRow}><button disabled type="button" className={styles.altPrimaryButton}><Play size={15} fill="currentColor" /> Preview cleaned audio</button><button disabled type="button" className={styles.altSecondaryButton}>Compare</button></div>
    </section>

    <aside className={styles.alternateSettings}>
      <div className={styles.altPanelHeader}><h2>CLEANUP SETTINGS</h2><Settings2 size={20} /></div>
      <div className={styles.altSettingBlock}><div className={styles.altSettingHeading}><span>NOISE REDUCTION</span><b>68%</b></div><input disabled className={styles.altRange} type="range" min="0" max="100" defaultValue="68" /></div>
      <div className={styles.altSettingBlock}><div className={styles.altSettingHeading}><span>VOICE PRESENCE</span><b>76%</b></div><input disabled className={styles.altRange} type="range" min="0" max="100" defaultValue="76" /></div>
      <label className={styles.altToggleRow}><span>Preserve natural tone</span><button disabled type="button" className={styles.altToggleOn}><i /></button></label>
      <label className={styles.altField}><span>OUTPUT FORMAT</span><select disabled defaultValue="MP3"><option>MP3</option><option>WAV</option><option>OGG</option></select></label>
      <button disabled type="button" className={styles.altGenerateButton}>CLEAN AUDIO <Sparkles size={16} /></button>
    </aside>
  </div>;
}

export function AudioGenerationPage() {
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>("Text to Speech");
  const [prompt, setPrompt] = useState(DEFAULT_AUDIO_PROMPT);
  const [tone, setTone] = useState("Energetic");
  const [language, setLanguage] = useState("English (US)");
  const [pronunciation, setPronunciation] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [availableModels, setAvailableModels] = useState<AudioModel[]>([]);
  const [modelLoadState, setModelLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [selectedVoice, setSelectedVoice] = useState("");
  const [availableVoices, setAvailableVoices] = useState<AudioVoice[]>([]);
  const [voiceLoadState, setVoiceLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [canScrollVoicesLeft, setCanScrollVoicesLeft] = useState(false);
  const [canScrollVoicesRight, setCanScrollVoicesRight] = useState(false);
  const [format, setFormat] = useState("MP3");
  const [speed, setSpeed] = useState(0.95);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioHistory, setAudioHistory] = useState<AudioHistoryItem[]>([]);
  const [historyLoadingId, setHistoryLoadingId] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(78);
  const [backgroundMusic, setBackgroundMusic] = useState(false);
  const [backgroundMusicPreset, setBackgroundMusicPreset] = useState("");
  const [backgroundMusicPresets, setBackgroundMusicPresets] = useState<AudioBackgroundMusic[]>([]);
  const [backgroundMusicLoadState, setBackgroundMusicLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [creditEstimate, setCreditEstimate] = useState<AudioCreditQuote | null>(null);
  const [creditEstimateLoading, setCreditEstimateLoading] = useState(false);
  const [creditEstimateError, setCreditEstimateError] = useState<string | null>(null);
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [audioScenes, setAudioScenes] = useState<AudioScene[]>(defaultAudioScenes);
  const [selectedSceneId, setSelectedSceneId] = useState(defaultAudioScenes[0]!.id);
  const [sceneGenerationStatus, setSceneGenerationStatus] = useState<"idle" | "generating" | "complete" | "error">("idle");
  const [sceneError, setSceneError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "generating" | "complete" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedScene, setSelectedScene] = useState("01");
  const audioRef = useRef<HTMLAudioElement>(null);
  const voicePreviewAudioRef = useRef<HTMLAudioElement>(null);
  const durationRef = useRef(0);
  const playbackFrameRef = useRef<number | null>(null);
  const voiceRowRef = useRef<HTMLDivElement>(null);
  const voiceScrollTargetRef = useRef(0);
  const audioHistoryRef = useRef<AudioHistoryItem[]>([]);
  const historySequenceRef = useRef(0);
  const [previewingVoiceKey, setPreviewingVoiceKey] = useState<string | null>(null);

  useEffect(() => {
    return () => { audioHistoryRef.current.filter((item) => item.localUrl).forEach((item) => URL.revokeObjectURL(item.url)); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void listAudioBackgroundMusic().then((items) => {
      if (cancelled) return;
      setBackgroundMusicPresets(items);
      setBackgroundMusicPreset((current) => items.some((preset) => preset.key === current) ? current : items[0]?.key ?? "");
      setBackgroundMusic(false);
      setBackgroundMusicLoadState("ready");
    }).catch(() => {
      if (cancelled) return;
      setBackgroundMusicPresets([]);
      setBackgroundMusicPreset("");
      setBackgroundMusic(false);
      setBackgroundMusicLoadState("error");
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void getAudioCreditBalance().then(({ balance }) => {
      if (!cancelled) setCreditBalance(balance);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void listAudioHistory({ limit: AUDIO_HISTORY_LIMIT }).then((items) => {
      if (cancelled) return;
      const history = items.map((item) => ({ ...item, url: item.url ?? item.audioUrl ?? item.downloadUrl ?? "", localUrl: false, persisted: true }));
      audioHistoryRef.current = history;
      setAudioHistory(history);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  const loadModels = useCallback(async () => {
    setModelLoadState("loading");
    try {
      const items = await listAudioModels("textToSpeech");
      setAvailableModels(items);
      setSelectedModel((current) => items.some((model) => model.key === current) ? current : items.find((model) => model.isActive)?.key ?? items[0]?.key ?? "");
      setModelLoadState("ready");
    } catch {
      setAvailableModels([]);
      setModelLoadState("error");
    }
  }, []);

  const loadVoices = useCallback(async (modelId?: string) => {
    voicePreviewAudioRef.current?.pause();
    setPreviewingVoiceKey(null);
    setVoiceLoadState("loading");
    setVoiceError(null);
    try {
      const items = await listAudioVoices(modelId, "textToSpeech");
      setAvailableVoices(items);
      setSelectedVoice((current) => items.some((voice) => voice.key === current) ? current : items[0]?.key ?? "");
      setVoiceLoadState("ready");
    } catch (error) {
      setAvailableVoices([]);
      setSelectedVoice("");
      setVoiceLoadState("error");
      setVoiceError(error instanceof Error ? error.message : "Unable to load voices");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadModels(), 0);
    return () => window.clearTimeout(timer);
  }, [loadModels]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadVoices(selectedModel || undefined), 0);
    return () => window.clearTimeout(timer);
  }, [loadVoices, selectedModel]);

  useEffect(() => {
    if (!availableVoices.length) return;
    setAudioScenes((current) => current.map((scene, index) => availableVoices.some((voice) => voice.key === scene.voice)
      ? scene
      : { ...scene, voice: availableVoices[index % availableVoices.length]!.key }));
  }, [availableVoices]);

  const updateVoiceScrollButtons = useCallback(() => {
    const row = voiceRowRef.current;
    if (!row) return;
    const maxScrollLeft = Math.max(0, row.scrollWidth - row.clientWidth);
    const currentScrollLeft = Math.min(maxScrollLeft, Math.max(0, row.scrollLeft));
    voiceScrollTargetRef.current = currentScrollLeft;
    setCanScrollVoicesLeft(currentScrollLeft > 1);
    setCanScrollVoicesRight(maxScrollLeft - currentScrollLeft > 1);
  }, []);

  const scrollVoices = (direction: -1 | 1) => {
    const row = voiceRowRef.current;
    if (!row) return;
    const maxScrollLeft = Math.max(0, row.scrollWidth - row.clientWidth);
    const currentTarget = Math.min(maxScrollLeft, Math.max(0, voiceScrollTargetRef.current));
    const nextTarget = Math.min(maxScrollLeft, Math.max(0, currentTarget + direction * Math.max(row.clientWidth, 180)));
    voiceScrollTargetRef.current = nextTarget;
    row.scrollTo({ left: nextTarget, behavior: "smooth" });
    setCanScrollVoicesLeft(nextTarget > 1);
    setCanScrollVoicesRight(maxScrollLeft - nextTarget > 1);
    window.setTimeout(updateVoiceScrollButtons, 450);
  };

  useEffect(() => {
    const row = voiceRowRef.current;
    if (!row) return;
    updateVoiceScrollButtons();
    row.addEventListener("scroll", updateVoiceScrollButtons, { passive: true });
    const resizeObserver = new ResizeObserver(updateVoiceScrollButtons);
    resizeObserver.observe(row);
    return () => {
      row.removeEventListener("scroll", updateVoiceScrollButtons);
      resizeObserver.disconnect();
    };
  }, [availableVoices.length, voiceLoadState, updateVoiceScrollButtons]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed;
  }, [speed, audioUrl]);

  useEffect(() => () => {
    voicePreviewAudioRef.current?.pause();
  }, []);

  const toggleVoicePreview = useCallback((voice: AudioVoice) => {
    const audio = voicePreviewAudioRef.current;
    if (!audio || !voice.previewUrl) return;
    if (previewingVoiceKey === voice.key && !audio.paused) {
      audio.pause();
      audio.currentTime = 0;
      setPreviewingVoiceKey(null);
      return;
    }
    audio.pause();
    audio.src = voice.previewUrl;
    audio.currentTime = 0;
    setPreviewingVoiceKey(voice.key);
    void audio.play().catch(() => setPreviewingVoiceKey(null));
  }, [previewingVoiceKey]);

  const handleVoicePreviewClick = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    const voice = availableVoices.find((item) => item.key === event.currentTarget.dataset.voiceKey);
    if (voice) toggleVoicePreview(voice);
  }, [availableVoices, toggleVoicePreview]);

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

  const voicePages = Array.from({ length: Math.ceil(availableVoices.length / 10) }, (_, pageIndex) => availableVoices.slice(pageIndex * 10, pageIndex * 10 + 10));
  const isSceneMode = activeTab === "Podcast & Dialogue" && audioScenes.length > 0;
  const hasIncompleteScene = audioScenes.some((scene) => !scene.text.trim() || !scene.voice.trim());
  const isGenerating = status === "generating" || sceneGenerationStatus === "generating";
  const generationValidationMessage = isSceneMode
    ? hasIncompleteScene ? "Add text and choose a voice for every scene." : null
    : !prompt.trim() ? "Add a script before generating."
      : voiceLoadState === "ready" && !selectedVoice ? "Select a voice before generating." : null;
  const creditQuoteRequest = selectedModel && (isSceneMode
    ? !hasIncompleteScene
    : Boolean(prompt.trim() && selectedVoice))
    ? isSceneMode
      ? {
        type: "scenes" as const,
        input: {
          scenes: audioScenes.map(({ title, text, voice }) => ({ title, text, voice })),
          modelId: selectedModel,
          outputFormat: format.toLowerCase() as "mp3" | "wav" | "ogg",
          languageCode: language === "Thai" ? "th" : language === "Japanese" ? "ja" : "en",
          tone: tone as "Energetic" | "Friendly" | "Premium" | "Dramatic",
          speed,
          pronunciationHint: pronunciation.trim() || undefined,
          pauseSeconds: 0.25,
          backgroundMusicEnabled: backgroundMusic && Boolean(backgroundMusicPreset),
          backgroundMusicKey: backgroundMusicPreset || undefined,
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
          tone: tone as "Energetic" | "Friendly" | "Premium" | "Dramatic",
          speed,
          pronunciationHint: pronunciation.trim() || undefined,
          backgroundMusicEnabled: backgroundMusic && Boolean(backgroundMusicPreset),
          backgroundMusicKey: backgroundMusicPreset || undefined,
        },
      }
    : null;
  const creditQuoteKey = JSON.stringify(creditQuoteRequest);

  useEffect(() => {
    let active = true;
    const request = creditQuoteKey === "null" ? null : JSON.parse(creditQuoteKey) as NonNullable<typeof creditQuoteRequest>;
    if (!request) {
      setCreditEstimate(null);
      setCreditEstimateError(null);
      setCreditEstimateLoading(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setCreditEstimateLoading(true);
      setCreditEstimateError(null);
      const quotePromise = request.type === "scenes"
        ? quoteTextToSpeechScenes(request.input)
        : quoteTextToSpeech(request.input);
      void quotePromise.then((quote) => {
        if (!active) return;
        setCreditEstimate(quote);
      }).catch((error: unknown) => {
        if (!active) return;
        setCreditEstimate(null);
        setCreditEstimateError(error instanceof Error ? error.message : "Pricing unavailable");
      }).finally(() => {
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
      title: `Scene ${nextNumber}`,
      durationSeconds: 6,
      text: audioScenes.length === 0 ? prompt : "",
      voice: selectedVoice || availableVoices[0]?.key || "",
    };
    setAudioScenes((current) => [...current, nextScene]);
    setSelectedSceneId(nextScene.id);
    setSceneGenerationStatus("idle");
    setSceneError(null);
  };

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

  const persistGeneratedAudio = async (input: SaveAudioHistoryInput): Promise<void> => {
    try {
      const saved = await saveAudioHistory(input);
      appendHistory({ ...saved, url: saved.url ?? saved.audioUrl ?? saved.downloadUrl ?? "", localUrl: false, persisted: true });
    } catch {
      // Generation preview remains available when persistent history storage is unavailable.
    }
  };

  const setGeneratedAudioResult = (result: TextToSpeechResponse, label: string, voice: string, metadata: Record<string, unknown> = {}) => {
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
    try {
      const result = await createTextToSpeech({
        text: prompt,
        voice: selectedVoice,
        modelId: selectedModel,
        outputFormat: format.toLowerCase() as "mp3" | "wav" | "ogg",
        languageCode: language === "Thai" ? "th" : language === "Japanese" ? "ja" : "en",
        tone: tone as "Energetic" | "Friendly" | "Premium" | "Dramatic",
        speed,
        pronunciationHint: pronunciation.trim() || undefined,
        backgroundMusicEnabled: backgroundMusic && Boolean(backgroundMusicPreset),
        backgroundMusicKey: backgroundMusicPreset || undefined,
        idempotencyKey: createAudioIdempotencyKey(),
      });
      setGeneratedAudioResult(result, `Generation ${historySequenceRef.current + 1}`, selectedVoice);
      setStatus("complete");
      void getAudioCreditBalance().then(({ balance }) => setCreditBalance(balance)).catch(() => undefined);
    } catch (error) {
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
    try {
      const result = await createTextToSpeechScenes({
        scenes: scenesToGenerate.map(({ title, text, voice }) => ({ title, text, voice })),
        modelId: selectedModel,
        outputFormat: format.toLowerCase() as "mp3" | "wav" | "ogg",
        languageCode: language === "Thai" ? "th" : language === "Japanese" ? "ja" : "en",
        tone: tone as "Energetic" | "Friendly" | "Premium" | "Dramatic",
        speed,
        pronunciationHint: pronunciation.trim() || undefined,
        pauseSeconds: 0.25,
        backgroundMusicEnabled: backgroundMusic && Boolean(backgroundMusicPreset),
        backgroundMusicKey: backgroundMusicPreset || undefined,
        idempotencyKey: createAudioIdempotencyKey(),
      });
      setGeneratedAudioResult(result, `Scenes · ${scenesToGenerate.length} scenes`, scenesToGenerate[0]!.voice, { sceneCount: scenesToGenerate.length });
      setSceneGenerationStatus("complete");
      setStatus("complete");
      void getAudioCreditBalance().then(({ balance }) => setCreditBalance(balance)).catch(() => undefined);
    } catch (error) {
      setSceneGenerationStatus("error");
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Scene generation failed");
      setSceneError(error instanceof Error ? error.message : "Scene generation failed");
    }
  };

  const playHistoryUrl = (nextUrl: string) => {
    setAudioUrl(nextUrl);
    const audio = audioRef.current;
    if (!audio) {
      setHistoryLoadingId(null);
      return;
    }
    audio.src = nextUrl;
    audio.load();
    void audio.play().then(() => {
      setIsPlaying(true);
      setHistoryLoadingId(null);
    }).catch(() => {
      setIsPlaying(false);
      setHistoryLoadingId(null);
    });
  };

  const selectHistoryItem = (item: AudioHistoryItem) => {
    if (!item.id) return;
    const audio = audioRef.current;
    const isCurrentItem = Boolean(item.url && item.url === audioUrl);
    if (isCurrentItem && audio) {
      setHistoryLoadingId(null);
      if (audio.paused) {
        if (audio.ended || (durationRef.current > 0 && audio.currentTime >= durationRef.current)) audio.currentTime = 0;
        void audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
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
    if (item.url) {
      playHistoryUrl(item.url);
      return;
    }
    void fetchAudioHistoryAudio(item.id).then((result) => {
      const nextUrl = URL.createObjectURL(result.blob);
      const nextHistory = audioHistoryRef.current.map((historyItem) => historyItem.id === item.id ? { ...historyItem, url: nextUrl, localUrl: true } : historyItem);
      audioHistoryRef.current = nextHistory;
      setAudioHistory(nextHistory);
      playHistoryUrl(nextUrl);
    }).catch((error) => {
      setHistoryLoadingId(null);
      setErrorMessage(error instanceof Error ? error.message : "Unable to load saved audio");
    });
  };

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
    void deleteAudioHistory(item.id).then(removeFromView).catch((error) => {
      setErrorMessage(error instanceof Error ? error.message : "Unable to delete saved audio");
    });
  };

  const togglePlayback = () => {
    const audio = audioRef.current;
    if (!audioUrl || !audio) return;
    if (audio.paused) void audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    else { audio.pause(); setIsPlaying(false); }
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

  const scenesTimeline = <section className={styles.podcastScenesBlock} aria-label="Audio scenes and timeline">
    <div className={styles.sectionHeading}><div className={styles.sceneHeadingCopy}><h2>AUDIO SCENES / TIMELINE</h2><small>Organize the episode into editable scenes.</small></div><span className={styles.timelineHint}>{audioScenes.length} scene{audioScenes.length === 1 ? "" : "s"} · {formatSceneSeconds(audioScenes.reduce((total, scene) => total + scene.durationSeconds, 0))} total</span></div>
    <div className={styles.sceneRow}>{audioScenes.map((scene, index) => <button type="button" key={scene.id} className={selectedSceneId === scene.id ? styles.sceneCardActive : styles.sceneCard} onClick={() => setSelectedSceneId(scene.id)} aria-pressed={selectedSceneId === scene.id}>
      <Image src={availableVoices.find((voice) => voice.key === scene.voice)?.imageUrl || voiceImages[index % voiceImages.length]} alt="" width={42} height={50} unoptimized /><span className={styles.sceneCopy}><strong><em>{scene.id}</em> {scene.title}</strong><small>{sceneTimeRange(audioScenes, index)}</small></span><span className={styles.miniWave} aria-hidden="true" />
    </button>)}<button type="button" className={styles.addScene} onClick={addAudioScene} disabled={audioScenes.length >= 20}><Plus size={17} />Add Scene</button></div>
  </section>;

  return <div className={`${styles.audioPage} audio-studio-page`}>
    <section className={styles.heroBanner} aria-label="Gen Audio hero">
      <Image src="/generated-assets/audio-ui/gen-audio-hero-clean.png" alt="Gen Audio — AI audio generation studio" fill priority unoptimized sizes="(min-width: 1024px) 100vw, 100vw" />
    </section>

    <nav className={styles.featureTabs} aria-label="Audio tools">
      {tabs.map((label) => <button key={label} type="button" className={activeTab === label ? styles.tabActive : styles.tab} onClick={() => setActiveTab(label)} aria-pressed={activeTab === label}>
        {label}
      </button>)}
    </nav>

    {activeTab === "Text to Speech" ? <div className={styles.audioGrid}>
      <section className={styles.scriptPanel} aria-label="Audio script and prompt">
        <div className={styles.panelHeading}><h2><span>1</span> SCRIPT / PROMPT</h2><Info size={14} /></div>
        <div className={styles.promptBox}>
          <textarea aria-label="Script or prompt" value={prompt} onChange={(event) => { const value = event.target.value; setPrompt(value); setAudioScenes((current) => current.map((scene) => scene.id === "01" ? { ...scene, text: value } : scene)); }} maxLength={2000} />
          <div className={styles.promptMeta}><span>{prompt.length} / 2000</span><button type="button" onClick={() => { setPrompt(""); setAudioScenes((current) => current.map((scene) => scene.id === "01" ? { ...scene, text: "" } : scene)); }}>Clear <Trash2 size={13} /></button></div>
        </div>

        <div className={styles.inputSection}>
          <FieldLabel hint="Choose or describe">TONE</FieldLabel>
          <div className={styles.chipRow}>{tones.map(({ label, icon: ToneIcon }) => <button type="button" key={label} className={tone === label ? styles.toneActive : styles.toneButton} onClick={() => setTone(label)}><ToneIcon size={12} />{label}</button>)}</div>
        </div>

        <div className={styles.twoColumnFields}>
          <SelectField label="LANGUAGE" value={language} onChange={setLanguage}>
            <option>English (US)</option><option>English (UK)</option><option>Thai</option><option>Japanese</option>
          </SelectField>
          <label className={styles.selectField}><FieldLabel>PRONUNCIATION HINTS</FieldLabel><input value={pronunciation} onChange={(event) => setPronunciation(event.target.value)} placeholder={'e.g. EOS as “อี-โอ-เอส”'} /></label>
        </div>

      </section>

      <section className={styles.centerColumn} aria-label="Audio preview and scenes">
        <div className={`${styles.sectionBlock} ${styles.voiceSection}`}>
          <div className={styles.sectionHeading}><h2>VOICE / SPEAKER</h2><button type="button" className={styles.linkAction}><Settings2 size={14} /> Manage voices</button></div>
          <div className={styles.voiceCarousel}>
            <button type="button" className={`${styles.voiceCarouselButton} ${styles.voiceCarouselButtonLeft}`} onClick={() => scrollVoices(-1)} disabled={!canScrollVoicesLeft} aria-label="เลื่อน Voice ไปทางซ้าย" aria-controls="audio-voice-carousel"><ChevronLeft size={16} /></button>
            <div ref={voiceRowRef} id="audio-voice-carousel" className={styles.voiceRow}>
            {voiceLoadState === "loading" ? <div className={styles.voiceState} role="status">Loading voices...</div> : null}
            {voiceLoadState === "error" ? <div className={styles.voiceStateError} role="alert"><span>{voiceError ?? "Unable to load voices"}</span><button type="button" className={styles.voiceRetry} onClick={() => void loadVoices(selectedModel || undefined)}>Try again</button></div> : null}
            {voiceLoadState === "ready" && availableVoices.length === 0 ? <div className={styles.voiceState}>No voices available.</div> : null}
            {voiceLoadState === "ready" ? voicePages.map((page, pageIndex) => <div className={styles.voicePage} key={`voice-page-${pageIndex}`}>
              {page.map((voice, index) => <div className={styles.voiceCardWrap} key={voice.key}>
                <button type="button" className={selectedVoice === voice.key ? styles.voiceCardActive : styles.voiceCard} onClick={() => setSelectedVoice(voice.key)} aria-pressed={selectedVoice === voice.key}>
                  <div className={styles.voiceImage}><Image src={voice.imageUrl || voiceImages[(pageIndex * 10 + index) % voiceImages.length]} alt="" fill unoptimized sizes="60px" /></div><strong>{voice.name}</strong><small>{voice.description || "Voice"}</small>{selectedVoice === voice.key ? <Check size={14} className={styles.voiceCheck} /> : null}
                </button>
                {voice.previewUrl ? <button type="button" data-voice-key={voice.key} className={`${styles.voicePreviewButton} ${previewingVoiceKey === voice.key ? styles.voicePreviewButtonActive : ""}`} onClick={handleVoicePreviewClick} aria-label={previewingVoiceKey === voice.key ? `หยุดตัวอย่างเสียง ${voice.name}` : `ฟังตัวอย่างเสียง ${voice.name}`} title="ฟังตัวอย่างเสียง">
                  {previewingVoiceKey === voice.key ? <span className={styles.voicePauseGlyph} /> : <Play size={11} fill="currentColor" />}
                </button> : null}
              </div>)}
            </div>) : null}
            </div>
            <button type="button" className={`${styles.voiceCarouselButton} ${styles.voiceCarouselButtonRight}`} onClick={() => scrollVoices(1)} disabled={!canScrollVoicesRight} aria-label="เลื่อน Voice ไปทางขวา" aria-controls="audio-voice-carousel"><ChevronRight size={16} /></button>
          </div>
        </div>

        <div className={styles.previewPanel}>
           <div className={styles.previewHeader}><h2>AUDIO PREVIEW</h2><div className={styles.previewActions}><button type="button" className={styles.outlineAction} onClick={downloadAudio} disabled={!audioUrl}><Download size={15} /> Download</button><button type="button" className={styles.iconAction} aria-label="More preview actions"><MoreHorizontal size={17} /></button></div></div>
           <PreviewWaveform audioUrl={audioUrl} progress={progress} isPlaying={isPlaying} />
           <div className={styles.playerRow}>
             <button type="button" className={styles.playButton} onClick={togglePlayback} aria-label={isPlaying ? "Pause audio" : "Play audio"} disabled={!audioUrl}>{isPlaying ? <span className={styles.pauseGlyph} /> : <Play size={20} fill="currentColor" />}</button>
             <button type="button" className={styles.skipButton} onClick={() => seekBy(-10)} aria-label="Rewind 10 seconds" disabled={!audioUrl}><RotateCcw size={17} /><small>10</small></button>
             <button type="button" className={styles.skipButton} onClick={() => seekBy(10)} aria-label="Forward 10 seconds" disabled={!audioUrl}><RotateCw size={17} /><small>10</small></button>
             <span className={styles.timeLabel}>{formatTime(currentTime)} / {formatTime(duration)}</span>
             <input className={styles.scrubber} type="range" min="0" max="100" value={progress} onChange={(event) => { const nextProgress = Number(event.target.value); const audioDuration = durationRef.current || duration; setProgress(nextProgress); if (audioRef.current && audioDuration) audioRef.current.currentTime = (nextProgress / 100) * audioDuration; }} aria-label="Audio progress" disabled={!audioUrl} />
             <Volume2 size={17} className={styles.volumeIcon} />
             <input className={styles.volumeSlider} type="range" min="0" max="100" value={volume} onChange={(event) => { const nextVolume = Number(event.target.value); setVolume(nextVolume); if (audioRef.current) audioRef.current.volume = nextVolume / 100; }} aria-label="Volume" />
             <button type="button" className={styles.iconAction} aria-label="Fullscreen audio preview"><Maximize2 size={16} /></button>
           </div>
           <audio ref={audioRef} src={audioUrl ?? undefined} preload="metadata" onLoadedMetadata={(event) => { syncAudioDuration(event.currentTarget); event.currentTarget.volume = volume / 100; event.currentTarget.playbackRate = speed; }} onDurationChange={(event) => syncAudioDuration(event.currentTarget)} onTimeUpdate={(event) => { const nextTime = event.currentTarget.currentTime; const nextDuration = durationRef.current || (Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0); if (nextDuration > 0 && durationRef.current !== nextDuration) { durationRef.current = nextDuration; setDuration(nextDuration); } setCurrentTime(nextTime); setProgress(nextDuration ? Math.min(100, (nextTime / nextDuration) * 100) : 0); }} onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} onEnded={(event) => { const endDuration = durationRef.current || event.currentTarget.duration; setIsPlaying(false); if (Number.isFinite(endDuration) && endDuration > 0) { durationRef.current = endDuration; setDuration(endDuration); setCurrentTime(endDuration); } setProgress(100); }} />
           <audio ref={voicePreviewAudioRef} preload="none" onEnded={() => setPreviewingVoiceKey(null)} onError={() => setPreviewingVoiceKey(null)} aria-hidden="true" />
           {errorMessage ? <p className={styles.securityNote} role="alert">{errorMessage}</p> : null}
        </div>

        <section className={styles.historyPanel} aria-label="Generation history">
          <div className={styles.sectionHeading}><h2><History size={13} /> GENERATION HISTORY</h2><span className={styles.timelineHint}>{audioHistory.length ? `${audioHistory.length} result${audioHistory.length === 1 ? "" : "s"}` : "No results yet"}</span></div>
          {audioHistory.length ? <div className={styles.historyList}>{audioHistory.map((item) => <div key={item.id} className={item.url === audioUrl ? styles.historyItemRowActive : styles.historyItemRow}>
            <button type="button" className={item.url === audioUrl ? styles.historyItemActive : styles.historyItem} onClick={() => selectHistoryItem(item)} disabled={historyLoadingId === item.id} aria-busy={historyLoadingId === item.id}><span className={historyLoadingId === item.id ? styles.historyLoading : styles.historyPlay}>{historyLoadingId === item.id ? null : isPlaying && item.url === audioUrl ? <Pause size={13} fill="currentColor" /> : <Play size={13} fill="currentColor" />}</span><span className={styles.historyCopy}><strong>{item.label}</strong><small>{item.createdAt}</small></span><span className={styles.historyCurrent}>{item.url === audioUrl ? "CURRENT" : "PLAY"}</span></button>
            <button type="button" className={styles.historyDelete} aria-label={`Delete ${item.label}`} onClick={() => removeHistoryItem(item)}><Trash2 size={13} /></button>
          </div>)}</div> : <div className={styles.historyEmpty}><History size={15} /><span>Generate audio to save and replay results here.</span></div>}
        </section>

      </section>

      <div className={styles.tutorialRow} aria-label="Audio tutorials">{tutorials.map((src) => <button type="button" key={src} className={styles.tutorialCard}><Image src={src} alt="Audio guide" fill unoptimized sizes="240px" /></button>)}</div>
      <div className={styles.shortcutRow}>{[
        [Mic2, "Voiceover", "Create voiceovers"], [AudioLines, "Dialogue Builder", "Multi-speaker convos"], [AudioWaveform, "Sound FX", "Generate sounds"], [Sparkles, "Audio Cleanup", "Remove noise"], [FileAudio, "Transcript Export", "Export as text"], [Gauge, "Subtitle / Captions", "Auto-generate"],
      ].map(([Icon, title, caption]) => { const ToolIcon = Icon as typeof Mic2; return <button type="button" key={title as string} className={styles.shortcutCard}><ToolIcon size={19} /><span><strong>{title as string}</strong><small>{caption as string}</small></span></button>; })}</div>

      <aside className={styles.settingsPanel} aria-label="Audio settings">
        <div className={styles.settingsTitle}><h2>SETTINGS</h2><WandSparkles size={22} /></div>
        <div className={styles.settingBlock}><SelectField label="VOICE MODEL" value={selectedModel} onChange={(modelId) => { setSelectedModel(modelId); setSelectedVoice(""); }} disabled={modelLoadState !== "ready" || availableModels.length === 0}>{modelLoadState === "loading" ? <option value="">Loading models...</option> : availableModels.length ? availableModels.map((model) => <option key={model.key} value={model.key}>{model.name}</option>) : <option value="">No models configured</option>}</SelectField></div>
        <div className={styles.settingBlock}><FieldLabel>OUTPUT FORMAT</FieldLabel><div className={styles.formatRow}>{["MP3", "WAV", "OGG"].map((item) => <button type="button" key={item} className={format === item ? styles.formatActive : styles.formatButton} onClick={() => setFormat(item)}>{item}</button>)}</div></div>
        <div className={styles.settingBlock}><div className={styles.speedHeader}><FieldLabel>SPEECH SPEED</FieldLabel><strong>{speed.toFixed(2)}x</strong></div><input className={styles.speedSlider} type="range" min="0.5" max="2" step="0.05" value={speed} onChange={(event) => setSpeed(Number(event.target.value))} /><div className={styles.rangeLabels}><span>0.5x</span><span>1x</span><span>2x</span></div></div>
        <div className={styles.settingBlock}><div className={styles.musicHeader}><FieldLabel>AUTO BACKGROUND MUSIC</FieldLabel><button type="button" className={backgroundMusic ? styles.toggleOn : styles.toggleOff} onClick={() => setBackgroundMusic((current) => !current)} aria-pressed={backgroundMusic} disabled={backgroundMusicLoadState !== "ready" || backgroundMusicPresets.length === 0}><span /></button></div>{backgroundMusic ? <SelectField label="" value={backgroundMusicPreset} onChange={setBackgroundMusicPreset} disabled={backgroundMusicLoadState !== "ready" || backgroundMusicPresets.length === 0}>{backgroundMusicLoadState === "loading" ? <option value="">Loading music...</option> : backgroundMusicPresets.length ? backgroundMusicPresets.map((preset) => <option key={preset.key} value={preset.key}>{preset.name}</option>) : <option value="">No music configured</option>}</SelectField> : null}</div>
        <div className={styles.creditEstimate} title={creditEstimateError ?? undefined}><div className={styles.creditEstimateHeader}><strong>ESTIMATED CREDITS <Info size={11} aria-hidden="true" /></strong><b>{creditEstimateLoading ? "Calculating…" : creditEstimate ? `= ${formatCreditAmount(creditEstimate.creditCost)} Credits` : "—"}</b></div><p className={styles.creditEstimateCount}>{isSceneMode ? `${audioScenes.length} scene${audioScenes.length === 1 ? "" : "s"}` : "1 audio"}</p></div>
          {generationValidationMessage ? <p className={styles.generationValidation} role="status">{generationValidationMessage}</p> : null}
          <button type="button" className={styles.generateButton} onClick={() => void (isSceneMode ? handleGenerateScenes() : handleGenerate())} disabled={isGenerating || !selectedModel || voiceLoadState !== "ready" || (isSceneMode ? hasIncompleteScene : !prompt.trim() || !selectedVoice)}>{isGenerating ? <><span className={styles.spinner} /> GENERATING...</> : <>GENERATE AUDIO <Sparkles size={17} /></>}</button>
        <p className={styles.securityNote}><LockKeyhole size={11} /> Your generation is private and secure</p>
      </aside>
  </div> : activeTab === "Podcast & Dialogue" ? <PodcastDialogueLayout onHistorySaved={persistGeneratedAudio} scenesTimeline={scenesTimeline} /> : activeTab === "Voice Clone" ? <VoiceCloneLayout onHistorySaved={persistGeneratedAudio} /> : activeTab === "Sound Effects" ? <SoundEffectsLayout onHistorySaved={persistGeneratedAudio} /> : <AudioCleanupLayout />}
  </div>;
}
