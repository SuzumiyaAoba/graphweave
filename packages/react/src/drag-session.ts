/* oxlint-disable import/max-dependencies -- a drag ties the pointer, the selection, the scrolling of the canvas and the callbacks together */
import { calcAutoPan, getDragItems, startNodeDrag } from "@graphweave/core";
import type { DragConfig, DragSession, InternalNode, Point } from "@graphweave/core";
import type { MouseEvent as ReactMouseEvent } from "react";

import { clientToCanvas, clientToFlow } from "./coords.ts";
import { draggedNodes } from "./drag-payload.ts";
import { forgetDraggedNode, selectAtDragStart } from "./drag-select.ts";
import { holdSelectionWhilePressed } from "./no-select.ts";
import { trackPointer } from "./pointer-track.ts";
import type { ReactFlowState, ReactFlowStore } from "./store-context.ts";
import { swallowNextClick } from "./swallow-click.ts";
import { fingerCount } from "./touch-pointers.ts";
import type { ViewProps, ViewPropsStore } from "./view-props.ts";
import { settleViewportChange } from "./viewport-events.ts";

/**
 * What a drag callback receives. Like React Flow's, the argument typed as a React mouse event is
 * really the DOM event of the pointer that moved; handlers only read its common mouse fields.
 */
export function asMouseEvent(event: MouseEvent): ReactMouseEvent {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- documented above: the API promises a mouse event
  return event as unknown as ReactMouseEvent;
}

const justDragged = new WeakSet<ReactFlowStore>();

/** Whether a drag has only just ended, so the click that follows it should not count as one. */
export function wasJustDragged(store: ReactFlowStore): boolean {
  return justDragged.has(store);
}

function markJustDragged(store: ReactFlowStore): void {
  justDragged.add(store);
  // The click that ends a drag is dispatched right after the pointer is released, before timers run.
  setTimeout(() => {
    justDragged.delete(store);
  }, 0);
}

export interface DragContext {
  store: ReactFlowStore;
  view: ViewPropsStore;
  /** The node that was pressed; undefined when the whole selection is dragged by its frame. */
  nodeId?: string | undefined;
}

function selectedIds(state: ReactFlowState): string[] {
  return [...state.nodeLookup.values()]
    .filter((node) => node.selected === true)
    .map((node) => node.id);
}

// The nodes a press on `nodeId` moves: the selection and the node itself, except that an unselected
// node is dragged alone unless the multi-selection key is held, as in React Flow.
function idsToDrag(state: ReactFlowState, nodeId: string | undefined): string[] {
  if (nodeId === undefined) {
    return selectedIds(state);
  }
  const alone = !state.multiSelectionActive && state.nodeLookup.get(nodeId)?.selected !== true;
  return alone ? [nodeId] : [...selectedIds(state), nodeId];
}

function dragConfigOf(state: ReactFlowState): DragConfig {
  return {
    snapToGrid: state.snapToGrid,
    snapGrid: state.snapGrid,
    nodeExtent: state.nodeExtent,
    threshold: state.nodeDragThreshold,
    zoom: state.viewport.zoom,
    nodeOrigin: state.nodeOrigin,
    onError: state.onError,
  };
}

/** One drag in progress. */
interface Gesture {
  context: DragContext;
  session: DragSession;
  items: InternalNode[];
  announced: boolean;
  latest: PointerEvent;
  down: PointerEvent;
  /** Whether the pointer has strayed further than `nodeClickDistance`, which cancels the click. */
  clickLost: boolean;
  /** Set once a second finger is down: the drag stops following its finger for good. */
  aborted: boolean;
}

type Stage = "start" | "move" | "stop";

function selectionHandler(view: ViewProps, stage: Stage): ViewProps["onSelectionDragStart"] {
  const handlers = {
    start: view.onSelectionDragStart,
    move: view.onSelectionDrag,
    stop: view.onSelectionDragStop,
  };
  return handlers[stage];
}

// Tells the owner about a stage of the drag. As in React Flow, the callbacks of a node drag are
// always called (for the frame of a selection with the first of the nodes it moves), and those of a
// selection drag after them when it is the frame that is dragged.
function report(gesture: Gesture, stage: Stage, event: PointerEvent): void {
  const view = gesture.context.view.getState();
  const mouse = asMouseEvent(event);
  const { pressed, nodes } = draggedNodes(gesture.context, gesture.session, stage !== "stop");
  const lead = pressed ?? nodes[0];
  if (lead !== undefined) {
    const ofNode = {
      start: view.onNodeDragStart,
      move: view.onNodeDrag,
      stop: view.onNodeDragStop,
    };
    ofNode[stage]?.(mouse, lead, nodes);
  }
  if (gesture.context.nodeId === undefined) {
    selectionHandler(view, stage)?.(mouse, nodes);
  }
}

// The drag starts when the pointer has gone far enough, even though nothing has moved yet.
function announceStart(gesture: Gesture, event: PointerEvent): void {
  if (gesture.session.started() && !gesture.announced) {
    gesture.announced = true;
    selectAtDragStart(gesture.context.store, gesture.context.nodeId);
    report(gesture, "start", event);
  }
}

function step(gesture: Gesture, event: PointerEvent): void {
  const { store } = gesture.context;
  const changes = gesture.session.move(clientToFlow(store, { x: event.clientX, y: event.clientY }));
  announceStart(gesture, event);
  if (changes.length === 0) {
    return;
  }
  store.getState().updateNodePositions(changes);
  report(gesture, "move", event);
}

// How far the canvas should scroll this frame because the pointer is near its edge.
function scrollVelocity(gesture: Gesture): Point {
  const { store } = gesture.context;
  const state = store.getState();
  if (!state.autoPanOnNodeDrag || !gesture.session.started() || gesture.aborted) {
    return { x: 0, y: 0 };
  }
  const point = clientToCanvas(store, { x: gesture.latest.clientX, y: gesture.latest.clientY });
  return calcAutoPan(point, { width: state.width, height: state.height }, state.autoPanSpeed);
}

// Scrolls the canvas while the pointer is near its edge, so a dragged node can be taken further.
function autoPan(gesture: Gesture): void {
  const velocity = scrollVelocity(gesture);
  if (velocity.x === 0 && velocity.y === 0) {
    return;
  }
  const state = gesture.context.store.getState();
  const { viewport } = state;
  const moved = state.setViewport({
    x: viewport.x + velocity.x,
    y: viewport.y + velocity.y,
    zoom: viewport.zoom,
  });
  // As in React Flow the move of the canvas is told before the nodes are moved after it.
  settleViewportChange(gesture.context.store);
  if (moved) {
    step(gesture, gesture.latest);
  }
}

// Like d3-drag's `clickDistance`: once the pointer has been further than `nodeClickDistance` (screen
// pixels) from where it went down, the click that follows the release is not a click on the node.
function noteTravel(gesture: Gesture, event: PointerEvent): void {
  if (gesture.clickLost) {
    return;
  }
  const { down } = gesture;
  const distance = gesture.context.view.getState().nodeClickDistance;
  gesture.clickLost =
    Math.hypot(event.clientX - down.clientX, event.clientY - down.clientY) > distance;
}

// React Flow prevents unintentional dragging on multitouch: once a second finger is down, the drag
// no longer follows its finger, and ends without a stop callback.
function followsFinger(gesture: Gesture, event: PointerEvent): boolean {
  if (event.pointerType === "touch" && fingerCount() > 1) {
    gesture.aborted = true;
  }
  return !gesture.aborted;
}

function finish(gesture: Gesture, event: PointerEvent): void {
  const { store } = gesture.context;
  forgetDraggedNode(store);
  if (gesture.session.started()) {
    store.getState().updateNodePositions(gesture.session.end());
    if (!gesture.aborted) {
      report(gesture, "stop", event);
    }
  }
  if (gesture.clickLost) {
    markJustDragged(store);
    swallowNextClick();
  }
}

function startGesture(context: DragContext, down: PointerEvent): Gesture | undefined {
  const state = context.store.getState();
  const items = getDragItems(
    state.nodeLookup,
    idsToDrag(state, context.nodeId),
    state.nodesDraggable,
  );
  if (items.length === 0) {
    return undefined;
  }
  const origin = clientToFlow(context.store, { x: down.clientX, y: down.clientY });
  const session = startNodeDrag(items, origin, {
    lookup: state.nodeLookup,
    current: () => context.store.getState().nodeLookup,
    config: dragConfigOf(state),
  });
  return {
    context,
    session,
    items,
    announced: false,
    latest: down,
    down,
    clickLost: false,
    aborted: false,
  };
}

// A press on a node that shows itself as draggable but that the store will not let move (the lock of
// the controls) drags nothing; as with d3-drag in React Flow, the click that ends it is still not a
// click on the node once the pointer has moved.
function watchForLostClick(context: DragContext, down: PointerEvent): void {
  let lost = false;
  trackPointer(
    down,
    (event) => {
      const travel = Math.hypot(event.clientX - down.clientX, event.clientY - down.clientY);
      lost ||= travel > context.view.getState().nodeClickDistance;
    },
    () => {
      if (lost) {
        swallowNextClick();
      }
    },
  );
}

/**
 * Starts dragging from a pointer press: the pressed node, or the whole selection when it is part
 * of it. Follows the pointer on the window until it is released.
 */
export function beginNodeDrag(context: DragContext, down: PointerEvent): void {
  // As d3-drag does for a mouse, no text is selected and nothing is dragged natively meanwhile.
  holdSelectionWhilePressed(down);
  const gesture = startGesture(context, down);
  if (gesture === undefined) {
    watchForLostClick(context, down);
    return;
  }
  announceStart(gesture, down);
  let frame = 0;
  let scrolling = false;
  const tick = (): void => {
    autoPan(gesture);
    frame = requestAnimationFrame(tick);
  };
  trackPointer(
    down,
    (event) => {
      noteTravel(gesture, event);
      const follows = followsFinger(gesture, event);
      // As in React Flow the canvas starts to scroll with the first move of a drag that has begun, a
      // first step taken from where the pointer was: a press that does not move scrolls nothing.
      const wanted = gesture.context.store.getState().autoPanOnNodeDrag;
      if (follows && wanted && !scrolling && gesture.session.started()) {
        scrolling = true;
        tick();
      }
      gesture.latest = event;
      if (follows) {
        step(gesture, event);
      }
    },
    (event) => {
      cancelAnimationFrame(frame);
      finish(gesture, event);
    },
  );
}
