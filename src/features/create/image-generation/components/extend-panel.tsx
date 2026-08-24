import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Info, Maximize2 } from "lucide-react";
import type { ExtendAmount, ExtendDirection } from "../config";
import { extendAmounts, extendDirections } from "../config";
import { cx } from "../styles";
import { SourceImageUpload } from "./source-image-upload";
import type { ImageUploadConstraints } from "@/lib/media/upload-validation";

type ExtendPanelProps = {
  sourceImage: string | null;
  workspaceId: string | null;
  imageUploadConstraints?: ImageUploadConstraints;
  prompt: string;
  negativePrompt: string;
  smartEnhance: boolean;
  direction: ExtendDirection;
  amount: ExtendAmount;
  onSourceImageChange: (imageUrl: string) => void;
  onSourceImageClear: () => void;
  onPromptChange: (prompt: string) => void;
  onNegativePromptChange: (prompt: string) => void;
  onSmartEnhanceChange: (enabled: boolean) => void;
  onDirectionChange: (direction: ExtendDirection) => void;
  onAmountChange: (amount: ExtendAmount) => void;
};

const directionMeta: Record<ExtendDirection, { label: string; helper: string; icon: typeof ArrowLeft }> = {
  left: { label: "Left", helper: "Add canvas on the left", icon: ArrowLeft },
  right: { label: "Right", helper: "Add canvas on the right", icon: ArrowRight },
  top: { label: "Top", helper: "Add canvas above", icon: ArrowUp },
  bottom: { label: "Bottom", helper: "Add canvas below", icon: ArrowDown },
  all: { label: "All sides", helper: "Expand around the image", icon: Maximize2 },
};

export function ExtendPanel({ sourceImage, workspaceId, imageUploadConstraints, prompt, negativePrompt, smartEnhance, direction, amount, onSourceImageChange, onSourceImageClear, onPromptChange, onNegativePromptChange, onSmartEnhanceChange, onDirectionChange, onAmountChange }: ExtendPanelProps) {
  return <aside className={cx("gen-panel", "gen-prompt-panel", "gen-extend-panel")}>
    <div className={cx("gen-section-heading")}><h3>WHAT SHOULD BE ADDED? <em>(Optional)</em></h3></div>
    <label className={cx("gen-textarea-wrap", "gen-extend-prompt")}><textarea id="gen-extend-prompt" value={prompt} onChange={(event) => onPromptChange(event.target.value)} placeholder="Continue the sunset sky, trees and warm window light naturally" aria-label="Extend image prompt" /></label>
    <div className={cx("gen-toggle-row")}><span>Smart Enhance <Info size={12} /></span><button type="button" className={cx("gen-toggle", smartEnhance && "is-on")} aria-label={`Smart Enhance ${smartEnhance ? "on" : "off"}`} aria-pressed={smartEnhance} onClick={() => onSmartEnhanceChange(!smartEnhance)}><i /></button></div>

    <div className={cx("gen-section-heading")}><h3>SOURCE IMAGE <em>(Required)</em></h3></div>
    <SourceImageUpload imageUrl={sourceImage} onImageChange={onSourceImageChange} onClear={onSourceImageClear} purpose="content" feature="extend-image" workspaceId={workspaceId} imageConstraints={imageUploadConstraints} />
    <p className={cx("gen-inline-helper")}>Upload an image, then choose where AI should continue the scene beyond its original borders.</p>

    <div className={cx("gen-section-heading", "gen-inline-heading")}><h3>EXPAND DIRECTION</h3><Info size={12} /></div>
    <div className={cx("gen-extend-direction-grid")} role="radiogroup" aria-label="Expand direction">
      {extendDirections.map((item) => {
        const meta = directionMeta[item];
        const Icon = meta.icon;
        return <button type="button" key={item} role="radio" aria-checked={direction === item} className={cx(direction === item && "is-selected", item === "all" && "is-all")} onClick={() => onDirectionChange(item)}><span className={cx("gen-extend-direction-icon")}><Icon size={16} /></span><span><b>{meta.label}</b><small>{meta.helper}</small></span></button>;
      })}
    </div>

    <div className={cx("gen-section-heading", "gen-inline-heading")}><h3>EXPAND AMOUNT</h3><Info size={12} /></div>
    <div className={cx("gen-segmented", "gen-extend-amounts")} role="radiogroup" aria-label="Expand amount">
      {extendAmounts.map((item) => <button type="button" key={item} role="radio" aria-checked={amount === item} className={cx(amount === item && "is-selected")} onClick={() => onAmountChange(item)}>{item}</button>)}
    </div>
    <p className={cx("gen-extend-amount-helper")}>How much new canvas should be added on the selected side(s).</p>

    <details className={cx("gen-advanced")}>
      <summary><span>ADVANCED</span><span aria-hidden="true">⌄</span></summary>
      <div className={cx("gen-advanced-body")}>
        <div className={cx("gen-advanced-field")}><label htmlFor="gen-negative-prompt-extend">Negative prompt</label><input id="gen-negative-prompt-extend" value={negativePrompt} onChange={(event) => onNegativePromptChange(event.target.value)} placeholder="blurry, seams, duplicated objects" /></div>
      </div>
    </details>
  </aside>;
}
