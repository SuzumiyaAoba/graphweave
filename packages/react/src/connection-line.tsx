import {
  ConnectionLineType,
  getBezierPath,
  getSimpleBezierPath,
  getSmoothStepPath,
  getStraightPath,
} from "@free-flow/core";
import type { ConnectionInProgress } from "@free-flow/core";
import type { ReactElement } from "react";

import { cx } from "./class-names.ts";
import { shallow } from "./shallow.ts";
import { useConnection } from "./use-graph-hooks.ts";
import { useStore } from "./use-store.ts";
import { useViewProps } from "./view-props.ts";

function pathOf(type: ConnectionLineType, connection: ConnectionInProgress): string {
  const ends = {
    sourceX: connection.from.x,
    sourceY: connection.from.y,
    sourcePosition: connection.fromPosition,
    targetX: connection.to.x,
    targetY: connection.to.y,
    targetPosition: connection.toPosition,
  };
  if (type === ConnectionLineType.Straight) {
    return getStraightPath(ends)[0];
  }
  if (type === ConnectionLineType.Step) {
    return getSmoothStepPath({ ...ends, borderRadius: 0 })[0];
  }
  if (type === ConnectionLineType.SmoothStep) {
    return getSmoothStepPath(ends)[0];
  }
  return type === ConnectionLineType.SimpleBezier
    ? getSimpleBezierPath(ends)[0]
    : getBezierPath(ends)[0];
}

function statusOf(connection: ConnectionInProgress): "valid" | "invalid" | null {
  if (connection.isValid === null) {
    return null;
  }
  return connection.isValid ? "valid" : "invalid";
}

/** The line that follows the pointer while a connection is dragged out of a handle. */
export function ConnectionLine(): ReactElement | null {
  const connection = useConnection();
  const type = useViewProps((props) => props.connectionLineType);
  const style = useViewProps((props) => props.connectionLineStyle);
  const containerStyle = useViewProps((props) => props.connectionLineContainerStyle);
  const Custom = useViewProps((props) => props.connectionLineComponent);
  const { width, height, nodesConnectable } = useStore(
    (state) => ({
      width: state.width,
      height: state.height,
      nodesConnectable: state.nodesConnectable,
    }),
    shallow,
  );
  // As in React Flow, nothing is drawn before the canvas has a size or when nothing can connect.
  if (!connection.inProgress || width === 0 || !nodesConnectable) {
    return null;
  }
  const status = statusOf(connection);
  return (
    <svg
      style={containerStyle}
      width={width}
      height={height}
      className="react-flow__connectionline react-flow__container"
    >
      <g className={cx("react-flow__connection", status)}>
        {Custom === undefined ? (
          <path
            d={pathOf(type, connection)}
            fill="none"
            className="react-flow__connection-path"
            style={style}
          />
        ) : (
          // oxlint-disable-next-line react/static-components -- the component is chosen by the caller through a prop
          <Custom
            fromX={connection.from.x}
            fromY={connection.from.y}
            toX={connection.to.x}
            toY={connection.to.y}
            fromPosition={connection.fromPosition}
            toPosition={connection.toPosition}
            connectionLineType={type}
            connectionLineStyle={style}
            connectionStatus={status}
            fromNode={connection.fromNode}
            fromHandle={connection.fromHandle}
            toNode={connection.toNode}
            toHandle={connection.toHandle}
            pointer={connection.pointer}
          />
        )}
      </g>
    </svg>
  );
}
