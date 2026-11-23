import { currentViewport, sameViewport, startPan, startPinch } from "@free-flow/core";
import type { Point, Viewport, ZoomLimits } from "@free-flow/core";

/** What a gesture reads the viewport from: any store of a flow. */
interface ViewportSource {
  getState: () => Parameters<typeof currentViewport>[0];
}

/** The pointer positions a gesture works from: one for a pan, two for a pinch. */
type Pair = readonly [Point, Point];

interface Moves<TPoints> {
  move: (points: TPoints) => Viewport;
}

/** A gesture that notes the viewport it has produced, to know when somebody else has moved it since. */
export interface Tracked<TPoints> extends Moves<TPoints> {
  /** Call once the viewport of the last `move` has been applied (or has failed to be). */
  settled: () => void;
}

export type TrackedPan = Tracked<Point>;
export type TrackedPinch = Tracked<Pair>;

/**
 * A gesture that goes on from where the viewport is when it was moved from outside between two
 * moves (an owner that holds the viewport and hands back another one, say), as d3-zoom's does: from
 * there the pointers' travel since their last move is added. A viewport that the gesture produced
 * itself, and that was held to a limit, is not "moved from outside": the gesture stays where it began.
 */
function track<TPoints>(
  store: ViewportSource,
  first: TPoints,
  begin: (viewport: Viewport, points: TPoints) => Moves<TPoints>,
): Tracked<TPoints> {
  const start = currentViewport(store.getState());
  let session = begin(start, first);
  let applied = start;
  let last = first;
  let latest = first;
  return {
    move: (points) => {
      const now = currentViewport(store.getState());
      if (!sameViewport(now, applied)) {
        session = begin(now, last);
      }
      latest = points;
      return session.move(points);
    },
    settled: () => {
      applied = currentViewport(store.getState());
      last = latest;
    },
  };
}

/** A pan from `origin`, starting from the viewport the store holds now. */
export function trackPan(store: ViewportSource, origin: Point): TrackedPan {
  return track(store, origin, startPan);
}

/** A pinch of two pointers, starting from the viewport the store holds now. */
export function trackPinch(
  store: ViewportSource,
  pointers: Pair,
  limits: ZoomLimits,
): TrackedPinch {
  return track(store, pointers, (viewport, points) => startPinch(viewport, points, limits));
}
