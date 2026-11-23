import { useEffect } from "react";

import type { ReactFlowState } from "./store-context.ts";
import type { Edge, Node } from "./types.ts";
import { useStore, useStoreApi } from "./use-store.ts";

/** What `onSelectionChange` is told: the nodes and edges that are selected. */
export interface SelectionChange<TNode extends Node = Node, TEdge extends Edge = Edge> {
  nodes: TNode[];
  edges: TEdge[];
}

export function selectionOf(state: ReactFlowState): SelectionChange {
  // From the lookups, as in React Flow: elements that share an id count once.
  const nodes = [...state.nodeLookup.values()].filter((node) => node.selected === true);
  return {
    nodes: nodes.map((node) => node.internals.userNode),
    edges: [...state.edgeLookup.values()].filter((edge) => edge.selected === true),
  };
}

export function sameIds(a: readonly { id: string }[], b: readonly { id: string }[]): boolean {
  return a.length === b.length && a.every((item, index) => item.id === b[index]?.id);
}

function sameSelection(a: SelectionChange, b: SelectionChange): boolean {
  return sameIds(a.nodes, b.nodes) && sameIds(a.edges, b.edges);
}

/**
 * Calls `onChange` with the selection as React Flow's listener does: once the flow is shown (with
 * whatever is selected then), whenever the set of selected nodes or edges changes, and whenever
 * `onChange` itself is a new function.
 */
export function SelectionListener({
  onChange,
}: {
  onChange?: ((selection: SelectionChange) => void) | undefined;
}): null {
  const store = useStoreApi();
  const selection = useStore(selectionOf, sameSelection);
  useEffect(() => {
    onChange?.(selection);
    // The handlers that hooks set on the store are read as they are now, as React Flow does.
    for (const handler of store.getState().onSelectionChangeHandlers) {
      handler(selection);
    }
  }, [store, selection, onChange]);
  return null;
}
