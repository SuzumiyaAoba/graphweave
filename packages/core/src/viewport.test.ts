import { describe, expect, it } from "vite-plus/test";

import { visibleRect } from "./camera.ts";
import { clampViewport, getViewportForBounds, snapToGrid } from "./viewport.ts";

describe("getViewportForBounds", () => {
  it("centres the bounds and zooms to fit the tighter axis with the padding", () => {
    const viewport = getViewportForBounds(
      { x: 0, y: 0, width: 100, height: 50 },
      1100,
      1000,
      0.1,
      10,
      0.1,
    );
    expect(viewport.zoom).toBeCloseTo(10);
    expect(viewport.x).toBeCloseTo(1100 / 2 - 50 * 10);
    expect(viewport.y).toBeCloseTo(1000 / 2 - 25 * 10);
  });

  it("clamps the zoom, and still centres the bounds", () => {
    const viewport = getViewportForBounds(
      { x: 10, y: 10, width: 1, height: 1 },
      800,
      600,
      0.5,
      2,
      0,
    );
    expect(viewport.zoom).toBe(2);
    expect(viewport.x).toBeCloseTo(400 - 10.5 * 2);
    expect(viewport.y).toBeCloseTo(300 - 10.5 * 2);
    expect(
      getViewportForBounds({ x: 0, y: 0, width: 1e6, height: 1e6 }, 800, 600, 0.5, 2, 0).zoom,
    ).toBe(0.5);
  });

  it("frames the bounds fully inside the canvas", () => {
    const bounds = { x: -300, y: 120, width: 640, height: 220 };
    const size = { width: 900, height: 500 };
    const viewport = getViewportForBounds(bounds, size.width, size.height, 0.01, 4, 0.2);
    const visible = visibleRect(viewport, size);
    expect(visible.x).toBeLessThanOrEqual(bounds.x);
    expect(visible.y).toBeLessThanOrEqual(bounds.y);
    expect(visible.x + visible.width).toBeGreaterThanOrEqual(bounds.x + bounds.width);
    expect(visible.y + visible.height).toBeGreaterThanOrEqual(bounds.y + bounds.height);
  });

  it("falls back to the maximum zoom for empty bounds", () => {
    expect(getViewportForBounds({ x: 0, y: 0, width: 0, height: 0 }, 800, 600, 0.5, 2).zoom).toBe(
      2,
    );
  });
});

describe("clampViewport", () => {
  const size = { width: 100, height: 100 };
  const extent = [
    [0, 0],
    [400, 400],
  ] as const;

  it("leaves a viewport that is inside the extent alone", () => {
    const viewport = { x: -50, y: -50, zoom: 1 };
    expect(clampViewport(viewport, size, extent)).toStrictEqual(viewport);
  });

  it("pulls a viewport back when it shows space beyond the extent", () => {
    expect(clampViewport({ x: 30, y: 20, zoom: 1 }, size, extent)).toStrictEqual({
      x: 0,
      y: 0,
      zoom: 1,
    });
    expect(clampViewport({ x: -900, y: -900, zoom: 1 }, size, extent)).toStrictEqual({
      x: -300,
      y: -300,
      zoom: 1,
    });
  });

  it("accounts for the zoom", () => {
    expect(clampViewport({ x: 10, y: 10, zoom: 2 }, size, extent)).toStrictEqual({
      x: 0,
      y: 0,
      zoom: 2,
    });
    expect(clampViewport({ x: -9999, y: -9999, zoom: 2 }, size, extent)).toStrictEqual({
      x: -700,
      y: -700,
      zoom: 2,
    });
  });

  it("centres the extent when the canvas is larger than it", () => {
    const viewport = clampViewport({ x: 0, y: 0, zoom: 0.1 }, size, extent);
    expect(viewport.x).toBeCloseTo(100 / 2 - 200 * 0.1);
    expect(viewport.y).toBeCloseTo(100 / 2 - 200 * 0.1);
  });
});

describe("snapToGrid", () => {
  it("rounds each axis to its grid step", () => {
    expect(snapToGrid({ x: 14, y: 26 }, [10, 20])).toStrictEqual({ x: 10, y: 20 });
    expect(snapToGrid({ x: 15, y: -31 }, [10, 20])).toStrictEqual({ x: 20, y: -40 });
  });

  it("leaves an axis alone when its step is not positive", () => {
    expect(snapToGrid({ x: 14.3, y: 26 }, [0, 20])).toStrictEqual({ x: 14.3, y: 20 });
  });
});

describe("getViewportForBounds without room", () => {
  it("takes the largest zoom for bounds with no size on an axis the padding fills", () => {
    // 50% padding takes all 800 px of the width, which a width of 0 cannot be divided into: 0 / 0.
    const viewport = getViewportForBounds(
      { x: 100, y: 100, width: 0, height: 50 },
      800,
      600,
      0.5,
      2,
      "50%",
    );
    expect(viewport.zoom).toBe(2);
    expect(Number.isFinite(viewport.x)).toBe(true);
    expect(Number.isFinite(viewport.y)).toBe(true);
  });
});
