import { connectionByClick, finalStateOf } from "@free-flow/core";
import type { ClickConnectionStart } from "@free-flow/core";
import type { MouseEvent as ReactMouseEvent } from "react";

import { connected } from "./handle-connect.ts";
import type { HandleContext } from "./handle-connect.ts";
import type { ReactFlowStore } from "./store-context.ts";
import type { ViewPropsStore } from "./view-props.ts";

/** Leaves the connection that clicks started: reports its end and forgets where it began. */
export function endClickConnection(
  store: ReactFlowStore,
  view: ViewPropsStore,
  event: MouseEvent,
): void {
  const state = store.getState();
  if (state.connectionClickStartHandle !== null) {
    view.getState().onClickConnectEnd?.(event, finalStateOf(state.connection));
    store.setState({ connectionClickStartHandle: null });
  }
}

// The first click: remembers where the connection begins.
function startClick(context: HandleContext, event: ReactMouseEvent<HTMLDivElement>): void {
  const { store, view, nodeId, handleId, handleType } = context;
  view.getState().onClickConnectStart?.(event.nativeEvent, { nodeId, handleId, handleType });
  store.setState({ connectionClickStartHandle: { nodeId, type: handleType, id: handleId } });
}

// The second click: makes the connection if this handle can end it, and leaves the click gesture.
function completeClick(
  context: HandleContext,
  from: ClickConnectionStart,
  event: ReactMouseEvent<HTMLDivElement>,
): void {
  const { store, view, nodeId, handleId, handleType } = context;
  const to = { nodeId, type: handleType, id: handleId };
  const made = connectionByClick(store, { from, to, isValidConnection: context.isValidConnection });
  if (made !== undefined) {
    connected(context, made);
  }
  endClickConnection(store, view, event.nativeEvent);
}

/**
 * A click on a handle with `connectOnClick`. The first one (on a handle that can start a connection)
 * remembers where the connection begins; the next one, on another handle, ends it there if that
 * handle can. Nothing is drawn in between, as in React Flow.
 */
export function clickHandle(
  context: HandleContext,
  startable: boolean,
  event: ReactMouseEvent<HTMLDivElement>,
): void {
  const from = context.store.getState().connectionClickStartHandle;
  if (from !== null) {
    completeClick(context, from, event);
  } else if (startable) {
    startClick(context, event);
  }
}
