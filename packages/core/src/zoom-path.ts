import type { Viewport } from "./camera.ts";
import { HALF } from "./geometry.ts";
import type { Point, Size } from "./geometry.ts";
import type { ViewportInterpolation } from "./types.ts";

// The way the viewport glides from one place to another is the one React Flow gets from d3-zoom:
// both ends are described by the point of the flow that is at the pivot (the middle of the canvas
// unless told otherwise) and how much of the flow the canvas width shows, and that triple is
// interpolated, either along van Wijk's smooth zoom path or linearly.

type Triple = readonly [number, number, number];

const RHO = Math.SQRT2;
const RHO_SQUARED = 2;
const RHO_TO_THE_FOURTH = 4;
const EPSILON_SQUARED = 1e-12;
function cosh(value: number): number {
  const exp = Math.exp(value);
  return (exp + 1 / exp) / 2;
}

function sinh(value: number): number {
  const exp = Math.exp(value);
  return (exp - 1 / exp) / 2;
}

function tanh(value: number): number {
  const exp = Math.exp(2 * value);
  return (exp - 1) / (exp + 1);
}

// A zoom that only slides or only scales, where the general formula would divide by nothing.
function straight(from: Triple, to: Triple): (progress: number) => Triple {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const rate = Math.log(to[2] / from[2]) / RHO;
  return (progress) => [
    from[0] + progress * dx,
    from[1] + progress * dy,
    from[2] * Math.exp(RHO * progress * rate),
  ];
}

// The two ends of the arc that van Wijk's formula runs along, and how long it is.
function arcOf(from: number, to: number, distanceSquared: number): { r0: number; length: number } {
  const distance = Math.sqrt(distanceSquared);
  const widths = to * to - from * from;
  const b0 = (widths + RHO_TO_THE_FOURTH * distanceSquared) / (2 * from * RHO_SQUARED * distance);
  const b1 = (widths - RHO_TO_THE_FOURTH * distanceSquared) / (2 * to * RHO_SQUARED * distance);
  const r0 = Math.log(Math.sqrt(b0 * b0 + 1) - b0);
  const r1 = Math.log(Math.sqrt(b1 * b1 + 1) - b1);
  return { r0, length: (r1 - r0) / RHO };
}

// The smooth zoom path of d3.interpolateZoom: van Wijk and Nuij, "Smooth and efficient zooming and
// panning".
function smooth(from: Triple, to: Triple): (progress: number) => Triple {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const distanceSquared = dx * dx + dy * dy;
  if (distanceSquared < EPSILON_SQUARED) {
    return straight(from, to);
  }
  const distance = Math.sqrt(distanceSquared);
  const { r0, length } = arcOf(from[2], to[2], distanceSquared);
  return (progress) => {
    const travelled = progress * length;
    const coshR0 = cosh(r0);
    const reach =
      (from[2] / (RHO_SQUARED * distance)) * (coshR0 * tanh(RHO * travelled + r0) - sinh(r0));
    return [
      from[0] + reach * dx,
      from[1] + reach * dy,
      (from[2] * coshR0) / cosh(RHO * travelled + r0),
    ];
  };
}

// The straight interpolation of d3.interpolate, on three numbers.
function linear(from: Triple, to: Triple): (progress: number) => Triple {
  return (progress) => [
    from[0] * (1 - progress) + to[0] * progress,
    from[1] * (1 - progress) + to[1] * progress,
    from[2] * (1 - progress) + to[2] * progress,
  ];
}

export interface ZoomPathOptions {
  interpolate?: ViewportInterpolation | undefined;
  /** The point of the canvas that stays where it is under the pointer; the middle by default. */
  pivot?: Point | undefined;
}

/**
 * The viewport at `progress` (0 to 1, already eased) on the way from `route.start` to `route.target`
 * on a canvas of the given size, as d3-zoom's transitions work it out.
 */
export function zoomPath(
  route: { start: Viewport; target: Viewport },
  canvas: Size,
  options: ZoomPathOptions = {},
): (progress: number) => Viewport {
  const { start, target } = route;
  if (start.x === target.x && start.y === target.y && start.zoom === target.zoom) {
    // A glide that goes nowhere stays where it is (also on a canvas that has no size yet).
    return () => target;
  }
  const pivot = options.pivot ?? { x: canvas.width * HALF, y: canvas.height * HALF };
  const width = Math.max(canvas.width, canvas.height);
  function triple(view: Viewport): Triple {
    return [(pivot.x - view.x) / view.zoom, (pivot.y - view.y) / view.zoom, width / view.zoom];
  }
  const along = (options.interpolate === "linear" ? linear : smooth)(
    triple(route.start),
    triple(route.target),
  );
  return (progress) => {
    if (progress === 1) {
      return route.target;
    }
    const [x, y, shown] = along(progress);
    const zoom = width / shown;
    return { x: pivot.x - x * zoom, y: pivot.y - y * zoom, zoom };
  };
}
