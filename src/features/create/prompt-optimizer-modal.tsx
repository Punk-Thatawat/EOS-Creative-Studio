"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { WandSparkles, X } from "lucide-react";
import { optimizePrompt, promptOptimizerStyles, type PromptOptimizerStyle } from "@/lib/api/prompt-optimizer";
import styles from "./prompt-optimizer-modal.module.css";

type PromptOptimizerModalProps = {
  image: string | null;
  initialText: string;
  targetLabel: string;
  mode: "image" | "video";
  onClose: () => void;
  onApply: (prompt: string) => void;
  onPrepareImage?: () => Promise<string | null>;
};

export function PromptOptimizerModal({ image, initialText, targetLabel, mode, onClose, onApply, onPrepareImage }: PromptOptimizerModalProps) {
  const [text, setText] = useState(initialText);
  const [style, setStyle] = useState<PromptOptimizerStyle>("default");
  const [optimizedText, setOptimizedText] = useState<string | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isOptimizing) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOptimizing, onClose]);

  const runOptimization = async () => {
    if (!text.trim() || isOptimizing) return;
    setIsOptimizing(true);
    setError(null);
    try {
      const preparedImage = onPrepareImage ? await onPrepareImage() : image;
      const result = await optimizePrompt({
        text: text.trim(),
        style,
        mode,
        ...(preparedImage ? { image: preparedImage } : {}),
      });
      setText(result.optimizedPrompt);
      setOptimizedText(result.optimizedPrompt);
    } catch (optimizationError) {
      setError(optimizationError instanceof Error ? optimizationError.message : "Prompt optimization failed");
    } finally {
      setIsOptimizing(false);
    }
  };

  return (
    <div
      className={styles.backdrop}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isOptimizing) onClose();
      }}
    >
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="prompt-optimizer-title">
        <div className={styles.header}>
          <div>
            <div className={styles.eyebrow}><WandSparkles size={14} /> PROMPT OPTIMIZER</div>
            <h2 id="prompt-optimizer-title">Improve {targetLabel}</h2>
            <p>Rewrite the prompt with clearer motion, camera direction, and visual detail.</p>
          </div>
          <button type="button" className={styles.close} onClick={onClose} disabled={isOptimizing} aria-label="Close Prompt Optimizer"><X size={17} /></button>
        </div>

        <div className={styles.imageField}>
          <div className={styles.fieldHeading}><span>IMAGE CONTEXT</span><small>Optional</small></div>
          {image ? <Image src={image} alt="Current scene context" width={460} height={150} unoptimized /> : <div className={styles.noImage}>No scene image selected</div>}
        </div>

        <label className={styles.field}>
          <span className={styles.fieldHeading}><span>TEXT</span><small>{text.length} / 4000</small></span>
          <textarea value={text} onChange={(event) => { setText(event.target.value); setOptimizedText(null); }} maxLength={4000} placeholder="Describe the scene and the movement you want" />
        </label>

        <label className={styles.field}>
          <span className={styles.fieldHeading}><span>STYLE</span></span>
          <select value={style} onChange={(event) => setStyle(event.target.value as PromptOptimizerStyle)}>
            {promptOptimizerStyles.map((option) => <option value={option} key={option}>{option}</option>)}
          </select>
        </label>

        {error ? <p className={styles.error} role="alert">{error}</p> : null}
        {optimizedText ? <p className={styles.success}>Prompt optimized. Review it above, then apply it to the scene.</p> : null}

        <div className={styles.actions}>
          <button type="button" className={styles.cancel} onClick={onClose} disabled={isOptimizing}>Cancel</button>
          {optimizedText ? <button type="button" className={styles.apply} onClick={() => onApply(text.trim())} disabled={!text.trim() || isOptimizing}>Use optimized prompt</button> : null}
          <button type="button" className={styles.optimize} onClick={() => void runOptimization()} disabled={!text.trim() || isOptimizing}>
            <WandSparkles size={15} /> {isOptimizing ? "Optimizing…" : "Optimize"}
          </button>
        </div>
      </div>
    </div>
  );
}
