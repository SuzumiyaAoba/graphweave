import { fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";

import { trackPointer } from "./pointer-track.ts";

const WINDOW = globalThis.window;

describe("trackPointer", () => {
  it("follows the pressed pointer and ignores the moves of other fingers", () => {
    const onMove = vi.fn<(event: PointerEvent) => void>();
    trackPointer({ pointerId: 1 }, onMove, vi.fn<(event: PointerEvent) => void>());
    fireEvent.pointerMove(WINDOW, { pointerId: 2, clientX: 5 });
    fireEvent.pointerMove(WINDOW, { pointerId: 1, clientX: 9 });
    const moved = onMove.mock.calls.map(([event]) => event.clientX);
    fireEvent.pointerUp(WINDOW, { pointerId: 1 });
    expect(moved).toStrictEqual([9]);
  });

  it("does not end when another finger lifts, and ends once when its own does", () => {
    const onEnd = vi.fn<(event: PointerEvent) => void>();
    trackPointer({ pointerId: 1 }, vi.fn<(event: PointerEvent) => void>(), onEnd);
    fireEvent.pointerUp(WINDOW, { pointerId: 2 });
    const endedByOther = onEnd.mock.calls.length;
    fireEvent.pointerUp(WINDOW, { pointerId: 1 });
    fireEvent.pointerUp(WINDOW, { pointerId: 1 });
    expect([endedByOther, onEnd.mock.calls.length]).toStrictEqual([0, 1]);
  });
});
