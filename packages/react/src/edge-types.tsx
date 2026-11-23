import {
  getBezierPath,
  getSimpleBezierPath,
  getSmoothStepPath,
  getStraightPath,
} from "@free-flow/core";
import type { EdgePath } from "@free-flow/core";
import type { ComponentType, ReactElement } from "react";

import { BaseEdge } from "./base-edge.tsx";
import type { BaseEdgeProps } from "./base-edge.tsx";
import type {
  BezierEdgeProps,
  SimpleBezierEdgeProps,
  SmoothStepEdgeProps,
  StepEdgeProps,
  StraightEdgeProps,
} from "./type-aliases.ts";
import type { EdgeProps, EdgeTypes } from "./types.ts";

// What every built-in edge passes on to `BaseEdge`, whatever its shape. The edges that are drawn by
// their `type` are the internal versions, which leave the edge's id off the path, as React Flow's
// do; the exported ones (used inside a custom edge) put it there.
function baseProps(props: StraightEdgeProps, path: EdgePath, internal: boolean): BaseEdgeProps {
  return {
    id: internal ? undefined : props.id,
    path: path[0],
    labelX: path[1],
    labelY: path[2],
    label: props.label,
    labelStyle: props.labelStyle,
    labelShowBg: props.labelShowBg,
    labelBgStyle: props.labelBgStyle,
    labelBgPadding: props.labelBgPadding,
    labelBgBorderRadius: props.labelBgBorderRadius,
    style: props.style,
    markerStart: props.markerStart,
    markerEnd: props.markerEnd,
    interactionWidth: props.interactionWidth,
  };
}

function straightEdgeOf(props: StraightEdgeProps, internal: boolean): ReactElement {
  const path = getStraightPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    targetX: props.targetX,
    targetY: props.targetY,
  });
  return <BaseEdge {...baseProps(props, path, internal)} />;
}

/** A straight line between the two handles. */
export function StraightEdge(props: StraightEdgeProps): ReactElement {
  return straightEdgeOf(props, false);
}

function StraightEdgeInternal(props: StraightEdgeProps): ReactElement {
  return straightEdgeOf(props, true);
}

function bezierEdgeOf(props: BezierEdgeProps, internal: boolean): ReactElement {
  const path = getBezierPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    sourcePosition: props.sourcePosition,
    targetX: props.targetX,
    targetY: props.targetY,
    targetPosition: props.targetPosition,
    curvature: props.pathOptions?.curvature,
  });
  return <BaseEdge {...baseProps(props, path, internal)} />;
}

/** A curve that leaves and enters the handles at right angles to their sides. */
export function BezierEdge(props: BezierEdgeProps): ReactElement {
  return bezierEdgeOf(props, false);
}

function BezierEdgeInternal(props: BezierEdgeProps): ReactElement {
  return bezierEdgeOf(props, true);
}

function simpleBezierEdgeOf(props: SimpleBezierEdgeProps, internal: boolean): ReactElement {
  const path = getSimpleBezierPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    sourcePosition: props.sourcePosition,
    targetX: props.targetX,
    targetY: props.targetY,
    targetPosition: props.targetPosition,
  });
  return <BaseEdge {...baseProps(props, path, internal)} />;
}

/** A curve with its control points halfway along the axis each handle faces. */
export function SimpleBezierEdge(props: SimpleBezierEdgeProps): ReactElement {
  return simpleBezierEdgeOf(props, false);
}

function SimpleBezierEdgeInternal(props: SimpleBezierEdgeProps): ReactElement {
  return simpleBezierEdgeOf(props, true);
}

function smoothStepEdgeOf(props: SmoothStepEdgeProps, internal: boolean): ReactElement {
  const path = getSmoothStepPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    sourcePosition: props.sourcePosition,
    targetX: props.targetX,
    targetY: props.targetY,
    targetPosition: props.targetPosition,
    borderRadius: props.pathOptions?.borderRadius,
    offset: props.pathOptions?.offset,
    stepPosition: props.pathOptions?.stepPosition,
  });
  return <BaseEdge {...baseProps(props, path, internal)} />;
}

/** Right-angled segments with rounded corners. */
export function SmoothStepEdge(props: SmoothStepEdgeProps): ReactElement {
  return smoothStepEdgeOf(props, false);
}

function SmoothStepEdgeInternal(props: SmoothStepEdgeProps): ReactElement {
  return smoothStepEdgeOf(props, true);
}

function stepEdgeOf(props: StepEdgeProps, internal: boolean): ReactElement {
  const path = getSmoothStepPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    sourcePosition: props.sourcePosition,
    targetX: props.targetX,
    targetY: props.targetY,
    targetPosition: props.targetPosition,
    borderRadius: 0,
    offset: props.pathOptions?.offset,
  });
  return <BaseEdge {...baseProps(props, path, internal)} />;
}

/** Right-angled segments with sharp corners; like React Flow's, it takes the offset but not the step position. */
export function StepEdge(props: StepEdgeProps): ReactElement {
  return stepEdgeOf(props, false);
}

function StepEdgeInternal(props: StepEdgeProps): ReactElement {
  return stepEdgeOf(props, true);
}

export const BUILT_IN_EDGE_TYPES: EdgeTypes = {
  default: BezierEdgeInternal,
  straight: StraightEdgeInternal,
  step: StepEdgeInternal,
  smoothstep: SmoothStepEdgeInternal,
  simplebezier: SimpleBezierEdgeInternal,
};

/**
 * The component that draws an edge of this type: the caller's, a built-in one, or the bezier
 * default. Like node components, edge components are registered for their own data type and are
 * all treated as taking the plain edge props.
 */
export function resolveEdgeComponent(types: EdgeTypes, type: string): ComponentType<EdgeProps> {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- see above
  return (types[type] ??
    BUILT_IN_EDGE_TYPES[type] ??
    BezierEdgeInternal) as ComponentType<EdgeProps>;
}

/** The type an edge is drawn as, with its component: a type nobody registered is drawn as `default`. */
export function resolveEdgeType(
  types: EdgeTypes,
  type: string,
): { type: string; component: ComponentType<EdgeProps>; known: boolean } {
  if ((types[type] ?? BUILT_IN_EDGE_TYPES[type]) !== undefined) {
    return { type, component: resolveEdgeComponent(types, type), known: true };
  }
  return { type: "default", component: resolveEdgeComponent(types, "default"), known: false };
}
