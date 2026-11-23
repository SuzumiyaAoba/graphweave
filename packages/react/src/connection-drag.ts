import type { LatestPointer } from "./connection-auto-pan.ts";
import { noop } from "./noop.ts";
import { trackPointer } from "./pointer-track.ts";
import type { ReactFlowStore } from "./store-context.ts";
import { fingerCount } from "./touch-pointers.ts";

/** What a press on a handle or an edge end does as it turns into a connection drag. */
export interface ConnectionDrag {
  /**
   * Puts the connection in progress and reports its start. Returns what stops whatever the start set
   * going (the scrolling at the edge of the canvas).
   */
  start: (latest: LatestPointer) => () => void;
  /** The pointer moved with the connection in progress. */
  move: (event: PointerEvent) => void;
  /** The pointer was released, or the gesture was cancelled; `started` says whether it ever began. */
  end: (event: PointerEvent, started: boolean) => void;
}

// Whether the pointer is more than `threshold` screen pixels from where it was pressed.
function beyond(down: PointerEvent, event: PointerEvent, threshold: number): boolean {
  const dx = event.clientX - down.clientX;
  const dy = event.clientY - down.clientY;
  return dx * dx + dy * dy > threshold * threshold;
}

// Whether the press is a finger that has company on the flow: the two pinch, and no connection begins
// meanwhile (React Flow's pane keeps the touch moves of a pinch from the handle that was pressed).
function pinches(down: PointerEvent): boolean {
  return down.pointerType === "touch" && fingerCount() > 1;
}

/**
 * Follows a press until it is released. As in React Flow, nothing begins until the pointer has moved
 * further than `connectionDragThreshold` (at once when that is `0`); a press that never gets that far
 * is a click, and `end` hears `started` false.
 */
export function dragConnection(
  store: ReactFlowStore,
  down: PointerEvent,
  drag: ConnectionDrag,
): void {
  const latest: LatestPointer = { current: down };
  let started = false;
  let stop = noop;
  const begin = (): void => {
    started = true;
    stop = drag.start(latest);
  };
  if (store.getState().connectionDragThreshold === 0) {
    begin();
  }
  trackPointer(
    down,
    (event) => {
      latest.current = event;
      if (
        !started &&
        !pinches(down) &&
        beyond(down, event, store.getState().connectionDragThreshold)
      ) {
        begin();
      }
      if (started) {
        drag.move(event);
      }
    },
    (event) => {
      stop();
      drag.end(event, started);
    },
  );
}
