import {
  addEdge,
  cancelConnection,
  canStartConnection,
  endConnection,
  startConnection,
} from "@graphweave/core";
import type { Connection, HandleType, StartConnectionParams } from "@graphweave/core";

import { followConnectionPointer } from "./connection-auto-pan.ts";
import { dragConnection } from "./connection-drag.ts";
import { moveConnectionTo } from "./connection-move.ts";
import { clientToFlow } from "./coords.ts";
import { noop } from "./noop.ts";
import type { IsValidConnection } from "./react-flow-props.ts";
import type { ReactFlowStore } from "./store-context.ts";
import { swallowClickOverPane } from "./swallow-click.ts";
import type { ViewPropsStore } from "./view-props.ts";

/** Everything one handle needs to begin a connection. */
export interface HandleContext {
  store: ReactFlowStore;
  view: ViewPropsStore;
  nodeId: string;
  handleId: string | null;
  handleType: HandleType;
  onConnect?: ((connection: Connection) => void) | undefined;
  isValidConnection?: IsValidConnection | undefined;
}

// What a connection that was made does, in React Flow's order: the default edge options are added to
// it, a flow that owns its edges gets the edge, and then `onConnect` of the flow and of the handle.
export function connected(context: HandleContext, made: Connection): void {
  const state = context.store.getState();
  const params = { ...context.view.getState().defaultEdgeOptions, ...made };
  if (state.hasDefaultEdges) {
    state.setEdges(addEdge(params, state.edges));
  }
  state.onConnect?.(params);
  context.onConnect?.(params);
}

// Where the pointer is, in flow coordinates, as the point a connection starts from.
function pointOf(context: HandleContext, event: PointerEvent): StartConnectionParams {
  const { nodeId, handleId, handleType } = context;
  const point = clientToFlow(context.store, { x: event.clientX, y: event.clientY });
  return { nodeId, handleId, handleType, point };
}

// The handle's own `isValidConnection` replaces the flow's for the length of the drag.
function withHandleValidator(context: HandleContext): () => void {
  const previous = context.store.getState().isValidConnection;
  if (context.isValidConnection === undefined) {
    return noop;
  }
  context.store.setState({ isValidConnection: context.isValidConnection });
  return () => {
    // The flow may have given a newer validator meanwhile; that one stays.
    if (context.store.getState().isValidConnection === context.isValidConnection) {
      context.store.setState({ isValidConnection: previous });
    }
  };
}

// Ends the connection that was dragged: over a valid handle that makes it.
function finish(context: HandleContext, up: PointerEvent): void {
  if (up.type === "pointercancel") {
    cancelConnection(context.store);
    return;
  }
  const result = endConnection(context.store, { report: false });
  if (result.connection !== undefined) {
    connected(context, result.connection);
  }
  if (result.finalState !== undefined) {
    context.view.getState().onConnectEnd?.(up, result.finalState);
  }
  swallowClickOverPane(up);
}

/**
 * Starts a connection from a handle on pointer down. Nothing shows until the pointer has moved past
 * `connectionDragThreshold`; from then on the connection follows the pointer until it is released:
 * over a valid handle that makes the connection, anywhere else it is dropped.
 */
export function beginHandleDrag(context: HandleContext, down: PointerEvent): void {
  if (!canStartConnection(context.store, pointOf(context, down))) {
    return;
  }
  const restore = withHandleValidator(context);
  dragConnection(context.store, down, {
    start: (latest) => {
      startConnection(context.store, pointOf(context, down));
      const { nodeId, handleId, handleType } = context;
      context.view.getState().onConnectStart?.(down, { nodeId, handleId, handleType });
      return followConnectionPointer(context.store, latest);
    },
    move: (event) => {
      moveConnectionTo(context.store, event);
    },
    end: (up, started) => {
      if (started) {
        finish(context, up);
      }
      restore();
    },
  });
}
