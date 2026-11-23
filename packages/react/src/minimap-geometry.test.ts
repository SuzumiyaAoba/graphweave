import { describe, expect, it } from "vite-plus/test";

import { maskPath, miniMapView } from "./minimap-geometry.ts";

const ELEMENT = { width: 200, height: 150 };

describe("miniMapView", () => {
  it("frames the nodes and the visible area, with a margin", () => {
    const view = miniMapView({
      nodesBounds: { x: 0, y: 0, width: 400, height: 300 },
      visible: { x: 0, y: 0, width: 800, height: 600 },
      element: ELEMENT,
      offsetScale: 5,
    });
    expect(view).toStrictEqual({
      x: -20,
      y: -20,
      width: 840,
      height: 640,
      viewScale: 4,
      offset: 20,
    });
  });

  it("keeps the aspect ratio of the element and centres what is smaller", () => {
    const view = miniMapView({
      nodesBounds: { x: 0, y: 0, width: 1600, height: 300 },
      visible: { x: 0, y: 0, width: 400, height: 300 },
      element: ELEMENT,
      offsetScale: 5,
    });
    expect(view).toStrictEqual({
      x: -40,
      y: -490,
      width: 1680,
      height: 1280,
      viewScale: 8,
      offset: 40,
    });
    expect(view.width / view.height).toBeCloseTo(1680 / 1280);
  });

  it("shows just the visible area when there are no nodes", () => {
    const view = miniMapView({
      nodesBounds: undefined,
      visible: { x: 0, y: 0, width: 800, height: 600 },
      element: ELEMENT,
      offsetScale: 0,
    });
    expect(view).toStrictEqual({ x: 0, y: 0, width: 800, height: 600, viewScale: 4, offset: 0 });
  });

  it("still gives a usable scale when nothing has a size", () => {
    const view = miniMapView({
      nodesBounds: undefined,
      visible: { x: 0, y: 0, width: 0, height: 0 },
      element: ELEMENT,
      offsetScale: 5,
    });
    expect(view.viewScale).toBe(1);
    expect(view.width).toBe(210);
    expect(view.height).toBe(160);
  });
});

describe("maskPath", () => {
  it("covers the frame and cuts out the visible area", () => {
    const view = { x: -20, y: -20, width: 840, height: 640, viewScale: 4, offset: 20 };
    // The frame is the view with another `offset` all round.
    expect(maskPath(view, { x: 0, y: 0, width: 800, height: 600 })).toBe(
      "M-40,-40h880v680h-880z M0,0h800v600h-800z",
    );
  });
});
