import type { Viewport } from "./camera.ts";
import { clampZoom } from "./camera.ts";
import { HALF } from "./geometry.ts";
import type { Rect, Size } from "./geometry.ts";
import type { CoordinateExtent, Padding, PaddingValue, SnapGrid, XYPosition } from "./types.ts";

export const DEFAULT_FIT_PADDING = 0.1;
const PERCENT = 0.01;
const UNIT = /(?:px|%)$/u;

// One padding in pixels. A number is the share of extra room around the bounds, so `0.1` leaves
// room for a tenth of the bounds on each side; whole pixels, as in React Flow. An invalid value is 0.
function paddingInPixels(padding: PaddingValue, span: number): number {
  if (typeof padding === "number") {
    return Math.floor((span - span / (1 + padding)) * HALF);
  }
  const amount = Number(padding.replace(UNIT, ""));
  if (Number.isNaN(amount)) {
    return 0;
  }
  if (padding.endsWith("px")) {
    return Math.floor(amount);
  }
  return padding.endsWith("%") ? Math.floor(span * amount * PERCENT) : 0;
}

interface Paddings {
  top: number;
  right: number;
  bottom: number;
  left: number;
  x: number;
  y: number;
}

function paddingsOf(padding: Padding, size: Size): Paddings {
  if (typeof padding === "object") {
    const top = paddingInPixels(padding.top ?? padding.y ?? 0, size.height);
    const bottom = paddingInPixels(padding.bottom ?? padding.y ?? 0, size.height);
    const left = paddingInPixels(padding.left ?? padding.x ?? 0, size.width);
    const right = paddingInPixels(padding.right ?? padding.x ?? 0, size.width);
    return { top, right, bottom, left, x: left + right, y: top + bottom };
  }
  const vertical = paddingInPixels(padding, size.height);
  const horizontal = paddingInPixels(padding, size.width);
  return {
    top: vertical,
    right: horizontal,
    bottom: vertical,
    left: horizontal,
    x: horizontal * 2,
    y: vertical * 2,
  };
}

// The room that is really left on each side once `bounds` is drawn with `viewport`, in whole pixels.
function appliedPaddings(bounds: Rect, viewport: Viewport, size: Size): Omit<Paddings, "x" | "y"> {
  const { x, y, zoom } = viewport;
  return {
    left: Math.floor(bounds.x * zoom + x),
    top: Math.floor(bounds.y * zoom + y),
    right: Math.floor(size.width - ((bounds.x + bounds.width) * zoom + x)),
    bottom: Math.floor(size.height - ((bounds.y + bounds.height) * zoom + y)),
  };
}

/**
 * The viewport that frames `bounds` centred in a canvas of `width` x `height`, with the same
 * padding rules as React Flow: `padding` is a share of extra room (`0.1`), pixels (`"20px"`), a
 * percentage of the canvas (`"5%"`) or one of those per side. The zoom is clamped into
 * `[minZoom, maxZoom]`, so tiny bounds are not blown up beyond `maxZoom`; where the centred view
 * leaves less room on a side than asked for (uneven paddings), the view is moved to keep it.
 */
// oxlint-disable-next-line eslint/max-params -- keeps React Flow's positional signature
export function getViewportForBounds(
  bounds: Rect,
  width: number,
  height: number,
  minZoom: number,
  maxZoom: number,
  padding: Padding = DEFAULT_FIT_PADDING,
): Viewport {
  const size = { width, height };
  const wanted = paddingsOf(padding, size);
  const fitting = Math.min((width - wanted.x) / bounds.width, (height - wanted.y) / bounds.height);
  // Bounds with no size on an axis whose room the padding uses up give 0 / 0: there is nothing to
  // fit, so the zoom is the largest (React Flow ends up with NaN there).
  const zoom = clampZoom(Number.isNaN(fitting) ? maxZoom : fitting, minZoom, maxZoom);
  const centred = {
    x: width * HALF - (bounds.x + bounds.width * HALF) * zoom,
    y: height * HALF - (bounds.y + bounds.height * HALF) * zoom,
    zoom,
  };
  const applied = appliedPaddings(bounds, centred, size);
  return {
    x:
      centred.x -
      Math.min(applied.left - wanted.left, 0) +
      Math.min(applied.right - wanted.right, 0),
    y:
      centred.y -
      Math.min(applied.top - wanted.top, 0) +
      Math.min(applied.bottom - wanted.bottom, 0),
    zoom,
  };
}

interface AxisBounds {
  /** Canvas length along the axis, in screen pixels. */
  span: number;
  zoom: number;
  min: number;
  max: number;
}

// Moves one axis of the translation so that the visible span stays inside [min, max]. A span that
// is larger than the extent is centred on it instead.
function clampAxis(offset: number, axis: AxisBounds): number {
  const { span, zoom, min, max } = axis;
  const visibleMin = -offset / zoom;
  const visibleMax = (span - offset) / zoom;
  if (visibleMax - visibleMin >= max - min) {
    return span * HALF - (min + max) * HALF * zoom;
  }
  if (visibleMin < min) {
    // Subtracting from 0 instead of negating avoids returning -0 for a zero minimum.
    return 0 - min * zoom;
  }
  if (visibleMax > max) {
    return span - max * zoom;
  }
  return offset;
}

/** Keeps the visible part of the flow plane inside `translateExtent`. */
export function clampViewport(
  viewport: Viewport,
  size: Size,
  translateExtent: CoordinateExtent,
): Viewport {
  const [[minX, minY], [maxX, maxY]] = translateExtent;
  return {
    x: clampAxis(viewport.x, { span: size.width, zoom: viewport.zoom, min: minX, max: maxX }),
    y: clampAxis(viewport.y, { span: size.height, zoom: viewport.zoom, min: minY, max: maxY }),
    zoom: viewport.zoom,
  };
}

/** Rounds a position to the nearest grid line. */
export function snapToGrid(position: XYPosition, grid: SnapGrid): XYPosition {
  const [gridX, gridY] = grid;
  return {
    x: gridX > 0 ? gridX * Math.round(position.x / gridX) : position.x,
    y: gridY > 0 ? gridY * Math.round(position.y / gridY) : position.y,
  };
}
