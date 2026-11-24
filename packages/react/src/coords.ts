import { screenToFlow } from "@graphweave/core";
import type { Point, XYPosition } from "@graphweave/core";

import { getFlowElement } from "./dom-registry.ts";
import type { ReactFlowStore } from "./store-context.ts";

/** A pointer position on the page, relative to the top-left corner of the canvas. */
export function clientToCanvas(store: ReactFlowStore, client: Point): XYPosition {
  const rect = getFlowElement(store)?.getBoundingClientRect();
  return { x: client.x - (rect?.left ?? 0), y: client.y - (rect?.top ?? 0) };
}

/** Where a pointer event happened, relative to the canvas. */
export function eventToCanvas(
  store: ReactFlowStore,
  event: { clientX: number; clientY: number },
): XYPosition {
  return clientToCanvas(store, { x: event.clientX, y: event.clientY });
}

/** A pointer position on the page, in flow coordinates. */
export function clientToFlow(store: ReactFlowStore, client: Point): XYPosition {
  return screenToFlow(store.getState().viewport, clientToCanvas(store, client));
}
