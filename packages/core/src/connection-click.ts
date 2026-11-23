import { connectionBetween, endOf, isValidConnection } from "./connection.ts";
import type { ConnectionRules } from "./connection.ts";
import type { ClickConnectionStart } from "./flow-state.ts";
import type { FlowStore } from "./flow-store-types.ts";
import type { Connection, EdgeBase, NodeBase } from "./types.ts";

export interface ClickEnds {
  from: ClickConnectionStart;
  to: ClickConnectionStart;
  /** Checked instead of the flow's `isValidConnection` (the clicked handle's own). */
  isValidConnection?: ((connection: Connection) => boolean) | undefined;
}

/**
 * The connection that two clicks on handles make, or undefined when the second handle cannot end
 * one from the first (not connectable, the wrong kind, or refused by `isValidConnection`).
 */
export function connectionByClick<TNode extends NodeBase, TEdge extends EdgeBase>(
  api: FlowStore<TNode, TEdge>,
  ends: ClickEnds,
): Connection | undefined {
  const state = api.getState();
  const rules: ConnectionRules = {
    nodeLookup: state.nodeLookup,
    connectionRadius: state.connectionRadius,
    connectionMode: state.connectionMode,
    isValidConnection: ends.isValidConnection ?? state.isValidConnection,
  };
  const from = endOf(rules, { nodeId: ends.from.nodeId, type: ends.from.type, id: ends.from.id });
  const to = endOf(rules, { nodeId: ends.to.nodeId, type: ends.to.type, id: ends.to.id });
  return from !== undefined && to !== undefined && isValidConnection(rules, from, to)
    ? connectionBetween(from, to)
    : undefined;
}
