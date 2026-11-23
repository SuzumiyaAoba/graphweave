// What d3-drag does for React Flow's drags: the click that comes right after a drag that went
// somewhere is stopped before anything sees it, so that letting go over the pane is not a click on
// the pane (which would clear the selection), whatever the drag was.
function stop(event: Event): void {
  event.stopImmediatePropagation();
  event.preventDefault();
}

/** Stops the click that follows the pointer being released after a drag that moved. */
export function swallowNextClick(): void {
  globalThis.addEventListener("click", stop, true);
  // The click is dispatched right after the pointer is released, before timers run.
  setTimeout(() => {
    globalThis.removeEventListener("click", stop, true);
  }, 0);
}

/** Stops the click after the pointer was released somewhere other than where it was pressed. */
export function swallowClickAfterMove(down: PointerEvent, up: PointerEvent): void {
  if (up.clientX !== down.clientX || up.clientY !== down.clientY) {
    swallowNextClick();
  }
}

/**
 * Stops the click that follows a connection dropped on the empty canvas: it would clear the
 * selection, which React Flow does not let a connection do.
 */
export function swallowClickOverPane(up: PointerEvent): void {
  if (up.target instanceof Element && up.target.classList.contains("react-flow__pane")) {
    swallowNextClick();
  }
}
