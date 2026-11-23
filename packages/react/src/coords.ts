import { screenToFlow } from "@free-flow/core";
import type { Point, XYPosition } from "@free-flow/core";

import { getFlowElement } from "./dom-registry.ts";
import type { ReactFlowStore } from "./store-context.ts";

/** A pointer position on the page, relative to the top-left corner of the canvas. */
export function clientToCanvas(store: ReactFlowStore, client: Point): XYPosition {
  const rect = getFlowElement(store)?.getBoundingClientRect();
  return { x: client.x - (rect?.left ?? 0), y: client.y - (rect?.top ?? 0) };
}

/** A pointer position on the page, in flow coordinates. */
export function clientToFlow(store: ReactFlowStore, client: Point): XYPosition {
  return screenToFlow(store.getState().viewport, clientToCanvas(store, client));
}
