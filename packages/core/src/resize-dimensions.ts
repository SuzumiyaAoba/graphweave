// The size and position of a node after dragging one of its resize controls, worked out as React
// Flow works it out (`getDimensionsAfterResize`), step by step: every restriction (the smallest and
// largest size, the area the node may grow into, the box its children need, the aspect ratio) is
// turned into how much it holds the resize back, and the strongest one wins.

import { horizontalAspectClamp, verticalAspectClamp } from "./resize-aspect.ts";
import { lowerClamp, sizeClamp, upperClamp, xor } from "./resize-context.ts";
import type {
  Context,
  Extent,
  Pair,
  ResizeOptions,
  ResizeStart,
  ControlDirection,
} from "./resize-context.ts";

export type {
  Boundaries,
  ControlDirection,
  Extent,
  ResizeOptions,
  ResizeStart,
} from "./resize-context.ts";

interface Axis {
  affects: boolean;
  dist: number;
  /** The extent along the axis. */
  extent: readonly [number, number];
}

// How much the area the node may grow into holds back the resize along one axis.
function areaClamp(axis: Axis, edges: { lower: number; upper: number }): number {
  if (axis.affects && axis.dist < 0) {
    return lowerClamp(edges.lower, axis.extent[0]);
  }
  return !axis.affects && axis.dist > 0 ? upperClamp(edges.upper, axis.extent[1]) : 0;
}

// The same for the box the children need, which restricts the other way round.
function childClamp(axis: Axis, edges: { lower: number; upper: number }): number {
  if (axis.affects && axis.dist > 0) {
    return upperClamp(edges.upper, axis.extent[0]);
  }
  return !axis.affects && axis.dist < 0 ? lowerClamp(edges.lower, axis.extent[1]) : 0;
}

function axesOf(extent: Extent): { x: readonly [number, number]; y: readonly [number, number] } {
  return { x: [extent[0][0], extent[1][0]], y: [extent[0][1], extent[1][1]] };
}

// What the area the node may grow into holds back, along each axis.
function areaClamps(context: Context): Pair {
  const { start, direction, dist, size, originOffset, options } = context;
  if (options.extent === undefined) {
    return { x: 0, y: 0 };
  }
  const axes = axesOf(options.extent);
  return {
    x: areaClamp(
      { affects: direction.affectsX, dist: dist.x, extent: axes.x },
      { lower: start.x + dist.x + originOffset.x, upper: start.x + size.width + originOffset.x },
    ),
    y: areaClamp(
      { affects: direction.affectsY, dist: dist.y, extent: axes.y },
      { lower: start.y + dist.y + originOffset.y, upper: start.y + size.height + originOffset.y },
    ),
  };
}

// What the box the children need holds back, along each axis.
function boxClamps(context: Context): Pair {
  const { start, direction, dist, size, options } = context;
  if (options.childExtent === undefined) {
    return { x: 0, y: 0 };
  }
  const axes = axesOf(options.childExtent);
  return {
    x: childClamp(
      { affects: direction.affectsX, dist: dist.x, extent: axes.x },
      { lower: start.x + size.width, upper: start.x + dist.x },
    ),
    y: childClamp(
      { affects: direction.affectsY, dist: dist.y, extent: axes.y },
      { lower: start.y + size.height, upper: start.y + dist.y },
    ),
  };
}

function extentClamps(context: Context): Pair {
  const area = areaClamps(context);
  const box = boxClamps(context);
  return { x: Math.max(area.x, box.x), y: Math.max(area.y, box.y) };
}

// How much each axis has to give up in all, the strongest restriction first.
function clampsOf(context: Context): Pair {
  const { direction, size, options } = context;
  const { boundaries } = options;
  const clamps = extentClamps(context);
  let x = Math.max(sizeClamp(size.width, boundaries.minWidth, boundaries.maxWidth), clamps.x);
  let y = Math.max(sizeClamp(size.height, boundaries.minHeight, boundaries.maxHeight), clamps.y);
  if (options.keepAspectRatio) {
    x = direction.isHorizontal ? Math.max(x, horizontalAspectClamp(context)) : x;
    y = direction.isVertical ? Math.max(y, verticalAspectClamp(context)) : y;
  }
  return { x, y };
}

interface Moved {
  dist: Pair;
  affectsX: boolean;
  affectsY: boolean;
}

// With the aspect ratio kept, the other side follows the one that was dragged.
function keepRatio(context: Context, moved: Moved): Moved {
  const { aspectRatio, direction, size } = context;
  const { dist, affectsX, affectsY } = moved;
  if (direction.isHorizontal && direction.isVertical) {
    const sign = xor(affectsX, affectsY) ? -1 : 1;
    return size.width > size.height * aspectRatio
      ? { ...moved, dist: { x: dist.x, y: (sign * dist.x) / aspectRatio } }
      : { ...moved, dist: { x: sign * dist.y * aspectRatio, y: dist.y } };
  }
  return direction.isHorizontal
    ? { dist: { x: dist.x, y: dist.x / aspectRatio }, affectsX, affectsY: affectsX }
    : { dist: { x: dist.y * aspectRatio, y: dist.y }, affectsX: affectsY, affectsY };
}

/**
 * The node after the pointer has moved by `pointer` (flow units) since the resize began: its size,
 * and where its origin is. The pointer's distance is taken in whole units, as in React Flow.
 */
export function getDimensionsAfterResize(
  start: ResizeStart,
  request: { direction: ControlDirection; pointer: Pair },
  options: ResizeOptions,
): ResizeStart {
  const { direction, pointer } = request;
  const dist = {
    x: Math.floor(direction.isHorizontal ? pointer.x : 0),
    y: Math.floor(direction.isVertical ? pointer.y : 0),
  };
  const size = {
    width: start.width + (direction.affectsX ? -dist.x : dist.x),
    height: start.height + (direction.affectsY ? -dist.y : dist.y),
  };
  const context: Context = {
    start,
    aspectRatio: start.width / start.height,
    direction,
    dist,
    size,
    originOffset: {
      x: -options.nodeOrigin[0] * start.width,
      y: -options.nodeOrigin[1] * start.height,
    },
    options,
  };
  const clamps = clampsOf(context);
  const wanted: Moved = {
    dist: {
      x: dist.x + (dist.x < 0 ? clamps.x : -clamps.x),
      y: dist.y + (dist.y < 0 ? clamps.y : -clamps.y),
    },
    affectsX: direction.affectsX,
    affectsY: direction.affectsY,
  };
  const final = options.keepAspectRatio ? keepRatio(context, wanted) : wanted;
  const origin = options.nodeOrigin;
  return {
    width: start.width + (final.affectsX ? -final.dist.x : final.dist.x),
    height: start.height + (final.affectsY ? -final.dist.y : final.dist.y),
    x:
      origin[0] * final.dist.x * (final.affectsX ? -1 : 1) +
      (final.affectsX ? start.x + final.dist.x : start.x),
    y:
      origin[1] * final.dist.y * (final.affectsY ? -1 : 1) +
      (final.affectsY ? start.y + final.dist.y : start.y),
  };
}
