"use client";

import styles from "../video-generation-page.module.css";

export type DurationProperty = {
  type?: string;
  title?: string;
  default?: unknown;
  enum?: unknown[];
  minimum?: number;
  maximum?: number;
  step?: number;
};

function formatDuration(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function toNumber(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function DurationControl({
  property,
  value,
  required = false,
  onChange,
  variant = "settings",
}: {
  property: DurationProperty;
  value: unknown;
  required?: boolean;
  onChange: (value: number) => void;
  variant?: "settings" | "scene";
}) {
  const enumValues = (property.enum ?? []).map(toNumber).filter((item): item is number => item !== undefined);
  const hasEnum = enumValues.length > 0;
  const hasRange = property.minimum !== undefined && property.maximum !== undefined;
  const currentValue = toNumber(value) ?? toNumber(property.default) ?? enumValues[0] ?? property.minimum ?? 0;
  const enumIndex = hasEnum ? Math.max(0, enumValues.findIndex((item) => item === currentValue)) : 0;
  const minLabel = hasEnum ? enumValues[0] : property.minimum;
  const maxLabel = hasEnum ? enumValues[enumValues.length - 1] : property.maximum;
  const label = property.title ?? "Duration";
  const isScene = variant === "scene";
  const containerClass = isScene ? styles.sceneModalDuration : styles.settingBlock;
  const labelClass = isScene ? styles.sceneModalDurationLabel : styles.settingLabel;
  const rangeLabelsClass = isScene ? styles.sceneModalRangeLabels : styles.rangeLabels;

  return (
    <div className={containerClass}>
      <div className={labelClass}>
        {label}{required ? <b>*</b> : null}
        <strong>{formatDuration(currentValue)} sec</strong>
      </div>
      {hasEnum ? (
        <input
          type="range"
          min={0}
          max={enumValues.length - 1}
          step={1}
          value={enumIndex}
          onChange={(event) => onChange(enumValues[Number(event.target.value)] ?? enumValues[0])}
          aria-label={label}
        />
      ) : hasRange ? (
        <input
          type="range"
          min={property.minimum}
          max={property.maximum}
          step={property.step ?? (property.type === "integer" ? 1 : 0.01)}
          value={currentValue}
          onChange={(event) => onChange(Number(event.target.value))}
          aria-label={label}
        />
      ) : (
        <input
          className={styles.dynamicInput}
          type="number"
          min={property.minimum}
          max={property.maximum}
          step={property.step ?? (property.type === "integer" ? 1 : 0.01)}
          value={currentValue}
          onChange={(event) => onChange(Number(event.target.value))}
          aria-label={label}
        />
      )}
      <div className={rangeLabelsClass}>
        <span>{minLabel === undefined ? "" : `${formatDuration(minLabel)}s`}</span>
        <span>{maxLabel === undefined ? "" : `${formatDuration(maxLabel)}s`}</span>
      </div>
    </div>
  );
}
