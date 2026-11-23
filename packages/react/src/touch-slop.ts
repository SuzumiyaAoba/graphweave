/**
 * Whether the page is told touch events at all. Where it is, a browser holds the touch moves of a
 * finger back while it stays within the slop of a tap; where it is not, nothing is held back.
 */
export function touchEventsTold(view: Window = globalThis.window): boolean {
  return "ontouchstart" in view;
}

/**
 * Calls `onMove` for every touch move the page hears: which fingers it tells as moved is what a
 * gesture driven by touch events hears of them (a finger within the slop of a tap is not told).
 * Returns what stops listening.
 */
export function watchTouchMoves(
  onMove: (event: TouchEvent) => void,
  view: Window = globalThis.window,
): () => void {
  const options = { capture: true, passive: true };
  view.addEventListener("touchmove", onMove, options);
  return (): void => {
    view.removeEventListener("touchmove", onMove, options);
  };
}

// How far apart, in pixels, a pointer event and a touch of the same finger may say it is.
const SAME_PLACE = 1;

/** Whether `event` tells of a moved finger at the place of `pointer`. */
export function tellsMoveAt(
  event: TouchEvent,
  pointer: { clientX: number; clientY: number },
): boolean {
  return [...event.changedTouches].some(
    (touch) =>
      Math.abs(touch.clientX - pointer.clientX) < SAME_PLACE &&
      Math.abs(touch.clientY - pointer.clientY) < SAME_PLACE,
  );
}
