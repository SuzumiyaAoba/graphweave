/** What a press on the pane is, as far as panning goes: a React event, or the page's own. */
export interface PaneDown {
  target: EventTarget | null;
  pointerType: string;
  button: number;
  ctrlKey: boolean;
  nativeEvent: PointerEvent;
}

/** A press the page told, for what React does not bring to the pane. */
export function downOf(event: PointerEvent): PaneDown {
  return {
    target: event.target,
    pointerType: event.pointerType,
    button: event.button,
    ctrlKey: event.ctrlKey,
    nativeEvent: event,
  };
}

/**
 * Whether `target` was drawn by ViewportPortal: inside the pane on the page, but rendered (in React)
 * from outside of it, so that React brings its events to the pane only when the portal sits in it.
 */
export function inViewportPortal(target: EventTarget | null, pane: Element): boolean {
  if (!(target instanceof Element)) {
    return false;
  }
  const portal = target.closest(".react-flow__viewport-portal");
  return portal !== null && pane.contains(portal);
}

/**
 * Whether `target` is on the page inside the renderer, where React Flow's d3-zoom listens: what a
 * node draws into the body of the page (a popover, through a portal) is not, though React brings
 * its events to the pane.
 */
export function onRenderer(target: EventTarget | null, pane: Element): boolean {
  const renderer = pane.closest(".react-flow__renderer") ?? pane;
  return target instanceof Element && renderer.contains(target);
}

/** What the pane does with the events of what ViewportPortal draws. */
export interface PortalHandlers {
  down: (event: PointerEvent) => void;
  doubleClick: (event: MouseEvent) => void;
}

/**
 * Takes the presses and double clicks on what ViewportPortal draws from the page, as React Flow's
 * d3-zoom does (React does not bring them to the pane). Returns the function that stops listening.
 */
export function listenToPortal(element: HTMLElement, handlers: PortalHandlers): () => void {
  const onDown = (event: PointerEvent): void => {
    if (inViewportPortal(event.target, element)) {
      handlers.down(event);
    }
  };
  const onDoubleClick = (event: MouseEvent): void => {
    if (inViewportPortal(event.target, element)) {
      handlers.doubleClick(event);
    }
  };
  element.addEventListener("pointerdown", onDown);
  element.addEventListener("dblclick", onDoubleClick);
  return (): void => {
    element.removeEventListener("pointerdown", onDown);
    element.removeEventListener("dblclick", onDoubleClick);
  };
}
