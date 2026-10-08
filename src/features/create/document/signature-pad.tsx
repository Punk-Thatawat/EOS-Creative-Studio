"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { TranslationKey } from "@/lib/i18n/dictionary";
import { useLocale } from "@/lib/i18n/locale-provider";
import styles from "./document-generation-page.module.css";

const K = (key: string) => `create.document.${key}` as TranslationKey;

const PAD_WIDTH = 480;
const PAD_HEIGHT = 180;

/** Crops transparent margins so the signature that lands on the page is only as big as the ink. */
function trimmed(canvas: HTMLCanvasElement): { url: string; ratio: number } | null {
  const context = canvas.getContext("2d");
  if (!context) return null;
  const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height);
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if ((data[(y * width + x) * 4 + 3] ?? 0) > 0) {
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
  }
  if (right < 0) return null;
  const pad = 4;
  const cropX = Math.max(0, left - pad);
  const cropY = Math.max(0, top - pad);
  const cropW = Math.min(width - cropX, right - left + 1 + pad * 2);
  const cropH = Math.min(height - cropY, bottom - top + 1 + pad * 2);
  const out = document.createElement("canvas");
  out.width = cropW;
  out.height = cropH;
  out.getContext("2d")?.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
  return { url: out.toDataURL("image/png"), ratio: cropH / cropW };
}

/** A small dialog to draw a signature with the mouse or a finger. `onDone` gets it as a transparent PNG. */
export function SignaturePad({ onDone, onCancel }: { onDone: (signature: { url: string; ratio: number }) => void; onCancel: () => void }) {
  const { t } = useLocale();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  const point = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: ((event.clientX - rect.left) / rect.width) * PAD_WIDTH, y: ((event.clientY - rect.top) / rect.height) * PAD_HEIGHT };
  };
  const start = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const context = canvasRef.current?.getContext("2d");
    if (!context) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drawing.current = true;
    const { x, y } = point(event);
    context.lineWidth = 3;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#0b2a6f";
    context.beginPath();
    context.moveTo(x, y);
    // A tap leaves a dot.
    context.lineTo(x + 0.01, y);
    context.stroke();
    setEmpty(false);
  };
  const move = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const context = canvasRef.current?.getContext("2d");
    if (!context) return;
    const { x, y } = point(event);
    context.lineTo(x, y);
    context.stroke();
  };
  const stop = () => { drawing.current = false; };

  const clear = () => {
    const canvas = canvasRef.current;
    canvas?.getContext("2d")?.clearRect(0, 0, PAD_WIDTH, PAD_HEIGHT);
    setEmpty(true);
  };
  const done = () => {
    const canvas = canvasRef.current;
    const signature = canvas ? trimmed(canvas) : null;
    if (signature) onDone(signature);
  };

  return (
    <dialog ref={dialogRef} className={styles.signatureDialog} aria-labelledby="signature-title" onCancel={onCancel}>
      <h4 id="signature-title">{t(K("form.signature.title"))}</h4>
      <canvas ref={canvasRef} className={styles.signatureCanvas} width={PAD_WIDTH} height={PAD_HEIGHT} onPointerDown={start} onPointerMove={move} onPointerUp={stop} onPointerCancel={stop} aria-label={t(K("form.signature.title"))} />
      <p>{t(K("form.signature.hint"))}</p>
      <div className={styles.signatureActions}>
        <button type="button" onClick={clear} disabled={empty}>{t(K("form.signature.clear"))}</button>
        <button type="button" onClick={onCancel}>{t(K("form.region.cancel"))}</button>
        <button type="button" className={styles.formStripPrimary} onClick={done} disabled={empty}>{t(K("form.signature.use"))}</button>
      </div>
    </dialog>
  );
}
