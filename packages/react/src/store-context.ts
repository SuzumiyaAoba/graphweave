import type { FlowStoreState, Store } from "@free-flow/core";
import { createContext } from "react";

import type { Edge, Node } from "./types.ts";
import type { ViewMirror } from "./view-mirror.ts";

/**
 * Everything the flow's store holds, with the React-level node and edge types: the flow's own
 * state, and what the React layer mirrors into it as React Flow's single store has it.
 */
export type ReactFlowState<TNode extends Node = Node, TEdge extends Edge = Edge> = FlowStoreState<
  TNode,
  TEdge
> &
  ViewMirror;

export type ReactFlowStore<TNode extends Node = Node, TEdge extends Edge = Edge> = Store<
  ReactFlowState<TNode, TEdge>
>;

/** The store of the nearest `<ReactFlow>` or `<ReactFlowProvider>`. */
export const StoreContext = createContext<ReactFlowStore | null>(null);

/** The id of the node whose component is being rendered; `null` outside of one. */
export const NodeIdContext = createContext<string | null>(null);
