const INPUT_TAGS = new Set(["INPUT", "SELECT", "TEXTAREA"]);

/** Whether an event came from a control the user types into, where shortcuts must stay out of the way. */
export function isInputDOMNode(event: Pick<Event, "target" | "composedPath">): boolean {
  // The first element on the path, as React Flow reads it: inside a shadow root, `target` is the host.
  const target = event.composedPath().at(0) ?? event.target;
  // Any element counts, as with React Flow: an SVG element inside a `.nokey` keeps its keys too.
  if (!(target instanceof Element)) {
    return false;
  }
  const editable = target instanceof HTMLElement && target.isContentEditable;
  return INPUT_TAGS.has(target.nodeName) || editable || target.closest(".nokey") !== null;
}

/** Whether `element` or one of its ancestors up to `boundary` has the class `className`. */
export function hasClassUpTo(
  element: EventTarget | null,
  className: string,
  boundary: Element,
): boolean {
  if (!(element instanceof Element)) {
    return false;
  }
  const match = element.closest(`.${className}`);
  return match !== null && boundary.contains(match);
}

/**
 * Whether `target` or any of its ancestors on the page has the class `className`, as React Flow's
 * `isWrappedWithClass` tells it for `noPanClassName` and `noWheelClassName`: beyond the flow too, so
 * that a flow inside a node that can be dragged does not pan, and the outer node is dragged instead.
 */
export function isWrappedWithClass(target: EventTarget | null, className: string): boolean {
  return target instanceof Element && target.closest(`.${className}`) !== null;
}
