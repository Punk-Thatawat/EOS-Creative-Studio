"use client";

import { useState, type ComponentType } from "react";
import { ChevronDown, type LucideProps } from "lucide-react";
import styles from "./mobile-mode-dropdown.module.css";

type ModeIcon = ComponentType<LucideProps>;

export type MobileModeOption<T extends string> = {
  value: T;
  label: string;
  icon: ModeIcon;
};

export function MobileModeDropdown<T extends string>({
  options,
  value,
  menuId,
  ariaLabel,
  currentModeLabel,
  switchModeLabel,
  otherModesLabel,
  onChange,
}: {
  options: readonly MobileModeOption<T>[];
  value: T;
  menuId: string;
  ariaLabel: string;
  currentModeLabel: string;
  switchModeLabel: string;
  otherModesLabel: string;
  onChange: (value: T) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const currentOption = options.find((option) => option.value === value) ?? options[0];
  if (!currentOption) return null;

  const CurrentIcon = currentOption.icon;

  return (
    <nav className={styles.switcher} aria-label={ariaLabel}>
      <button
        type="button"
        className={styles.current}
        aria-expanded={isOpen}
        aria-controls={menuId}
        aria-label={switchModeLabel}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span className={styles.icon}><CurrentIcon size={25} strokeWidth={2.2} aria-hidden="true" /></span>
        <span className={styles.currentCopy}>
          <small>{currentModeLabel}</small>
          <strong>{currentOption.label}</strong>
        </span>
        <ChevronDown size={24} aria-hidden="true" className={isOpen ? styles.chevronOpen : styles.chevron} />
      </button>

      {isOpen ? (
        <div id={menuId} className={styles.menu} role="menu" aria-label={otherModesLabel}>
          {options.map((option) => {
            const Icon = option.icon;
            const isSelected = option.value === value;
            return (
              <button
                type="button"
                role="menuitem"
                key={option.value}
                className={isSelected ? styles.optionSelected : styles.option}
                aria-current={isSelected ? "page" : undefined}
                onClick={() => {
                  setIsOpen(false);
                  onChange(option.value);
                }}
              >
                <Icon size={18} aria-hidden="true" />
                <span>{option.label}</span>
                {isSelected ? <small>{currentModeLabel}</small> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </nav>
  );
}
