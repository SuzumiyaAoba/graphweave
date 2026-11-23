import type { Point, Rect } from "./geometry.ts";
import type { ControlDirection } from "./resize-dimensions.ts";
import { getDimensionsAfterResize } from "./resize-dimensions.ts";
import type { NodeOrigin } from "./types.ts";

export type ControlPosition =
  | "top-left"
  | "top"
  | "top-right"
  | "right"
  | "bottom-right"
  | "bottom"
  | "bottom-left"
  | "left";

type Side = -1 | 0 | 1;

/** Which edges a resize control moves: `-1` the near one (left/top), `1` the far one, `0` neither. */
export interface ResizeDirection {
  horizontal: Side;
  vertical: Side;
}

const DIRECTIONS: Readonly<Record<ControlPosition, ResizeDirection>> = {
  "top-left": { horizontal: -1, vertical: -1 },
  top: { horizontal: 0, vertical: -1 },
  "top-right": { horizontal: 1, vertical: -1 },
  right: { horizontal: 1, vertical: 0 },
  "bottom-right": { horizontal: 1, vertical: 1 },
  bottom: { horizontal: 0, vertical: 1 },
  "bottom-left": { horizontal: -1, vertical: 1 },
  left: { horizontal: -1, vertical: 0 },
};

export function directionOf(position: ControlPosition): ResizeDirection {
  return DIRECTIONS[position];
}

export interface ResizeConstraints {
  minWidth: number;
  minHeight: number;
  maxWidth: number;
  maxHeight: number;
  keepAspectRatio: boolean;
  /** The absolute area the node has to stay inside (a parent's box, or an extent). */
  area?: Rect;
}

export const DEFAULT_RESIZE_CONSTRAINTS: ResizeConstraints = {
  minWidth: 10,
  minHeight: 10,
  maxWidth: Number.POSITIVE_INFINITY,
  maxHeight: Number.POSITIVE_INFINITY,
  keepAspectRatio: false,
};

function controlOf(direction: ResizeDirection): ControlDirection {
  return {
    isHorizontal: direction.horizontal !== 0,
    isVertical: direction.vertical !== 0,
    affectsX: direction.horizontal === -1,
    affectsY: direction.vertical === -1,
  };
}

export interface ResizeChange {
  direction: ResizeDirection;
  /** How far the pointer has moved since the resize began, in flow units. */
  delta: Point;
  constraints?: ResizeConstraints | undefined;
  /** Where the node's position is within its box; its top left corner by default. */
  nodeOrigin?: NodeOrigin | undefined;
}

/**
 * The rectangle after dragging a resize control, with React Flow's rules: the edge opposite to the
 * control stays put, the pointer's distance counts in whole units, the size is bounded by the
 * constraints and, if given, an area, and the aspect ratio can be kept.
 */
export function resizeRect(start: Rect, change: ResizeChange): Rect {
  const { direction, delta, constraints = DEFAULT_RESIZE_CONSTRAINTS } = change;
  const nodeOrigin = change.nodeOrigin ?? [0, 0];
  const { area } = constraints;
  const out = getDimensionsAfterResize(
    {
      x: start.x + nodeOrigin[0] * start.width,
      y: start.y + nodeOrigin[1] * start.height,
      width: start.width,
      height: start.height,
    },
    { direction: controlOf(direction), pointer: delta },
    {
      boundaries: constraints,
      // A box without a size has no aspect ratio to keep.
      keepAspectRatio: constraints.keepAspectRatio && start.width > 0 && start.height > 0,
      nodeOrigin,
      extent:
        area === undefined
          ? undefined
          : [
              [area.x, area.y],
              [area.x + area.width, area.y + area.height],
            ],
    },
  );
  return {
    x: out.x - nodeOrigin[0] * out.width,
    y: out.y - nodeOrigin[1] * out.height,
    width: out.width,
    height: out.height,
  };
}
