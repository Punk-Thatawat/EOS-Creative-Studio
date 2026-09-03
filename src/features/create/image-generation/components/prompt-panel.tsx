import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Check, ChevronDown, ChevronLeft, ChevronRight, CircleOff, Info } from "lucide-react";
import { textToImagePromptMaxLength, type ExtendAmount, type ExtendDirection, type ImageGenerationTab, type StylePreset, type StyleSourceMode, type StyleTransferPreset } from "../config";
import type { GenerationStylePreset } from "@/lib/api/style-presets";
import type { ImageUploadConstraints } from "@/lib/media/upload-validation";
import { cx } from "../styles";
import { PromptField } from "@/components/ui/prompt-field";
import { SourceImageUpload } from "./source-image-upload";
import { BackgroundPanel } from "./background-panel";
import { ExtendPanel } from "./extend-panel";
import { UpscalePanel } from "./upscale-panel";
import { PromptOptimizerToggle } from "./prompt-optimizer-toggle";

type PromptPanelProps = {
  activeTab: ImageGenerationTab;
  tutorialButton?: ReactNode;
  prompt: string;
  negativePrompt: string;
  style: StylePreset | null;
  stylePresetOptions: GenerationStylePreset[];
  styleTransferPresetOptions: GenerationStylePreset[];
  sourceImage: string | null;
  sourceImages?: string[];
  maxSourceImages?: number;
  imageUploadConstraints?: ImageUploadConstraints;
  workspaceId: string | null;
  styleSourceMode: StyleSourceMode;
  styleTransferPreset: StyleTransferPreset;
  styleReferenceImage: string | null;
  imageStrength: number;
  contentPreservation: number;
  facePreservation: boolean;
  onPromptChange: (prompt: string) => void;
  promptOptimizerEnabled: boolean;
  onPromptOptimizerChange: (enabled: boolean) => void;
  onNegativePromptChange: (prompt: string) => void;
  onStyleChange: (style: StylePreset | null) => void;
  onSourceImageChange: (imageUrl: string) => void;
  onSourceImagesChange?: (imageUrls: string[]) => void;
  onSourceImageClear: () => void;
  onStyleSourceModeChange: (mode: StyleSourceMode) => void;
  onStyleTransferPresetChange: (preset: StyleTransferPreset) => void;
  onStyleReferenceImageChange: (imageUrl: string) => void;
  onStyleReferenceImageClear: () => void;
  onImageStrengthChange: (strength: number) => void;
  onContentPreservationChange: (preservation: number) => void;
  onFacePreservationChange: (enabled: boolean) => void;
  styleTransferSupportsInput?: boolean;
  styleTransferSupportsReference?: boolean;
  styleTransferSupportsStrength?: boolean;
  styleTransferSupportsContentPreservation?: boolean;
  backgroundMode: import("../config").BackgroundMode;
  backgroundReferenceImage: string | null;
  backgroundPrompt: string;
  backgroundColor: string;
  preserveSubject: boolean;
  edgeCleanup: boolean;
  addShadow: boolean;
  matchLighting: boolean;
  backgroundSupportsInput: boolean;
  backgroundSupportsPrompt: boolean;
  extendPrompt: string;
  extendDirection: ExtendDirection;
  extendAmount: ExtendAmount;
  onBackgroundModeChange: (mode: import("../config").BackgroundMode) => void;
  onBackgroundReferenceImageChange: (imageUrl: string) => void;
  onBackgroundReferenceImageClear: () => void;
  onBackgroundPromptChange: (prompt: string) => void;
  onBackgroundColorChange: (color: string) => void;
  onPreserveSubjectChange: (enabled: boolean) => void;
  onEdgeCleanupChange: (enabled: boolean) => void;
  onAddShadowChange: (enabled: boolean) => void;
  onMatchLightingChange: (enabled: boolean) => void;
  onExtendPromptChange: (prompt: string) => void;
  onExtendDirectionChange: (direction: ExtendDirection) => void;
  onExtendAmountChange: (amount: ExtendAmount) => void;
};

function presetThumbStyle(imageUrl: string | null): { backgroundImage: string; backgroundSize: string; backgroundPosition: string } | undefined {
  if (!imageUrl) return undefined;
  return { backgroundImage: `url("${imageUrl.replaceAll('"', "\\\"")}")`, backgroundSize: "cover", backgroundPosition: "center" };
}

export function PromptPanel({ activeTab, tutorialButton, prompt, negativePrompt, style, stylePresetOptions, styleTransferPresetOptions, sourceImage, sourceImages = [], maxSourceImages = 1, imageUploadConstraints, workspaceId, styleSourceMode, styleTransferPreset, styleReferenceImage, imageStrength, contentPreservation, facePreservation, onPromptChange, promptOptimizerEnabled, onPromptOptimizerChange, onNegativePromptChange, onStyleChange, onSourceImageChange, onSourceImagesChange, onSourceImageClear, onStyleSourceModeChange, onStyleTransferPresetChange, onStyleReferenceImageChange, onStyleReferenceImageClear, onImageStrengthChange, onContentPreservationChange, onFacePreservationChange, styleTransferSupportsInput = true, styleTransferSupportsReference = true, styleTransferSupportsStrength = true, styleTransferSupportsContentPreservation = true, backgroundMode, backgroundReferenceImage, backgroundPrompt, backgroundColor, preserveSubject, edgeCleanup, addShadow, matchLighting, backgroundSupportsInput, backgroundSupportsPrompt = true, extendPrompt, extendDirection, extendAmount, onBackgroundModeChange, onBackgroundReferenceImageChange, onBackgroundReferenceImageClear, onBackgroundPromptChange, onBackgroundColorChange, onPreserveSubjectChange, onEdgeCleanupChange, onAddShadowChange, onMatchLightingChange, onExtendPromptChange, onExtendDirectionChange, onExtendAmountChange }: PromptPanelProps) {
  const imageToImage = activeTab === "Image to Image";
  const styleTransfer = activeTab === "AI Style Transfer";
  const background = activeTab === "AI Background";
  const extend = activeTab === "Extend Image";
  const upscale = activeTab === "Upscale";
  const stylePresetRowRef = useRef<HTMLDivElement>(null);
  const [stylePresetScrollState, setStylePresetScrollState] = useState({ canGoBack: false, canGoForward: false });

  useEffect(() => {
    const row = stylePresetRowRef.current;
    if (!row) return;

    const updateScrollState = () => {
      const maxScrollLeft = Math.max(0, row.scrollWidth - row.clientWidth);
      setStylePresetScrollState({
        canGoBack: row.scrollLeft > 2,
        canGoForward: row.scrollLeft < maxScrollLeft - 2,
      });
    };
    updateScrollState();
    const frameId = window.requestAnimationFrame(updateScrollState);
    const resizeObserver = new ResizeObserver(updateScrollState);
    resizeObserver.observe(row);
    row.querySelectorAll("img").forEach((image) => image.addEventListener("load", updateScrollState));
    row.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState);

    return () => {
      window.cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      row.querySelectorAll("img").forEach((image) => image.removeEventListener("load", updateScrollState));
      row.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
    };
  }, [activeTab, stylePresetOptions.length, styleTransferPresetOptions.length]);

  const scrollStylePresets = (direction: 1 | -1) => {
    const row = stylePresetRowRef.current;
    if (!row) return;
    const firstItem = row.querySelector<HTMLElement>("button");
    if (!firstItem) return;
    const styles = window.getComputedStyle(row);
    const gap = Number.parseFloat(styles.columnGap || styles.gap || "0") || 0;
    const itemStep = firstItem.getBoundingClientRect().width + gap;
    const visibleItemCount = Math.max(1, Math.floor((row.clientWidth + gap) / itemStep));
    row.scrollBy({ left: visibleItemCount * itemStep * direction, behavior: "smooth" });
  };

  if (background) {
    return <BackgroundPanel tutorialButton={tutorialButton} backgroundMode={backgroundMode} sourceImage={sourceImage} backgroundReferenceImage={backgroundReferenceImage} backgroundPrompt={backgroundPrompt} backgroundColor={backgroundColor} preserveSubject={preserveSubject} edgeCleanup={edgeCleanup} addShadow={addShadow} matchLighting={matchLighting} style={style} stylePresetOptions={stylePresetOptions} workspaceId={workspaceId} imageUploadConstraints={imageUploadConstraints} backgroundSupportsInput={backgroundSupportsInput} backgroundSupportsPrompt={backgroundSupportsPrompt} onBackgroundModeChange={onBackgroundModeChange} onSourceImageChange={onSourceImageChange} onSourceImageClear={onSourceImageClear} onBackgroundReferenceImageChange={onBackgroundReferenceImageChange} onBackgroundReferenceImageClear={onBackgroundReferenceImageClear} onBackgroundPromptChange={onBackgroundPromptChange} promptOptimizerEnabled={promptOptimizerEnabled} onPromptOptimizerChange={onPromptOptimizerChange} onBackgroundColorChange={onBackgroundColorChange} onPreserveSubjectChange={onPreserveSubjectChange} onEdgeCleanupChange={onEdgeCleanupChange} onAddShadowChange={onAddShadowChange} onMatchLightingChange={onMatchLightingChange} onStyleChange={onStyleChange} />;
  }

  if (extend) {
    return <ExtendPanel tutorialButton={tutorialButton} sourceImage={sourceImage} workspaceId={workspaceId} imageUploadConstraints={imageUploadConstraints} prompt={extendPrompt} negativePrompt={negativePrompt} direction={extendDirection} amount={extendAmount} onSourceImageChange={onSourceImageChange} onSourceImageClear={onSourceImageClear} onPromptChange={onExtendPromptChange} promptOptimizerEnabled={promptOptimizerEnabled} onPromptOptimizerChange={onPromptOptimizerChange} onNegativePromptChange={onNegativePromptChange} onDirectionChange={onExtendDirectionChange} onAmountChange={onExtendAmountChange} />;
  }

  if (upscale) {
    return <UpscalePanel tutorialButton={tutorialButton} sourceImage={sourceImage} workspaceId={workspaceId} imageUploadConstraints={imageUploadConstraints} onSourceImageChange={onSourceImageChange} onSourceImageClear={onSourceImageClear} />;
  }

  if (styleTransfer) {
    return <aside className={cx("gen-panel", "gen-prompt-panel", "gen-style-transfer-panel")}>
      <div className={cx("gen-prompt-top-action")}>{tutorialButton}</div><div className={cx("gen-panel-title")}><h2>PROMPT <em>(Optional)</em></h2><Image src="/generated-assets/be-descriptive.png" alt="Be descriptive" width={2051} height={509} className={cx("gen-prompt-annotation")} /></div>
      <PromptField id="gen-style-transfer-prompt" value={prompt} onChange={onPromptChange} placeholder="Apply soft cinematic lighting and detailed brush texture" ariaLabel="Optional style transfer prompt" wrapperClassName={cx("gen-textarea-wrap", "gen-style-transfer-prompt")} metaClassName={cx("gen-prompt-meta")} />
      <PromptOptimizerToggle enabled={promptOptimizerEnabled} onChange={onPromptOptimizerChange} />

      <div className={cx("gen-section-heading")}><h3>CONTENT IMAGE <em>(Required)</em></h3></div>
      <SourceImageUpload imageUrl={sourceImage} onImageChange={onSourceImageChange} onClear={onSourceImageClear} purpose="content" feature="ai-style-transfer" workspaceId={workspaceId} imageConstraints={imageUploadConstraints} disabled={!styleTransferSupportsInput} />
      <p className={cx("gen-inline-helper")}>Upload the image you want to restyle while keeping its subject and composition.</p>

      <div className={cx("gen-section-heading")}><h3>STYLE SOURCE <em>(Choose one)</em></h3></div>
      <div className={cx("gen-style-source-switch")} role="tablist" aria-label="Style source">
        <button type="button" role="tab" aria-selected={styleSourceMode === "preset"} className={styleSourceMode === "preset" ? cx("is-selected") : undefined} onClick={() => onStyleSourceModeChange("preset")}>Style preset</button>
        <button type="button" role="tab" aria-selected={styleSourceMode === "reference"} className={styleSourceMode === "reference" ? cx("is-selected") : undefined} onClick={() => onStyleSourceModeChange("reference")} disabled={!styleTransferSupportsReference}>Upload reference</button>
      </div>
      {styleSourceMode === "preset" ? <div className={cx("gen-style-transfer-gallery")}>
        <div className={cx("gen-style-transfer-grid")} ref={stylePresetRowRef}>
          {styleTransferPresetOptions.map((item) => <button type="button" key={item.id} onClick={() => onStyleTransferPresetChange(item.name)} className={styleTransferPreset === item.name ? cx("is-selected") : undefined} aria-pressed={styleTransferPreset === item.name}>
            <span className={cx("gen-style-transfer-thumb")} style={presetThumbStyle(item.imageUrl)} role="img" aria-label={`${item.name} style preset`}>{styleTransferPreset === item.name && <span className={cx("gen-selected-check")}><Check size={11} strokeWidth={3} /></span>}</span>
            <small>{item.name}</small>
          </button>)}
        </div>
        {stylePresetScrollState.canGoBack && <button type="button" className={cx("gen-gallery-prev")} onClick={() => scrollStylePresets(-1)} aria-label="Previous style transfer presets"><ChevronLeft size={18} /></button>}
        {stylePresetScrollState.canGoForward && <button type="button" className={cx("gen-gallery-next")} onClick={() => scrollStylePresets(1)} aria-label="Next style transfer presets"><ChevronRight size={18} /></button>}
      </div> : <div className={cx("gen-style-transfer-reference")}>
        <SourceImageUpload imageUrl={styleReferenceImage} onImageChange={onStyleReferenceImageChange} onClear={onStyleReferenceImageClear} purpose="style-reference" feature="ai-style-transfer" workspaceId={workspaceId} imageConstraints={imageUploadConstraints} disabled={!styleTransferSupportsReference} />
        <p className={cx("gen-inline-helper")}>Use another image as the visual style reference.</p>
      </div>}{!styleTransferSupportsReference && <p className={cx("gen-upload-helper", "is-disabled")}>This model does not support style reference images. Use a preset or prompt.</p>}

      <div className={cx("gen-range-control", !styleTransferSupportsStrength && "is-disabled")}><div><span>STYLE STRENGTH <Info size={12} /></span><strong>{imageStrength}%</strong></div><input type="range" min="0" max="100" step="1" value={imageStrength} onChange={(event) => onImageStrengthChange(Number(event.target.value))} aria-label="Style strength" disabled={!styleTransferSupportsStrength} /><p><span>Low keeps the original image</span><span>High makes the new style stronger</span></p>{!styleTransferSupportsStrength && <small>This model does not support style strength.</small>}</div>
      <div className={cx("gen-range-control", !styleTransferSupportsContentPreservation && "is-disabled")}><div><span>CONTENT PRESERVATION <Info size={12} /></span><strong>{contentPreservation}%</strong></div><input type="range" min="0" max="100" step="1" value={contentPreservation} onChange={(event) => onContentPreservationChange(Number(event.target.value))} aria-label="Content preservation" disabled={!styleTransferSupportsContentPreservation} /><p><span>Loose transformation</span><span>Keep face, objects & composition</span></p>{!styleTransferSupportsContentPreservation && <small>This model does not support content preservation.</small>}</div>

      <details className={cx("gen-advanced")}>
        <summary><span>ADVANCED</span><ChevronDown size={15} /></summary>
        <div className={cx("gen-advanced-body")}>
          <div className={cx("gen-advanced-field")}><label htmlFor="gen-negative-prompt-style">Negative prompt</label><PromptField id="gen-negative-prompt-style" value={negativePrompt} onChange={onNegativePromptChange} placeholder="blurry, distorted, low quality" ariaLabel="Style transfer negative prompt" multiline={false} maxLength={100} wrapperClassName={cx("gen-input-wrap")} metaClassName={cx("gen-prompt-meta")} /></div>
          <div className={cx("gen-face-preservation")}><span><b>Face preservation</b><small>Protect facial identity where possible</small></span><button type="button" className={cx("gen-toggle", facePreservation && "is-on")} aria-label={`Face preservation ${facePreservation ? "on" : "off"}`} aria-pressed={facePreservation} onClick={() => onFacePreservationChange(!facePreservation)}><i /></button></div>
        </div>
      </details>
    </aside>;
  }

  return <aside className={cx("gen-panel", "gen-prompt-panel", imageToImage && "is-image-to-image")}>
    <div className={cx("gen-prompt-top-action")}>{tutorialButton}</div><div className={cx("gen-panel-title")}><h2>PROMPT <em>(Required)</em></h2><Image src="/generated-assets/be-descriptive.png" alt="Be descriptive" width={2051} height={509} className={cx("gen-prompt-annotation")} /></div>
    <PromptField id="gen-prompt-input" value={prompt} onChange={onPromptChange} placeholder={imageToImage ? "Describe how you want to transform the image" : undefined} ariaLabel={imageToImage ? "Describe how you want to transform the image" : "Prompt"} maxLength={textToImagePromptMaxLength} required={!imageToImage} wrapperClassName={cx("gen-textarea-wrap")} metaClassName={cx("gen-prompt-meta")} />
    <PromptOptimizerToggle enabled={promptOptimizerEnabled} onChange={onPromptOptimizerChange} />
    {imageToImage && <><div className={cx("gen-section-heading")}><h3>REFERENCE IMAGES <em>(Required{maxSourceImages > 1 ? ` · up to ${maxSourceImages}` : ""})</em></h3></div><SourceImageUpload imageUrl={sourceImage} onImageChange={onSourceImageChange} onClear={onSourceImageClear} imageUrls={sourceImages} onImagesChange={onSourceImagesChange} maxImages={maxSourceImages} purpose="content" feature="image-to-image" workspaceId={workspaceId} imageConstraints={imageUploadConstraints} /></>}
    <div className={cx("gen-section-heading")}><h3>STYLE PRESETS</h3><button type="button">View all</button></div>
    <div className={cx("gen-style-preset-gallery")}>
      <div className={cx("gen-style-grid")} ref={stylePresetRowRef}>
        <button type="button" onClick={() => onStyleChange(null)} className={style === null ? cx("is-selected") : undefined} aria-pressed={style === null}>
          <span className={cx("gen-style-thumb", "gen-style-none")}><CircleOff size={22} strokeWidth={1.7} className={cx("gen-style-none-icon")} />{style === null && <span className={cx("gen-selected-check")}><Check size={11} strokeWidth={3} /></span>}</span>
          <small>None</small>
        </button>
        {stylePresetOptions.map((item) => <button type="button" key={item.id} onClick={() => onStyleChange(style === item.name ? null : item.name)} className={style === item.name ? cx("is-selected") : undefined} aria-pressed={style === item.name}><span className={cx("gen-style-thumb")} style={presetThumbStyle(item.imageUrl)} role="img" aria-label={`${item.name} style preset`}>{style === item.name && <span className={cx("gen-selected-check")}><Check size={11} strokeWidth={3} /></span>}</span><small>{item.name}</small></button>)}
      </div>
      {stylePresetScrollState.canGoBack && <button type="button" className={cx("gen-gallery-prev")} onClick={() => scrollStylePresets(-1)} aria-label="Previous style presets"><ChevronLeft size={18} /></button>}
      {stylePresetScrollState.canGoForward && <button type="button" className={cx("gen-gallery-next")} onClick={() => scrollStylePresets(1)} aria-label="Next style presets"><ChevronRight size={18} /></button>}
    </div>
    <div className={cx("gen-section-heading")}><h3>NEGATIVE PROMPT</h3></div><PromptField value={negativePrompt} onChange={onNegativePromptChange} placeholder="low quality, blurry, text, watermark, logo, deformed..." ariaLabel="Negative prompt" multiline={false} maxLength={100} wrapperClassName={cx("gen-input-wrap")} metaClassName={cx("gen-prompt-meta")} />
  </aside>;
}
