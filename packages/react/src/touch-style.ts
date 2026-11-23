// What d3 does to the elements it listens to, on a device that has a touch screen (it asks
// `navigator.maxTouchPoints` and `ontouchstart`): an element that is dragged tells the browser not to
// take the touches for scrolling and zooming the page, and one that is panned and zoomed drops the
// highlight a tap leaves. Without that, a finger moving a node would be cancelled.

/** Whether the device has a touch screen. */
export function isTouchable(): boolean {
  return (
    (typeof navigator === "object" && navigator.maxTouchPoints > 0) || "ontouchstart" in globalThis
  );
}

/** Marks an element that is dragged for touch: the touches are its own, and a tap leaves no highlight. */
export function markDraggable(element: HTMLElement | SVGElement | null): void {
  if (element !== null && isTouchable()) {
    element.style.setProperty("touch-action", "none");
    element.style.setProperty("-webkit-tap-highlight-color", "rgba(0,0,0,0)");
  }
}

/** Marks an element that is panned and zoomed for touch: a tap on it leaves no highlight. */
export function markZoomable(element: HTMLElement | SVGElement | null): void {
  if (element !== null && isTouchable()) {
    element.style.setProperty("-webkit-tap-highlight-color", "rgba(0,0,0,0)");
  }
}
