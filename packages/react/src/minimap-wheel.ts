import { PINCH_BOOST, currentViewport, wheelZoomStep } from "@graphweave/core";
import { useEffect, useRef } from "react";
import type { RefObject } from "react";

import { noop } from "./noop.ts";
import { useStoreApi } from "./use-store.ts";
import { isMac } from "./view-props.ts";
import { changeViewportNow } from "./viewport-animation.ts";

/** Zooms the flow with the wheel over the map, when the map is `zoomable`. */
export function useMiniMapWheel(
  svgRef: RefObject<SVGSVGElement | null>,
  zoomable: boolean,
  zoomStep: number,
): void {
  const store = useStoreApi();
  const wheelStep = useRef({ zoomable, zoomStep });
  useEffect(() => {
    wheelStep.current = { zoomable, zoomStep };
  }, [zoomable, zoomStep]);
  useEffect(() => {
    const svg = svgRef.current;
    if (svg === null) {
      return noop;
    }
    const onWheel = (event: WheelEvent): void => {
      // A wheel that only scrolls sideways is no zoom, as with d3-zoom: left to the page.
      if (!wheelStep.current.zoomable || event.deltaY === 0) {
        return;
      }
      event.preventDefault();
      const { zoom } = currentViewport(store.getState());
      const boost = event.ctrlKey && isMac() ? PINCH_BOOST : 1;
      const exponent =
        -event.deltaY * wheelZoomStep(event.deltaMode) * wheelStep.current.zoomStep * boost;
      // As a call: a wheel that the limit of the zoom leaves where it was is told all the same.
      changeViewportNow(store, () => store.getState().zoomTo(zoom * 2 ** exponent));
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return (): void => {
      svg.removeEventListener("wheel", onWheel);
    };
  }, [store, svgRef]);
}
