"use client";

import Image from "next/image";
import { Eraser, Info, Upload, WandSparkles } from "lucide-react";
import type { ReactNode } from "react";
import { backgroundModes, type BackgroundMode, type StylePreset } from "../config";
import type { GenerationStylePreset } from "@/lib/api/style-presets";
import type { ImageUploadConstraints } from "@/lib/media/upload-validation";
import { cx } from "../styles";
import { PromptField } from "@/components/ui/prompt-field";
import { SourceImageUpload } from "./source-image-upload";
import { PromptOptimizerToggle } from "./prompt-optimizer-toggle";
import { useLocale } from "@/lib/i18n/locale-provider";

type BackgroundPanelProps = {
  tutorialButton?: ReactNode;
  backgroundMode: BackgroundMode;
  sourceImage: string | null;
  backgroundReferenceImage: string | null;
  backgroundPrompt: string;
  backgroundColor: string;
  preserveSubject: boolean;
  edgeCleanup: boolean;
  addShadow: boolean;
  matchLighting: boolean;
  style: StylePreset | null;
  stylePresetOptions: GenerationStylePreset[];
  workspaceId: string | null;
  imageUploadConstraints?: ImageUploadConstraints;
  backgroundSupportsInput: boolean;
  backgroundSupportsPrompt: boolean;
  onBackgroundModeChange: (mode: BackgroundMode) => void;
  onSourceImageChange: (imageUrl: string) => void;
  onSourceImageClear: () => void;
  onBackgroundReferenceImageChange: (imageUrl: string) => void;
  onBackgroundReferenceImageClear: () => void;
  onBackgroundPromptChange: (prompt: string) => void;
  promptOptimizerEnabled: boolean;
  onPromptOptimizerChange: (enabled: boolean) => void;
  onBackgroundColorChange: (color: string) => void;
  onPreserveSubjectChange: (enabled: boolean) => void;
  onEdgeCleanupChange: (enabled: boolean) => void;
  onAddShadowChange: (enabled: boolean) => void;
  onMatchLightingChange: (enabled: boolean) => void;
  onStyleChange: (style: StylePreset | null) => void;
};

function BackgroundModeSelector({ value, onChange }: { value: BackgroundMode; onChange: (mode: BackgroundMode) => void }) {
  const { t } = useLocale();
  const modeKeys = {
    remove: ["create.image.backgroundModes.removeShort", "create.image.backgroundModes.removeDescription"],
    replace: ["create.image.backgroundModes.replaceShort", "create.image.backgroundModes.replaceDescription"],
    generate: ["create.image.backgroundModes.generateShort", "create.image.backgroundModes.generateDescription"],
    solid: ["create.image.backgroundModes.solidShort", "create.image.backgroundModes.solidDescription"],
  } as const;
  return <div className={cx("gen-background-mode-grid")} role="tablist" aria-label={t("create.image.backgroundModes.generate")}>
    {backgroundModes.filter((mode) => mode.id !== "solid").map((mode) => { const [shortKey, descriptionKey] = modeKeys[mode.id]; return <button type="button" key={mode.id} role="tab" aria-selected={value === mode.id} className={cx(value === mode.id && "is-selected")} onClick={() => onChange(mode.id)}><span className={cx("gen-background-mode-icon")}>{mode.id === "remove" ? <Eraser size={16} /> : mode.id === "replace" ? <Upload size={16} /> : <WandSparkles size={16} />}</span><span><b>{t(shortKey)}</b><small>{t(descriptionKey)}</small></span></button>; })}
  </div>;
}

function presetThumbStyle(imageUrl: string | null): { backgroundImage: string; backgroundSize: string; backgroundPosition: string } | undefined {
  if (!imageUrl) return undefined;
  return { backgroundImage: `url("${imageUrl.replaceAll('"', "\\\"")}")`, backgroundSize: "cover", backgroundPosition: "center" };
}

export function BackgroundPanel({ tutorialButton, backgroundMode, sourceImage, backgroundReferenceImage, backgroundPrompt, backgroundColor, preserveSubject, edgeCleanup, addShadow, matchLighting, style, stylePresetOptions, workspaceId, imageUploadConstraints, backgroundSupportsInput, backgroundSupportsPrompt, onBackgroundModeChange, onSourceImageChange, onSourceImageClear, onBackgroundReferenceImageChange, onBackgroundReferenceImageClear, onBackgroundPromptChange, promptOptimizerEnabled, onPromptOptimizerChange, onBackgroundColorChange, onPreserveSubjectChange, onEdgeCleanupChange, onAddShadowChange, onMatchLightingChange, onStyleChange }: BackgroundPanelProps) {
  const { t } = useLocale();
  return <aside className={cx("gen-panel", "gen-prompt-panel", "gen-background-panel")}>
    <div className={cx("gen-prompt-top-action")}>{tutorialButton}</div><div className={cx("gen-section-heading")}><h3>{t("create.mode")}</h3><Info size={12} /></div>
    <BackgroundModeSelector value={backgroundMode} onChange={onBackgroundModeChange} />

    {(backgroundMode === "replace" || backgroundMode === "generate") && backgroundSupportsPrompt && <section className={cx("gen-background-section")}><div className={cx("gen-panel-title")}><h2>{t("create.prompt")} <em>({t("create.required")})</em></h2><Image src="/generated-assets/be-descriptive.png" alt={t("create.prompt")} width={2051} height={509} className={cx("gen-prompt-annotation")} /></div><PromptField id="gen-background-prompt" value={backgroundPrompt} onChange={onBackgroundPromptChange} ariaLabel={`${backgroundMode === "replace" ? t("create.image.background.reference") : t("create.image.background.stylePresets")} ${t("create.prompt")}`} required wrapperClassName={cx("gen-textarea-wrap", "gen-background-prompt")} metaClassName={cx("gen-prompt-meta")} /><PromptOptimizerToggle enabled={promptOptimizerEnabled} onChange={onPromptOptimizerChange} /></section>}
    {(backgroundMode === "replace" || backgroundMode === "generate") && !backgroundSupportsPrompt && <p className={cx("gen-inline-helper")}>{t("create.image.background.noPromptHelper")}</p>}

    <div className={cx("gen-section-heading")}><h3>{t("create.image.background.sourceImage")} <em>({t("create.required")})</em></h3></div>
    <SourceImageUpload imageUrl={sourceImage} onImageChange={onSourceImageChange} onClear={onSourceImageClear} purpose="content" feature="background-removal" workspaceId={workspaceId} imageConstraints={imageUploadConstraints} disabled={!backgroundSupportsInput} />
    <p className={cx("gen-inline-helper")}>{t("create.image.background.sourceHelper")}</p>

    {backgroundMode === "replace" && <section className={cx("gen-background-section")}><div className={cx("gen-section-heading")}><h3>{t("create.image.background.reference")} <em>({t("create.optional")})</em></h3></div><SourceImageUpload imageUrl={backgroundReferenceImage} onImageChange={onBackgroundReferenceImageChange} onClear={onBackgroundReferenceImageClear} purpose="background-reference" feature="background-removal" workspaceId={workspaceId} imageConstraints={imageUploadConstraints} /><p className={cx("gen-inline-helper")}>{t("create.image.background.referenceHelper")}</p></section>}

    {backgroundMode === "generate" && <section className={cx("gen-background-section")}><div className={cx("gen-section-heading")}><h3>{t("create.image.background.stylePresets")}</h3></div><div className={cx("gen-background-style-grid")}>
      {stylePresetOptions.map((preset) => <button type="button" key={preset.id} className={cx(style === preset.name && "is-selected")} aria-pressed={style === preset.name} onClick={() => onStyleChange(style === preset.name ? null : preset.name)}><span style={presetThumbStyle(preset.imageUrl)} role="img" aria-label={`${preset.name} background style`} /><small>{preset.name}</small></button>)}
    </div></section>}

    {backgroundMode === "solid" && <section className={cx("gen-background-section")}><div className={cx("gen-section-heading")}><h3>{t("create.image.background.color")}</h3></div><label className={cx("gen-color-picker")}><span className={cx("gen-color-swatch")} style={{ backgroundColor: backgroundColor }} /><span><b>{t("create.image.background.solidColor")}</b><small>{backgroundColor.toUpperCase()}</small></span><input type="color" value={backgroundColor} onChange={(event) => onBackgroundColorChange(event.target.value)} aria-label={t("create.image.background.colorLabel")} /></label></section>}

  </aside>;
}
