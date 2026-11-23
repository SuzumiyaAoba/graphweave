import { describe, expect, it } from "vite-plus/test";

import { clampZoom, flowToScreen, screenToFlow, visibleRect, zoomAt } from "./camera.ts";

describe("screenToFlow / flowToScreen", () => {
  const viewport = { x: 100, y: 50, zoom: 2 };

  it("maps a screen point to flow coordinates", () => {
    expect(screenToFlow(viewport, { x: 300, y: 150 })).toStrictEqual({ x: 100, y: 50 });
  });

  it("maps a flow point to screen coordinates", () => {
    expect(flowToScreen(viewport, { x: 100, y: 50 })).toStrictEqual({ x: 300, y: 150 });
  });

  it("round-trips", () => {
    const point = { x: -37.5, y: 12.25 };

    expect(screenToFlow(viewport, flowToScreen(viewport, point))).toStrictEqual(point);
  });
});

describe("visibleRect", () => {
  it("returns the canvas area in flow coordinates", () => {
    expect(visibleRect({ x: -100, y: -50, zoom: 2 }, { width: 800, height: 600 })).toStrictEqual({
      x: 50,
      y: 25,
      width: 400,
      height: 300,
    });
  });

  it("grows when zooming out", () => {
    expect(visibleRect({ x: 10, y: 20, zoom: 0.5 }, { width: 800, height: 600 })).toStrictEqual({
      x: -20,
      y: -40,
      width: 1600,
      height: 1200,
    });
  });
});

describe("zoomAt", () => {
  it("keeps the anchored flow point fixed on screen", () => {
    const viewport = { x: 30, y: -20, zoom: 1 };
    const anchor = { x: 400, y: 300 };
    const flow = screenToFlow(viewport, anchor);

    const zoomed = zoomAt(viewport, anchor, 2.5);
    const after = flowToScreen(zoomed, flow);

    expect(zoomed.zoom).toBe(2.5);
    expect(after.x).toBeCloseTo(anchor.x);
    expect(after.y).toBeCloseTo(anchor.y);
  });
});

describe("invalid zoom", () => {
  const point = { x: 1, y: 1 };
  const size = { width: 800, height: 600 };

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    "is rejected by every conversion (zoom %f)",
    (zoom) => {
      const viewport = { x: 0, y: 0, zoom };

      expect(() => screenToFlow(viewport, point)).toThrow(RangeError);
      expect(() => flowToScreen(viewport, point)).toThrow(RangeError);
      expect(() => visibleRect(viewport, size)).toThrow(RangeError);
      expect(() => zoomAt({ x: 0, y: 0, zoom: 1 }, point, zoom)).toThrow(RangeError);
    },
  );
});

describe("clampZoom", () => {
  it("limits the zoom to the range", () => {
    expect(clampZoom(0.01, 0.1, 4)).toBe(0.1);
    expect(clampZoom(10, 0.1, 4)).toBe(4);
    expect(clampZoom(1, 0.1, 4)).toBe(1);
  });

  it("rejects NaN and an inverted range", () => {
    expect(() => clampZoom(Number.NaN, 0.1, 4)).toThrow(RangeError);
    expect(() => clampZoom(1, 4, 0.1)).toThrow(RangeError);
  });
});
