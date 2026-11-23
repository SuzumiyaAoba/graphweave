/** One half: the middle of a span. */
export const HALF = 0.5;

/** Point in graph (flow) or screen coordinates. */
export interface Point {
  readonly x: number;
  readonly y: number;
}

/** Extent of a rectangular area, e.g. the canvas in CSS pixels. */
export interface Size {
  readonly width: number;
  readonly height: number;
}

/** Axis-aligned rectangle in graph (flow) coordinates. */
export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Returns `true` when the rectangles overlap. Rectangles that merely touch along an edge do not overlap. */
export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

/** The area where two rectangles overlap; `0` when they do not (touching along an edge counts as not). */
export function rectOverlapArea(a: Rect, b: Rect): number {
  const width = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const height = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return width > 0 && height > 0 ? width * height : 0;
}

/**
 * Returns `true` when the point lies inside the rectangle. The rectangle is half-open (`[x, x + width)`
 * on both axes), which keeps it consistent with {@link rectsIntersect}: neighbours that share an edge
 * never both contain a point.
 */
export function rectContainsPoint(rect: Rect, x: number, y: number): boolean {
  return x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height;
}

/**
 * Rounds a rectangle to `float32`, the precision the GPU and the typed-array columns store, and
 * validates the result. Every spatial structure compares rounded values so that implementations
 * agree exactly, even for rectangles that touch at a boundary. Edges (`x + width`) are then computed
 * in double precision from the rounded components, which a WASM port reproduces by widening to `f64`.
 *
 * Validation happens after rounding: a double that is finite but too large for `float32` becomes
 * `Infinity` and is rejected, rather than poisoning later arithmetic with `NaN`.
 *
 * @throws {RangeError} When a component is not a finite `float32` or the size is negative.
 */
export function normalizeRect(rect: Rect): Rect {
  const rounded = {
    x: Math.fround(rect.x),
    y: Math.fround(rect.y),
    width: Math.fround(rect.width),
    height: Math.fround(rect.height),
  };
  if (
    !Number.isFinite(rounded.x) ||
    !Number.isFinite(rounded.y) ||
    !Number.isFinite(rounded.width) ||
    !Number.isFinite(rounded.height)
  ) {
    throw new RangeError("Rect components must be finite float32 numbers");
  }
  if (rounded.width < 0 || rounded.height < 0) {
    throw new RangeError("Rect width and height must not be negative");
  }
  return rounded;
}

/**
 * Rounds a query point to `float32` like {@link normalizeRect} does for rectangles.
 *
 * @throws {RangeError} When a component is not a finite `float32`.
 */
export function normalizePoint(x: number, y: number): Point {
  const rounded = { x: Math.fround(x), y: Math.fround(y) };
  if (!Number.isFinite(rounded.x) || !Number.isFinite(rounded.y)) {
    throw new RangeError("Point components must be finite float32 numbers");
  }
  return rounded;
}

/**
 * Keeps `value` in `[min, max]`, the same as `Math.min(Math.max(value, min), max)`: when the range is
 * empty (`max < min`) the upper bound wins, which is how React Flow clamps.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
