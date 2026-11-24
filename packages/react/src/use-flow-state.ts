import { applyEdgeChanges, applyNodeChanges } from "@graphweave/core";
import type { EdgeChange, NodeChange } from "@graphweave/core";
import { useCallback, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

import type { Edge, Node } from "./types.ts";

/**
 * State for a controlled flow's nodes: the nodes, a setter, and the `onNodesChange` handler that
 * applies the changes the flow reports.
 */
export function useNodesState<TNode extends Node = Node>(
  initialNodes: TNode[] | (() => TNode[]),
): [TNode[], Dispatch<SetStateAction<TNode[]>>, (changes: NodeChange<TNode>[]) => void] {
  const [nodes, setNodes] = useState(initialNodes);
  const onNodesChange = useCallback((changes: NodeChange<TNode>[]) => {
    setNodes((current) => applyNodeChanges(changes, current));
  }, []);
  return [nodes, setNodes, onNodesChange];
}

/** The same for edges: the edges, a setter, and an `onEdgesChange` handler. */
export function useEdgesState<TEdge extends Edge = Edge>(
  initialEdges: TEdge[] | (() => TEdge[]),
): [TEdge[], Dispatch<SetStateAction<TEdge[]>>, (changes: EdgeChange<TEdge>[]) => void] {
  const [edges, setEdges] = useState(initialEdges);
  const onEdgesChange = useCallback((changes: EdgeChange<TEdge>[]) => {
    setEdges((current) => applyEdgeChanges(changes, current));
  }, []);
  return [edges, setEdges, onEdgesChange];
}
