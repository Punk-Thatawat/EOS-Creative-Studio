import { type GenerationModelOption } from "@/lib/api/generation-models";
import { type SchemaProperty } from "./video-generation.types";
import { coreModelParameterNames } from "./video-generation.constants";

export function parseSchemaEnumValue(rawValue: string, property: SchemaProperty): unknown {
  if (rawValue === "") return undefined;
  return property.enum?.find((option) => String(option) === rawValue) ?? rawValue;
}

export function hasSchemaValue(value: unknown): boolean {
  return value !== undefined && value !== null && value !== "" && (!Array.isArray(value) || value.length > 0);
}

export function isCameraFixedParameter(name: string, title?: string): boolean {
  const normalize = (value: string) => value.replace(/[^a-z0-9]/gi, "").toLowerCase();
  return normalize(name) === "camerafixed" || normalize(title ?? "") === "camerafixed";
}

export function isSeedParameter(name: string, title?: string): boolean {
  const normalize = (value: string) => value.replace(/[^a-z0-9]/gi, "").toLowerCase();
  return normalize(name) === "seed" || normalize(title ?? "") === "seed";
}

export function modelParamsForGeneration(
  params: Record<string, unknown>,
  schema: Record<string, SchemaProperty>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(params).filter(([name]) => !isCameraFixedParameter(name) && !isSeedParameter(name, schema[name]?.title)),
  );
}

export function schemaProperties(model: GenerationModelOption | undefined): Record<string, SchemaProperty> {
  const properties = (model?.capabilities.apiSchema?.request_schema?.properties ?? {}) as Record<string, SchemaProperty>;
  if (Object.keys(properties).length) return properties;
  return Object.fromEntries((model?.capabilities.parameters ?? []).map((name) => [name, { type: "string" }]));
}

export function requiredSchemaParameters(model: GenerationModelOption | undefined): string[] {
  return model?.capabilities.apiSchema?.request_schema?.required
    ?? model?.capabilities.requiredParameters
    ?? [];
}

export function modelFamily(modelId: string): string {
  return modelId
    .toLowerCase()
    .replace(/\/(?:image-to-video|video-extend|extend-video)$/, "");
}

export function schemaDefault(property: SchemaProperty | undefined): unknown {
  if (!property) return undefined;
  if (property.default !== undefined) return property.default;
  if (property.enum?.length) return property.enum[0];
  if (property.type === "boolean") return false;
  return undefined;
}

export function findSchemaProperty(properties: Record<string, SchemaProperty>, names: string[]): [string, SchemaProperty] | undefined {
  for (const name of names) {
    if (properties[name]) return [name, properties[name]];
  }
  return undefined;
}

export function modelAspectRatioOptions(model: GenerationModelOption | undefined): string[] {
  const property = findSchemaProperty(schemaProperties(model), ["aspectRatio", "aspect_ratio"]);
  const values = [
    ...(property?.[1].enum ?? []),
    ...(model?.capabilities.supportedRatios ?? []),
    ...(model?.capabilities.supportedAspectRatios ?? []),
  ]
    .map((value) => String(value).trim())
    .filter((value) => /^\d+(?::\d+)$/.test(value));
  return Array.from(new Set(values));
}

export function closestAspectRatio(value: number, options: string[]): string | undefined {
  if (!Number.isFinite(value) || value <= 0) return undefined;
  return options.reduce<string | undefined>((closest, option) => {
    const [width, height] = option.split(":").map(Number);
    const optionValue = width / height;
    if (!Number.isFinite(optionValue) || optionValue <= 0) return closest;
    if (!closest) return option;
    const [closestWidth, closestHeight] = closest.split(":").map(Number);
    return Math.abs(Math.log(optionValue / value)) < Math.abs(Math.log((closestWidth / closestHeight) / value))
      ? option
      : closest;
  }, undefined);
}

export function readImageAspectRatio(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    const objectUrl = URL.createObjectURL(file);
    const cleanup = () => URL.revokeObjectURL(objectUrl);
    image.onload = () => {
      cleanup();
      const ratio = image.naturalWidth / image.naturalHeight;
      if (Number.isFinite(ratio) && ratio > 0) resolve(ratio);
      else reject(new Error("Unable to read image dimensions"));
    };
    image.onerror = () => {
      cleanup();
      reject(new Error("Unable to read image dimensions"));
    };
    image.src = objectUrl;
  });
}

export function findModelInputParameter(
  model: GenerationModelOption | undefined,
  configured: string | undefined,
  aliases: string[],
): string | undefined {
  if (configured) return configured;
  return findSchemaProperty(schemaProperties(model), aliases)?.[0];
}

export function modelSpecificDefaults(model: GenerationModelOption | undefined): Record<string, unknown> {
  const properties = schemaProperties(model);
  const nextParams: Record<string, unknown> = {};
  const capabilities = model?.capabilities;
  for (const [name, property] of Object.entries(properties)) {
    if (coreModelParameterNames.has(name) || name === capabilities?.promptParameter || name === capabilities?.imageParameter || name === capabilities?.referenceImagesParameter || name === capabilities?.negativePromptParameter) continue;
    const value = schemaDefault(property);
    if (value !== undefined) nextParams[name] = value;
  }
  return nextParams;
}

export function formatHistoryDate(value?: string): string {
  if (!value) return "Recently generated";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently generated";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
}
