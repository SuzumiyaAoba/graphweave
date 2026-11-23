import { useLayoutEffect, useRef } from "react";
import type { RefObject } from "react";

import { queueMeasurement } from "./measure-queue.ts";
import { measureNode } from "./measure.ts";
import type { ReactFlowStore } from "./store-context.ts";

/**
 * Measures a node again when what it is made of changes: its type, or the side its handles are on.
 * As in React Flow, which does so at once and not when the node's box is next seen to change (its
 * handles may be elsewhere in a box of the same size).
 */
export function useRemeasureOnShape(
  store: ReactFlowStore,
  ref: RefObject<HTMLElement | null>,
  shape: string,
): void {
  const measured = useRef(shape);
  useLayoutEffect(() => {
    const element = ref.current;
    if (element !== null && measured.current !== shape) {
      measured.current = shape;
      queueMeasurement(store, measureNode(element, store.getState().viewport.zoom));
    }
  }, [ref, shape, store]);
}
