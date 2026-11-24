import { connectionKey, errorMessages } from "@graphweave/core";
import type { HandleType, NodeConnection } from "@graphweave/core";
import { useEffect, useMemo, useRef } from "react";

import { useNodeId } from "./use-graph-hooks.ts";
import { useStore } from "./use-store.ts";

export interface UseNodeConnectionsParams {
  /** The node to look at; the node whose component is rendering by default. */
  id?: string | undefined;
  /** Only the connections on this side of the node. */
  handleType?: HandleType | undefined;
  /** Only the connections at this handle. */
  handleId?: string | null | undefined;
  onConnect?: ((connections: NodeConnection[]) => void) | undefined;
  onDisconnect?: ((connections: NodeConnection[]) => void) | undefined;
}

function missingEdgeIds(
  from: ReadonlyMap<string, NodeConnection>,
  other: ReadonlyMap<string, NodeConnection>,
): NodeConnection[] {
  return [...from.values()].filter((connection) => !other.has(connection.edgeId));
}

const NONE: ReadonlyMap<string, NodeConnection> = new Map();

/** The connections of a node (or of one side or handle of it), kept up to date. */
export function useNodeConnections(params: UseNodeConnectionsParams = {}): NodeConnection[] {
  const contextId = useNodeId();
  const nodeId = params.id ?? contextId;
  if (nodeId === null) {
    throw new Error(errorMessages.error014());
  }
  const connections = useStore((state) =>
    state.connectionLookup.get(connectionKey(nodeId, params.handleType, params.handleId)),
  );
  const previous = useRef<ReadonlyMap<string, NodeConnection>>(NONE);
  const { onConnect, onDisconnect } = params;
  useEffect(() => {
    const current = connections ?? NONE;
    const added = missingEdgeIds(current, previous.current);
    const removed = missingEdgeIds(previous.current, current);
    previous.current = current;
    if (added.length > 0) {
      onConnect?.(added);
    }
    if (removed.length > 0) {
      onDisconnect?.(removed);
    }
  }, [connections, onConnect, onDisconnect]);
  return useMemo(() => [...(connections?.values() ?? [])], [connections]);
}

export interface UseHandleConnectionsParams {
  type: HandleType;
  id?: string | null | undefined;
  nodeId?: string | undefined;
  onConnect?: ((connections: NodeConnection[]) => void) | undefined;
  onDisconnect?: ((connections: NodeConnection[]) => void) | undefined;
}

/** @deprecated Use `useNodeConnections`. */
export function useHandleConnections(params: UseHandleConnectionsParams): NodeConnection[] {
  return useNodeConnections({
    id: params.nodeId,
    handleType: params.type,
    handleId: params.id ?? null,
    onConnect: params.onConnect,
    onDisconnect: params.onDisconnect,
  });
}
