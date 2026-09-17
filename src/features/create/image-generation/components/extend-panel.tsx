import Image from "next/image";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Maximize2 } from "lucide-react";
import type { ReactNode } from "react";
import type { ExtendAmount, ExtendDirection } from "../config";
import { extendAmounts, extendDirections } from "../config";
import { cx } from "../styles";
import { PromptField } from "@/components/ui/prompt-field";
import { SourceImageUpload } from "./source-image-upload";
import type { ImageUploadConstraints } from "@/lib/media/upload-validation";
import { PromptOptimizerToggle } from "./prompt-optimizer-toggle";
import { InfoTooltip } from "@/features/create/components/info-tooltip";
import { useLocale, type TranslationKey } from "@/lib/i18n/locale-provider";

type ExtendPanelProps = {
  tutorialButton?: ReactNode;
  clearButton?: ReactNode;
  sourceImage: string | null;
  workspaceId: string | null;
  imageUploadConstraints?: ImageUploadConstraints;
  prompt: string;
  negativePrompt: string;
  direction: ExtendDirection;
  amount: ExtendAmount;
  onSourceImageChange: (imageUrl: string) => void;
  onSourceImageClear: () => void;
  onPendingImageChange: (file: File | null, previewUrl: string | null) => void;
  onPromptChange: (prompt: string) => void;
  promptOptimizerEnabled: boolean;
  onPromptOptimizerChange: (enabled: boolean) => void;
  onNegativePromptChange: (prompt: string) => void;
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

export function ExtendPanel({ tutorialButton, clearButton, sourceImage, workspaceId, imageUploadConstraints, prompt, negativePrompt, direction, amount, onSourceImageChange, onSourceImageClear, onPendingImageChange, onPromptChange, promptOptimizerEnabled, onPromptOptimizerChange, onNegativePromptChange, onDirectionChange, onAmountChange }: ExtendPanelProps) {
  const { t } = useLocale();
  return <aside className={cx("gen-panel", "gen-prompt-panel", "gen-extend-panel")}>
    <div className={cx("gen-prompt-top-action")}><span>{tutorialButton}</span><span>{clearButton}</span></div><div className={cx("gen-panel-title")}><h2>{t("create.prompt")} <em>({t("create.optional")})</em></h2><Image src="/generated-assets/be-descriptive.png" alt={t("create.image.beDescriptive")} width={2051} height={509} className={cx("gen-prompt-annotation")} /></div>
    <PromptField id="gen-extend-prompt" value={prompt} onChange={onPromptChange} placeholder={t("create.image.promptHint.extend")} ariaLabel={t("create.image.extend.promptAria")} wrapperClassName={cx("gen-textarea-wrap", "gen-extend-prompt")} metaClassName={cx("gen-prompt-meta")} />
    <PromptOptimizerToggle enabled={promptOptimizerEnabled} onChange={onPromptOptimizerChange} />
    <div className={cx("gen-section-heading")}><h3>{t("create.image.sourceImage")} <em>({t("create.required")})</em></h3></div>
    <SourceImageUpload imageUrl={sourceImage} onImageChange={onSourceImageChange} onClear={onSourceImageClear} purpose="content" feature="extend-image" workspaceId={workspaceId} imageConstraints={imageUploadConstraints} onPendingImageChange={onPendingImageChange} />
    <p className={cx("gen-inline-helper")}>{t("create.image.extend.sourceHelper")}</p>

    <div className={cx("gen-section-heading", "gen-inline-heading")}><h3>{t("create.image.extend.direction")}</h3><InfoTooltip content={t("create.settings.info.expandDirection")} size={12} /></div>
    <div className={cx("gen-extend-direction-grid")} role="radiogroup" aria-label={t("create.image.extend.direction")}>
      {extendDirections.map((item) => {
        const meta = directionMeta[item];
        const label = t(`create.image.extend.dir.${item}` as TranslationKey);
        const helper = t(`create.image.extend.dir.${item}Helper` as TranslationKey);
        const Icon = meta.icon;
        return <button type="button" key={item} role="radio" aria-checked={direction === item} className={cx(direction === item && "is-selected", item === "all" && "is-all")} onClick={() => onDirectionChange(item)}><span className={cx("gen-extend-direction-icon")}><Icon size={16} /></span><span><b>{label}</b><small>{helper}</small></span></button>;
      })}
    </div>

    <div className={cx("gen-section-heading", "gen-inline-heading")}><h3>{t("create.image.extend.amount")}</h3><InfoTooltip content={t("create.settings.info.expandAmount")} size={12} /></div>
    <div className={cx("gen-segmented", "gen-extend-amounts")} role="radiogroup" aria-label={t("create.image.extend.amount")}>
      {extendAmounts.map((item) => <button type="button" key={item} role="radio" aria-checked={amount === item} className={cx(amount === item && "is-selected")} onClick={() => onAmountChange(item)}>{item}</button>)}
    </div>
    <p className={cx("gen-extend-amount-helper")}>{t("create.image.extend.amountHelper")}</p>

    <details className={cx("gen-advanced")}>
      <summary><span>{t("create.image.advanced")}</span><span aria-hidden="true">⌄</span></summary>
      <div className={cx("gen-advanced-body")}>
        <div className={cx("gen-advanced-field")}><label htmlFor="gen-negative-prompt-extend">{t("create.image.negativePrompt")}</label><PromptField id="gen-negative-prompt-extend" value={negativePrompt} onChange={onNegativePromptChange} placeholder={t("create.image.extend.negativeHint")} ariaLabel={t("create.image.extend.negativeAria")} multiline={false} maxLength={100} wrapperClassName={cx("gen-input-wrap")} metaClassName={cx("gen-prompt-meta")} /></div>
      </div>
    </details>
  </aside>;
}
