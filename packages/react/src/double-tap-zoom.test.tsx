import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";

import type { ReactFlowProps } from "./react-flow-props.ts";
import { ReactFlow } from "./react-flow.tsx";
import type { Node } from "./types.ts";

const WINDOW = globalThis.window;

const NODES: Node[] = [
  { id: "fixed", position: { x: 300, y: 300 }, data: {}, width: 100, height: 40, draggable: false },
  { id: "loose", position: { x: 500, y: 300 }, data: {}, width: 100, height: 40 },
];

type Handler<TName extends keyof ReactFlowProps> = NonNullable<ReactFlowProps[TName]>;

async function flow(props: ReactFlowProps = {}): Promise<void> {
  cleanup();
  await act(async () => {
    render(<ReactFlow width={800} height={600} defaultNodes={NODES} {...props} />);
    await Promise.resolve();
  });
}

function query(selector: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(selector);
  if (element === null) {
    throw new Error(`nothing matches ${selector}`);
  }
  return element;
}

function viewport(): string {
  return query(".react-flow__viewport").style.transform;
}

function finger(id: number, x: number, y: number): Record<string, unknown> {
  return {
    button: 0,
    pointerType: "touch",
    pointerId: id,
    isPrimary: id === 1,
    clientX: x,
    clientY: y,
  };
}

// A tap of one finger at (x, y) on `target`. Tells whether the touch event that ends it was left
// alone: when it is cancelled, the browser makes no click (nor double click) of the tap.
function tap(target: Element, x: number, y: number): boolean {
  let left = true;
  act(() => {
    fireEvent.pointerDown(target, finger(1, x, y));
    fireEvent.pointerUp(WINDOW, finger(1, x, y));
    left = fireEvent.touchEnd(target);
  });
  return left;
}

// Lets a few frames go by, in which a zoom that was set off would have begun.
async function frames(): Promise<void> {
  // oxlint-disable-next-line promise/avoid-new -- wraps the callback-based setTimeout
  await new Promise((resolve) => {
    setTimeout(resolve, 100);
  });
}

describe("a double tap on the pane, as d3-zoom (and so React Flow) tells it", () => {
  it("zooms in twice as near about the second tap, and cancels the click of it", async () => {
    await flow();
    const pane = query(".react-flow__pane");
    expect([tap(pane, 200, 200), tap(pane, 204, 203)]).toStrictEqual([true, false]);
    await vi.waitFor(() => {
      expect(viewport()).toBe("translate(-204px,-203px) scale(2)");
    });
  });

  it("is no double tap when the second tap lifts 10 px or more from where the first went down", async () => {
    await flow();
    const pane = query(".react-flow__pane");
    tap(pane, 200, 200);
    expect(tap(pane, 210, 200)).toBe(true);
  });

  it("does nothing with zoomOnDoubleClick off, and leaves its click alone", async () => {
    await flow({ zoomOnDoubleClick: false });
    const pane = query(".react-flow__pane");
    tap(pane, 200, 200);
    expect(tap(pane, 200, 200)).toBe(true);
  });

  it("is no double tap when a second finger joins the second touch", async () => {
    await flow();
    const pane = query(".react-flow__pane");
    tap(pane, 200, 200);
    let left = false;
    act(() => {
      fireEvent.pointerDown(pane, finger(1, 200, 200));
      fireEvent.pointerDown(pane, finger(2, 300, 200));
      fireEvent.pointerUp(WINDOW, finger(2, 300, 200));
      fireEvent.pointerUp(WINDOW, finger(1, 200, 200));
      left = fireEvent.touchEnd(pane);
    });
    expect(left).toBe(true);
  });

  it("zooms on a node that cannot be dragged, as a press there pans, and not on one that can", async () => {
    await flow();
    const fixed = query('.react-flow__node[data-id="fixed"]');
    const loose = query('.react-flow__node[data-id="loose"]');
    tap(fixed, 350, 320);
    const onFixed = tap(fixed, 350, 320);
    tap(loose, 550, 320);
    expect([onFixed, tap(loose, 550, 320)]).toStrictEqual([false, true]);
  });
});

describe("a double click", () => {
  it("zooms out about the pointer with Shift held", async () => {
    await flow();
    act(() => {
      fireEvent.doubleClick(query(".react-flow__pane"), {
        clientX: 100,
        clientY: 100,
        shiftKey: true,
      });
    });
    await vi.waitFor(() => {
      expect(viewport()).toBe("translate(50px,50px) scale(0.5)");
    });
  });

  it("zooms on a node that cannot be dragged, which hears it all the same", async () => {
    const onNodeDoubleClick = vi.fn<Handler<"onNodeDoubleClick">>();
    await flow({ onNodeDoubleClick });
    act(() => {
      fireEvent.doubleClick(query('.react-flow__node[data-id="fixed"]'), {
        clientX: 350,
        clientY: 320,
      });
    });
    await vi.waitFor(() => {
      expect(viewport()).toBe("translate(-350px,-320px) scale(2)");
    });
    expect(onNodeDoubleClick).toHaveBeenCalledOnce();
  });

  it("does not zoom on a node that can be dragged, nor with Ctrl held", async () => {
    const onMoveStart = vi.fn<Handler<"onMoveStart">>();
    await flow({ onMoveStart });
    act(() => {
      fireEvent.doubleClick(query('.react-flow__node[data-id="loose"]'), {
        clientX: 550,
        clientY: 320,
      });
      fireEvent.doubleClick(query(".react-flow__pane"), {
        clientX: 100,
        clientY: 100,
        ctrlKey: true,
      });
    });
    await frames();
    expect(onMoveStart).not.toHaveBeenCalled();
  });
});
