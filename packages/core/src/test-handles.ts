import { startConnection, updateConnection } from "./connection.ts";
import type { HandleBound, InternalNode } from "./flow-state.ts";
import type { FlowStore } from "./flow-store-types.ts";
import { createFlowStore } from "./flow-store.ts";
import type { FlowStoreOptions } from "./flow-store.ts";
import { makeNode } from "./test-fixtures.ts";
import type { EdgeBase, HandleType, NodeBase } from "./types.ts";

const SOURCE_X = 96;
const TARGET_X = -4;
const SIBLING_X = 300;
const ROW_Y = 200;

export type FlowOptions = FlowStoreOptions<NodeBase, EdgeBase>;

/** A 100 x 50 node at `at`. */
export function box(
  id: string,
  at: [x: number, y: number],
  extra: Partial<NodeBase> = {},
): NodeBase {
  return makeNode(id, { position: { x: at[0], y: at[1] }, width: 100, height: 50, ...extra });
}

/** An 8 x 8 handle in the middle of a node's right side (source) or left side (target). */
export function handle(type: HandleType, extra: Partial<HandleBound> = {}): HandleBound {
  const right = type === "source";
  return {
    id: null,
    type,
    position: right ? "right" : "left",
    x: right ? SOURCE_X : TARGET_X,
    y: 21,
    width: 8,
    height: 8,
    ...extra,
  };
}

/**
 * Three nodes whose handles have been measured: `a` and `b` side by side (a at the origin, b 300 to
 * its right) and `c` below `b`. Each has a source handle on its right and a target on its left.
 */
export function connectableFlow(
  options: FlowOptions = {},
  handleExtra: Partial<HandleBound> = {},
): FlowStore {
  const store = createFlowStore<NodeBase, EdgeBase>({
    nodes: [box("a", [0, 0]), box("b", [SIBLING_X, 0]), box("c", [SIBLING_X, ROW_Y])],
    ...options,
  });
  const bounds = {
    source: [handle("source", handleExtra)],
    target: [handle("target", handleExtra)],
  };
  store
    .getState()
    .updateNodeDimensions(
      ["a", "b", "c"].map((id) => ({ id, width: 100, height: 50, handleBounds: bounds })),
    );
  return store;
}

/** The internal node `id`; the test fails loudly if it is missing. */
export function internalNodeOf(store: FlowStore, id: string): InternalNode {
  const found = store.getState().nodeLookup.get(id);
  if (found === undefined) {
    throw new Error(`no node ${id}`);
  }
  return found;
}

/** A drag that starts on the source handle of `a`. */
export const FROM_A = {
  nodeId: "a",
  handleId: null,
  handleType: "source",
  point: { x: 100, y: 25 },
} as const;

/** Starts a connection from `a`'s source handle and drags it to `point`. */
export function dragOnto(store: FlowStore, point: { x: number; y: number }): void {
  startConnection(store, FROM_A);
  updateConnection(store, point);
}
