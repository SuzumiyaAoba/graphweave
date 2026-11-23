import type { Point, Rect, Size } from "./geometry.ts";

/**
 * Camera over the flow plane. `x` and `y` are the screen-space translation (CSS pixels) of the flow
 * origin, so `screen = flow * zoom + (x, y)`. `zoom` must be a finite number greater than zero; the
 * functions below throw a `RangeError` otherwise instead of returning rectangles with negative or
 * infinite extents.
 */
export interface Viewport {
  readonly x: number;
  readonly y: number;
  readonly zoom: number;
}

function assertZoom(zoom: number): void {
  if (!Number.isFinite(zoom) || zoom <= 0) {
    throw new RangeError(`Zoom must be a finite number greater than zero, got ${String(zoom)}`);
  }
}

/** Converts a screen-space point (relative to the canvas) to flow coordinates. */
export function screenToFlow(viewport: Viewport, point: Point): Point {
  assertZoom(viewport.zoom);
  return { x: (point.x - viewport.x) / viewport.zoom, y: (point.y - viewport.y) / viewport.zoom };
}

/** Converts a flow-space point to screen coordinates (relative to the canvas). */
export function flowToScreen(viewport: Viewport, point: Point): Point {
  assertZoom(viewport.zoom);
  return { x: point.x * viewport.zoom + viewport.x, y: point.y * viewport.zoom + viewport.y };
}

/** The part of the flow plane that is visible on a canvas of the given size. */
export function visibleRect(viewport: Viewport, size: Size): Rect {
  assertZoom(viewport.zoom);
  return {
    x: -viewport.x / viewport.zoom,
    y: -viewport.y / viewport.zoom,
    width: size.width / viewport.zoom,
    height: size.height / viewport.zoom,
  };
}

/**
 * Changes the zoom while keeping the flow point under `anchor` (a screen-space point, typically the
 * cursor) fixed on screen.
 */
export function zoomAt(viewport: Viewport, anchor: Point, zoom: number): Viewport {
  assertZoom(zoom);
  const flow = screenToFlow(viewport, anchor);
  return { x: anchor.x - flow.x * zoom, y: anchor.y - flow.y * zoom, zoom };
}

/**
 * Clamps a zoom level into `[min, max]`.
 *
 * @throws {RangeError} When an argument is `NaN` or `min` exceeds `max`.
 */
export function clampZoom(zoom: number, min: number, max: number): number {
  if (Number.isNaN(zoom) || Number.isNaN(min) || Number.isNaN(max) || min > max) {
    throw new RangeError(`Cannot clamp ${String(zoom)} into [${String(min)}, ${String(max)}]`);
  }
  return Math.min(max, Math.max(min, zoom));
}
