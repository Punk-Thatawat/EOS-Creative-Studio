import { Info } from "lucide-react";
import { cx } from "../styles";

type PromptOptimizerToggleProps = {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
};

export function PromptOptimizerToggle({ enabled, onChange }: PromptOptimizerToggleProps) {
  return <div className={cx("gen-toggle-row", "gen-prompt-optimizer-toggle")}>
    <span>Smart Enhance <Info size={12} /></span>
    <button
      type="button"
      className={cx("gen-toggle", enabled && "is-on")}
      aria-label={`Smart Enhance ${enabled ? "on" : "off"}`}
      aria-pressed={enabled}
      onClick={() => onChange(!enabled)}
    >
      <i />
    </button>
  </div>;
}
