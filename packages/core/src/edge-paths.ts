import { HALF } from "./geometry.ts";
import { Position } from "./types.ts";
import type { XYPosition } from "./types.ts";

/** `[path, labelX, labelY, offsetX, offsetY]`: the SVG path plus the point where a label belongs. */
export type EdgePath = readonly [
  path: string,
  labelX: number,
  labelY: number,
  offsetX: number,
  offsetY: number,
];

const DEFAULT_CURVATURE = 0.25;
const CURVATURE_SCALE = 25;
// Weights of the control polygon of a cubic Bézier curve at t = 0.5.
const BEZIER_END_WEIGHT = 0.125;
const BEZIER_CONTROL_WEIGHT = 0.375;

export interface EdgeEndpoints {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
}

/** `[centerX, centerY, offsetX, offsetY]` of the straight segment between source and target. */
export function getEdgeCenter({
  sourceX,
  sourceY,
  targetX,
  targetY,
}: EdgeEndpoints): readonly [number, number, number, number] {
  const offsetX = Math.abs(targetX - sourceX) * HALF;
  const offsetY = Math.abs(targetY - sourceY) * HALF;
  return [
    Math.min(sourceX, targetX) + offsetX,
    Math.min(sourceY, targetY) + offsetY,
    offsetX,
    offsetY,
  ];
}

export type GetStraightPathParams = EdgeEndpoints;

export function getStraightPath(params: GetStraightPathParams): EdgePath {
  const [labelX, labelY, offsetX, offsetY] = getEdgeCenter(params);
  return [
    `M ${params.sourceX},${params.sourceY}L ${params.targetX},${params.targetY}`,
    labelX,
    labelY,
    offsetX,
    offsetY,
  ];
}

export interface BezierControls extends EdgeEndpoints {
  sourceControlX: number;
  sourceControlY: number;
  targetControlX: number;
  targetControlY: number;
}

/** The point halfway along a cubic Bézier curve, as `[x, y, offsetX, offsetY]` relative to the source. */
export function getBezierEdgeCenter(
  controls: BezierControls,
): readonly [number, number, number, number] {
  const { sourceX, sourceY, targetX, targetY } = controls;
  const centerX =
    sourceX * BEZIER_END_WEIGHT +
    controls.sourceControlX * BEZIER_CONTROL_WEIGHT +
    controls.targetControlX * BEZIER_CONTROL_WEIGHT +
    targetX * BEZIER_END_WEIGHT;
  const centerY =
    sourceY * BEZIER_END_WEIGHT +
    controls.sourceControlY * BEZIER_CONTROL_WEIGHT +
    controls.targetControlY * BEZIER_CONTROL_WEIGHT +
    targetY * BEZIER_END_WEIGHT;
  return [centerX, centerY, Math.abs(centerX - sourceX), Math.abs(centerY - sourceY)];
}

function controlOffset(distance: number, curvature: number): number {
  return distance >= 0 ? HALF * distance : curvature * CURVATURE_SCALE * Math.sqrt(-distance);
}

interface ControlInput {
  position: Position;
  from: XYPosition;
  to: XYPosition;
  curvature: number;
}

function controlWithCurvature({
  position,
  from,
  to,
  curvature,
}: ControlInput): readonly [number, number] {
  if (position === Position.Left) {
    return [from.x - controlOffset(from.x - to.x, curvature), from.y];
  }
  if (position === Position.Right) {
    return [from.x + controlOffset(to.x - from.x, curvature), from.y];
  }
  if (position === Position.Top) {
    return [from.x, from.y - controlOffset(from.y - to.y, curvature)];
  }
  return [from.x, from.y + controlOffset(to.y - from.y, curvature)];
}

function cubicPath(controls: BezierControls): EdgePath {
  const { sourceX, sourceY, targetX, targetY } = controls;
  const { sourceControlX, sourceControlY, targetControlX, targetControlY } = controls;
  const [labelX, labelY, offsetX, offsetY] = getBezierEdgeCenter(controls);
  return [
    `M${sourceX},${sourceY} C${sourceControlX},${sourceControlY} ${targetControlX},${targetControlY} ${targetX},${targetY}`,
    labelX,
    labelY,
    offsetX,
    offsetY,
  ];
}

export interface GetBezierPathParams extends EdgeEndpoints {
  sourcePosition?: Position | undefined;
  targetPosition?: Position | undefined;
  curvature?: number | undefined;
}

export function getBezierPath(params: GetBezierPathParams): EdgePath {
  const curvature = params.curvature ?? DEFAULT_CURVATURE;
  const source = { x: params.sourceX, y: params.sourceY };
  const target = { x: params.targetX, y: params.targetY };
  const [sourceControlX, sourceControlY] = controlWithCurvature({
    position: params.sourcePosition ?? Position.Bottom,
    from: source,
    to: target,
    curvature,
  });
  const [targetControlX, targetControlY] = controlWithCurvature({
    position: params.targetPosition ?? Position.Top,
    from: target,
    to: source,
    curvature,
  });
  return cubicPath({ ...params, sourceControlX, sourceControlY, targetControlX, targetControlY });
}

function simpleControl(
  position: Position,
  from: XYPosition,
  to: XYPosition,
): readonly [number, number] {
  return position === Position.Left || position === Position.Right
    ? [HALF * (from.x + to.x), from.y]
    : [from.x, HALF * (from.y + to.y)];
}

export interface GetSimpleBezierPathParams extends EdgeEndpoints {
  sourcePosition?: Position | undefined;
  targetPosition?: Position | undefined;
}

/** A Bézier whose control points sit halfway along the axis the handle faces, without curvature. */
export function getSimpleBezierPath(params: GetSimpleBezierPathParams): EdgePath {
  const source = { x: params.sourceX, y: params.sourceY };
  const target = { x: params.targetX, y: params.targetY };
  const [sourceControlX, sourceControlY] = simpleControl(
    params.sourcePosition ?? Position.Bottom,
    source,
    target,
  );
  const [targetControlX, targetControlY] = simpleControl(
    params.targetPosition ?? Position.Top,
    target,
    source,
  );
  return cubicPath({ ...params, sourceControlX, sourceControlY, targetControlX, targetControlY });
}
