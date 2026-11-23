import { clampViewport, currentViewport } from "@free-flow/core";
import type { CoordinateExtent, Viewport } from "@free-flow/core";

import type { ViewportHelperOptions } from "./instance-types.ts";
import { motionOf } from "./instance-viewport.ts";
import { noop } from "./noop.ts";
import type { ReactFlowStore } from "./store-context.ts";
import type { ViewPropsStore } from "./view-props.ts";
import { runViewportChange } from "./viewport-animation.ts";
import { syncHeldViewport } from "./viewport-events.ts";

/**
 * What React Flow's store keeps as `panZoom`: the pan and zoom of the canvas as an object, which
 * code written for it calls (`store.getState().panZoom?.setViewport(...)`). It acts on this flow's
 * viewport; `update` and `destroy` have nothing to do here.
 */
export interface PanZoomInstance {
  update: (params: unknown) => void;
  destroy: () => void;
  getViewport: () => Viewport;
  setViewport: (viewport: Viewport, options?: ViewportHelperOptions) => Promise<Viewport>;
  /** Sets the viewport kept inside `translateExtent`; the visible `extent` is the canvas itself. */
  setViewportConstrained: (
    viewport: Viewport,
    extent: CoordinateExtent,
    translateExtent: CoordinateExtent,
  ) => Promise<Viewport>;
  syncViewport: (viewport: Viewport) => void;
  scaleTo: (zoom: number, options?: ViewportHelperOptions) => Promise<boolean>;
  scaleBy: (factor: number, options?: ViewportHelperOptions) => Promise<boolean>;
  setScaleExtent: (extent: readonly [number, number]) => void;
  setTranslateExtent: (extent: CoordinateExtent) => void;
  setClickDistance: (distance: number) => void;
}

/** The pan and zoom of a flow as the object React Flow's store has. */
export function createPanZoom(store: ReactFlowStore, view: ViewPropsStore): PanZoomInstance {
  const setViewport = async (
    viewport: Viewport,
    options?: ViewportHelperOptions,
  ): Promise<Viewport> => {
    await runViewportChange(
      store,
      () => store.getState().setViewportAsGiven(viewport),
      motionOf(options),
    );
    return currentViewport(store.getState());
  };
  const scaleTo = async (zoom: number, options?: ViewportHelperOptions): Promise<boolean> => {
    const done = await runViewportChange(
      store,
      () => store.getState().zoomTo(zoom),
      motionOf(options),
    );
    return done;
  };
  return {
    update: noop,
    destroy: noop,
    getViewport: () => currentViewport(store.getState()),
    setViewport,
    setViewportConstrained: async (viewport, _extent, translateExtent) => {
      const { width, height } = store.getState();
      const set = await setViewport(clampViewport(viewport, { width, height }, translateExtent));
      return set;
    },
    syncViewport: (viewport) => {
      syncHeldViewport(store, viewport);
    },
    scaleTo,
    scaleBy: async (factor, options) => {
      const done = await scaleTo(currentViewport(store.getState()).zoom * factor, options);
      return done;
    },
    setScaleExtent: ([minZoom, maxZoom]) => {
      store.setState({ minZoom, maxZoom });
    },
    setTranslateExtent: (translateExtent) => {
      store.setState({ translateExtent });
    },
    setClickDistance: (paneClickDistance) => {
      view.setState({ paneClickDistance });
    },
  };
}
