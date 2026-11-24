import type { ChangeMiddleware, EdgeChange, NodeChange } from "@graphweave/core";
import { useEffect, useRef } from "react";

import type { Edge, Node } from "./types.ts";
import { useStoreApi } from "./use-store.ts";

/**
 * Lets a component look at (and rewrite or drop) node changes before they are applied and reported
 * to `onNodesChange`. As in React Flow it sees the nodes being moved (by dragging or with the arrow
 * keys) and what the instance is asked to do to the nodes (`setNodes`, `addNodes`, `updateNode`…),
 * not selecting, removing, measuring or resizing. It stays registered while the component is mounted.
 */
function useNodeChangeMiddleware(middleware: ChangeMiddleware<NodeChange<Node>>): void {
  const store = useStoreApi();
  // Always call the latest function, without re-registering when its identity changes.
  const latest = useRef(middleware);
  useEffect(() => {
    latest.current = middleware;
  }, [middleware]);
  useEffect(
    () => store.getState().addNodeChangeMiddleware((changes) => latest.current(changes)),
    [store],
  );
}

/**
 * The same for edge changes and `onEdgesChange`, but it sees every batch of edge changes that is
 * reported. React Flow keeps such middleware without ever running it, a defect GraphWeave does not copy.
 */
function useEdgeChangeMiddleware(middleware: ChangeMiddleware<EdgeChange<Edge>>): void {
  const store = useStoreApi();
  const latest = useRef(middleware);
  useEffect(() => {
    latest.current = middleware;
  }, [middleware]);
  useEffect(
    () => store.getState().addEdgeChangeMiddleware((changes) => latest.current(changes)),
    [store],
  );
}

// React Flow's names for these hooks; the lint rule for hooks only knows names that start with `use`.
export const experimental_useOnNodesChangeMiddleware = useNodeChangeMiddleware;
export const experimental_useOnEdgesChangeMiddleware = useEdgeChangeMiddleware;
