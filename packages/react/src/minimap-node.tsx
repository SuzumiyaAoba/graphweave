import type { CSSProperties, MouseEvent as ReactMouseEvent, ReactElement } from "react";

import { cx } from "./class-names.ts";

export interface MiniMapNodeProps {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  borderRadius: number;
  className: string;
  color?: string | undefined;
  shapeRendering: "auto" | "optimizeSpeed" | "crispEdges" | "geometricPrecision";
  strokeColor?: string | undefined;
  strokeWidth?: number | undefined;
  style?: CSSProperties | undefined;
  selected: boolean;
  onClick?: ((event: ReactMouseEvent, id: string) => void) | undefined;
}

/** How one node looks on the mini map: a rectangle. Replace it through the `nodeComponent` prop. */
export function MiniMapNode({
  id,
  x,
  y,
  width,
  height,
  borderRadius,
  className,
  color,
  shapeRendering,
  strokeColor,
  strokeWidth,
  style,
  selected,
  onClick,
}: MiniMapNodeProps): ReactElement {
  // The node's own style only lends its background, when no colour was given, as in React Flow.
  const fill = [color, style?.background, style?.backgroundColor].find(
    (value): value is string => typeof value === "string" && value !== "",
  );
  return (
    <rect
      className={cx("react-flow__minimap-node", selected && "selected", className)}
      x={x}
      y={y}
      rx={borderRadius}
      ry={borderRadius}
      width={width}
      height={height}
      style={{ fill, stroke: strokeColor, strokeWidth }}
      shapeRendering={shapeRendering}
      onClick={
        onClick === undefined
          ? undefined
          : (event) => {
              onClick(event, id);
            }
      }
    />
  );
}
