import {
  currentViewport,
  flowToScreen,
  getEdgesOfNodes,
  getNodesInRect,
  screenToFlow,
  selectionRectOf,
} from "@graphweave/core";
import type { Point, Rect, Viewport } from "@graphweave/core";

import { autoScrollWhile } from "./connection-auto-pan.ts";
import { eventToCanvas } from "./coords.ts";
import { asMouseEvent } from "./drag-session.ts";
import { noop } from "./noop.ts";
import { paneClicked } from "./pane-click.ts";
import type { PaneDeps } from "./pane-types.ts";
import { trackPointer } from "./pointer-track.ts";

/** One box being drawn, from the press until the pointer is released. */
interface Selection {
  deps: PaneDeps;
  /** Where the press was, a point of the flow so that it stays in place while the canvas scrolls. */
  anchor: Point;
  /** Whether the press was on the pane itself, so that releasing it unmoved is a click on it. */
  onPane: boolean;
  /** Whether the pointer has gone far enough for this to be a box and not a click. */
  inProgress: boolean;
  latest: { current: PointerEvent };
  stopScrolling: () => void;
  covered: Set<string>;
}

function toFlowBox(viewport: Viewport, box: ReturnType<typeof selectionRectOf>): Rect {
  const { zoom, x, y } = viewport;
  return {
    x: (box.x - x) / zoom,
    y: (box.y - y) / zoom,
    width: box.width / zoom,
    height: box.height / zoom,
  };
}

// Selects what the box covers, and returns the ids of the nodes. The box is in canvas pixels; nodes
// are tested in flow coordinates.
function selectWithin(selection: Selection, box: ReturnType<typeof selectionRectOf>): Set<string> {
  const { deps, covered } = selection;
  const state = deps.store.getState();
  const nodes = getNodesInRect(state.nodeLookup.values(), toFlowBox(state.viewport, box), {
    mode: deps.view.getState().selectionMode,
    elementsSelectable: state.elementsSelectable,
  });
  // As in React Flow, the selection is only told when what the box covers has changed: an owner who
  // has not handed the last change back yet is not told the same thing again.
  if (nodes.length === covered.size && nodes.every((id) => covered.has(id))) {
    return covered;
  }
  const selectable = deps.view.getState().defaultEdgeOptions.selectable ?? true;
  const edges = getEdgesOfNodes(nodes, state.edges, selectable).map(({ id }) => id);
  state.setSelection({ nodes, edges });
  return new Set(nodes);
}

// The box from where the press was to where the pointer is; what it covers is selected.
function drawBox(selection: Selection, event: PointerEvent): void {
  const { deps, anchor } = selection;
  const start = flowToScreen(currentViewport(deps.store.getState()), anchor);
  const box = selectionRectOf(start, eventToCanvas(deps.store, event));
  deps.store.setState({
    userSelectionRect: box,
    userSelectionActive: true,
    nodesSelectionActive: false,
  });
  selection.covered = selectWithin(selection, box);
}

// How far the pointer has to go from the press before this is a box: any distance with the
// selection key held, `paneClickDistance` otherwise.
function farEnough(selection: Selection, event: PointerEvent): boolean {
  const { deps, anchor } = selection;
  const start = flowToScreen(currentViewport(deps.store.getState()), anchor);
  const point = eventToCanvas(deps.store, event);
  const required = deps.keys().selectionKeyPressed ? 0 : deps.view.getState().paneClickDistance;
  return Math.hypot(point.x - start.x, point.y - start.y) > required;
}

function startBox(selection: Selection, event: PointerEvent): void {
  const { deps } = selection;
  deps.store.getState().resetSelectedElements();
  deps.view.getState().onSelectionStart?.(asMouseEvent(event));
  selection.inProgress = true;
}

// With `autoPanOnSelection` the canvas scrolls once the box is being drawn, and the box is drawn
// again from where the pointer is then.
function scrollWhileDrawing(selection: Selection): void {
  const { deps } = selection;
  if (selection.stopScrolling !== noop || !deps.view.getState().autoPanOnSelection) {
    return;
  }
  selection.stopScrolling = autoScrollWhile(deps.store, selection.latest, {
    keepGoing: () => deps.store.getState().userSelectionActive,
    onScrolled: () => {
      drawBox(selection, selection.latest.current);
    },
  });
}

function moveSelection(selection: Selection, event: PointerEvent): void {
  selection.latest.current = event;
  if (!selection.inProgress && !farEnough(selection, event)) {
    return;
  }
  if (!selection.inProgress) {
    startBox(selection, event);
  }
  drawBox(selection, event);
  scrollWhileDrawing(selection);
}

// Letting go without having moved is a click on the pane (if that is where the press was); after a
// box it ends the selection.
function endSelection(selection: Selection, event: PointerEvent): void {
  const { deps } = selection;
  const { store, view } = deps;
  selection.stopScrolling();
  if (!selection.inProgress && selection.onPane) {
    paneClicked(deps, event, asMouseEvent(event));
  }
  store.setState({ userSelectionActive: false, userSelectionRect: null });
  if (selection.inProgress) {
    view.getState().onSelectionEnd?.(asMouseEvent(event));
    store.setState({ nodesSelectionActive: selection.covered.size > 0 });
  }
}

// As React Flow does, what was pressed holds the pointer while the box is drawn (so that nothing
// else is entered or left meanwhile), and lets it go at the end. A pointer the page does not know
// (one a test made up) cannot be held, and is not.
function hold(down: PointerEvent, holding: boolean): void {
  const { target, pointerId } = down;
  if (!(target instanceof Element)) {
    return;
  }
  try {
    if (holding) {
      target.setPointerCapture(pointerId);
    } else {
      target.releasePointerCapture(pointerId);
    }
  } catch {
    // Nothing holds a pointer that is not there.
  }
}

/**
 * Starts a selection box from a press. No box exists until the pointer has moved: letting go before
 * that is a click on the pane, and `onSelectionStart` has not been called. `onDone` is told, once
 * the pointer is released, whether a box was drawn.
 */
export function beginSelection(
  deps: PaneDeps,
  down: PointerEvent,
  onDone: (drawn: boolean) => void,
): void {
  const start = eventToCanvas(deps.store, down);
  const selection: Selection = {
    deps,
    anchor: screenToFlow(currentViewport(deps.store.getState()), start),
    onPane: down.target === deps.element,
    inProgress: false,
    latest: { current: down },
    stopScrolling: noop,
    covered: new Set(),
  };
  deps.store.setState({ userSelectionRect: selectionRectOf(start, start) });
  hold(down, true);
  trackPointer(
    // Not as a finger: React Flow draws the box by pointer events, which no slop holds back.
    { pointerId: down.pointerId },
    (event) => {
      moveSelection(selection, event);
    },
    (event) => {
      hold(down, false);
      endSelection(selection, event);
      onDone(selection.inProgress);
    },
  );
}
