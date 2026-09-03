"use client";

import { useCallback, useEffect, useState } from "react";
import { CirclePlay, LoaderCircle, Video, X } from "lucide-react";
import { listPublicTutorials, type AdminTutorialSlot } from "@/lib/api/tutorials";
import { cx } from "../styles";

function ImageTutorialDialog({ feature, featureName, mode, onClose }: { feature: string; featureName: string; mode?: string; onClose: () => void }) {
  const [tutorial, setTutorial] = useState<AdminTutorialSlot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const tutorials = await listPublicTutorials(feature);
      const overview = tutorials.find((item) => !item.mode && item.enabled) ?? null;
      const selected = mode ? tutorials.find((item) => item.mode === mode && item.enabled) ?? overview : overview ?? tutorials.find((item) => item.enabled) ?? null;
      setTutorial(selected);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load tutorial");
    } finally {
      setLoading(false);
    }
  }, [feature, mode]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const title = tutorial?.modeName ? `${featureName} · ${tutorial.modeName}` : `${featureName} tutorial`;

  return <div className={cx("gen-tutorial-dialog")} role="dialog" aria-modal="true" aria-labelledby="image-tutorial-dialog-title">
    <div className={cx("gen-tutorial-dialog-content")}>
      <header className={cx("gen-tutorial-dialog-header")}><div><span>TUTORIAL</span><h2 id="image-tutorial-dialog-title">{title}</h2><p>{tutorial?.mode ? "Mode-specific guide" : "Feature guide"}</p></div><button type="button" onClick={onClose} className={cx("gen-tutorial-dialog-close")} aria-label="Close tutorial"><X size={18} /></button></header>
      <div className={cx("gen-tutorial-dialog-body")}>
        {loading ? <div className={cx("gen-tutorial-dialog-state")}><LoaderCircle size={22} className={cx("gen-generating-icon")} /><span>Loading tutorial...</span></div> : error ? <div className={cx("gen-tutorial-dialog-state", "is-error")}><span>{error}</span></div> : tutorial?.videoUrl ? <video src={tutorial.videoUrl} controls autoFocus={false} playsInline preload="metadata" className={cx("gen-tutorial-video")} /> : <div className={cx("gen-tutorial-dialog-state")}><Video size={26} /><span>No tutorial is available for this tool yet.</span></div>}
      </div>
      <footer className={cx("gen-tutorial-dialog-footer")}><p>{tutorial?.description ?? "Learn the key steps before you generate."}</p><button type="button" onClick={onClose}>Close</button></footer>
    </div>
  </div>;
}

export function ImageTutorialButton({ feature, featureName, mode }: { feature: string; featureName: string; mode?: string }) {
  const [open, setOpen] = useState(false);

  return <>
    <button type="button" className={cx("gen-tutorial-trigger")} onClick={() => setOpen(true)} aria-haspopup="dialog"><CirclePlay size={15} /><span>Tutorial</span></button>
    {open ? <ImageTutorialDialog feature={feature} featureName={featureName} mode={mode} onClose={() => setOpen(false)} /> : null}
  </>;
}
