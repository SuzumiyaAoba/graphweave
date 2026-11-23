import type { Viewport } from "@free-flow/core";
import { useLayoutEffect } from "react";

import type { ReactFlowStore } from "./store-context.ts";
import { syncHeldViewport, withoutViewportEvents } from "./viewport-events.ts";

/**
 * Hands the viewport that a controlled flow is given to the store whenever the owner passes a new
 * one. A flow whose owner passes none (`viewport` is `undefined`) moves on its own.
 */
export function useHeldViewport(store: ReactFlowStore, viewport: Viewport | undefined): void {
  const held = viewport !== undefined;
  // The owner holds the viewport for as long as it passes one: the user's own pan and zoom are only
  // reported, and the viewport moves when the owner hands a new one in.
  useLayoutEffect(() => {
    // A move that waited for the owner's answer is dropped here. The canvas never showed it, so
    // nothing has moved that could be told (d3-zoom's transform does not change either).
    withoutViewportEvents(store, () => {
      store.setState({ viewportControlled: held, pendingViewport: undefined });
    });
  }, [held, store]);
  useLayoutEffect(() => {
    // Whenever the owner hands in a viewport object (not only when its numbers change), as React Flow
    // does: a pan that went on from its own last step starts again from what the owner holds.
    if (viewport !== undefined) {
      syncHeldViewport(store, { x: viewport.x, y: viewport.y, zoom: viewport.zoom });
    }
  }, [viewport, store]);
}
