import { Info, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { cx } from "../styles";
import { SourceImageUpload } from "./source-image-upload";
import type { ImageUploadConstraints } from "@/lib/media/upload-validation";

type UpscalePanelProps = {
  tutorialButton?: ReactNode;
  sourceImage: string | null;
  workspaceId: string | null;
  imageUploadConstraints?: ImageUploadConstraints;
  onSourceImageChange: (imageUrl: string) => void;
  onSourceImageClear: () => void;
};

export function UpscalePanel({ tutorialButton, sourceImage, workspaceId, imageUploadConstraints, onSourceImageChange, onSourceImageClear }: UpscalePanelProps) {
  return <aside className={cx("gen-panel", "gen-prompt-panel", "gen-upscale-panel")}>
    <div className={cx("gen-prompt-top-action")}>{tutorialButton}</div><div className={cx("gen-section-heading")}><h3>SOURCE IMAGE <em>(Required)</em></h3></div>
    <SourceImageUpload imageUrl={sourceImage} onImageChange={onSourceImageChange} onClear={onSourceImageClear} purpose="content" feature="upscale" workspaceId={workspaceId} imageConstraints={imageUploadConstraints} />
    <p className={cx("gen-inline-helper")}>Upload a low-resolution image. Upscale increases resolution while preserving the original composition.</p>
    <div className={cx("gen-upscale-info")}>
      <div className={cx("gen-upscale-info-icon")}><Sparkles size={15} /></div>
      <div><b>AI detail reconstruction</b><p>The model may recreate fine details such as texture, edges, and facial features.</p></div>
    </div>
    <p className={cx("gen-upscale-note")}><Info size={12} /> Original aspect ratio is preserved automatically.</p>
  </aside>;
}
