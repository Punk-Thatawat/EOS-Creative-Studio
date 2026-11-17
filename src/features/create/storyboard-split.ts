import {
  type AxisGap,
  type StoryboardEdgeStats,
  type StoryboardFrameSide,
} from "./video-generation.types";
import { HARD_MAX_STORYBOARD_SCENES } from "./video-generation.constants";

export function findLightRuns(
  scores: number[],
  minimumGapWidth: number,
  start = 0,
  end = scores.length,
): AxisGap[] {
  const mergeTolerance = Math.max(2, Math.round(scores.length * 0.002));
  const gaps: AxisGap[] = [];
  let currentStart: number | null = null;
  let gapBreak = 0;

  for (let coordinate = start; coordinate <= end; coordinate += 1) {
    const isGap = coordinate < end && scores[coordinate] >= 0.7;
    if (isGap) {
      if (currentStart === null) currentStart = coordinate;
      gapBreak = 0;
      continue;
    }
    if (currentStart === null) continue;

    if (coordinate < end && gapBreak < mergeTolerance) {
      gapBreak += 1;
      continue;
    }

    const gapEnd = coordinate - gapBreak;
    if (gapEnd - currentStart >= minimumGapWidth) gaps.push({ start: currentStart, end: gapEnd });
    currentStart = null;
    gapBreak = 0;
  }

  return gaps;
}

export function findStoryboardContentBounds(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
): { x: number; y: number; width: number; height: number } {
  const columnContent = Array.from({ length: width }, () => 0);
  const rowContent = Array.from({ length: height }, () => 0);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const alpha = pixels[offset + 3];
      const isWhite = pixels[offset] > 245 && pixels[offset + 1] > 245 && pixels[offset + 2] > 245;
      if (alpha >= 16 && !isWhite) {
        columnContent[x] += 1;
        rowContent[y] += 1;
      }
    }
  }

  const minimumColumnContent = Math.max(2, Math.round(height * 0.02));
  const minimumRowContent = Math.max(2, Math.round(width * 0.02));
  const firstX = columnContent.findIndex((count) => count >= minimumColumnContent);
  const firstY = rowContent.findIndex((count) => count >= minimumRowContent);
  const lastX = columnContent.findLastIndex((count) => count >= minimumColumnContent);
  const lastY = rowContent.findLastIndex((count) => count >= minimumRowContent);
  if (firstX < 0 || firstY < 0 || lastX <= firstX || lastY <= firstY) {
    return { x: 0, y: 0, width, height };
  }

  return {
    x: firstX,
    y: firstY,
    width: lastX - firstX + 1,
    height: lastY - firstY + 1,
  };
}

export function storyboardEdgeStats(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  side: StoryboardFrameSide,
  offset: number,
  bounds: { x: number; y: number; width: number; height: number },
): StoryboardEdgeStats {
  const horizontal = side === "top" || side === "bottom";
  const length = horizontal ? bounds.width : bounds.height;
  const sampleStep = Math.max(1, Math.floor(length / 96));
  let count = 0;
  let sum = 0;
  let sumSquares = 0;
  let saturation = 0;
  for (let position = 0; position < length; position += sampleStep) {
    const x = side === "left"
      ? bounds.x + offset
      : side === "right"
        ? bounds.x + bounds.width - 1 - offset
        : bounds.x + position;
    const y = side === "top"
      ? bounds.y + offset
      : side === "bottom"
        ? bounds.y + bounds.height - 1 - offset
        : bounds.y + position;
    const pixelOffset = (y * width + x) * 4;
    const red = pixels[pixelOffset];
    const green = pixels[pixelOffset + 1];
    const blue = pixels[pixelOffset + 2];
    const brightness = (red + green + blue) / 3;
    sum += brightness;
    sumSquares += brightness * brightness;
    saturation += Math.max(red, green, blue) - Math.min(red, green, blue);
    count += 1;
  }
  const mean = count > 0 ? sum / count : 0;
  return {
    mean,
    stdev: count > 0 ? Math.sqrt(Math.max(0, sumSquares / count - mean * mean)) : 0,
    saturation: count > 0 ? saturation / count : 0,
  };
}

export function trimStoryboardFrameBounds(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  bounds: { x: number; y: number; width: number; height: number },
): { x: number; y: number; width: number; height: number } {
  // Generated contact sheets often carry a subtle 1–10px neutral frame. Keep
  // the trim conservative, but allow enough room for a light gray export edge.
  const maxTrim = Math.min(16, Math.max(2, Math.floor(Math.min(bounds.width, bounds.height) * 0.02)));
  const frameRun = (side: StoryboardFrameSide): number => {
    const length = side === "left" || side === "right" ? bounds.width : bounds.height;
    const limit = Math.min(maxTrim, Math.max(0, length - 2));
    let run = 0;
    for (let offset = 0; offset < limit; offset += 1) {
      const stats = storyboardEdgeStats(pixels, width, height, side, offset, bounds);
      const isNeutralUniformLine = stats.stdev <= 12
        && stats.saturation <= 18
        && (stats.mean >= 190 || stats.mean <= 55);
      if (!isNeutralUniformLine) break;
      run += 1;
    }
    if (run === 0 || run >= length - 1) return 0;
    const edge = storyboardEdgeStats(pixels, width, height, side, run - 1, bounds);
    const content = storyboardEdgeStats(pixels, width, height, side, run, bounds);
    return Math.abs(edge.mean - content.mean) >= 18 ? run : 0;
  };

  const left = frameRun("left");
  const right = frameRun("right");
  const top = frameRun("top");
  const bottom = frameRun("bottom");
  return {
    x: bounds.x + left,
    y: bounds.y + top,
    width: Math.max(1, bounds.width - left - right),
    height: Math.max(1, bounds.height - top - bottom),
  };
}

export function zoomStoryboardFrameBounds(
  bounds: { x: number; y: number; width: number; height: number },
): { x: number; y: number; width: number; height: number } {
  // A small centered zoom hides export frames that survive detection.
  // Keep it around 2% per side so the scene composition remains intact.
  const insetX = Math.min(
    Math.floor(Math.max(0, bounds.width - 1) / 2),
    Math.min(16, Math.max(2, Math.round(bounds.width * 0.02))),
  );
  const insetY = Math.min(
    Math.floor(Math.max(0, bounds.height - 1) / 2),
    Math.min(16, Math.max(2, Math.round(bounds.height * 0.02))),
  );
  return {
    x: bounds.x + insetX,
    y: bounds.y + insetY,
    width: Math.max(1, bounds.width - insetX * 2),
    height: Math.max(1, bounds.height - insetY * 2),
  };
}

export function findStoryboardGaps(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  axis: "x" | "y",
): AxisGap[] {
  const length = axis === "x" ? width : height;
  const otherLength = axis === "x" ? height : width;
  const sampleStep = Math.max(1, Math.floor(otherLength / 64));
  const scores = Array.from({ length }, (_, coordinate) => {
    let lightPixels = 0;
    let samples = 0;
    for (let other = 0; other < otherLength; other += sampleStep) {
      const x = axis === "x" ? coordinate : other;
      const y = axis === "x" ? other : coordinate;
      const offset = (y * width + x) * 4;
      const alpha = pixels[offset + 3];
      const isEmpty = alpha < 16;
      const isWhite = pixels[offset] > 245 && pixels[offset + 1] > 245 && pixels[offset + 2] > 245;
      if (isEmpty || isWhite) lightPixels += 1;
      samples += 1;
    }
    return samples > 0 ? lightPixels / samples : 0;
  });

  // Gutter widths vary by exporter. Allow a small number of non-white pixels
  // inside a separator so a 3x2 sheet is not split through the middle row.
  const minimumGapWidth = Math.max(2, Math.round(length * 0.004));
  const gaps = findLightRuns(scores, minimumGapWidth);

  const edgePadding = Math.max(4, Math.round(length * 0.03));
  return gaps.filter((gap) => gap.start > edgePadding && gap.end < length - edgePadding);
}

export function findStoryboardGridGaps(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  axis: "x" | "y",
  parts: number,
): AxisGap[] {
  const length = axis === "x" ? width : height;
  const otherLength = axis === "x" ? height : width;
  const sampleStep = Math.max(1, Math.floor(otherLength / 64));
  const scores = Array.from({ length }, (_, coordinate) => {
    let lightPixels = 0;
    let samples = 0;
    for (let other = 0; other < otherLength; other += sampleStep) {
      const x = axis === "x" ? coordinate : other;
      const y = axis === "x" ? other : coordinate;
      const offset = (y * width + x) * 4;
      const alpha = pixels[offset + 3];
      const isWhite = pixels[offset] > 245 && pixels[offset + 1] > 245 && pixels[offset + 2] > 245;
      if (alpha < 16 || isWhite) lightPixels += 1;
      samples += 1;
    }
    return samples > 0 ? lightPixels / samples : 0;
  });

  const minimumGapWidth = Math.max(2, Math.round(length * 0.003));
  const searchRadius = Math.max(12, Math.round(length * 0.12));
  const gaps: AxisGap[] = [];
  for (let part = 1; part < parts; part += 1) {
    const expected = Math.round((length * part) / parts);
    const searchStart = Math.max(1, expected - searchRadius);
    const searchEnd = Math.min(length - 1, expected + searchRadius);
    const candidates = findLightRuns(scores, minimumGapWidth, searchStart, searchEnd + 1);
    const bestGap = candidates.reduce<AxisGap | null>(
      (best, candidate) => (!best || candidate.end - candidate.start > best.end - best.start ? candidate : best),
      null,
    );
    if (bestGap) gaps.push(bestGap);
  }
  return gaps;
}

export function findStoryboardGridPeaks(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  axis: "x" | "y",
  parts: number,
): AxisGap[] {
  const length = axis === "x" ? width : height;
  const otherLength = axis === "x" ? height : width;
  const sampleStep = Math.max(1, Math.floor(otherLength / 64));
  const scores = Array.from({ length }, (_, coordinate) => {
    let lightPixels = 0;
    let samples = 0;
    for (let other = 0; other < otherLength; other += sampleStep) {
      const x = axis === "x" ? coordinate : other;
      const y = axis === "x" ? other : coordinate;
      const offset = (y * width + x) * 4;
      const alpha = pixels[offset + 3];
      const isWhite = pixels[offset] > 245 && pixels[offset + 1] > 245 && pixels[offset + 2] > 245;
      if (alpha < 16 || isWhite) lightPixels += 1;
      samples += 1;
    }
    return samples > 0 ? lightPixels / samples : 0;
  });
  const searchRadius = Math.max(12, Math.round(length * 0.12));
  const minimumSeparatorScore = 0.72;
  const gaps: AxisGap[] = [];
  for (let part = 1; part < parts; part += 1) {
    const expected = Math.round((length * part) / parts);
    const searchStart = Math.max(1, expected - searchRadius);
    const searchEnd = Math.min(length - 1, expected + searchRadius);
    let bestIndex = -1;
    let bestScore = 0;
    for (let coordinate = searchStart; coordinate <= searchEnd; coordinate += 1) {
      if (scores[coordinate] > bestScore) {
        bestIndex = coordinate;
        bestScore = scores[coordinate];
      }
    }
    if (bestIndex >= 0 && bestScore >= minimumSeparatorScore) {
      gaps.push({ start: bestIndex, end: bestIndex + 1 });
    }
  }
  return gaps;
}

export function axisCells(length: number, gaps: AxisGap[]): Array<{ start: number; end: number }> {
  if (gaps.length === 0) return [{ start: 0, end: length }];
  const cells: Array<{ start: number; end: number }> = [];
  let start = 0;
  for (const gap of gaps) {
    if (gap.start > start) cells.push({ start, end: gap.start });
    start = gap.end;
  }
  if (start < length) cells.push({ start, end: length });
  return cells;
}

export function evenlyDividedCells(length: number, count: number): Array<{ start: number; end: number }> {
  return Array.from({ length: count }, (_, index) => ({
    start: Math.round((length * index) / count),
    end: Math.round((length * (index + 1)) / count),
  }));
}

export async function splitStoryboardSheet(file: File, maxScenes = HARD_MAX_STORYBOARD_SCENES): Promise<{
  slices: Array<{ file: File; previewUrl: string }>;
  rows: number;
  columns: number;
  minSceneWidth: number;
  minSceneHeight: number;
}> {
  const sourceUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new window.Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("Unable to read storyboard image"));
      element.src = sourceUrl;
    });
    const sourceCanvas = document.createElement("canvas");
    sourceCanvas.width = image.naturalWidth;
    sourceCanvas.height = image.naturalHeight;
    const sourceContext = sourceCanvas.getContext("2d", { willReadFrequently: true });
    if (!sourceContext) throw new Error("Storyboard splitting is not supported in this browser");
    sourceContext.drawImage(image, 0, 0);
    const sourcePixels = sourceContext.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height).data;
    const contentBounds = findStoryboardContentBounds(sourcePixels, sourceCanvas.width, sourceCanvas.height);
    const canvas = document.createElement("canvas");
    canvas.width = contentBounds.width;
    canvas.height = contentBounds.height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Storyboard splitting is not supported in this browser");
    context.drawImage(
      image,
      contentBounds.x,
      contentBounds.y,
      contentBounds.width,
      contentBounds.height,
      0,
      0,
      contentBounds.width,
      contentBounds.height,
    );
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let detectedColumns = axisCells(canvas.width, findStoryboardGaps(pixels, canvas.width, canvas.height, "x"));
    let detectedRows = axisCells(canvas.height, findStoryboardGaps(pixels, canvas.width, canvas.height, "y"));
    let columns = detectedColumns.length;
    let rows = detectedRows.length;
    let cellCount = columns * rows;
    // Most storyboard contact sheets are landscape 3x3 sheets. Some WebP
    // encoders leave a faint or uneven second gutter, so use an even 3x3
    // split when the detected grid is not usable instead of sending the full
    // contact sheet as a single scene.
    if ((cellCount < 2 || cellCount > maxScenes) && canvas.width / canvas.height >= 1.4 && canvas.width / canvas.height <= 2.2) {
      detectedColumns = evenlyDividedCells(canvas.width, 3);
      detectedRows = evenlyDividedCells(canvas.height, 3);
      columns = 3;
      rows = 3;
      cellCount = 9;
    }
    // Portrait contact sheets can have a very subtle horizontal gutter. When
    // the vertical separators clearly identify the columns, infer the row
    // count from the sheet geometry and split evenly instead of treating the
    // whole portrait sheet as one scene.
    if (rows === 1 && columns >= 2 && columns <= 6 && canvas.width / canvas.height < 1) {
      const inferredRows = Math.round((canvas.height * columns) / canvas.width);
      const inferredCellAspectRatio = (canvas.width / columns) / (canvas.height / Math.max(1, inferredRows));
      if (
        inferredRows >= 2
        && inferredRows <= 6
        && columns * inferredRows <= maxScenes
        && inferredCellAspectRatio >= 0.55
        && inferredCellAspectRatio <= 1.8
      ) {
        const gridGapsY = findStoryboardGridGaps(pixels, canvas.width, canvas.height, "y", inferredRows);
        detectedRows = gridGapsY.length === inferredRows - 1
          ? axisCells(canvas.height, gridGapsY)
          : evenlyDividedCells(canvas.height, inferredRows);
        rows = inferredRows;
        cellCount = columns * rows;
      }
    }
    // Once both axes are detected, re-check each expected grid boundary. This
    // prevents bright artwork or a partially visible separator inside a panel
    // from shifting the split. It also handles 3x2 sheets, not only 3x3.
    if (columns >= 2 && rows >= 2 && columns <= 6 && rows <= 6) {
      const gridGapsX = findStoryboardGridGaps(pixels, canvas.width, canvas.height, "x", columns);
      const gridGapsY = findStoryboardGridGaps(pixels, canvas.width, canvas.height, "y", rows);
      if (gridGapsX.length === columns - 1) detectedColumns = axisCells(canvas.width, gridGapsX);
      if (gridGapsY.length === rows - 1) detectedRows = axisCells(canvas.height, gridGapsY);
    }
    // Some generated 3x3 sheets use one-pixel white gutters. They are too
    // narrow for the regular run detector, so recover them from bright peaks
    // at the expected thirds only when both axes clearly contain separators.
    if (cellCount === 1 && canvas.width / canvas.height >= 1.4 && canvas.width / canvas.height <= 2.6) {
      const gridPeaksX = findStoryboardGridPeaks(pixels, canvas.width, canvas.height, "x", 3);
      const gridPeaksY = findStoryboardGridPeaks(pixels, canvas.width, canvas.height, "y", 3);
      if (gridPeaksX.length === 2 && gridPeaksY.length === 2) {
        detectedColumns = axisCells(canvas.width, gridPeaksX);
        detectedRows = axisCells(canvas.height, gridPeaksY);
        columns = 3;
        rows = 3;
        cellCount = 9;
      }
    }
    // A single full-frame image is also a valid one-scene storyboard. Keep
    // the same crop/zoom pipeline while allowing a one-panel test or upload.
    if (cellCount === 1) {
      detectedColumns = [{ start: 0, end: canvas.width }];
      detectedRows = [{ start: 0, end: canvas.height }];
      columns = 1;
      rows = 1;
    }
    if (cellCount < 1 || cellCount > maxScenes) {
      throw new Error(`ไม่พบตาราง storyboard ที่รองรับ (ระบบรองรับสูงสุด ${maxScenes} ฉาก)`);
    }

    const slices: Array<{ file: File; previewUrl: string }> = [];
    let minSceneWidth = Number.POSITIVE_INFINITY;
    let minSceneHeight = Number.POSITIVE_INFINITY;
    for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
      for (let columnIndex = 0; columnIndex < columns; columnIndex += 1) {
        const rawCell = document.createElement("canvas");
        const x = detectedColumns[columnIndex];
        const y = detectedRows[rowIndex];
        const cellWidth = Math.max(1, x.end - x.start);
        const cellHeight = Math.max(1, y.end - y.start);
        rawCell.width = cellWidth;
        rawCell.height = cellHeight;
        const rawCellContext = rawCell.getContext("2d", { willReadFrequently: true });
        if (!rawCellContext) throw new Error("Unable to prepare storyboard scene");
        rawCellContext.drawImage(canvas, x.start, y.start, cellWidth, cellHeight, 0, 0, cellWidth, cellHeight);
        const cellPixels = rawCellContext.getImageData(0, 0, cellWidth, cellHeight).data;
        const trimmedCellBounds = trimStoryboardFrameBounds(
          cellPixels,
          cellWidth,
          cellHeight,
          findStoryboardContentBounds(cellPixels, cellWidth, cellHeight),
        );
        const cellBounds = zoomStoryboardFrameBounds(trimmedCellBounds);
        const cell = document.createElement("canvas");
        cell.width = cellBounds.width;
        cell.height = cellBounds.height;
        minSceneWidth = Math.min(minSceneWidth, cellBounds.width);
        minSceneHeight = Math.min(minSceneHeight, cellBounds.height);
        const cellContext = cell.getContext("2d");
        if (!cellContext) throw new Error("Unable to prepare storyboard scene");
        cellContext.drawImage(
          rawCell,
          cellBounds.x,
          cellBounds.y,
          cellBounds.width,
          cellBounds.height,
          0,
          0,
          cellBounds.width,
          cellBounds.height,
        );
        // Keep every extracted panel lossless. Re-encoding a JPEG/WebP crop as
        // another lossy image makes small text and fine edges softer before the
        // video provider even receives the scene.
        const blob = await new Promise<Blob | null>((resolve) => {
          cell.toBlob(resolve, "image/png");
        });
        if (!blob) throw new Error("Unable to prepare storyboard scene");
        const sceneFile = new File([blob], `storyboard-scene-${slices.length + 1}.png`, { type: "image/png" });
        slices.push({ file: sceneFile, previewUrl: URL.createObjectURL(sceneFile) });
      }
    }
    return { slices, rows, columns, minSceneWidth, minSceneHeight };
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}
