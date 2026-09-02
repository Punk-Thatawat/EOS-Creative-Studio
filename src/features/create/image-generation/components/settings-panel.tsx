import { useEffect } from "react";
import { Info, LoaderCircle, LockKeyhole, Sparkles } from "lucide-react";
import type { GenerationStatus } from "@/lib/api/generations";
import type { GenerationModelOption } from "@/lib/api/generation-models";
import { AspectRatioPicker } from "@/components/ui/aspect-ratio-picker";
import { Dropdown } from "@/components/ui/dropdown";
import { imageRatioFromSize, imageRatios, imageResolutionSizes, type BackgroundMode, type ImageCount, type ImageGenerationTab, type ImageQuality, type ImageRatio } from "../config";
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
  generationValidationMessage: string | null;
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

function ResolutionControl({ resolution, resolutionOptions, onChange, descriptions, secondaryLabel }: { resolution: string; resolutionOptions: string[]; onChange: (resolution: string) => void; descriptions?: Record<string, string>; secondaryLabel?: string }) {
  const options = resolutionOptions.map((item) => ({ value: item, label: item, description: secondaryLabel ?? descriptions?.[item] }));
  return <div className={cx("gen-setting-block", "gen-resolution-block")}><h3>{secondaryLabel ? "TARGET RESOLUTION" : "RESOLUTION"} <Info size={12} /></h3><Dropdown value={resolution} options={options} onChange={onChange} ariaLabel={secondaryLabel ? "Target resolution options" : "Resolution options"} className={cx("gen-select-wrap")} triggerClassName={cx("gen-select")} menuClassName={cx("gen-select-menu")} />{secondaryLabel && <p className={cx("gen-model-options-note")}>The original aspect ratio is preserved.</p>}</div>;
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
    const ratioEnumSet = new Set(enumValues.filter((item): item is ImageRatio => imageRatios.includes(item as ImageRatio)));
    const ratioEnumValues = imageRatios.filter((item) => ratioEnumSet.has(item));
    if (isAspectRatioField && ratioEnumValues.length > 0) {
      return <div className={cx("gen-setting-block")}><h3>ASPECT RATIO <Info size={12} /></h3><AspectRatioPicker options={ratioEnumValues} value={ratioEnumValues.includes(String(selectedValue) as ImageRatio) ? String(selectedValue) : ratioEnumValues[0]} onChange={onChange} />{description && <small className={cx("gen-model-options-note")}>{description}</small>}</div>;
    }
    return <div className={cx("gen-setting-block")}><h3>{field.name} <Info size={12} /></h3><div className={cx("gen-dynamic-field")}><Dropdown value={String(selectedValue)} options={enumValues.map((item) => ({ value: item, label: item }))} onChange={(nextValue) => onChange(nextValue || undefined)} placeholder={placeholder} ariaLabel={field.name} triggerClassName={cx("gen-select")} menuClassName={cx("gen-select-menu")} />{description && <small>{description}</small>}</div></div>;
  }
  return <div className={cx("gen-setting-block")}><h3>{field.name} <Info size={12} /></h3><div className={cx("gen-dynamic-field")}><input type={type === "number" || type === "integer" ? "number" : "text"} value={selectedValue === undefined ? "" : String(selectedValue)} min={typeof field.property.minimum === "number" ? field.property.minimum : undefined} max={typeof field.property.maximum === "number" ? field.property.maximum : undefined} step={type === "integer" ? 1 : "any"} onChange={(event) => { const raw = event.target.value; if (type === "integer") onChange(raw === "" ? undefined : Number.parseInt(raw, 10)); else if (type === "number") onChange(raw === "" ? undefined : Number(raw)); else onChange(raw || undefined); }} />{description && <small>{description}</small>}</div></div>;
}

export function SettingsPanel({ activeTab, canGenerate, count, countOptions, backgroundMode = "remove", generationError, generationValidationMessage, generationStatus, isGenerating, modelOptions, isLoadingModels, modelCapabilities, modelParams, ratioOptions, qualityOptions, qualityEnabled, imageCreditEstimate, imageCreditEstimateLoading, imageCreditEstimateError, outputFormatOptions, outputFormat, optionsFollowModel, selectedModel, resolution, resolutionOptions, quality, ratio, onCountChange, onGenerate, onModelChange, onQualityChange, onOutputFormatChange, onRatioChange, onResolutionChange, onCancel, onModelParamChange }: SettingsPanelProps) {
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
  const textSizeFieldName = textSizeField?.name;
  const textSizeSchemaValuesKey = (textSizeField?.property.enum ?? []).map((item) => String(item)).join("\u001f");
  const modelSupportedSizesKey = (modelCapabilities?.supportedSizes ?? []).join("\u001f");
  const textSizeOptions = textSizeFieldName
    ? (modelSupportedSizesKey || textSizeSchemaValuesKey).split("\u001f").filter(Boolean)
    : [];
  const aspectRatioParameter = modelCapabilities?.aspectRatioParameter ?? textAspectRatioField?.name;
  const schemaRatioValues = textAspectRatioField?.property.enum?.map((item) => String(item)).filter((item): item is ImageRatio => imageRatios.includes(item as ImageRatio)) ?? [];
  const aspectRatioOptions = schemaRatioValues.length > 0 ? imageRatios.filter((item) => schemaRatioValues.includes(item)) : ratioOptions;
  const modelAspectRatio = aspectRatioParameter ? modelParams[aspectRatioParameter] : undefined;
  const selectedAspectRatio = typeof modelAspectRatio === "string" && aspectRatioOptions.includes(modelAspectRatio as ImageRatio) ? modelAspectRatio as ImageRatio : ratio;
  const showGenericResolution = !isTextToImage || (!textResolutionField && !textSizeField);

  useEffect(() => {
    if (!textSizeFieldName || !aspectRatioParameter || (!modelSupportedSizesKey && !textSizeSchemaValuesKey)) return;
    const currentAspectRatio = modelParams[aspectRatioParameter];
    if (typeof currentAspectRatio !== "string") return;
    const sizeOptions = (modelSupportedSizesKey || textSizeSchemaValuesKey).split("\u001f").filter(Boolean);
    const matchingSize = sizeOptions.find((item) => imageRatioFromSize(item) === currentAspectRatio);
    if (matchingSize && modelParams[textSizeFieldName] !== matchingSize) onModelParamChange(textSizeFieldName, matchingSize);
  }, [aspectRatioParameter, modelParams, modelSupportedSizesKey, onModelParamChange, textSizeFieldName, textSizeSchemaValuesKey]);
  const textCountSupported = Boolean(isTextToImage && findSchemaField(schemaProperties, ["count", "num_images", "numImages", "batch_size", "batchSize"]));
  const qualityIsPromptBased = Boolean(qualityEnabled && !modelCapabilities?.qualityParameter && !findSchemaField(schemaProperties, ["quality", "quality_level", "qualityLevel"]));
  const showCountControl = !isUpscale && countOptions.length > 0 && (!isTextToImage || textCountSupported);
  const modelDropdownOptions = modelOptions.map((item) => { const disabled = isImageInputTab && !supportsImageInput(item); return { value: item.model, label: item.displayName, description: disabled ? "Image input not supported" : undefined, disabled }; });
  const modelControl = <Dropdown value={selectedModel} options={modelDropdownOptions} onChange={onModelChange} ariaLabel="Model options" loading={isLoadingModels} placeholder="Select a model" className={cx("gen-select-wrap")} triggerClassName={cx("gen-select", "gen-model-select")} menuClassName={cx("gen-select-menu", "gen-model-menu")} />;
  const canSubmit = canGenerate && !imageCreditEstimateLoading;
  const formattedCreditEstimate = imageCreditEstimate?.toLocaleString(undefined, { maximumFractionDigits: 2 });
  const estimatedCreditsValue = imageCreditEstimateLoading
    ? <span className={cx("gen-estimate-recalculating")} aria-label="Updating price"><LoaderCircle size={12} aria-hidden="true" /></span>
    : imageCreditEstimate !== null && !imageCreditEstimateError ? `= ${formattedCreditEstimate} Credits` : "Pricing unavailable";
  const generationLabel = activeTab === "AI Background" ? backgroundMode === "remove" ? "REMOVE BACKGROUND" : backgroundMode === "replace" ? "REPLACE BACKGROUND" : backgroundMode === "generate" ? "GENERATE BACKGROUND" : "APPLY COLOR" : isImageToImage ? "TRANSFORM IMAGE" : activeTab === "AI Style Transfer" ? "APPLY STYLE" : isUpscale ? "UPSCALE IMAGE" : activeTab === "Extend Image" ? "EXTEND IMAGE" : "GENERATE IMAGE";

  const handleRatioChange = (nextRatio: ImageRatio) => {
    onRatioChange(nextRatio);
    if (aspectRatioParameter) onModelParamChange(aspectRatioParameter, nextRatio);
    const matchingSize = textSizeOptions.find((item) => imageRatioFromSize(item) === nextRatio);
    if (textSizeFieldName && matchingSize) onModelParamChange(textSizeFieldName, matchingSize);
  };

  const handleSizeChange = (nextSize: unknown) => {
    if (!textSizeFieldName) return;
    onModelParamChange(textSizeFieldName, nextSize);
    if (typeof nextSize !== "string") return;
    const nextRatio = imageRatioFromSize(nextSize);
    if (!nextRatio || !aspectRatioOptions.includes(nextRatio)) return;
    onRatioChange(nextRatio);
    if (aspectRatioParameter) onModelParamChange(aspectRatioParameter, nextRatio);
  };

  return <aside className={cx("gen-panel", "gen-settings-panel")} data-background-remove={isBackgroundRemove ? "true" : "false"}>
    <div className={cx("gen-panel-title")}><h2>SETTINGS</h2><span className={cx("gen-dial")}>DIAL IT IN</span></div>
    <div className={cx("gen-setting-block")}><h3>MODEL <Info size={12} /></h3>{modelControl}</div>
    {!isBackgroundRemove && !isBackgroundSolid && <DynamicModelParameters capabilities={modelCapabilities} values={modelParams} onChange={onModelParamChange} />}
    {!isUpscale && aspectRatioOptions.length > 0 && <div className={cx("gen-setting-block")}><h3>ASPECT RATIO <Info size={12} /></h3><AspectRatioPicker options={aspectRatioOptions} value={aspectRatioOptions.includes(selectedAspectRatio) ? selectedAspectRatio : aspectRatioOptions[0]} onChange={handleRatioChange} />{optionsFollowModel && <p className={cx("gen-model-options-note")} role="status">Options update to match the selected model.</p>}</div>}
    {isUpscale ? <ResolutionControl resolution={resolution} resolutionOptions={resolutionOptions} onChange={onResolutionChange} secondaryLabel="AI output resolution" /> : <>{showGenericResolution && <ResolutionControl resolution={resolution} resolutionOptions={resolutionOptions} onChange={onResolutionChange} descriptions={imageResolutionSizes[ratio]} />}</>}
    {isTextToImage && textResolutionField && <SchemaFieldControl field={textResolutionField} value={modelParams[textResolutionField.name]} onChange={(value) => onModelParamChange(textResolutionField.name, value)} />}
    {isTextToImage && textSizeField && <SchemaFieldControl field={textSizeField} value={modelParams[textSizeField.name]} options={textSizeOptions.length > 0 ? textSizeOptions : undefined} onChange={handleSizeChange} />}
    {isTextToImage && textSeedField && <SchemaFieldControl field={textSeedField} value={modelParams[textSeedField.name]} onChange={(value) => onModelParamChange(textSeedField.name, value)} />}
    {qualityEnabled && <div className={cx("gen-setting-block")}><h3>{isTextToImage && modelCapabilities?.qualityParameter ? modelCapabilities.qualityParameter : "QUALITY"} <Info size={12} /></h3><Segmented items={qualityOptions} value={quality} onChange={onQualityChange} />{qualityIsPromptBased && <p className={cx("gen-model-options-note")}>Applied as a prompt instruction because this model has no native quality parameter.</p>}</div>}
    {outputFormatOptions.length > 0 && <div className={cx("gen-setting-block")}><h3>{isTextToImage && modelCapabilities?.outputFormatParameter ? modelCapabilities.outputFormatParameter : "OUTPUT FORMAT"} <Info size={12} /></h3><Segmented items={outputFormatOptions} value={outputFormat && outputFormatOptions.includes(outputFormat) ? outputFormat : outputFormatOptions[0] ?? ""} onChange={onOutputFormatChange} /><p className={cx("gen-model-options-note")}>Available formats for the selected model.</p></div>}
    {showCountControl && <div className={cx("gen-setting-block")}><h3>NUMBER OF IMAGES <Info size={12} /></h3><Segmented items={countOptions} value={count} onChange={onCountChange} /></div>}
    <div className={cx("gen-estimate")}><div><h3>ESTIMATED CREDITS <Info size={12} /></h3><p>{isUpscale ? `1 image x ${resolution}` : `${showCountControl ? `${count} images` : "1 image"}`} <strong>{estimatedCreditsValue}</strong></p></div></div>
    {generationStatus === "cancelled" && <p className={cx("gen-generation-status")} role="status">Generation cancelled</p>}
    {generationError && <p className={cx("gen-generation-error")} role="alert">{generationError}</p>}
    {generationValidationMessage && <p className={cx("gen-generation-validation")} role="status">{generationValidationMessage}</p>}
    {isGenerating && <button type="button" className={cx("gen-cancel-button")} onClick={onCancel}>Cancel generation</button>}
    <button type="button" className={cx("gen-generate-button")} onClick={onGenerate} disabled={!canSubmit} aria-busy={isGenerating}>{isGenerating ? <LoaderCircle size={20} className={cx("gen-generating-icon")} aria-hidden="true" /> : <Sparkles size={20} aria-hidden="true" />} {isGenerating ? "GENERATING..." : generationLabel}</button>
    <p className={cx("gen-private")}><LockKeyhole size={12} /> Your generation is private and secure</p>
  </aside>;
}
