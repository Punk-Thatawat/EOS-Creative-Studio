import { type PricingProperty, type PricingRow } from "./pricing.types";
import {
  documentFeatureKeys,
  nonPricingParameters,
  presenterFeatureKeys,
  pricingParameterPattern,
} from "./pricing.constants";

export function pricingLabel(name: string, property: PricingProperty) {
  if (property.title?.trim()) return property.title.trim();
  return name
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function isPricingProperty(name: string, property: PricingProperty) {
  return (
    property.readOnly !== true &&
    property.deprecated !== true &&
    !nonPricingParameters.has(name) &&
    pricingParameterPattern.test(name)
  );
}

export function pricingProperties(row: PricingRow): Array<[string, PricingProperty]> {
  const properties =
    row.capabilities?.apiSchema?.request_schema?.properties ?? {};
  const fromSchema = Object.entries(properties).filter(([name, property]) =>
    isPricingProperty(name, property as PricingProperty),
  ) as Array<[string, PricingProperty]>;
  const customProperties: Array<[string, PricingProperty]> = [];
  if (row.provider === "iapp" && row.featureKey === "document-ocr") {
    customProperties.push(["pages", { title: "Pages", type: "integer", default: 1, minimum: 1, maximum: 100000 }]);
  } else if (documentFeatureKeys.has(row.featureKey) && row.featureKey !== "document-ocr") {
    customProperties.push(
      ["input_tokens", { title: "Estimated input tokens", type: "integer", default: 2000, minimum: 0, maximum: 1000000 }],
      ["output_tokens", { title: "Estimated output tokens", type: "integer", default: 1000, minimum: 0, maximum: 1000000 }],
    );
  }
  if (presenterFeatureKeys.has(row.featureKey)) {
    customProperties.push(["duration", { title: "Scene duration (seconds)", type: "integer", default: 13, minimum: 1, maximum: 15 }]);
  }
  const mergeCustomProperties = (base: Array<[string, PricingProperty]>) => {
    const missingCustom = customProperties.filter(([name]) => !base.some(([baseName]) => baseName === name));
    return [...base.slice(0, Math.max(0, 8 - missingCustom.length)), ...missingCustom].slice(0, 8);
  };
  if (fromSchema.length > 0) return mergeCustomProperties(fromSchema);

  const capabilities = row.capabilities;
  if (!capabilities) return customProperties;
  const fields = new Map<string, PricingProperty>();
  const add = (name: string | undefined, property: PricingProperty) => {
    if (name && capabilities.parameters.includes(name))
      fields.set(name, property);
  };
  add(capabilities.sizeParameter, {
    title: "Image size",
    type: "string",
    enum: capabilities.supportedSizes,
  });
  add(capabilities.resolutionParameter, {
    title: "Resolution",
    type: "string",
    enum: capabilities.supportedResolutions,
  });
  add(capabilities.targetResolutionParameter, {
    title: "Target resolution",
    type: "string",
    enum: capabilities.supportedResolutions,
  });
  add(capabilities.qualityParameter, {
    title: "Quality",
    type: "string",
    enum: capabilities.qualityValues,
  });
  add(capabilities.countParameter, {
    title: "Images per generation",
    type: "integer",
    minimum: 1,
    maximum: 8,
  });
  return mergeCustomProperties([...fields.entries()]);
}

export function defaultScenarioValues(row: PricingRow): Record<string, unknown> {
  const values = Object.fromEntries(
    pricingProperties(row).map(([name, property]) => {
      if (property.default !== undefined) return [name, property.default];
      if (Array.isArray(property.enum) && property.enum.length > 0) {
        const standardSize = property.enum.find(
          (value) =>
            String(value) === "1024*1024" || String(value) === "1024x1024",
        );
        return [name, standardSize ?? property.enum[0]];
      }
      return [name, undefined];
    }),
  );
  return {
    ...values,
    ...(row.provider === "iapp" && row.featureKey === "document-ocr" ? { pages: 1 } : {}),
    ...(documentFeatureKeys.has(row.featureKey) && row.featureKey !== "document-ocr"
      ? { input_tokens: 2000, output_tokens: 1000 }
      : {}),
    ...(presenterFeatureKeys.has(row.featureKey) ? { duration: 13, aspect_ratio: "16:9" } : {}),
  };
}

export function cleanScenarioValues(values: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(values).filter(
      ([, value]) => value !== undefined && value !== "",
    ),
  );
}
