import { describe, expect, it } from "vite-plus/test";

import { screenToFlow } from "./camera.ts";
import type { Viewport } from "./camera.ts";
import { applyWheel, startPan, startPinch, wheelAction } from "./pan-zoom.ts";
import type { WheelInput, WheelOptions } from "./pan-zoom.ts";
import { PanOnScrollMode } from "./types.ts";

const ORIGIN: Viewport = { x: 0, y: 0, zoom: 1 };

const OPTIONS: WheelOptions = {
  zoomOnScroll: true,
  zoomOnPinch: true,
  panOnScroll: false,
  panOnScrollSpeed: 0.5,
  panOnScrollMode: PanOnScrollMode.Free,
  zoomActivationKeyPressed: false,
  macOs: false,
  minZoom: 0.1,
  maxZoom: 4,
};

function wheel(extra: Partial<WheelInput> = {}): WheelInput {
  return {
    deltaX: 0,
    deltaY: 0,
    deltaMode: 0,
    ctrlKey: false,
    shiftKey: false,
    point: { x: 100, y: 100 },
    ...extra,
  };
}

// The viewport a wheel event produces; the test fails if the event does not move it.
function zoomed(input: WheelInput, options: WheelOptions = OPTIONS): Viewport {
  const next = applyWheel(ORIGIN, input, options);
  if (next === undefined) {
    throw new Error("the wheel event did not move the viewport");
  }
  return next;
}

describe("wheelAction", () => {
  it("zooms on a plain wheel by default and ignores it when zoomOnScroll is off", () => {
    expect(wheelAction(wheel(), OPTIONS)).toBe("zoom");
    expect(wheelAction(wheel(), { ...OPTIONS, zoomOnScroll: false })).toBe("none");
  });

  it("treats a ctrl wheel as a pinch that only zoomOnPinch allows", () => {
    expect(wheelAction(wheel({ ctrlKey: true }), OPTIONS)).toBe("zoom");
    expect(wheelAction(wheel({ ctrlKey: true }), { ...OPTIONS, zoomOnPinch: false })).toBe("none");
    expect(wheelAction(wheel({ ctrlKey: true }), { ...OPTIONS, zoomOnScroll: false })).toBe("zoom");
  });

  it("pans on scroll when asked, but still zooms on a pinch", () => {
    const panning = { ...OPTIONS, panOnScroll: true };
    expect(wheelAction(wheel(), panning)).toBe("pan");
    expect(wheelAction(wheel({ ctrlKey: true }), panning)).toBe("zoom");
    expect(wheelAction(wheel({ ctrlKey: true }), { ...panning, zoomOnPinch: false })).toBe("pan");
  });

  it("always zooms while the zoom activation key is held", () => {
    const held = {
      ...OPTIONS,
      panOnScroll: true,
      zoomOnScroll: false,
      zoomActivationKeyPressed: true,
    };
    expect(wheelAction(wheel(), held)).toBe("zoom");
  });
});

describe("applyWheel: zoom", () => {
  it("zooms in on a negative delta about the pointer", () => {
    const input = wheel({ deltaY: -100 });
    const next = zoomed(input);
    expect(next.zoom).toBeCloseTo(2 ** 0.2);
    expect(screenToFlow(next, input.point).x).toBeCloseTo(100);
    expect(screenToFlow(next, input.point).y).toBeCloseTo(100);
  });

  it("zooms out on a positive delta", () => {
    expect(zoomed(wheel({ deltaY: 100 })).zoom).toBeCloseTo(2 ** -0.2);
  });

  it("boosts a pinch tenfold on macOS only, and scales line deltas", () => {
    const input = wheel({ deltaY: -10, ctrlKey: true });
    expect(zoomed(input).zoom).toBeCloseTo(2 ** 0.02);
    expect(zoomed(input, { ...OPTIONS, macOs: undefined }).zoom).toBeCloseTo(2 ** 0.02);
    expect(zoomed(input, { ...OPTIONS, macOs: true }).zoom).toBeCloseTo(2 ** 0.2);
    expect(zoomed(wheel({ deltaY: -4, deltaMode: 1 })).zoom).toBeCloseTo(2 ** 0.2);
  });

  it("clamps the zoom to the limits", () => {
    expect(zoomed(wheel({ deltaY: -100_000 })).zoom).toBe(4);
    expect(zoomed(wheel({ deltaY: 100_000 })).zoom).toBe(0.1);
  });

  it("does nothing when the options forbid it", () => {
    expect(
      applyWheel(ORIGIN, wheel({ deltaY: -100 }), { ...OPTIONS, zoomOnScroll: false }),
    ).toBeUndefined();
  });
});

describe("applyWheel: pan", () => {
  const panning = { ...OPTIONS, panOnScroll: true };

  it("moves the viewport against the scroll, scaled by the speed", () => {
    expect(applyWheel(ORIGIN, wheel({ deltaX: 10, deltaY: 20 }), panning)).toStrictEqual({
      x: -5,
      y: -10,
      zoom: 1,
    });
  });

  it("treats a scroll line as 20 pixels", () => {
    expect(applyWheel(ORIGIN, wheel({ deltaY: 1, deltaMode: 1 }), panning)).toStrictEqual({
      x: 0,
      y: -10,
      zoom: 1,
    });
  });

  it("limits the pan to one axis in vertical and horizontal mode", () => {
    const input = wheel({ deltaX: 10, deltaY: 20 });
    expect(
      applyWheel(ORIGIN, input, { ...panning, panOnScrollMode: PanOnScrollMode.Vertical }),
    ).toStrictEqual({ x: 0, y: -10, zoom: 1 });
    expect(
      applyWheel(ORIGIN, input, { ...panning, panOnScrollMode: PanOnScrollMode.Horizontal }),
    ).toStrictEqual({ x: -5, y: 0, zoom: 1 });
  });

  it("turns vertical scrolling horizontal with shift, except on macOS where the platform did", () => {
    expect(applyWheel(ORIGIN, wheel({ deltaY: 20, shiftKey: true }), panning)).toStrictEqual({
      x: -10,
      y: 0,
      zoom: 1,
    });
    // As in React Flow, the turn is made whatever the horizontal delta was.
    expect(
      applyWheel(ORIGIN, wheel({ deltaX: 20, deltaY: 0, shiftKey: true }), panning),
    ).toStrictEqual({ x: 0, y: 0, zoom: 1 });
    expect(
      applyWheel(ORIGIN, wheel({ deltaX: 20, deltaY: 0, shiftKey: true }), {
        ...panning,
        macOs: true,
      }),
    ).toStrictEqual({ x: -10, y: 0, zoom: 1 });
  });
});

describe("PanSession", () => {
  it("moves the viewport by how far the pointer travelled", () => {
    const session = startPan({ x: 10, y: 20, zoom: 2 }, { x: 100, y: 100 });
    expect(session.move({ x: 130, y: 90 })).toStrictEqual({ x: 40, y: 10, zoom: 2 });
    expect(session.move({ x: 100, y: 100 })).toStrictEqual({ x: 10, y: 20, zoom: 2 });
  });
});

describe("PinchSession", () => {
  const limits = { minZoom: 0.5, maxZoom: 2 };
  const start = [
    { x: 100, y: 100 },
    { x: 200, y: 100 },
  ] as const;

  it("zooms by the ratio of the distances about the centre", () => {
    const session = startPinch(ORIGIN, start, limits);
    expect(
      session.move([
        { x: 50, y: 100 },
        { x: 250, y: 100 },
      ]),
    ).toStrictEqual({ x: -150, y: -100, zoom: 2 });
  });

  it("pans with the centre of the pointers", () => {
    const session = startPinch(ORIGIN, start, limits);
    expect(
      session.move([
        { x: 110, y: 110 },
        { x: 210, y: 110 },
      ]),
    ).toStrictEqual({ x: 10, y: 10, zoom: 1 });
  });

  it("keeps the flow point under the centre fixed", () => {
    const viewport = { x: 30, y: -20, zoom: 1.5 };
    const session = startPinch(viewport, start, limits);
    const flowCentre = screenToFlow(viewport, { x: 150, y: 100 });
    const next = session.move([
      { x: 120, y: 90 },
      { x: 220, y: 130 },
    ]);
    const after = screenToFlow(next, { x: 170, y: 110 });
    expect(after.x).toBeCloseTo(flowCentre.x);
    expect(after.y).toBeCloseTo(flowCentre.y);
  });

  it("clamps the zoom and survives pointers that start on the same spot", () => {
    const wide = startPinch(ORIGIN, start, limits).move([
      { x: -1000, y: 100 },
      { x: 1000, y: 100 },
    ]);
    expect(wide.zoom).toBe(2);
    const same = startPinch(
      ORIGIN,
      [
        { x: 5, y: 5 },
        { x: 5, y: 5 },
      ],
      limits,
    );
    expect(
      same.move([
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ]).zoom,
    ).toBe(1);
  });
});
