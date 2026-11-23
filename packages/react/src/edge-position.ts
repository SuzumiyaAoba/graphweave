import { ConnectionMode, Position, getHandlePosition, handlesOf } from "@free-flow/core";
import type { HandleBound, HandleType, InternalNode } from "@free-flow/core";

import type { Edge, Node } from "./types.ts";

export interface EdgeEndpoints {
  sourceX: number;
  sourceY: number;
  sourcePosition: Position;
  targetX: number;
  targetY: number;
  targetPosition: Position;
  /** The ids of the handles the edge really attaches to (the first one when it names none). */
  sourceHandleId: string | null;
  targetHandleId: string | null;
}

interface HandleRef {
  type: HandleType;
  id: string | null | undefined;
}

// Where the end of an edge looks for its handle, as React Flow does: the start only among the source
// handles; the end among the target handles, and in loose mode the source handles after them.
function handlesToLookIn(
  node: InternalNode<Node>,
  type: HandleType,
  mode: ConnectionMode,
): HandleBound[] {
  if (type === "source") {
    return handlesOf(node, "source");
  }
  return mode === ConnectionMode.Strict
    ? handlesOf(node, "target")
    : [...handlesOf(node, "target"), ...handlesOf(node, "source")];
}

// The handle an edge attaches to: the one with the edge's handle id, or the first one when the edge
// names none. A handle id that no handle has is a missing handle (also on a node with just one
// handle), as in React Flow.
function handleFor(
  node: InternalNode<Node>,
  ref: HandleRef,
  mode: ConnectionMode,
): HandleBound | undefined {
  const handles = handlesToLookIn(node, ref.type, mode);
  if (ref.id === null || ref.id === undefined || ref.id === "") {
    return handles[0];
  }
  return handles.find((handle) => handle.id === ref.id);
}

export type EdgeEndpointsResult =
  | { status: "ready"; endpoints: EdgeEndpoints }
  | { status: "unmeasured" }
  | { status: "missing-handle"; side: HandleType };

interface EdgeNodes {
  source: InternalNode<Node>;
  target: InternalNode<Node>;
}

interface EdgeHandles {
  from: HandleBound;
  to: HandleBound;
}

function endpointsOf(nodes: EdgeNodes, handles: EdgeHandles): EdgeEndpoints {
  const start = getHandlePosition(nodes.source, handles.from, {
    fallback: nodes.source.sourcePosition ?? Position.Bottom,
  });
  const end = getHandlePosition(nodes.target, handles.to, {
    fallback: nodes.target.targetPosition ?? Position.Top,
  });
  return {
    sourceX: start.x,
    sourceY: start.y,
    sourcePosition: handles.from.position,
    targetX: end.x,
    targetY: end.y,
    targetPosition: handles.to.position,
    sourceHandleId: handles.from.id,
    targetHandleId: handles.to.id,
  };
}

/**
 * Where an edge starts and ends. `unmeasured` means a node has not reported its handles yet, so
 * the edge waits; `missing-handle` means the edge names a handle the node does not have.
 */
export function getEdgeEndpoints(
  edge: Edge,
  nodes: EdgeNodes,
  mode: ConnectionMode,
): EdgeEndpointsResult {
  if (
    nodes.source.internals.handleBounds === undefined ||
    nodes.target.internals.handleBounds === undefined
  ) {
    return { status: "unmeasured" };
  }
  const from = handleFor(nodes.source, { type: "source", id: edge.sourceHandle }, mode);
  const to = handleFor(nodes.target, { type: "target", id: edge.targetHandle }, mode);
  if (from === undefined || to === undefined) {
    return { status: "missing-handle", side: from === undefined ? "source" : "target" };
  }
  return { status: "ready", endpoints: endpointsOf(nodes, { from, to }) };
}
