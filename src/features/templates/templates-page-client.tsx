"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
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
import { createTextVideoGeneration } from "@/lib/api/text-video-generations";
import { createMotionTransferGeneration } from "@/lib/api/motion-transfer-generations";
import { uploadImageAsset } from "@/lib/api/storage";
import { formatGenerationError } from "@/lib/api/generation-errors";
import { emitGenerationRequestFailed, emitGenerationStarted, emitGenerationSubmitting } from "@/lib/generation-progress-events";
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
type SortId = "recommended" | "popular" | "newest";
const sortIcons: Record<SortId, LucideIcon> = { recommended: WandSparkles, popular: TrendingUp, newest: Clock };
const sortOptions: Array<[SortId, StudioCopyKey]> = [
  ["recommended", "templates.sortEos"],
  ["popular", "templates.sortPopular"],
  ["newest", "templates.sortNewest"],
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
  if (/motion/.test(hint)) return "motion";
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
  "Show my product in the source video, keeping the same camera motion, lighting direction and pacing.":
    "แสดงสินค้าของฉันในวิดีโอต้นฉบับ โดยคงการเคลื่อนกล้อง ทิศทางแสง และจังหวะเดิมไว้",
};
const promptOf = (t: Template, locale: CopyLocale) => {
  const text = t.prompt?.trim() ?? "";
  return (locale === "th" ? prompts[text] : undefined) ?? text;
};
const copy = (t: Template, locale: CopyLocale) =>
  templateCopy(
    t.title,
    t.description,
    typeof t.settings?.feature === "string" ? t.settings.feature : undefined,
    t.kind,
    locale,
  );
// The Thai names for the seeded English templates only make sense in Thai; other titles come from the data.
const name = (t: Template, locale: CopyLocale) =>
  (locale === "th" ? titles[t.title] : undefined) ?? copy(t, locale).title;
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
  // The heart only toggles here for now; its count and saving come with the real data.
  const [liked, setLiked] = useState(false);
  return (
    <article className={`${s.tile} ${selected ? s.tileSelected : ""}`} style={{ aspectRatio: String(ratioOf(t)) }}>
      <Media t={t} tile key={t.id + t.previewUrl} />
      <button type="button" className={s.tileOpen} aria-pressed={selected} onClick={() => onSelect(t)} aria-label={name(t, locale)} />
      <span className={s.kind}>{c(kindKeys[t.kind])}</span>
      <button
        type="button"
        className={s.tileExpand}
        onClick={() => onExpand(t)}
        aria-label={c("templates.card.previewAria", { name: name(t, locale) })}
      >
        <Expand size={15} />
      </button>
      <div className={s.tileActions}>
        <button type="button" className={s.tileLike} aria-pressed={liked} aria-label={c("templates.card.like")} onClick={() => setLiked((v) => !v)}>
          <Heart size={16} fill={liked ? "currentColor" : "none"} aria-hidden="true" />
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

/**
 * The models the creator offers for one feature, shaped for the model and quality pickers. Nothing is listed until they load
 * (or when the visitor is signed out), and the pickers then fall back to what the templates themselves say.
 */
function useModelPicker(feature: string) {
  const { c } = useStudioCopy();
  const [models, setModels] = useState<GenerationModelOption[]>([]);
  useEffect(() => {
    let alive = true;
    listGenerationModels(feature)
      .then((list) => {
        if (alive) setModels(list.filter((m) => m.enabled));
      })
      .catch(() => {
        if (alive) setModels([]);
      });
    return () => {
      alive = false;
    };
  }, [feature]);
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
  return { options, qualitiesOf, labelOf };
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
  const [character, setCharacter] = useState<string | null>(null);
  const [characterFile, setCharacterFile] = useState<File | null>(null);
  const [sending, setSending] = useState<{ state: "idle" | "busy" | "sent" | "error"; message?: string }>({ state: "idle" });
  const [sceneControl, setSceneControl] = useState(true);
  const [sceneSource, setSceneSource] = useState<"video" | "image">("video");
  const [model, setModel] = useState("");
  const [quality, setQuality] = useState("");
  const picker = useModelPicker("motion-transfer");
  const credits = useCreditQuote({ feature: "motion-transfer", model, resolution: quality || undefined });
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => () => { if (character) URL.revokeObjectURL(character); }, [character]);
  const modelOptions = picker.options;
  const qualityOptions: FlyoutOption[] = (picker.qualitiesOf(model).length ? picker.qualitiesOf(model) : ["720p", "1080p"]).map((label) => ({ id: label, label }));
  // Generates right here: the character and the template's reference clip go up as files, then the same request the creator
  // page sends; the app's progress panel follows the job to the result.
  const generate = async () => {
    if (!characterFile) return setSending({ state: "error", message: c("templates.motion.needCharacter") });
    const reference = t?.previewUrl;
    if (!t || !reference || !valid(reference)) return setSending({ state: "error", message: c("templates.motion.needReference") });
    if (!model) return setSending({ state: "error", message: c("templates.composer.pickModel") });
    if (!quality) return setSending({ state: "error", message: c("templates.composer.pickQuality") });
    const requestId = crypto.randomUUID();
    setSending({ state: "busy" });
    emitGenerationSubmitting({ feature: "motion-transfer", requestId });
    try {
      const sourceImage = await uploadImageAsset(characterFile, { purpose: "content", feature: "motion-transfer" });
      let motionVideo: string = reference;
      if (!/^https?:\/\//i.test(motionVideo)) {
        const response = await fetch(motionVideo);
        if (!response.ok) throw new Error(c("templates.motion.referenceFailed"));
        const blob = await response.blob();
        motionVideo = await uploadImageAsset(new File([blob], `${t.slug}.${blob.type.includes("webm") ? "webm" : "mp4"}`, { type: blob.type || "video/mp4" }), { purpose: "content", feature: "motion-transfer" });
      }
      const created = await createMotionTransferGeneration({
        sourceImage,
        motionVideo,
        model,
        quality,
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
      <div className={s.motionAssets}>
        <div className={s.motionReference}>
          {t && valid(t.thumbnailUrl) ? <Image src={t.thumbnailUrl} alt={name(t, locale)} fill unoptimized sizes="140px" className={s.poster} /> : <Video size={22} />}
          <span>{t ? name(t, locale) : c("templates.motion.reference")}</span>
          <button type="button" aria-label={c("templates.card.previewAria", { name: t ? name(t, locale) : c("templates.motion.reference") })} onClick={() => t && window.open(t.previewUrl || t.thumbnailUrl, "_blank", "noopener,noreferrer")}><Expand size={13} /></button>
        </div>
        <button type="button" className={s.motionCharacter} onClick={() => inputRef.current?.click()}>
          {character ? <Image src={character} alt={c("templates.motion.character")} fill unoptimized sizes="140px" className={s.poster} /> : <><Plus size={20} /><strong>{c("templates.motion.addCharacter")}</strong><small>{c("templates.motion.characterHint")}</small></>}
        </button>
      </div>
      <input ref={inputRef} className={s.visuallyHidden} type="file" accept="image/*" onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) { setCharacter(URL.createObjectURL(file)); setCharacterFile(file); setSending({ state: "idle" }); } event.currentTarget.value = ""; }} />
      <PickerRow label={c("templates.edit.setting.model")} value={model ? picker.labelOf(model) : c("templates.composer.pickModel")} placeholder={!model} heading={c("templates.composer.featuredModels")} empty={c("templates.composer.noModels")} options={modelOptions} selectedId={model} onPick={(id) => { setModel(id); setQuality(""); }} />
      <PickerRow label={c("templates.edit.setting.quality")} value={quality || c("templates.composer.pickQuality")} placeholder={!quality} heading={c("templates.edit.setting.quality")} empty={c("templates.composer.noModels")} options={qualityOptions} selectedId={quality} onPick={setQuality} />
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
function Composer({
  t,
  mode,
  onMode,
  options,
  onSelect,
  onClear,
  onUse,
  onExpand,
}: {
  t?: Template;
  mode: Mode;
  onMode: (mode: Mode) => void;
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
  const [variant, setVariant] = useState<"motion" | "swap">("motion");
  const [showPrompt, setShowPrompt] = useState(true);
  const [useFree, setUseFree] = useState(false);
  // What was picked in the two lists; for now it only changes what the rows show.
  const [picks, setPicks] = useState<{ templateId: string; model?: string; quality?: string }>({ templateId: "" });
  const picker = useModelPicker(mode === "motion" ? "motion-transfer" : mode === "edit" ? "extend-video" : "text-to-video");
  // The price follows the model and quality the panel shows: picked here, else the template's own.
  const quoteModel = t && picks.templateId === t.id && picks.model ? picks.model : typeof t?.settings?.model === "string" ? t.settings.model : "";
  const quoteQuality = t && picks.templateId === t.id && picks.quality ? picks.quality : typeof t?.settings?.resolution === "string" ? t.settings.resolution : undefined;
  // The creator's own defaults when the template does not say: 5 seconds, 16:9.
  const duration = typeof t?.settings?.duration === "number" ? t.settings.duration : 5;
  const aspectRatio = typeof t?.settings?.ratio === "string" ? t.settings.ratio : typeof t?.settings?.aspectRatio === "string" ? t.settings.aspectRatio : "16:9";
  const credits = useCreditQuote({ feature: "text-to-video", model: mode === "create" ? quoteModel : "", resolution: quoteQuality, duration, aspectRatio });
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const [sending, setSending] = useState<{ state: "idle" | "busy" | "sent" | "error"; message?: string }>({ state: "idle" });
  // Generates right here: the same request the creator page sends, then the app's progress panel follows it to the result.
  const generate = async (template: Template, model: string, resolution: string) => {
    const prompt = (promptRef.current?.value ?? "").trim();
    if (!prompt) return setSending({ state: "error", message: c("templates.composer.needPrompt") });
    if (!model) return setSending({ state: "error", message: c("templates.composer.pickModel") });
    if (!resolution) return setSending({ state: "error", message: c("templates.composer.pickQuality") });
    const requestId = crypto.randomUUID();
    setSending({ state: "busy" });
    emitGenerationSubmitting({ feature: "text-to-video", requestId });
    try {
      const created = await createTextVideoGeneration({ prompt, model, resolution, duration, aspectRatio });
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
  // As in the example: a two-way switch under the banner and a row that applies a style. Both are the layout only for now.
  const variantSwitch = (
    <div className={s.switch} role="group">
      {(
        [
          ["motion", "templates.composer.motionTransfer"],
          ["swap", "templates.composer.objectsSwap"],
        ] as const
      ).map(([id, key]) => (
        <button key={id} type="button" aria-pressed={variant === id} onClick={() => setVariant(id)}>
          {c(key)}
        </button>
      ))}
    </div>
  );
  const styleRow = (
    <button type="button" className={s.styleRow}>
      <span
        className={s.styleThumb}
        style={t && valid(t.thumbnailUrl) ? { backgroundImage: `url("${t.thumbnailUrl}")` } : undefined}
        aria-hidden="true"
      />
      <span className={s.styleName}>
        <small>{c("templates.composer.style")}</small>
        <strong>{c("templates.composer.styleNone")}</strong>
      </span>
      <span className={s.styleChange}>{c("templates.composer.styleChange")}</span>
    </button>
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
        {variantSwitch}
        {variant === "motion" && styleRow}
        <p className={s.composerEmpty}>{c("templates.composer.empty")}</p>
      </aside>
    );
  const facts = presetFacts(t, c);
  const primary = facts.filter((f) => f.key === "model" || f.key === "resolution");
  const advanced = facts.filter((f) => f.key !== "model" && f.key !== "resolution");
  const others = options.filter((o) => o.id !== t.id).slice(0, 1);
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
  const modelOptions = picker.options.length ? picker.options : [...modelMap.values()];
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
      {variantSwitch}
      {variant === "motion" && styleRow}
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
            </small>
          </span>
        </button>
      </div>
      <div className={s.composerSlots}>
        <span className={s.slotOptional}>{c("templates.composer.optional")}</span>
        <button type="button" className={s.slotAdd} onClick={() => setPicking(true)} aria-label={c("templates.composer.related")}>
          <Plus size={18} aria-hidden="true" />
        </button>
        {others.map((o) => (
          <button
            key={o.id}
            type="button"
            className={s.slotThumb}
            style={valid(o.thumbnailUrl) ? { backgroundImage: `url("${o.thumbnailUrl}")` } : undefined}
            onClick={() => onSelect(o.id)}
            aria-label={name(o, locale)}
            title={name(o, locale)}
          />
        ))}
      </div>
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
            key={`${t.id}-${variant}-${locale}`}
            ref={promptRef}
            className={s.composerPrompt}
            // "Motion transfer" starts from the template's prompt; "Objects swap" starts empty, with the grey example.
            defaultValue={variant === "motion" ? promptOf(t, locale) : ""}
            placeholder={c("templates.composer.promptPlaceholder")}
            aria-label={c("templates.composer.prompt")}
          />
        )}
      </section>
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
        <button type="button" className={s.use} disabled={sending.state === "busy"} onClick={() => void generate(t, shownModel, shownQuality)}>
          {sending.state === "busy" ? c("templates.composer.sending") : c("templates.edit.generate")} <Sparkles size={17} />
          {creditText(credits)}
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

/** "History": what was opened from here lately; before anything was, an invitation with the three steps. */
function HistoryPanel({
  mode,
  recent,
  items,
  onSelect,
  onExpand,
  onLibrary,
}: {
  mode: Mode;
  recent: Template[];
  items: Template[];
  onSelect: (t: Template) => void;
  onExpand: (t: Template) => void;
  /** Absent when this mode has no library to open. */
  onLibrary?: () => void;
}) {
  const { c } = useStudioCopy();
  const covers = items.filter((t) => valid(t.thumbnailUrl));
  const steps = stepsByMode[mode];
  const hero = heroKeys[mode];
  if (recent.length)
    return (
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
    );
  return (
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
  );
}

/** "Categories": every category as a large cover card; picking one filters the library to it. */
function CategoryPanel({ items, onPick }: { items: Template[]; onPick: (category: string) => void }) {
  const { c } = useStudioCopy();
  const groups = new Map<string, { cover?: string; count: number }>();
  for (const t of items) {
    const group = groups.get(t.category) ?? { count: 0 };
    group.count += 1;
    if (!group.cover && valid(t.thumbnailUrl)) group.cover = t.thumbnailUrl;
    groups.set(t.category, group);
  }
  return (
    <section>
      <div className={s.libraryHero}>
        <div className={s.libraryHeroCopy}>
          <h1>{c("templates.styles.heading")}</h1>
          <p>{c("templates.styles.body")}</p>
        </div>
      </div>
      <div className={s.categoryGrid}>
        {[...groups.entries()].map(([category, group]) => (
          <button
            key={category}
            type="button"
            className={s.categoryCard}
            style={group.cover ? { backgroundImage: `url("${group.cover}")` } : undefined}
            onClick={() => onPick(category)}
          >
            <strong>{category}</strong>
            <small>{c("templates.styles.count", { count: group.count })}</small>
          </button>
        ))}
      </div>
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
                <div><dt>{c("templates.preview.clipSource")}</dt><dd>{c("templates.preview.clipTemplate")}</dd></div>
                <div><dt>{c("templates.preview.clipType")}</dt><dd>{c(kindKeys.video)}</dd></div>
                <div><dt>{c("templates.preview.clipFormat")}</dt><dd>{videoFormat}</dd></div>
              </dl>
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
  const [q, setQ] = useState(""),
    [mode, setMode] = useState<Mode>(DEFAULT_MODE),
    [category, setCategory] = useState("all"),
    [sort, setSort] = useState<SortId>("recommended"),
    [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<TemplatePagination>({ page: 1, limit: 24, total: 0, totalPages: 1 }),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(false),
    [retry, setRetry] = useState(0),
    [preview, setPreview] = useState<Template | null>(null),
    [selectedId, setSelectedId] = useState<string | null>(null),
    [panel, setPanel] = useState<"history" | "library" | "styles" | "how">("history"),
    [recent, setRecent] = useState<Template[]>([]);
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
        // The server orders by "recommended" or "newest" only; "popular" uses the recommended order until it has usage counts.
        listTemplates({ search: q, category, sort: sort === "newest" ? "newest" : "recommended", page, limit: 24, signal: c.signal })
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
  }, [q, category, sort, page, retry]);
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
    setSort("recommended");
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
    <div className={s.page} data-page="templates" data-no-translate>
      <div className={s.workspace}>
        <Composer
          t={selected ?? (mode === "edit" ? items.find((item) => item.kind === "video") : undefined)}
          mode={mode}
          onMode={switchMode}
          options={ofMode}
          onSelect={setSelectedId}
          onClear={() => setSelectedId("")}
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
            <HowItWorks key={mode} mode={mode} items={visible} onSelect={(item) => setSelectedId(item.id)} />
          ) : activePanel === "history" ? (
            <HistoryPanel
              mode={mode}
              recent={recentForMode}
              items={visible}
              onSelect={(t) => setSelectedId(t.id)}
              onExpand={setPreview}
              onLibrary={mode === "edit" ? undefined : () => setPanel("library")}
            />
          ) : activePanel === "styles" ? (
            <CategoryPanel
              items={ofMode}
              onPick={(cat) => {
                setCategory(cat);
                change();
                setPanel("library");
              }}
            />
          ) : (
            <>
              <LibraryHero mode={mode} items={visible} />
              <section className={s.toolbar} aria-label={c("templates.filtersAria")}>
                <div className={s.tabs}>
                  {sortOptions.map(([id, key]) => (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={sort === id}
                      onClick={() => {
                        if (sort === id) return;
                        setSort(id);
                        change();
                      }}
                    >
                      {(() => {
                        const SortIcon = sortIcons[id];
                        return <SortIcon size={14} aria-hidden="true" />;
                      })()}
                      {c(key)}
                    </button>
                  ))}
                </div>
              </section>
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
  );
}
