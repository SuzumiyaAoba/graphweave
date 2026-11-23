import { zoomAtDoubleClick } from "./double-click-zoom.ts";
import type { PaneDeps } from "./pane-types.ts";

// As d3-zoom (and so React Flow) tells a double tap: a touch that starts within half a second of the
// touch before it, and lifts within 10 px of where that one went down.
const TAP_DELAY = 500;
const TAP_DISTANCE = 10;

/** What a pane remembers of the touches it took, to tell a double tap. */
export interface Taps {
  /** Pending while a touch that starts now is the second of a double tap. */
  window: ReturnType<typeof setTimeout> | undefined;
  /** Where on the page the touch that opened the window went down. */
  first: { x: number; y: number };
  /** Whether a double tap has just been taken: the touch event that ends it is then cancelled. */
  taken: boolean;
}

export function createTaps(): Taps {
  return { window: undefined, first: { x: 0, y: 0 }, taken: false };
}

function closeWindow(taps: Taps): void {
  clearTimeout(taps.window);
  taps.window = undefined;
}

/**
 * A gesture starts with the fingers the pane takes; `down` is the finger that went down last. Gives
 * the taps the gesture makes, as d3-zoom counts them: 2 for the second touch of a double tap, 1 for
 * one that may be the first, 0 for a gesture of two fingers.
 */
export function tapsOfStart(taps: Taps, down: MouseEvent, fingers: number): number {
  const count = fingers > 1 ? 0 : 1 + Number(taps.window !== undefined);
  closeWindow(taps);
  if (count < 2) {
    taps.first = { x: down.clientX, y: down.clientY };
    taps.window = setTimeout(() => {
      taps.window = undefined;
    }, TAP_DELAY);
  }
  return count;
}

/** Another finger the pane takes goes down: what starts next is no second touch. */
export function tapJoined(taps: Taps): void {
  closeWindow(taps);
}

/**
 * The gesture of `count` taps is over: a double tap that lifts near where it began zooms in as a
 * double click does, unless a box is being drawn or a connection made by then.
 */
export function tapEnded(
  deps: PaneDeps,
  taps: Taps,
  end: { count: number; up: PointerEvent },
): void {
  const { count, up } = end;
  const near = Math.hypot(taps.first.x - up.clientX, taps.first.y - up.clientY) < TAP_DISTANCE;
  const { userSelectionActive, connection } = deps.store.getState();
  // A finger that the browser took back (`pointercancel`) taps nothing.
  const lifted = up.type === "pointerup";
  const free = !userSelectionActive && !connection.inProgress;
  if (count === 2 && near && lifted && free && deps.view.getState().zoomOnDoubleClick) {
    taps.taken = true;
    zoomAtDoubleClick(deps, up);
  }
}

/**
 * Cancels the touch event that ends a double tap that was taken, so that the browser makes no click
 * (nor double click) of it, as d3-zoom does. Returns the function that stops listening.
 */
export function cancelTakenTaps(element: HTMLElement, taps: Taps): () => void {
  const onEnd = (event: Event): void => {
    if (taps.taken) {
      taps.taken = false;
      event.preventDefault();
    }
  };
  element.addEventListener("touchend", onEnd);
  return (): void => {
    element.removeEventListener("touchend", onEnd);
    closeWindow(taps);
  };
}
