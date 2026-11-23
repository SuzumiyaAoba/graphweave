import { describe, expect, it, vi } from "vite-plus/test";

import { resizeDragEvents } from "./resize-drag-event.ts";
import type { ResizeDragListener } from "./resize-drag-event.ts";

// A press on a control inside a box, as the resize control sees it.
function pressOnControl(): PointerEvent {
  const box = document.createElement("div");
  const control = document.createElement("div");
  box.append(control);
  const down = new PointerEvent("pointerdown", { clientX: 5, clientY: 6, pointerId: 3 });
  control.dispatchEvent(down);
  return down;
}

function moveTo(x: number, y: number): PointerEvent {
  return new PointerEvent("pointermove", { clientX: x, clientY: y, pointerId: 3 });
}

describe("the events of a resize drag", () => {
  it("say where the pointer is, how far it has moved and what the drag is", () => {
    const events = resizeDragEvents(pressOnControl());
    events.make("start", pressOnControl());
    const dragged = events.make("drag", moveTo(15, 26));
    expect([dragged.type, dragged.x, dragged.y, dragged.active]).toStrictEqual(["drag", 15, 26, 1]);
  });

  it("let a listener be set on the drag, which is called after the callbacks and for its type", () => {
    const events = resizeDragEvents(pressOnControl());
    const started = events.make("start", pressOnControl());
    const listener = vi.fn<ResizeDragListener>();
    expect(started.on("drag.mine", listener)).toBe(started);
    events.dispatch(started);
    const dragged = events.make("drag", moveTo(15, 26));
    events.dispatch(dragged);
    expect(listener.mock.calls).toStrictEqual([[dragged]]);
  });

  it("give a listener back by its name, and let it go when it is set to null", () => {
    const events = resizeDragEvents(pressOnControl());
    const started = events.make("start", pressOnControl());
    const listener = vi.fn<ResizeDragListener>();
    started.target.on("drag.mine", listener);
    const given = started.on("drag.mine");
    started.on("drag.mine", null);
    events.dispatch(events.make("drag", moveTo(15, 26)));
    expect([given === listener, listener.mock.calls.length]).toStrictEqual([true, 0]);
  });
});
