import { currentViewport, zoomPath } from "@free-flow/core";
import type { Point, Viewport, ViewportInterpolation } from "@free-flow/core";

import type { ReactFlowStore } from "./store-context.ts";
import {
  beginViewportGesture,
  changeAsCall,
  gestureGoesOn,
  withoutViewportEvents,
} from "./viewport-events.ts";
import type { GestureEvent, ViewportGesture } from "./viewport-events.ts";

const CUBIC = 3;

// The cubic in-out of d3, which React Flow eases its moves with unless told otherwise: slow at both
// ends, quick in the middle.
function easeInOutCubic(progress: number): number {
  const doubled = progress * 2;
  return doubled <= 1 ? doubled ** CUBIC / 2 : ((doubled - 2) ** CUBIC + 2) / 2;
}

/** How a move of the viewport is animated. */
export interface Motion {
  /** In milliseconds; no animation unless positive. */
  duration: number | undefined;
  ease?: ((progress: number) => number) | undefined;
  interpolate?: ViewportInterpolation | undefined;
  /** The point of the canvas that stays under the pointer, when the move is a zoom about it. */
  pivot?: Point | undefined;
  /** What the user did to set the move off, as a double click: told with the move, as d3-zoom does. */
  event?: GestureEvent | undefined;
}

const running = new WeakMap<ReactFlowStore, () => void>();

/** Stops a running viewport animation of this flow, leaving the viewport where it is. */
export function cancelViewportAnimation(store: ReactFlowStore): void {
  const stop = running.get(store);
  // Forgotten first: what hears of the end may start a glide of its own, which is then kept.
  running.delete(store);
  stop?.();
}

/** What a glide does on each frame, and once it is over. */
interface Frames {
  /** Moves the viewport for this moment, and tells whether the glide has come to its end. */
  paint: (now: number) => boolean;
  /** The glide is over, run to its end or not. */
  ended: () => void;
}

// Paints frame after frame; resolves once the glide has run to its end (true) or was stopped (false).
async function runFrames(store: ReactFlowStore, frames: Frames): Promise<boolean> {
  // oxlint-disable-next-line promise/avoid-new -- wraps the callback-based requestAnimationFrame
  const finished = await new Promise<boolean>((resolve) => {
    const state: { frame: number; over: boolean; stop?: () => void } = { frame: 0, over: false };
    const finish = (done: boolean): void => {
      if (state.over) {
        return;
      }
      state.over = true;
      // Another glide may have taken this one's place by now: it is not forgotten.
      if (running.get(store) === state.stop) {
        running.delete(store);
      }
      frames.ended();
      resolve(done);
    };
    const step = (now: number): void => {
      let done = false;
      try {
        done = frames.paint(now);
      } catch (error) {
        finish(false);
        throw error;
      }
      // A listener of the move may have stopped the glide, by moving the viewport itself.
      if (done) {
        finish(true);
      } else if (!state.over) {
        state.frame = requestAnimationFrame(step);
      }
    };
    state.stop = (): void => {
      cancelAnimationFrame(state.frame);
      finish(false);
    };
    running.set(store, state.stop);
    state.frame = requestAnimationFrame(step);
  });
  return finished;
}

// Resolves once the animation has run to its end (true) or was interrupted (false).
async function animate(
  store: ReactFlowStore,
  route: { start: Viewport; target: Viewport },
  motion: Motion & { duration: number },
): Promise<boolean> {
  cancelViewportAnimation(store);
  const { width, height } = store.getState();
  const along = zoomPath(route, { width, height }, motion);
  const ease = motion.ease ?? easeInOutCubic;
  const event = motion.event ?? null;
  // As a d3 transition does, the glide begins with its first frame and not with the call: one that is
  // stopped before then was never told.
  let report: ViewportGesture | undefined = undefined;
  const begin = performance.now();
  let over = false;
  const finished = await runFrames(store, {
    paint: (now) => {
      if (report === undefined) {
        report = beginViewportGesture(store, event);
        // A listener of the start may have stopped the glide, which had nothing to end yet.
        if (over) {
          report.end(event);
          return true;
        }
      }
      const progress = Math.min(1, Math.max(0, (now - begin) / motion.duration));
      store.getState().setViewportAsGiven(along(ease(progress)));
      report.moved(event);
      return progress >= 1;
    },
    // The glide is reported as ended, however it came to be over.
    ended: () => {
      over = true;
      report?.end(event);
    },
  });
  return finished;
}

interface Plan {
  start: Viewport;
  target: Viewport;
  moved: boolean;
}

// Works out where `change` would take the viewport, and puts everything back: the owner is not told,
// since the move is told frame by frame as it is animated.
function planChange(store: ReactFlowStore, change: () => boolean): Plan {
  const before = store.getState();
  store.setState({ onViewportChange: undefined });
  try {
    const { moved, target } = withoutViewportEvents(store, () => {
      const changed = change();
      return { moved: changed, target: currentViewport(store.getState()) };
    });
    return { start: currentViewport(before), target, moved };
  } finally {
    // Also when the change failed: the owner's listener and the viewport are as they were.
    withoutViewportEvents(store, () => {
      store.setState({
        onViewportChange: before.onViewportChange,
        viewport: before.viewport,
        transform: before.transform,
        pendingViewport: before.pendingViewport,
      });
    });
  }
}

// A call that leaves the viewport where it was is told all the same, as the d3-zoom transform that
// React Flow makes for it is: begun, moved and ended.
function tellUnmoved(store: ReactFlowStore): void {
  const gesture = beginViewportGesture(store, null);
  try {
    gesture.moved(null);
  } finally {
    gesture.end(null);
  }
}

// A change that is made at once.
function callNow(store: ReactFlowStore, change: () => boolean): void {
  const still = !gestureGoesOn(store);
  const moved = changeAsCall(store, change);
  if (still && !moved && !store.getState().fitViewQueued) {
    tellUnmoved(store);
  }
}

/** Runs `change` at once, as a call that is not animated: told also when the viewport stays. */
export function changeViewportNow(store: ReactFlowStore, change: () => boolean): void {
  cancelViewportAnimation(store);
  callNow(store, change);
}

/**
 * Runs `change`, a store action that moves the viewport. With a positive `duration` the move is
 * animated: the action decides the target, and the viewport then glides there from where it was,
 * for the whole duration also when it is there already, as the d3 transition of React Flow does.
 * Resolves to `true` once the move has been made, as React Flow's calls do whether or not the
 * viewport moved, and to `false` when the animation was interrupted (where React Flow's never settle).
 */
export async function runViewportChange(
  store: ReactFlowStore,
  change: () => boolean,
  motion: Motion,
): Promise<boolean> {
  cancelViewportAnimation(store);
  const { duration } = motion;
  if (duration === undefined || duration <= 0) {
    callNow(store, change);
    return true;
  }
  const plan = planChange(store, change);
  if (!plan.moved && store.getState().fitViewQueued) {
    // A fit that waits for nodes to frame: nothing glides until it is made.
    return true;
  }
  const finished = await animate(store, plan, { ...motion, duration });
  return finished;
}
