"use client";
import { useTemplateSettings } from "@/features/templates/use-template-settings";
import { useTemplatePrompt } from "@/features/templates/use-template-prompt";
import { promptMaxLength } from "@/lib/prompt-limits";

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
  History,
  FileAudio,
  LockKeyhole,
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
import { MobileModeDropdown } from "@/features/create/components/mobile-mode-dropdown";
import { InfoTooltip } from "@/features/create/components/info-tooltip";
import { ClearValuesButton } from "@/features/create/components/clear-values-button";
import { CreatorWorkspaceLayout } from "@/components/create/creator-workspace-layout";
import { ImageTutorialButton } from "@/features/create/image-generation/components/image-tutorial-button";
import { useLocale } from "@/lib/i18n/locale-provider";
import { Dropdown, type DropdownOption } from "@/components/ui/dropdown";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createDialogue, createSoundEffects, createTextToSpeech, createTextToSpeechScenes, createVoiceClone, deleteAudioHistory, fetchAudioHistoryAudio, listAudioBackgroundMusic, listAudioHistory, listAudioModels, listAudioVoices, previewVoiceClone, quoteTextToSpeech, quoteTextToSpeechScenes, saveAudioHistory, type AudioBackgroundMusic, type AudioCreditQuote, type AudioHistoryEntry, type AudioModel, type AudioVoice, type SaveAudioHistoryInput, type SoundEffectVariant, type TextToSpeechResponse } from "@/lib/api/audio";

const audioModes = ["Text to Speech", "Podcast & Dialogue", "Voice Clone", "Sound Effects", "Audio Cleanup"] as const;
type AudioTab = typeof audioModes[number];

// Keep only the main audio workflow visible while the advanced audio tools are being finalized.
const visibleTabs: readonly AudioTab[] = ["Text to Speech"];

const audioTabKeys = {
  "Text to Speech": "create.audio.tabs.textToSpeech",
  "Podcast & Dialogue": "create.audio.tabs.podcastDialogue",
  "Voice Clone": "create.audio.tabs.voiceClone",
  "Sound Effects": "create.audio.tabs.soundEffects",
  "Audio Cleanup": "create.audio.tabs.audioCleanup",
} as const;
const audioModeIcons = {
  "Text to Speech": AudioLines,
  "Podcast & Dialogue": AudioWaveform,
  "Voice Clone": Mic2,
  "Sound Effects": Waves,
  "Audio Cleanup": WandSparkles,
} as const;

const tones = [
  { label: "Energetic", icon: Zap },
  { label: "Friendly", icon: Smile },
  { label: "Premium", icon: Star },
  { label: "Dramatic", icon: Clapperboard },
] as const;

const toneKeys = {
  Energetic: "create.audio.tones.energetic",
  Friendly: "create.audio.tones.friendly",
  Premium: "create.audio.tones.premium",
  Dramatic: "create.audio.tones.dramatic",
} as const;

const voiceImages = [
  "/generated-assets/audio-ui/audio-voice-female-warm.png",
  "/generated-assets/audio-ui/audio-voice-male-bold.png",
  "/generated-assets/audio-ui/audio-voice-youthful.png",
  "/generated-assets/audio-ui/audio-voice-corporate.png",
  "/generated-assets/audio-ui/audio-voice-podcast-host.png",
] as const;

const waveformBars = Array.from({ length: 88 }, (_, index) => Math.round(24 + Math.abs(Math.sin(index * 0.37)) * 48 + Math.abs(Math.sin(index * 0.91)) * 20));

type AudioHistoryItem = Omit<AudioHistoryEntry, "url"> & { url: string; localUrl?: boolean; persisted?: boolean };
const AUDIO_HISTORY_LIMIT = 10;
const VOICE_PAGE_SIZE = 6;
type SaveHistoryCallback = (input: SaveAudioHistoryInput) => Promise<void>;
type AudioScene = { id: string; title: string; durationSeconds: number; text: string; voice: string };
type PodcastSpeaker = { id: string; role: string; name: string; voice: string; image: string };
type PodcastLine = { id: string; speakerId: string; text: string; durationSeconds: number };

const DEFAULT_AUDIO_PROMPT = "ขอแนะนำ EOS Creative Studio — แพลตฟอร์มครบวงจรสำหรับสร้างสรรค์ สื่อสาร และสร้างความประทับใจ ตั้งแต่ภาพที่โดดเด่นไปจนถึงเสียงที่ทรงพลัง เราช่วยให้ไอเดียของคุณส่งถึงใจและเชื่อมต่อได้ลึกกว่าเดิม";
const defaultAudioScenes: AudioScene[] = [
  { id: "01", title: "ฉากที่ 1", durationSeconds: 12, text: DEFAULT_AUDIO_PROMPT, voice: "" },
];
const podcastSpeakerTones = ["orange", "blue", "green", "purple", "pink"] as const;
const defaultPodcastSpeakers: PodcastSpeaker[] = [
  { id: "host", role: "พิธีกร", name: "ณัฐพงษ์", voice: "เสียงหญิงนุ่ม", image: voiceImages[0] },
  { id: "guest-1", role: "แขกรับเชิญ 1", name: "สุพิชฌาย์", voice: "เสียงหญิงสดใส", image: voiceImages[2] },
  { id: "guest-2", role: "แขกรับเชิญ 2", name: "ธนกฤต", voice: "เสียงชายหนักแน่น", image: voiceImages[1] },
  { id: "co-host", role: "ผู้ร่วมดำเนินรายการ", name: "พิมพ์ชนก", voice: "เสียงพิธีกรพอดแคสต์", image: voiceImages[4] },
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

function SelectField({ label, options, value, onChange, disabled = false, loading = false }: { label: string; options: readonly DropdownOption[]; value: string; onChange: (value: string) => void; disabled?: boolean; loading?: boolean }) {
  return <label className={styles.selectField}>
    <FieldLabel>{label}</FieldLabel>
    <Dropdown value={value} options={options} onChange={onChange} disabled={disabled} loading={loading} ariaLabel={label} triggerClassName="h-[38px] min-h-0 rounded-lg border-[#dfe2e7] px-[11px] text-[11px] font-normal" />
  </label>;
}

function PreviewWaveform({ audioUrl, progress, isPlaying }: { audioUrl: string | null; progress: number; isPlaying: boolean }) {
  const { t } = useLocale();
  const safeProgress = Math.min(100, Math.max(0, progress));
  return <div className={`${styles.waveform} ${isPlaying ? styles.waveformPlaying : ""}`} aria-label={t("create.audio.a11y.waveform")}>
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
  const { t } = useLocale();
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
    const nextSpeaker: PodcastSpeaker = { id: `speaker-${nextNumber}`, role: t("create.audio.podcast.roleGuest", { index: nextNumber - 1 }), name: t("create.audio.podcast.newSpeaker", { index: nextNumber }), voice: nextNumber % 2 === 0 ? t("create.audio.podcast.voiceMaleBold") : t("create.audio.podcast.voiceFemaleWarm"), image: voiceImages[(nextNumber - 1) % voiceImages.length] };
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
        <div className={styles.podcastTitleGroup}><div className={styles.podcastTitleIcon}><Sparkles size={21} /></div><div><span className={styles.podcastEyebrow}>{t("create.audio.podcast.eyebrow")}</span><h1>{t("create.audio.podcast.title")}</h1><p>{t("create.audio.podcast.subtitle")}</p></div></div>
        <div className={styles.podcastHeaderActions}><button type="button" className={styles.podcastEpisodeButton}>Ep.01 เปิดโลก AI สำหรับครีเอเตอร์ <Pencil size={12} /></button><button type="button" className={styles.podcastToolbarButton}><CloudUpload size={15} /> {t("create.audio.podcast.importScript")}</button><button type="button" className={styles.podcastToolbarButton}><Sparkles size={15} /> {t("create.audio.podcast.aiAssist")}</button><button type="button" className={styles.podcastToolbarButton}><Bookmark size={15} /> {t("create.audio.podcast.saveDraft")}</button></div>
      </section>

      <section className={styles.podcastSection} aria-label={t("create.audio.podcast.a11y.speakers")}>
        <div className={styles.podcastSectionHeader}><h2>{t("create.audio.podcast.speakers")}</h2><span>{t("create.audio.podcast.peopleCount", { count: speakers.length })}</span></div>
        <div className={styles.podcastSpeakerRow}>{speakers.map((speaker, index) => <button type="button" key={speaker.id} className={`${styles.podcastSpeakerCard} ${activeSpeakerId === speaker.id ? styles.podcastSpeakerCardActive : ""}`} onClick={() => setActiveSpeakerId(speaker.id)} aria-pressed={activeSpeakerId === speaker.id}><span className={styles.podcastSpeakerAvatar}><Image src={speaker.image} alt="" fill unoptimized sizes="54px" /></span><span className={styles.podcastSpeakerCopy}><small>{speaker.role}</small><strong>{speaker.name}</strong><em>{speaker.voice}</em></span><i data-tone={podcastSpeakerTones[index % podcastSpeakerTones.length]} /></button>)}<button type="button" className={styles.podcastAddSpeakerCard} onClick={addSpeaker}><Plus size={18} /><span>{t("create.audio.podcast.addSpeaker")}</span></button></div>
      </section>

      <section className={styles.podcastSection} aria-label={t("create.audio.podcast.a11y.dialogue")}>
        <div className={styles.podcastSectionHeader}><h2>{t("create.audio.podcast.dialogue")}</h2><span>{t("create.audio.podcast.lineCount", { count: lines.length })} · {formatSceneSeconds(totalDuration)}</span></div>
        <div className={styles.podcastLineList}>{lines.map((line, index) => { const speaker = speakers.find((item) => item.id === line.speakerId) ?? speakers[0]!; const start = lines.slice(0, index).reduce((total, item) => total + item.durationSeconds, 0); return <div className={`${styles.podcastLineRow} ${index === 0 ? styles.podcastLineRowActive : ""}`} key={line.id}>
          <span className={styles.podcastLineAvatar}><Image src={speaker.image} alt="" fill unoptimized sizes="34px" /></span>
          <time>{formatSceneSeconds(start)}</time>
          <span className={styles.podcastSpeakerChip} data-tone={podcastSpeakerTones[speakers.findIndex((item) => item.id === speaker.id) % podcastSpeakerTones.length]}>{speaker.role}</span>
          <input className={styles.podcastLineInput} value={line.text} onChange={(event) => updateLine(line.id, { text: event.target.value })} aria-label={t("create.audio.podcast.a11y.line", { index: index + 1 })} />
          <input className={styles.podcastLineDuration} type="number" min="0.5" max="120" step="0.1" value={line.durationSeconds} onChange={(event) => updateLine(line.id, { durationSeconds: Math.max(0.5, Number(event.target.value) || 0.5) })} aria-label={t("create.audio.podcast.a11y.lineDuration", { index: index + 1 })} />
          <button type="button" className={`${styles.podcastLineAction} ${styles.podcastLineCopyAction}`} onClick={() => duplicateLine(line)} aria-label={t("create.audio.podcast.a11y.duplicateLine", { index: index + 1 })}><Copy size={15} /></button>
          <button type="button" className={styles.podcastLineActionDanger} onClick={() => removeLine(line.id)} disabled={lines.length <= 1} aria-label={t("create.audio.podcast.a11y.deleteLine", { index: index + 1 })}><Trash2 size={15} /></button>
        </div>; })}</div>
        <button type="button" className={styles.podcastAddLine} onClick={addLine}><Plus size={15} /> {t("create.audio.podcast.addNextLine")}</button>
      </section>

      <section className={styles.podcastPreviewCard} aria-label={t("create.audio.podcast.a11y.preview")}>
        <div className={styles.podcastSectionHeader}><h2>{t("create.audio.podcast.audioPreview")} <span className={styles.podcastBeta}>Beta</span></h2><div className={styles.podcastPreviewActions}><button type="button" className={styles.podcastToolbarButton} onClick={downloadAudio} disabled={!audioUrl}><Download size={15} /> {t("create.audio.download")}</button></div></div>
        <div className={styles.podcastAudioPlayer}><button type="button" className={styles.podcastPlayButton} onClick={() => void togglePreview()} disabled={status === "generating"}><span>{isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}</span></button><div className={styles.podcastWaveformWrap}><PreviewWaveform audioUrl={audioUrl} progress={previewProgress} isPlaying={isPlaying} /><div className={styles.podcastAudioMeta}><span>{formatSceneSeconds(previewCurrentTime)} / {formatSceneSeconds(previewDuration || totalDuration)}</span><input type="range" min="0" max="100" value={previewProgress} onChange={(event) => { const nextProgress = Number(event.target.value); setPreviewProgress(nextProgress); if (previewAudioRef.current && previewDuration) previewAudioRef.current.currentTime = nextProgress / 100 * previewDuration; }} aria-label={t("create.audio.a11y.audioProgress")} disabled={!audioUrl} /></div></div><Volume2 size={16} className={styles.podcastVolumeIcon} /><input className={styles.podcastVolumeSlider} type="range" min="0" max="100" value={volume} onChange={(event) => { const nextVolume = Number(event.target.value); setVolume(nextVolume); if (previewAudioRef.current) previewAudioRef.current.volume = nextVolume / 100; }} aria-label={t("create.audio.a11y.volume")} /><audio ref={previewAudioRef} src={audioUrl ?? undefined} preload="metadata" onLoadedMetadata={(event) => { setPreviewDuration(event.currentTarget.duration); event.currentTarget.volume = volume / 100; }} onTimeUpdate={(event) => { const current = event.currentTarget.currentTime; const duration = event.currentTarget.duration || previewDuration; setPreviewCurrentTime(current); setPreviewProgress(duration ? current / duration * 100 : 0); }} onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} onEnded={() => { setIsPlaying(false); setPreviewProgress(100); }} /></div>
        {status === "error" || error ? <p className={styles.podcastError} role="alert">{error}</p> : null}
      </section>
      {scenesTimeline}
    </main>

    <aside className={styles.podcastSettingsCard} aria-label={t("create.audio.podcast.a11y.settings")}>
      <div className={styles.podcastSettingsHeader}><h2>{t("create.audio.podcast.settings")}</h2><AudioWaveform size={18} /></div>
      <div className={styles.podcastSettingGroup}><span className={styles.podcastFieldLabel}>{t("create.audio.podcast.outputFormat")}</span><div className={styles.podcastFormatRow}>{(["mp3", "wav", "ogg"] as const).map((format) => <button type="button" key={format} className={outputFormat === format ? styles.podcastFormatActive : styles.podcastFormatButton} onClick={() => setOutputFormat(format)}>{format.toUpperCase()}</button>)}</div></div>
      <label className={styles.podcastSelectField}><span className={styles.podcastFieldLabel}>{t("create.audio.podcast.language")}</span><select value={language} onChange={(event) => setLanguage(event.target.value)}><option>Thai (ไทย)</option><option>English (US)</option><option>English (UK)</option></select><ChevronDown size={14} /></label>
      <label className={styles.podcastSelectField}><span className={styles.podcastFieldLabel}>{t("create.audio.podcast.speakingStyle")}</span><select value={speakingStyle} onChange={(event) => setSpeakingStyle(event.target.value as typeof speakingStyle)}><option value="Interview">{t("create.audio.podcast.styleConversational")}</option><option value="Roundtable">{t("create.audio.podcast.styleRoundtable")}</option><option value="Storytelling">{t("create.audio.podcast.styleStorytelling")}</option></select><ChevronDown size={14} /></label>
      <div className={styles.podcastSettingGroup}><div className={styles.podcastSpeedHeader}><span className={styles.podcastFieldLabel}>{t("create.audio.podcast.pacing")}</span><b>{speed.toFixed(2)}x</b></div><input className={styles.podcastSpeedSlider} type="range" min="0.5" max="2" step="0.05" value={speed} onChange={(event) => setSpeed(Number(event.target.value))} /><div className={styles.podcastSpeedLabels}><span>0.5x</span><span>1x</span><span>1.5x</span><span>2x</span></div></div>
      <div className={styles.podcastToggleGroup}><label><span><strong>{t("create.audio.podcast.backgroundMusic")}</strong><small>เพิ่มเพลงประกอบระหว่างบทพูด</small></span><button type="button" className={backgroundMusic ? styles.podcastToggleOn : styles.podcastToggleOff} onClick={() => setBackgroundMusic((current) => !current)} aria-pressed={backgroundMusic}><i /></button></label><label><span><strong>{t("create.audio.podcast.normalizeAudio")}</strong><small>ปรับระดับเสียงให้สม่ำเสมอ</small></span><button type="button" className={normalizeAudio ? styles.podcastToggleOn : styles.podcastToggleOff} onClick={() => setNormalizeAudio((current) => !current)} aria-pressed={normalizeAudio}><i /></button></label></div>
      <div data-mobile-action-dock className={styles.mobileActionDock}>
        <div className={styles.podcastEstimate}><div><span>{t("create.audio.podcast.estimatedDuration")}</span><strong>{formatSceneSeconds(totalDuration)}</strong></div><div><span>{t("create.audio.podcast.estimatedCredits")}</span><strong>{t("create.audio.podcast.creditsApprox", { count: estimatedCredits })}</strong></div><small>{t("create.audio.podcast.creditsAvailable", { count: estimatedCredits })}</small></div>
        <button type="button" className={styles.podcastGenerateButton} onClick={() => void handleGenerate()} disabled={status === "generating" || !episodeScript.trim()}>{status === "generating" ? t("create.audio.podcast.generating") : t("create.audio.podcast.generate")} <Sparkles size={16} /></button>
        <p className={styles.podcastSecurityNote}><LockKeyhole size={11} /> {t("create.audio.podcast.securityNote")}</p>
      </div>
    </aside>
  </div>;
}

function VoiceCloneLayout({ onHistorySaved }: { onHistorySaved?: SaveHistoryCallback }) {
  const { t } = useLocale();
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
  const [isSampleDragging, setIsSampleDragging] = useState(false);
  const sampleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => { if (audioUrl) URL.revokeObjectURL(audioUrl); }, [audioUrl]);

  const handleSample = (file: File | undefined) => {
    if (!file) return;
    setSampleFile(file);
    setSampleReady(true);
    setVoiceId(null);
    setStatus("idle");
  };
  const handleSampleDrop = (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    setIsSampleDragging(false);
    handleSample(event.dataTransfer.files?.[0]);
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
      <AlternateHeading eyebrow={t("create.audio.clone.eyebrow")} title={t("create.audio.clone.title")} description={t("create.audio.clone.description")} icon={<WandSparkles size={24} />} />
      <input ref={sampleInputRef} hidden type="file" accept="audio/wav,audio/mpeg,audio/ogg,audio/*" onChange={(event) => handleSample(event.target.files?.[0])} />
      <button type="button" className={`${styles.cloneDropzone} ${sampleReady ? styles.cloneDropzoneReady : ""} ${isSampleDragging ? styles.cloneDropzoneDragging : ""}`} onClick={() => sampleInputRef.current?.click()} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; setIsSampleDragging(true); }} onDragLeave={() => setIsSampleDragging(false)} onDrop={handleSampleDrop}><span className={styles.cloneIcon}><CloudUpload size={23} /></span><strong>{sampleReady ? t("create.audio.clone.sampleReady") : t("create.audio.clone.dropSample")}</strong><small>{sampleReady ? t("create.audio.clone.readyToUpload", { name: sampleFile?.name ?? "sample-voice.wav" }) : t("create.audio.clone.sampleHint")}</small><em>{sampleReady ? t("create.audio.clone.clickToReplace") : t("create.audio.clone.browseFiles")}</em></button>
      <label className={styles.altTextField}><span>{t("create.audio.clone.voiceName")}</span><input value={voiceName} onChange={(event) => setVoiceName(event.target.value)} /></label>
      <div className={styles.altFieldGroup}><span className={styles.altFieldLabel}>{t("create.audio.clone.voiceCharacter")}</span><div className={styles.altChoiceRow}>{([["Natural", "create.audio.clone.characterNatural"], ["Cinematic", "create.audio.clone.characterCinematic"], ["Expressive", "create.audio.clone.characterExpressive"]] as const).map(([item, labelKey]) => <button type="button" key={item} className={character === item ? styles.altChoiceActive : styles.altChoice} onClick={() => setCharacter(item)}>{t(labelKey)}</button>)}</div></div>
      <label className={styles.altConsent}><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /> {t("create.audio.clone.consent")}</label>
    </section>

    <section className={`${styles.alternatePanel} ${styles.alternateCenterPanel}`}>
      <div className={styles.altPanelHeader}><div><span className={styles.altEyebrow}>{t("create.audio.clone.voicePreview")}</span><h2>{t("create.audio.clone.playground")}</h2></div><span className={styles.altStatus}><span /> {voiceId ? t("create.audio.clone.voiceReady") : t("create.audio.clone.sampleLoaded")}</span></div>
      <div className={styles.mockNotice}><LockKeyhole size={13} /><span>{status === "creating" ? t("create.audio.clone.creatingNotice") : error ?? (voiceId ? t("create.audio.clone.readyNotice") : t("create.audio.clone.pendingNotice"))}</span></div>
      <div className={styles.clonePreviewCard}><div className={styles.clonePortrait}><Mic2 size={25} /><span>EOS</span></div><div><strong>{voiceName}</strong><small>{character} · English (US)</small><div className={styles.cloneMeta}><span>{t("create.audio.clone.toneWarm")}</span><span>{t("create.audio.clone.toneClear")}</span><span>{t("create.audio.clone.toneStudio")}</span></div></div><button type="button" className={styles.altRoundButton} onClick={() => void handlePreview()} disabled={!voiceId || status === "previewing"}><Play size={17} fill="currentColor" /></button></div>
      <AltWaveform label={t("create.audio.clone.voiceSample")} />
      {audioUrl ? <audio controls src={audioUrl} style={{ width: "100%" }} /> : null}
      <div className={styles.altTimeline}><span>00:00</span><div><i style={{ width: "58%" }} /><b /><b /></div><span>00:34</span></div>
      <label className={styles.altTextField}><span>{t("create.audio.clone.testPhrase")}</span><textarea value={testPhrase} onChange={(event) => setTestPhrase(event.target.value)} maxLength={2000} /></label>
      <div className={styles.altActionRow}><button type="button" className={styles.altPrimaryButton} onClick={() => void handlePreview()} disabled={!voiceId || status === "previewing"}><Play size={15} fill="currentColor" /> {status === "previewing" ? t("create.audio.clone.generatingPreview") : t("create.audio.clone.playTestPhrase")}</button><button type="button" className={styles.altSecondaryButton} onClick={() => void handleCreate()} disabled={status === "creating" || !sampleFile}>{status === "creating" ? t("create.audio.clone.creating") : t("create.audio.clone.saveVoice")}</button></div>
    </section>

    <aside className={styles.alternateSettings}>
      <div className={styles.altPanelHeader}><h2>{t("create.audio.clone.settings")}</h2><Settings2 size={20} /></div>
      <div className={styles.altSettingBlock}><div className={styles.altSettingHeading}><span>{t("create.audio.clone.similarity")}</span><b>88%</b></div><input className={styles.altRange} type="range" min="0" max="100" defaultValue="88" /></div>
      <div className={styles.altSettingBlock}><div className={styles.altSettingHeading}><span>{t("create.audio.clone.expressiveness")}</span><b>64%</b></div><input className={styles.altRange} type="range" min="0" max="100" defaultValue="64" /></div>
      <label className={styles.altField}><span>{t("create.audio.clone.language")}</span><select defaultValue="English (US)"><option>English (US)</option><option>English (UK)</option><option>ไทย</option></select></label>
      <div className={styles.altSettingBlock}><span className={styles.altFieldLabel}>{t("create.audio.clone.outputFormat")}</span><div className={styles.altFormatGrid}><button type="button" className={styles.altFormatActive}>MP3</button><button type="button" className={styles.altFormat}>WAV</button><button type="button" className={styles.altFormat}>OGG</button></div></div>
      <div data-mobile-action-dock className={styles.mobileActionDock}><button type="button" className={styles.altGenerateButton} onClick={() => void handleCreate()} disabled={status === "creating" || !sampleFile}>{status === "creating" ? t("create.audio.clone.creatingButton") : t("create.audio.clone.createVoice")} <Sparkles size={16} /></button></div>
    </aside>
  </div>;
}

function SoundEffectsLayout({ onHistorySaved }: { onHistorySaved?: SaveHistoryCallback }) {
  const { t } = useLocale();
  const [effectType, setEffectType] = useState("Cinematic");
  const [description, setDescription] = useState("A cinematic whoosh that rises quickly, hits with a soft impact, and fades into a deep room tone.");
  const [duration, setDuration] = useState(4);
  const [variationCount, setVariationCount] = useState(4);
  const [variants, setVariants] = useState<SoundEffectVariant[]>([]);
  const [audioUrls, setAudioUrls] = useState<Record<number, string>>({});
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [status, setStatus] = useState<"idle" | "generating" | "ready" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const audioUrlsRef = useRef<Record<number, string>>({});
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => () => {
    previewAudioRef.current?.pause();
    Object.values(audioUrlsRef.current).forEach((url) => URL.revokeObjectURL(url));
  }, []);

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
      previewAudioRef.current?.pause();
      Object.values(audioUrlsRef.current).forEach((url) => URL.revokeObjectURL(url));
      audioUrlsRef.current = nextUrls;
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
      <AlternateHeading eyebrow={t("create.audio.sfx.eyebrow")} title={t("create.audio.sfx.title")} description={t("create.audio.sfx.description")} icon={<AudioLines size={24} />} />
      <label className={styles.altTextField}><span>{t("create.audio.sfx.soundDescription")}</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1000} /></label>
      <div className={styles.altFieldGroup}><span className={styles.altFieldLabel}>{t("create.audio.sfx.effectCategory")}</span><div className={styles.altChoiceRow}>{([["Cinematic", "create.audio.sfx.categoryCinematic"], ["Nature", "create.audio.sfx.categoryNature"], ["UI / Tech", "create.audio.sfx.categoryUi"], ["Impact", "create.audio.sfx.categoryImpact"]] as const).map(([item, labelKey]) => <button type="button" key={item} className={effectType === item ? styles.altChoiceActive : styles.altChoice} onClick={() => setEffectType(item)}>{t(labelKey)}</button>)}</div></div>
      <div className={styles.altTwoFields}><label className={styles.altField}><span>{t("create.audio.sfx.duration")}</span><select value={String(duration)} onChange={(event) => setDuration(Number(event.target.value))}>{[2, 4, 8].map((seconds) => <option key={seconds} value={String(seconds)}>{t("create.audio.sfx.seconds", { count: String(seconds).padStart(2, "0") })}</option>)}</select></label><label className={styles.altField}><span>{t("create.audio.sfx.variations")}</span><select value={String(variationCount)} onChange={(event) => setVariationCount(Number(event.target.value))}>{[2, 4, 6].map((amount) => <option key={amount} value={String(amount)}>{t("create.audio.sfx.variationOptions", { count: amount })}</option>)}</select></label></div>
      <button disabled type="button" className={styles.altUploadButton}><CloudUpload size={17} /> {t("create.audio.sfx.useReference")}</button>
    </section>

    <section className={`${styles.alternatePanel} ${styles.alternateCenterPanel}`}>
      <div className={styles.altPanelHeader}><div><span className={styles.altEyebrow}>{t("create.audio.sfx.variationsLabel", { count: variants.length || variationCount })}</span><h2>{t("create.audio.sfx.soundPreview")}</h2></div><span className={styles.altStatus}><span /> {status === "generating" ? t("create.audio.sfx.generatingStatus") : t("create.audio.sfx.ready")}</span></div>
      <div className={styles.mockNotice}><LockKeyhole size={13} /><span>{status === "generating" ? t("create.audio.sfx.generatingNotice") : error ?? t("create.audio.sfx.pendingNotice")}</span></div>
      <AltWaveform label={t("create.audio.sfx.waveformLabel")} />
       {selectedUrl ? <audio ref={previewAudioRef} controls src={selectedUrl} preload="metadata" style={{ width: "100%" }} /> : null}
       <div className={styles.effectPlayer}><button type="button" className={styles.altRoundButton} onClick={() => { if (!selectedUrl) { void handleGenerate(); return; } const audio = previewAudioRef.current; if (!audio) return; if (audio.paused) void audio.play(); else audio.pause(); }} disabled={status === "generating"}><Play size={18} fill="currentColor" /></button><div><strong>{selectedIndex ? t("create.audio.sfx.effectNumber", { index: selectedIndex }) : t("create.audio.sfx.emptyEffect")}</strong><small>{duration.toString().padStart(2, "0")}s · {effectType} · MP3</small></div><MoreHorizontal size={17} /></div>
       <div className={styles.effectVariationGrid}>{variants.map((variant) => <button type="button" key={variant.index} className={selectedIndex === variant.index ? styles.effectCardActive : styles.effectCard} onClick={() => setSelectedIndex(variant.index)}><span className={styles.effectMiniWave} /><strong>{t("create.audio.sfx.variationNumber", { index: variant.index })}</strong><small>{duration.toString().padStart(2, "0")}s</small><Play size={12} fill="currentColor" /></button>)}</div>
       <div className={styles.altActionRow}><button type="button" className={styles.altPrimaryButton} onClick={downloadSelected} disabled={!selectedUrl}><Download size={15} /> {t("create.audio.sfx.downloadSelected")}</button><button type="button" className={styles.altSecondaryButton} onClick={() => void handleGenerate()} disabled={status === "generating"}>{t("create.audio.sfx.regenerate")}</button></div>
    </section>

    <aside className={styles.alternateSettings}>
      <div className={styles.altPanelHeader}><h2>{t("create.audio.sfx.settings")}</h2><Settings2 size={20} /></div>
      <div className={styles.altSettingBlock}><div className={styles.altSettingHeading}><span>{t("create.audio.sfx.intensity")}</span><b>72%</b></div><input className={styles.altRange} type="range" min="0" max="100" defaultValue="72" /></div>
      <div className={styles.altSettingBlock}><div className={styles.altSettingHeading}><span>{t("create.audio.sfx.variation")}</span><b>{t("create.audio.sfx.balanced")}</b></div><input className={styles.altRange} type="range" min="0" max="100" defaultValue="52" /></div>
      <label className={styles.altToggleRow}><span>{t("create.audio.sfx.seamlessLoop")}</span><button disabled type="button" className={styles.altToggleOff}><i /></button></label>
      <label className={styles.altToggleRow}><span>{t("create.audio.sfx.normalizeLoudness")}</span><button disabled type="button" className={styles.altToggleOn}><i /></button></label>
      <div className={styles.altSettingBlock}><span className={styles.altFieldLabel}>{t("create.audio.sfx.outputFormat")}</span><div className={styles.altFormatGrid}><button disabled type="button" className={styles.altFormat}>WAV</button><button disabled type="button" className={styles.altFormatActive}>MP3</button><button disabled type="button" className={styles.altFormat}>OGG</button></div></div>
      <div data-mobile-action-dock className={styles.mobileActionDock}><button type="button" className={styles.altGenerateButton} onClick={() => void handleGenerate()} disabled={status === "generating" || !description.trim()}>{status === "generating" ? t("create.audio.sfx.generatingButton") : t("create.audio.sfx.generate")} <Sparkles size={16} /></button></div>
    </aside>
  </div>;
}

function AudioCleanupLayout() {
  const { t } = useLocale();
  return <div className={styles.alternateLayout}>
    <section className={`${styles.alternatePanel} ${styles.alternateFormPanel}`}>
      <AlternateHeading eyebrow={t("create.audio.cleanup.eyebrow")} title={t("create.audio.cleanup.title")} description={t("create.audio.cleanup.description")} icon={<Waves size={24} />} />
      <button disabled type="button" className={`${styles.cleanupUpload} ${styles.cleanupUploadReady}`}><span className={styles.cleanupFileIcon}><FileAudio size={21} /></span><span><strong>interview-recording.wav</strong><small>WAV · 00:42 · 18.4 MB</small></span><Check size={17} /></button>
      <div className={styles.altFieldGroup}><span className={styles.altFieldLabel}>{t("create.audio.cleanup.tools")}</span><div className={styles.cleanupToolList}><label><input disabled type="checkbox" defaultChecked /><span><strong>{t("create.audio.cleanup.noiseReduction")}</strong><small>{t("create.audio.cleanup.noiseReductionHint")}</small></span></label><label><input disabled type="checkbox" defaultChecked /><span><strong>{t("create.audio.cleanup.voiceClarity")}</strong><small>{t("create.audio.cleanup.voiceClarityHint")}</small></span></label><label><input disabled type="checkbox" /><span><strong>{t("create.audio.cleanup.removeReverb")}</strong><small>{t("create.audio.cleanup.removeReverbHint")}</small></span></label></div></div>
      <button disabled type="button" className={styles.altUploadButton}><CloudUpload size={17} /> {t("create.audio.cleanup.replaceFile")}</button>
    </section>

    <section className={`${styles.alternatePanel} ${styles.alternateCenterPanel}`}>
      <div className={styles.altPanelHeader}><div><span className={styles.altEyebrow}>{t("create.audio.cleanup.previewEyebrow")}</span><h2>{t("create.audio.cleanup.beforeAfter")}</h2></div><span className={styles.altStatus}><span /> {t("create.audio.cleanup.comingSoon")}</span></div>
      <div className={styles.mockNotice}><LockKeyhole size={13} /><span>{t("create.audio.cleanup.comingSoonNotice")}</span></div>
      <div className={styles.cleanupCompare}><div><span>{t("create.audio.cleanup.original")}</span><AltWaveform label={t("create.audio.cleanup.roomNoise")} /></div><div><span>{t("create.audio.cleanup.cleaned")}</span><AltWaveform label={t("create.audio.cleanup.clarityLabel")} /></div></div>
      <div className={styles.cleanupStats}><div><strong>−18 dB</strong><small>{t("create.audio.cleanup.noiseFloor")}</small></div><div><strong>+24%</strong><small>{t("create.audio.cleanup.speechClarity")}</small></div><div><strong>−2.4 LUFS</strong><small>{t("create.audio.cleanup.loudnessChange")}</small></div></div>
      <div className={styles.altActionRow}><button disabled type="button" className={styles.altPrimaryButton}><Play size={15} fill="currentColor" /> {t("create.audio.cleanup.previewCleaned")}</button><button disabled type="button" className={styles.altSecondaryButton}>{t("create.audio.cleanup.compare")}</button></div>
    </section>

    <aside className={styles.alternateSettings}>
      <div className={styles.altPanelHeader}><h2>{t("create.audio.cleanup.settings")}</h2><Settings2 size={20} /></div>
      <div className={styles.altSettingBlock}><div className={styles.altSettingHeading}><span>{t("create.audio.cleanup.noiseReductionLevel")}</span><b>68%</b></div><input disabled className={styles.altRange} type="range" min="0" max="100" defaultValue="68" /></div>
      <div className={styles.altSettingBlock}><div className={styles.altSettingHeading}><span>{t("create.audio.cleanup.voicePresence")}</span><b>76%</b></div><input disabled className={styles.altRange} type="range" min="0" max="100" defaultValue="76" /></div>
      <label className={styles.altToggleRow}><span>{t("create.audio.cleanup.preserveTone")}</span><button disabled type="button" className={styles.altToggleOn}><i /></button></label>
      <label className={styles.altField}><span>{t("create.audio.cleanup.outputFormat")}</span><select disabled defaultValue="MP3"><option>MP3</option><option>WAV</option><option>OGG</option></select></label>
      <div data-mobile-action-dock className={styles.mobileActionDock}><button disabled type="button" className={styles.altGenerateButton}>{t("create.audio.cleanup.clean")} <Sparkles size={16} /></button></div>
    </aside>
  </div>;
}

export function AudioGenerationPage() {
  const { t } = useLocale();
  const [activeTab, setActiveTab] = useState<AudioTab>("Text to Speech");
  const [prompt, setPrompt] = useState(DEFAULT_AUDIO_PROMPT);
  const [tone, setTone] = useState<"Energetic" | "Friendly" | "Premium" | "Dramatic" | "">("");
  const [language, setLanguage] = useState("Thai");
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
  const [backgroundMusicLoadState, setBackgroundMusicLoadState] = useState<"loading" | "ready" | "error">("ready");
  const [creditEstimate, setCreditEstimate] = useState<AudioCreditQuote | null>(null);
  const [creditEstimateLoading, setCreditEstimateLoading] = useState(false);
  const [creditEstimateError, setCreditEstimateError] = useState<string | null>(null);
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
  const voiceScrollUserMovedRef = useRef(false);
  const audioHistoryRef = useRef<AudioHistoryItem[]>([]);
  const historySequenceRef = useRef(0);
  const [previewingVoiceKey, setPreviewingVoiceKey] = useState<string | null>(null);

  useTemplatePrompt("audio", value => {
    setPrompt(value);
    setAudioScenes(current => current.map((scene, index) => index === 0 ? { ...scene, text: value } : scene));
  });

  useEffect(() => {
    return () => { audioHistoryRef.current.filter((item) => item.localUrl).forEach((item) => URL.revokeObjectURL(item.url)); };
  }, []);

  useEffect(() => {
    if (activeTab !== "Text to Speech" || !backgroundMusic || backgroundMusicPresets.length > 0) return undefined;
    let cancelled = false;
    void listAudioBackgroundMusic().then((items) => {
      if (cancelled) return;
      setBackgroundMusicPresets(items);
      setBackgroundMusicPreset((current) => items.some((preset) => preset.key === current) ? current : items[0]?.key ?? "");
      setBackgroundMusicLoadState("ready");
    }).catch(() => {
      if (cancelled) return;
      setBackgroundMusicPresets([]);
      setBackgroundMusicPreset("");
      setBackgroundMusicLoadState("error");
    });
    return () => { cancelled = true; };
  }, [activeTab, backgroundMusic, backgroundMusicPresets.length]);

  useEffect(() => {
    if (activeTab !== "Text to Speech") return undefined;
    let cancelled = false;
    const timer = window.setTimeout(() => void listAudioHistory({ limit: AUDIO_HISTORY_LIMIT }).then((items) => {
      if (cancelled) return;
      const history = items.map((item) => ({ ...item, url: item.url ?? item.audioUrl ?? item.downloadUrl ?? "", localUrl: false, persisted: true }));
      audioHistoryRef.current = history;
      setAudioHistory(history);
    }).catch(() => undefined), 600);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [activeTab]);

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

  const toggleBackgroundMusic = () => {
    if (backgroundMusic) {
      setBackgroundMusic(false);
      return;
    }
    if (backgroundMusicPresets.length === 0) setBackgroundMusicLoadState("loading");
    setBackgroundMusic(true);
  };

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

  useEffect(() => {
    if (!availableVoices.length) return;
    // Voice metadata arrives asynchronously; reconcile persisted scene voices
    // after the external catalog has loaded.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
  }, [availableVoices.length, selectedModel, voiceLoadState, updateVoiceScrollButtons]);

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

  const voicePages = Array.from({ length: Math.ceil(availableVoices.length / VOICE_PAGE_SIZE) }, (_, pageIndex) => availableVoices.slice(pageIndex * VOICE_PAGE_SIZE, pageIndex * VOICE_PAGE_SIZE + VOICE_PAGE_SIZE));
  const isSceneMode = activeTab === "Podcast & Dialogue" && audioScenes.length > 0;
  const hasIncompleteScene = audioScenes.some((scene) => !scene.text.trim() || !scene.voice.trim());
  const isGenerating = status === "generating" || sceneGenerationStatus === "generating";
  const clearValues = () => {
    audioRef.current?.pause();
    voicePreviewAudioRef.current?.pause();
    setPrompt("");
    setTone("");
    setLanguage("Thai");
    setPronunciation("");
    setSelectedModel(availableModels.find((model) => model.isActive)?.key ?? availableModels[0]?.key ?? "");
    setSelectedVoice(availableVoices[0]?.key ?? "");
    setFormat("MP3");
    setSpeed(0.95);
    setBackgroundMusic(false);
    setBackgroundMusicPreset(backgroundMusicPresets[0]?.key ?? "");
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
    setPreviewingVoiceKey(null);
    setCreditEstimate(null);
    setCreditEstimateError(null);
    setErrorMessage(null);
    setSceneError(null);
    setStatus("idle");
    setSceneGenerationStatus("idle");
  };
  const generationValidationMessage = isSceneMode
    ? hasIncompleteScene ? t("create.audio.validation.completeScenes") : null
    : !prompt.trim() ? t("create.audio.validation.addScript")
      : voiceLoadState === "ready" && !selectedVoice ? t("create.audio.validation.selectVoice") : null;
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
          ...(tone ? { tone } : {}),
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
          ...(tone ? { tone } : {}),
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
        ...(tone ? { tone } : {}),
        speed,
        pronunciationHint: pronunciation.trim() || undefined,
        backgroundMusicEnabled: backgroundMusic && Boolean(backgroundMusicPreset),
        backgroundMusicKey: backgroundMusicPreset || undefined,
        idempotencyKey: createAudioIdempotencyKey(),
      });
      setGeneratedAudioResult(result, `Generation ${historySequenceRef.current + 1}`, selectedVoice);
      setStatus("complete");
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
        ...(tone ? { tone } : {}),
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

  const scenesTimeline = <section className={styles.podcastScenesBlock} aria-label={t("create.audio.scenes.a11y.panel")}>
    <div className={styles.sectionHeading}><div className={styles.sceneHeadingCopy}><h2>{t("create.audio.scenes.title")}</h2><small>{t("create.audio.scenes.subtitle")}</small></div><span className={styles.timelineHint}>{t("create.audio.scenes.summary", { count: audioScenes.length, total: formatSceneSeconds(audioScenes.reduce((total, scene) => total + scene.durationSeconds, 0)) })}</span></div>
    <div className={styles.sceneRow}>{audioScenes.map((scene, index) => <button type="button" key={scene.id} className={selectedSceneId === scene.id ? styles.sceneCardActive : styles.sceneCard} onClick={() => setSelectedSceneId(scene.id)} aria-pressed={selectedSceneId === scene.id}>
      <Image src={availableVoices.find((voice) => voice.key === scene.voice)?.imageUrl || voiceImages[index % voiceImages.length]} alt="" width={42} height={50} unoptimized /><span className={styles.sceneCopy}><strong><em>{scene.id}</em> {scene.title}</strong><small>{sceneTimeRange(audioScenes, index)}</small></span><span className={styles.miniWave} aria-hidden="true" />
    </button>)}<button type="button" className={styles.addScene} onClick={addAudioScene} disabled={audioScenes.length >= 20}><Plus size={17} />{t("create.audio.scenes.addScene")}</button></div>
  </section>;

  useTemplateSettings('audio',{ready:modelLoadState==='ready'&&voiceLoadState==='ready',model:selectedModel,models:availableModels.map(m=>m.key),setModel:setSelectedModel,apply:(s,p)=>{
    setPrompt(p);setAudioScenes(current=>current.map((scene,i)=>i===0?{...scene,text:p}:scene));
    if(typeof s.voice==='string') {
      if(availableVoices.some(v=>v.key===s.voice))setSelectedVoice(s.voice);
      else {setSelectedVoice('');window.alert('เสียงในเทมเพลตไม่พร้อมใช้ กรุณาเลือกเสียงใหม่ก่อนสร้าง');}
    }
    if(typeof s.outputFormat==='string')setFormat(s.outputFormat.toUpperCase());
    if(typeof s.speed==='number')setSpeed(s.speed);
    if (typeof s.tone === 'string' && tones.some(({ label }) => label === s.tone)) setTone(s.tone as Exclude<typeof tone, "">);
    if(typeof s.languageCode==='string')setLanguage(s.languageCode==='th'?'Thai':s.languageCode==='ja'?'Japanese':'English (US)');
    if(typeof s.pronunciationHint==='string')setPronunciation(s.pronunciationHint);
  }});
  return <div className={`${styles.audioPage} audio-studio-page`}>
    <section className={`studio-hero-frame ${styles.heroBanner}`} aria-label={t("create.audio.a11y.hero")}>
      <picture>
         <source media="(max-width: 767.98px)" srcSet="/generated-assets/studio-heroes-v4/create-audio-mobile-v2.webp" />
         <Image src="/generated-assets/studio-heroes-v4/create-audio-desktop-v2.webp" alt="Gen Audio — AI audio generation studio" width={2400} height={435} priority sizes="100vw" />
      </picture>
    </section>

    <CreatorWorkspaceLayout
      tabs={<nav className={styles.featureTabs} aria-label={t("create.audio.tools")}>
      {visibleTabs.map((label) => <button key={label} type="button" className={activeTab === label ? styles.tabActive : styles.tab} onClick={() => setActiveTab(label)} aria-pressed={activeTab === label}>
        {t(audioTabKeys[label])}
      </button>)}
      </nav>}
      mobileTabs={<MobileModeDropdown
      menuId="audio-mode-menu"
      value={activeTab}
      options={visibleTabs.map((label) => ({ value: label, label: t(audioTabKeys[label]), icon: audioModeIcons[label] }))}
      ariaLabel={t("create.audio.tools")}
      currentModeLabel={t("create.mode.current")}
      switchModeLabel={t("create.mode.switch")}
      otherModesLabel={t("create.mode.other")}
      onChange={setActiveTab}
      />}
      content={
        <>

    {activeTab === "Text to Speech" ? <div className={styles.audioGrid}>
      <section className={styles.scriptPanel} aria-label={t("create.audio.a11y.scriptPanel")}>
        <div className={styles.audioPromptTopActions}>
          <ImageTutorialButton feature="textToSpeech" featureName="Text to Speech" />
          <ClearValuesButton onClick={clearValues} disabled={isGenerating} />
        </div>
        <div className={styles.panelHeading}><h2><span>1</span> {t("create.audio.scriptPrompt")}</h2><InfoTooltip content={t("create.audio.info.script")} size={14} /></div>
        <div className={styles.promptBox}>
          <textarea aria-label={t("create.audio.a11y.scriptInput")} value={prompt} onChange={(event) => { const value = event.target.value; setPrompt(value); setAudioScenes((current) => current.map((scene) => scene.id === "01" ? { ...scene, text: value } : scene)); }} maxLength={promptMaxLength} />
          <div className={styles.promptMeta}><span>{prompt.length.toLocaleString()} / {promptMaxLength.toLocaleString()}</span><button type="button" onClick={() => { setPrompt(""); setAudioScenes((current) => current.map((scene) => scene.id === "01" ? { ...scene, text: "" } : scene)); }}>{t("create.audio.clear")} <Trash2 size={13} /></button></div>
        </div>

        <div className={styles.inputSection}>
          <FieldLabel hint={t("create.audio.toneHint")}>{t("create.audio.tone")}</FieldLabel>
          <div className={styles.chipRow}>{tones.map(({ label, icon: ToneIcon }) => <button type="button" key={label} className={tone === label ? styles.toneActive : styles.toneButton} onClick={() => setTone((current) => current === label ? "" : label)} aria-pressed={tone === label}><ToneIcon size={12} />{t(toneKeys[label])}</button>)}</div>
        </div>

        <div className={styles.twoColumnFields}>
          <SelectField label={t("create.audio.language")} value={language} onChange={setLanguage} options={[{ value: "Thai", label: "ภาษาไทย" }, { value: "English (US)", label: "English (US)" }, { value: "English (UK)", label: "English (UK)" }, { value: "Japanese", label: "日本語" }]} />
          <label className={styles.selectField}><FieldLabel>{t("create.audio.pronunciationHints")}</FieldLabel><input value={pronunciation} onChange={(event) => setPronunciation(event.target.value)} placeholder={'e.g. EOS as “อี-โอ-เอส”'} /></label>
        </div>

      </section>

      <section className={styles.centerColumn} aria-label={t("create.audio.a11y.centerColumn")}>
        <div className={`${styles.sectionBlock} ${styles.voiceSection}`}>
          <div className={styles.sectionHeading}><h2>{t("create.audio.voiceSpeaker")}</h2></div>
          <div className={styles.voiceCarousel}>
            {canScrollVoicesLeft ? <button type="button" className={`${styles.voiceCarouselButton} ${styles.voiceCarouselButtonLeft}`} onClick={() => scrollVoices(-1)} aria-label="เลื่อน Voice ไปทางซ้าย" aria-controls="audio-voice-carousel"><ChevronLeft size={16} /></button> : null}
            <div ref={voiceRowRef} id="audio-voice-carousel" className={styles.voiceRow} onWheel={() => { voiceScrollUserMovedRef.current = true; }} onTouchMove={() => { voiceScrollUserMovedRef.current = true; }}>
            {voiceLoadState === "loading" ? <div className={styles.voiceState} role="status">{t("create.audio.loadingVoices")}</div> : null}
            {voiceLoadState === "error" ? <div className={styles.voiceStateError} role="alert"><span>{voiceError ?? t("create.audio.voicesError")}</span><button type="button" className={styles.voiceRetry} onClick={() => void loadVoices(selectedModel || undefined)}>{t("create.audio.tryAgain")}</button></div> : null}
            {voiceLoadState === "ready" && availableVoices.length === 0 ? <div className={styles.voiceState}>{t("create.audio.noVoices")}</div> : null}
            {voiceLoadState === "ready" ? voicePages.map((page, pageIndex) => <div className={styles.voicePage} key={`voice-page-${pageIndex}`}>
              {page.map((voice, index) => <div className={`${styles.voiceCardWrap} ${selectedVoice === voice.key ? styles.voiceCardWrapActive : ""}`} key={voice.key}>
                <button type="button" className={selectedVoice === voice.key ? styles.voiceCardActive : styles.voiceCard} onClick={() => setSelectedVoice(voice.key)} aria-pressed={selectedVoice === voice.key}>
                  <div className={styles.voiceImage}><Image src={voice.imageUrl || voiceImages[(pageIndex * VOICE_PAGE_SIZE + index) % voiceImages.length]} alt="" fill unoptimized sizes="60px" /></div><strong>{voice.name}</strong><small>{voice.description || t("create.audio.voiceFallback")}</small>{selectedVoice === voice.key ? <Check size={14} className={styles.voiceCheck} /> : null}
                </button>
                <button type="button" data-voice-key={voice.key} className={`${styles.voicePreviewButton} ${previewingVoiceKey === voice.key ? styles.voicePreviewButtonActive : ""}`} onClick={handleVoicePreviewClick} disabled={!voice.previewUrl} aria-label={voice.previewUrl ? (previewingVoiceKey === voice.key ? `หยุดตัวอย่างเสียง ${voice.name}` : `ฟังตัวอย่างเสียง ${voice.name}`) : `ยังไม่มีตัวอย่างเสียง ${voice.name}`} title={voice.previewUrl ? "ฟังตัวอย่างเสียง" : "ยังไม่มีตัวอย่างเสียง"}>
                  {previewingVoiceKey === voice.key ? <span className={styles.voicePauseGlyph} /> : <Play size={11} fill="currentColor" />}
                </button>
              </div>)}
            </div>) : null}
            </div>
            {canScrollVoicesRight ? <button type="button" className={`${styles.voiceCarouselButton} ${styles.voiceCarouselButtonRight}`} onClick={() => scrollVoices(1)} aria-label="เลื่อน Voice ไปทางขวา" aria-controls="audio-voice-carousel"><ChevronRight size={16} /></button> : null}
          </div>
        </div>

        <audio ref={voicePreviewAudioRef} className={styles.hiddenAudio} preload="none" onEnded={() => setPreviewingVoiceKey(null)} onError={() => setPreviewingVoiceKey(null)} aria-hidden="true" />

        {audioUrl ? <div className={styles.previewPanel}>
           <div className={styles.previewHeader}><h2>{t("create.audio.preview")}</h2><div className={styles.previewActions}><button type="button" className={styles.outlineAction} onClick={downloadAudio} disabled={!audioUrl}><Download size={15} /> {t("create.audio.download")}</button></div></div>
           <PreviewWaveform audioUrl={audioUrl} progress={progress} isPlaying={isPlaying} />
           <div className={styles.playerRow}>
             <button type="button" className={styles.playButton} onClick={togglePlayback} aria-label={t(isPlaying ? "create.audio.a11y.pause" : "create.audio.a11y.play")} disabled={!audioUrl}>{isPlaying ? <span className={styles.pauseGlyph} /> : <Play size={20} fill="currentColor" />}</button>
             <button type="button" className={styles.skipButton} onClick={() => seekBy(-10)} aria-label={t("create.audio.a11y.rewind10")} disabled={!audioUrl}><RotateCcw size={17} /><small>10</small></button>
             <button type="button" className={styles.skipButton} onClick={() => seekBy(10)} aria-label={t("create.audio.a11y.forward10")} disabled={!audioUrl}><RotateCw size={17} /><small>10</small></button>
             <span className={styles.timeLabel}>{formatTime(currentTime)} / {formatTime(duration)}</span>
             <input className={styles.scrubber} type="range" min="0" max="100" value={progress} onChange={(event) => { const nextProgress = Number(event.target.value); const audioDuration = durationRef.current || duration; setProgress(nextProgress); if (audioRef.current && audioDuration) audioRef.current.currentTime = (nextProgress / 100) * audioDuration; }} aria-label={t("create.audio.a11y.audioProgress")} disabled={!audioUrl} />
             <Volume2 size={17} className={styles.volumeIcon} />
             <input className={styles.volumeSlider} type="range" min="0" max="100" value={volume} onChange={(event) => { const nextVolume = Number(event.target.value); setVolume(nextVolume); if (audioRef.current) audioRef.current.volume = nextVolume / 100; }} aria-label={t("create.audio.a11y.volume")} />
           </div>
           <audio ref={audioRef} src={audioUrl ?? undefined} preload="metadata" onLoadedMetadata={(event) => { syncAudioDuration(event.currentTarget); event.currentTarget.volume = volume / 100; event.currentTarget.playbackRate = speed; }} onDurationChange={(event) => syncAudioDuration(event.currentTarget)} onTimeUpdate={(event) => { const nextTime = event.currentTarget.currentTime; const nextDuration = durationRef.current || (Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0); if (nextDuration > 0 && durationRef.current !== nextDuration) { durationRef.current = nextDuration; setDuration(nextDuration); } setCurrentTime(nextTime); setProgress(nextDuration ? Math.min(100, (nextTime / nextDuration) * 100) : 0); }} onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} onEnded={(event) => { const endDuration = durationRef.current || event.currentTarget.duration; setIsPlaying(false); if (Number.isFinite(endDuration) && endDuration > 0) { durationRef.current = endDuration; setDuration(endDuration); setCurrentTime(endDuration); } setProgress(100); }} />
           {errorMessage ? <p className={styles.securityNote} role="alert">{errorMessage}</p> : null}
        </div> : null}

        <section className={styles.historyPanel} aria-label={t("create.audio.a11y.historyPanel")}>
          <div className={styles.sectionHeading}><h2><History size={13} /> {t("create.audio.generationHistory")}</h2><span className={styles.timelineHint}>{audioHistory.length ? audioHistory.length === 1 ? t("create.audio.resultCountOne") : t("create.audio.resultCountMany", { count: audioHistory.length }) : t("create.audio.noResults")}</span></div>
          {audioHistory.length ? <div className={styles.historyList}>{audioHistory.map((item) => <div key={item.id} className={item.url === audioUrl ? styles.historyItemRowActive : styles.historyItemRow}>
            <button type="button" className={item.url === audioUrl ? styles.historyItemActive : styles.historyItem} onClick={() => selectHistoryItem(item)} disabled={historyLoadingId === item.id} aria-busy={historyLoadingId === item.id}><span className={historyLoadingId === item.id ? styles.historyLoading : styles.historyPlay}>{historyLoadingId === item.id ? null : isPlaying && item.url === audioUrl ? <Pause size={13} fill="currentColor" /> : <Play size={13} fill="currentColor" />}</span><span className={styles.historyCopy}><strong>{item.label}</strong><small>{item.createdAt}</small></span><span className={styles.historyCurrent}>{item.url === audioUrl ? t("create.audio.historyCurrent") : t("create.audio.historyPlay")}</span></button>
            <button type="button" className={styles.historyDelete} aria-label={t("create.audio.a11y.deleteItem", { label: item.label })} onClick={() => { setPendingHistoryDelete(item); setHistoryDeleteOpen(true); }}><Trash2 size={13} /></button>
          </div>)}</div> : <div className={styles.historyEmpty}><History size={15} /><span>{t("create.audio.historyEmpty")}</span></div>}
        </section>

      </section>

      <aside className={styles.settingsPanel} aria-label={t("create.audio.a11y.settingsPanel")}>
        <div className={`${styles.settingsTitle} flex-wrap gap-2`}><h2>{t("create.audio.settings")}</h2><WandSparkles size={22} /></div>
        <div className={styles.settingBlock}><SelectField label={t("create.audio.voiceModel")} value={selectedModel} onChange={(modelId) => { setSelectedModel(modelId); setSelectedVoice(""); }} disabled={modelLoadState !== "ready" || availableModels.length === 0} loading={modelLoadState === "loading"} options={availableModels.map((model) => ({ value: model.key, label: model.name, preserveLabel: true }))} /></div>
        <div className={styles.settingBlock}><FieldLabel>{t("create.audio.outputFormat")}</FieldLabel><div className={styles.formatRow}>{["MP3", "WAV", "OGG"].map((item) => <button type="button" key={item} className={format === item ? styles.formatActive : styles.formatButton} onClick={() => setFormat(item)}>{item}</button>)}</div></div>
        <div className={styles.settingBlock}><div className={styles.speedHeader}><FieldLabel>{t("create.audio.speechSpeed")}</FieldLabel><strong>{speed.toFixed(2)}x</strong></div><input className={styles.speedSlider} type="range" min="0.5" max="2" step="0.05" value={speed} onChange={(event) => setSpeed(Number(event.target.value))} /><div className={styles.rangeLabels}><span>0.5x</span><span>1x</span><span>2x</span></div></div>
        <div className={styles.settingBlock}><div className={styles.musicHeader}><FieldLabel>{t("create.audio.autoBackgroundMusic")}</FieldLabel><button type="button" className={backgroundMusic ? styles.toggleOn : styles.toggleOff} onClick={toggleBackgroundMusic} aria-pressed={backgroundMusic} disabled={backgroundMusicLoadState === "loading"}><span /></button></div>{backgroundMusic ? <SelectField label="" value={backgroundMusicPreset} onChange={setBackgroundMusicPreset} disabled={backgroundMusicLoadState !== "ready" || backgroundMusicPresets.length === 0} loading={backgroundMusicLoadState === "loading"} options={backgroundMusicPresets.map((preset) => ({ value: preset.key, label: preset.name }))} /> : null}</div>
        <div data-mobile-action-dock className={styles.mobileActionDock}>
          <div className={styles.creditEstimate} title={creditEstimateError ?? undefined}><div className={styles.creditEstimateHeader}><strong>{t("create.audio.estimatedCredits")} <InfoTooltip content={t("create.audio.info.estimatedCredits")} size={11} /></strong><b>{creditEstimateLoading || modelLoadState === "loading" || voiceLoadState === "loading" ? t("create.audio.calculating") : creditEstimate ? t("create.audio.creditsAmount", { amount: formatCreditAmount(creditEstimate.creditCost) }) : "—"}</b></div><p className={styles.creditEstimateCount}>{isSceneMode ? audioScenes.length === 1 ? t("create.audio.sceneCountOne") : t("create.audio.sceneCountMany", { count: audioScenes.length }) : t("create.audio.audioCount")}</p></div>
          {generationValidationMessage ? <p className={styles.generationValidation} role="status">{generationValidationMessage}</p> : null}
          <button type="button" className={styles.generateButton} onClick={() => void (isSceneMode ? handleGenerateScenes() : handleGenerate())} disabled={isGenerating || !selectedModel || voiceLoadState !== "ready" || (isSceneMode ? hasIncompleteScene : !prompt.trim() || !selectedVoice)}>{isGenerating ? <><span className={styles.spinner} /> {t("create.audio.generating")}</> : <>{t("create.audio.generateAudio")} <Sparkles size={17} /></>}</button>
          <p className={styles.securityNote}><LockKeyhole size={11} /> {t("create.audio.privateSecure")}</p>
        </div>
      </aside>
  </div> : activeTab === "Podcast & Dialogue" ? <PodcastDialogueLayout onHistorySaved={persistGeneratedAudio} scenesTimeline={scenesTimeline} /> : activeTab === "Voice Clone" ? <VoiceCloneLayout onHistorySaved={persistGeneratedAudio} /> : activeTab === "Sound Effects" ? <SoundEffectsLayout onHistorySaved={persistGeneratedAudio} /> : <AudioCleanupLayout />}
        </>
      }
    />
    <Dialog
      open={historyDeleteOpen}
      onOpenChange={(next) => { if (!next) setHistoryDeleteOpen(false); }}
      onOpenChangeComplete={(next) => { if (!next) setPendingHistoryDelete(null); }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("create.audio.deleteHistory.title")}</DialogTitle>
          <DialogDescription>{t("create.audio.deleteHistory.body", { label: pendingHistoryDelete?.label ?? "" })}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="ghost" size="sm" onClick={() => setHistoryDeleteOpen(false)}>{t("create.audio.deleteHistory.cancel")}</Button>
          <Button type="button" variant="destructive" size="sm" onClick={() => { if (pendingHistoryDelete) removeHistoryItem(pendingHistoryDelete); setHistoryDeleteOpen(false); }}><Trash2 size={15} /> {t("create.audio.deleteHistory.confirm")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>;
}
