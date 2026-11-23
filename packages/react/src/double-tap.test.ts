import { describe, expect, it, vi } from "vite-plus/test";

import { createTaps, tapJoined, tapsOfStart } from "./double-tap.ts";

// A finger that goes down at (x, y).
function down(x: number, y: number): MouseEvent {
  return new MouseEvent("pointerdown", { clientX: x, clientY: y });
}

// The taps of a touch that starts half a second after the one before, on a clock of its own.
function tapsHalfASecondLater(): number {
  vi.useFakeTimers();
  try {
    const taps = createTaps();
    tapsOfStart(taps, down(0, 0), 1);
    vi.advanceTimersByTime(500);
    return tapsOfStart(taps, down(0, 0), 1);
  } finally {
    vi.useRealTimers();
  }
}

// As d3-zoom counts them, which is how React Flow tells a double tap.
describe("the taps a gesture of the fingers makes", () => {
  it("are two for a touch that starts within half a second of the one before", () => {
    const taps = createTaps();
    expect([tapsOfStart(taps, down(0, 0), 1), tapsOfStart(taps, down(0, 0), 1)]).toStrictEqual([
      1, 2,
    ]);
  });

  it("are one again once half a second has gone by", () => {
    expect(tapsHalfASecondLater()).toBe(1);
  });

  it("are one for the touch after a double tap", () => {
    const taps = createTaps();
    tapsOfStart(taps, down(0, 0), 1);
    tapsOfStart(taps, down(0, 0), 1);
    expect(tapsOfStart(taps, down(0, 0), 1)).toBe(1);
  });

  it("are none for a gesture of two fingers, which may still begin a double tap", () => {
    const taps = createTaps();
    expect([tapsOfStart(taps, down(0, 0), 2), tapsOfStart(taps, down(0, 0), 1)]).toStrictEqual([
      0, 2,
    ]);
  });

  it("are one for a touch after another finger has gone down", () => {
    const taps = createTaps();
    tapsOfStart(taps, down(0, 0), 1);
    tapJoined(taps);
    expect(tapsOfStart(taps, down(0, 0), 1)).toBe(1);
  });
});
