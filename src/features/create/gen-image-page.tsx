"use client";

import { useState } from "react";
import {
  Check,
  ChevronDown,
  Download,
  Expand,
  Heart,
  ImagePlus,
  Info,
  LockKeyhole,
  Maximize2,
  Plus,
  RefreshCcw,
  RotateCcw,
  Sparkles,
  SlidersHorizontal,
  Stars,
  Upload,
  WandSparkles,
} from "lucide-react";

const tabs = ["Text to Image", "Image to Image", "AI Style Transfer", "AI Background", "Upscale", "Extend Image"];
const styles = ["Realistic", "Cyberpunk", "Cinematic", "3D Render", "Anime"];
const ratios = ["1:1", "16:9", "4:3", "3:4", "9:16"];
const thumbs = ["#09243a", "#173f5f", "#21152d", "#442016", "#132e35", "#3d1733", "#1a253c", "#182f29"];

function ImagePlaceholder({ className = "", label = "YOUR IMAGE HERE" }: { className?: string; label?: string }) {
  return (
    <div className={`gen-placeholder ${className}`}>
      <div className="gen-placeholder-glow" />
      <ImagePlus size={30} strokeWidth={1.5} />
      <span>{label}</span>
    </div>
  );
}

function Segmented({ items, value, onChange }: { items: string[]; value: string; onChange: (value: string) => void }) {
  return <div className="gen-segmented">{items.map((item) => <button type="button" key={item} onClick={() => onChange(item)} className={value === item ? "is-selected" : ""}>{item}</button>)}</div>;
}

export function GenImagePage() {
  const [activeTab, setActiveTab] = useState(tabs[0]);
  const [style, setStyle] = useState(styles[0]);
  const [ratio, setRatio] = useState("16:9");
  const [quality, setQuality] = useState("Standard");
  const [count, setCount] = useState("2");
  const [prompt, setPrompt] = useState("Futuristic cyberpunk city at night, massive neon billboards, wet streets, reflections, neon branding on a giant screen, cinematic lighting, ultra detailed.");
  const [generated, setGenerated] = useState(false);

  return (
    <div className="gen-image-page">
      <section className="gen-image-hero">
        <div className="gen-hero-copy"><span className="gen-hero-kicker">AI IMAGE GENERATION STUDIO <Sparkles size={13} /></span><h1>GEN IMAGE</h1><p>Make it <strong>visual.</strong></p></div>
        <div className="gen-hero-art" aria-label="Image placeholder"><span className="gen-hero-splash splash-orange" /><span className="gen-hero-splash splash-pink" /><div><ImagePlus size={38} /><small>ADD YOUR HERO IMAGE</small></div></div>
      </section>

      <nav className="gen-tabs" aria-label="Image tools">{tabs.map((tab) => <button type="button" key={tab} onClick={() => setActiveTab(tab)} className={activeTab === tab ? "is-active" : ""}>{tab}</button>)}</nav>

      <div className="gen-workspace">
        <aside className="gen-panel gen-prompt-panel">
          <div className="gen-panel-title"><h2>PROMPT</h2><span>Be descriptive! ↘</span></div>
          <label className="gen-textarea-wrap"><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} aria-label="Prompt" /><Stars size={17} /></label>
          <div className="gen-toggle-row"><span>Smart Enhance <Info size={12} /></span><button type="button" className="gen-toggle is-on" aria-label="Smart Enhance on"><i /></button></div>
          <div className="gen-section-heading"><h3>STYLE PRESETS</h3><button type="button">View all</button></div>
          <div className="gen-style-grid">{styles.map((item, index) => <button type="button" key={item} onClick={() => setStyle(item)} className={style === item ? "is-selected" : ""}><span className="gen-style-thumb" style={{ background: `linear-gradient(145deg, ${["#e26731", "#204d69", "#6b405a", "#789a9c", "#702a4f"][index]} 0%, #14151e 100%)` }}>{style === item && <span className="gen-selected-check"><Check size={11} strokeWidth={3} /></span>}</span><small>{item}</small></button>)}</div>
          <div className="gen-section-heading"><h3>COMPOSITION</h3></div><div className="gen-ratio-grid">{ratios.map((item) => <button type="button" key={item} onClick={() => setRatio(item)} className={ratio === item ? "is-selected" : ""}><span className="ratio-icon" />{item}</button>)}</div>
          <div className="gen-section-heading"><h3>NEGATIVE PROMPT</h3></div><label className="gen-input-wrap"><input defaultValue="low quality, blurry, text, watermark, logo, deformed..." aria-label="Negative prompt" /><Stars size={14} /></label>
          <div className="gen-section-heading"><h3>REFERENCE IMAGE <em>(Optional)</em></h3></div><button type="button" className="gen-upload"><Upload size={20} /><span>Drag & drop an image here<br /><b>or click to upload</b></span><SlidersHorizontal size={17} /></button>
        </aside>

        <section className="gen-panel gen-preview-panel">
          <div className="gen-panel-title"><h2>PREVIEW</h2></div>
          <div className={`gen-preview-image ${generated ? "is-generated" : ""}`}><ImagePlaceholder label={generated ? "GENERATION PREVIEW" : "PREVIEW IMAGE"} /><span className="gen-live-badge">PREVIEW<br /><b>LIVE</b></span><div className="gen-image-actions"><button type="button" aria-label="Download"><Download size={16} /></button><button type="button" aria-label="Favorite"><Heart size={16} /></button><button type="button" aria-label="Expand"><Expand size={16} /></button></div></div>
          <div className="gen-action-row"><button type="button"><RotateCcw size={14} /> Undo</button><button type="button" disabled><RefreshCcw size={14} /> Redo</button><button type="button"><Sparkles size={14} /> Enhance</button><button type="button"><WandSparkles size={14} /> Vary (Strong)</button><button type="button"><WandSparkles size={14} /> Vary (Subtle)</button><button type="button"><RefreshCcw size={14} /> Reset</button></div>
          <div className="gen-gallery-grid"><div className="gen-gallery-column"><div className="gen-gallery-heading"><h3>VARIATIONS</h3><button type="button">View all</button></div><div className="gen-thumb-row">{thumbs.slice(0, 4).map((color, index) => <button type="button" key={index} className={index === 0 ? "is-selected" : ""} style={{ background: `linear-gradient(135deg, ${color}, #f26b38)` }} aria-label={`Variation ${index + 1}`}><span /></button>)}</div></div><div className="gen-gallery-column gen-recent-column"><div className="gen-gallery-heading"><h3>RECENT GENERATIONS</h3><button type="button">View history</button></div><div className="gen-thumb-row">{thumbs.slice(4).map((color, index) => <button type="button" key={index} style={{ background: `linear-gradient(135deg, ${color}, #f26b38)` }} aria-label={`Recent generation ${index + 1}`}><span /></button>)}<button type="button" className="gen-gallery-next" aria-label="Next recent generations"><ChevronDown size={18} /></button></div></div></div>
        </section>

        <aside className="gen-panel gen-settings-panel"><div className="gen-panel-title"><h2>SETTINGS</h2><span className="gen-dial">DIAL IT IN</span></div>
          <div className="gen-setting-block"><h3>MODEL <Info size={12} /></h3><div className="gen-model-grid"><button type="button" className="is-selected"><b>Standard</b><small>Balanced quality & speed</small><Check size={15} /></button><button type="button"><b>Premium</b><small>Highest quality & detail</small><Stars size={15} /></button></div></div>
          <div className="gen-setting-block"><h3>IMAGE SIZE <Info size={12} /></h3><button type="button" className="gen-select"><span><Maximize2 size={15} /> {ratio} <small>(1920 x 1080)</small></span><ChevronDown size={15} /></button></div>
          <div className="gen-setting-block"><h3>QUALITY <Info size={12} /></h3><Segmented items={["Draft", "Standard", "High", "Ultra"]} value={quality} onChange={setQuality} /></div>
          <div className="gen-setting-block"><h3>NUMBER OF IMAGES <Info size={12} /></h3><Segmented items={["1", "2", "4", "8"]} value={count} onChange={setCount} /></div>
          <div className="gen-estimate"><div><h3>ESTIMATED CREDITS <Info size={12} /></h3><p>{count} images x {quality} Quality <strong>= 20 Credits</strong></p></div></div>
          <button type="button" className="gen-generate-button" onClick={() => setGenerated(true)}><Sparkles size={20} /> GENERATE IMAGE</button><p className="gen-private"><LockKeyhole size={12} /> Your generation is private and secure</p>
        </aside>
      </div>

      <section className="gen-tools"><div className="gen-section-heading"><h2>POWER UP YOUR IMAGES</h2><span>View all tools</span></div><div className="gen-tool-grid">{["AI Background", "Remove Object", "Upscale Image", "Color Grading", "Remove Text", "Magic Expand"].map((tool, index) => <button type="button" key={tool}><span className={`gen-tool-icon tool-${index}`}><Plus size={20} /></span><span><b>{tool}</b><small>{["Create stunning backgrounds", "Clean your image in one click", "Increase resolution without losing quality", "Apply cinematic color tones", "Erase text & logos", "Extend beyond image borders"][index]}</small></span></button>)}</div></section>
    </div>
  );
}
