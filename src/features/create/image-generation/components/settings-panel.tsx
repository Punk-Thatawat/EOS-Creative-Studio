import { useState } from "react";
import { Check, ChevronDown, Info, LoaderCircle, LockKeyhole, RectangleHorizontal, RectangleVertical, Sparkles, Square } from "lucide-react";
import type { GenerationStatus } from "@/lib/api/generations";
import type { GenerationModelOption } from "@/lib/api/generation-models";
import { imageRatioSizes, imageResolutionSizes, type BackgroundMode, type ImageCount, type ImageGenerationTab, type ImageQuality, type ImageRatio } from "../config";
import { cx } from "../styles";
import { DynamicModelParameters } from "./dynamic-model-parameters";
import { Segmented } from "./image-generation-ui";

type SettingsPanelProps = {
  activeTab: ImageGenerationTab;
  canGenerate: boolean;
  count: ImageCount;
  countOptions: string[];
  backgroundMode?: BackgroundMode;
  generationCompletedCount: number;
  generationError: string | null;
  generationStatus: GenerationStatus;
  generationTotalCount: number;
  imageSizeOpen: boolean;
  isGenerating: boolean;
  modelOptions: GenerationModelOption[];
  isLoadingModels: boolean;
  modelCapabilities?: GenerationModelOption["capabilities"];
  modelParams: Record<string, unknown>;
  ratioOptions: ImageRatio[];
  qualityOptions: string[];
  qualityEnabled: boolean;
  imageCreditEstimate: number | null;
  imageCreditEstimateLoading: boolean;
  imageCreditEstimateError: string | null;
  outputFormatOptions: string[];
  outputFormat: string | null;
  optionsFollowModel: boolean;
  selectedModel: string;
  resolution: string;
  resolutionOptions: string[];
  quality: ImageQuality;
  ratio: ImageRatio;
  onCountChange: (count: ImageCount) => void;
  onGenerate: () => void;
  onImageSizeToggle: () => void;
  onQualityChange: (quality: ImageQuality) => void;
  onOutputFormatChange: (format: string) => void;
  onModelChange: (model: string) => void;
  onResolutionChange: (resolution: string) => void;
  onRatioChange: (ratio: ImageRatio) => void;
  onCancel: () => void;
  onModelParamChange: (name: string, value: unknown) => void;
};

const ratioIcons = {
  "1:1": Square,
  "16:9": RectangleHorizontal,
  "4:3": RectangleHorizontal,
  "3:4": RectangleVertical,
  "9:16": RectangleVertical,
} as const;

function RatioIcon({ ratio }: { ratio: ImageRatio }) {
  const Icon = ratioIcons[ratio];
  return <Icon size={15} strokeWidth={1.8} aria-hidden="true" />;
}

function supportsImageInput(model: GenerationModelOption) {
  const parameters = model.capabilities?.parameters ?? [];
  return parameters.length === 0 || parameters.some((parameter) => /image|source|input/i.test(parameter)) || Boolean(model.capabilities?.imageParameter || model.capabilities?.imagesParameter || model.capabilities?.inputImageParameter || model.capabilities?.inputParameter);
}

type SchemaProperty = {
  type?: string;
  default?: unknown;
  description?: string;
  enum?: unknown[];
  [key: string]: unknown;
};

type SchemaField = { name: string; property: SchemaProperty };

function findSchemaField(properties: Record<string, SchemaProperty>, names: string[]): SchemaField | undefined {
  const name = names.find((candidate) => properties[candidate]);
  return name ? { name, property: properties[name] } : undefined;
}

function SchemaFieldControl({ field, value, options, onChange }: { field: SchemaField; value: unknown; options?: string[]; onChange: (value: unknown) => void }) {
  const enumValues = options ?? (field.property.enum ?? []).map((item) => String(item));
  const isAspectRatioField = /^(aspect[_-]?ratio|aspectRatio|ratio)$/i.test(field.name);
  const selectedValue = value ?? field.property.default ?? (isAspectRatioField ? enumValues[0] ?? "" : "");
  const description = typeof field.property.description === "string" ? field.property.description : undefined;
  const type = field.property.type ?? "string";
  if (enumValues.length > 0) {
    const placeholder = typeof field.property["x-placeholder"] === "string" ? String(field.property["x-placeholder"]) : "Auto";
    return <div className={cx("gen-setting-block")}><h3>{field.name} <Info size={12} /></h3><div className={cx("gen-dynamic-field")}><select value={String(selectedValue)} onChange={(event) => onChange(event.target.value || undefined)}>{!isAspectRatioField && <option value="">{placeholder}</option>}{enumValues.map((item) => <option key={item} value={item}>{item}</option>)}</select>{description && <small>{description}</small>}</div></div>;
  }
  return <div className={cx("gen-setting-block")}><h3>{field.name} <Info size={12} /></h3><div className={cx("gen-dynamic-field")}><input type={type === "number" || type === "integer" ? "number" : "text"} value={selectedValue === undefined ? "" : String(selectedValue)} min={typeof field.property.minimum === "number" ? field.property.minimum : undefined} max={typeof field.property.maximum === "number" ? field.property.maximum : undefined} step={type === "integer" ? 1 : "any"} onChange={(event) => { const raw = event.target.value; if (type === "integer") onChange(raw === "" ? undefined : Number.parseInt(raw, 10)); else if (type === "number") onChange(raw === "" ? undefined : Number(raw)); else onChange(raw || undefined); }} />{description && <small>{description}</small>}</div></div>;
}

export function SettingsPanel({ activeTab, canGenerate, count, countOptions, backgroundMode = "remove", generationError, generationStatus, imageSizeOpen, isGenerating, modelOptions, isLoadingModels, modelCapabilities, modelParams, ratioOptions, qualityOptions, qualityEnabled, imageCreditEstimate, imageCreditEstimateLoading, imageCreditEstimateError, outputFormatOptions, outputFormat, optionsFollowModel, selectedModel, resolution, resolutionOptions, quality, ratio, onCountChange, onGenerate, onImageSizeToggle, onModelChange, onQualityChange, onOutputFormatChange, onRatioChange, onResolutionChange, onCancel, onModelParamChange }: SettingsPanelProps) {
  const [modelOpen, setModelOpen] = useState(false);
  const [resolutionOpen, setResolutionOpen] = useState(false);
  const isImageToImage = activeTab === "Image to Image";
  const isTextToImage = activeTab === "Text to Image";
  const isUpscale = activeTab === "Upscale";
  const isImageInputTab = isImageToImage || activeTab === "AI Style Transfer" || activeTab === "AI Background" || isUpscale || activeTab === "Extend Image";
  const isBackgroundRemove = activeTab === "AI Background" && backgroundMode === "remove";
  const isBackgroundSolid = activeTab === "AI Background" && backgroundMode === "solid";
  const schemaProperties = (modelCapabilities?.apiSchema?.request_schema?.properties ?? {}) as Record<string, SchemaProperty>;
  const textAspectRatioField = isTextToImage ? findSchemaField(schemaProperties, ["aspect_ratio", "aspectRatio", "ratio"]) : undefined;
  const textResolutionField = isTextToImage ? findSchemaField(schemaProperties, ["resolution", "output_resolution", "outputResolution"]) : undefined;
  const textSizeField = isTextToImage ? findSchemaField(schemaProperties, ["size", "image_size", "imageSize"]) : undefined;
  const textSeedField = isTextToImage ? findSchemaField(schemaProperties, ["seed"]) : undefined;
  const textHasNativeDimensionField = Boolean(textResolutionField || textSizeField);
  // A native `size` field already controls the output dimensions. Do not show
  // a prompt-only aspect-ratio control beside it because that does not change
  // the provider's actual canvas size (Flux 2 Dev is one such model).
  const textPromptAspectFallback = Boolean(isTextToImage && !textAspectRatioField && !textSizeField);
  // A provider's `size` is already the concrete output dimensions. Showing a
  // prompt-based resolution beside it would expose two controls for the same
  // concept, so only offer the fallback when the schema has neither field.
  const textPromptResolutionFallback = Boolean(isTextToImage && !textResolutionField && !textSizeField);
  const textCountSupported = Boolean(isTextToImage && findSchemaField(schemaProperties, ["count", "num_images", "numImages", "batch_size", "batchSize"]));
  const qualityIsPromptBased = Boolean(qualityEnabled && !modelCapabilities?.qualityParameter && !findSchemaField(schemaProperties, ["quality", "quality_level", "qualityLevel"]));
  const showCountControl = !isUpscale && countOptions.length > 0 && (!isTextToImage || textCountSupported);
  const selectedModelOption = modelOptions.find((item) => item.model === selectedModel);
  const modelSelectionLabel = selectedModelOption?.displayName ?? "Select a model";
  const modelControl = isLoadingModels ? <button type="button" className={cx("gen-select", "gen-model-select", "gen-model-loading")} disabled aria-busy="true"><span><i className={cx("gen-skeleton-line", "gen-skeleton-model-name")} /></span><ChevronDown size={15} /></button> : <><button type="button" className={cx("gen-select", "gen-model-select")} onClick={() => setModelOpen((open) => !open)} aria-haspopup="listbox" aria-expanded={modelOpen}><span><b>{modelSelectionLabel}</b></span><ChevronDown size={15} /></button>{modelOpen && <div className={cx("gen-select-menu", "gen-model-menu")} role="listbox" aria-label="Model options">{modelOptions.map((item) => { const disabled = isImageInputTab && !supportsImageInput(item); return <button type="button" role="option" key={`${item.provider}:${item.model}`} aria-selected={selectedModel === item.model} disabled={disabled} title={disabled ? "This model does not support image input" : undefined} className={cx(selectedModel === item.model && "is-selected", disabled && "is-disabled")} onClick={() => { if (disabled) return; onModelChange(item.model); setModelOpen(false); }}><span><b>{item.displayName}</b>{disabled ? <small>Image input not supported</small> : null}</span>{selectedModel === item.model && <Check size={15} />}</button>; })}</div>}</>;
  const estimatedCreditsValue = imageCreditEstimateLoading ? <span className={cx("gen-estimate-recalculating")}><LoaderCircle size={12} aria-hidden="true" /> Recalculating price...</span> : imageCreditEstimate !== null && !imageCreditEstimateError ? `= ${imageCreditEstimate.toLocaleString(undefined, { maximumFractionDigits: 2 })} Credits` : "Pricing unavailable";
  const generationLabel = activeTab === "AI Background" ? backgroundMode === "remove" ? "REMOVE BACKGROUND" : backgroundMode === "replace" ? "REPLACE BACKGROUND" : backgroundMode === "generate" ? "GENERATE BACKGROUND" : "APPLY COLOR" : isImageToImage ? "TRANSFORM IMAGE" : activeTab === "AI Style Transfer" ? "APPLY STYLE" : isUpscale ? "UPSCALE IMAGE" : activeTab === "Extend Image" ? "EXTEND IMAGE" : "GENERATE IMAGE";

  const handleRatioChange = (nextRatio: ImageRatio) => {
    setResolutionOpen(false);
    onRatioChange(nextRatio);
  };

  return <aside className={cx("gen-panel", "gen-settings-panel")} data-background-remove={isBackgroundRemove ? "true" : "false"}>
    <div className={cx("gen-panel-title")}><h2>SETTINGS</h2><span className={cx("gen-dial")}>DIAL IT IN</span></div>
    <div className={cx("gen-setting-block")}><h3>MODEL <Info size={12} /></h3><div className={cx("gen-select-wrap")}>{modelControl}</div></div>
    {!isBackgroundRemove && !isBackgroundSolid && <DynamicModelParameters capabilities={modelCapabilities} values={modelParams} onChange={onModelParamChange} />}
    {isTextToImage && textAspectRatioField && <SchemaFieldControl field={textAspectRatioField} value={modelParams[textAspectRatioField.name]} onChange={(value) => onModelParamChange(textAspectRatioField.name, value)} />}
    {isTextToImage && textResolutionField && <SchemaFieldControl field={textResolutionField} value={modelParams[textResolutionField.name]} onChange={(value) => onModelParamChange(textResolutionField.name, value)} />}
    {isTextToImage && textSizeField && <SchemaFieldControl field={textSizeField} value={modelParams[textSizeField.name]} options={modelCapabilities?.supportedSizes} onChange={(value) => onModelParamChange(textSizeField.name, value)} />}
    {isTextToImage && textSeedField && <SchemaFieldControl field={textSeedField} value={modelParams[textSeedField.name]} onChange={(value) => onModelParamChange(textSeedField.name, value)} />}
    {isUpscale ? <div className={cx("gen-setting-block", "gen-upscale-target-block")}><h3>TARGET RESOLUTION <Info size={12} /></h3><div className={cx("gen-size-controls")}><div className={cx("gen-select-wrap")}><button type="button" className={cx("gen-select")} onClick={() => setResolutionOpen((open) => !open)} aria-haspopup="listbox" aria-expanded={resolutionOpen}><span><b>{resolution}</b><small>AI output resolution</small></span><ChevronDown size={15} /></button>{resolutionOpen && <div className={cx("gen-select-menu")} role="listbox" aria-label="Target resolution options">{resolutionOptions.map((item) => <button type="button" key={item} role="option" aria-selected={resolution === item} className={resolution === item ? cx("is-selected") : undefined} onClick={() => { onResolutionChange(item); setResolutionOpen(false); }}><b>{item}</b><small>Upscaled output</small></button>)}</div>}</div></div><p className={cx("gen-model-options-note")}>The original aspect ratio is preserved.</p>{optionsFollowModel && <p className={cx("gen-model-options-note")} role="status">Options update to match the selected model.</p>}</div> : <>{textPromptAspectFallback && <div className={cx("gen-setting-block")}><h3>ASPECT RATIO <Info size={12} /></h3><div className={cx("gen-size-controls", "gen-single-size-control")}><div className={cx("gen-select-wrap")}><button type="button" className={cx("gen-select")} onClick={onImageSizeToggle} aria-haspopup="listbox" aria-expanded={imageSizeOpen}><span className={cx("gen-ratio-value")}><RatioIcon ratio={ratio} /><b>{ratio}</b></span><ChevronDown size={15} /></button>{imageSizeOpen && <div className={cx("gen-select-menu")} role="listbox" aria-label="Prompt-based aspect ratio options">{ratioOptions.map((item) => <button type="button" key={item} role="option" aria-selected={ratio === item} className={ratio === item ? cx("is-selected") : undefined} onClick={() => handleRatioChange(item)}><span className={cx("gen-ratio-option")}><RatioIcon ratio={item} /><b>{item}</b></span></button>)}</div>}</div></div><p className={cx("gen-model-options-note")}>Applied as a prompt instruction because this model has no native aspect ratio parameter.</p></div>}{textPromptResolutionFallback && <div className={cx("gen-setting-block")}><h3>RESOLUTION <Info size={12} /></h3><div className={cx("gen-size-controls", "gen-single-size-control")}><div className={cx("gen-select-wrap")}><button type="button" className={cx("gen-select")} onClick={() => setResolutionOpen((open) => !open)} aria-haspopup="listbox" aria-expanded={resolutionOpen}><span><b>{resolution}</b><small>({imageResolutionSizes[ratio][resolution] ?? imageRatioSizes[ratio]})</small></span><ChevronDown size={15} /></button>{resolutionOpen && <div className={cx("gen-select-menu")} role="listbox" aria-label="Prompt-based resolution options">{resolutionOptions.map((item) => <button type="button" key={item} role="option" aria-selected={resolution === item} className={resolution === item ? cx("is-selected") : undefined} onClick={() => { onResolutionChange(item); setResolutionOpen(false); }}><b>{item}</b><small>{imageResolutionSizes[ratio][item] ?? imageRatioSizes[ratio]}</small></button>)}</div>}</div></div><p className={cx("gen-model-options-note")}>Applied as a prompt instruction because this model has no native resolution parameter.</p></div>}{!isTextToImage || (!textHasNativeDimensionField && !textPromptAspectFallback && !textPromptResolutionFallback) ? <div className={cx("gen-setting-block")}><h3>IMAGE SIZE <Info size={12} /></h3><div className={cx("gen-size-controls", "gen-single-size-control")}><div className={cx("gen-select-wrap")}><button type="button" className={cx("gen-select")} onClick={onImageSizeToggle} aria-haspopup="listbox" aria-expanded={imageSizeOpen}><span className={cx("gen-ratio-value")}><RatioIcon ratio={ratio} /><b>{ratio}</b></span><ChevronDown size={15} /></button>{imageSizeOpen && <div className={cx("gen-select-menu")} role="listbox" aria-label="Image size options">{ratioOptions.map((item) => <button type="button" key={item} role="option" aria-selected={ratio === item} className={ratio === item ? cx("is-selected") : undefined} onClick={() => handleRatioChange(item)}><span className={cx("gen-ratio-option")}><RatioIcon ratio={item} /><b>{item}</b></span></button>)}</div>}</div></div></div> : null}{!isTextToImage || (!textHasNativeDimensionField && !textPromptAspectFallback && !textPromptResolutionFallback) ? <div className={cx("gen-setting-block")}><h3>RESOLUTION <Info size={12} /></h3><div className={cx("gen-size-controls", "gen-single-size-control")}><div className={cx("gen-select-wrap")}><button type="button" className={cx("gen-select")} onClick={() => setResolutionOpen((open) => !open)} aria-haspopup="listbox" aria-expanded={resolutionOpen}><span><b>{resolution}</b><small>({imageResolutionSizes[ratio][resolution] ?? imageRatioSizes[ratio]})</small></span><ChevronDown size={15} /></button>{resolutionOpen && <div className={cx("gen-select-menu")} role="listbox" aria-label="Resolution options">{resolutionOptions.map((item) => <button type="button" key={item} role="option" aria-selected={resolution === item} className={resolution === item ? cx("is-selected") : undefined} onClick={() => { onResolutionChange(item); setResolutionOpen(false); }}><b>{item}</b><small>{imageResolutionSizes[ratio][item] ?? imageRatioSizes[ratio]}</small></button>)}</div>}</div></div></div> : null}{optionsFollowModel && <p className={cx("gen-model-options-note")} role="status">Options update to match the selected model.</p>}</>}
    {qualityEnabled && <div className={cx("gen-setting-block")}><h3>{isTextToImage && modelCapabilities?.qualityParameter ? modelCapabilities.qualityParameter : "QUALITY"} <Info size={12} /></h3><Segmented items={qualityOptions} value={quality} onChange={onQualityChange} />{qualityIsPromptBased && <p className={cx("gen-model-options-note")}>Applied as a prompt instruction because this model has no native quality parameter.</p>}</div>}
    {outputFormatOptions.length > 0 && <div className={cx("gen-setting-block")}><h3>{isTextToImage && modelCapabilities?.outputFormatParameter ? modelCapabilities.outputFormatParameter : "OUTPUT FORMAT"} <Info size={12} /></h3><Segmented items={outputFormatOptions} value={outputFormat && outputFormatOptions.includes(outputFormat) ? outputFormat : outputFormatOptions[0] ?? ""} onChange={onOutputFormatChange} /><p className={cx("gen-model-options-note")}>Available formats for the selected model.</p></div>}
    {showCountControl && <div className={cx("gen-setting-block")}><h3>NUMBER OF IMAGES <Info size={12} /></h3><Segmented items={countOptions} value={count} onChange={onCountChange} /></div>}
    <div className={cx("gen-estimate")}><div><h3>ESTIMATED CREDITS <Info size={12} /></h3><p>{isUpscale ? `1 image x ${resolution}` : `${showCountControl ? `${count} images` : "1 image"}${qualityEnabled ? ` x ${quality} Quality` : ""}`} <strong>{estimatedCreditsValue}</strong></p></div></div>
    {generationStatus === "cancelled" && <p className={cx("gen-generation-status")} role="status">Generation cancelled</p>}
    {generationError && <p className={cx("gen-generation-error")} role="alert">{generationError}</p>}
    {isGenerating && <button type="button" className={cx("gen-cancel-button")} onClick={onCancel}>Cancel generation</button>}
    <button type="button" className={cx("gen-generate-button")} onClick={onGenerate} disabled={!canGenerate} aria-busy={isGenerating}>{isGenerating ? <LoaderCircle size={20} className={cx("gen-generating-icon")} aria-hidden="true" /> : <Sparkles size={20} aria-hidden="true" />} {isGenerating ? "GENERATING..." : generationLabel}</button>
    <p className={cx("gen-private")}><LockKeyhole size={12} /> Your generation is private and secure</p>
  </aside>;
}
