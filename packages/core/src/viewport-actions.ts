import type { Viewport } from "./camera.ts";
import { clampZoom, zoomAt, sameViewport } from "./camera.ts";
import type { InternalNode } from "./flow-state.ts";
import type { FlowActions, FlowStore, FlowStoreState } from "./flow-store-types.ts";
import { HALF } from "./geometry.ts";
import type { Point, Rect } from "./geometry.ts";
import { getBoundsOfRects, nodeSize } from "./graph.ts";
import type {
  CoordinateExtent,
  EdgeBase,
  FitBoundsOptions,
  FitViewOptions,
  NodeBase,
  Transform,
} from "./types.ts";
import { DEFAULT_FIT_PADDING, clampViewport, getViewportForBounds } from "./viewport.ts";

const ZOOM_STEP = 1.2;
const MIN_POSITIVE_ZOOM = 1e-4;
type ViewportActionNames =
  | "setSize"
  | "setViewport"
  | "setViewportAsGiven"
  | "syncViewport"
  | "panBy"
  | "zoomTo"
  | "zoomIn"
  | "zoomOut"
  | "fitView"
  | "fitBounds"
  | "setCenter";

function isFinite2D(extent: CoordinateExtent): boolean {
  return extent.every((corner) => corner.every((value) => Number.isFinite(value)));
}

/** What is drawn for a viewport: the viewport, and the same as the `[x, y, zoom]` React Flow's store keeps. */
export function drawn(viewport: Viewport): { viewport: Viewport; transform: Transform } {
  return { viewport, transform: [viewport.x, viewport.y, viewport.zoom] };
}

/**
 * The viewport a gesture goes on from: where the user has moved it to, which is not what is drawn
 * while the owner holds the viewport and has not handed the move back yet.
 */
export function currentViewport(state: {
  viewport: Viewport;
  pendingViewport: Viewport | undefined;
}): Viewport {
  return state.pendingViewport ?? state.viewport;
}

// The zoom is bounded by the configured range, the translation by `translateExtent` when that is
// finite and the canvas has been measured.
function constrain<TNode extends NodeBase, TEdge extends EdgeBase>(
  state: FlowStoreState<TNode, TEdge>,
  viewport: Viewport,
): Viewport {
  // A pan keeps the zoom it has, also one that lies outside a range that was narrowed since (as
  // d3-zoom, which holds only a new scale to its extent). A zoom of zero has no inverse, so the
  // floor is a hair above it even when `minZoom` is 0.
  const zoom =
    viewport.zoom === currentViewport(state).zoom && viewport.zoom >= MIN_POSITIVE_ZOOM
      ? viewport.zoom
      : clampZoom(viewport.zoom, Math.max(state.minZoom, MIN_POSITIVE_ZOOM), state.maxZoom);
  const candidate = { x: viewport.x, y: viewport.y, zoom };
  if (!isFinite2D(state.translateExtent) || state.width <= 0 || state.height <= 0) {
    return candidate;
  }
  return clampViewport(
    candidate,
    { width: state.width, height: state.height },
    state.translateExtent,
  );
}

// Takes the viewport to `next`, as it is: the caller has decided what it may be.
function moveViewport<TNode extends NodeBase, TEdge extends EdgeBase>(
  api: FlowStore<TNode, TEdge>,
  next: Viewport,
): boolean {
  const state = api.getState();
  if (sameViewport(currentViewport(state), next)) {
    return false;
  }
  api.setState(state.viewportControlled ? { pendingViewport: next } : drawn(next));
  state.onViewportChange?.(next);
  return true;
}

// The viewport of a pan or a zoom: held to the range of the zoom and to `translateExtent`.
function setViewport<TNode extends NodeBase, TEdge extends EdgeBase>(
  api: FlowStore<TNode, TEdge>,
  viewport: Viewport,
): boolean {
  return moveViewport(api, constrain(api.getState(), viewport));
}

// The viewport that was asked for, however far it lies: React Flow's `setViewport`, `setCenter`,
// `fitBounds` and `fitView` are not held to `translateExtent` or to the range of the zoom (a
// fit still keeps its own zoom between the limits).
function setViewportAsGiven<TNode extends NodeBase, TEdge extends EdgeBase>(
  api: FlowStore<TNode, TEdge>,
  viewport: Viewport,
): boolean {
  return moveViewport(api, viewport);
}

// Takes over the viewport the owner holds. One that is drawn already, with no move of the user's
// waiting for the owner's answer, is left alone (as React Flow's `syncViewport` does), so an owner
// that hands in a fresh object with the same numbers on every render, or feeds `useViewport()` back
// in, does not make the flow tell its listeners again and again.
function syncViewport<TNode extends NodeBase, TEdge extends EdgeBase>(
  api: FlowStore<TNode, TEdge>,
  viewport: Viewport,
): void {
  const state = api.getState();
  if (state.pendingViewport === undefined && sameViewport(state.viewport, viewport)) {
    return;
  }
  api.setState({ ...drawn(viewport), pendingViewport: undefined });
}

function zoomTo<TNode extends NodeBase, TEdge extends EdgeBase>(
  api: FlowStore<TNode, TEdge>,
  zoom: number,
  anchor?: Point,
): boolean {
  const state = api.getState();
  const { width, height, minZoom, maxZoom } = state;
  const about = anchor ?? { x: width * HALF, y: height * HALF };
  return setViewport(api, zoomAt(currentViewport(state), about, clampZoom(zoom, minZoom, maxZoom)));
}

// Frames `bounds`, within the zoom limits of the flow narrowed by those given (only a fit of the view
// gives them: React Flow's fitBounds keeps to the limits of the flow).
function fitBounds<TNode extends NodeBase, TEdge extends EdgeBase>(
  api: FlowStore<TNode, TEdge>,
  bounds: Rect,
  options: FitBoundsOptions & { minZoom?: number | undefined; maxZoom?: number | undefined } = {},
): boolean {
  const { width, height, minZoom, maxZoom } = api.getState();
  if (width <= 0 || height <= 0) {
    return false;
  }
  const viewport = getViewportForBounds(
    bounds,
    width,
    height,
    options.minZoom ?? minZoom,
    options.maxZoom ?? maxZoom,
    options.padding ?? DEFAULT_FIT_PADDING,
  );
  return setViewportAsGiven(api, viewport);
}

function isFitCandidate(
  internal: InternalNode,
  wanted: ReadonlySet<string> | undefined,
  options: FitViewOptions,
): boolean {
  const included = wanted === undefined || wanted.has(internal.id);
  return included && (options.includeHiddenNodes === true || internal.hidden !== true);
}

// The rectangles of the nodes a fit should include; nodes that have no size yet cannot be framed.
function rectsToFit<TNode extends NodeBase, TEdge extends EdgeBase>(
  state: FlowStoreState<TNode, TEdge>,
  options: FitViewOptions,
): Rect[] {
  const wanted =
    options.nodes === undefined ? undefined : new Set(options.nodes.map(({ id }) => id));
  const rects: Rect[] = [];
  for (const internal of state.nodeLookup.values()) {
    const { width, height } = nodeSize(internal);
    if (isFitCandidate(internal, wanted, options) && width > 0 && height > 0) {
      rects.push({ ...internal.internals.positionAbsolute, width, height });
    }
  }
  return rects;
}

// Frames the nodes. When there is nothing to frame yet (no measured node, or a canvas without a
// size) the request is queued, and the store runs it as soon as that changes.
function fitView<TNode extends NodeBase, TEdge extends EdgeBase>(
  api: FlowStore<TNode, TEdge>,
  options: FitViewOptions = {},
  asked = false,
): boolean {
  const state = api.getState();
  const rects = rectsToFit(state, options);
  const sized = state.width > 0 && state.height > 0;
  // Nodes that are all measured, none of which is to be framed: as in React Flow a fit that is asked
  // for is made all the same, of a box of no size at the origin (the fit a flow starts with waits).
  const none = asked && rects.length === 0 && state.nodesInitialized && state.nodeLookup.size > 0;
  if (!sized || (rects.length === 0 && !none)) {
    api.setState({ fitViewQueued: true, fitViewOptions: options });
    return false;
  }
  api.setState({ fitViewQueued: false, fitViewOptions: undefined });
  const bounds = none ? { x: 0, y: 0, width: 0, height: 0 } : getBoundsOfRects(rects);
  return fitBounds(api, bounds, options);
}

function setCenter<TNode extends NodeBase, TEdge extends EdgeBase>(
  api: FlowStore<TNode, TEdge>,
  point: Point,
  zoom?: number,
): boolean {
  const state = api.getState();
  // Without a zoom of its own the centre is shown at the highest zoom, as in React Flow.
  const nextZoom = zoom ?? state.maxZoom;
  const { width, height } = state;
  return setViewportAsGiven(api, {
    x: width * HALF - point.x * nextZoom,
    y: height * HALF - point.y * nextZoom,
    zoom: nextZoom,
  });
}

function zoomBy<TNode extends NodeBase, TEdge extends EdgeBase>(
  api: FlowStore<TNode, TEdge>,
  factor: number,
  anchor?: Point,
): boolean {
  return zoomTo(api, currentViewport(api.getState()).zoom * factor, anchor);
}

// The first time the canvas has a size the viewport it starts with is held inside `translateExtent`,
// as React Flow does when its pane is set up (later resizes leave the viewport where it is).
function setSize<TNode extends NodeBase, TEdge extends EdgeBase>(
  api: FlowStore<TNode, TEdge>,
  width: number,
  height: number,
): void {
  const before = api.getState();
  api.setState({ width, height });
  const sizeAppeared = (before.width <= 0 || before.height <= 0) && width > 0 && height > 0;
  if (sizeAppeared && !before.viewportControlled) {
    const settled = constrain(api.getState(), currentViewport(before));
    if (!sameViewport(currentViewport(before), settled)) {
      api.setState(drawn(settled));
    }
  }
}

export function createViewportActions<TNode extends NodeBase, TEdge extends EdgeBase>(
  api: FlowStore<TNode, TEdge>,
): Pick<FlowActions<TNode, TEdge>, ViewportActionNames> {
  return {
    setSize: (width, height) => {
      setSize(api, width, height);
    },
    setViewport: (viewport) => setViewport(api, viewport),
    setViewportAsGiven: (viewport) => setViewportAsGiven(api, viewport),
    syncViewport: (viewport) => {
      syncViewport(api, viewport);
    },
    panBy: (delta) => {
      const viewport = currentViewport(api.getState());
      return setViewport(api, { ...viewport, x: viewport.x + delta.x, y: viewport.y + delta.y });
    },
    zoomTo: (zoom, anchor) => zoomTo(api, zoom, anchor),
    zoomIn: (anchor) => zoomBy(api, ZOOM_STEP, anchor),
    zoomOut: (anchor) => zoomBy(api, 1 / ZOOM_STEP, anchor),
    fitView: (options, asked) => fitView(api, options, asked),
    fitBounds: (bounds, options) =>
      fitBounds(api, bounds, {
        padding: options?.padding,
        duration: options?.duration,
        ease: options?.ease,
        interpolate: options?.interpolate,
      }),
    setCenter: (x, y, options) => setCenter(api, { x, y }, options?.zoom),
  };
}
