import { applyWheel, currentViewport } from "@free-flow/core";
import type { Viewport, WheelInput, WheelOptions } from "@free-flow/core";

import { clientToCanvas } from "./coords.ts";
import { isWrappedWithClass } from "./dom-utils.ts";
import type { ReactFlowStore } from "./store-context.ts";
import { isMac } from "./view-props.ts";
import type { ViewProps, ViewPropsStore } from "./view-props.ts";
import { cancelViewportAnimation } from "./viewport-animation.ts";
import { beginViewportGesture, callsInsideGestures } from "./viewport-events.ts";
import type { ViewportGesture } from "./viewport-events.ts";

// A wheel gesture has no end event, so it is over once the wheel has been quiet for a moment.
const WHEEL_END_DELAY = 150;

export interface WheelDeps {
  store: ReactFlowStore;
  view: ViewPropsStore;
  /** Where the wheel is heard: the renderer, as React Flow's d3-zoom hears it (a node toolbar too). */
  element: HTMLElement;
  /** The pane, whose `onPaneScroll` is told of a wheel over the pane itself. */
  pane: HTMLElement;
  /** Whether the key set as `zoomActivationKeyCode` is held right now. */
  zoomKeyDown: () => boolean;
}

function inputOf(store: ReactFlowStore, event: WheelEvent): WheelInput {
  return {
    deltaX: event.deltaX,
    deltaY: event.deltaY,
    deltaMode: event.deltaMode,
    ctrlKey: event.ctrlKey,
    shiftKey: event.shiftKey,
    point: clientToCanvas(store, { x: event.clientX, y: event.clientY }),
  };
}

function optionsOf(store: ReactFlowStore, props: ViewProps, zoomKeyDown: boolean): WheelOptions {
  const { minZoom, maxZoom } = store.getState();
  return {
    zoomOnScroll: props.zoomOnScroll,
    zoomOnPinch: props.zoomOnPinch,
    panOnScroll: props.panOnScroll,
    panOnScrollSpeed: props.panOnScrollSpeed,
    panOnScrollMode: props.panOnScrollMode,
    zoomActivationKeyPressed: zoomKeyDown,
    macOs: isMac(),
    minZoom,
    maxZoom,
  };
}

// The viewport a wheel event leads to, or undefined when the event is not for the canvas.
function nextViewport(deps: WheelDeps, event: WheelEvent): Viewport | undefined {
  return applyWheel(
    currentViewport(deps.store.getState()),
    inputOf(deps.store, event),
    optionsOf(deps.store, deps.view.getState(), deps.zoomKeyDown()),
  );
}

/** The wheel gesture in progress: the report of it, and when it will end. */
interface WheelGesture {
  report: ViewportGesture | null;
  timer: ReturnType<typeof setTimeout> | null;
  /** Whether its last event panned by scrolling: such a gesture has waited for its end itself. */
  scrolls: boolean;
}

/** One wheel event and the viewport it leads to. */
interface WheelStep {
  event: WheelEvent;
  next: Viewport;
}

// The end of the gesture is `WHEEL_END_DELAY` after the last wheel event.
function scheduleEnd(deps: WheelDeps, gesture: WheelGesture, event: WheelEvent): void {
  if (gesture.timer !== null) {
    clearTimeout(gesture.timer);
  }
  const calls = callsInsideGestures(deps.store);
  gesture.timer = setTimeout(() => {
    gesture.report?.end(callsInsideGestures(deps.store) === calls ? event : null, gesture.scrolls);
    gesture.report = null;
  }, WHEEL_END_DELAY);
}

// As in d3-zoom, a wheel event that leaves the zoom where it is (at a limit) does not begin a gesture,
// whatever it would do to the pan.
function changesNothing(deps: WheelDeps, gesture: WheelGesture, next: Viewport): boolean {
  return gesture.report === null && currentViewport(deps.store.getState()).zoom === next.zoom;
}

// Whether the wheel pans the canvas by scrolling, which React Flow handles apart from d3-zoom: the
// first event of the gesture is told as its start, from where it took the canvas, and every event
// counts, also one that a limit leaves where it was.
function scrollPans(deps: WheelDeps, event: WheelEvent): boolean {
  const props = deps.view.getState();
  const pinch = event.ctrlKey && props.zoomOnPinch;
  // As in React Flow, while a box is drawn the wheel is a zooming one (which the box then pauses).
  const drawing = deps.store.getState().userSelectionActive;
  return props.panOnScroll && !deps.zoomKeyDown() && !pinch && !drawing;
}

// Whether the wheel is a pinch while the canvas pans by scrolling: React Flow then zooms by one call
// to d3-zoom for each event, which tells a whole gesture (start, move and end) at once.
function pinchWhileScrolling(deps: WheelDeps, event: WheelEvent): boolean {
  const props = deps.view.getState();
  const drawing = deps.store.getState().userSelectionActive;
  return props.panOnScroll && !deps.zoomKeyDown() && event.ctrlKey && props.zoomOnPinch && !drawing;
}

// A whole gesture for one event: begun, moved and ended at once.
function zoomAtOnce(deps: WheelDeps, step: WheelStep): void {
  const report = beginViewportGesture(deps.store, step.event);
  try {
    deps.store.getState().setViewport(step.next);
    report.moved(step.event);
  } finally {
    report.end(step.event);
  }
}

// One event of the wheel gesture, which is begun if this is its first.
function take(deps: WheelDeps, gesture: WheelGesture, step: WheelStep): void {
  const { event, next } = step;
  if (gesture.report === null && gesture.scrolls) {
    gesture.report = beginViewportGesture(deps.store, event, () => {
      deps.store.getState().setViewport(next);
    });
    return;
  }
  gesture.report ??= beginViewportGesture(deps.store, event);
  deps.store.getState().setViewport(next);
  gesture.report.moved(event);
}

// Moves the viewport, inside the wheel gesture. The gesture ends after the wheel has been quiet,
// even if a callback throws.
function apply(deps: WheelDeps, gesture: WheelGesture, step: WheelStep): void {
  cancelViewportAnimation(deps.store);
  if (pinchWhileScrolling(deps, step.event)) {
    zoomAtOnce(deps, step);
    return;
  }
  gesture.scrolls = scrollPans(deps, step.event);
  try {
    take(deps, gesture, step);
  } finally {
    scheduleEnd(deps, gesture, step.event);
  }
}

// Moves the viewport as the wheel says; tells whether the canvas took the wheel.
function move(deps: WheelDeps, gesture: WheelGesture, step: WheelStep): boolean {
  // The wheel of a pinch (Control) never zooms the page as well, whatever `preventScrolling` says.
  const taken = step.event.ctrlKey || scrollPans(deps, step.event);
  if (deps.view.getState().preventScrolling || taken) {
    step.event.preventDefault();
  }
  // A pinch while panning by scrolling is one call to d3-zoom, told even at a limit of the zoom.
  const goes =
    scrollPans(deps, step.event) ||
    pinchWhileScrolling(deps, step.event) ||
    !changesNothing(deps, gesture, step.next);
  if (goes) {
    apply(deps, gesture, step);
  }
  return goes;
}

// Whether the canvas leaves the wheel alone, whatever it would do to the viewport. Without
// `preventScrolling` the page keeps its scrolling: a plain wheel is left alone, while the wheel of a
// pinch (Ctrl) still zooms and a pan by scrolling takes the wheel, as in React Flow. As there too, a
// pinch over a `noWheelClassName` element does not zoom the page, and while a box is drawn d3-zoom
// pauses and the page does not scroll.
function leftAlone(deps: WheelDeps, event: WheelEvent): boolean {
  const props = deps.view.getState();
  if (!props.preventScrolling && !event.ctrlKey && !scrollPans(deps, event)) {
    return true;
  }
  const noWheel = isWrappedWithClass(event.target, props.noWheelClassName);
  const drawing = deps.store.getState().userSelectionActive;
  if ((noWheel && event.ctrlKey) || (!noWheel && drawing)) {
    event.preventDefault();
  }
  return noWheel || drawing;
}

// Tells whether the canvas took the wheel.
function wheel(deps: WheelDeps, gesture: WheelGesture, event: WheelEvent): boolean {
  if (leftAlone(deps, event)) {
    return false;
  }
  const next = nextViewport(deps, event);
  return next !== undefined && move(deps, gesture, { event, next });
}

/** The `wheel` listener of a pane, and what to call when the pane goes away. */
export interface WheelHandler {
  onWheel: (event: WheelEvent) => void;
  dispose: () => void;
}

/**
 * Builds the `wheel` listener of the pane: it zooms or pans the viewport as the options say, and
 * reports the move events. Scrolling is left alone over elements with the `noWheelClassName`.
 */
export function createWheelHandler(deps: WheelDeps): WheelHandler {
  const gesture: WheelGesture = { report: null, timer: null, scrolls: false };
  return {
    onWheel: (event) => {
      const taken = wheel(deps, gesture, event);
      // As with React Flow's d3-zoom, a wheel the canvas took goes no further (not to a flow around
      // this one either), and the pane hears only a wheel that was left alone, over the pane itself.
      if (taken) {
        event.stopImmediatePropagation();
      } else if (event.target === deps.pane) {
        deps.view.getState().onPaneScroll?.(event);
      }
    },
    // The pane goes away: a wheel gesture that is waiting to end is over, and as in React Flow,
    // whose pan-zoom goes away with the pane, its end is not told.
    dispose: () => {
      if (gesture.timer !== null) {
        clearTimeout(gesture.timer);
      }
      gesture.report?.abandon();
      gesture.report = null;
    },
  };
}
