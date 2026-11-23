import { useCallback, useSyncExternalStore } from "react";

import type { ReactFlowStore } from "./store-context.ts";

// The node whose drag is going on, which is the only one to be told it is being dragged: React Flow
// keeps that in the pressed node's own state, so the nodes that are taken along have no `dragging`
// class (their `dragging` field is set by the position changes, which is another thing).
const draggedNode = new WeakMap<ReactFlowStore, string | undefined>();
const listeners = new WeakMap<ReactFlowStore, Set<() => void>>();

/** Notes which node of this flow is being dragged by its own press, or none (`undefined`). */
export function setDraggedNode(store: ReactFlowStore, id: string | undefined): void {
  draggedNode.set(store, id);
  for (const listener of listeners.get(store) ?? []) {
    listener();
  }
}

/** Whether this node is the one being dragged by its own press. */
export function useNodeDragging(store: ReactFlowStore, id: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const set = listeners.get(store) ?? new Set<() => void>();
      set.add(onChange);
      listeners.set(store, set);
      return (): void => {
        set.delete(onChange);
      };
    },
    [store],
  );
  return useSyncExternalStore(
    subscribe,
    (): boolean => draggedNode.get(store) === id,
    (): boolean => false,
  );
}
