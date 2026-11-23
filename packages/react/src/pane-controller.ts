/* oxlint-disable import/max-dependencies -- the controller ties the pan, pinch, selection and click gestures together */
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";

import { eventToCanvas } from "./coords.ts";
import { isWrappedWithClass } from "./dom-utils.ts";
import { holdSelection } from "./no-select.ts";
import { trackPan } from "./pan-rebase.ts";
import { paneClicked } from "./pane-click.ts";
import { downOf } from "./pane-portal.ts";
import type { PaneDown } from "./pane-portal.ts";
import { middlePansThrough, startsPan, startsSelection, touchPans } from "./pane-rules.ts";
import type { Press } from "./pane-rules.ts";
import { beginSelection } from "./pane-selection.ts";
import { createFingers, endFingers, joinGesture, rememberFinger } from "./pane-touch.ts";
import type { Fingers } from "./pane-touch.ts";
import type { PaneDeps, PaneMode } from "./pane-types.ts";
import { trackPointer } from "./pointer-track.ts";
import { swallowNextClick } from "./swallow-click.ts";
import { cancelViewportAnimation } from "./viewport-animation.ts";
import { beginViewportGesture, moveForGesture } from "./viewport-events.ts";
import type { ViewportGesture } from "./viewport-events.ts";

/** Whether the next click on the pane is the end of a gesture and not a click on it. */
interface Clicks {
  suppressed: boolean;
}

interface Runtime {
  deps: PaneDeps;
  fingers: Fingers;
  clicks: Clicks;
  /** Ends the pan with the mouse that is going on, if any, as if the button were let go. */
  stopPan?: (() => void) | undefined;
}

function modeOf(deps: PaneDeps): PaneMode {
  return { ...deps.keys(), elementsSelectable: deps.store.getState().elementsSelectable };
}

function suppressNextClick(clicks: Clicks): void {
  clicks.suppressed = true;
  // The click that ends a gesture is dispatched right after the pointer is released.
  setTimeout(() => {
    clicks.suppressed = false;
  }, 0);
}

/** A pan with a pressed mouse that is going on. */
interface Pan {
  runtime: Runtime;
  down: PointerEvent;
  report: ViewportGesture;
  session: ReturnType<typeof trackPan>;
  /** Whether the pointer went further than `paneClickDistance`, and whether it moved at all. */
  moved: boolean;
  travelled: boolean;
  /** The buttons that are held, as the last event told them. */
  held: number;
  forget?: () => void;
  letSelect?: () => void;
}

function panMoved(pan: Pan, event: PointerEvent): void {
  const { deps } = pan.runtime;
  const distance = Math.hypot(event.clientX - pan.down.clientX, event.clientY - pan.down.clientY);
  pan.travelled = true;
  pan.moved ||= distance > deps.view.getState().paneClickDistance;
  try {
    moveForGesture(deps.store, pan.session.move(eventToCanvas(deps.store, event)));
  } finally {
    // Also when the owner's `onViewportChange` throws: the viewport has moved by then.
    pan.session.settled();
  }
  pan.report.moved(event);
}

function isContextMenu(pan: Pan): boolean {
  const { panOnDrag } = pan.runtime.deps.view.getState();
  const rightPans = Array.isArray(panOnDrag) && panOnDrag.includes(2);
  return pan.down.button === 2 && !pan.travelled && rightPans;
}

function panEnded(pan: Pan, event: PointerEvent): void {
  const { deps, clicks } = pan.runtime;
  pan.letSelect?.();
  pan.runtime.stopPan = undefined;
  deps.onUi({ dragging: false, selecting: false });
  if (pan.moved) {
    suppressNextClick(clicks);
    // As d3-zoom does, the click that follows a pan that moved is stopped wherever the pointer
    // is let go: a node that could not be dragged is not clicked by the pan that began on it.
    swallowNextClick();
  }
  // With the right button listed in `panOnDrag` the pane's own context menu event is off, and a
  // right press that ends without the pointer having moved is the context menu, as in React Flow.
  if (isContextMenu(pan)) {
    deps.view.getState().onPaneContextMenu?.(event);
  }
  pan.report.end(event);
}

// A button pressed or let go while another is held comes as a move of the pointer. As with d3-zoom,
// which hears every button of the mouse, one more button begins the gesture anew and letting any
// button go ends it. Tells whether the event was such a change, which is then not a move.
function chord(pan: Pan, event: PointerEvent, released: boolean): void {
  // A press that was joined by another button is no context menu when it ends.
  pan.travelled = true;
  if (released) {
    pan.forget?.();
    panEnded(pan, event);
  } else {
    pan.report.abandon();
    pan.report = beginViewportGesture(pan.runtime.deps.store, event);
  }
}

function buttonsChanged(pan: Pan, event: PointerEvent): boolean {
  const before = pan.held;
  pan.held = event.buttons === 0 ? before : event.buttons;
  if (before === 0 || pan.held === before) {
    return false;
  }
  chord(pan, event, pan.held < before);
  return true;
}

// Pans with a pressed mouse. As in d3-zoom the gesture begins with the press (a click is a gesture
// that went nowhere) and the canvas follows from the first move; the click that ends a drag longer
// than `paneClickDistance` is not a click on the pane.
function beginPan(runtime: Runtime, down: PointerEvent): () => void {
  const { deps } = runtime;
  cancelViewportAnimation(deps.store);
  const pan: Pan = {
    runtime,
    down,
    report: beginViewportGesture(deps.store, down),
    session: trackPan(deps.store, eventToCanvas(deps.store, down)),
    moved: false,
    travelled: false,
    held: down.buttons,
    letSelect: holdSelection(),
  };
  deps.onUi({ dragging: true, selecting: false });
  pan.forget = trackPointer(
    down,
    (event) => {
      if (!buttonsChanged(pan, event)) {
        panMoved(pan, event);
      }
    },
    (event) => {
      panEnded(pan, event);
    },
  );
  // The pane went away while the button was held: the pointer is followed no more, and the gesture
  // is over (the store may outlive the pane, and would otherwise take it to be going on). As in
  // React Flow, whose pan-zoom is destroyed with the pane, `onMoveEnd` is not told.
  return () => {
    runtime.stopPan = undefined;
    pan.forget?.();
    pan.letSelect?.();
    deps.onUi({ dragging: false, selecting: false });
    pan.report.abandon();
  };
}

/** The handlers of the pane: what a press, a click or a double click on it does. */
export interface PaneController {
  /** Every press inside the pane, before whatever it lands on has had its say. */
  captureDown: (event: ReactPointerEvent<HTMLElement>) => void;
  pointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  /**
   * A press on what ViewportPortal draws, told by the page: as with React Flow's d3-zoom, it pans and
   * a finger there joins the gesture, but it draws no selection box.
   */
  portalDown: (event: PointerEvent) => void;
  click: (event: ReactMouseEvent<HTMLElement>) => void;
  /** The pane goes away: a gesture of fingers that is going on is ended. */
  dispose: () => void;
}

// A press with the mouse pans the canvas, where it may.
function routePress(runtime: Runtime, event: PaneDown): void {
  const { deps } = runtime;
  // One pan at a time: a second button pressed while the canvas is being panned changes nothing.
  const pans = middlePansThrough(event) || startsPan(event, deps.view.getState(), modeOf(deps));
  if (runtime.stopPan === undefined && pans) {
    runtime.stopPan = beginPan(runtime, event.nativeEvent);
  }
}

// A finger pans the canvas, or pinches it with a second one, unless panning is off, a box is being
// drawn or a connection made.
function routeTouch(runtime: Runtime, event: PaneDown): void {
  const { deps, fingers } = runtime;
  const props = deps.view.getState();
  const { userSelectionActive, connection } = deps.store.getState();
  const blockers = {
    userSelectionActive,
    connectionInProgress: connection.inProgress,
    // With pinching off, a second finger is not taken at all.
    extraFinger: fingers.touches.size > 1 && !props.zoomOnPinch,
  };
  if (touchPans(props, modeOf(deps), blockers)) {
    joinGesture(fingers, event.nativeEvent);
  }
}

// What the press is, for deciding whether it draws a selection box.
function pressOf(event: ReactPointerEvent<HTMLElement>): Press {
  const onPane = event.target === event.currentTarget;
  return {
    button: event.button,
    isPrimary: event.pointerType !== "touch" || event.isPrimary,
    touch: event.pointerType === "touch",
    onPane,
    noKey: !onPane && event.target instanceof Element && event.target.closest(".nokey") !== null,
  };
}

// Before anything inside the pane has seen a press: fingers are counted, and a press that draws a
// selection box takes it away from what it landed on (the selection key beats a node's drag or a
// handle's connection).
function captureDown(runtime: Runtime, event: ReactPointerEvent<HTMLElement>): void {
  const { deps, fingers, clicks } = runtime;
  if (event.pointerType === "touch") {
    rememberFinger(fingers, event.nativeEvent);
  }
  const press = pressOf(event);
  if (!startsSelection(press, deps.view.getState(), modeOf(deps))) {
    return;
  }
  beginSelection(deps, event.nativeEvent, (drawn) => {
    suppressNextClick(clicks);
    if (drawn) {
      swallowNextClick();
    }
  });
  if (!press.onPane) {
    event.stopPropagation();
    event.preventDefault();
  }
}

function handlePointerDown(runtime: Runtime, event: PaneDown): void {
  const { deps } = runtime;
  const { noPanClassName } = deps.view.getState();
  if (!middlePansThrough(event) && isWrappedWithClass(event.target, noPanClassName)) {
    return;
  }
  if (event.pointerType === "touch") {
    routeTouch(runtime, event);
  } else {
    routePress(runtime, event);
  }
}

export function createPaneController(deps: PaneDeps): PaneController {
  const clicks: Clicks = { suppressed: false };
  const runtime: Runtime = {
    deps,
    clicks,
    fingers: createFingers(deps, () => {
      suppressNextClick(clicks);
    }),
  };
  return {
    captureDown: (event) => {
      captureDown(runtime, event);
    },
    pointerDown: (event) => {
      handlePointerDown(runtime, event);
    },
    portalDown: (event) => {
      if (event.pointerType === "touch") {
        rememberFinger(runtime.fingers, event);
      }
      handlePointerDown(runtime, downOf(event));
    },
    dispose: () => {
      endFingers(runtime.fingers);
      runtime.stopPan?.();
    },
    click: (event) => {
      if (
        clicks.suppressed ||
        event.target !== event.currentTarget ||
        deps.store.getState().connection.inProgress
      ) {
        return;
      }
      paneClicked(deps, event.nativeEvent, event);
    },
  };
}
