import { imageGenerationTabs, type ImageGenerationTab } from "../config";
import { cx } from "../styles";

export function ImageGenerationTabs({ activeTab, onTabChange }: { activeTab: ImageGenerationTab; onTabChange: (tab: ImageGenerationTab) => void }) {
  return <nav className={cx("gen-tabs")} aria-label="Image tools">{imageGenerationTabs.map((tab) => <button type="button" key={tab} onClick={() => onTabChange(tab)} className={activeTab === tab ? cx("is-active") : undefined}>{tab}</button>)}</nav>;
}
