import type { Viewport } from "@free-flow/core";
import { useEffect } from "react";

import type { SelectionChange } from "./selection-listener.tsx";
import type { Edge, Node } from "./types.ts";
import { useStoreApi } from "./use-store.ts";
import { addViewportGestureHandlers } from "./viewport-events.ts";

export type { SelectionChange } from "./selection-listener.tsx";

export interface UseOnViewportChangeOptions {
  /** A pan or zoom gesture began. */
  onStart?: ((viewport: Viewport) => void) | undefined;
  /** The viewport changed, by a gesture or by calling a method. */
  onChange?: ((viewport: Viewport) => void) | undefined;
  /** A pan or zoom gesture ended. */
  onEnd?: ((viewport: Viewport) => void) | undefined;
}

/** Runs callbacks when the viewport moves. */
export function useOnViewportChange({
  onStart,
  onChange,
  onEnd,
}: UseOnViewportChangeOptions): void {
  const store = useStoreApi();
  useEffect(
    () => addViewportGestureHandlers(store, { onStart, onChange, onEnd }),
    [store, onStart, onChange, onEnd],
  );
}

export interface UseOnSelectionChangeOptions<TNode extends Node = Node, TEdge extends Edge = Edge> {
  onChange: (selection: SelectionChange<TNode, TEdge>) => void;
}

/**
 * Runs a callback with the selected nodes and edges whenever the selection changes. It is set on the
 * store, and called by the listener of the flow (also once when that is mounted), as React Flow's is.
 */
export function useOnSelectionChange<TNode extends Node = Node, TEdge extends Edge = Edge>(
  options: UseOnSelectionChangeOptions<TNode, TEdge>,
): void;
export function useOnSelectionChange({ onChange }: UseOnSelectionChangeOptions): void {
  const store = useStoreApi();
  useEffect(() => {
    store.setState((state) => ({
      onSelectionChangeHandlers: [...state.onSelectionChangeHandlers, onChange],
    }));
    return (): void => {
      store.setState((state) => ({
        onSelectionChangeHandlers: state.onSelectionChangeHandlers.filter(
          (handler) => handler !== onChange,
        ),
      }));
    };
  }, [store, onChange]);
}
