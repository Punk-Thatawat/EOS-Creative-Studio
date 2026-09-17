import { Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { useLocale } from "@/lib/i18n/locale-provider";
import { cx } from "../styles";
import { SourceImageUpload } from "./source-image-upload";
import type { ImageUploadConstraints } from "@/lib/media/upload-validation";
import { InfoTooltip } from "@/features/create/components/info-tooltip";

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
  const { t } = useLocale();
  return <aside className={cx("gen-panel", "gen-prompt-panel", "gen-upscale-panel")}>
    <div className={cx("gen-prompt-top-action")}><span>{tutorialButton}</span><span>{clearButton}</span></div><div className={cx("gen-section-heading")}><h3>{t("create.image.sourceImage")} <em>({t("create.required")})</em></h3></div>
    <SourceImageUpload imageUrl={sourceImage} onImageChange={onSourceImageChange} onClear={onSourceImageClear} purpose="content" feature="upscale" workspaceId={workspaceId} imageConstraints={imageUploadConstraints} onPendingImageChange={onPendingImageChange} />
    <p className={cx("gen-inline-helper")}>{t("create.image.upscale.helper")}</p>
    <div className={cx("gen-upscale-info")}>
      <div className={cx("gen-upscale-info-icon")}><Sparkles size={15} /></div>
      <div><b>{t("create.image.upscale.detailTitle")}</b><p>{t("create.image.upscale.detailBody")}</p></div>
    </div>
    <p className={cx("gen-upscale-note")}><InfoTooltip content={t("create.settings.info.upscaleAspectRatio")} size={12} /> {t("create.image.upscale.aspectNote")}</p>
  </aside>;
}
