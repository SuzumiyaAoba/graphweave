import type { ConnectionState, InternalNode, Viewport } from "@graphweave/core";
import { useCallback, useContext } from "react";

import { NodeIdContext } from "./store-context.ts";
import type { ReactFlowState } from "./store-context.ts";
import type { Edge, Node } from "./types.ts";
import { useStore } from "./use-store.ts";

/** All nodes, in the order they were given. Re-renders on every change to any of them. */
export function useNodes<TNode extends Node = Node>(): TNode[];
export function useNodes(): Node[] {
  return useStore((state) => state.nodes);
}

/** All edges, in the order they were given. */
export function useEdges<TEdge extends Edge = Edge>(): TEdge[];
export function useEdges(): Edge[] {
  return useStore((state) => state.edges);
}

/** The current pan and zoom. */
export function useViewport(): Viewport {
  return useStore((state) => state.viewport);
}

/** The id of the node whose component is rendering; `null` outside of a node. */
export function useNodeId(): string | null {
  return useContext(NodeIdContext);
}

/** The internal node: the node plus its measured size, absolute position and handle bounds. */
export function useInternalNode<TNode extends Node = Node>(
  id: string,
): InternalNode<TNode> | undefined;
export function useInternalNode(id: string): InternalNode<Node> | undefined {
  return useStore((state) => state.nodeLookup.get(id));
}

export interface UseNodesInitializedOptions {
  /** Count hidden nodes too; they are skipped by default. */
  includeHiddenNodes?: boolean | undefined;
}

// A node has dimensions once it was measured or given a size (React Flow's `nodeHasDimensions`).
function hasDimensions(node: Node): boolean {
  return (
    (node.measured?.width ?? node.width ?? node.initialWidth) !== undefined &&
    (node.measured?.height ?? node.height ?? node.initialHeight) !== undefined
  );
}

// With hidden nodes counted every node has to have been measured, its handles included: a hidden node
// is not drawn, so it never is until it is shown.
function allInitializedWithHidden(state: ReactFlowState): boolean {
  if (state.nodeLookup.size === 0) {
    return false;
  }
  return [...state.nodeLookup.values()].every(
    (node) => node.internals.handleBounds !== undefined && hasDimensions(node.internals.userNode),
  );
}

/**
 * True once every node has been measured (a size given by the owner is not enough, and hidden nodes
 * are not waited for unless `includeHiddenNodes` is set): when layout code can start to use sizes.
 */
export function useNodesInitialized(options: UseNodesInitializedOptions = {}): boolean {
  const includeHidden = options.includeHiddenNodes === true;
  const selector = useCallback(
    (state: ReactFlowState) =>
      includeHidden ? allInitializedWithHidden(state) : state.nodesInitialized,
    [includeHidden],
  );
  return useStore(selector);
}

/** The connection being dragged, or the idle state. Pass a selector to read just a part of it. */
export function useConnection(): ConnectionState;
export function useConnection<TSelected>(
  selector: (connection: ConnectionState) => TSelected,
): TSelected;
export function useConnection<TSelected>(
  selector?: (connection: ConnectionState) => TSelected,
): ConnectionState | TSelected {
  return useStore((state) =>
    selector === undefined ? state.connection : selector(state.connection),
  );
}

/** What `useNodesData` gives of a node: its id, type and data (of each kind of node in a union). */
export type NodeDataSnapshot<TNode extends Node = Node> = TNode extends Node
  ? Pick<TNode, "id" | "type" | "data">
  : never;

function sameNodeDataSnapshot(
  a: NodeDataSnapshot | NodeDataSnapshot[] | null,
  b: NodeDataSnapshot | NodeDataSnapshot[] | null,
): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    return (
      a.length === b.length &&
      a.every((item, index) => sameNodeDataSnapshot(item, b[index] ?? null))
    );
  }
  if (a === null || b === null || Array.isArray(a) || Array.isArray(b)) {
    return a === b;
  }
  return a.id === b.id && a.type === b.type && a.data === b.data;
}

function dataOf(state: ReactFlowState, id: string): NodeDataSnapshot | null {
  const node = state.nodeLookup.get(id);
  if (node === undefined) {
    return null;
  }
  return node.type === undefined
    ? { id: node.id, data: node.data }
    : { id: node.id, type: node.type, data: node.data };
}

/**
 * The `data` of one node (or of several, in the order of `ids`). Re-renders when that data
 * changes, not when other parts of the nodes do.
 */
export function useNodesData<TNode extends Node = Node>(
  ids: string,
): NodeDataSnapshot<TNode> | null;
export function useNodesData<TNode extends Node = Node>(
  ids: readonly string[],
): NodeDataSnapshot<TNode>[];
export function useNodesData(
  ids: string | readonly string[],
): NodeDataSnapshot | NodeDataSnapshot[] | null {
  const selector = useCallback(
    (state: ReactFlowState): NodeDataSnapshot | NodeDataSnapshot[] | null =>
      typeof ids === "string" ? dataOf(state, ids) : ids.flatMap((id) => dataOf(state, id) ?? []),
    [ids],
  );
  return useStore(selector, sameNodeDataSnapshot);
}
