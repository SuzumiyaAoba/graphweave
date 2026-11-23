import type { EdgeEndpoints, EdgePath } from "./edge-paths.ts";
import { HALF } from "./geometry.ts";
import { tidy, toPath } from "./step-path.ts";
import { Position } from "./types.ts";
import type { XYPosition } from "./types.ts";

// The routing follows React Flow's, step by step (the way a path leaves a handle, where it turns,
// where its label sits), so that edges look the same; `xyflow-parity.test.ts` holds it to that.

const DEFAULT_BORDER_RADIUS = 5;
const DEFAULT_STEP_OFFSET = 20;
const ZERO: XYPosition = { x: 0, y: 0 };
const NO_GAPS = { source: ZERO, target: ZERO };

const DIRECTIONS: Readonly<Record<Position, XYPosition>> = {
  [Position.Left]: { x: -1, y: 0 },
  [Position.Right]: { x: 1, y: 0 },
  [Position.Top]: { x: 0, y: -1 },
  [Position.Bottom]: { x: 0, y: 1 },
};

type Axis = "x" | "y";

export interface GetSmoothStepPathParams extends EdgeEndpoints {
  sourcePosition?: Position | undefined;
  targetPosition?: Position | undefined;
  /** Radius of the rounded corners; `0` gives the sharp `step` edge. */
  borderRadius?: number | undefined;
  centerX?: number | undefined;
  centerY?: number | undefined;
  /** How far the path leaves a handle before it turns. */
  offset?: number | undefined;
  /** Where the middle segment sits between source and target, from `0` to `1`. */
  stepPosition?: number | undefined;
}

/** The two ends, where the path leaves and enters (`gapped`: `offset` away from the handle). */
interface Frame {
  source: XYPosition;
  target: XYPosition;
  gappedSource: XYPosition;
  gappedTarget: XYPosition;
  sourcePosition: Position;
  targetPosition: Position;
  offset: number;
}

/** Which way the path runs between the gapped ends, and the caller's say on where it turns. */
interface Aim {
  axis: Axis;
  /** `1` or `-1`: the way along `axis` from the gapped source to the gapped target. */
  heading: number;
  centerX: number | undefined;
  centerY: number | undefined;
  stepPosition: number;
}

/** The corners in between, the label position, and the gapped ends the path really uses. */
interface Routed {
  points: XYPosition[];
  center: XYPosition;
  gappedSource: XYPosition;
  gappedTarget: XYPosition;
}

function move(point: XYPosition, direction: XYPosition, gap: number): XYPosition {
  return { x: point.x + direction.x * gap, y: point.y + direction.y * gap };
}

function frameOf(params: GetSmoothStepPathParams): Frame {
  const sourcePosition = params.sourcePosition ?? Position.Bottom;
  const targetPosition = params.targetPosition ?? Position.Top;
  const offset = params.offset ?? DEFAULT_STEP_OFFSET;
  const source = { x: params.sourceX, y: params.sourceY };
  const target = { x: params.targetX, y: params.targetY };
  return {
    source,
    target,
    gappedSource: move(source, DIRECTIONS[sourcePosition], offset),
    gappedTarget: move(target, DIRECTIONS[targetPosition], offset),
    sourcePosition,
    targetPosition,
    offset,
  };
}

// The way from the gapped source to the gapped target along the axis the source handle faces.
function directionOf(frame: Frame): XYPosition {
  const { gappedSource, gappedTarget, sourcePosition } = frame;
  if (sourcePosition === Position.Left || sourcePosition === Position.Right) {
    return gappedSource.x < gappedTarget.x ? { x: 1, y: 0 } : { x: -1, y: 0 };
  }
  return gappedSource.y < gappedTarget.y ? { x: 0, y: 1 } : { x: 0, y: -1 };
}

function aimOf(frame: Frame, params: GetSmoothStepPathParams): Aim {
  const direction = directionOf(frame);
  const axis: Axis = direction.x === 0 ? "y" : "x";
  return {
    axis,
    heading: direction[axis],
    centerX: params.centerX,
    centerY: params.centerY,
    stepPosition: params.stepPosition ?? HALF,
  };
}

// Where the middle of an edge between facing handles is: the caller's choice, or the step position.
function oppositeCenter(frame: Frame, aim: Aim): XYPosition {
  const { gappedSource: from, gappedTarget: to } = frame;
  const { stepPosition } = aim;
  return aim.axis === "x"
    ? {
        x: aim.centerX ?? from.x + (to.x - from.x) * stepPosition,
        y: aim.centerY ?? (from.y + to.y) * HALF,
      }
    : {
        x: aim.centerX ?? (from.x + to.x) * HALF,
        y: aim.centerY ?? from.y + (to.y - from.y) * stepPosition,
      };
}

// Handles that face each other: a Z shape when the target lies ahead, a detour otherwise.
function oppositeRoute(frame: Frame, aim: Aim): Routed {
  const { gappedSource: from, gappedTarget: to } = frame;
  const center = oppositeCenter(frame, aim);
  const forward = DIRECTIONS[frame.sourcePosition][aim.axis] === aim.heading;
  const vertical = [
    { x: center.x, y: from.y },
    { x: center.x, y: to.y },
  ];
  const horizontal = [
    { x: from.x, y: center.y },
    { x: to.x, y: center.y },
  ];
  const points = (aim.axis === "x") === forward ? vertical : horizontal;
  return { points, center, gappedSource: from, gappedTarget: to };
}

// Handles on the same side, or at right angles, need one corner: x from one end and y from the other.
function defaultCorner(frame: Frame, aim: Aim): XYPosition {
  const { gappedSource: from, gappedTarget: to } = frame;
  const forward = DIRECTIONS[frame.sourcePosition][aim.axis] === aim.heading;
  const takesTargetX = (aim.axis === "x") === forward;
  return takesTargetX ? { x: to.x, y: from.y } : { x: from.x, y: to.y };
}

// For handles at right angles the corner is on the other side of the two ends in some layouts.
function isFlipped(frame: Frame, aim: Aim): boolean {
  const { gappedSource: from, gappedTarget: to } = frame;
  const sourceDir = DIRECTIONS[frame.sourcePosition];
  const targetDir = DIRECTIONS[frame.targetPosition];
  const across: Axis = aim.axis === "x" ? "y" : "x";
  const sameDir = sourceDir[aim.axis] === targetDir[across];
  const sourceAbove = from[across] > to[across];
  const sourceBelow = from[across] < to[across];
  return sourceDir[aim.axis] === 1
    ? (!sameDir && sourceAbove) || (sameDir && sourceBelow)
    : (!sameDir && sourceBelow) || (sameDir && sourceAbove);
}

function cornerOf(frame: Frame, aim: Aim): XYPosition {
  if (frame.sourcePosition === frame.targetPosition || !isFlipped(frame, aim)) {
    return defaultCorner(frame, aim);
  }
  const { gappedSource: from, gappedTarget: to } = frame;
  return aim.axis === "x" ? { x: from.x, y: to.y } : { x: to.x, y: from.y };
}

// When both handles face the same way and are closer than `offset` along the axis, the corner and
// the gapped end would overlap, so one gapped end is pushed out a little further.
function gapOffsets(frame: Frame, aim: Aim): { source: XYPosition; target: XYPosition } {
  const { source, target, gappedSource, gappedTarget, offset } = frame;
  const diff = Math.abs(source[aim.axis] - target[aim.axis]);
  if (frame.sourcePosition !== frame.targetPosition || diff > offset) {
    return NO_GAPS;
  }
  const gap = Math.min(offset - 1, offset - diff);
  if (DIRECTIONS[frame.sourcePosition][aim.axis] === aim.heading) {
    const sign = gappedSource[aim.axis] > source[aim.axis] ? -1 : 1;
    return { source: { x: 0, y: 0, [aim.axis]: sign * gap }, target: ZERO };
  }
  const sign = gappedTarget[aim.axis] > target[aim.axis] ? -1 : 1;
  return { source: ZERO, target: { x: 0, y: 0, [aim.axis]: sign * gap } };
}

// The label goes on the longest segment of the edge.
function labelOn(corner: XYPosition, from: XYPosition, to: XYPosition): XYPosition {
  const longestX = Math.max(Math.abs(from.x - corner.x), Math.abs(to.x - corner.x));
  const longestY = Math.max(Math.abs(from.y - corner.y), Math.abs(to.y - corner.y));
  return longestX >= longestY
    ? { x: (from.x + to.x) * HALF, y: corner.y }
    : { x: corner.x, y: (from.y + to.y) * HALF };
}

function cornerRoute(frame: Frame, aim: Aim): Routed {
  const gaps = gapOffsets(frame, aim);
  const corner = cornerOf(frame, aim);
  const gappedSource = {
    x: frame.gappedSource.x + gaps.source.x,
    y: frame.gappedSource.y + gaps.source.y,
  };
  const gappedTarget = {
    x: frame.gappedTarget.x + gaps.target.x,
    y: frame.gappedTarget.y + gaps.target.y,
  };
  return {
    points: [corner],
    center: labelOn(corner, gappedSource, gappedTarget),
    gappedSource,
    gappedTarget,
  };
}

function routeOf(frame: Frame, aim: Aim): Routed {
  const facing =
    DIRECTIONS[frame.sourcePosition][aim.axis] * DIRECTIONS[frame.targetPosition][aim.axis];
  return facing === -1 ? oppositeRoute(frame, aim) : cornerRoute(frame, aim);
}

export function getSmoothStepPath(params: GetSmoothStepPathParams): EdgePath {
  const frame = frameOf(params);
  const routed = routeOf(frame, aimOf(frame, params));
  const polyline = tidy([
    frame.source,
    routed.gappedSource,
    ...routed.points,
    routed.gappedTarget,
    frame.target,
  ]);
  // As for every edge path: half the distance between the ends, whatever the route is.
  const offsetX = Math.abs(frame.target.x - frame.source.x) * HALF;
  const offsetY = Math.abs(frame.target.y - frame.source.y) * HALF;
  return [
    toPath(polyline, params.borderRadius ?? DEFAULT_BORDER_RADIUS),
    routed.center.x,
    routed.center.y,
    offsetX,
    offsetY,
  ];
}
