import { calcAutoPan, currentViewport } from "@graphweave/core";

import { moveConnectionTo } from "./connection-move.ts";
import { clientToCanvas } from "./coords.ts";
import { noop } from "./noop.ts";
import type { ReactFlowStore } from "./store-context.ts";
import { settleViewportChange } from "./viewport-events.ts";

/** The pointer of a drag, which the caller keeps up to date. */
export interface LatestPointer {
  current: PointerEvent;
}

// Scrolls the canvas one step towards where the pointer is near its edge; true when it moved.
function scrollTowards(store: ReactFlowStore, pointer: PointerEvent): boolean {
  const state = store.getState();
  const point = clientToCanvas(store, { x: pointer.clientX, y: pointer.clientY });
  const velocity = calcAutoPan(
    point,
    { width: state.width, height: state.height },
    state.autoPanSpeed,
  );
  if (velocity.x === 0 && velocity.y === 0) {
    return false;
  }
  const viewport = currentViewport(state);
  return state.setViewport({
    x: viewport.x + velocity.x,
    y: viewport.y + velocity.y,
    zoom: viewport.zoom,
  });
}

/**
 * Scrolls the canvas, one frame at a time, towards where the pointer is while it is near the edge,
 * for as long as `keepGoing` says so; `onScrolled` hears of each step. As in React Flow nothing
 * scrolls before the pointer has moved; from then on the first step is taken at once, and not at the
 * next frame. Returns a function that stops it.
 */
export function autoScrollWhile(
  store: ReactFlowStore,
  latest: LatestPointer,
  hooks: { keepGoing: () => boolean; onScrolled: () => void },
): () => void {
  let frame = 0;
  const step = (): void => {
    // As in React Flow nothing scrolls before the pointer has moved: a drag that began at the press
    // (no threshold) scrolls from its first move on.
    if (latest.current.type === "pointerdown") {
      return;
    }
    const scrolled = scrollTowards(store, latest.current);
    // As in React Flow the move of the canvas is told before what follows it is.
    settleViewportChange(store);
    if (scrolled) {
      hooks.onScrolled();
    }
  };
  const tick = (): void => {
    // The loop ends with the gesture, however that came about.
    if (!hooks.keepGoing()) {
      return;
    }
    step();
    frame = requestAnimationFrame(tick);
  };
  if (hooks.keepGoing()) {
    step();
  }
  frame = requestAnimationFrame(tick);
  return () => {
    cancelAnimationFrame(frame);
  };
}

/**
 * While a connection is dragged (`autoPanOnConnect`), scrolls the canvas when the pointer is near
 * its edge, so that a handle that is out of view can be reached. The end of the connection follows
 * the pointer across what is scrolled in. Returns a function that stops it.
 */
export function followConnectionPointer(store: ReactFlowStore, latest: LatestPointer): () => void {
  if (!store.getState().autoPanOnConnect) {
    return noop;
  }
  return autoScrollWhile(store, latest, {
    keepGoing: () => store.getState().connection.inProgress,
    onScrolled: () => {
      moveConnectionTo(store, latest.current);
    },
  });
}
