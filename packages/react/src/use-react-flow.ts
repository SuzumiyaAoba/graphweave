import { useCallback, useMemo } from "react";

import { remeasureNodes } from "./dom-registry.ts";
import { createGraphInstance } from "./instance-graph.ts";
import type { FlowObject, ReactFlowInstance } from "./instance-types.ts";
import { createViewportInstance } from "./instance-viewport.ts";
import type { ReactFlowStore } from "./store-context.ts";
import type { Edge, Node } from "./types.ts";
import { useStore, useStoreApi } from "./use-store.ts";

function toObject(store: ReactFlowStore): FlowObject {
  const { nodes, edges, viewport } = store.getState();
  return {
    // A shallow copy of every element is the point: the caller may change what it gets back.
    // oxlint-disable-next-line oxc/no-map-spread
    nodes: nodes.map((node) => ({ ...node })),
    // oxlint-disable-next-line oxc/no-map-spread
    edges: edges.map((edge) => ({ ...edge })),
    viewport: { ...viewport },
  };
}

/** Builds the instance for a store. It does not re-render on its own; see `useReactFlow`. */
export function createReactFlowInstance(
  store: ReactFlowStore,
  viewportInitialized: boolean,
): ReactFlowInstance {
  return {
    ...createGraphInstance(store),
    ...createViewportInstance(store),
    toObject: () => toObject(store),
    viewportInitialized,
  };
}

/**
 * The methods for reading and changing a flow from the outside: nodes, edges, the viewport.
 * Re-renders only when `viewportInitialized` changes.
 */
export function useReactFlow<
  TNode extends Node = Node,
  TEdge extends Edge = Edge,
>(): ReactFlowInstance<TNode, TEdge> {
  const store = useStoreApi();
  // As in React Flow: once the pan and zoom of the flow are there, and no longer when it is gone.
  const viewportInitialized = useStore((state) => state.panZoom !== null);
  const instance = useMemo(
    () => createReactFlowInstance(store, viewportInitialized),
    [store, viewportInitialized],
  );
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the store holds the user's own node and edge types
  return instance as unknown as ReactFlowInstance<TNode, TEdge>;
}

/**
 * Returns a function that measures nodes again. Call it after something changed a node's size or
 * handles without React noticing, such as a handle that was added by hand.
 */
export function useUpdateNodeInternals(): (id: string | readonly string[]) => void {
  const store = useStoreApi();
  return useCallback(
    (id) => {
      remeasureNodes(store, typeof id === "string" ? [id] : id);
    },
    [store],
  );
}
