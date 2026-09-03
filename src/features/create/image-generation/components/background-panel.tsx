"use client";

import Image from "next/image";
import { Eraser, Info, Upload, WandSparkles } from "lucide-react";
import { backgroundModes, type BackgroundMode, type StylePreset } from "../config";
import type { GenerationStylePreset } from "@/lib/api/style-presets";
import type { ImageUploadConstraints } from "@/lib/media/upload-validation";
import { cx } from "../styles";
import { PromptField } from "@/components/ui/prompt-field";
import { SourceImageUpload } from "./source-image-upload";
import { PromptOptimizerToggle } from "./prompt-optimizer-toggle";

type BackgroundPanelProps = {
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
  return <div className={cx("gen-background-mode-grid")} role="tablist" aria-label="AI Background mode">
    {backgroundModes.map((mode) => <button type="button" key={mode.id} role="tab" aria-selected={value === mode.id} className={cx(value === mode.id && "is-selected")} onClick={() => onChange(mode.id)}><span className={cx("gen-background-mode-icon")}>{mode.id === "remove" ? <Eraser size={16} /> : mode.id === "replace" ? <Upload size={16} /> : mode.id === "generate" ? <WandSparkles size={16} /> : <span className={cx("gen-color-mode-icon")} />}</span><span><b>{mode.shortLabel}</b><small>{mode.description}</small></span></button>)}
  </div>;
}

function presetThumbStyle(imageUrl: string | null): { backgroundImage: string; backgroundSize: string; backgroundPosition: string } | undefined {
  if (!imageUrl) return undefined;
  return { backgroundImage: `url("${imageUrl.replaceAll('"', "\\\"")}")`, backgroundSize: "cover", backgroundPosition: "center" };
}

export function BackgroundPanel({ backgroundMode, sourceImage, backgroundReferenceImage, backgroundPrompt, backgroundColor, preserveSubject, edgeCleanup, addShadow, matchLighting, style, stylePresetOptions, workspaceId, imageUploadConstraints, backgroundSupportsInput, backgroundSupportsPrompt, onBackgroundModeChange, onSourceImageChange, onSourceImageClear, onBackgroundReferenceImageChange, onBackgroundReferenceImageClear, onBackgroundPromptChange, promptOptimizerEnabled, onPromptOptimizerChange, onBackgroundColorChange, onPreserveSubjectChange, onEdgeCleanupChange, onAddShadowChange, onMatchLightingChange, onStyleChange }: BackgroundPanelProps) {
  return <aside className={cx("gen-panel", "gen-prompt-panel", "gen-background-panel")}>
    <div className={cx("gen-section-heading")}><h3>MODE</h3><Info size={12} /></div>
    <BackgroundModeSelector value={backgroundMode} onChange={onBackgroundModeChange} />

    {(backgroundMode === "replace" || backgroundMode === "generate") && backgroundSupportsPrompt && <section className={cx("gen-background-section")}><div className={cx("gen-panel-title")}><h2>PROMPT <em>(Required)</em></h2><Image src="/generated-assets/be-descriptive.png" alt="Be descriptive" width={2051} height={509} className={cx("gen-prompt-annotation")} /></div><PromptField id="gen-background-prompt" value={backgroundPrompt} onChange={onBackgroundPromptChange} ariaLabel={`${backgroundMode === "replace" ? "Background replacement" : "Generated background"} prompt`} required wrapperClassName={cx("gen-textarea-wrap", "gen-background-prompt")} metaClassName={cx("gen-prompt-meta")} /><PromptOptimizerToggle enabled={promptOptimizerEnabled} onChange={onPromptOptimizerChange} /></section>}
    {(backgroundMode === "replace" || backgroundMode === "generate") && !backgroundSupportsPrompt && <p className={cx("gen-inline-helper")}>The selected model does not accept a prompt. Use a background reference image if the model supports one.</p>}

    <div className={cx("gen-section-heading")}><h3>SOURCE IMAGE <em>(Required)</em></h3></div>
    <SourceImageUpload imageUrl={sourceImage} onImageChange={onSourceImageChange} onClear={onSourceImageClear} purpose="content" feature="background-removal" workspaceId={workspaceId} imageConstraints={imageUploadConstraints} disabled={!backgroundSupportsInput} />
    <p className={cx("gen-inline-helper")}>Upload the original image. Your subject stays protected while the background changes.</p>

    {backgroundMode === "replace" && <section className={cx("gen-background-section")}><div className={cx("gen-section-heading")}><h3>BACKGROUND REFERENCE <em>(Optional)</em></h3></div><SourceImageUpload imageUrl={backgroundReferenceImage} onImageChange={onBackgroundReferenceImageChange} onClear={onBackgroundReferenceImageClear} purpose="background-reference" feature="background-removal" workspaceId={workspaceId} imageConstraints={imageUploadConstraints} /><p className={cx("gen-inline-helper")}>Use either a prompt, a reference image, or both.</p></section>}

    {backgroundMode === "generate" && <section className={cx("gen-background-section")}><div className={cx("gen-section-heading")}><h3>STYLE PRESETS</h3></div><div className={cx("gen-background-style-grid")}>
      {stylePresetOptions.map((preset) => <button type="button" key={preset.id} className={cx(style === preset.name && "is-selected")} aria-pressed={style === preset.name} onClick={() => onStyleChange(style === preset.name ? null : preset.name)}><span style={presetThumbStyle(preset.imageUrl)} role="img" aria-label={`${preset.name} background style`} /><small>{preset.name}</small></button>)}
    </div></section>}

    {backgroundMode === "solid" && <section className={cx("gen-background-section")}><div className={cx("gen-section-heading")}><h3>BACKGROUND COLOR</h3></div><label className={cx("gen-color-picker")}><span className={cx("gen-color-swatch")} style={{ backgroundColor: backgroundColor }} /><span><b>Solid color</b><small>{backgroundColor.toUpperCase()}</small></span><input type="color" value={backgroundColor} onChange={(event) => onBackgroundColorChange(event.target.value)} aria-label="Background color" /></label></section>}

  </aside>;
}
