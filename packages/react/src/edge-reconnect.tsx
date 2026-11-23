import {
  Position,
  cancelConnection,
  canStartConnection,
  endConnection,
  startConnection,
} from "@free-flow/core";
import type { Connection, HandleType } from "@free-flow/core";
import type { PointerEvent as ReactPointerEvent, ReactElement } from "react";

import { followConnectionPointer } from "./connection-auto-pan.ts";
import { dragConnection } from "./connection-drag.ts";
import { moveConnectionTo } from "./connection-move.ts";
import { clientToFlow } from "./coords.ts";
import { asMouseEvent } from "./drag-session.ts";
import type { ReactFlowStore } from "./store-context.ts";
import { swallowClickOverPane } from "./swallow-click.ts";
import type { Edge } from "./types.ts";
import type { ViewPropsStore } from "./view-props.ts";

/** The end of an edge that stays where it is while the other end is dragged elsewhere. */
export interface FixedEnd {
  nodeId: string;
  handleId: string | null;
  handleType: HandleType;
}

export interface Reconnecting {
  store: ReactFlowStore;
  view: ViewPropsStore;
  edge: Edge;
  fixed: FixedEnd;
  /** Told when a reconnect begins and ends: the edge is not drawn while one of its ends is moved. */
  onReconnecting: (reconnecting: boolean) => void;
}

// The owner is told through `onReconnect` and moves the edge itself (`reconnectEdge` does that), as
// in React Flow, whether the flow owns its edges or not.
function reportReconnect(context: Reconnecting, connection: Connection): void {
  const { store, view } = context;
  const current = store.getState().edgeLookup.get(context.edge.id);
  view.getState().onReconnect?.(current ?? context.edge, connection);
}

function finishReconnect(context: Reconnecting, event: PointerEvent): void {
  const { store, view, edge, fixed } = context;
  context.onReconnecting(false);
  if (event.type === "pointercancel") {
    cancelConnection(store);
    return;
  }
  const result = endConnection(store, { report: false });
  if (result.connection !== undefined) {
    reportReconnect(context, result.connection);
  }
  if (result.finalState !== undefined) {
    // The flow's own `onConnectEnd` hears of it first, as in React Flow.
    view.getState().onConnectEnd?.(event, result.finalState);
    view.getState().onReconnectEnd?.(event, edge, fixed.handleType, result.finalState);
  }
  swallowClickOverPane(event);
}

/**
 * Starts moving one end of an edge: a connection is dragged out of the other end's handle, and
 * where it is dropped decides the edge's new end. As for a handle, it only begins once the pointer
 * has moved past `connectionDragThreshold`; a plain click on the end does nothing.
 */
export function beginReconnect(context: Reconnecting, down: PointerEvent): void {
  const { store, view, edge, fixed } = context;
  const point = clientToFlow(store, { x: down.clientX, y: down.clientY });
  const params = { ...fixed, point, unchecked: true };
  if (!canStartConnection(store, params)) {
    return;
  }
  dragConnection(store, down, {
    start: (latest) => {
      startConnection(store, params);
      context.onReconnecting(true);
      // As in React Flow, the kind reported is that of the end that stays where it is.
      view.getState().onReconnectStart?.(asMouseEvent(down), edge, fixed.handleType);
      view.getState().onConnectStart?.(down, {
        nodeId: fixed.nodeId,
        handleId: fixed.handleId,
        handleType: fixed.handleType,
      });
      return followConnectionPointer(store, latest);
    },
    move: (event) => {
      moveConnectionTo(store, event);
    },
    end: (event, started) => {
      if (started) {
        finishReconnect(context, event);
      }
    },
  });
}

export interface EdgeReconnectAnchorProps {
  end: HandleType;
  /** Which way the handle on that end faces: the disc sits that far out from where the edge ends. */
  position: Position;
  x: number;
  y: number;
  radius: number;
  onPress: (end: HandleType, event: PointerEvent) => void;
  /** Told when the pointer enters or leaves the disc, so that the edge can show it can be moved. */
  onHover: (hovered: boolean) => void;
}

// The disc is moved out from the end of the edge by its radius, away from the node.
function shiftedX(x: number, radius: number, position: Position): number {
  if (position === Position.Left) {
    return x - radius;
  }
  return position === Position.Right ? x + radius : x;
}

function shiftedY(y: number, radius: number, position: Position): number {
  if (position === Position.Top) {
    return y - radius;
  }
  return position === Position.Bottom ? y + radius : y;
}

/** An invisible disc on one end of an edge; pressing it starts moving that end. */
export function EdgeReconnectAnchor({
  end,
  position,
  x,
  y,
  radius,
  onPress,
  onHover,
}: EdgeReconnectAnchorProps): ReactElement {
  const handlePointerDown = (event: ReactPointerEvent<SVGCircleElement>): void => {
    if (event.button === 0) {
      onPress(end, event.nativeEvent);
    }
  };
  return (
    <circle
      className={`react-flow__edgeupdater react-flow__edgeupdater-${end}`}
      cx={shiftedX(x, radius, position)}
      cy={shiftedY(y, radius, position)}
      r={radius}
      fill="transparent"
      stroke="transparent"
      onPointerDown={handlePointerDown}
      onMouseEnter={() => {
        onHover(true);
      }}
      onMouseOut={() => {
        onHover(false);
      }}
    />
  );
}
