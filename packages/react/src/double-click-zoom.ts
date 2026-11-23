import { currentViewport } from "@free-flow/core";

import { clientToCanvas } from "./coords.ts";
import { isWrappedWithClass } from "./dom-utils.ts";
import { handled } from "./handled.ts";
import type { PaneDeps } from "./pane-types.ts";
import { runViewportChange } from "./viewport-animation.ts";

// As d3-zoom's: twice as near (half as near with Shift), in a quarter of a second.
const DOUBLE_CLICK_ZOOM_DURATION = 250;
const DOUBLE_CLICK_ZOOM_FACTOR = 2;

/**
 * Zooms about the point of a double click, or of a double tap, which d3-zoom (and so React Flow)
 * takes for a double click; `event` is what the move is told with.
 */
export function zoomAtDoubleClick(deps: Pick<PaneDeps, "store" | "view">, event: MouseEvent): void {
  const { store, view } = deps;
  const factor = event.shiftKey ? 1 / DOUBLE_CLICK_ZOOM_FACTOR : DOUBLE_CLICK_ZOOM_FACTOR;
  const point = clientToCanvas(store, { x: event.clientX, y: event.clientY });
  handled(
    runViewportChange(
      store,
      () => store.getState().zoomTo(currentViewport(store.getState()).zoom * factor, point),
      { duration: DOUBLE_CLICK_ZOOM_DURATION, pivot: point, event },
    ),
    (failure) => {
      view.getState().onError?.("102", `Zooming failed: ${String(failure)}`);
    },
  );
}

/**
 * A double click inside the pane. As with the filter React Flow gives d3-zoom, it zooms wherever a
 * press could pan the canvas (not inside `noPanClassName`, so also on a node that cannot be dragged),
 * not with Ctrl held (unless that is the key that pans), nor while a box is drawn or a connection made.
 * Unlike React Flow, which stops the event there, what was double-clicked hears it all the same.
 */
export function doubleClicked(
  deps: Pick<PaneDeps, "store" | "view" | "element">,
  event: MouseEvent,
  panKeyHeld: boolean,
): void {
  const { zoomOnDoubleClick, noPanClassName } = deps.view.getState();
  const { userSelectionActive, connection } = deps.store.getState();
  const pannable = !isWrappedWithClass(event.target, noPanClassName);
  const free = !userSelectionActive && !connection.inProgress && (!event.ctrlKey || panKeyHeld);
  if (zoomOnDoubleClick && pannable && free) {
    zoomAtDoubleClick(deps, event);
  }
}
