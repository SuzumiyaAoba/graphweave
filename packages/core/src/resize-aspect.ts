// The restrictions that come from keeping the aspect ratio: how far the area the node may grow into,
// and the box its children need, hold back the side that follows the one being dragged.

import { lowerClamp, sizeClamp, upperClamp } from "./resize-context.ts";
import type { ControlDirection, Context } from "./resize-context.ts";

// Whether the aspect-ratio-bound growth of the other side goes the way of the area's far edge.
function growsTowardsFarEdge(direction: ControlDirection, axis: "x" | "y"): boolean {
  const { affectsX, affectsY, isHorizontal, isVertical } = direction;
  const isDiagonal = isHorizontal && isVertical;
  return axis === "x"
    ? (!affectsX && !affectsY) || (affectsX && !affectsY && isDiagonal)
    : (!affectsX && !affectsY) || (affectsY && !affectsX && isDiagonal);
}

// How far the area holds back a horizontal resize through the height that follows the width.
function horizontalAreaReach(context: Context, far: boolean, moved: number): number {
  const { start, aspectRatio, size, originOffset, options } = context;
  if (options.extent === undefined) {
    return 0;
  }
  if (far) {
    return upperClamp(start.y + originOffset.y + size.width / aspectRatio, options.extent[1][1]);
  }
  return lowerClamp(start.y + originOffset.y + moved, options.extent[0][1]);
}

function horizontalBoxReach(context: Context, far: boolean, moved: number): number {
  const { start, aspectRatio, size, options } = context;
  if (options.childExtent === undefined) {
    return 0;
  }
  if (far) {
    return lowerClamp(start.y + size.width / aspectRatio, options.childExtent[1][1]);
  }
  return upperClamp(start.y + moved, options.childExtent[0][1]);
}

// What keeping the aspect ratio makes the width have to give up, for a horizontal resize.
export function horizontalAspectClamp(context: Context): number {
  const { aspectRatio, direction, dist, size, options } = context;
  const far = growsTowardsFarEdge(direction, "x");
  const moved = (direction.affectsX ? dist.x : -dist.x) / aspectRatio;
  const own =
    sizeClamp(
      size.width / aspectRatio,
      options.boundaries.minHeight,
      options.boundaries.maxHeight,
    ) * aspectRatio;
  const reach = Math.max(
    horizontalAreaReach(context, far, moved),
    horizontalBoxReach(context, far, moved),
  );
  return Math.max(own, reach * aspectRatio);
}

function verticalAreaReach(context: Context, far: boolean, moved: number): number {
  const { start, aspectRatio, size, originOffset, options } = context;
  if (options.extent === undefined) {
    return 0;
  }
  if (far) {
    return upperClamp(start.x + size.height * aspectRatio + originOffset.x, options.extent[1][0]);
  }
  return lowerClamp(start.x + moved + originOffset.x, options.extent[0][0]);
}

function verticalBoxReach(context: Context, far: boolean, moved: number): number {
  const { start, aspectRatio, size, options } = context;
  if (options.childExtent === undefined) {
    return 0;
  }
  if (far) {
    return lowerClamp(start.x + size.height * aspectRatio, options.childExtent[1][0]);
  }
  return upperClamp(start.x + moved, options.childExtent[0][0]);
}

// The same for a vertical resize.
export function verticalAspectClamp(context: Context): number {
  const { aspectRatio, direction, dist, size, options } = context;
  const far = growsTowardsFarEdge(direction, "y");
  const moved = (direction.affectsY ? dist.y : -dist.y) * aspectRatio;
  const own =
    sizeClamp(size.height * aspectRatio, options.boundaries.minWidth, options.boundaries.maxWidth) /
    aspectRatio;
  const reach = Math.max(
    verticalAreaReach(context, far, moved),
    verticalBoxReach(context, far, moved),
  );
  return Math.max(own, reach / aspectRatio);
}
