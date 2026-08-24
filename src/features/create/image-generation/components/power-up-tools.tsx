import { Plus } from "lucide-react";
import { powerUpTools } from "../config";
import { cx } from "../styles";

export function PowerUpTools() {
  return <section className={cx("gen-tools")}><div className={cx("gen-section-heading")}><h2>POWER UP YOUR IMAGES</h2><span>View all tools</span></div><div className={cx("gen-tool-grid")}>{powerUpTools.map(([tool, description], index) => <button type="button" key={tool}><span className={cx("gen-tool-icon", `tool-${index}`)}><Plus size={20} /></span><span><b>{tool}</b><small>{description}</small></span></button>)}</div></section>;
}
