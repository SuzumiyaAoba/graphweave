import { tellsMoveAt, touchEventsTold, watchTouchMoves } from "./touch-slop.ts";

function follow(
  accepts: (event: PointerEvent) => boolean,
  onMove: (event: PointerEvent) => void,
  onEnd: (event: PointerEvent) => void,
): () => void {
  const listening = new AbortController();
  const options = { capture: true, signal: listening.signal };
  const move = (event: PointerEvent): void => {
    if (accepts(event)) {
      onMove(event);
    }
  };
  const release = (event: PointerEvent): void => {
    if (accepts(event)) {
      listening.abort();
      onEnd(event);
    }
  };
  globalThis.addEventListener("pointermove", move, options);
  globalThis.addEventListener("pointerup", release, options);
  globalThis.addEventListener("pointercancel", release, options);
  return () => {
    listening.abort();
  };
}

// A finger's moves are told once a touch event tells of them, as React Flow's gestures hear a finger
// only by touch events: a finger within the slop of a tap is not told, nor one that stays where it
// was told last while another finger moves. A move that no touch event tells is not told at all.
function heldBack(onMove: (event: PointerEvent) => void): {
  move: (event: PointerEvent) => void;
  stop: () => void;
} {
  let waiting: PointerEvent | undefined = undefined;
  let lastTouch: TouchEvent | undefined = undefined;
  const tell = (event: PointerEvent): void => {
    waiting = undefined;
    onMove(event);
  };
  const stop = watchTouchMoves((touch) => {
    lastTouch = touch;
    if (waiting !== undefined && tellsMoveAt(touch, waiting)) {
      tell(waiting);
    }
  });
  return {
    move: (event) => {
      // A touch event that came first, and already told of this place.
      if (lastTouch !== undefined && tellsMoveAt(lastTouch, event)) {
        lastTouch = undefined;
        tell(event);
      } else {
        waiting = event;
      }
    },
    stop,
  };
}

/**
 * Follows the pointer that pressed (`down`) on the window from now until it is released (or the
 * gesture is cancelled), then calls `onEnd` once. Used for every drag, since the pointer leaves the
 * element that was pressed. Another finger on the screen is not this gesture's: only the pressed
 * pointer moves or ends it, as d3-drag follows a touch by its identifier. A press that says it is a
 * finger (`pointerType`) is told only of the moves that touch events tell.
 *
 * Returns a function that stops following the pointer, for when what is dragged goes away: neither
 * `onMove` nor `onEnd` is called after it.
 */
export function trackPointer(
  down: Pick<PointerEvent, "pointerId"> & { pointerType?: string },
  onMove: (event: PointerEvent) => void,
  onEnd: (event: PointerEvent) => void,
): () => void {
  const accepts = (event: PointerEvent): boolean => event.pointerId === down.pointerId;
  if (down.pointerType !== "touch" || !touchEventsTold()) {
    return follow(accepts, onMove, onEnd);
  }
  const finger = heldBack(onMove);
  const unfollow = follow(accepts, finger.move, (event) => {
    finger.stop();
    onEnd(event);
  });
  return (): void => {
    finger.stop();
    unfollow();
  };
}
