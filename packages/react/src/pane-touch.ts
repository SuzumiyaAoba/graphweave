import type { Point, Viewport } from "@free-flow/core";

import { clientToCanvas } from "./coords.ts";
import { cancelTakenTaps, createTaps, tapEnded, tapJoined, tapsOfStart } from "./double-tap.ts";
import type { Taps } from "./double-tap.ts";
import { trackPan, trackPinch } from "./pan-rebase.ts";
import type { TrackedPan, TrackedPinch } from "./pan-rebase.ts";
import type { PaneDeps } from "./pane-types.ts";
import { trackPointer } from "./pointer-track.ts";
import { fingerDown, fingerUp } from "./touch-pointers.ts";
import { cancelViewportAnimation } from "./viewport-animation.ts";
import { beginViewportGesture, moveForGesture } from "./viewport-events.ts";
import type { ViewportGesture } from "./viewport-events.ts";

// What the fingers are doing to the viewport: one pans it, two pinch it.
type Session = { pan: TrackedPan } | { pinch: TrackedPinch };

interface Gesture {
  report: ViewportGesture;
  session: Session;
  /** The fingers that move the viewport: up to two, in the order they were taken. */
  taking: number[];
  /** Where the first finger went down. */
  origin: Point;
  /** Whether a finger has gone further than `paneClickDistance`, which cancels the click. */
  moved: boolean;
  /** A move that waits for the other finger of a pinch to move too (they are told one by one). */
  pending: ReturnType<typeof setTimeout> | undefined;
  /** The fingers that have moved since the viewport last followed them. */
  movedSince: Set<number>;
  latest: PointerEvent;
  /** The taps it makes, as d3-zoom counts them: 2 is the second touch of a double tap. */
  taps: number;
}

/**
 * The fingers that are down on a pane, and the one gesture they make, as d3-zoom takes them: the
 * first two fingers pan or pinch, a finger that lifts hands over to the other, and the gesture is
 * over when the last one lifts.
 */
export interface Fingers {
  deps: PaneDeps;
  /** The canvas position of every finger that is down, in the order they went down. */
  touches: Map<number, Point>;
  gesture: Gesture | undefined;
  /** Called when a gesture ended after it moved, whose click is not a click on the pane. */
  onMovedAway: () => void;
  taps: Taps;
  /** Stops listening for the touch events of the pane. */
  forget: () => void;
}

export function createFingers(deps: PaneDeps, onMovedAway: () => void): Fingers {
  const taps = createTaps();
  const forget = cancelTakenTaps(deps.element, taps);
  return { deps, touches: new Map(), gesture: undefined, onMovedAway, taps, forget };
}

function canvasOf(deps: PaneDeps, event: { clientX: number; clientY: number }): Point {
  return clientToCanvas(deps.store, { x: event.clientX, y: event.clientY });
}

function pointsOf(fingers: Fingers, ids: readonly number[]): Point[] {
  return ids.flatMap((id) => fingers.touches.get(id) ?? []);
}

function sessionFor(fingers: Fingers, ids: readonly number[]): Session | undefined {
  const [first, second] = pointsOf(fingers, ids);
  if (first === undefined) {
    return undefined;
  }
  if (second === undefined) {
    return { pan: trackPan(fingers.deps.store, first) };
  }
  const { minZoom, maxZoom } = fingers.deps.store.getState();
  return { pinch: trackPinch(fingers.deps.store, [first, second], { minZoom, maxZoom }) };
}

// Notes that the viewport of the last move has been applied, whichever the fingers are doing.
function settle(session: Session): void {
  if ("pinch" in session) {
    session.pinch.settled();
  } else {
    session.pan.settled();
  }
}

// Starts the pan or pinch again from where the viewport and the fingers are now, as d3-zoom does
// whenever a finger goes down or lifts, so that nothing jumps.
function anchor(fingers: Fingers, gesture: Gesture): void {
  const session = sessionFor(fingers, gesture.taking);
  if (session !== undefined) {
    gesture.session = session;
  }
}

function nextViewport(fingers: Fingers, gesture: Gesture): Viewport | undefined {
  const [first, second] = pointsOf(fingers, gesture.taking);
  const { session } = gesture;
  if ("pinch" in session) {
    return first === undefined || second === undefined
      ? undefined
      : session.pinch.move([first, second]);
  }
  return first === undefined ? undefined : session.pan.move(first);
}

// Moves the viewport to where the fingers are now, and tells it.
function follow(fingers: Fingers, gesture: Gesture): void {
  clearTimeout(gesture.pending);
  gesture.pending = undefined;
  gesture.movedSince.clear();
  const next = nextViewport(fingers, gesture);
  if (next !== undefined) {
    try {
      moveForGesture(fingers.deps.store, next);
    } finally {
      // Also when the owner's `onViewportChange` throws: the viewport has moved by then.
      settle(gesture.session);
    }
    gesture.report.moved(gesture.latest);
  }
}

// Follows the fingers at once if the move that is waiting for the other fingers has not yet been.
function flush(fingers: Fingers): void {
  const { gesture } = fingers;
  if (gesture?.pending !== undefined) {
    follow(fingers, gesture);
  }
}

// Notes how far the fingers have gone, which decides whether the click that follows is a click.
function noteTravel(fingers: Fingers, gesture: Gesture, at: Point): void {
  const { paneClickDistance } = fingers.deps.view.getState();
  gesture.moved ||=
    Math.hypot(at.x - gesture.origin.x, at.y - gesture.origin.y) > paneClickDistance;
}

// One finger is followed at once. The fingers of a pinch move together but are told one by one, so
// the viewport follows them once each has moved (a touch event of React Flow's carries them all);
// when only one of them moves, it is followed in the next task.
function followOrWait(fingers: Fingers, gesture: Gesture, event: PointerEvent): void {
  gesture.latest = event;
  gesture.movedSince.add(event.pointerId);
  if (gesture.taking.every((id) => gesture.movedSince.has(id))) {
    follow(fingers, gesture);
    return;
  }
  gesture.pending ??= setTimeout(() => {
    follow(fingers, gesture);
  }, 0);
}

function fingerMoved(fingers: Fingers, event: PointerEvent): void {
  const at = canvasOf(fingers.deps, event);
  fingers.touches.set(event.pointerId, at);
  const { gesture } = fingers;
  if (gesture !== undefined && gesture.taking.includes(event.pointerId)) {
    noteTravel(fingers, gesture, at);
    followOrWait(fingers, gesture, event);
  }
}

// The last finger is gone: the gesture is over, and then (as with d3-zoom) a double tap zooms.
function endGesture(fingers: Fingers, gesture: Gesture, event: PointerEvent): void {
  fingers.gesture = undefined;
  if (gesture.moved) {
    fingers.onMovedAway();
  }
  gesture.report.end(event);
  tapEnded(fingers.deps, fingers.taps, { count: gesture.taps, up: event });
}

// A finger that moved the viewport lifts: the other one carries on, or the gesture is over.
function leaveGesture(fingers: Fingers, gesture: Gesture, event: PointerEvent): void {
  gesture.taking = gesture.taking.filter((id) => id !== event.pointerId);
  if (gesture.taking.length > 0) {
    anchor(fingers, gesture);
  } else {
    endGesture(fingers, gesture, event);
  }
}

function fingerLifted(fingers: Fingers, event: PointerEvent): void {
  // The moves that are waiting are followed while every finger is still there to say where it is.
  flush(fingers);
  fingers.touches.delete(event.pointerId);
  fingerUp(event.pointerId);
  const { gesture } = fingers;
  if (gesture !== undefined && gesture.taking.includes(event.pointerId)) {
    leaveGesture(fingers, gesture, event);
  }
}

/** Ends the gesture of the fingers that are down, as when the pane goes away under them. */
export function endFingers(fingers: Fingers): void {
  const { gesture } = fingers;
  fingers.forget();
  if (gesture !== undefined) {
    clearTimeout(gesture.pending);
    gesture.pending = undefined;
    fingers.gesture = undefined;
    gesture.report.end(null);
  }
}

/**
 * Remembers a finger that is down, wherever on the pane it went down, follows it, and forgets it
 * when it lifts. A finger on a node can be one of the two that pinch, as with d3-zoom, which pairs
 * the touches of the whole screen (`event.touches`) once a press that reaches it is not filtered out.
 */
export function rememberFinger(fingers: Fingers, down: PointerEvent): void {
  // Told once by React and once by the page for what a portal in the pane draws: taken once.
  if (fingers.touches.has(down.pointerId)) {
    return;
  }
  fingers.touches.set(down.pointerId, canvasOf(fingers.deps, down));
  // A double tap whose touch event never came (no touch events) cancels nothing later.
  fingers.taps.taken = false;
  fingerDown(down.pointerId);
  trackPointer(
    down,
    (event) => {
      fingerMoved(fingers, event);
    },
    (event) => {
      fingerLifted(fingers, event);
    },
  );
}

// The first fingers there are, in the order they went down, up to two (one with pinching off).
function takeFingers(fingers: Fingers, gesture: Gesture): void {
  const limit = fingers.deps.view.getState().zoomOnPinch ? 2 : 1;
  for (const id of fingers.touches.keys()) {
    if (gesture.taking.length < limit && !gesture.taking.includes(id)) {
      gesture.taking.push(id);
    }
  }
}

function startGesture(fingers: Fingers, down: PointerEvent): Gesture | undefined {
  const { deps } = fingers;
  cancelViewportAnimation(deps.store);
  const taking = [...fingers.touches.keys()].slice(0, deps.view.getState().zoomOnPinch ? 2 : 1);
  const session = sessionFor(fingers, taking);
  if (session === undefined) {
    return undefined;
  }
  return {
    report: beginViewportGesture(deps.store, down),
    session,
    taking,
    origin: canvasOf(deps, down),
    moved: false,
    pending: undefined,
    movedSince: new Set(),
    latest: down,
    taps: tapsOfStart(fingers.taps, down, taking.length),
  };
}

// A finger joins the gesture: a second finger that it takes makes it no tap, as with d3-zoom.
function joined(fingers: Fingers, gesture: Gesture): void {
  tapJoined(fingers.taps);
  if (gesture.taking.length > 1) {
    gesture.taps = 0;
  }
}

/**
 * A finger that the pane takes goes down: the first one starts the gesture (which is reported from
 * now, a tap included), and each one starts the pan or pinch again with the fingers there are.
 */
export function joinGesture(fingers: Fingers, down: PointerEvent): void {
  const ongoing = fingers.gesture !== undefined;
  fingers.gesture ??= startGesture(fingers, down);
  const { gesture } = fingers;
  if (gesture !== undefined) {
    flush(fingers);
    takeFingers(fingers, gesture);
    anchor(fingers, gesture);
    if (ongoing) {
      joined(fingers, gesture);
    }
  }
}
