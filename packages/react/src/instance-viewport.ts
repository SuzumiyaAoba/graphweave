import { flowToScreen, screenToFlow, snapToGrid } from "@graphweave/core";
import type {
  FitBoundsOptions,
  FitViewOptions,
  Rect,
  Viewport,
  XYPosition,
} from "@graphweave/core";

import { flushBatch } from "./batch-queue.ts";
import { getFlowElement } from "./dom-registry.ts";
import { waitForQueuedFit } from "./fit-view-wait.ts";
import type {
  ReactFlowInstance,
  SetCenterOptions,
  ViewportHelperOptions,
} from "./instance-types.ts";
import type { ReactFlowStore } from "./store-context.ts";
import { runViewportChange } from "./viewport-animation.ts";
import type { Motion } from "./viewport-animation.ts";

type ViewportMethodNames =
  | "fitView"
  | "zoomIn"
  | "zoomOut"
  | "zoomTo"
  | "getZoom"
  | "setViewport"
  | "getViewport"
  | "setCenter"
  | "fitBounds"
  | "screenToFlowPosition"
  | "flowToScreenPosition";

// Where the canvas is on the page; a position on the page is measured from here.
function canvasOrigin(store: ReactFlowStore): XYPosition {
  const rect = getFlowElement(store)?.getBoundingClientRect();
  return { x: rect?.left ?? 0, y: rect?.top ?? 0 };
}

interface Plan {
  change: () => boolean;
  motion: Motion;
}

// How the move is animated, from the options the method was given.
export function motionOf(options: ViewportHelperOptions | undefined): Motion {
  return { duration: options?.duration, ease: options?.ease, interpolate: options?.interpolate };
}

// Turns a description of a viewport change into the instance method that performs it, animated if
// a duration is given. As in React Flow the method resolves to `true` once the change has been made,
// also when it left the viewport where it was (and to `false` when an animation was interrupted).
// React Flow makes the change through the pan and zoom of the flow on the page: before there is one
// (a provider whose flow is not rendered yet) nothing is done, and the method resolves to `false`.
function viewportMethod<TArgs extends unknown[]>(
  store: ReactFlowStore,
  plan: (...args: TArgs) => Plan,
): (...args: TArgs) => Promise<boolean> {
  return async (...args) => {
    if (store.getState().panZoom === null) {
      return false;
    }
    const { change, motion } = plan(...args);
    const done = await runViewportChange(store, change, motion);
    return done;
  };
}

// A fit the instance was asked for and has not made yet: the options of the last call win.
interface PendingFit {
  options: FitViewOptions | undefined;
  done: Promise<boolean>;
}

const pendingFits = new WeakMap<ReactFlowStore, PendingFit>();

// The instance's `fitView`, which settles with `true` once the fit has been made, as React Flow's
// does (also when the viewport was already there): a fit that has to wait for the nodes waits.
// Like React Flow's, the fit is queued: it is made once what the running code asked for has been,
// so that a `setViewport` called right after it is fitted over, and fits asked for together are
// made once. The nodes queued before it are put in first, so that a `setNodes` just before is framed.
function fitViewMethod(store: ReactFlowStore): (options?: FitViewOptions) => Promise<boolean> {
  const fitNow = viewportMethod(store, (options?: FitViewOptions): Plan => ({
    change: () => store.getState().fitView(options, true),
    motion: motionOf(options),
  }));
  // Made one microtask after the first call: what the running code asks for until then is done first.
  const makeFit = async (entry: PendingFit): Promise<boolean> => {
    await Promise.resolve();
    pendingFits.delete(store);
    if (flushBatch(store).nodesToCome) {
      // The owner was handed new nodes: as in React Flow, the fit waits for them to come back.
      store.setState({ fitViewQueued: true, fitViewOptions: entry.options });
      return true;
    }
    const done = await fitNow(entry.options);
    return done;
  };
  const queueFit = async (options: FitViewOptions | undefined): Promise<boolean> => {
    const pending = pendingFits.get(store);
    if (pending !== undefined) {
      pending.options = options;
      const merged = await pending.done;
      return merged;
    }
    const entry: PendingFit = { options, done: Promise.resolve(true) };
    entry.done = makeFit(entry);
    pendingFits.set(store, entry);
    const done = await entry.done;
    return done;
  };
  return async (options?: FitViewOptions): Promise<boolean> => {
    if (store.getState().panZoom === null) {
      // As in React Flow, a fit asked for before the flow is on the page waits for it and its nodes.
      store.setState({ fitViewQueued: true, fitViewOptions: options });
    } else {
      await queueFit(options);
    }
    if (store.getState().fitViewQueued) {
      await waitForQueuedFit(store);
    }
    return true;
  };
}

/** The viewport methods of the instance. */
export function createViewportInstance(
  store: ReactFlowStore,
): Pick<ReactFlowInstance, ViewportMethodNames> {
  return {
    fitView: fitViewMethod(store),
    zoomIn: viewportMethod(store, (options) => ({
      change: () => store.getState().zoomIn(),
      motion: motionOf(options),
    })),
    zoomOut: viewportMethod(store, (options) => ({
      change: () => store.getState().zoomOut(),
      motion: motionOf(options),
    })),
    zoomTo: viewportMethod(store, (zoom: number, options?: ViewportHelperOptions) => ({
      change: () => store.getState().zoomTo(zoom),
      motion: motionOf(options),
    })),
    getZoom: () => store.getState().viewport.zoom,
    setViewport: viewportMethod(store, (viewport: Viewport, options?: ViewportHelperOptions) => ({
      change: () => store.getState().setViewportAsGiven(viewport),
      motion: motionOf(options),
    })),
    getViewport: () => store.getState().viewport,
    setCenter: viewportMethod(store, (x: number, y: number, options?: SetCenterOptions) => ({
      change: () => store.getState().setCenter(x, y, options),
      motion: motionOf(options),
    })),
    fitBounds: viewportMethod(store, (bounds: Rect, options?: FitBoundsOptions) => ({
      change: () => store.getState().fitBounds(bounds, options),
      motion: motionOf(options),
    })),
    screenToFlowPosition: (position, options) => {
      const state = store.getState();
      const origin = canvasOrigin(store);
      const flow = screenToFlow(state.viewport, {
        x: position.x - origin.x,
        y: position.y - origin.y,
      });
      const grid = options?.snapGrid ?? state.snapGrid;
      return (options?.snapToGrid ?? state.snapToGrid) ? snapToGrid(flow, grid) : flow;
    },
    flowToScreenPosition: (position) => {
      const origin = canvasOrigin(store);
      const screen = flowToScreen(store.getState().viewport, position);
      return { x: screen.x + origin.x, y: screen.y + origin.y };
    },
  };
}
