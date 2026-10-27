"use client";
import Image from "next/image";
import Link from "next/link";
import { createContext, useContext, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  AtSign,
  Check,
  Clock,
  Copy,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Crop,
  Download,
  Eraser,
  Expand,
  FastForward,
  Folder,
  Gauge,
  Heart,
  ImagePlus,
  Info,
  LayoutTemplate,
  Loader2,
  Orbit,
  Pause,
  PenLine,
  Pencil,
  Play,
  MousePointer2,
  PanelsTopLeft,
  Maximize2,
  Plus,
  ScanLine,
  Search,
  SlidersHorizontal,
  Square,
  Sparkles,
  Sun,
  Trash2,
  TrendingUp,
  Type,
  Video,
  Volume2,
  VolumeX,
  Zap,
  Upload,
  User,
  WandSparkles,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  listTemplates,
  type CreativeTemplate as Template,
  type TemplateKind,
  type TemplatePagination,
} from "@/lib/api/templates";
import s from "./templates-page.module.css";
import { templateCopy } from "./template-copy";
import { listGenerationModels, type GenerationModelOption } from "@/lib/api/generation-models";
import { quoteDirectVideoGeneration, type DirectVideoQuoteInput } from "@/lib/api/video-generations";
import { createTextVideoGeneration, type TextVideoGenerationInput } from "@/lib/api/text-video-generations";
import { createMotionTransferGeneration, createVideoSwapGeneration } from "@/lib/api/motion-transfer-generations";
import { uploadImageAsset } from "@/lib/api/storage";
import { formatGenerationError } from "@/lib/api/generation-errors";
import { fetchHistory, type HistoryItem } from "@/lib/api/history";
import { createAdminTemplate, createTemplateCoverFromPreview, keepTemplateAssets } from "@/lib/api/templates";
import { listStylePresets } from "@/lib/api/style-presets";
import { cancelTemplateWorkflow, listTemplateWorkflows, startTemplateWorkflow, workflowFeature, type TemplateWorkflowRun } from "@/lib/api/template-workflows";
import { listMyTemplateLikes, setTemplateLike } from "@/lib/api/template-likes";
import { quoteImageGeneration, type ImageCreditQuoteInput } from "@/lib/api/generations";
import { emitGenerationRequestFailed, emitGenerationStarted, emitGenerationSubmitting, GENERATION_COMPLETED_EVENT, GENERATION_STARTED_EVENT } from "@/lib/generation-progress-events";
import { useStudioCopy, type StudioCopyKey } from "@/lib/i18n/studio-copy";
const kindKeys: Record<TemplateKind | "all", StudioCopyKey> = {
  all: "templates.kind.all",
  image: "templates.kind.image",
  video: "templates.kind.video",
  audio: "templates.kind.audio",
  document: "templates.kind.document",
};
type CopyLocale = "th" | "en";
/** The three modes of the control column, named like the creation page's own tools. */
type Mode = "create" | "edit" | "motion";
const modes: Mode[] = ["create", "edit", "motion"];
const DEFAULT_MODE: Mode = "create";
const modeKeys: Record<Mode, StudioCopyKey> = {
  create: "templates.mode.create",
  edit: "templates.mode.edit",
  motion: "templates.mode.motion",
};
const heroKeys: Record<Mode, { tag: StudioCopyKey; title: StudioCopyKey; body: StudioCopyKey }> = {
  create: { tag: "templates.hero.video.tag", title: "templates.hero.video.title", body: "templates.hero.video.body" },
  edit: { tag: "templates.hero.edit.tag", title: "templates.hero.edit.title", body: "templates.hero.edit.body" },
  motion: { tag: "templates.hero.motion.tag", title: "templates.hero.motion.title", body: "templates.hero.motion.body" },
};
/** Which mode a template belongs to, from the tool it opens: motion tools, editing tools, or (by default) creating. */
/** The three steps of each mode, shown under "How it works" and as the invitation on "History". */
const stepsByMode: Record<Mode, Array<[StudioCopyKey, StudioCopyKey]>> = {
  create: [
    ["templates.how.step1.title", "templates.how.step1.body"],
    ["templates.how.step2.title", "templates.how.step2.body"],
    ["templates.how.step3.title", "templates.how.step3.body"],
  ],
  edit: [
    ["templates.how.edit.step1.title", "templates.how.edit.step1.body"],
    ["templates.how.edit.step2.title", "templates.how.edit.step2.body"],
    ["templates.how.edit.step3.title", "templates.how.edit.step3.body"],
  ],
  motion: [
    ["templates.how.motion.step1.title", "templates.how.motion.step1.body"],
    ["templates.how.motion.step2.title", "templates.how.motion.step2.body"],
    ["templates.how.motion.step3.title", "templates.how.motion.step3.body"],
  ],
};
/** The three lists of the library, like the example's: the studio's own templates, then the community's, trending and new. */
type Lane = "eos" | "communityTrending" | "communityNew";
const laneQuery: Record<Lane, { source: "official" | "community"; sort: "recommended" | "popular" | "newest" }> = {
  eos: { source: "official", sort: "recommended" },
  communityTrending: { source: "community", sort: "popular" },
  communityNew: { source: "community", sort: "newest" },
};
const laneOptions: Array<[Lane, StudioCopyKey, LucideIcon]> = [
  ["eos", "templates.source.eos", WandSparkles],
  ["communityTrending", "templates.source.communityTrending", TrendingUp],
  ["communityNew", "templates.source.communityNew", Clock],
];
/** Editing tools shown in the reference UI; destinations are ready to be wired to their EOS tools. */
type EditToolId = "edit" | "extend" | "reframe" | "upscale" | "removeBackground" | "sdrToHdr" | "fpsBoost" | "depthMap";
const editTools: Array<{ id: EditToolId; icon: LucideIcon; title: StudioCopyKey; desc: StudioCopyKey; href: string; isNew?: boolean }> = [
  { id: "edit", icon: WandSparkles, title: "templates.edit.edit.title", desc: "templates.edit.edit.desc", href: "/create/video?tool=edit" },
  { id: "extend", icon: FastForward, title: "templates.edit.extend.title", desc: "templates.edit.extend.desc", href: "/create/video?tab=extend-video" },
  { id: "reframe", icon: Crop, title: "templates.edit.reframe.title", desc: "templates.edit.reframe.desc", href: "/create/video?tool=reframe" },
  { id: "upscale", icon: Expand, title: "templates.edit.upscale.title", desc: "templates.edit.upscale.desc", href: "/create/video?tool=upscale" },
  { id: "removeBackground", icon: Eraser, title: "templates.edit.removeBackground.title", desc: "templates.edit.removeBackground.desc", href: "/create/video?tool=remove-background", isNew: true },
  { id: "sdrToHdr", icon: Sun, title: "templates.edit.sdrToHdr.title", desc: "templates.edit.sdrToHdr.desc", href: "/create/video?tool=sdr-to-hdr", isNew: true },
  { id: "fpsBoost", icon: Gauge, title: "templates.edit.fpsBoost.title", desc: "templates.edit.fpsBoost.desc", href: "/create/video?tool=fps-boost", isNew: true },
  { id: "depthMap", icon: ScanLine, title: "templates.edit.depthMap.title", desc: "templates.edit.depthMap.desc", href: "/create/video?tool=depth-map", isNew: true },
];
function modeOf(t: Template): Mode {
  const feature = typeof t.settings?.feature === "string" ? t.settings.feature : "";
  const hint = `${feature} ${t.targetPath}`.toLowerCase();
  if (/(motion|swap)/.test(hint)) return "motion";
  if (/(extend|edit|upscale|reframe|lipsync|remove-background)/.test(hint)) return "edit";
  return "create";
}
const titles: Record<string, string> = {
  "Social media post": "โพสต์โซเชียลที่เป็นคุณ",
  "Product ad": "เปลี่ยนสินค้าให้เป็นแคมเปญ",
  "AI presenter video": "พรีเซนเตอร์ AI มืออาชีพ",
  "Podcast & dialogue": "พอดแคสต์และบทสนทนา",
  "Training video": "วิดีโออบรมและสอน",
  "Motion transfer: brand story": "ถ่ายทอดการเคลื่อนไหว: เรื่องราวแบรนด์",
  "Motion transfer: product showcase": "ถ่ายทอดการเคลื่อนไหว: โชว์สินค้า",
  "Extend video: continue the scene": "ขยายวิดีโอ: เล่าฉากต่อ",
  "Lipsync: presenter voice-over": "ลิปซิงก์: พรีเซนเตอร์พากย์เสียง",
  "Image to video workflow": "เวิร์กโฟลว์ ภาพเป็นวิดีโอ",
};
// The prompts of the seeded templates are stored in English; in Thai the panel shows these instead (the rest come from the data).
const prompts: Record<string, string> = {
  "Create a premium product advertisement with intentional lighting, a clean composition, and a clear hero product.":
    "สร้างโฆษณาสินค้าพรีเมียมด้วยแสงที่ตั้งใจจัด องค์ประกอบภาพสะอาดตา และเน้นสินค้าหลักให้เด่นชัด",
  "Create an engaging presenter video with a confident delivery, natural pacing, and a clean branded background.":
    "สร้างวิดีโอพรีเซนเตอร์ที่น่าติดตาม ถ่ายทอดอย่างมั่นใจ จังหวะเป็นธรรมชาติ ฉากหลังสะอาดตาและสื่อถึงแบรนด์",
  "Create a natural, conversational dialogue with clear speaker turns, warm delivery, and purposeful pacing.":
    "สร้างบทสนทนาที่เป็นธรรมชาติ แบ่งช่วงผู้พูดชัดเจน น้ำเสียงอบอุ่น และจังหวะที่มีจุดมุ่งหมาย",
  "Create a clear training video with an easy-to-follow structure, helpful visual examples, and a calm professional tone.":
    "สร้างวิดีโออบรมที่ชัดเจน โครงสร้างติดตามง่าย มีตัวอย่างภาพประกอบที่เป็นประโยชน์ และน้ำเสียงมืออาชีพที่ใจเย็น",
  "Replace the main character in the source video with my character and keep the original camera movement and timing.":
    "แทนที่ตัวละครหลักในวิดีโอต้นฉบับด้วยตัวละครของฉัน โดยคงการเคลื่อนกล้องและจังหวะเวลาเดิมไว้",
  "A woman in a white dress stands in a field of flowers at sunset, a gentle breeze moving her hair, soft warm light.":
    "ผู้หญิงในชุดสีขาวยืนอยู่กลางทุ่งดอกไม้ยามพระอาทิตย์ตก ลมพัดผมเบาๆ แสงอบอุ่นนุ่มนวล",
  "Show my product in the source video, keeping the same camera motion, lighting direction and pacing.":
    "แสดงสินค้าของฉันในวิดีโอต้นฉบับ โดยคงการเคลื่อนกล้อง ทิศทางแสง และจังหวะเดิมไว้",
};
// In Thai the template's own Thai text (set in the admin) comes first; the maps above only cover older templates that have none.
const promptOf = (t: Template, locale: CopyLocale) => {
  const text = t.prompt?.trim() ?? "";
  if (locale !== "th") return text;
  return t.promptTh?.trim() || prompts[text] || text;
};
const copy = (t: Template, locale: CopyLocale) => {
  const base = templateCopy(
    t.title,
    t.description,
    typeof t.settings?.feature === "string" ? t.settings.feature : undefined,
    t.kind,
    locale,
  );
  return locale === "th" && t.descriptionTh?.trim() ? { ...base, description: t.descriptionTh.trim() } : base;
};
const name = (t: Template, locale: CopyLocale) =>
  (locale === "th" ? t.titleTh?.trim() || titles[t.title] : undefined) ?? copy(t, locale).title;

// Who liked what: the slugs this visitor liked, and the counts that changed after the page loaded.
type LikesState = { liked: Set<string>; counts: Record<string, number>; toggle: (t: Template) => void };
const LikesContext = createContext<LikesState>({ liked: new Set(), counts: {}, toggle: () => {} });
function templateHref(t: Template) {
  const url = new URL(t.targetPath, "http://template.local");
  url.searchParams.set("template", t.slug);
  return url.pathname + url.search + url.hash;
}
const valid = (v?: string) => !!v && !v.includes("\\") && (/^\/(?!\/)/.test(v) || /^https?:\/\//i.test(v));
function Media({ t, expanded = false, tile = false }: { t: Template; expanded?: boolean; tile?: boolean }) {
  const { c, locale } = useStudioCopy();
  const ref = useRef<HTMLMediaElement | null>(null),
    [failed, setFailed] = useState(false),
    [imageError, setImageError] = useState(false);
  const playable = valid(t.previewUrl) && !failed;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const other = (e: Event) => {
      if ((e as CustomEvent).detail !== el) el.pause();
    };
    const claim = () => {
      if (!el.muted && !el.paused) window.dispatchEvent(new CustomEvent("template-audio", { detail: el }));
    };
    const hidden = () => {
      if (document.hidden) el.pause();
    };
    window.addEventListener("template-audio", other);
    el.addEventListener("play", claim);
    el.addEventListener("volumechange", claim);
    document.addEventListener("visibilitychange", hidden);
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) el.pause();
          else if (t.kind === "video" && !expanded && !reduced && el.muted && !document.hidden)
            void el.play().catch(() => {});
        });
      },
      { threshold: 0.55 },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      el.pause();
      window.removeEventListener("template-audio", other);
      el.removeEventListener("play", claim);
      el.removeEventListener("volumechange", claim);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [t.previewUrl, t.kind, expanded, playable]);
  const poster =
    imageError || !valid(t.thumbnailUrl) ? (
      <span className={s.missing}>{tile ? name(t, locale) : c("templates.media.coverFailed")}</span>
    ) : (
      <Image
        src={t.thumbnailUrl}
        alt={expanded ? name(t, locale) : ""}
        fill
        unoptimized
        sizes="(max-width:700px) 100vw, 65vw"
        className={s.poster}
        onError={() => setImageError(true)}
      />
    );
  if (t.kind === "video" && playable)
    return (
      <video
        ref={(el) => {
          ref.current = el;
        }}
        src={t.previewUrl}
        poster={t.thumbnailUrl}
        className={s.video}
        controls={!tile}
        muted={!expanded}
        loop={!expanded}
        playsInline
        preload="metadata"
        aria-label={c("templates.media.videoAria", { name: name(t, locale) })}
        onError={() => setFailed(true)}
      />
    );
  // A gallery tile only shows the cover; the sample itself is played in the preview.
  if (t.kind === "audio" && tile)
    return (
      <div className={s.still}>
        {poster}
        <span className={s.audioMark}>
          <AudioLines size={22} />
        </span>
      </div>
    );
  if (t.kind === "audio")
    return (
      <div className={s.audio}>
        <div className={s.audioCover}>{poster}</div>
        <div className={s.audioPlayer}>
          <AudioLines size={36} />
          <strong>{name(t, locale)}</strong>
          {playable ? (
            <audio
              ref={(el) => {
                ref.current = el;
              }}
              src={t.previewUrl}
              controls
              preload="metadata"
              aria-label={c("templates.media.audioAria", { name: name(t, locale) })}
              onError={() => setFailed(true)}
            />
          ) : (
            <span>{failed ? c("templates.media.audioFailed") : c("templates.media.audioMissing")}</span>
          )}
        </div>
      </div>
    );
  return (
    <div className={s.still}>
      {poster}
      {t.kind === "video" && (
        <span className={s.noPreview}>
          {failed ? c("templates.media.videoFailed") : c("templates.media.videoMissing")}
        </span>
      )}
    </div>
  );
}
function ClipPreviewPlayer({ src, poster, label }: { src: string; poster: string; label: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const formatTime = (value: number) => `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, "0")}`;
  const togglePlayback = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play().catch(() => {});
    else video.pause();
  };
  return (
    <div className={s.clipPlayer}>
      <div className={s.clipVideoStage}>
        <video
          ref={videoRef}
          src={src}
          poster={poster}
          className={s.clipVideo}
          preload="metadata"
          playsInline
          muted={muted}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
          onDurationChange={(event) => setDuration(event.currentTarget.duration || 0)}
          onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
          aria-label={label}
        />
      </div>
      <input
        className={s.clipSeek}
        type="range"
        min={0}
        max={duration || 1}
        step={0.01}
        value={Math.min(currentTime, duration || 1)}
        aria-label={label}
        onChange={(event) => {
          const time = Number(event.currentTarget.value);
          if (videoRef.current) videoRef.current.currentTime = time;
          setCurrentTime(time);
        }}
        style={{ "--clip-progress": `${duration ? (currentTime / duration) * 100 : 0}%` } as React.CSSProperties}
      />
      <div className={s.clipControls}>
        <div className={s.clipControlGroup}>
          <button type="button" onClick={togglePlayback} aria-label={playing ? "Pause video" : "Play video"}>
            {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
          </button>
          <span className={s.clipSpeed}>1×</span>
          <button type="button" onClick={() => setMuted((value) => !value)} aria-label={muted ? "Unmute video" : "Mute video"}>
            {muted ? <VolumeX size={17} /> : <Volume2 size={17} />}
          </button>
        </div>
        <span className={s.clipTime}>{formatTime(currentTime)} / {formatTime(duration)} <ChevronDown size={13} /></span>
        <button
          type="button"
          className={s.clipFullscreen}
          onClick={() => void videoRef.current?.requestFullscreen?.()}
          aria-label="Full screen video"
        >
          <Maximize2 size={16} />
        </button>
      </div>
    </div>
  );
}
/** Height follows the work's own aspect ratio (9:16 tall, 16:9 wide), kept between those two. */
const fallbackRatio: Record<TemplateKind, number> = { video: 16 / 9, image: 4 / 5, audio: 1, document: 3 / 4 };
function ratioOf(t: Template) {
  const raw = [t.settings?.ratio, t.settings?.aspectRatio, t.format].find(
    (v): v is string => typeof v === "string" && /\d+\s*:\s*\d+/.test(v),
  );
  const m = raw?.match(/(\d+)\s*:\s*(\d+)/);
  const ratio = m ? Number(m[1]) / Number(m[2]) : fallbackRatio[t.kind];
  return Math.min(16 / 9, Math.max(9 / 16, Number.isFinite(ratio) && ratio > 0 ? ratio : 1));
}
function Tile({
  t,
  selected,
  onSelect,
  onExpand,
}: {
  t: Template;
  selected: boolean;
  onSelect: (t: Template) => void;
  onExpand: (t: Template) => void;
}) {
  const { c, locale } = useStudioCopy();
  const likes = useContext(LikesContext);
  const liked = likes.liked.has(t.slug);
  const likeCount = likes.counts[t.slug] ?? t.likeCount ?? 0;
  return (
    <article className={`${s.tile} ${selected ? s.tileSelected : ""}`} style={{ aspectRatio: String(ratioOf(t)) }}>
      <Media t={t} tile key={t.id + t.previewUrl} />
      <button type="button" className={s.tileOpen} aria-pressed={selected} onClick={() => onSelect(t)} aria-label={name(t, locale)} />
      <span className={s.kind}>{c(kindKeys[t.kind])}</span>
      {t.source === "community" && t.authorName && <span className={s.tileAuthor}>{t.authorName}</span>}
      <button
        type="button"
        className={s.tileExpand}
        onClick={() => onExpand(t)}
        aria-label={c("templates.card.previewAria", { name: name(t, locale) })}
      >
        <Expand size={15} />
      </button>
      <div className={s.tileActions}>
        <button type="button" className={s.tileLike} aria-pressed={liked} aria-label={c("templates.card.like")} onClick={() => likes.toggle(t)}>
          <Heart size={16} fill={liked ? "currentColor" : "none"} aria-hidden="true" />
          {likeCount > 0 ? likeCount : null}
        </button>
        <button type="button" className={s.tileRecreate} onClick={() => onSelect(t)}>
          <Copy size={14} aria-hidden="true" />
          {c("templates.card.recreate")}
        </button>
      </div>
    </article>
  );
}

type CopyFn = ReturnType<typeof useStudioCopy>["c"];
type Fact = { key: "model" | "ratio" | "resolution" | "count" | "duration" | "file"; label: string; value: string };
/** The preset values worth showing for a template. */
function presetFacts(t: Template, c: CopyFn): Fact[] {
  const settings = t.settings ?? {};
  const rows: Array<[Fact["key"], string, unknown]> = [
    ["model", c("templates.preview.factModel"), settings.model ?? settings.modelId],
    ["ratio", c("templates.preview.factRatio"), settings.ratio ?? settings.aspectRatio],
    ["resolution", c("templates.preview.factResolution"), settings.resolution],
    ["count", c("templates.preview.factCount"), settings.count],
    [
      "duration",
      c("templates.preview.factDuration"),
      typeof settings.duration === "number" ? c("templates.preview.seconds", { value: settings.duration }) : undefined,
    ],
    ["file", c("templates.preview.factFile"), settings.outputFormat],
  ];
  return rows.flatMap(([key, label, value]) =>
    typeof value === "string" || typeof value === "number" ? [{ key, label, value: String(value) }] : [],
  );
}

type FlyoutOption = { id: string; label: string; chips?: string[]; badge?: string };

function EditWorkspace({ tool, poster }: { tool: EditToolId; poster?: string }) {
  const { c } = useStudioCopy();
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [drawOpen, setDrawOpen] = useState(false);
  const [drawMode, setDrawMode] = useState<"video" | "edit">("edit");
  const [drawStage, setDrawStage] = useState<"intro" | "canvas" | "assets" | "agreement" | "video">("intro");
  const [drawAsset, setDrawAsset] = useState<{ url: string; type: "image" | "video"; name: string } | null>(null);
  const [assetTab, setAssetTab] = useState<"uploads" | "generations">("uploads");
  const [assetReturnStage, setAssetReturnStage] = useState<"intro" | "canvas" | "assets" | "video">("intro");
  const [drawTool, setDrawTool] = useState<"select" | "pen" | "eraser" | "arrow" | "shape" | "image" | "text">("pen");
  const [agreement, setAgreement] = useState({ rights: false, terms: false });
  const [drawPrompt, setDrawPrompt] = useState("");
  const [drawAspect, setDrawAspect] = useState("16:9");
  const [drawModel, setDrawModel] = useState("MiniMax H3");
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [customMenu, setCustomMenu] = useState<"fps" | "resolution" | "maxFrames" | null>(null);
  const [customAnchor, setCustomAnchor] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null);
  const [openSetting, setOpenSetting] = useState<StudioCopyKey | null>(null);
  const [settingAnchor, setSettingAnchor] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null);
  const [sdrAnchor, setSdrAnchor] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null);
  const [editSettingValues, setEditSettingValues] = useState<Partial<Record<StudioCopyKey, StudioCopyKey>>>({});
  const [removeFormat, setRemoveFormat] = useState<"cutout" | "alpha">("cutout");
  const [sdrFormat, setSdrFormat] = useState("h265");
  const [fps, setFps] = useState("60");
  const [colorMap, setColorMap] = useState("grayscale");
  const [depthResolution, setDepthResolution] = useState("auto");
  const [maxFrames, setMaxFrames] = useState("1800");
  const [sideBySide, setSideBySide] = useState(false);
  const drawFileRef = useRef<HTMLInputElement>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const drawStartRef = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => () => { if (drawAsset) URL.revokeObjectURL(drawAsset.url); }, [drawAsset]);
  const drawPoint = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * (canvas.width / rect.width), y: (event.clientY - rect.top) * (canvas.height / rect.height) };
  };
  const startDrawing = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = drawCanvasRef.current;
    const point = drawPoint(event);
    const context = canvas?.getContext("2d");
    if (!canvas || !point || !context || drawTool === "select" || drawTool === "image") return;
    if (drawTool === "text") {
      context.fillStyle = "#f26b38";
      context.font = "bold 28px sans-serif";
      context.fillText(drawPrompt || "Text", point.x, point.y);
      return;
    }
    drawingRef.current = true;
    drawStartRef.current = point;
    canvas.setPointerCapture(event.pointerId);
    context.beginPath();
    context.moveTo(point.x, point.y);
    context.globalCompositeOperation = drawTool === "eraser" ? "destination-out" : "source-over";
    context.strokeStyle = "#f26b38";
    context.lineWidth = drawTool === "eraser" ? 24 : 6;
    context.lineCap = "round";
    context.lineJoin = "round";
  };
  const continueDrawing = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || drawTool === "arrow" || drawTool === "shape") return;
    const point = drawPoint(event);
    const context = drawCanvasRef.current?.getContext("2d");
    if (!point || !context) return;
    context.lineTo(point.x, point.y);
    context.stroke();
  };
  const finishDrawing = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const canvas = drawCanvasRef.current;
    const context = canvas?.getContext("2d");
    const start = drawStartRef.current;
    const end = drawPoint(event);
    if (!context || !start || !end) return;
    context.globalCompositeOperation = "source-over";
    context.strokeStyle = "#f26b38";
    context.lineWidth = 5;
    if (drawTool === "shape") {
      context.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y);
    } else if (drawTool === "arrow") {
      const angle = Math.atan2(end.y - start.y, end.x - start.x);
      context.beginPath();
      context.moveTo(start.x, start.y);
      context.lineTo(end.x, end.y);
      context.lineTo(end.x - 18 * Math.cos(angle - Math.PI / 6), end.y - 18 * Math.sin(angle - Math.PI / 6));
      context.moveTo(end.x, end.y);
      context.lineTo(end.x - 18 * Math.cos(angle + Math.PI / 6), end.y - 18 * Math.sin(angle + Math.PI / 6));
      context.stroke();
    }
    drawStartRef.current = null;
  };
  const settings: Record<EditToolId, Array<[StudioCopyKey, StudioCopyKey, boolean?]>> = {
    edit: [
      ["templates.edit.setting.model", "templates.edit.value.seedance", true],
      ["templates.edit.setting.quality", "templates.edit.value.1080p"],
      ["templates.edit.setting.bitrate", "templates.edit.value.high"],
    ],
    extend: [
      ["templates.edit.setting.direction", "templates.edit.value.sequel", true],
      ["templates.edit.setting.duration", "templates.edit.value.5seconds"],
      ["templates.edit.setting.quality", "templates.edit.value.1080p"],
      ["templates.edit.setting.bitrate", "templates.edit.value.high", true],
    ],
    reframe: [
      ["templates.edit.setting.aspectRatio", "templates.edit.value.9to16"],
      ["templates.edit.setting.quality", "templates.edit.value.720p"],
    ],
    upscale: [
      ["templates.edit.setting.outputResolution", "templates.edit.value.2k"],
      ["templates.edit.setting.creativity", "templates.edit.value.precise"],
      ["templates.edit.setting.model", "templates.edit.value.fluxUpscale", true],
    ],
    removeBackground: [],
    sdrToHdr: [],
    fpsBoost: [],
    depthMap: [],
  };
  const settingOptions: Partial<Record<StudioCopyKey, StudioCopyKey[]>> = {
    "templates.edit.setting.model": ["templates.edit.value.seedance", "templates.edit.value.seedance25", "templates.edit.value.kling"],
    "templates.edit.setting.direction": ["templates.edit.value.sequel", "templates.edit.value.prequel"],
    "templates.edit.setting.duration": ["templates.edit.value.5seconds", "templates.edit.value.10seconds", "templates.edit.value.15seconds"],
    "templates.edit.setting.quality": ["templates.edit.value.720p", "templates.edit.value.1080p"],
    "templates.edit.setting.bitrate": ["templates.edit.value.standard", "templates.edit.value.high"],
    "templates.edit.setting.aspectRatio": ["templates.edit.value.9to16", "templates.edit.value.16to9", "templates.edit.value.1to1"],
    "templates.edit.setting.outputResolution": ["templates.edit.value.2k", "templates.edit.value.4k"],
    "templates.edit.setting.creativity": ["templates.edit.value.precise", "templates.edit.value.creative"],
  };
  const settingDescriptions: Partial<Record<StudioCopyKey, Partial<Record<StudioCopyKey, StudioCopyKey>>>> = {
    "templates.edit.setting.bitrate": {
      "templates.edit.value.high": "templates.edit.desc.bitrateHigh",
      "templates.edit.value.standard": "templates.edit.desc.bitrateStandard",
    },
  };
  useEffect(() => {
    if (!openSetting && !sdrAnchor && !customMenu) return;
    const close = () => { setOpenSetting(null); setSettingAnchor(null); setSdrAnchor(null); setCustomMenu(null); setCustomAnchor(null); };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [openSetting, sdrAnchor, customMenu]);
  const toggleSetting = (label: StudioCopyKey, event: React.MouseEvent<HTMLButtonElement>) => {
    if (openSetting === label) {
      setOpenSetting(null);
      setSettingAnchor(null);
      return;
    }
    setSdrAnchor(null);
    setCustomMenu(null);
    setCustomAnchor(null);
    const rect = event.currentTarget.getBoundingClientRect();
    const options = settingOptions[label] ?? [];
    const menuHeight = Math.min(300, options.length * (settingDescriptions[label] ? 53 : 42) + 38);
    const width = Math.min(276, window.innerWidth - 24);
    let left = rect.right + 8;
    if (left + width > window.innerWidth - 12) left = rect.left - width - 8;
    left = Math.max(12, Math.min(left, window.innerWidth - width - 12));
    const top = Math.max(12, Math.min(rect.bottom - menuHeight, window.innerHeight - menuHeight - 12));
    setSettingAnchor({ top, left, width, maxHeight: Math.min(360, window.innerHeight - 24) });
    setOpenSetting(label);
  };
  const toggleSdrFormat = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (sdrAnchor) { setSdrAnchor(null); return; }
    setOpenSetting(null);
    setCustomMenu(null);
    const rect = event.currentTarget.getBoundingClientRect();
    const width = Math.min(470, window.innerWidth - 24);
    const height = Math.min(230, window.innerHeight - 24);
    const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
    const below = rect.bottom + 10;
    const top = below + height <= window.innerHeight - 12 ? below : Math.max(12, rect.top - height - 10);
    setSdrAnchor({ top, left, width, maxHeight: height });
  };
  const toggleCustomMenu = (kind: "fps" | "resolution" | "maxFrames", event: React.MouseEvent<HTMLButtonElement>) => {
    if (customMenu === kind) { setCustomMenu(null); setCustomAnchor(null); return; }
    setOpenSetting(null);
    setSettingAnchor(null);
    setSdrAnchor(null);
    const rect = event.currentTarget.getBoundingClientRect();
    const width = Math.min(kind === "fps" ? 250 : 276, window.innerWidth - 24);
    const height = kind === "fps" ? 188 : 190;
    let left = rect.right + 8;
    if (left + width > window.innerWidth - 12) left = rect.left - width - 8;
    left = Math.max(12, Math.min(left, window.innerWidth - width - 12));
    const top = Math.max(12, Math.min(rect.bottom - height, window.innerHeight - height - 12));
    setCustomAnchor({ top, left, width, maxHeight: Math.min(300, window.innerHeight - 24) });
    setCustomMenu(kind);
  };
  const needsPrompt = tool === "edit" || tool === "extend" || tool === "upscale" || tool === "removeBackground";
  const needsReferences = tool === "edit" || tool === "extend";
  const duration = tool === "removeBackground" || tool === "depthMap" ? "templates.edit.value.limit200mb" : tool === "fpsBoost" ? "templates.edit.value.limit100mb" : tool === "sdrToHdr" ? "templates.edit.value.duration60" : tool === "reframe" ? "templates.edit.value.duration4to60" : tool === "upscale" ? "templates.edit.value.duration20" : "templates.edit.value.duration30";
  const renderSettings = () => settings[tool].length ? (
    <div className={s.editSettingGrid}>
      {settings[tool].map(([label, value, wide]) => (
        <div key={label} className={`${s.editInlineSelect}${wide ? ` ${s.editSettingWide}` : ""}`}>
          <button type="button" className={`${s.editSetting}${openSetting === label ? ` ${s.editSettingActive}` : ""}`} aria-expanded={openSetting === label} onClick={(event) => toggleSetting(label, event)}>
            <span><small>{c(label)}</small><strong>{c(editSettingValues[label] ?? value)}</strong></span>
            <ChevronRight size={14} aria-hidden="true" />
          </button>
          {openSetting === label && settingAnchor && createPortal(
            <>
              <button type="button" className={s.editPopoverBackdrop} onClick={() => { setOpenSetting(null); setSettingAnchor(null); }} aria-label={c("templates.edit.closeOptions")} />
              <div className={s.editPopover} role="listbox" aria-label={c(label)} style={{ top: settingAnchor.top, left: settingAnchor.left, width: settingAnchor.width, maxHeight: settingAnchor.maxHeight }}>
                <small>{c(label)}</small>
                {settingOptions[label]?.map((option) => <button key={option} type="button" role="option" aria-selected={(editSettingValues[label] ?? value) === option} onClick={() => { setEditSettingValues((current) => ({ ...current, [label]: option })); setOpenSetting(null); setSettingAnchor(null); }}>
                  {label === "templates.edit.setting.bitrate" && (option === "templates.edit.value.high" ? <Sparkles size={15} /> : <Zap size={15} />)}
                  <span><strong>{c(option)}</strong>{settingDescriptions[label]?.[option] && <small>{c(settingDescriptions[label]![option]!)}</small>}</span>{(editSettingValues[label] ?? value) === option && <Check size={14} />}
                </button>)}
              </div>
            </>,
            document.body,
          )}
        </div>
      ))}
    </div>
  ) : null;
  return (
    <>
      {tool === "edit" && (
        <div className={s.editPromptTabs} role="tablist" aria-label={c("templates.edit.mode.aria")}>
          <button type="button" role="tab" aria-selected="true"><AudioLines size={14} />{c("templates.edit.mode.prompt")}</button>
          <button type="button" role="tab" aria-selected="false" onClick={() => { setDrawMode("edit"); setDrawStage("intro"); setDrawOpen(true); }}><PenLine size={14} />{c("templates.edit.mode.draw")}</button>
        </div>
      )}
      <button type="button" className={s.editUpload} onClick={() => { setDrawMode("edit"); setAssetReturnStage("intro"); setAgreement({ rights: false, terms: false }); setDrawStage("agreement"); setDrawOpen(true); }}>
        <Video size={22} aria-hidden="true" />
        <strong>{c(`templates.edit.upload.${tool}` as StudioCopyKey)}</strong>
        <small>{c(duration)}</small>
      </button>
      {needsReferences && (
        <button type="button" className={s.editReferences} onClick={() => { setDrawOpen(true); setAssetTab("uploads"); setAssetReturnStage("intro"); setDrawStage("assets"); }}>
          <span><PanelsTopLeft size={17} /><AudioLines size={17} /></span>
          <strong>{c("templates.edit.references.title")}</strong>
          <small>{c("templates.edit.references.limit")}</small>
        </button>
      )}
      {needsPrompt && (
        <section className={s.editPromptBlock}>
          <label htmlFor="template-edit-prompt">{c("templates.composer.prompt")}</label>
          <textarea id="template-edit-prompt" placeholder={c(`templates.edit.prompt.${tool}` as StudioCopyKey)} />
          {needsReferences && <div className={s.editPromptChips}><span><AtSign size={13} />{c("templates.edit.references.elements")}</span>{tool === "edit" && <span><AudioLines size={13} />{c("templates.edit.audio")}</span>}</div>}
        </section>
      )}
      {tool === "removeBackground" && (
        <section className={s.editOptionPanel}>
          <h3>{c("templates.edit.setting.outputFormat")}</h3>
          <div className={s.removeFormatOptions}>
            <button type="button" aria-pressed={removeFormat === "cutout"} onClick={() => setRemoveFormat("cutout")}>
              <span className={s.cutoutSample} style={poster ? { backgroundImage: `url("${poster}")` } : undefined} />
              <strong>{c("templates.edit.value.cutoutVideo")}</strong>
            </button>
            <button type="button" aria-pressed={removeFormat === "alpha"} onClick={() => setRemoveFormat("alpha")}>
              <span className={s.alphaSample}><i /></span>
              <strong>{c("templates.edit.value.alphaMask")}</strong>
            </button>
          </div>
        </section>
      )}
      {tool === "sdrToHdr" && (
        <div className={s.editInlineSelect}>
          <button type="button" className={`${s.editSetting} ${sdrAnchor ? s.editSettingActive : ""}`} aria-expanded={Boolean(sdrAnchor)} onClick={toggleSdrFormat}>
            <span><small>{c("templates.edit.setting.outputFormat")}</small><strong>{c(`templates.edit.value.${sdrFormat}` as StudioCopyKey)}</strong></span><ChevronRight size={14} />
          </button>
          {sdrAnchor && createPortal(
            <>
              <button type="button" className={s.editPopoverBackdrop} onClick={() => setSdrAnchor(null)} aria-label={c("templates.edit.closeOptions")} />
              <div className={s.editPopover} role="listbox" aria-label={c("templates.edit.setting.outputFormat")} style={{ top: sdrAnchor.top, left: sdrAnchor.left, width: sdrAnchor.width, maxHeight: sdrAnchor.maxHeight }}>
                <small>{c("templates.edit.setting.outputFormat")}</small>
                {([["h265", "templates.edit.desc.h265"], ["prores", "templates.edit.desc.prores"], ["exr", "templates.edit.desc.exr"]] as const).map(([id, desc]) => (
                  <button type="button" key={id} role="option" aria-selected={sdrFormat === id} onClick={() => { setSdrFormat(id); setSdrAnchor(null); }}>
                    <span><strong>{c(`templates.edit.value.${id}` as StudioCopyKey)}</strong><small>{c(desc)}</small></span>{sdrFormat === id && <Check size={14} />}
                  </button>
                ))}
              </div>
            </>,
            document.body,
          )}
        </div>
      )}
      {tool === "fpsBoost" && (
        <div className={s.editInlineSelect}>
          <button type="button" className={`${s.editSetting} ${customMenu === "fps" ? s.editSettingActive : ""}`} aria-expanded={customMenu === "fps"} onClick={(event) => toggleCustomMenu("fps", event)}>
            <span><small>{c("templates.edit.setting.frameRate")}</small><strong>{fps} FPS</strong></span><ChevronRight size={14} />
          </button>
          <small className={s.editSettingHint}>{c("templates.edit.supportedFps")}</small>
        </div>
      )}
      {tool === "depthMap" && (
        <>
          <section className={s.editOptionPanel}>
            <h3>{c("templates.edit.setting.colorMap")}</h3>
            <div className={s.colorMapOptions}>
              {(["grayscale", "turbo", "inferno", "magma", "viridis"] as const).map((value) => (
                <button key={value} type="button" aria-pressed={colorMap === value} onClick={() => setColorMap(value)}>
                  <span className={`${s.colorMapSample} ${s[`colorMap_${value}`]}`} /><strong>{c(`templates.edit.value.${value}` as StudioCopyKey)}</strong>
                </button>
              ))}
            </div>
          </section>
          <div className={s.editSettingGrid}>
            <div className={s.editInlineSelect}>
              <button type="button" className={`${s.editSetting} ${customMenu === "resolution" ? s.editSettingActive : ""}`} aria-expanded={customMenu === "resolution"} onClick={(event) => toggleCustomMenu("resolution", event)}><span><small>{c("templates.edit.setting.resolution")}</small><strong>{c(`templates.edit.value.${depthResolution}` as StudioCopyKey)}</strong></span><ChevronRight size={14} /></button>
            </div>
            <button type="button" className={`${s.editSetting} ${customMenu === "maxFrames" ? s.editSettingActive : ""}`} aria-expanded={customMenu === "maxFrames"} onClick={(event) => toggleCustomMenu("maxFrames", event)}><span><small>{c("templates.edit.setting.maxFrames")}</small><strong>{c(`templates.edit.value.frames${maxFrames}` as StudioCopyKey)}</strong></span><ChevronRight size={14} /></button>
          </div>
          <small className={s.editSettingHint}>{c("templates.edit.maxFramesLimit")}</small>
          <button type="button" role="switch" aria-checked={sideBySide} className={s.editAudioToggle} onClick={() => setSideBySide((value) => !value)}><span>{c("templates.edit.setting.sideBySide")}</span><i /></button>
        </>
      )}
      {customMenu && customAnchor && createPortal(
        <>
          <button type="button" className={s.editPopoverBackdrop} onClick={() => { setCustomMenu(null); setCustomAnchor(null); }} aria-label={c("templates.edit.closeOptions")} />
          <div className={s.editPopover} role="listbox" aria-label={c(customMenu === "fps" ? "templates.edit.setting.frameRate" : customMenu === "resolution" ? "templates.edit.setting.resolution" : "templates.edit.setting.maxFrames")} style={{ top: customAnchor.top, left: customAnchor.left, width: customAnchor.width, maxHeight: customAnchor.maxHeight }}>
            <small>{c(customMenu === "fps" ? "templates.edit.setting.frameRate" : customMenu === "resolution" ? "templates.edit.setting.resolution" : "templates.edit.setting.maxFrames")}</small>
            {customMenu === "fps" && <>
              <small>{c("templates.edit.supportedFps")}</small>
              {["24", "30", "60", "90", "120"].map((value) => <button key={value} type="button" role="option" aria-selected={fps === value} onClick={() => { setFps(value); setCustomMenu(null); setCustomAnchor(null); }}><span><strong>{value} FPS</strong></span>{fps === value && <Check size={14} />}</button>)}
            </>}
            {customMenu === "resolution" && (["auto", "720p", "1080p"] as const).map((value) => <button key={value} type="button" role="option" aria-selected={depthResolution === value} onClick={() => { setDepthResolution(value); setCustomMenu(null); setCustomAnchor(null); }}><span><strong>{c(`templates.edit.value.${value}` as StudioCopyKey)}</strong></span>{depthResolution === value && <Check size={14} />}</button>)}
            {customMenu === "maxFrames" && (["600", "1200", "1800"] as const).map((value) => <button key={value} type="button" role="option" aria-selected={maxFrames === value} onClick={() => { setMaxFrames(value); setCustomMenu(null); setCustomAnchor(null); }}><span><strong>{c(`templates.edit.value.frames${value}` as StudioCopyKey)}</strong></span>{maxFrames === value && <Check size={14} />}</button>)}
          </div>
        </>,
        document.body,
      )}
      {renderSettings()}
      {tool === "extend" && (
        <button type="button" role="switch" aria-checked={audioEnabled} className={s.editAudioToggle} onClick={() => setAudioEnabled((v) => !v)}>
          <span>{c("templates.edit.audio")}</span><i />
        </button>
      )}
      <div className={s.editGenerateDock}><button type="button">{c("templates.edit.generate")}</button></div>
      {drawOpen && createPortal(
        <div className={s.drawOverlay} role="dialog" aria-modal="true" aria-label={c("templates.edit.draw.title")}>
          <div className={`${s.drawDialog}${drawStage === "canvas" || drawStage === "video" ? ` ${s.drawDialogWorkspace}` : ""}`}>
            <div className={s.drawHeader}>
              <div>
                <button type="button" aria-pressed={drawMode === "video"} onClick={() => { setDrawMode("video"); setDrawStage(drawAsset?.type === "video" ? "video" : drawAsset?.type === "image" ? "canvas" : "intro"); }}>{c("templates.edit.draw.toVideo")}</button>
                <button type="button" aria-pressed={drawMode === "edit"} onClick={() => { setDrawMode("edit"); setDrawStage(drawAsset?.type === "video" ? "video" : drawAsset?.type === "image" ? "canvas" : "intro"); }}>{c("templates.edit.draw.toEdit")}</button>
              </div>
              <button type="button" className={s.drawClose} onClick={() => setDrawOpen(false)} aria-label={c("templates.edit.draw.close")}><X size={18} /></button>
            </div>

            <input
              ref={drawFileRef}
              className={s.visuallyHidden}
              type="file"
              accept="image/*,video/*"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (!file) return;
                const type = file.type.startsWith("video/") ? "video" : "image";
                setDrawAsset({ url: URL.createObjectURL(file), type, name: file.name });
                setDrawTool(type === "video" ? "select" : "pen");
                setDrawStage(type === "video" ? "video" : "canvas");
                const context = drawCanvasRef.current?.getContext("2d");
                context?.clearRect(0, 0, drawCanvasRef.current?.width ?? 0, drawCanvasRef.current?.height ?? 0);
                event.currentTarget.value = "";
              }}
            />

            {drawStage === "intro" && (
              <>
                <div className={s.drawPreview} style={poster ? { backgroundImage: `url("${poster}")` } : undefined}>
                  <canvas ref={drawCanvasRef} width={960} height={540} aria-label={c("templates.edit.draw.canvasLabel")} onPointerDown={startDrawing} onPointerMove={continueDrawing} onPointerUp={finishDrawing} onPointerCancel={() => { drawingRef.current = false; }} />
                </div>
                <h2>{c(drawMode === "edit" ? "templates.edit.draw.title" : "templates.edit.draw.videoTitle")}</h2>
                <p>{c(drawMode === "edit" ? "templates.edit.draw.description" : "templates.edit.draw.videoDescription")}</p>
                <div className={s.drawIntroActions}>
                  {drawMode === "video" && <button type="button" className={s.drawBlank} onClick={() => { setDrawStage("canvas"); setDrawTool("select"); }}><Square size={16} />{c("templates.edit.draw.createBlank")}</button>}
                  <button type="button" className={s.drawUpload} onClick={() => { setAssetReturnStage("intro"); setAgreement({ rights: false, terms: false }); setDrawStage("agreement"); }}><Plus size={18} />{c("templates.edit.draw.upload")}</button>
                </div>
              </>
            )}

            {(drawStage === "canvas" || drawStage === "video") && (
              <div className={s.drawEditor}>
                <div className={s.drawMediaStage}>
                  <div className={s.drawPreviewLarge}>
                    {drawAsset?.type === "video" && <video src={drawAsset.url} controls playsInline />}
                    {drawAsset?.type === "image" && <Image src={drawAsset.url} alt={c("templates.edit.draw.previewAlt")} fill unoptimized sizes="1000px" className={s.poster} />}
                    <canvas ref={drawCanvasRef} width={1600} height={900} className={drawTool === "select" ? s.drawCanvasSelect : undefined} aria-label={c("templates.edit.draw.canvasLabel")} onPointerDown={startDrawing} onPointerMove={continueDrawing} onPointerUp={finishDrawing} onPointerCancel={() => { drawingRef.current = false; }} />
                  </div>
                  {drawStage === "video" && <div className={s.drawTimeline}><span /><small>00:01 / 00:10</small></div>}
                </div>
                <div className={s.drawEditorFooter}>
                  <div className={s.drawModelWrap}>
                    <button type="button" className={s.drawModel} aria-expanded={modelMenuOpen} onClick={() => setModelMenuOpen((value) => !value)}><AudioLines size={16} />{drawModel}<ChevronDown size={13} /></button>
                    {modelMenuOpen && <div className={s.drawModelMenu}>{["MiniMax H3", "Seedance 2.5", "Seedance 2.5 Edit"].map((model) => <button key={model} type="button" aria-pressed={drawModel === model} onClick={() => { setDrawModel(model); setModelMenuOpen(false); }}>{model}{drawModel === model && <Check size={14} />}</button>)}</div>}
                  </div>
                  <div className={s.drawTools} aria-label={c("templates.edit.draw.tools")}>
                    {([{ id: "select", Icon: MousePointer2 }, { id: "pen", Icon: Pencil }, { id: "eraser", Icon: Eraser }, { id: "arrow", Icon: ArrowUpRight }, { id: "shape", Icon: Square }, { id: "image", Icon: ImagePlus }, { id: "text", Icon: Type }] as const).map(({ id, Icon }) => (
                      <button key={id} type="button" aria-pressed={drawTool === id} onClick={() => id === "image" ? (setAssetReturnStage(drawStage), setAssetTab("uploads"), setDrawStage("assets")) : setDrawTool(id)} aria-label={c(`templates.edit.draw.tool.${id}` as StudioCopyKey)}><Icon size={17} /></button>
                    ))}
                    <button type="button" onClick={() => { const context = drawCanvasRef.current?.getContext("2d"); context?.clearRect(0, 0, drawCanvasRef.current?.width ?? 0, drawCanvasRef.current?.height ?? 0); }} aria-label={c("templates.edit.draw.clear")}><Trash2 size={16} /></button>
                  </div>
                  <label className={s.drawPrompt}><input value={drawPrompt} onChange={(event) => setDrawPrompt(event.target.value)} placeholder={c("templates.edit.draw.promptPlaceholder")} /></label>
                  <select className={s.drawAspect} value={drawAspect} onChange={(event) => setDrawAspect(event.target.value)} aria-label={c("templates.edit.setting.aspectRatio")}><option>16:9</option><option>9:16</option><option>1:1</option></select>
                  <button type="button" className={s.drawGenerate}><Sparkles size={15} />{c("templates.edit.generate")} · 10</button>
                </div>
              </div>
            )}

            {drawStage === "assets" && (
              <section className={s.drawAssets}>
                <header><div><button type="button" aria-pressed={assetTab === "uploads"} onClick={() => setAssetTab("uploads")}>{c("templates.edit.draw.assets.uploads")}</button><button type="button" aria-pressed={assetTab === "generations"} onClick={() => setAssetTab("generations")}>{c("templates.edit.draw.assets.generations")}</button></div><button type="button" onClick={() => setDrawStage(assetReturnStage)} aria-label={c("templates.edit.draw.close")}><X size={16} /></button></header>
                <div className={s.drawAssetsToolbar}><strong>{c(assetTab === "uploads" ? "templates.edit.draw.assets.uploads" : "templates.edit.draw.assets.generations")}</strong><button type="button"><SlidersHorizontal size={14} />{c("templates.filterAction")}</button></div>
                {assetTab === "uploads" && drawAsset ? <button type="button" className={s.drawAssetTile} onClick={() => setDrawStage(drawAsset.type === "video" ? "video" : "canvas")}>
                  {drawAsset.type === "image" ? <Image src={drawAsset.url} alt="" fill unoptimized sizes="180px" className={s.poster} /> : <Video size={28} />}
                  <span>{drawAsset.name}</span>
                </button> : <div className={s.drawAssetsEmpty}>{c("templates.edit.draw.assets.empty")}</div>}
                {assetTab === "uploads" && <button type="button" className={s.drawAssetsUpload} onClick={() => { setAgreement({ rights: false, terms: false }); setAssetReturnStage("assets"); setDrawStage("agreement"); }}><Plus size={16} />{c("templates.edit.draw.upload")}</button>}
              </section>
            )}

            {drawStage === "agreement" && (
              <section className={s.drawAgreement}>
                <button type="button" className={s.drawAgreementClose} onClick={() => setDrawStage(assetReturnStage)} aria-label={c("templates.edit.draw.close")}><X size={17} /></button>
                <h2>{c("templates.edit.draw.agreement.title")}</h2>
                <p>{c("templates.edit.draw.agreement.intro")}</p>
                <label><input type="checkbox" checked={agreement.rights} onChange={(event) => setAgreement((value) => ({ ...value, rights: event.target.checked }))} />{c("templates.edit.draw.agreement.rights")}</label>
                <label><input type="checkbox" checked={agreement.terms} onChange={(event) => setAgreement((value) => ({ ...value, terms: event.target.checked }))} />{c("templates.edit.draw.agreement.consent")}</label>
                <div><button type="button" onClick={() => setDrawStage(assetReturnStage)}>{c("templates.edit.draw.agreement.cancel")}</button><button type="button" disabled={!agreement.rights || !agreement.terms} onClick={() => { setDrawStage(assetReturnStage); drawFileRef.current?.click(); }}>{c("templates.edit.draw.agreement.continue")}</button></div>
              </section>
            )}
          </div>
          <button type="button" className={s.drawBackdrop} onClick={() => setDrawOpen(false)} aria-label={c("templates.edit.draw.close")} />
        </div>,
        document.body,
      )}
    </>
  );
}

/** An address on this site (a kept file), which the page can read as a file. */
const sameOrigin = (address: string) => /^\/(?!\/)/.test(address);
/** The images a template starts from, in the order its maker used them. */
function inputImagesOf(t?: Template): string[] {
  const settings = t?.settings ?? {};
  const list = Array.isArray(settings.inputImages) ? settings.inputImages : Array.isArray(settings.sourceImages) ? settings.sourceImages : [];
  const single = typeof settings.sourceImage === "string" ? [settings.sourceImage] : [];
  return [...new Set([...list, ...single].filter((address): address is string => typeof address === "string" && valid(address)))].slice(0, 5);
}
/** The clip a motion or swap template works from: the one its maker used, else the template's own clip. */
function referenceVideoOf(t?: Template): string | undefined {
  const own = t?.settings?.sourceVideo;
  if (typeof own === "string" && valid(own)) return own;
  return t && valid(t.previewUrl) ? t.previewUrl : undefined;
}
/** Which of the two motion-mode tools a template was made with. */
const variantOf = (t?: Template): "motion" | "swap" => (t?.settings?.feature === "video-swap" || t?.settings?.variant === "swap" ? "swap" : "motion");
/** Reads the kept images of a template as files, to send again like the visitor's own. What cannot be read is left out. */
async function loadInputFiles(addresses: string[]): Promise<File[]> {
  const files = await Promise.all(
    addresses.filter(sameOrigin).map(async (address, index) => {
      try {
        const response = await fetch(address);
        if (!response.ok) return null;
        const blob = await response.blob();
        if (!["image/png", "image/jpeg", "image/webp"].includes(blob.type)) return null;
        return new File([blob], `template-image-${index + 1}.${blob.type === "image/jpeg" ? "jpg" : blob.type.slice(6)}`, { type: blob.type });
      } catch {
        return null;
      }
    }),
  );
  return files.filter((file): file is File => file !== null);
}
/**
 * The images attached to a panel, up to a limit. A template that has its own input images puts them here when it is opened
 * (and takes them away again when another one is), while the visitor's own images stay.
 */
function useTemplateImages(t: Template | undefined, limit: number, enabled: boolean) {
  const { c } = useStudioCopy();
  const [images, setImages] = useState<AttachedImage[]>([]);
  const [error, setError] = useState<string | undefined>();
  const imagesRef = useRef(images);
  useEffect(() => {
    imagesRef.current = images;
  }, [images]);
  useEffect(() => () => imagesRef.current.forEach((image) => URL.revokeObjectURL(image.url)), []);
  const addresses = enabled ? inputImagesOf(t).join("\n") : "";
  useEffect(() => {
    let alive = true;
    void loadInputFiles(addresses ? addresses.split("\n") : []).then((files) => {
      if (!alive) return;
      const before = imagesRef.current;
      const own = before.filter((image) => !image.fromTemplate);
      before.filter((image) => image.fromTemplate).forEach((image) => URL.revokeObjectURL(image.url));
      const loaded = files.slice(0, Math.max(0, limit - own.length)).map((file) => ({ id: crypto.randomUUID(), file, url: URL.createObjectURL(file), fromTemplate: true }));
      setImages([...own, ...loaded]);
    });
    return () => {
      alive = false;
    };
  }, [addresses, limit]);
  const attach = (list: FileList | null) => {
    if (!list) return;
    // A panel that takes one image swaps it for the new one.
    const next = limit === 1 ? [] : [...images];
    let problem: string | undefined;
    for (const file of Array.from(list)) {
      if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
        problem = c("templates.attach.unsupported");
        continue;
      }
      if (next.length >= limit) {
        problem = c("templates.attach.tooMany");
        break;
      }
      next.push({ id: crypto.randomUUID(), file, url: URL.createObjectURL(file) });
    }
    images.filter((image) => !next.includes(image)).forEach((image) => URL.revokeObjectURL(image.url));
    setImages(next);
    setError(problem);
  };
  const detach = (id: string) => {
    const gone = images.find((image) => image.id === id);
    if (gone) URL.revokeObjectURL(gone.url);
    setImages(images.filter((image) => image.id !== id));
    setError(undefined);
  };
  return { images, attach, detach, error };
}

/**
 * The models the creator offers for one feature, shaped for the model and quality pickers. Nothing is listed until they load
 * (or when the visitor is signed out), and the pickers then fall back to what the templates themselves say.
 */
function useModelPicker(feature: string, enabled = true) {
  const { c } = useStudioCopy();
  const [models, setModels] = useState<GenerationModelOption[]>([]);
  // Whether the list has been asked for and answered, so "no models" is not shown while it loads.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    listGenerationModels(feature)
      .then((list) => {
        if (alive) {
          setModels(list.filter((m) => m.enabled));
          setReady(true);
        }
      })
      .catch(() => {
        if (alive) {
          setModels([]);
          setReady(true);
        }
      });
    return () => {
      alive = false;
    };
  }, [feature, enabled]);
  // Whether the model's qualities are resolutions (720p) or named qualities (low, medium, high).
  const qualityKeyOf = (id: string): "resolution" | "quality" =>
    models.find((m) => m.model === id)?.capabilities.supportedResolutions?.length ? "resolution" : "quality";
  const qualitiesOf = (id: string): string[] => {
    const capabilities = models.find((m) => m.model === id)?.capabilities;
    return capabilities?.supportedResolutions?.length ? capabilities.supportedResolutions : (capabilities?.qualityValues ?? []);
  };
  const options: FlyoutOption[] = models.map((m) => ({
    id: m.model,
    label: m.displayName || m.model,
    chips: qualitiesOf(m.model).slice(0, 4),
    badge: m.isDefault ? c("templates.sortRecommended") : undefined,
  }));
  const labelOf = (id: string) => options.find((o) => o.id === id)?.label ?? id;
  // The aspect ratios the model accepts; empty when it does not say.
  const ratiosOf = (id: string): string[] => {
    const capabilities = models.find((m) => m.model === id)?.capabilities;
    return capabilities?.supportedAspectRatios?.length ? capabilities.supportedAspectRatios : (capabilities?.supportedRatios ?? []);
  };
  // The length to ask for: the wanted one when the model takes it, else the closest it allows (Omni only takes 3 to 10 seconds).
  const durationFor = (id: string, wanted: number): number => {
    const property = models.find((m) => m.model === id)?.capabilities.apiSchema?.request_schema?.properties?.duration;
    const allowed = Array.isArray(property?.enum) ? property.enum.filter((value): value is number => typeof value === "number") : [];
    if (allowed.length) return allowed.includes(wanted) ? wanted : allowed.reduce((best, value) => (Math.abs(value - wanted) < Math.abs(best - wanted) ? value : best));
    if (typeof property?.minimum === "number" && wanted < property.minimum) return property.minimum;
    if (typeof property?.maximum === "number" && wanted > property.maximum) return property.maximum;
    return wanted;
  };
  // Where the model takes reference images, if it does: the parameter name and whether it wants a list.
  const referenceOf = (id: string): { parameter: string; list: boolean } | null => {
    const capabilities = models.find((m) => m.model === id)?.capabilities;
    const properties = capabilities?.apiSchema?.request_schema?.properties ?? {};
    const parameter =
      capabilities?.referenceImagesParameter ??
      capabilities?.imageParameter ??
      Object.keys(properties).find((key) => ["referenceImage", "reference_image", "referenceImages", "reference_images", "image", "image_url"].includes(key));
    return parameter ? { parameter, list: properties[parameter]?.type === "array" } : null;
  };
  // What a swap model can swap (person, object, background), when it has that choice.
  const modesOf = (id: string): string[] => {
    const property = models.find((m) => m.model === id)?.capabilities.apiSchema?.request_schema?.properties?.mode;
    return Array.isArray(property?.enum) ? property.enum.filter((value): value is string => value === "person" || value === "object" || value === "background") : [];
  };
  return { options, ready, qualitiesOf, qualityKeyOf, ratiosOf, durationFor, referenceOf, modesOf, labelOf };
}

/**
 * What a workflow costs in all: the image step plus the video step, each quoted by the creator's own endpoints. Null until
 * both models and qualities are picked, or when either quote cannot be given.
 */
function useWorkflowQuote(
  input: { imageModel: string; imageKey: "resolution" | "quality"; imageQuality: string; imageRatio: string; videoModel: string; videoQuality: string; duration: number; aspectRatio: string } | null,
): number | null {
  const key = JSON.stringify(input);
  const [quote, setQuote] = useState<{ key: string; credits: number } | null>(null);
  useEffect(() => {
    if (!input) return;
    let alive = true;
    const timer = window.setTimeout(() => {
      const imageQuote: ImageCreditQuoteInput = { feature: "text-to-image", model: input.imageModel, ratio: input.imageRatio as ImageCreditQuoteInput["ratio"], count: "1" as ImageCreditQuoteInput["count"], [input.imageKey]: input.imageQuality };
      Promise.all([
        quoteImageGeneration(imageQuote),
        quoteDirectVideoGeneration({ feature: "image-to-video", model: input.videoModel, resolution: input.videoQuality, duration: input.duration, aspectRatio: input.aspectRatio }),
      ])
        .then(([image, video]) => {
          if (alive && typeof image.creditCost === "number" && typeof video.creditCost === "number") setQuote({ key, credits: image.creditCost + video.creditCost });
        })
        .catch(() => {});
    }, 350);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
    // The key stands for the whole input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return quote?.key === key ? quote.credits : null;
}

/**
 * What the creator would charge for the chosen model and quality, from its own quote endpoint. Null until a model is picked or
 * while the answer is on its way (or when the quote cannot be given), so the button then shows no price rather than a guess.
 */
function useCreditQuote(input: Pick<DirectVideoQuoteInput, "feature" | "model" | "aspectRatio"> & { resolution?: string; duration?: number }): number | null {
  const { feature, model, resolution, duration, aspectRatio } = input;
  const key = [feature, model, resolution, duration, aspectRatio].join("|");
  const [quote, setQuote] = useState<{ key: string; credits: number } | null>(null);
  useEffect(() => {
    if (!model) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      quoteDirectVideoGeneration({ feature, model, resolution, duration, aspectRatio }, controller.signal)
        .then((result) => {
          if (typeof result.creditCost === "number") setQuote({ key, credits: result.creditCost });
        })
        .catch(() => {});
    }, 300);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [key, feature, model, resolution, duration, aspectRatio]);
  return quote?.key === key ? quote.credits : null;
}
const creditText = (credits: number | null) => (credits === null ? "" : String(Math.round(credits * 10) / 10));

function MotionWorkspace({ t }: { t?: Template }) {
  const { c, locale } = useStudioCopy();
  // "Motion transfer" moves the clip's motion onto a character; "Objects swap" puts what the images show in place of a person,
  // an object or the background of the clip. A template opens in the tool it was made with.
  const [variant, setVariant] = useState<"motion" | "swap">(variantOf(t));
  const [seen, setSeen] = useState(t?.id);
  if (seen !== t?.id) {
    setSeen(t?.id);
    setVariant(variantOf(t));
  }
  const swapping = variant === "swap";
  const { images, attach, detach, error: attachError } = useTemplateImages(t, swapping ? 4 : 1, true);
  const [sending, setSending] = useState<{ state: "idle" | "busy" | "sent" | "error"; message?: string }>({ state: "idle" });
  const [sceneControl, setSceneControl] = useState(true);
  const [sceneSource, setSceneSource] = useState<"video" | "image">("video");
  // What was picked in each tool; until something is picked, the model, quality and swap target of the template stand.
  const [picked, setPicked] = useState<Record<"motion" | "swap", { model: string; quality: string; swapMode: string }>>({
    motion: { model: "", quality: "", swapMode: "" },
    swap: { model: "", quality: "", swapMode: "" },
  });
  const motionPicker = useModelPicker("motion-transfer");
  const swapPicker = useModelPicker("video-swap");
  const picker = swapping ? swapPicker : motionPicker;
  const mine = picked[variant];
  const own = t && variantOf(t) === variant ? (t.settings ?? {}) : {};
  const model = mine.model || (typeof own.model === "string" && picker.options.some((option) => option.id === own.model) ? own.model : "");
  const qualityChoices = picker.qualitiesOf(model).length ? picker.qualitiesOf(model) : ["720p", "1080p"];
  const ownQuality = [own.quality, own.resolution].find((value): value is string => typeof value === "string");
  const quality = mine.quality || (ownQuality && qualityChoices.includes(ownQuality) ? ownQuality : "");
  const swapModes = swapping ? picker.modesOf(model) : [];
  const swapMode = mine.swapMode || (typeof own.swapMode === "string" && swapModes.includes(own.swapMode) ? own.swapMode : (swapModes[0] ?? ""));
  const pick = (patch: Partial<typeof mine>) => setPicked({ ...picked, [variant]: { ...mine, ...patch } });
  const credits = useCreditQuote({ feature: swapping ? "video-swap" : "motion-transfer", model, resolution: quality || undefined });
  const inputRef = useRef<HTMLInputElement>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const reference = referenceVideoOf(t);
  const qualityOptions: FlyoutOption[] = qualityChoices.map((label) => ({ id: label, label }));
  // A model with a single image field uses the first image only.
  const firstOnly = swapping && images.length > 1 && !!model && !swapPicker.referenceOf(model)?.list;
  // Generates right here: the images and the clip go up as files, then the same request the creator page sends; the app's
  // progress panel follows the job to the result (it names a swap like a motion transfer).
  const generate = async () => {
    if (!images.length) return setSending({ state: "error", message: c(swapping ? "templates.swap.needImage" : "templates.motion.needCharacter") });
    if (!t || !reference) return setSending({ state: "error", message: c("templates.motion.needReference") });
    if (!model) return setSending({ state: "error", message: c("templates.composer.pickModel") });
    if (!quality) return setSending({ state: "error", message: c("templates.composer.pickQuality") });
    const requestId = crypto.randomUUID();
    setSending({ state: "busy" });
    emitGenerationSubmitting({ feature: "motion-transfer", requestId });
    try {
      const uploaded = await Promise.all(images.map((image) => uploadImageAsset(image.file, { purpose: "content", feature: "motion-transfer" })));
      let video: string = reference;
      if (!/^https?:\/\//i.test(video)) {
        const response = await fetch(video);
        if (!response.ok) throw new Error(c("templates.motion.referenceFailed"));
        const blob = await response.blob();
        video = await uploadImageAsset(new File([blob], `${t.slug}.${blob.type.includes("webm") ? "webm" : "mp4"}`, { type: blob.type || "video/mp4" }), { purpose: "content", feature: "motion-transfer" });
      }
      const instruction = (promptRef.current?.value ?? "").trim();
      const created = swapping
        ? await createVideoSwapGeneration({
            sourceVideo: video,
            sourceImages: uploaded,
            inputImages: uploaded,
            model,
            resolution: quality,
            templateSlug: t.slug,
            ...(swapMode ? { swapMode: swapMode as "person" | "object" | "background" } : {}),
            ...(instruction ? { prompt: instruction } : {}),
          })
        : await createMotionTransferGeneration({
            sourceImage: uploaded[0],
            motionVideo: video,
            model,
            quality,
            templateSlug: t.slug,
            ...(sceneControl ? { characterOrientation: sceneSource } : {}),
          });
      if (created.workspaceId) window.sessionStorage.setItem("eos.generation.workspace-id", created.workspaceId);
      const generationId = created.generationId ?? created.id;
      const pollUrl = created.pollUrl ?? (generationId ? `/generations/${encodeURIComponent(generationId)}/status` : "");
      if (generationId && pollUrl) {
        emitGenerationStarted({ feature: "motion-transfer", requestId, generationId, pollUrl, workspaceId: created.workspaceId, model, status: created.status === "processing" ? "processing" : "queued" });
      }
      setSending({ state: "sent", message: c("templates.composer.sent") });
    } catch (error) {
      emitGenerationRequestFailed({ feature: "motion-transfer", requestId });
      setSending({ state: "error", message: formatGenerationError(error, c("templates.composer.generateFailed")) });
    }
  };
  return (
    <>
      <div className={s.switch} role="group">
        {(
          [
            ["motion", "templates.composer.motionTransfer"],
            ["swap", "templates.composer.objectsSwap"],
          ] as const
        ).map(([id, key]) => (
          <button key={id} type="button" aria-pressed={variant === id} onClick={() => { setVariant(id); setSending({ state: "idle" }); }}>
            {c(key)}
          </button>
        ))}
      </div>
      <div className={s.motionAssets}>
        <div className={s.motionReference}>
          {t && valid(t.thumbnailUrl) ? <Image src={t.thumbnailUrl} alt={name(t, locale)} fill unoptimized sizes="140px" className={s.poster} /> : <Video size={22} />}
          <span>{t ? (swapping ? c("templates.swap.videoLabel") : name(t, locale)) : c("templates.motion.reference")}</span>
          <button type="button" aria-label={c("templates.card.previewAria", { name: t ? name(t, locale) : c("templates.motion.reference") })} onClick={() => t && window.open(reference || t.thumbnailUrl, "_blank", "noopener,noreferrer")}><Expand size={13} /></button>
        </div>
        <button type="button" className={s.motionCharacter} onClick={() => inputRef.current?.click()}>
          {images[0] ? (
            <Image src={images[0].url} alt={c("templates.motion.character")} fill unoptimized sizes="140px" className={s.poster} />
          ) : (
            <>
              <Plus size={20} />
              <strong>{c(swapping ? "templates.swap.addImages" : "templates.motion.addCharacter")}</strong>
              <small>{c(swapping ? "templates.swap.imagesHint" : "templates.motion.characterHint")}</small>
            </>
          )}
        </button>
      </div>
      <input
        ref={inputRef}
        className={s.visuallyHidden}
        type="file"
        multiple={swapping}
        accept="image/png,image/jpeg,image/webp"
        onChange={(event) => {
          attach(event.currentTarget.files);
          setSending({ state: "idle" });
          event.currentTarget.value = "";
        }}
      />
      {(swapping || attachError || images.some((image) => image.fromTemplate)) && (
        <div className={s.motionThumbs}>
          {swapping && images.map((image) => (
            <span key={image.id} className={`${s.slotFile} ${image.fromTemplate ? s.slotFromTemplate : ""}`} title={image.file.name}>
              <Image src={image.url} alt={image.file.name} fill unoptimized sizes="46px" />
              <button type="button" className={s.slotRemove} aria-label={c("templates.attach.remove")} onClick={() => detach(image.id)}>
                <X size={11} aria-hidden="true" />
              </button>
            </span>
          ))}
          {swapping && images.length > 0 && images.length < 4 && (
            <button type="button" className={s.slotAdd} onClick={() => inputRef.current?.click()} aria-label={c("templates.attach.add")}>
              <Plus size={18} aria-hidden="true" />
            </button>
          )}
          <small className={attachError ? s.sendError : undefined} role={attachError ? "alert" : undefined}>
            {attachError ?? (firstOnly ? c("templates.swap.firstOnly") : images.some((image) => image.fromTemplate) ? c("templates.attach.fromTemplate") : "")}
          </small>
        </div>
      )}
      {swapping && swapPicker.ready && swapPicker.options.length === 0 && <p className={s.sendError} role="alert">{c("templates.swap.noModels")}</p>}
      <PickerRow label={c("templates.edit.setting.model")} value={model ? picker.labelOf(model) : c("templates.composer.pickModel")} placeholder={!model} heading={c("templates.composer.featuredModels")} empty={c("templates.composer.noModels")} options={picker.options} selectedId={model} onPick={(id) => pick({ model: id, quality: "", swapMode: "" })} />
      <PickerRow label={c("templates.edit.setting.quality")} value={quality || c("templates.composer.pickQuality")} placeholder={!quality} heading={c("templates.edit.setting.quality")} empty={c("templates.composer.noModels")} options={qualityOptions} selectedId={quality} onPick={(id) => pick({ quality: id })} />
      {swapping ? (
        <>
          {swapModes.length > 0 && (
            <section className={s.motionSceneControl} data-scene-enabled="true" style={{ height: "auto" }}>
              <strong>{c("templates.swap.modeLabel")}</strong>
              <div className={s.motionSourceTabs} role="group" aria-label={c("templates.swap.modeLabel")}>
                {swapModes.map((id) => (
                  <button key={id} type="button" aria-pressed={swapMode === id} onClick={() => pick({ swapMode: id })}>
                    {c(`templates.swap.mode.${id}` as StudioCopyKey)}
                  </button>
                ))}
              </div>
            </section>
          )}
          <textarea
            key={`${t?.id}-${locale}`}
            ref={promptRef}
            className={s.composerPrompt}
            defaultValue={t && variantOf(t) === "swap" ? promptOf(t, locale) : ""}
            placeholder={c("templates.swap.promptPlaceholder")}
            aria-label={c("templates.composer.prompt")}
          />
        </>
      ) : (
        <>
          <section className={s.motionSceneControl} data-scene-enabled={sceneControl}>
            <button type="button" role="switch" aria-checked={sceneControl} onClick={() => setSceneControl((value) => !value)}>
              <strong>{c("templates.motion.sceneControl")}</strong><i />
            </button>
            {sceneControl ? <>
              <div className={s.motionSourceTabs} role="group" aria-label={c("templates.motion.sourceAria")}>
                {(["video", "image"] as const).map((source) => <button key={source} type="button" aria-pressed={sceneSource === source} onClick={() => setSceneSource(source)}>{source === "video" ? <Video size={13} /> : <ImagePlus size={13} />}{c(source === "video" ? "templates.motion.sourceVideo" : "templates.motion.sourceImage")}</button>)}
              </div>
              <p>{c("templates.motion.sceneHint")}</p>
            </> : <p>{c("templates.motion.sceneDisabledHint")}</p>}
          </section>
          <details className={s.composerAdvanced}>
            <summary>{c("templates.composer.advanced")}<ChevronDown size={15} aria-hidden="true" /></summary>
            <dl className={s.composerFacts}>
              <div><dt>{c("templates.motion.setting.motionStrength")}</dt><dd>100%</dd></div>
              <div><dt>{c("templates.motion.setting.camera")}</dt><dd>{c("templates.motion.setting.followReference")}</dd></div>
            </dl>
          </details>
        </>
      )}
      <div className={s.motionGenerateDock}>
        <button type="button" disabled={sending.state === "busy"} onClick={() => void generate()}>
          {sending.state === "busy" ? c("templates.composer.sending") : c("templates.edit.generate")} <Sparkles size={15} />{creditText(credits)}
        </button>
        {sending.message && <p role={sending.state === "error" ? "alert" : "status"} className={sending.state === "error" ? s.sendError : s.sendNote}>{sending.message}</p>}
      </div>
    </>
  );
}

/**
 * A row (label, value, chevron) that opens a floating list to the right of the panel, like the model and quality pickers of
 * a creation panel: an optional search box, a heading, the choices with a tick on the chosen one.
 */
function PickerRow({
  label,
  value,
  placeholder,
  badge,
  heading,
  searchPlaceholder,
  empty,
  options,
  selectedId,
  onPick,
}: {
  label: string;
  value: string;
  /** The value is only a prompt to choose, so it is shown dimmed. */
  placeholder?: boolean;
  /** The small tag after the value (and its icon), for example "New". */
  badge?: string;
  heading: string;
  /** When given, the list has a search box. */
  searchPlaceholder?: string;
  empty: string;
  options: FlyoutOption[];
  selectedId: string;
  onPick: (id: string) => void;
}) {
  const rowRef = useRef<HTMLButtonElement>(null);
  const [anchor, setAnchor] = useState<{ top: number; left: number; maxHeight: number } | null>(null);
  const [query, setQuery] = useState("");
  useEffect(() => {
    if (!anchor) return;
    const close = () => setAnchor(null);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
    };
  }, [anchor]);
  const open = () => {
    const rect = rowRef.current?.getBoundingClientRect();
    if (!rect) return;
    const maxHeight = Math.min(460, window.innerHeight - 24);
    // To the right of the panel, level with the row but kept inside the window.
    const top = Math.max(12, Math.min(rect.top - (searchPlaceholder ? 120 : 40), window.innerHeight - maxHeight - 12));
    setQuery("");
    setAnchor({ top, left: rect.right + 10, maxHeight });
  };
  const needle = query.trim().toLowerCase();
  const listed = options.filter((o) => !needle || o.label.toLowerCase().includes(needle));
  const list: ReactNode = (
    <ul>
      {listed.map((o) => (
        <li key={o.id}>
          <button
            type="button"
            aria-current={o.id === selectedId ? "true" : undefined}
            onClick={() => {
              onPick(o.id);
              setAnchor(null);
            }}
          >
            <span className={s.flyCopy}>
              <strong>
                <span>{o.label}</span>
                {o.badge && <em>{o.badge}</em>}
              </strong>
              {o.chips && o.chips.length > 0 && (
                <small>
                  {o.chips.map((chip) => (
                    <i key={chip}>{chip}</i>
                  ))}
                </small>
              )}
            </span>
            {o.id === selectedId && <Check size={16} aria-hidden="true" />}
          </button>
        </li>
      ))}
      {listed.length === 0 && <li className={s.flyEmpty}>{empty}</li>}
    </ul>
  );
  return (
    <>
      <button ref={rowRef} type="button" className={s.composerRow} aria-expanded={anchor !== null} onClick={open}>
        <span>
          <small>{label}</small>
          <strong>
            <span className={`${s.rowValue} ${placeholder ? s.rowPlaceholder : ""}`}>{value}</span>
            {badge && (
              <>
                <Sparkles size={13} aria-hidden="true" />
                <em>{badge}</em>
              </>
            )}
          </strong>
        </span>
        <ChevronRight size={16} aria-hidden="true" />
      </button>
      {anchor &&
        createPortal(
          <>
            <button type="button" className={s.flyBackdrop} aria-label={heading} onClick={() => setAnchor(null)} />
            <div className={s.flyout} style={{ top: anchor.top, left: anchor.left, maxHeight: anchor.maxHeight }}>
              {searchPlaceholder && (
                <label className={s.flySearch}>
                  <Search size={16} aria-hidden="true" />
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={searchPlaceholder} autoFocus />
                </label>
              )}
              <span className={s.flyHeading}>{heading}</span>
              {list}
            </div>
          </>,
          document.body,
        )}
    </>
  );
}

/**
 * The control column, laid out like a creation panel: type tabs, the chosen template as a card, its prompt, the model and
 * quality rows, the rest of the settings folded under "Advanced", and the button that opens it in the creator.
 */
/** An image attached in the optional card, with its preview address. */
type AttachedImage = { id: string; file: File; url: string; /** Put there by a template, not picked by the visitor. */ fromTemplate?: boolean };

function Composer({
  t,
  mode,
  onMode,
  options,
  onSelect,
  onClear,
  style,
  onChangeStyle,
  onClearStyle,
  onUse,
  onExpand,
}: {
  t?: Template;
  mode: Mode;
  onMode: (mode: Mode) => void;
  /** The look picked in the Styles tab, if any. */
  style: StyleChoice | null;
  onChangeStyle: () => void;
  onClearStyle: () => void;
  /** Every template of this mode, for the "change" list. */
  options: Template[];
  onSelect: (id: string) => void;
  /** Takes the chosen template off the panel (the cross on its card). */
  onClear: () => void;
  onUse: (t: Template) => void;
  onExpand: (t: Template) => void;
}) {
  const { c, locale } = useStudioCopy();
  const [picking, setPicking] = useState(false);
  const [pickingEditTool, setPickingEditTool] = useState(false);
  const [editToolId, setEditToolId] = useState<EditToolId | null>(null);
  const [pickQuery, setPickQuery] = useState("");
  const [showPrompt, setShowPrompt] = useState(true);
  const [useFree, setUseFree] = useState(false);
  // What was picked in the two lists; for now it only changes what the rows show.
  const [picks, setPicks] = useState<{ templateId: string; model?: string; quality?: string }>({ templateId: "" });
  // A workflow template runs two steps on the server (an image, then a video from it), each with its own model and quality.
  const isWorkflow = t?.settings?.feature === workflowFeature;
  const picker = useModelPicker(mode === "motion" ? "motion-transfer" : mode === "edit" ? "extend-video" : "text-to-video", !isWorkflow);
  const imagePicker = useModelPicker("text-to-image", isWorkflow);
  const videoPicker = useModelPicker("image-to-video", isWorkflow);
  const [flow, setFlow] = useState({ imageModel: "", imageQuality: "", videoModel: "", videoQuality: "" });
  // The models the template was set up with start the two steps until the visitor picks others.
  const flowImageModel = flow.imageModel || (typeof t?.settings?.imageModel === "string" ? t.settings.imageModel : "");
  const flowVideoModel = flow.videoModel || (typeof t?.settings?.model === "string" ? t.settings.model : "");
  // Reference images attached in the optional card (up to five), sent with the video request when the model takes them.
  // The images a template was made with start in it.
  const { images, attach: attachImages, detach, error: attachError } = useTemplateImages(t, 5, !isWorkflow);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attach = (list: FileList | null) => {
    attachImages(list);
    setSending({ state: "idle" });
  };
  // The price follows the model and quality the panel shows: picked here, else the template's own.
  const quoteModel = t && picks.templateId === t.id && picks.model ? picks.model : typeof t?.settings?.model === "string" ? t.settings.model : "";
  const quoteQuality = t && picks.templateId === t.id && picks.quality ? picks.quality : typeof t?.settings?.resolution === "string" ? t.settings.resolution : undefined;
  // The creator's own defaults when the template does not say: 5 seconds, 16:9.
  const wantedDuration = typeof t?.settings?.duration === "number" ? t.settings.duration : 5;
  const wantedRatio = typeof t?.settings?.ratio === "string" ? t.settings.ratio : typeof t?.settings?.aspectRatio === "string" ? t.settings.aspectRatio : "16:9";
  // A template made from another model's clip can name a ratio this model refuses (21:9 on Omni); use one it accepts.
  const duration = picker.durationFor(quoteModel, wantedDuration);
  const modelRatios = picker.ratiosOf(quoteModel);
  const aspectRatio = modelRatios.length && !modelRatios.includes(wantedRatio) ? (modelRatios.includes("16:9") ? "16:9" : modelRatios[0]) : wantedRatio;
  const credits = useCreditQuote({ feature: "text-to-video", model: mode === "create" ? quoteModel : "", resolution: quoteQuality, duration, aspectRatio });
  const imageRatio = ["1:1", "16:9", "4:3", "3:4", "9:16"].includes(wantedRatio) ? wantedRatio : "16:9";
  const flowVideoRatios = videoPicker.ratiosOf(flowVideoModel);
  const videoRatio = flowVideoRatios.length && !flowVideoRatios.includes(imageRatio) ? (flowVideoRatios.includes("16:9") ? "16:9" : (flowVideoRatios[0] ?? imageRatio)) : imageRatio;
  const workflowCredits = useWorkflowQuote(
    isWorkflow && flowImageModel && flow.imageQuality && flowVideoModel && flow.videoQuality
      ? { imageModel: flowImageModel, imageKey: imagePicker.qualityKeyOf(flowImageModel), imageQuality: flow.imageQuality, imageRatio, videoModel: flowVideoModel, videoQuality: flow.videoQuality, duration: videoPicker.durationFor(flowVideoModel, wantedDuration), aspectRatio: videoRatio }
      : null,
  );
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const [sending, setSending] = useState<{ state: "idle" | "busy" | "sent" | "error"; message?: string }>({ state: "idle" });
  // Generates right here: the same request the creator page sends, then the app's progress panel follows it to the result.
  const generate = async (template: Template, model: string, resolution: string) => {
    const prompt = (promptRef.current?.value ?? "").trim();
    if (!prompt) return setSending({ state: "error", message: c("templates.composer.needPrompt") });
    if (!model) return setSending({ state: "error", message: c("templates.composer.pickModel") });
    if (!resolution) return setSending({ state: "error", message: c("templates.composer.pickQuality") });
    const reference = picker.referenceOf(model);
    if (images.length && !reference) {
      // Say which models do take them, so the fix is one pick away.
      const capable = picker.options.filter((o) => picker.referenceOf(o.id)).map((o) => o.label).join(", ");
      return setSending({ state: "error", message: c("templates.attach.noReference", { models: capable || "-" }) });
    }
    const requestId = crypto.randomUUID();
    setSending({ state: "busy" });
    emitGenerationSubmitting({ feature: "text-to-video", requestId });
    try {
      const request: TextVideoGenerationInput = { prompt, model, resolution, duration, aspectRatio, templateSlug: template.slug };
      if (images.length && reference) {
        const urls = await Promise.all(images.map((image) => uploadImageAsset(image.file, { purpose: "content", feature: "text-to-video" })));
        // Model-specific inputs go in modelParams: the server only forwards those to the model (a top-level field is dropped).
        request.modelParams = { ...(request.modelParams ?? {}), [reference.parameter]: reference.list ? urls : urls[0] };
        // Kept with the clip, so it can become a template with the images it was made from.
        request.inputImages = urls;
      }
      const created = await createTextVideoGeneration(request);
      if (created.workspaceId) window.sessionStorage.setItem("eos.generation.workspace-id", created.workspaceId);
      const generationId = created.generationId ?? created.id;
      const pollUrl = created.pollUrl ?? (generationId ? `/generations/${encodeURIComponent(generationId)}/status` : "");
      if (generationId && pollUrl) {
        emitGenerationStarted({ feature: "text-to-video", requestId, generationId, pollUrl, workspaceId: created.workspaceId, model, status: created.status === "processing" ? "processing" : "queued" });
      }
      onUse(template);
      setSending({ state: "sent", message: c("templates.composer.sent") });
    } catch (error) {
      emitGenerationRequestFailed({ feature: "text-to-video", requestId });
      setSending({ state: "error", message: formatGenerationError(error, c("templates.composer.generateFailed")) });
    }
  };
  const generateWorkflow = async (template: Template) => {
    const prompt = (promptRef.current?.value ?? "").trim();
    if (!prompt) return setSending({ state: "error", message: c("templates.composer.needPrompt") });
    if (!flowImageModel || !flow.imageQuality) return setSending({ state: "error", message: c("templates.workflow.pickImage") });
    if (!flowVideoModel || !flow.videoQuality) return setSending({ state: "error", message: c("templates.workflow.pickVideo") });
    setSending({ state: "busy" });
    try {
      await startTemplateWorkflow({
        templateSlug: template.slug,
        prompt,
        image: { model: flowImageModel, [imagePicker.qualityKeyOf(flowImageModel)]: flow.imageQuality, ratio: imageRatio },
        video: { model: flowVideoModel, resolution: flow.videoQuality, duration: videoPicker.durationFor(flowVideoModel, wantedDuration), aspectRatio: videoRatio },
      });
      window.dispatchEvent(new Event(workflowEvent));
      onUse(template);
      setSending({ state: "sent", message: c("templates.workflow.sent") });
    } catch (error) {
      setSending({ state: "error", message: formatGenerationError(error, c("templates.composer.generateFailed")) });
    }
  };
  const tabs = (
    <div className={s.composerTabs} role="tablist" aria-label={c("templates.mode.aria")}>
      {modes.map((m) => (
        <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => onMode(m)}>
          {c(modeKeys[m])}
        </button>
      ))}
    </div>
  );
  const needle = pickQuery.trim().toLowerCase();
  const listed = options.filter((o) => !needle || `${name(o, locale)} ${o.category} ${o.format}`.toLowerCase().includes(needle));
  const activeEditTool = editTools.find(({ id }) => id === editToolId) ?? editTools[0];
  const banner = (
    <div className={s.composerHeroWrap}>
      <div
        className={`${s.composerHero}${mode === "edit" ? ` ${s.editComposerHero}` : ""}`}
        style={t && valid(t.thumbnailUrl) ? { backgroundImage: `url("${t.thumbnailUrl}")` } : undefined}
      >
        <strong>{c(mode === "edit" ? editToolId ? activeEditTool.title : "templates.edit.list.title" : modeKeys[mode])}</strong>
        <small>{c(mode === "edit" ? editToolId ? activeEditTool.desc : "templates.edit.list.desc" : heroKeys[mode].tag)}</small>
      </div>
      {(options.length > 0 || mode === "edit") && (
        <button
          type="button"
          className={s.composerHeroChange}
          aria-expanded={mode === "edit" ? pickingEditTool : picking}
          onClick={() => mode === "edit" ? setPickingEditTool((v) => !v) : setPicking((v) => !v)}
        >
          {c("templates.composer.pick")}
        </button>
      )}
      {pickingEditTool && mode === "edit" && (
        <>
          <button type="button" className={s.pickerBackdrop} aria-label={c("templates.composer.closePicker")} onClick={() => setPickingEditTool(false)} />
          <div className={s.picker}>
            <span className={s.pickerHeading}>{c("templates.edit.tools.heading")}</span>
            <ul>
              {editTools.map(({ id, icon: Icon, title, desc, isNew }) => (
                <li key={id}>
                  <button type="button" aria-current={id === editToolId ? "true" : undefined} onClick={() => { setEditToolId(id); setPickingEditTool(false); }}>
                    <span className={s.editPickerIcon}><Icon size={17} /></span>
                    <span className={s.pickerCopy}><strong>{c(title)}{isNew && <em>{c("templates.tab.new")}</em>}</strong><small>{c(desc)}</small></span>
                    {id === editToolId && <Check size={16} aria-hidden="true" />}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
      {picking && mode !== "edit" && (
        <>
          <button type="button" className={s.pickerBackdrop} aria-label={c("templates.composer.closePicker")} onClick={() => setPicking(false)} />
          <div className={s.picker}>
            <label className={s.pickerSearch}>
              <Search size={15} aria-hidden="true" />
              <input value={pickQuery} onChange={(e) => setPickQuery(e.target.value)} placeholder={c("templates.picker.search")} autoFocus />
            </label>
            <span className={s.pickerHeading}>{c("templates.picker.heading")}</span>
            <ul>
              {listed.map((o) => (
                <li key={o.id}>
                  <button
                    type="button"
                    aria-current={o.id === t?.id ? "true" : undefined}
                    onClick={() => {
                      onSelect(o.id);
                      setPicking(false);
                    }}
                  >
                    <span
                      className={s.pickerThumb}
                      style={valid(o.thumbnailUrl) ? { backgroundImage: `url("${o.thumbnailUrl}")` } : undefined}
                      aria-hidden="true"
                    />
                    <span className={s.pickerCopy}>
                      <strong>{name(o, locale)}</strong>
                      <small>
                        {c(kindKeys[o.kind])} · {o.category} · {o.format}
                      </small>
                    </span>
                    {o.id === t?.id && <Check size={16} aria-hidden="true" />}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
  // As in the example: a row that applies a style (the layout only for now).
  const styleRow = (
    <div className={s.styleRow}>
      <span
        className={s.styleThumb}
        style={style ? { backgroundImage: `url("${style.imageUrl}")` } : undefined}
        aria-hidden="true"
      />
      <span className={s.styleName}>
        <small>{c("templates.composer.style")}</small>
        <strong>{style ? style.name : c("templates.composer.styleNone")}</strong>
      </span>
      <button type="button" className={s.styleChange} onClick={onChangeStyle}>
        {c("templates.composer.styleChange")}
      </button>
      {style && (
        <button type="button" className={s.styleClear} aria-label={c("templates.styles.remove")} onClick={onClearStyle}>
          <X size={14} aria-hidden="true" />
        </button>
      )}
    </div>
  );
  if (mode === "motion")
    return (
      <aside className={s.composer} aria-label={c("templates.composer.aria")}>
        {tabs}
        {banner}
        <MotionWorkspace t={t} />
      </aside>
    );
  if (mode === "edit" && !editToolId)
    return (
      <aside className={s.composer} aria-label={c("templates.composer.aria")}>
        {tabs}
        {banner}
        <ul className={s.toolList}>
          {editTools.map(({ id, icon: Icon, title, desc, isNew }) => (
            <li key={id}>
              <button type="button" className={s.toolRow} onClick={() => setEditToolId(id)}>
                <Icon size={20} aria-hidden="true" />
                <span>
                  <strong>{c(title)}{isNew && <em>{c("templates.tab.new")}</em>}</strong>
                  <small>{c(desc)}</small>
                </span>
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      </aside>
    );
  if (mode === "edit" && editToolId)
    return (
      <aside className={s.composer} aria-label={c("templates.composer.aria")}>
        {tabs}
        {banner}
        <button type="button" className={s.editBack} onClick={() => setEditToolId(null)}><ChevronLeft size={15} />{c("templates.edit.tools.heading")}</button>
        <EditWorkspace tool={editToolId} poster={t?.thumbnailUrl} />
      </aside>
    );
  if (!t)
    return (
      <aside className={s.composer} aria-label={c("templates.composer.aria")}>
        {tabs}
        {banner}
        {styleRow}
        <p className={s.composerEmpty}>{c("templates.composer.empty")}</p>
      </aside>
    );
  const facts = presetFacts(t, c);
  const primary = facts.filter((f) => f.key === "model" || f.key === "resolution");
  const advanced = facts.filter((f) => f.key !== "model" && f.key !== "resolution");
  // Models and qualities seen in the templates, each with the details of the first template that uses it.
  const modelMap = new Map<string, FlyoutOption>();
  for (const o of [t, ...options]) {
    const settings = o.settings ?? {};
    const model = typeof settings.model === "string" ? settings.model : typeof settings.modelId === "string" ? settings.modelId : "";
    if (!model) continue;
    const entry = modelMap.get(model) ?? { id: model, label: model, chips: [] as string[] };
    if (o.featured && !entry.badge) entry.badge = c("templates.sortRecommended");
    for (const extra of [settings.resolution, typeof settings.duration === "number" ? c("templates.preview.seconds", { value: settings.duration }) : undefined]) {
      if ((typeof extra === "string" || typeof extra === "number") && !entry.chips?.includes(String(extra))) entry.chips?.push(String(extra));
    }
    modelMap.set(model, entry);
  }
  // The creator's own list of models when it loads; until then, the ones the templates mention.
  const baseModels = picker.options.length ? picker.options : [...modelMap.values()];
  // With images attached, the models that take them come first and are marked, so the right one is easy to pick.
  const modelOptions = images.length
    ? [...baseModels]
        .sort((a, b) => Number(!!picker.referenceOf(b.id)) - Number(!!picker.referenceOf(a.id)))
        .map((o) => (picker.referenceOf(o.id) ? { ...o, chips: [c("templates.attach.accepts"), ...(o.chips ?? [])] } : o))
    : baseModels;
  // Nothing picked and nothing in the template: the rows ask for a choice.
  const shownModel = (picks.templateId === t.id && picks.model) || primary.find((f) => f.key === "model")?.value || "";
  const shownQuality = (picks.templateId === t.id && picks.quality) || primary.find((f) => f.key === "resolution")?.value || "";
  const qualityIds = new Set(picker.qualitiesOf(shownModel).length ? picker.qualitiesOf(shownModel) : ["480p", "720p", "1080p"]);
  for (const o of [t, ...options]) {
    const resolution = o.settings?.resolution;
    if (typeof resolution === "string") qualityIds.add(resolution);
  }
  const qualityOptions: FlyoutOption[] = [...qualityIds].map((id) => ({ id, label: id }));
  return (
    <aside className={s.composer} aria-label={c("templates.composer.aria")}>
      {tabs}
      {banner}
      {styleRow}
      <div className={s.composerStage}>
        <button type="button" className={s.cardClose} onClick={onClear} aria-label={c("templates.composer.remove")}>
          <X size={14} aria-hidden="true" />
        </button>
        <button type="button" className={s.composerCard} onClick={() => onExpand(t)} aria-label={c("templates.card.previewAria", { name: name(t, locale) })}>
          <Media t={t} tile key={t.id + t.previewUrl} />
          <span className={s.cardIcon} aria-hidden="true">
            <Expand size={14} />
          </span>
          <span className={s.composerChange}>{c("templates.composer.change")}</span>
          <span className={s.composerCardInfo}>
            <strong>{name(t, locale)}</strong>
            <small>
              {t.category} · {t.format}
              {t.source === "community" && t.authorName ? ` · ${t.authorName}` : ""}
            </small>
          </span>
        </button>
      </div>
      {!isWorkflow && <div className={s.composerSlots}>
        <span className={s.slotOptional}>{c("templates.composer.optional")}</span>
        <button type="button" className={s.slotAdd} onClick={() => fileInputRef.current?.click()} aria-label={c("templates.attach.add")}>
          <Plus size={18} aria-hidden="true" />
        </button>
        <input
          ref={fileInputRef}
          className={s.visuallyHidden}
          type="file"
          multiple
          accept="image/png,image/jpeg,image/webp"
          onChange={(event) => {
            attach(event.currentTarget.files);
            event.currentTarget.value = "";
          }}
        />
        {images.map((image) => (
          <span key={image.id} className={`${s.slotFile} ${image.fromTemplate ? s.slotFromTemplate : ""}`} title={image.file.name}>
            <Image src={image.url} alt={image.file.name} fill unoptimized sizes="46px" />
            <button type="button" className={s.slotRemove} aria-label={c("templates.attach.remove")} onClick={() => detach(image.id)}>
              <X size={11} aria-hidden="true" />
            </button>
          </span>
        ))}
        <small className={attachError ? s.sendError : undefined} role={attachError ? "alert" : undefined}>{attachError ?? (images.some((image) => image.fromTemplate) ? c("templates.attach.fromTemplate") : c("templates.attach.hint"))}</small>
      </div>}
      <section className={s.composerBlock}>
        <div className={s.composerLabel}>
          <span>{c("templates.composer.prompt")}</span>
          <button
            type="button"
            role="switch"
            aria-checked={showPrompt}
            aria-label={c("templates.composer.showPrompt")}
            className={s.switchControl}
            onClick={() => setShowPrompt((v) => !v)}
          >
            <i />
          </button>
        </div>
        {showPrompt && (
          <textarea
            key={`${t.id}-${locale}`}
            ref={promptRef}
            className={s.composerPrompt}
            defaultValue={promptOf(t, locale)}
            placeholder={c("templates.composer.promptPlaceholder")}
            aria-label={c("templates.composer.prompt")}
          />
        )}
      </section>
      {isWorkflow ? (
        <>
          <h3 className={s.workflowStep}>{c("templates.workflow.step1")}</h3>
          <PickerRow
            label={c("templates.preview.factModel")}
            value={flowImageModel ? imagePicker.labelOf(flowImageModel) : c("templates.composer.pickModel")}
            placeholder={!flowImageModel}
            heading={c("templates.composer.featuredModels")}
            searchPlaceholder={c("templates.composer.modelSearch")}
            empty={c("templates.composer.noModels")}
            options={imagePicker.options}
            selectedId={flowImageModel}
            onPick={(id) => setFlow({ ...flow, imageModel: id, imageQuality: "" })}
          />
          <PickerRow
            label={c("templates.composer.quality")}
            value={flow.imageQuality || c("templates.composer.pickQuality")}
            placeholder={!flow.imageQuality}
            heading={c("templates.composer.quality")}
            empty={c("templates.composer.noModels")}
            options={imagePicker.qualitiesOf(flowImageModel).map((id) => ({ id, label: id }))}
            selectedId={flow.imageQuality}
            onPick={(id) => setFlow({ ...flow, imageQuality: id })}
          />
          <h3 className={s.workflowStep}>{c("templates.workflow.step2")}</h3>
          <PickerRow
            label={c("templates.preview.factModel")}
            value={flowVideoModel ? videoPicker.labelOf(flowVideoModel) : c("templates.composer.pickModel")}
            placeholder={!flowVideoModel}
            heading={c("templates.composer.featuredModels")}
            searchPlaceholder={c("templates.composer.modelSearch")}
            empty={c("templates.composer.noModels")}
            options={videoPicker.options}
            selectedId={flowVideoModel}
            onPick={(id) => setFlow({ ...flow, videoModel: id, videoQuality: "" })}
          />
          <PickerRow
            label={c("templates.composer.quality")}
            value={flow.videoQuality || c("templates.composer.pickQuality")}
            placeholder={!flow.videoQuality}
            heading={c("templates.composer.quality")}
            empty={c("templates.composer.noModels")}
            options={videoPicker.qualitiesOf(flowVideoModel).map((id) => ({ id, label: id }))}
            selectedId={flow.videoQuality}
            onPick={(id) => setFlow({ ...flow, videoQuality: id })}
          />
        </>
      ) : (
        <>
      <PickerRow
        label={c("templates.preview.factModel")}
        value={shownModel ? picker.labelOf(shownModel) : c("templates.composer.pickModel")}
        placeholder={!shownModel}
        badge={c("templates.tab.new")}
        heading={c("templates.composer.featuredModels")}
        searchPlaceholder={c("templates.composer.modelSearch")}
        empty={c("templates.composer.noModels")}
        options={modelOptions}
        selectedId={shownModel}
        onPick={(id) => setPicks({ ...picks, templateId: t.id, model: id })}
      />
      <PickerRow
        label={c("templates.composer.quality")}
        value={shownQuality || c("templates.composer.pickQuality")}
        placeholder={!shownQuality}
        heading={c("templates.composer.quality")}
        empty={c("templates.composer.noModels")}
        options={qualityOptions}
        selectedId={shownQuality}
        onPick={(id) => setPicks({ ...picks, templateId: t.id, quality: id })}
      />
        </>
      )}
      {advanced.length > 0 && (
        <details className={s.composerAdvanced}>
          <summary>
            {c("templates.composer.advanced")}
            <ChevronDown size={15} aria-hidden="true" />
          </summary>
          <dl className={s.composerFacts}>
            {advanced.map((f) => (
              <div key={f.key}>
                <dt>{f.label}</dt>
                <dd>{f.value}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}
      <div className={s.composerBar}>
        <div className={s.composerOption}>
          <span>
            {c("templates.composer.freeUse")}
            <em>{c("templates.composer.freeLeft")}</em>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={useFree}
            aria-label={c("templates.composer.freeUse")}
            className={s.switchControl}
            onClick={() => setUseFree((v) => !v)}
          >
            <i />
          </button>
        </div>
        <button type="button" className={s.use} disabled={sending.state === "busy"} onClick={() => void (isWorkflow ? generateWorkflow(t) : generate(t, shownModel, shownQuality))}>
          {sending.state === "busy" ? c("templates.composer.sending") : c("templates.edit.generate")} <Sparkles size={17} />
          {creditText(isWorkflow ? workflowCredits : credits)}
        </button>
        {sending.message && (
          <p role={sending.state === "error" ? "alert" : "status"} className={sending.state === "error" ? s.sendError : undefined}>
            {sending.message}
          </p>
        )}
        <p>{c("templates.composer.chargeNote")}</p>
      </div>
    </aside>
  );
}

/** The head of the library: a large title and one line of copy, with one featured cover on the right. */
function LibraryHero({ mode, items }: { mode: Mode; items: Template[] }) {
  const { c } = useStudioCopy();
  const hero = heroKeys[mode];
  // Some covers fail to load; move on to the next one rather than leave the space empty.
  const [skipped, setSkipped] = useState(0);
  const covers = items.filter((t) => valid(t.thumbnailUrl)).slice(skipped, skipped + 2);
  const cover = covers[0];
  return (
    <div className={s.libraryHero}>
      <div className={s.libraryHeroCopy}>
        <h1>{c(hero.title)}</h1>
        <p>{c(hero.body)}</p>
      </div>
      {cover && (
        <div className={s.libraryHeroCover}>
          {covers.map((item, i) => (
            <span key={item.id} className={i === 0 ? s.heroCoverMain : s.heroCoverSide}>
              <Image
                src={item.thumbnailUrl}
                alt=""
                fill
                unoptimized
                sizes="470px"
                className={s.poster}
                onError={i === 0 ? () => setSkipped((n) => n + 1) : undefined}
              />
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// The creator features each mode produces, to pick this mode's videos out of the account history.
const modeFeatures: Record<Mode, string[]> = {
  create: ["text-to-video", "image-to-video"],
  edit: ["extend-video", "lipsync", "people-video"],
  motion: ["motion-transfer", "video-swap"],
};

/** Sent when a workflow run starts, so the History tab shows it and follows it. */
const workflowEvent = "eos:template-workflow-changed";

const modeCategory: Record<Mode, string> = { create: "Video", edit: "Edit video", motion: "Motion" };
const modeCover: Record<Mode, string> = {
  create: "/generated-icons-v2/templates/ai-presenter-video.png",
  edit: "/generated-icons-v2/templates/training-video.png",
  motion: "/generated-icons-v2/templates/product-ad.png",
};

/**
 * Turns one finished video into a template of the library: its prompt and settings, the clip as the preview and the creator tab
 * of the feature that made it. The cover is optional; without one the mode's stock cover stands in. Creating templates needs the
 * admin role, so anyone else gets the server's refusal as the message.
 */
/** The address of the template made from a clip, so a clip that already became a template can be recognised. */
const workSlug = (id: string) => `work-${id.replace(/[^a-zA-Z0-9-]/g, "-").toLowerCase()}`.slice(0, 80);
/** What the page needs to know about a template just saved from a clip. */
type SavedTemplate = { slug: string; title: string; coverFailed?: boolean; assetsFailed?: boolean };

function SaveTemplateDialog({ item, mode, onClose, onCreated }: { item: HistoryItem; mode: Mode; onClose: () => void; onCreated: (saved: SavedTemplate) => void }) {
  const { c } = useStudioCopy();
  const prompt = item.prompt?.trim() ?? "";
  const [title, setTitle] = useState((prompt || item.title).slice(0, 80));
  const [description, setDescription] = useState(prompt.slice(0, 240));
  const [category, setCategory] = useState(modeCategory[mode]);
  const [state, setState] = useState<{ busy: boolean; error?: string }>({ busy: false });
  const save = async () => {
    if (!title.trim()) return setState({ busy: false, error: c("templates.save.needTitle") });
    setState({ busy: true });
    try {
      const tab = ["image-to-video", "text-to-video", "people-video", "motion-transfer", "video-swap", "lipsync", "extend-video"].includes(item.feature) ? item.feature : "text-to-video";
      const slug = workSlug(item.id);
      const created = await createAdminTemplate({
        slug,
        title: title.trim().slice(0, 80),
        description: (description.trim() || title.trim()).slice(0, 240),
        category: category.trim().slice(0, 40) || modeCategory[mode],
        kind: "video",
        // Saved from a member's own clip, so it is listed with the community's templates.
        source: "community",
        format: "Video",
        // A stand-in until the server has cut the real cover from the clip below.
        thumbnailUrl: modeCover[mode],
        previewUrl: item.outputUrl ?? "",
        targetPath: `/create/video?tab=${tab === "video-swap" ? "motion-transfer" : tab}&template=${slug}`,
        prompt,
        tags: [],
        featured: false,
        enabled: true,
        sortOrder: 0,
        settings: { ...Object.fromEntries(Object.entries(item.settings ?? {}).filter(([key]) => key !== "templateSlug")), feature: tab },
      });
      // The cover is a frame of the clip, cut and kept by the server. If that fails the template still exists, with the stand-in.
      const coverFailed = await createTemplateCoverFromPreview(created.id).then(() => false).catch(() => true);
      // The images and the clip it started from are provider links that expire in a week; the server keeps copies.
      const assetsFailed = await keepTemplateAssets(created.id).then(() => false).catch(() => true);
      onCreated({ slug, title: title.trim(), coverFailed, assetsFailed });
      onClose();
    } catch (error) {
      // A clip that was already saved once: the template exists, so treat it as saved rather than as a failure.
      if (error instanceof Error && /slug already exists/i.test(error.message)) {
        onCreated({ slug: workSlug(item.id), title: title.trim() });
        onClose();
        return;
      }
      setState({ busy: false, error: error instanceof Error ? error.message : c("templates.save.failed") });
    }
  };
  return createPortal(
    <div className={s.saveBackdrop} role="presentation" onClick={onClose}>
      <div className={s.saveDialog} role="dialog" aria-modal="true" aria-label={c("templates.save.title")} onClick={(event) => event.stopPropagation()}>
        <h2>{c("templates.save.title")}</h2>
        <video src={item.outputUrl} muted playsInline preload="metadata" />
        <label>
          {c("templates.save.name")}
          <input value={title} maxLength={80} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label>
          {c("templates.save.description")}
          <textarea value={description} maxLength={240} rows={3} onChange={(event) => setDescription(event.target.value)} />
        </label>
        <label>
          {c("templates.save.category")}
          <input value={category} maxLength={40} onChange={(event) => setCategory(event.target.value)} />
        </label>
        <p>{c("templates.save.coverAuto")}</p>
        {!prompt && <p>{c("templates.save.noPrompt")}</p>}
        <p>{c("templates.save.publicNote")}</p>
        {state.error && <p role="alert" className={s.sendError}>{state.error}</p>}
        <div>
          <button type="button" onClick={onClose}>{c("templates.save.cancel")}</button>
          <button type="button" className={s.saveConfirm} disabled={state.busy} onClick={() => void save()}>
            {state.busy ? c("templates.composer.sending") : c("templates.save.confirm")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * The finished clips made from a template in this mode, newest first, played right here. The server marks which clips were started
 * from a template, so this holds on any device. Reloads whenever a job finishes.
 */
function MyVideos({
  mode,
  savedSlugs,
  onTemplateCreated,
  onUseSaved,
  onOpenLibrary,
}: {
  mode: Mode;
  /** The addresses of every template in the library, to tell which clips already became one. */
  savedSlugs: Set<string>;
  onTemplateCreated: (saved: SavedTemplate) => void;
  onUseSaved: (slug: string) => void;
  onOpenLibrary?: () => void;
}) {
  const { c } = useStudioCopy();
  const [justSaved, setJustSaved] = useState<SavedTemplate | null>(null);
  const [videos, setVideos] = useState<HistoryItem[]>([]);
  const [pending, setPending] = useState<HistoryItem[]>([]);
  const [runs, setRuns] = useState<TemplateWorkflowRun[]>([]);
  const [saving, setSaving] = useState<HistoryItem | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    let timer: number | undefined;
    const load = () => {
      window.clearTimeout(timer);
      const workflows = mode === "create" ? listTemplateWorkflows(12, controller.signal).catch(() => [] as TemplateWorkflowRun[]) : Promise.resolve([] as TemplateWorkflowRun[]);
      Promise.all([fetchHistory({ type: "video", fromTemplate: true, limit: 24, signal: controller.signal }), workflows])
        .then(([result, flowRuns]) => {
          if (controller.signal.aborted) return;
          setRuns(flowRuns);
          const ofMode = result.items.filter((item) => modeFeatures[mode].includes(item.feature));
          setVideos(ofMode.filter((item) => item.status === "completed" && item.outputUrl).slice(0, 8));
          const running = ofMode.filter((item) => item.status === "queued" || item.status === "processing");
          setPending(running);
          // Follow the clips and workflow runs still being made until they are done.
          if (running.length || flowRuns.some((run) => run.status === "running")) timer = window.setTimeout(load, 6000);
        })
        .catch(() => {});
    };
    load();
    window.addEventListener(GENERATION_COMPLETED_EVENT, load);
    window.addEventListener(GENERATION_STARTED_EVENT, load);
    window.addEventListener(workflowEvent, load);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
      window.removeEventListener(GENERATION_COMPLETED_EVENT, load);
      window.removeEventListener(GENERATION_STARTED_EVENT, load);
      window.removeEventListener(workflowEvent, load);
    };
  }, [mode]);
  // Failed runs are listed only until a newer one exists, so an old failure does not stay forever.
  const shownRuns = runs.filter((run, index) => (run.status !== "failed" && run.status !== "cancelled") || index < 2);
  if (!videos.length && !pending.length && !shownRuns.length) return null;
  return (
    <section className={s.myVideos} aria-label={c("templates.history.mine")}>
      <div className={s.libraryTitle}>
        <h2>{c("templates.history.mine")}</h2>
      </div>
      {justSaved && (
        <div className={s.savedNote} role="status">
          <span>
            {c("templates.save.done", { name: justSaved.title })}
            {justSaved.coverFailed ? ` · ${c("templates.save.coverFailed")}` : ""}{justSaved.assetsFailed ? ` · ${c("templates.save.assetsFailed")}` : ""}
          </span>
          <button type="button" onClick={() => onUseSaved(justSaved.slug)}>{c("templates.save.use")}</button>
          {onOpenLibrary && <button type="button" onClick={onOpenLibrary}>{c("templates.save.openLibrary")}</button>}
        </div>
      )}
      <ul>
        {shownRuns.map((run) => {
          const image = run.steps[0]?.outputUrl;
          return (
            <li key={run.id}>
              {run.status === "completed" && run.resultUrl ? (
                <video src={run.resultUrl} controls playsInline preload="metadata" aria-label={run.prompt} />
              ) : (
                <div
                  className={`${s.pendingClip} ${run.status === "failed" ? s.failedClip : ""}`}
                  style={image ? { backgroundImage: `linear-gradient(#000000a6, #000000a6), url("${image}")` } : undefined}
                  role={run.status === "failed" ? "alert" : "status"}
                >
                  {run.status === "running" ? <Loader2 size={22} aria-hidden="true" /> : null}
                  {run.status === "running"
                    ? c(run.currentStep >= 2 ? "templates.workflow.makingVideo" : "templates.workflow.makingImage")
                    : run.status === "cancelled"
                      ? c("templates.workflow.cancelled")
                      : `${c("templates.workflow.failed")}${run.errorMessage ? `: ${run.errorMessage}` : ""}`}
                </div>
              )}
              <span>{run.prompt}</span>
              {run.status === "running" && (
                <button
                  type="button"
                  onClick={() => {
                    cancelTemplateWorkflow(run.id)
                      .catch(() => {})
                      .finally(() => window.dispatchEvent(new Event(workflowEvent)));
                  }}
                >
                  <X size={14} aria-hidden="true" />
                  {c("templates.workflow.cancel")}
                </button>
              )}
            </li>
          );
        })}
        {pending.map((item) => (
          <li key={item.id}>
            <div className={s.pendingClip} role="status">
              <Loader2 size={22} aria-hidden="true" />
              {c("templates.history.making")}
            </div>
            <span>{item.prompt?.trim() || item.title}</span>
          </li>
        ))}
        {videos.map((item) => (
          <li key={item.id}>
            <video src={item.outputUrl} controls playsInline preload="metadata" aria-label={item.title} />
            <span>{item.prompt?.trim() || item.title}</span>
            {savedSlugs.has(workSlug(item.id)) ? (
              <div className={s.savedRow}>
                <span>
                  <Check size={13} aria-hidden="true" />
                  {c("templates.save.already")}
                </span>
                <button type="button" onClick={() => onUseSaved(workSlug(item.id))}>{c("templates.save.use")}</button>
              </div>
            ) : (
              <button type="button" onClick={() => setSaving(item)}>
                <LayoutTemplate size={14} aria-hidden="true" />
                {c("templates.save.button")}
              </button>
            )}
          </li>
        ))}
      </ul>
      {saving && (
        <SaveTemplateDialog
          item={saving}
          mode={mode}
          onClose={() => setSaving(null)}
          onCreated={(saved) => {
            setJustSaved(saved);
            onTemplateCreated(saved);
          }}
        />
      )}
    </section>
  );
}

/** "History": what was opened from here lately; before anything was, an invitation with the three steps. */
function HistoryPanel({
  mode,
  recent,
  items,
  onSelect,
  onExpand,
  onLibrary,
  savedSlugs,
  onUseSaved,
  onOpenSaved,
  onTemplateCreated,
}: {
  mode: Mode;
  recent: Template[];
  items: Template[];
  onSelect: (t: Template) => void;
  onExpand: (t: Template) => void;
  /** Absent when this mode has no library to open. */
  onLibrary?: () => void;
  /** The addresses of the templates in the library. */
  savedSlugs: Set<string>;
  /** Puts a saved template on the left panel, ready to use. */
  onUseSaved: (slug: string) => void;
  /** Opens the community's list, where a clip just saved as a template is. */
  onOpenSaved: () => void;
  /** Called after a finished video was saved as a template, so the library can reload. */
  onTemplateCreated: (saved: { slug: string; title: string }) => void;
}) {
  const { c } = useStudioCopy();
  const covers = items.filter((t) => valid(t.thumbnailUrl));
  const steps = stepsByMode[mode];
  const hero = heroKeys[mode];
  if (recent.length)
    return (
      <>
        <MyVideos mode={mode} savedSlugs={savedSlugs} onTemplateCreated={onTemplateCreated} onUseSaved={onUseSaved} onOpenLibrary={mode === "edit" ? undefined : onOpenSaved} />
        <section>
          <div className={s.libraryTitle}>
            <h2>{c("templates.history.recent")}</h2>
          </div>
          <div className={s.masonry}>
            {recent.map((t) => (
              <Tile key={t.id} t={t} selected={false} onSelect={onSelect} onExpand={onExpand} />
            ))}
          </div>
        </section>
      </>
    );
  return (
    <>
    <MyVideos mode={mode} savedSlugs={savedSlugs} onTemplateCreated={onTemplateCreated} onUseSaved={onUseSaved} onOpenLibrary={mode === "edit" ? undefined : onOpenSaved} />
    <section className={s.invite}>
      <div className={s.inviteBanner}>
        <small>{c(hero.tag)}</small>
        <strong>{c("templates.history.bannerTitle")}</strong>
        {onLibrary && (
          <button type="button" onClick={onLibrary}>
            {c("templates.history.bannerButton")}
          </button>
        )}
      </div>
      <h2>{c("templates.history.heading")}</h2>
      <p>{c("templates.history.body")}</p>
      <ol className={s.inviteSteps}>
        {steps.map(([title, body], i) => (
          <li key={title}>
            <div className={`${s.inviteArt} ${s[`inviteArt${i + 1}`]}`}>
              {i === 0 ? (
                <div className={s.uploadDemo}>
                  <Upload size={28} aria-hidden="true" />
                  <strong>{c(title).toUpperCase()}</strong>
                  <small>{c(body)}</small>
                  {covers[0] && <span style={{ backgroundImage: `url("${covers[0].thumbnailUrl}")` }} />}
                </div>
              ) : i === 1 ? (
                <div className={s.presetDemo}>
                  {covers.slice(0, 4).map((t, index) => (
                    <span key={t.id} className={index === 1 ? s.presetSelected : ""} style={{ backgroundImage: `url("${t.thumbnailUrl}")` }} />
                  ))}
                </div>
              ) : covers[i] ? (
                <span className={s.resultDemo} style={{ backgroundImage: `url("${covers[i].thumbnailUrl}")` }} />
              ) : (
                <PanelsTopLeft size={30} aria-hidden="true" />
              )}
            </div>
            <h3>{c(title)}</h3>
            <p>{c(body)}</p>
          </li>
        ))}
      </ol>
    </section>
    </>
  );
}

// The look a video is given: EOS's own presets, or an image the visitor uploads. Custom ones are kept in this browser for now.
type StyleChoice = { id: string; name: string; imageUrl: string };
const customStylesKey = "eos.templates.custom-styles";
function readCustomStyles(): StyleChoice[] {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(customStylesKey) ?? "[]");
    return Array.isArray(value)
      ? value.filter((item): item is StyleChoice => !!item && typeof item.id === "string" && typeof item.name === "string" && typeof item.imageUrl === "string")
      : [];
  } catch {
    return [];
  }
}
function saveCustomStyles(list: StyleChoice[]) {
  try {
    window.localStorage.setItem(customStylesKey, JSON.stringify(list.slice(0, 50)));
  } catch {
    // The style still works for this visit.
  }
}

/** "Styles": pick a look for the video, or upload your own image to take the look from. */
function StylesPanel({ chosen, onPick }: { chosen: StyleChoice | null; onPick: (style: StyleChoice) => void }) {
  const { c } = useStudioCopy();
  const [source, setSource] = useState<"eos" | "custom">("eos");
  const [eos, setEos] = useState<StyleChoice[]>([]);
  // Read after mount (the server render has no storage), so a custom style never causes a hydration mismatch.
  const [custom, setCustom] = useState<StyleChoice[]>([]);
  const [customRead, setCustomRead] = useState(false);
  const [state, setState] = useState<{ busy: boolean; error?: string }>({ busy: false });
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let alive = true;
    listStylePresets()
      .then((list) => {
        if (alive) setEos(list.filter((preset) => preset.enabled && preset.imageUrl).map((preset) => ({ id: preset.id, name: preset.name, imageUrl: preset.imageUrl ?? "" })));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  const upload = async (file: File) => {
    setState({ busy: true });
    try {
      const imageUrl = await uploadImageAsset(file, { purpose: "style-reference", feature: "text-to-video" });
      const style: StyleChoice = { id: crypto.randomUUID(), name: file.name.replace(/\.[^.]+$/, "").slice(0, 40) || c("templates.styles.untitled"), imageUrl };
      const next = [style, ...custom];
      setCustom(next);
      saveCustomStyles(next);
      onPick(style);
      setState({ busy: false });
    } catch (error) {
      setState({ busy: false, error: error instanceof Error ? error.message : c("templates.styles.uploadFailed") });
    }
  };
  const remove = (id: string) => {
    const next = custom.filter((style) => style.id !== id);
    setCustom(next);
    saveCustomStyles(next);
  };
  if (source === "custom" && !customRead) {
    setCustomRead(true);
    setCustom(readCustomStyles());
  }
  const shown = source === "eos" ? eos : custom;
  const cover = eos[0]?.imageUrl ?? custom[0]?.imageUrl;
  return (
    <section>
      <div className={s.libraryHero}>
        <div className={s.libraryHeroCopy}>
          <h1>{c("templates.styles.heading")}</h1>
          <p>{c("templates.styles.body")}</p>
        </div>
        {cover && (
          <div className={s.libraryHeroCover}>
            <span className={s.heroCoverMain} style={{ flexBasis: "100%" }}>
              <Image src={cover} alt="" fill unoptimized sizes="470px" className={s.poster} />
            </span>
          </div>
        )}
      </div>
      <section className={s.toolbar} aria-label={c("templates.styles.sourceAria")}>
        <div className={s.tabs}>
          <button type="button" aria-pressed={source === "eos"} onClick={() => setSource("eos")}>
            <WandSparkles size={14} aria-hidden="true" />
            {c("templates.sortEos")}
          </button>
          <button type="button" aria-pressed={source === "custom"} onClick={() => setSource("custom")}>
            <User size={14} aria-hidden="true" />
            {c("templates.styles.custom")}
          </button>
        </div>
      </section>
      <div className={s.styleGrid}>
        {source === "custom" && (
          <>
            <button type="button" className={s.styleUpload} disabled={state.busy} onClick={() => inputRef.current?.click()}>
              <ImagePlus size={26} aria-hidden="true" />
              <strong>{state.busy ? c("templates.composer.sending") : c("templates.styles.upload")}</strong>
              <small>{c("templates.styles.uploadHint")}</small>
              {state.error && <em role="alert">{state.error}</em>}
            </button>
            <input
              ref={inputRef}
              className={s.visuallyHidden}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (file) void upload(file);
                event.currentTarget.value = "";
              }}
            />
          </>
        )}
        {shown.map((style) => (
          <div key={style.id} className={`${s.styleCard} ${chosen?.id === style.id ? s.styleCardChosen : ""}`}>
            <button type="button" aria-pressed={chosen?.id === style.id} onClick={() => onPick(style)} aria-label={style.name}>
              <Image src={style.imageUrl} alt="" fill unoptimized sizes="400px" className={s.poster} />
              <span>{style.name}</span>
              {chosen?.id === style.id && <Check size={16} aria-hidden="true" />}
            </button>
            {source === "custom" && (
              <button type="button" className={s.styleRemove} aria-label={c("templates.styles.remove")} onClick={() => remove(style.id)}>
                <X size={14} aria-hidden="true" />
              </button>
            )}
          </div>
        ))}
      </div>
      {source === "eos" && shown.length === 0 && <p className={s.empty}>{c("templates.styles.none")}</p>}
    </section>
  );
}

function HowItWorks({ mode, items, onSelect }: { mode: Mode; items: Template[]; onSelect?: (t: Template) => void }) {
  const { c, locale } = useStudioCopy();
  const [step, setStep] = useState(0);
  const steps = stepsByMode[mode];
  const covers = items.filter((t) => valid(t.thumbnailUrl));
  // A cover that fails to load is skipped, so the big picture is never an empty box.
  const [skip, setSkip] = useState(0);
  const cover = (i: number) => covers[(i + skip) % Math.max(covers.length, 1)]?.thumbnailUrl;
  const go = (delta: number) => setStep((v) => (v + delta + steps.length) % steps.length);
  if (mode === "motion") {
    const motionItems = items.filter((item) => item.kind === "video" && valid(item.thumbnailUrl));
    const montage = motionItems.slice(0, 3);
    return (
      <section className={s.motionHow}>
        <header className={s.motionHowHero}>
          <div><h1>{c(heroKeys.motion.title)}</h1><p>{c(heroKeys.motion.body)}</p></div>
          <div className={s.motionMontage} aria-hidden="true">
            {montage.map((item, index) => <span key={item.id} className={s[`motionMontage${index + 1}`]} style={{ backgroundImage: `url("${item.thumbnailUrl}")` }} />)}
          </div>
        </header>
        <section className={s.motionLibrary}>
          <h2>{c("templates.motion.library.heading")}</h2>
          {motionItems.length ? <div className={s.motionGallery}>
            {motionItems.map((item) => <button key={item.id} type="button" onClick={() => onSelect?.(item)} aria-label={name(item, locale)}>
              <Image src={item.thumbnailUrl} alt={name(item, locale)} fill unoptimized sizes="(max-width: 800px) 40vw, 240px" className={s.poster} />
              <span>{name(item, locale)}</span>
            </button>)}
          </div> : <p className={s.motionLibraryEmpty}>{c("templates.motion.library.empty")}</p>}
        </section>
      </section>
    );
  }
  return (
    <section className={s.how}>
      <div className={s.howStage} aria-hidden="true">
        {cover(step) && (
          <Image
            key={cover(step)}
            src={cover(step)}
            alt=""
            fill
            unoptimized
            sizes="560px"
            className={s.poster}
            onError={() => setSkip((n) => (n + 1 < covers.length ? n + 1 : n))}
          />
        )}
      </div>
      <span className={s.howEyebrow}>{c("templates.how.eyebrow")}</span>
      <h2>{c(steps[step][0])}</h2>
      <p>{c(steps[step][1])}</p>
      <div className={s.howControls}>
        <button type="button" onClick={() => go(-1)} aria-label={c("templates.how.prev")}>
          <ChevronLeft size={16} />
        </button>
        <div className={s.howThumbs}>
          {steps.map(([title], i) => (
            <button
              key={title}
              type="button"
              aria-current={i === step ? "step" : undefined}
              aria-label={c(title)}
              onClick={() => setStep(i)}
              style={cover(i) ? { backgroundImage: `url("${cover(i)}")` } : undefined}
            />
          ))}
        </div>
        <button type="button" onClick={() => go(1)} aria-label={c("templates.how.next")}>
          <ChevronRight size={16} />
        </button>
      </div>
    </section>
  );
}
const RECENT_KEY = "eos.templates.recent";
function readRecent(): Template[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as Template[]).filter((t) => t && typeof t.id === "string") : [];
  } catch {
    return [];
  }
}
function rememberTemplate(t: Template): Template[] {
  const next = [t, ...readRecent().filter((x) => x.id !== t.id)].slice(0, 12);
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage restrictions; the template still opens.
  }
  return next;
}
const skeletonHeights = [210, 150, 260, 180, 230, 140, 200, 170, 250, 160];
/** One input image of a template in its details; one that no longer loads (an expired link) is left out. */
function AssetThumb({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <span className={s.clipAsset}>
      <Image src={src} alt="" fill unoptimized sizes="64px" onError={() => setFailed(true)} />
    </span>
  );
}
function Preview({ t, close }: { t: Template; close: () => void }) {
  const { c, locale } = useStudioCopy();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current,
      overflow = document.body.style.overflow;
    el?.showModal();
    document.body.style.overflow = "hidden";
    document.querySelectorAll<HTMLMediaElement>("video,audio").forEach((m) => m.pause());
    return () => {
      el?.close();
      document.body.style.overflow = overflow;
    };
  }, []);
  const settings = t.settings ?? {};
  const inputAssets = inputImagesOf(t);
  const videoSrc = t.kind === "video"
    ? (valid(t.previewUrl) ? t.previewUrl : t.slug === "training-video" ? "/generated-videos/cinematic-trailer.webm" : "/generated-videos/ai-presenter.webm")
    : undefined;
  const videoFormat = typeof settings.outputFormat === "string"
    ? settings.outputFormat
    : videoSrc?.split(/[?#]/, 1)[0].split(".").pop()?.toUpperCase() || "MP4";
  const facts: [string, unknown][] = [
    [c("templates.preview.factModel"), settings.model ?? settings.modelId],
    [c("templates.preview.factRatio"), settings.ratio ?? settings.aspectRatio],
    [c("templates.preview.factResolution"), settings.resolution],
    [c("templates.preview.factCount"), settings.count],
    [
      c("templates.preview.factDuration"),
      typeof settings.duration === "number" ? c("templates.preview.seconds", { value: settings.duration }) : undefined,
    ],
    [c("templates.preview.factFile"), settings.outputFormat],
  ];
  return (
    <dialog
      ref={ref}
      className={`${s.dialog} ${s.previewDialog} ${t.kind === "video" ? s.videoPreviewDialog : ""}`}
      onCancel={close}
      onClick={(e) => {
        if (e.target === ref.current) close();
      }}
      aria-labelledby={t.kind === "video" ? undefined : "template-preview-title"}
      aria-label={t.kind === "video" ? c("templates.preview.clipDetails") : undefined}
    >
      <button className={s.previewClose} onClick={close} aria-label={c("templates.preview.close")}>
        <X size={20} />
      </button>
      <div className={s.previewLayout}>
        <div className={s.artworkPane}>
          {videoSrc ? (
            <ClipPreviewPlayer src={videoSrc} poster={t.thumbnailUrl} label={c("templates.media.videoAria", { name: name(t, locale) })} />
          ) : <Media t={t} expanded />}
          {t.kind !== "video" && <span className={s.artworkLabel}>EOS / CREATIVE STUDIO</span>}
        </div>
        <section className={`${s.previewInfo} ${t.kind === "video" ? s.videoPreviewInfo : ""}`}>
          {t.kind === "video" ? (
            <>
              <div className={s.clipDetailsHeading}><Info size={14} />{c("templates.preview.clipDetails")}</div>
              <dl className={s.clipDetails}>
                <div><dt>{c("templates.preview.clipSource")}</dt><dd>{t.source === "community" ? c("templates.source.community") : c("templates.preview.clipTemplate")}</dd></div>
                {t.authorName && <div><dt>{c("templates.preview.clipAuthor")}</dt><dd>{t.authorName}</dd></div>}
                <div><dt>{c("templates.preview.clipType")}</dt><dd>{c(kindKeys.video)}</dd></div>
                <div><dt>{c("templates.preview.clipFormat")}</dt><dd>{videoFormat}</dd></div>
              </dl>
              {inputAssets.length > 0 && (
                <>
                  <div className={s.clipDetailsHeading}><ImagePlus size={14} />{c("templates.preview.inputAssets")}</div>
                  <div className={s.clipAssets}>
                    {inputAssets.map((address) => <AssetThumb key={address} src={address} />)}
                  </div>
                </>
              )}
              <div className={s.clipActions}>
                {valid(t.targetPath) && t.targetPath.startsWith("/") && (
                  <Link href={templateHref(t)} className={s.clipEdit}><Pencil size={15} />{c("templates.preview.clipEdit")}</Link>
                )}
                <div className={s.clipActionGrid}>
                  <button type="button" disabled><ScanLine size={15} />{c("templates.preview.clipStartFrame")}</button>
                  <button type="button" disabled><ScanLine size={15} />{c("templates.preview.clipEndFrame")}</button>
                  <button type="button" disabled><Expand size={15} />{c("templates.preview.clipUpscale")}</button>
                  {videoSrc && <a href={videoSrc} download><Download size={15} />{c("templates.preview.clipDownload")}</a>}
                </div>
              </div>
            </>
          ) : (
            <>
              <span className={s.previewEyebrow}>{c(kindKeys[t.kind])} · TEMPLATE</span>
              <h2 id="template-preview-title">{name(t, locale)}</h2>
              <p className={s.previewDescription}>{copy(t, locale).description}</p>
              <div className={s.presetHeading}>{c("templates.preview.presetHeading")}</div>
              <dl className={s.presetFacts}>
                {facts
                  .filter(([, v]) => typeof v === "string" || typeof v === "number")
                  .map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{String(value)}</dd>
                    </div>
                  ))}
              </dl>
              {!facts.some(([, v]) => typeof v === "string" || typeof v === "number") && (
                <p className={s.previewDescription}>{c("templates.preview.noFacts")}</p>
              )}
              <div className={s.previewFooter}>
                {valid(t.targetPath) && t.targetPath.startsWith("/") && (
                  <Link href={templateHref(t)} className={s.use}>
                    {c("templates.preview.useThis")} <ArrowRight size={19} />
                  </Link>
                )}
                <p>
                  {c("templates.preview.footerLine1")}
                  <br />
                  {c("templates.preview.footerLine2")}
                </p>
              </div>
            </>
          )}
        </section>
      </div>
    </dialog>
  );
}
export function TemplatesPageClient() {
  const { c } = useStudioCopy();
  const [items, setItems] = useState<Template[]>([]);
  const [likedSlugs, setLikedSlugs] = useState<Set<string>>(new Set());
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  useEffect(() => {
    let alive = true;
    listMyTemplateLikes()
      .then((slugs) => {
        if (alive) setLikedSlugs(new Set(slugs));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  // Optimistic: the heart and count change at once, then follow what the server says (or go back if it refuses).
  const toggleLike = (t: Template) => {
    const wasLiked = likedSlugs.has(t.slug);
    const before = likeCounts[t.slug] ?? t.likeCount ?? 0;
    const next = new Set(likedSlugs);
    if (wasLiked) next.delete(t.slug);
    else next.add(t.slug);
    setLikedSlugs(next);
    setLikeCounts({ ...likeCounts, [t.slug]: Math.max(before + (wasLiked ? -1 : 1), 0) });
    setTemplateLike(t.slug, !wasLiked)
      .then((result) => setLikeCounts((current) => ({ ...current, [t.slug]: result.likeCount })))
      .catch(() => {
        setLikedSlugs((current) => {
          const back = new Set(current);
          if (wasLiked) back.add(t.slug);
          else back.delete(t.slug);
          return back;
        });
        setLikeCounts((current) => ({ ...current, [t.slug]: before }));
      });
  };
  const [q, setQ] = useState(""),
    [mode, setMode] = useState<Mode>(DEFAULT_MODE),
    [category, setCategory] = useState("all"),
    [lane, setLane] = useState<Lane>("eos"),
    [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<TemplatePagination>({ page: 1, limit: 24, total: 0, totalPages: 1 }),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(false),
    [retry, setRetry] = useState(0),
    [preview, setPreview] = useState<Template | null>(null),
    [selectedId, setSelectedId] = useState<string | null>(null),
    [panel, setPanel] = useState<"history" | "library" | "styles" | "how">("history"),
    [style, setStyle] = useState<StyleChoice | null>(null),
    [recent, setRecent] = useState<Template[]>([]),
    [community, setCommunity] = useState<Template[]>([]);
  // What was opened lately is read once the page is in the browser.
  useEffect(() => {
    const timer = window.setTimeout(() => setRecent(readRecent()), 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    const c = new AbortController();
    const timer = setTimeout(
      () => {
        setLoading(true);
        setError(false);
        listTemplates({ search: q, category, ...laneQuery[lane], page, limit: 24, signal: c.signal })
          .then((r) => {
            if (c.signal.aborted) return;
            setItems(r.templates);
            setPagination(r.pagination ?? { page: 1, limit: 24, total: r.templates.length, totalPages: 1 });
          })
          .catch(() => {
            if (!c.signal.aborted) setError(true);
          })
          .finally(() => {
            if (!c.signal.aborted) setLoading(false);
          });
      },
      q ? 250 : 0,
    );
    return () => {
      c.abort();
      clearTimeout(timer);
    };
  }, [q, category, lane, page, retry]);
  // The community's templates, so a clip that already became one is recognised whichever list is open.
  useEffect(() => {
    const controller = new AbortController();
    listTemplates({ source: "community", sort: "newest", limit: 50, signal: controller.signal })
      .then((r) => setCommunity(r.templates))
      .catch(() => {});
    return () => controller.abort();
  }, [retry]);
  // The first work on the page is the chosen one until a tile is clicked.
  const ofMode = items.filter((t) => {
    if (mode === "create") return t.kind === "video" && modeOf(t) === "create";
    return modeOf(t) === mode;
  });
  const visible = ofMode;
  const recentForMode = recent.filter((t) =>
    mode === "create" ? t.kind === "video" && modeOf(t) === "create" : modeOf(t) === mode,
  );
  // "" means the template was taken off the panel with its cross; null means nothing was chosen yet (the first one shows).
  const selected =
    selectedId === ""
      ? undefined
      : (visible.find((t) => t.id === selectedId) ?? recentForMode.find((t) => t.id === selectedId) ?? visible[0]);
  useEffect(() => {
    const showResult = () => setPanel("history");
    window.addEventListener(GENERATION_COMPLETED_EVENT, showResult);
    window.addEventListener(GENERATION_STARTED_EVENT, showResult);
    window.addEventListener(workflowEvent, showResult);
    return () => {
      window.removeEventListener(GENERATION_COMPLETED_EVENT, showResult);
      window.removeEventListener(GENERATION_STARTED_EVENT, showResult);
      window.removeEventListener(workflowEvent, showResult);
    };
  }, []);
  const switchMode = (nextMode: Mode) => {
    setMode(nextMode);
    setPanel(nextMode === "motion" ? "how" : "history");
  };
  const change = () => {
    setPage(1);
    setLoading(true);
  };
  const reset = () => {
    setQ("");
    setCategory("all");
    setLane("eos");
    setRetry((n) => n + 1);
    change();
  };
  const pages = [
    ...new Set([1, ...Array.from({ length: 5 }, (_, i) => pagination.page + i - 2), pagination.totalPages]),
  ]
    .filter((n) => n > 0 && n <= pagination.totalPages)
    .sort((a, b) => a - b);
  // Like the real thing, each mode has its own right-hand tabs: editing only has history and how it works.
  type PanelId = "history" | "library" | "styles" | "how";
  const tabHistory: [PanelId, StudioCopyKey] = ["history", "templates.tab.history"];
  const tabLibrary: [PanelId, StudioCopyKey] = ["library", "templates.tab.library"];
  const tabStyles: [PanelId, StudioCopyKey] = ["styles", "templates.tab.styles"];
  const tabHow: [PanelId, StudioCopyKey] = ["how", "templates.tab.how"];
  const panelIcons: Record<PanelId, LucideIcon> = { history: Folder, library: Orbit, styles: WandSparkles, how: BookOpen };
  // Editing has its own library of sample edits, named for what it holds; the motion mode keeps its gallery under "how it works".
  const tabEditLibrary: [PanelId, StudioCopyKey] = ["library", "templates.tab.editLibrary"];
  const panelTabs: Array<[PanelId, StudioCopyKey]> =
    mode === "edit"
      ? [tabHistory, tabEditLibrary, tabHow]
      : mode === "motion"
        ? [tabHistory, tabHow]
        : [tabHistory, tabLibrary, tabStyles, tabHow];
  const activePanel = panelTabs.some(([id]) => id === panel) ? panel : mode === "motion" ? "how" : "history";
  // The three lists of the library; the motion gallery has them too.
  const laneToolbar = (
      <section className={s.toolbar} aria-label={c("templates.filtersAria")}>
        <div className={s.tabs}>
          {laneOptions.map(([id, key, LaneIcon]) => (
            <button
              key={id}
              type="button"
              aria-pressed={lane === id}
              onClick={() => {
                if (lane === id) return;
                setLane(id);
                change();
              }}
            >
              <LaneIcon size={14} aria-hidden="true" />
              {c(key)}
            </button>
          ))}
        </div>
      </section>
  );
  const libraryBody = loading ? (
    <div role="status" aria-label={c("templates.loading")} className={s.masonry}>
      {skeletonHeights.map((h, i) => (
        <div key={i} className={s.skeleton} style={{ height: h }} />
      ))}
    </div>
  ) : error ? (
    <div role="alert" className={s.empty}>
      {c("templates.loadFailed")}{" "}
      <button type="button" onClick={() => setRetry((n) => n + 1)}>
        {c("templates.retry")}
      </button>
    </div>
  ) : !visible.length ? (
    <div className={s.empty}>
      <h2>{c("templates.emptyTitle")}</h2>
      {items.length > 0 ? (
        <p>{c("templates.mode.emptyBody")}</p>
      ) : (
        <>
          <p>{c("templates.emptyBody")}</p>
          <button type="button" onClick={reset}>
            {c("templates.showAll")}
          </button>
        </>
      )}
    </div>
  ) : (
    <section className={s.masonry} aria-label={c("templates.libraryAria")}>
      {visible.map((t) => (
        // In Edit Video the left panel is the tool list, so "Recreate" opens the sample's details, with the button to edit it.
        <Tile key={t.id} t={t} selected={t.id === selected?.id} onSelect={(x) => (mode === "edit" ? setPreview(x) : setSelectedId(x.id))} onExpand={setPreview} />
      ))}
    </section>
  );
  return (
    <LikesContext.Provider value={{ liked: likedSlugs, counts: likeCounts, toggle: toggleLike }}>
    <div className={s.page} data-page="templates" data-no-translate>
      <div className={s.workspace}>
        <Composer
          t={selected ?? (mode === "edit" ? items.find((item) => item.kind === "video") : undefined)}
          mode={mode}
          onMode={switchMode}
          options={ofMode}
          onSelect={setSelectedId}
          onClear={() => setSelectedId("")}
          style={style}
          onChangeStyle={() => setPanel("styles")}
          onClearStyle={() => setStyle(null)}
          onUse={(t) => setRecent(rememberTemplate(t))}
          onExpand={setPreview}
        />
        <section className={s.libraryPanel}>
          <div className={s.panelTopbar}>
            <div className={s.panelTabs} role="tablist">
              {panelTabs.map(([id, label]) => (
                <button key={id} type="button" role="tab" aria-selected={activePanel === id} onClick={() => setPanel(id)}>
                  {(() => {
                    const TabIcon = panelIcons[id];
                    return <TabIcon size={14} aria-hidden="true" />;
                  })()}
                  {c(label)}
                  {id === "styles" && <em>{c("templates.tab.new")}</em>}
                </button>
              ))}
            </div>
          </div>
          {activePanel === "how" ? (
            <>
              {mode === "motion" && laneToolbar}
              <HowItWorks key={mode} mode={mode} items={visible} onSelect={(item) => setSelectedId(item.id)} />
            </>
          ) : activePanel === "history" ? (
            <HistoryPanel
              mode={mode}
              recent={recentForMode}
              items={visible}
              onSelect={(t) => setSelectedId(t.id)}
              onExpand={setPreview}
              onLibrary={mode === "edit" ? undefined : () => setPanel("library")}
              savedSlugs={new Set([...items, ...community].map((item) => item.slug))}
              onUseSaved={(slug) => {
                const found = [...items, ...community].find((item) => item.slug === slug);
                if (found) {
                  setRecent(rememberTemplate(found));
                  setSelectedId(found.id);
                }
              }}
              onOpenSaved={() => {
                setLane("communityNew");
                setPage(1);
                setPanel("library");
              }}
              onTemplateCreated={() => setRetry((n) => n + 1)}
            />
          ) : activePanel === "styles" ? (
            <StylesPanel chosen={style} onPick={setStyle} />
          ) : (
            <>
              <LibraryHero mode={mode} items={visible} />
              {laneToolbar}
              {libraryBody}
              {!loading && !error && pagination.totalPages > 1 && (
                <nav className={s.pagination} aria-label={c("templates.paginationAria")}>
                  <button
                    type="button"
                    disabled={pagination.page === 1}
                    onClick={() => {
                      setPage(pagination.page - 1);
                      setLoading(true);
                    }}
                  >
                    {c("templates.prev")}
                  </button>
                  {pages.map((n, i) => (
                    <span key={n}>
                      {i > 0 && n - pages[i - 1] > 1 && <span>…</span>}
                      <button
                        type="button"
                        aria-current={n === pagination.page ? "page" : undefined}
                        onClick={() => {
                          if (n === pagination.page) return;
                          setPage(n);
                          setLoading(true);
                        }}
                      >
                        {n}
                      </button>
                    </span>
                  ))}
                  <button
                    type="button"
                    disabled={pagination.page === pagination.totalPages}
                    onClick={() => {
                      setPage(pagination.page + 1);
                      setLoading(true);
                    }}
                  >
                    {c("templates.next")}
                  </button>
                </nav>
              )}
            </>
          )}
        </section>
      </div>
      {preview && <Preview t={preview} close={() => setPreview(null)} />}
    </div>
    </LikesContext.Provider>
  );
}
