import { Info } from "lucide-react";
import { cx } from "../styles";
import { useLocale } from "@/lib/i18n/locale-provider";

type PromptOptimizerToggleProps = {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
};

export function PromptOptimizerToggle({ enabled, onChange }: PromptOptimizerToggleProps) {
  const { t } = useLocale();
  return <div className={cx("gen-toggle-row", "gen-prompt-optimizer-toggle")}>
    <span>{t("create.smartEnhance")} <Info size={12} /></span>
    <button
      type="button"
      className={cx("gen-toggle", enabled && "is-on")}
      aria-label={enabled ? t("create.smartEnhanceOn") : t("create.smartEnhanceOff")}
      aria-pressed={enabled}
      onClick={() => onChange(!enabled)}
    >
      <i />
    </button>
  </div>;
}
