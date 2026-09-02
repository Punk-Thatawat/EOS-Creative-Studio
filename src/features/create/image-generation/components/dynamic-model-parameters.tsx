import { useMemo, useState } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { Dropdown } from "@/components/ui/dropdown";
import type { GenerationModelOption } from "@/lib/api/generation-models";
import { cx } from "../styles";

type ModelProperty = {
  type?: string;
  title?: string;
  description?: string;
  default?: unknown;
  enum?: unknown[];
  minimum?: number;
  maximum?: number;
  format?: string;
  [key: string]: unknown;
};

type DynamicModelParametersProps = {
  capabilities?: GenerationModelOption["capabilities"];
  values: Record<string, unknown>;
  onChange: (name: string, value: unknown) => void;
};

const standardProviderParameters = new Set([
  "prompt", "text_prompt", "textPrompt", "positive_prompt", "positivePrompt", "instruction",
  "image", "image_url", "imageUrl", "input_image", "inputImage", "source", "source_image", "sourceImage",
  "images", "reference_images", "referenceImages", "references", "input_images", "inputImages",
  "style_image", "styleImage", "style_reference_image", "styleReferenceImage",
  "quality", "quality_level", "qualityLevel", "negative_prompt", "negativePrompt",
  "strength", "image_strength", "imageStrength", "style_strength", "styleStrength",
  "content_preservation", "contentPreservation", "preserve_structure", "preserveStructure",
  "size", "image_size", "imageSize", "aspect_ratio", "aspectRatio", "ratio",
  "resolution", "output_resolution", "outputResolution", "width", "image_width", "imageWidth",
  "height", "image_height", "imageHeight", "output_format", "outputFormat", "format",
  "target_resolution", "targetResolution", "output_size", "outputSize",
  "count", "num_images", "numImages", "batch_size", "batchSize", "seed",
  "mask", "mask_image", "maskImage", "background_image", "backgroundImage",
  "background_operation", "backgroundOperation", "operation", "background_mode", "backgroundMode", "mode",
  "transparent", "is_transparent", "isTransparent", "remove_background", "removeBackground",
  "background_color", "backgroundColor", "bg_color", "bgColor", "auto_detect_subject", "autoDetectSubject",
  "preserve_subject", "preserveSubject", "keep_subject", "keepSubject", "edge_cleanup", "edgeCleanup",
  "cleanup_edges", "cleanupEdges", "add_shadow", "addShadow", "shadow", "match_lighting", "matchLighting",
  "relight", "relight_subject", "mask_tool", "maskTool", "enable_sync_mode", "enable_base64_output",
]);

function labelFor(name: string, property: ModelProperty): string {
  if (property.title?.trim()) return property.title.trim();
  return name.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function parseValue(value: string, property: ModelProperty): unknown {
  if (property.type === "integer") return value === "" ? undefined : Number.parseInt(value, 10);
  if (property.type === "number") return value === "" ? undefined : Number(value);
  if (property.type === "boolean") return value === "true";
  return value === "" ? undefined : value;
}

function isRenderableProperty(name: string, property: ModelProperty): boolean {
  if (standardProviderParameters.has(name)) return false;
  if (property.readOnly === true || property.deprecated === true) return false;
  return true;
}

function DynamicField({ name, property, value, onChange }: { name: string; property: ModelProperty; value: unknown; onChange: (value: unknown) => void }) {
  const label = labelFor(name, property);
  const type = property.type ?? (property.enum ? "string" : typeof property.default === "boolean" ? "boolean" : typeof property.default === "number" ? "number" : "string");
  const description = property.description?.trim();

  if (Array.isArray(property.enum) && property.enum.length > 0) {
    return <div className={cx("gen-dynamic-field")}><label>{label}</label><Dropdown value={value === undefined ? "" : String(value)} options={property.enum.map((option) => ({ value: String(option), label: String(option) }))} onChange={(nextValue) => onChange(parseValue(nextValue, property))} placeholder="Auto" ariaLabel={label} triggerClassName={cx("gen-select")} menuClassName={cx("gen-select-menu")} />{description && <small>{description}</small>}</div>;
  }

  if (type === "boolean") {
    return <label className={cx("gen-dynamic-checkbox")}><input type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} /><span><b>{label}</b>{description && <small>{description}</small>}</span></label>;
  }

  if (type === "array" || type === "object") {
    const serialized = value === undefined ? "" : JSON.stringify(value);
    return <div className={cx("gen-dynamic-field")}><label htmlFor={`model-param-${name}`}>{label}<small>JSON</small></label><textarea id={`model-param-${name}`} value={serialized} placeholder={type === "array" ? "[\"value\"]" : "{\"key\": \"value\"}"} onChange={(event) => { try { onChange(event.target.value.trim() ? JSON.parse(event.target.value) : undefined); } catch { /* Keep the current valid value until JSON is complete. */ } }} />{description && <small>{description}</small>}</div>;
  }

  return <div className={cx("gen-dynamic-field")}><label htmlFor={`model-param-${name}`}>{label}</label><input id={`model-param-${name}`} type={type === "number" || type === "integer" ? "number" : property.format === "uri" || property.format === "url" ? "url" : "text"} value={value === undefined ? "" : String(value)} min={property.minimum} max={property.maximum} step={type === "integer" ? 1 : "any"} placeholder={property.default === undefined ? "Auto" : String(property.default)} onChange={(event) => onChange(parseValue(event.target.value, property))} />{description && <small>{description}</small>}</div>;
}

export function DynamicModelParameters({ capabilities, values, onChange }: DynamicModelParametersProps) {
  const [open, setOpen] = useState(false);
  const properties = capabilities?.apiSchema?.request_schema?.properties;
  const fields = useMemo(() => Object.entries(properties ?? {}).filter(([name, property]) => isRenderableProperty(name, property)), [properties]);

  if (!fields.length) return null;

  return <details className={cx("gen-advanced", "gen-dynamic-params")} open={open} onToggle={(event) => setOpen(event.currentTarget.open)}><summary><span><SlidersHorizontal size={13} /> MODEL PARAMETERS <small>{fields.length} model-specific</small></span><ChevronDown size={14} /></summary><div className={cx("gen-advanced-body", "gen-dynamic-params-body")}>{fields.map(([name, property]) => <DynamicField key={name} name={name} property={property} value={values[name]} onChange={(value) => onChange(name, value)} />)}<p className={cx("gen-dynamic-note")}>These controls come from the selected model schema. Unsupported values are rejected before provider submission.</p></div></details>;
}
