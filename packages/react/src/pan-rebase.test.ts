import { createFlowStore } from "@graphweave/core";
import { describe, expect, it } from "vite-plus/test";

import { trackPan, trackPinch } from "./pan-rebase.ts";

function flow(): ReturnType<typeof createFlowStore> {
  return createFlowStore({ width: 800, height: 600, viewport: { x: 200, y: 150, zoom: 1 } });
}

describe("a pan that is moved from outside while it goes on", () => {
  it("adds the pointer's travel to the viewport it finds, not to the one it began with", () => {
    const store = flow();
    const pan = trackPan(store, { x: 100, y: 100 });
    store.setState({ viewport: { x: 193, y: 145, zoom: 1 } });
    pan.settled();
    // The owner puts the viewport back to where it held it before the next move.
    store.setState({ viewport: { x: 200, y: 150, zoom: 1 } });
    expect(pan.move({ x: 86, y: 90 })).toStrictEqual({ x: 186, y: 140, zoom: 1 });
  });

  it("goes on from the pointer's last position, so the travel is only that since then", () => {
    const store = flow();
    const pan = trackPan(store, { x: 100, y: 100 });
    const first = pan.move({ x: 93, y: 95 });
    store.setState({ viewport: first });
    pan.settled();
    store.setState({ viewport: { x: 200, y: 150, zoom: 1 } });
    expect(pan.move({ x: 87, y: 90 })).toStrictEqual({ x: 194, y: 145, zoom: 1 });
  });

  it("stays where it began when nobody else has moved the viewport", () => {
    const store = flow();
    const pan = trackPan(store, { x: 100, y: 100 });
    const first = pan.move({ x: 90, y: 90 });
    store.setState({ viewport: first });
    pan.settled();
    expect(pan.move({ x: 80, y: 80 })).toStrictEqual({ x: 180, y: 130, zoom: 1 });
  });

  it("is not thrown off by a viewport that was held to a limit by the pan's own move", () => {
    const store = flow();
    const pan = trackPan(store, { x: 100, y: 100 });
    pan.move({ x: 0, y: 0 });
    // The limit held the viewport at x 120 instead of 100.
    store.setState({ viewport: { x: 120, y: 150, zoom: 1 } });
    pan.settled();
    expect(pan.move({ x: 50, y: 100 })).toStrictEqual({ x: 150, y: 150, zoom: 1 });
  });
});

describe("a pinch that is moved from outside while it goes on", () => {
  const limits = { minZoom: 0.1, maxZoom: 4 };
  const fingers = [
    { x: 100, y: 100 },
    { x: 200, y: 100 },
  ] as const;
  const wider = [
    { x: 100, y: 100 },
    { x: 300, y: 100 },
  ] as const;

  it("follows the distance and the centre of the fingers from the viewport it began with", () => {
    const pinch = trackPinch(flow(), fingers, limits);
    expect(pinch.move(wider)).toStrictEqual({ x: 300, y: 200, zoom: 2 });
  });

  it("stays where it began when nobody else has moved the viewport", () => {
    const store = flow();
    const pinch = trackPinch(store, fingers, limits);
    store.setState({ viewport: pinch.move(wider) });
    pinch.settled();
    const widest = [
      { x: 100, y: 100 },
      { x: 400, y: 100 },
    ] as const;
    expect(pinch.move(widest)).toStrictEqual({ x: 400, y: 250, zoom: 3 });
  });

  it("goes on from the viewport it finds, with the fingers where they were last", () => {
    const store = flow();
    const pinch = trackPinch(store, fingers, limits);
    store.setState({ viewport: pinch.move(wider) });
    pinch.settled();
    // Somebody else sets the viewport in the middle of the pinch.
    store.setState({ viewport: { x: 250, y: 100, zoom: 2 } });
    const widest = [
      { x: 100, y: 100 },
      { x: 400, y: 100 },
    ] as const;
    expect(pinch.move(widest)).toStrictEqual({ x: 325, y: 100, zoom: 3 });
  });
});
