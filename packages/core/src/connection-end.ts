import { connectionBetween, originOf } from "./connection.ts";
import type { ConnectionRules, End } from "./connection.ts";
import type { ConnectionInProgress, ConnectionState, FinalConnectionState } from "./flow-state.ts";
import { NO_CONNECTION } from "./flow-state.ts";
import type { FlowStore, FlowStoreState } from "./flow-store-types.ts";
import { addEdge } from "./graph.ts";
import type { Connection, EdgeBase, NodeBase } from "./types.ts";

export interface ConnectionResult {
  /** The connection that was made; undefined when the drag ended anywhere else. */
  connection: Connection | undefined;
  /** What the connection looked like when the pointer was released. */
  finalState: FinalConnectionState | undefined;
}

/** A connection state as it is reported when it has ended (see `FinalConnectionState`). */
export function finalStateOf(connection: ConnectionState): FinalConnectionState {
  return {
    isValid: connection.isValid,
    from: connection.from,
    fromHandle: connection.fromHandle,
    fromPosition: connection.fromPosition,
    fromNode: connection.fromNode,
    to: connection.to,
    toHandle: connection.toHandle,
    toPosition: connection.toHandle === null ? null : connection.toPosition,
    toNode: connection.toNode,
    pointer: connection.pointer,
  };
}

const NOTHING: ConnectionResult = { connection: undefined, finalState: undefined };

// Both ends of a connection that was left on a valid handle, looked up again in the current nodes.
function resolveEnds(
  rules: ConnectionRules,
  connection: ConnectionInProgress,
): { from: End; to: End } | undefined {
  const node = rules.nodeLookup.get(connection.fromNode.id);
  const toNode =
    connection.toNode === null ? undefined : rules.nodeLookup.get(connection.toNode.id);
  if (node === undefined || toNode === undefined || connection.toHandle === null) {
    return undefined;
  }
  return {
    from: originOf(node, connection),
    to: { node: toNode, handle: connection.toHandle },
  };
}

interface Ending<TNode extends NodeBase, TEdge extends EdgeBase> {
  state: FlowStoreState<TNode, TEdge>;
  connection: ConnectionInProgress;
  /** Whether to report the connection and add the edge. */
  report: boolean;
}

function commitConnection<TNode extends NodeBase, TEdge extends EdgeBase>(
  api: FlowStore<TNode, TEdge>,
  { state, connection, report }: Ending<TNode, TEdge>,
): ConnectionResult {
  const ends = connection.isValid === true ? resolveEnds(state, connection) : undefined;
  if (ends === undefined) {
    return { connection: undefined, finalState: finalStateOf(connection) };
  }
  const made = connectionBetween(ends.from, ends.to);
  if (report) {
    state.onConnect?.(made);
    if (state.hasDefaultEdges) {
      api.getState().setEdges(addEdge<TEdge>(made, state.edges));
    }
  }
  return { connection: made, finalState: finalStateOf(connection) };
}

export interface EndConnectionOptions {
  /**
   * Report the connection through `onConnect` and add the edge (for a flow that owns its edges).
   * On by default; a caller that handles the result itself, such as an edge being reconnected, turns
   * it off.
   */
  report?: boolean | undefined;
}

/**
 * Ends the drag. Over a valid handle it reports the connection through `onConnect` and, when the
 * flow owns its edges, adds the edge; either way the in-progress state is cleared.
 */
export function endConnection<TNode extends NodeBase, TEdge extends EdgeBase>(
  api: FlowStore<TNode, TEdge>,
  options: EndConnectionOptions = {},
): ConnectionResult {
  const state = api.getState();
  const { connection } = state;
  api.setState({ connection: NO_CONNECTION });
  return connection.inProgress
    ? commitConnection(api, { state, connection, report: options.report !== false })
    : NOTHING;
}

/** Abandons the drag without making a connection. */
export function cancelConnection<TNode extends NodeBase, TEdge extends EdgeBase>(
  api: FlowStore<TNode, TEdge>,
): void {
  api.setState({ connection: NO_CONNECTION });
}
