"use client";

import { useEffect, useRef, type PointerEvent } from "react";
import { Upload } from "lucide-react";
import type { MaskTool } from "../config";
import { cx } from "../styles";

/* The source image is a signed CDN URL and cannot use Next Image without a fixed remote host. */
/* eslint-disable @next/next/no-img-element */

type MaskPoint = { x: number; y: number };

export function MaskEditor({ imageUrl, tool, brushSize, resetKey, onMaskChange }: { imageUrl: string | null; tool: MaskTool; brushSize: number; resetKey: number; onMaskChange: (mask: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<MaskPoint | null>(null);
  const lassoPointsRef = useRef<MaskPoint[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const initialize = (width: number, height: number) => {
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d")?.clearRect(0, 0, width, height);
      const maskCanvas = document.createElement("canvas");
      maskCanvas.width = width;
      maskCanvas.height = height;
      const maskContext = maskCanvas.getContext("2d");
      if (maskContext) {
        maskContext.fillStyle = "#000000";
        maskContext.fillRect(0, 0, width, height);
      }
      maskCanvasRef.current = maskCanvas;
      lassoPointsRef.current = [];
      lastPointRef.current = null;
      onMaskChange(null);
    };

    if (!imageUrl) {
      initialize(900, 600);
      return;
    }

    const source = new window.Image();
    source.onload = () => initialize(source.naturalWidth || 900, source.naturalHeight || 600);
    source.onerror = () => initialize(900, 600);
    source.src = imageUrl;
    return () => {
      source.onload = null;
      source.onerror = null;
    };
  }, [imageUrl, onMaskChange, resetKey]);

  const getImageBounds = (canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const imageRatio = canvas.width / canvas.height;
    const containerRatio = rect.width / rect.height;
    const width = imageRatio > containerRatio ? rect.width : rect.height * imageRatio;
    const height = imageRatio > containerRatio ? rect.width / imageRatio : rect.height;
    return { left: rect.left + (rect.width - width) / 2, top: rect.top + (rect.height - height) / 2, width, height };
  };

  const getPoint = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const bounds = getImageBounds(canvas);
    if (event.clientX < bounds.left || event.clientX > bounds.left + bounds.width || event.clientY < bounds.top || event.clientY > bounds.top + bounds.height) return null;
    return { x: ((event.clientX - bounds.left) / bounds.width) * canvas.width, y: ((event.clientY - bounds.top) / bounds.height) * canvas.height };
  };

  const drawMaskStroke = (point: MaskPoint) => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    const context = maskCanvas.getContext("2d");
    if (!context) return;
    context.globalCompositeOperation = "source-over";
    context.strokeStyle = tool === "eraser" ? "#000000" : "#ffffff";
    context.lineWidth = brushSize;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.beginPath();
    const previous = lastPointRef.current ?? point;
    context.moveTo(previous.x, previous.y);
    context.lineTo(point.x, point.y);
    context.stroke();
  };

  const drawEditorStroke = (point: MaskPoint) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.globalCompositeOperation = tool === "eraser" ? "destination-out" : "source-over";
    context.strokeStyle = "rgba(242, 107, 56, .72)";
    context.lineWidth = brushSize;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.beginPath();
    const previous = lastPointRef.current ?? point;
    context.moveTo(previous.x, previous.y);
    context.lineTo(point.x, point.y);
    context.stroke();
  };

  const paint = (event: PointerEvent<HTMLCanvasElement>) => {
    const point = getPoint(event);
    if (!point || !drawingRef.current) return;
    if (tool === "lasso") {
      const canvas = canvasRef.current;
      const previous = lastPointRef.current;
      if (!canvas || !previous) return;
      const context = canvas.getContext("2d");
      if (!context) return;
      context.globalCompositeOperation = "source-over";
      context.strokeStyle = "rgba(242, 107, 56, .9)";
      context.lineWidth = 2;
      context.setLineDash([7, 5]);
      context.beginPath();
      context.moveTo(previous.x, previous.y);
      context.lineTo(point.x, point.y);
      context.stroke();
      context.setLineDash([]);
      lassoPointsRef.current.push(point);
    } else {
      drawEditorStroke(point);
      drawMaskStroke(point);
    }
    lastPointRef.current = point;
  };

  const finishPaint = () => {
    drawingRef.current = false;
    const maskCanvas = maskCanvasRef.current;
    const canvas = canvasRef.current;
    if (tool === "lasso" && canvas && maskCanvas && lassoPointsRef.current.length >= 3) {
      const points = lassoPointsRef.current;
      const maskContext = maskCanvas.getContext("2d");
      const editorContext = canvas.getContext("2d");
      if (maskContext && editorContext) {
        maskContext.fillStyle = "#ffffff";
        maskContext.beginPath();
        maskContext.moveTo(points[0].x, points[0].y);
        points.slice(1).forEach((point) => maskContext.lineTo(point.x, point.y));
        maskContext.closePath();
        maskContext.fill();
        editorContext.fillStyle = "rgba(242, 107, 56, .35)";
        editorContext.beginPath();
        editorContext.moveTo(points[0].x, points[0].y);
        points.slice(1).forEach((point) => editorContext.lineTo(point.x, point.y));
        editorContext.closePath();
        editorContext.fill();
        onMaskChange(maskCanvas.toDataURL("image/png"));
      }
    } else if (tool !== "lasso" && maskCanvas && lastPointRef.current) {
      onMaskChange(maskCanvas.toDataURL("image/png"));
    }
    lassoPointsRef.current = [];
    lastPointRef.current = null;
  };

  return <div className={cx("gen-mask-editor", !imageUrl && "is-empty")}><div className={cx("gen-mask-canvas-wrap")}>
    {imageUrl ? <img src={imageUrl} alt="Source image for mask refinement" className={cx("gen-mask-source")} /> : <div className={cx("gen-mask-empty")}><Upload size={22} /><span>Upload a source image to edit the mask</span></div>}
    <canvas ref={canvasRef} className={cx("gen-mask-canvas")} onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); const point = getPoint(event); if (!point) return; drawingRef.current = true; lastPointRef.current = point; if (tool === "lasso") lassoPointsRef.current = [point]; else paint(event); }} onPointerMove={paint} onPointerUp={finishPaint} onPointerCancel={finishPaint} aria-label="Draw a black and white subject removal mask" />
  </div></div>;
}
