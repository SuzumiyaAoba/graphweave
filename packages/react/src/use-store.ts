import { useCallback, useContext } from "react";
import { useSyncExternalStoreWithSelector } from "use-sync-external-store/with-selector";

import { StoreContext } from "./store-context.ts";
import type { ReactFlowState, ReactFlowStore } from "./store-context.ts";
import type { Edge, Node } from "./types.ts";

const MISSING_PROVIDER =
  "GraphWeave: this hook has to be used inside <ReactFlow> or <ReactFlowProvider>.";

/** The flow's store: `getState`, `setState` and `subscribe`. Does not re-render on changes. */
export function useStoreApi<TNode extends Node = Node, TEdge extends Edge = Edge>(): ReactFlowStore<
  TNode,
  TEdge
>;
export function useStoreApi(): ReactFlowStore {
  const store = useContext(StoreContext);
  if (store === null) {
    throw new Error(MISSING_PROVIDER);
  }
  return store;
}

/**
 * Reads a slice of the store and re-renders only when that slice changes, compared with
 * `equalityFn` (`Object.is` by default).
 */
export function useStore<TSelected>(
  selector: (state: ReactFlowState) => TSelected,
  equalityFn?: (a: TSelected, b: TSelected) => boolean,
): TSelected {
  const store = useStoreApi();
  const subscribe = useCallback(
    (onChange: () => void) =>
      store.subscribe(() => {
        onChange();
      }),
    [store],
  );
  return useSyncExternalStoreWithSelector(
    subscribe,
    store.getState,
    store.getState,
    selector,
    equalityFn,
  );
}
