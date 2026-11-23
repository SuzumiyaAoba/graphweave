import type { CSSProperties, ReactElement, SVGAttributes } from "react";

import { cx } from "./class-names.ts";
import { EdgeText, hasLabel } from "./edge-text.tsx";
import type { EdgeTextProps } from "./edge-text.tsx";

const DEFAULT_INTERACTION_WIDTH = 20;

export interface BaseEdgeProps
  extends
    Omit<SVGAttributes<SVGPathElement>, "d" | "path" | "markerStart" | "markerEnd">,
    Pick<
      EdgeTextProps,
      | "label"
      | "labelStyle"
      | "labelShowBg"
      | "labelBgStyle"
      | "labelBgPadding"
      | "labelBgBorderRadius"
    > {
  /** The SVG path data of the edge. */
  path: string;
  /** Where the label goes; the label is left out when these are missing. */
  labelX?: number | undefined;
  labelY?: number | undefined;
  /** Width of the invisible path around the edge that makes it easy to hit with a pointer. */
  interactionWidth?: number | undefined;
  markerStart?: string | undefined;
  markerEnd?: string | undefined;
  style?: CSSProperties | undefined;
}

// A position a label can be put at; anything else (missing, NaN) leaves the label out.
function isNumber(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value);
}

/**
 * The visible path of an edge plus a wider, invisible one to catch pointer events, and the label.
 * Every built-in edge is made of it; use it to build your own.
 */
export function BaseEdge({
  path,
  labelX,
  labelY,
  label,
  labelStyle,
  labelShowBg,
  labelBgStyle,
  labelBgPadding,
  labelBgBorderRadius,
  interactionWidth = DEFAULT_INTERACTION_WIDTH,
  className,
  ...rest
}: BaseEdgeProps): ReactElement {
  return (
    <>
      <path {...rest} d={path} fill="none" className={cx("react-flow__edge-path", className)} />
      {interactionWidth > 0 ? (
        <path
          d={path}
          fill="none"
          strokeOpacity={0}
          strokeWidth={interactionWidth}
          className="react-flow__edge-interaction"
        />
      ) : null}
      {hasLabel(label) && isNumber(labelX) && isNumber(labelY) ? (
        <EdgeText
          x={labelX}
          y={labelY}
          label={label}
          labelStyle={labelStyle}
          labelShowBg={labelShowBg}
          labelBgStyle={labelBgStyle}
          labelBgPadding={labelBgPadding}
          labelBgBorderRadius={labelBgBorderRadius}
        />
      ) : null}
    </>
  );
}
