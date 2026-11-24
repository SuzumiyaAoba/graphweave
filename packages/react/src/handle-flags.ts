import type { HandleBound, NodeDimensionUpdate } from "@graphweave/core";

import { readHandleFlags } from "./dom-registry.ts";
import type { HandleFlagsOnPage } from "./measure.ts";
import type { ReactFlowStore } from "./store-context.ts";

// A copy of the bound with the flags kept out of sight, as the measuring keeps them.
function flagged(bound: HandleBound, onPage: HandleFlagsOnPage | undefined): HandleBound {
  const copy: HandleBound = { ...bound };
  const flags = {
    isConnectable: onPage?.isConnectable,
    isConnectableStart: onPage?.isConnectableStart,
    isConnectableEnd: onPage?.isConnectableEnd,
  };
  for (const [key, value] of Object.entries(flags)) {
    Object.defineProperty(copy, key, { value, enumerable: false, writable: true });
  }
  return copy;
}

// Whether the handles on the page are, in order, the ones the node was measured with.
function sameHandles(
  onPage: readonly HandleFlagsOnPage[],
  bounds: readonly HandleBound[],
): boolean {
  return (
    onPage.length === bounds.length &&
    onPage.every((handle, index) => handle.id === bounds[index]?.id)
  );
}

// The node's bounds with the flags its handles have on the page now, the boxes as they were measured;
// undefined when the node is not measured or no longer has the handles it was measured with.
function flagUpdateOf(store: ReactFlowStore, nodeId: string): NodeDimensionUpdate | undefined {
  const internal = store.getState().nodeLookup.get(nodeId);
  const bounds = internal?.internals.handleBounds;
  const { width, height } = internal?.measured ?? {};
  const read = readHandleFlags(store, nodeId);
  if (read === undefined || bounds === undefined || width === undefined || height === undefined) {
    return undefined;
  }
  // Handles that were added, removed or put in another order wait for the next measuring.
  if (!sameHandles(read.source, bounds.source) || !sameHandles(read.target, bounds.target)) {
    return undefined;
  }
  return {
    id: nodeId,
    width,
    height,
    handleBounds: {
      source: bounds.source.map((bound, index) => flagged(bound, read.source[index])),
      target: bounds.target.map((bound, index) => flagged(bound, read.target[index])),
    },
  };
}

const pending = new WeakMap<ReactFlowStore, Set<string>>();

function flush(store: ReactFlowStore): void {
  const ids = pending.get(store) ?? new Set<string>();
  pending.delete(store);
  const updates = [...ids].flatMap((id) => flagUpdateOf(store, id) ?? []);
  if (updates.length > 0) {
    store.getState().updateNodeDimensions(updates);
  }
}

/**
 * Tells the flow what the handles of a node now say about being connected. React Flow reads that from
 * a handle's classes each time a connection asks, and keeps the boxes it measured: so the flags are
 * read from the page and put on the bounds, matched by their order (as two handles may share an id),
 * and the boxes stay as measured (measuring again at another zoom would move them by a fraction of a
 * pixel). The nodes of one tick are told together, after the measuring of that tick.
 */
export function refreshHandleFlags(store: ReactFlowStore, nodeId: string): void {
  const queued = pending.get(store);
  if (queued !== undefined) {
    queued.add(nodeId);
    return;
  }
  pending.set(store, new Set([nodeId]));
  queueMicrotask(() => {
    flush(store);
  });
}
