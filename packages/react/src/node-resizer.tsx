import { ResizeControlVariant } from "@graphweave/core";
import type { ControlPosition } from "@graphweave/core";
import type { CSSProperties, ReactElement } from "react";

import { NodeResizeControl } from "./node-resize-control.tsx";
import type { ResizeControlOptions } from "./node-resize-control.tsx";

const LINES: readonly ControlPosition[] = ["top", "right", "bottom", "left"];
const HANDLES: readonly ControlPosition[] = [
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
];

export interface NodeResizerProps extends ResizeControlOptions {
  nodeId?: string | undefined;
  color?: string | undefined;
  handleClassName?: string | undefined;
  handleStyle?: CSSProperties | undefined;
  lineClassName?: string | undefined;
  lineStyle?: CSSProperties | undefined;
  /** Show or hide the controls; shown by default. */
  isVisible?: boolean | undefined;
}

/** Four lines and four corner handles around a node that resize it. Use it inside a custom node. */
export function NodeResizer({
  nodeId,
  color,
  handleClassName,
  handleStyle,
  lineClassName,
  lineStyle,
  isVisible = true,
  ...options
}: NodeResizerProps): ReactElement | null {
  if (!isVisible) {
    return null;
  }
  return (
    <>
      {LINES.map((position) => (
        <NodeResizeControl
          {...options}
          key={position}
          nodeId={nodeId}
          position={position}
          variant={ResizeControlVariant.Line}
          color={color}
          className={lineClassName}
          style={lineStyle}
        />
      ))}
      {HANDLES.map((position) => (
        <NodeResizeControl
          {...options}
          key={position}
          nodeId={nodeId}
          position={position}
          variant={ResizeControlVariant.Handle}
          color={color}
          className={handleClassName}
          style={handleStyle}
        />
      ))}
    </>
  );
}
