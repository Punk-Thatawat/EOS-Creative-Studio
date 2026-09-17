import type { ReactNode } from "react";
import { cx } from "../styles";
import { SourceImageUpload } from "./source-image-upload";
import type { ImageUploadConstraints } from "@/lib/media/upload-validation";

type UpscalePanelProps = {
  tutorialButton?: ReactNode;
  clearButton?: ReactNode;
  sourceImage: string | null;
  workspaceId: string | null;
  imageUploadConstraints?: ImageUploadConstraints;
  onSourceImageChange: (imageUrl: string) => void;
  onSourceImageClear: () => void;
  onPendingImageChange: (file: File | null, previewUrl: string | null) => void;
};

export function UpscalePanel({ tutorialButton, clearButton, sourceImage, workspaceId, imageUploadConstraints, onSourceImageChange, onSourceImageClear, onPendingImageChange }: UpscalePanelProps) {
  return <aside className={cx("gen-panel", "gen-prompt-panel", "gen-upscale-panel")}>
    <div className={cx("gen-prompt-top-action")}><span>{tutorialButton}</span><span>{clearButton}</span></div><div className={cx("gen-section-heading")}><h3>SOURCE IMAGE <em>(Required)</em></h3></div>
    <SourceImageUpload imageUrl={sourceImage} onImageChange={onSourceImageChange} onClear={onSourceImageClear} purpose="content" feature="upscale" workspaceId={workspaceId} imageConstraints={imageUploadConstraints} onPendingImageChange={onPendingImageChange} />
  </aside>;
}
