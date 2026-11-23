import { queueMeasurement } from "./measure-queue.ts";
import { measureNode } from "./measure.ts";
import type { ReactFlowStore } from "./store-context.ts";
import type { InternalNodeUpdate } from "./view-mirror.ts";

/** React Flow's `updateNodeInternals` of the store: measures these nodes again, and fits the view. */
export function updateNodeInternalsOf(
  store: ReactFlowStore,
): (updates: Map<string, InternalNodeUpdate>, params?: { triggerFitView: boolean }) => void {
  return (updates, params) => {
    const { zoom } = store.getState().viewport;
    for (const update of updates.values()) {
      queueMeasurement(store, measureNode(update.nodeElement, zoom));
    }
    if (params?.triggerFitView === true) {
      store.getState().fitView(store.getState().fitViewOptions);
    }
  };
}
