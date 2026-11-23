import { describe, expect, it } from "vite-plus/test";

import { createFlowStore } from "./flow-store.ts";

// Measured against the real library: with a `translateExtent` and a range of the zoom, React Flow's
// `setViewport`, `setCenter`, `fitBounds` and `fitView` give the viewport that was asked for, while
// panning and zooming (`zoomTo`, `panBy`) are held to both.
function limited(): ReturnType<typeof createFlowStore> {
  return createFlowStore({
    width: 1280,
    height: 800,
    minZoom: 0.8,
    maxZoom: 1.5,
    translateExtent: [
      [-100, -100],
      [900, 700],
    ],
    viewport: { x: 240, y: 100, zoom: 1 },
  });
}

describe("the viewport that is asked for, past the limits", () => {
  it("is taken by setViewportAsGiven as it is, the zoom and the translation alike", () => {
    const store = limited();
    store.getState().setViewportAsGiven({ x: -5000, y: 3000, zoom: 10 });
    expect(store.getState().viewport).toStrictEqual({ x: -5000, y: 3000, zoom: 10 });
  });

  it("is still held to the limits by setViewport, which pans and zooms use", () => {
    const store = limited();
    store.getState().setViewport({ x: -5000, y: 3000, zoom: 10 });
    expect(store.getState().viewport).toStrictEqual({ x: -70, y: 150, zoom: 1.5 });
  });

  it("is taken by setCenter as it is, with the zoom it is given", () => {
    const store = limited();
    store.getState().setCenter(5000, 5000, { zoom: 1 });
    expect(store.getState().viewport).toStrictEqual({ x: -4360, y: -4600, zoom: 1 });
    store.getState().setCenter(50, 50, { zoom: 5 });
    expect(store.getState().viewport).toStrictEqual({ x: 390, y: 150, zoom: 5 });
  });

  it("is taken by fitBounds with a zoom within the range but a translation as it comes", () => {
    const store = limited();
    store.getState().fitBounds({ x: 0, y: 0, width: 3000, height: 2000 });
    expect(store.getState().viewport).toStrictEqual({ x: -560, y: -400, zoom: 0.8 });
    store.getState().fitBounds({ x: 10, y: 10, width: 20, height: 20 });
    expect(store.getState().viewport).toStrictEqual({ x: 610, y: 370, zoom: 1.5 });
  });

  it("is held to the limits by zoomTo", () => {
    const store = limited();
    store.getState().zoomTo(5);
    expect(store.getState().viewport.zoom).toBe(1.5);
    store.getState().zoomTo(0.1);
    expect(store.getState().viewport).toStrictEqual({ x: 320, y: 160, zoom: 0.8 });
  });
});
