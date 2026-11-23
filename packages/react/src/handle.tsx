import { ConnectionMode, Position, errorMessages } from "@free-flow/core";
import type {
  ClickConnectionStart,
  Connection,
  ConnectionState,
  HandleType,
} from "@free-flow/core";
import { memo, useEffect, useLayoutEffect, useRef } from "react";
import type {
  CSSProperties,
  HTMLAttributes,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactElement,
  Ref,
} from "react";

import { cx } from "./class-names.ts";
import { clickHandle } from "./handle-click.ts";
import { beginHandleDrag } from "./handle-connect.ts";
import { refreshHandleFlags } from "./handle-flags.ts";
import type { IsValidConnection } from "./react-flow-props.ts";
import { shallow } from "./shallow.ts";
import { useNodeId } from "./use-graph-hooks.ts";
import { useStore, useStoreApi } from "./use-store.ts";
import { useViewProps, useViewPropsStore } from "./view-props.ts";

export interface HandleProps extends Omit<HTMLAttributes<HTMLDivElement>, "id" | "onConnect"> {
  type?: HandleType | undefined;
  position?: Position | undefined;
  /** Tells handles of one node apart; leave out when the node has one handle of this type. */
  id?: string | null | undefined;
  isConnectable?: boolean | undefined;
  isConnectableStart?: boolean | undefined;
  isConnectableEnd?: boolean | undefined;
  /** Checked for connections dragged from this handle, instead of the flow's `isValidConnection`. */
  isValidConnection?: IsValidConnection | undefined;
  onConnect?: ((connection: Connection) => void) | undefined;
  style?: CSSProperties | undefined;
  ref?: Ref<HTMLDivElement> | undefined;
}

interface HandleState {
  connectingFrom: boolean;
  connectingTo: boolean;
  possibleEnd: boolean;
  valid: boolean;
  inProgress: boolean;
  /** This handle is where a connection made by clicks began. */
  clickConnecting: boolean;
  /** Clicks on handles have begun a connection, which waits for its end. */
  clickInProgress: boolean;
}

interface HandleRef {
  nodeId: string;
  handleId: string | null;
  type: HandleType;
}

function isSameHandle(
  candidate: { id: string | null; type: HandleType } | null,
  node: { id: string } | null,
  ref: HandleRef,
): boolean {
  return (
    candidate !== null &&
    node !== null &&
    node.id === ref.nodeId &&
    candidate.id === ref.handleId &&
    candidate.type === ref.type
  );
}

// A handle can end the connection in progress when it is of the other kind (strict) or any other
// handle (loose).
function canEnd(connection: ConnectionState, ref: HandleRef, mode: ConnectionMode): boolean {
  if (!connection.inProgress) {
    return false;
  }
  return mode === ConnectionMode.Strict
    ? connection.fromHandle.type !== ref.type
    : !isSameHandle(connection.fromHandle, connection.fromNode, ref);
}

interface ConnectionSnapshot {
  connection: ConnectionState;
  connectionClickStartHandle: ClickConnectionStart | null;
  connectionMode: ConnectionMode;
}

function handleStateOf(flow: ConnectionSnapshot, ref: HandleRef): HandleState {
  const { connection, connectionClickStartHandle: click } = flow;
  const connectingTo = isSameHandle(connection.toHandle, connection.toNode, ref);
  return {
    clickConnecting:
      click !== null &&
      click.nodeId === ref.nodeId &&
      click.id === ref.handleId &&
      click.type === ref.type,
    clickInProgress: click !== null,
    inProgress: connection.inProgress,
    connectingFrom: isSameHandle(connection.fromHandle, connection.fromNode, ref),
    connectingTo,
    possibleEnd: canEnd(connection, ref, flow.connectionMode),
    valid: connectingTo && connection.isValid === true,
  };
}

/**
 * A point where edges attach to a node, and where a connection can be dragged from or dropped on.
 * Use it inside a custom node component.
 */

function HandleComponent({
  type = "source",
  position = Position.Top,
  id: idProp = null,
  isConnectable = true,
  isConnectableStart = true,
  isConnectableEnd = true,
  isValidConnection,
  onConnect,
  className,
  children,
  onPointerDown,
  onClick,
  ref,
  ...rest
}: HandleProps): ReactElement | null {
  const nodeId = useNodeId();
  const store = useStoreApi();
  const view = useViewPropsStore();
  // An empty id is no id, as in React Flow.
  const id = idProp === "" ? null : idProp;
  const noPan = useViewProps((props) => props.noPanClassName);
  const rfId = useViewProps((props) => props.rfId);
  const connectOnClick = useViewProps((props) => props.connectOnClick);
  const handleRef: HandleRef = { nodeId: nodeId ?? "", handleId: id, type };
  const state = useStore((flow) => handleStateOf(flow, handleRef), shallow);
  useEffect(() => {
    if (nodeId === null) {
      view.getState().onError?.("010", errorMessages.error010());
    }
  }, [nodeId, view]);
  // React Flow's connection reads whether a handle can be connected from its classes on the page each
  // time it asks; the flow keeps that with what the node was measured with, so it is told when it
  // changes (a handle that takes one connection only, say).
  const flags = `${String(isConnectable)} ${String(isConnectableStart)} ${String(isConnectableEnd)}`;
  const toldFlags = useRef(flags);
  useLayoutEffect(() => {
    if (nodeId !== null && toldFlags.current !== flags) {
      toldFlags.current = flags;
      refreshHandleFlags(store, nodeId);
    }
  }, [flags, nodeId, store]);
  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>): void => {
    onPointerDown?.(event);
    if (nodeId === null || event.button !== 0) {
      return;
    }
    if (isConnectable && isConnectableStart) {
      // The press belongs to the connection, not to a drag of the node underneath.
      event.stopPropagation();
      beginHandleDrag(
        { store, view, nodeId, handleId: id, handleType: type, onConnect, isValidConnection },
        event.nativeEvent,
      );
    }
  };
  const handleClick = (event: ReactMouseEvent<HTMLDivElement>): void => {
    if (nodeId === null) {
      return;
    }
    clickHandle(
      { store, view, nodeId, handleId: id, handleType: type, onConnect, isValidConnection },
      isConnectable && isConnectableStart,
      event,
    );
  };
  const indicator =
    isConnectable &&
    (!state.inProgress || state.possibleEnd) &&
    (state.inProgress || state.clickInProgress ? isConnectableEnd : isConnectableStart);
  return (
    // React Flow's handle has no role or key handler either: a click only completes a connection
    // that the pointer began, and keyboards cannot make one.
    // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div
      {...rest}
      ref={ref}
      data-id={`${rfId}-${String(nodeId)}-${String(id)}-${type}`}
      data-handleid={id ?? undefined}
      data-nodeid={nodeId}
      data-handlepos={position}
      className={cx(
        "react-flow__handle",
        `react-flow__handle-${position}`,
        // As in React Flow, the class is this one whatever `noDragClassName` is.
        "nodrag",
        noPan,
        type,
        isConnectable && "connectable",
        isConnectableStart && "connectablestart",
        isConnectableEnd && "connectableend",
        state.clickConnecting && "clickconnecting",
        state.connectingFrom && "connectingfrom",
        state.connectingTo && "connectingto",
        state.valid && "valid",
        indicator && "connectionindicator",
        className,
      )}
      onPointerDown={handlePointerDown}
      onClick={onClick ?? (connectOnClick ? handleClick : undefined)}
    >
      {children}
    </div>
  );
}

export const Handle = memo(HandleComponent);
