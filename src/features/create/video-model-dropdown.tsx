"use client";

import type { ReactNode } from "react";
import { Dropdown } from "@/components/ui/dropdown";
import type { GenerationModelOption } from "@/lib/api/generation-models";
import styles from "./video-generation-page.module.css";

type VideoModelDropdownProps = {
  models: readonly GenerationModelOption[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  loading?: boolean;
  disabled?: boolean;
  placeholder?: ReactNode;
};

function modelLabel(model: GenerationModelOption) {
  return (
    <span className={styles.videoModelOptionLabel}>
      <strong>{model.displayName}</strong>
    </span>
  );
}

export function VideoModelDropdown({
  models,
  value,
  onChange,
  ariaLabel,
  loading = false,
  disabled = false,
  placeholder = "No compatible model",
}: VideoModelDropdownProps) {
  return (
    <Dropdown
      value={value}
      options={models.map((model) => ({
        value: model.model,
        label: modelLabel(model),
      }))}
      onChange={onChange}
      ariaLabel={ariaLabel}
      loading={loading}
      disabled={disabled}
      placeholder={placeholder}
      className={styles.modelDropdown}
      triggerClassName={styles.modelDropdownTrigger}
      menuClassName={styles.modelDropdownMenu}
      optionClassName={styles.modelDropdownOption}
    />
  );
}
