import { NO_SLOT, visibleRect } from "@graphweave/core";
import type { Rect, Size, Viewport } from "@graphweave/core";

import type { Scene } from "./scene.ts";

/** Everything needed to paint one frame. */
export interface Frame {
  readonly context: CanvasRenderingContext2D;
  readonly scene: Scene;
  readonly viewport: Viewport;
  /** Canvas size in CSS pixels. */
  readonly size: Size;
  readonly pixelRatio: number;
  readonly showGrid: boolean;
  readonly cellSize: number;
  readonly hoverSlot: number;
  readonly dragSlot: number;
}

/** What painting a frame cost; the query is timed apart from the drawing on purpose. */
export interface FrameStats {
  readonly visible: number;
  readonly queryMs: number;
  readonly drawMs: number;
}

const BACKGROUND_COLOR = "#14161a";
const GRID_COLOR = "rgba(255, 255, 255, 0.12)";
const NODE_BORDER_COLOR = "rgba(0, 0, 0, 0.45)";
const HOVER_COLOR = "#ffffff";
const DRAG_COLOR = "#ffd24a";
const FALLBACK_COLOR = "#888888";

// Weight of the newest frame in the moving average of the frame costs.
const SMOOTHING = 0.2;

// Nodes get a border only when they are big enough on screen for it to be visible.
const BORDER_MIN_ZOOM = 0.4;
// Grid lines closer together than this on screen are not drawn.
const MIN_GRID_SPACING_PX = 4;

const PALETTE_SIZE = 24;
const PALETTE_HUE_STEP = 15;
const PALETTE = Array.from(
  { length: PALETTE_SIZE },
  (_unused, i) => `hsl(${String(i * PALETTE_HUE_STEP)} 55% 62%)`,
);

/** Blends a new frame into the running average of the costs; the visible count is not averaged. */
export function smoothStats(previous: FrameStats, next: FrameStats): FrameStats {
  const keep = 1 - SMOOTHING;
  return {
    visible: next.visible,
    queryMs: previous.queryMs * keep + next.queryMs * SMOOTHING,
    drawMs: previous.drawMs * keep + next.drawMs * SMOOTHING,
  };
}

function clear(frame: Frame): void {
  const { context } = frame;
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.fillStyle = BACKGROUND_COLOR;
  context.fillRect(0, 0, context.canvas.width, context.canvas.height);
}

/** Maps flow coordinates to device pixels, so everything below is drawn in flow units. */
function applyCamera(frame: Frame): void {
  const { context, viewport, pixelRatio } = frame;
  const scale = pixelRatio * viewport.zoom;
  context.setTransform(scale, 0, 0, scale, pixelRatio * viewport.x, pixelRatio * viewport.y);
}

function drawNodes(frame: Frame, visible: Uint32Array): void {
  const { context, scene, viewport } = frame;
  // The store's columns are read directly, exactly like a GPU upload or a WASM view would.
  const { x, y, width, height } = scene.store.columns;
  const bordered = viewport.zoom >= BORDER_MIN_ZOOM;
  context.strokeStyle = NODE_BORDER_COLOR;
  context.lineWidth = 1 / viewport.zoom;
  for (const slot of visible) {
    context.fillStyle = PALETTE[slot % PALETTE_SIZE] ?? FALLBACK_COLOR;
    context.fillRect(x[slot] ?? 0, y[slot] ?? 0, width[slot] ?? 0, height[slot] ?? 0);
    if (bordered) {
      context.strokeRect(x[slot] ?? 0, y[slot] ?? 0, width[slot] ?? 0, height[slot] ?? 0);
    }
  }
}

/** Adds a line at every multiple of `cellSize` that falls inside `area` to the current path. */
function traceGridLines(context: CanvasRenderingContext2D, area: Rect, cellSize: number): void {
  const right = area.x + area.width;
  const bottom = area.y + area.height;
  for (let gx = Math.floor(area.x / cellSize) * cellSize; gx <= right; gx += cellSize) {
    context.moveTo(gx, area.y);
    context.lineTo(gx, bottom);
  }
  for (let gy = Math.floor(area.y / cellSize) * cellSize; gy <= bottom; gy += cellSize) {
    context.moveTo(area.x, gy);
    context.lineTo(right, gy);
  }
}

function drawGrid(frame: Frame): void {
  const { context, viewport, size, cellSize } = frame;
  if (cellSize * viewport.zoom < MIN_GRID_SPACING_PX) {
    // Zoomed so far out that thousands of lines would crowd into a few pixels: skip them.
    return;
  }
  context.strokeStyle = GRID_COLOR;
  context.lineWidth = 1 / viewport.zoom;
  context.beginPath();
  traceGridLines(context, visibleRect(viewport, size), cellSize);
  context.stroke();
}

function drawOutline(frame: Frame, slot: number, color: string): void {
  if (slot === NO_SLOT) {
    return;
  }
  const { context, scene, viewport } = frame;
  const rect = scene.store.rectOf(slot);
  context.strokeStyle = color;
  context.lineWidth = 2 / viewport.zoom;
  context.strokeRect(rect.x, rect.y, rect.width, rect.height);
}

function drawOutlines(frame: Frame): void {
  drawOutline(frame, frame.hoverSlot, HOVER_COLOR);
  drawOutline(frame, frame.dragSlot, DRAG_COLOR);
}

/** Queries the visible nodes from the index, paints them, and reports the two costs separately. */
export function drawFrame(frame: Frame): FrameStats {
  const queryStart = performance.now();
  const visible = frame.scene.index.queryRect(visibleRect(frame.viewport, frame.size));
  const drawStart = performance.now();
  clear(frame);
  applyCamera(frame);
  drawNodes(frame, visible);
  if (frame.showGrid) {
    drawGrid(frame);
  }
  drawOutlines(frame);
  return {
    visible: visible.length,
    queryMs: drawStart - queryStart,
    drawMs: performance.now() - drawStart,
  };
}
