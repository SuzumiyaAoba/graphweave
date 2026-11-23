import type { NodeDimensionUpdate } from "@free-flow/core";

import type { ReactFlowStore } from "./store-context.ts";

const pending = new WeakMap<ReactFlowStore, Map<string, NodeDimensionUpdate>>();

/**
 * Hands a node's measurement to the store, together with every other one made in the same tick.
 * Mounting a thousand nodes measures a thousand nodes; one update for all of them costs one pass over
 * the flow instead of a thousand. The microtask runs before the browser paints, so nothing flashes.
 */
export function queueMeasurement(store: ReactFlowStore, update: NodeDimensionUpdate): void {
  const existing = pending.get(store);
  if (existing !== undefined) {
    existing.set(update.id, update);
    return;
  }
  pending.set(store, new Map([[update.id, update]]));
  queueMicrotask(() => {
    const batch = pending.get(store);
    pending.delete(store);
    if (batch !== undefined) {
      store.getState().updateNodeDimensions([...batch.values()]);
    }
  });
}
