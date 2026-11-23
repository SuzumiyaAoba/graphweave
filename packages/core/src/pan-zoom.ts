import type { Viewport } from "./camera.ts";
import { clampZoom, screenToFlow, zoomAt } from "./camera.ts";
import type { Point } from "./geometry.ts";
import { PanOnScrollMode } from "./types.ts";

// `deltaMode` of a wheel event: pixels, lines or pages.
const DELTA_MODE_LINE = 1;
const DELTA_MODE_PAGE = 2;
const WHEEL_PIXEL_STEP = 0.002;
const WHEEL_LINE_STEP = 0.05;
const WHEEL_PAGE_STEP = 1;
// On macOS a trackpad pinch arrives as a wheel event with `ctrlKey` set and needs a stronger
// response (React Flow does the same, and only there).
export const PINCH_BOOST = 10;
// One scroll line is about this many pixels when panning on scroll.
const LINE_HEIGHT = 20;

export interface WheelInput {
  deltaX: number;
  deltaY: number;
  deltaMode: number;
  ctrlKey: boolean;
  shiftKey: boolean;
  /** Where the pointer is, relative to the canvas. */
  point: Point;
}

export interface WheelOptions {
  zoomOnScroll: boolean;
  zoomOnPinch: boolean;
  panOnScroll: boolean;
  panOnScrollSpeed: number;
  panOnScrollMode: PanOnScrollMode;
  /** True while the key set as `zoomActivationKeyCode` is held; the wheel then always zooms. */
  zoomActivationKeyPressed: boolean;
  /** Whether this is macOS, which treats a pinch and a shift-scroll differently; off by default. */
  macOs?: boolean | undefined;
  minZoom: number;
  maxZoom: number;
}

export type WheelAction = "zoom" | "pan" | "none";

/** What a wheel event should do given the pan/zoom options. */
export function wheelAction(input: WheelInput, options: WheelOptions): WheelAction {
  if (options.zoomActivationKeyPressed) {
    return "zoom";
  }
  // A trackpad pinch arrives as a wheel event with `ctrlKey` set.
  if (options.panOnScroll) {
    return input.ctrlKey && options.zoomOnPinch ? "zoom" : "pan";
  }
  const allowed = input.ctrlKey ? options.zoomOnPinch : options.zoomOnScroll;
  return allowed ? "zoom" : "none";
}

/** How much of a wheel delta counts toward zooming, by the unit it comes in: pixels, lines or pages. */
export function wheelZoomStep(deltaMode: number): number {
  if (deltaMode === DELTA_MODE_LINE) {
    return WHEEL_LINE_STEP;
  }
  return deltaMode === DELTA_MODE_PAGE ? WHEEL_PAGE_STEP : WHEEL_PIXEL_STEP;
}

function zoomedByWheel(viewport: Viewport, input: WheelInput, options: WheelOptions): Viewport {
  const boost = input.ctrlKey && options.macOs === true ? PINCH_BOOST : 1;
  const exponent = -input.deltaY * wheelZoomStep(input.deltaMode) * boost;
  const zoom = clampZoom(viewport.zoom * 2 ** exponent, options.minZoom, options.maxZoom);
  return zoomAt(viewport, input.point, zoom);
}

function pannedByWheel(viewport: Viewport, input: WheelInput, options: WheelOptions): Viewport {
  const normalize = input.deltaMode === DELTA_MODE_LINE ? LINE_HEIGHT : 1;
  const mode = options.panOnScrollMode;
  // Shift turns vertical scrolling into horizontal; macOS already does that before the event is sent.
  const swapAxes = options.macOs !== true && input.shiftKey && mode !== PanOnScrollMode.Vertical;
  const rawX = swapAxes ? input.deltaY : input.deltaX;
  const rawY = swapAxes ? 0 : input.deltaY;
  const deltaX = mode === PanOnScrollMode.Vertical ? 0 : rawX * normalize;
  const deltaY = mode === PanOnScrollMode.Horizontal ? 0 : rawY * normalize;
  return {
    x: viewport.x - deltaX * options.panOnScrollSpeed,
    y: viewport.y - deltaY * options.panOnScrollSpeed,
    zoom: viewport.zoom,
  };
}

/** The viewport after a wheel event, or `undefined` when the event does not move it. */
export function applyWheel(
  viewport: Viewport,
  input: WheelInput,
  options: WheelOptions,
): Viewport | undefined {
  const action = wheelAction(input, options);
  if (action === "none") {
    return undefined;
  }
  return action === "zoom"
    ? zoomedByWheel(viewport, input, options)
    : pannedByWheel(viewport, input, options);
}

export interface PanSession {
  /** The viewport for the pointer at `point`. */
  move: (point: Point) => Viewport;
}

/** Starts a drag that moves the viewport by the distance the pointer travels from `origin`. */
export function startPan(viewport: Viewport, origin: Point): PanSession {
  return {
    move: (point) => ({
      x: viewport.x + point.x - origin.x,
      y: viewport.y + point.y - origin.y,
      zoom: viewport.zoom,
    }),
  };
}

function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export interface PinchSession {
  /** The viewport for the pointers at their current positions. */
  move: (pointers: readonly [Point, Point]) => Viewport;
}

export interface ZoomLimits {
  minZoom: number;
  maxZoom: number;
}

/**
 * Starts a two-pointer gesture: the zoom follows the distance between the pointers, the pan their
 * centre, and the flow point that was under the centre stays under it.
 */
export function startPinch(
  viewport: Viewport,
  pointers: readonly [Point, Point],
  limits: ZoomLimits,
): PinchSession {
  const startDistance = distance(pointers[0], pointers[1]);
  const flowCenter = screenToFlow(viewport, midpoint(pointers[0], pointers[1]));
  return {
    move: (now) => {
      const ratio = startDistance > 0 ? distance(now[0], now[1]) / startDistance : 1;
      const zoom = clampZoom(viewport.zoom * ratio, limits.minZoom, limits.maxZoom);
      const center = midpoint(now[0], now[1]);
      return { x: center.x - flowCenter.x * zoom, y: center.y - flowCenter.y * zoom, zoom };
    },
  };
}
