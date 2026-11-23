import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import {
  ArrowUpRight,
  AudioLines,
  AtSign,
  Check,
  ChevronDown,
  ChevronRight,
  Eraser,
  ImagePlus,
  PenLine,
  Pencil,
  MousePointer2,
  PanelsTopLeft,
  Plus,
  SlidersHorizontal,
  Square,
  Sparkles,
  Trash2,
  Type,
  Video,
  Zap,
  X,
} from "lucide-react";
import { useStudioCopy, type StudioCopyKey } from "@/lib/i18n/studio-copy";
import Image from "next/image";
import s from "./templates-page.module.css";
import { type EditToolId } from "./library-modes";

export type FlyoutOption = { id: string; label: string; chips?: string[]; badge?: string };

export function EditWorkspace({ tool, poster }: { tool: EditToolId; poster?: string }) {
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
