import { currentViewport } from "@graphweave/core";
import type { Viewport } from "@graphweave/core";
import { useLayoutEffect } from "react";

import type { ReactFlowStore } from "./store-context.ts";
import type { ViewPropsStore } from "./view-props.ts";

/** Callbacks for the start and end of a pan or zoom gesture, registered through a hook. */
export interface ViewportGestureHandlers {
  onStart?: ((viewport: Viewport) => void) | undefined;
  /** The viewport moved: told for every move of a gesture, also one that leaves it where it was. */
  onChange?: ((viewport: Viewport) => void) | undefined;
  onEnd?: ((viewport: Viewport) => void) | undefined;
}

const registry = new WeakMap<ReactFlowStore, Set<ViewportGestureHandlers>>();

/** Registers handlers for one flow's gestures; the returned function removes them. */
export function addViewportGestureHandlers(
  store: ReactFlowStore,
  handlers: ViewportGestureHandlers,
): () => void {
  const handlerSet = registry.get(store) ?? new Set<ViewportGestureHandlers>();
  handlerSet.add(handlers);
  registry.set(store, handlerSet);
  return () => {
    handlerSet.delete(handlers);
  };
}

// Where each flow's `onMoveStart`, `onMove` and `onMoveEnd` are kept.
const views = new WeakMap<ReactFlowStore, ViewPropsStore>();
// How many gestures are open on a flow: a viewport change inside one is part of it.
const open = new WeakMap<ReactFlowStore, number>();
// How many times the viewport is being moved only to find out where a move would end.
const silenced = new WeakMap<ReactFlowStore, number>();
// As in React Flow, the end of a pan by scrolling and the end of any other gesture wait apart, so
// that one does not cancel the other.
const endTimers = new WeakMap<ReactFlowStore, ReturnType<typeof setTimeout>>();
const scrollEndTimers = new WeakMap<ReactFlowStore, ReturnType<typeof setTimeout>>();

function countOf(counts: WeakMap<ReactFlowStore, number>, store: ReactFlowStore): number {
  return counts.get(store) ?? 0;
}

function bump(counts: WeakMap<ReactFlowStore, number>, store: ReactFlowStore, by: number): void {
  counts.set(store, Math.max(0, countOf(counts, store) + by));
}

/** The event a gesture reports: the one that drives it, or `null` for a change made by a call. */
export type GestureEvent = MouseEvent | TouchEvent | null;

/** A pan, pinch, wheel or animated move of the viewport, which reports itself like d3-zoom's. */
export interface ViewportGesture {
  /** Reports that the viewport has moved: it already is where it goes. */
  moved: (event: GestureEvent) => void;
  /**
   * Reports that the gesture is over. `quick`: the gesture has waited for its end itself (a pan by
   * scrolling), and is told at once.
   */
  end: (event: GestureEvent, quick?: boolean) => void;
  /** The gesture is over because the flow went away: nobody is told. */
  abandon: () => void;
}

// With `panOnScroll` React Flow waits this long before it tells an end, so that the ends of a scroll
// are told as one.
const PAN_ON_SCROLL_END_DELAY = 150;

function tellEnd(store: ReactFlowStore, event: GestureEvent, quick = false): void {
  const viewport = currentViewport(store.getState());
  const slow = !quick && views.get(store)?.getState().panOnScroll === true;
  // As React Flow does, the end is told in a timeout, and only the last of several close ends is.
  const timers = quick ? scrollEndTimers : endTimers;
  clearTimeout(timers.get(store));
  timers.set(
    store,
    setTimeout(
      () => {
        views.get(store)?.getState().onMoveEnd?.(event, viewport);
        for (const handlers of registry.get(store) ?? []) {
          handlers.onEnd?.(viewport);
        }
      },
      slow ? PAN_ON_SCROLL_END_DELAY : 0,
    ),
  );
}

/** Tells the handlers that hooks registered that a gesture began (`start`) or ended. */
export function notifyGestureHandlers(
  store: ReactFlowStore,
  kind: "start" | "end",
  viewport: Viewport,
): void {
  for (const handlers of registry.get(store) ?? []) {
    (kind === "start" ? handlers.onStart : handlers.onEnd)?.(viewport);
  }
}

// A move of the viewport is told to `onMove` first and to the hooks after, as React Flow's pane does.
function tellMove(store: ReactFlowStore, event: GestureEvent, viewport: Viewport): void {
  views.get(store)?.getState().onMove?.(event, viewport);
  for (const handlers of registry.get(store) ?? []) {
    handlers.onChange?.(viewport);
  }
}

function tellStart(store: ReactFlowStore, event: GestureEvent, viewport: Viewport): void {
  views.get(store)?.getState().onMoveStart?.(event, viewport);
  for (const handlers of registry.get(store) ?? []) {
    handlers.onStart?.(viewport);
  }
}

/**
 * Starts a gesture: `onMoveStart` is called now, `onMove` with every `moved`, and `onMoveEnd` after
 * `end`. As in React Flow, any change of the viewport counts, a click that moves nothing included.
 * `from` is the viewport it began from, when that is not the one now, or the first move of the
 * gesture, which is then made before the start is told (a pan by scrolling, in React Flow). A
 * callback that throws does not leave the gesture open.
 */
export function beginViewportGesture(
  store: ReactFlowStore,
  event: GestureEvent,
  from?: Viewport | (() => void),
): ViewportGesture {
  bump(open, store, 1);
  try {
    if (typeof from === "function") {
      from();
    }
    const startedAt = typeof from === "function" ? undefined : from;
    tellStart(store, event, startedAt ?? currentViewport(store.getState()));
  } catch (error) {
    bump(open, store, -1);
    throw error;
  }
  let over = false;
  return {
    moved: (moveEvent) => {
      tellMove(store, moveEvent, currentViewport(store.getState()));
    },
    end: (endEvent, quick) => {
      if (!over) {
        over = true;
        bump(open, store, -1);
        tellEnd(store, endEvent, quick);
      }
    },
    abandon: () => {
      if (!over) {
        over = true;
        bump(open, store, -1);
      }
    },
  };
}

/** Runs `run` without the viewport changes it makes being told as gestures, or to the hooks. */
export function withoutViewportEvents<TResult>(store: ReactFlowStore, run: () => TResult): TResult {
  bump(open, store, 1);
  bump(silenced, store, 1);
  try {
    return run();
  } finally {
    bump(open, store, -1);
    bump(silenced, store, -1);
  }
}

/** Whether the viewport is being moved only to find out where a move would end. */
export function viewportEventsSilenced(store: ReactFlowStore): boolean {
  return countOf(silenced, store) > 0;
}

function differs(a: Viewport, b: Viewport): boolean {
  return a.x !== b.x || a.y !== b.y || a.zoom !== b.zoom;
}

const shots = new WeakMap<ReactFlowStore, ViewportGesture>();

/**
 * Tells the move and the end of a change that a call has just made. The store tells of the change
 * while the call is still at it, before the owner has had `onViewportChange`; React Flow tells the
 * move right after, and whoever makes such a call says here that it is done.
 */
export function settleViewportChange(store: ReactFlowStore): void {
  const gesture = shots.get(store);
  shots.delete(store);
  try {
    gesture?.moved(null);
  } finally {
    gesture?.end(null);
  }
}

const callsInGesture = new WeakMap<ReactFlowStore, number>();

/**
 * How many changes calls have made inside gestures of this flow so far. A gesture that ends by
 * itself (the wheel, once it is quiet) ends with the event of its last move, as with d3-zoom: with
 * no event when a call moved the viewport after the last one of its own.
 */
export function callsInsideGestures(store: ReactFlowStore): number {
  return countOf(callsInGesture, store);
}

// Whether a gesture is going on that a change of the viewport would be part of.
export function gestureGoesOn(store: ReactFlowStore): boolean {
  return countOf(open, store) > 0 && countOf(silenced, store) === 0;
}

// Tells `onMove` that the viewport has moved inside the gesture that is going on, from no event.
function tellMoveInGesture(store: ReactFlowStore): void {
  bump(callsInGesture, store, 1);
  tellMove(store, null, currentViewport(store.getState()));
}

/**
 * Runs a change of the viewport that a call makes (`setViewport`, `zoomTo`, `fitBounds`, the owner's
 * new `viewport`). Inside a gesture that is going on it is one more `onMove` of that gesture, as a
 * d3-zoom transform inside a gesture is; outside one it is a gesture of its own, which the listener
 * of the flow tells. The gesture is looked at before the change, since the change may start one.
 */
export function changeAsCall(store: ReactFlowStore, change: () => boolean): boolean {
  const inGesture = gestureGoesOn(store);
  const moved = change();
  if (moved && inGesture) {
    tellMoveInGesture(store);
  }
  settleViewportChange(store);
  return moved;
}

/**
 * Takes over the viewport the owner holds. Where it differs from the one the gesture has taken the
 * canvas to (an owner that rounds or limits the move it is told about) it is a change made by a call.
 */
export function syncHeldViewport(store: ReactFlowStore, viewport: Viewport): void {
  changeAsCall(store, () => {
    const before = currentViewport(store.getState());
    store.getState().syncViewport(viewport);
    return differs(before, currentViewport(store.getState()));
  });
}

/**
 * Moves the viewport for a pan or a pinch. d3-zoom tells every move of a gesture, also one that a
 * limit leaves where it was (the zoom at its smallest, the edge of `translateExtent`), and React
 * Flow's `onViewportChange` hears each of them; the store only tells a viewport that changed.
 */
export function moveForGesture(store: ReactFlowStore, next: Viewport): void {
  const state = store.getState();
  if (!state.setViewport(next)) {
    state.onViewportChange?.(currentViewport(store.getState()));
  }
}

// A change made by a call is a gesture of its own: begun at once, moved and ended when the call is
// done, or else as soon as whatever made it has run.
function reportOneShot(store: ReactFlowStore, before: Viewport): void {
  settleViewportChange(store);
  shots.set(store, beginViewportGesture(store, null, before));
  queueMicrotask(() => {
    settleViewportChange(store);
  });
}

/**
 * Tells a viewport change that no gesture is making (a call such as `fitView`, a new `viewport`
 * prop, the canvas scrolling for a drag) as a gesture of its own, as React Flow does.
 */
export function useViewportEvents(store: ReactFlowStore, view: ViewPropsStore): void {
  // A layout effect, since the flow fits itself to its nodes in one when it starts.
  useLayoutEffect(() => {
    views.set(store, view);
    // Where the viewport was last seen, which is not always the `previous` of a notification.
    let seen = currentViewport(store.getState());
    return store.subscribe((state) => {
      const before = seen;
      const after = currentViewport(state);
      seen = after;
      if (countOf(open, store) === 0 && differs(before, after)) {
        reportOneShot(store, before);
      }
    });
  }, [store, view]);
}
