import { act, cleanup, createEvent, fireEvent, render } from "@testing-library/react";
import type { ReactElement } from "react";
import { createPortal } from "react-dom";
import { describe, expect, it, vi } from "vite-plus/test";

import { NodeToolbar } from "./node-toolbar.tsx";
import type { ReactFlowProps } from "./react-flow-props.ts";
import { ReactFlow } from "./react-flow.tsx";
import type { Node } from "./types.ts";

const WINDOW = globalThis.window;

const NODES: Node[] = [
  { id: "a", type: "bar", position: { x: 0, y: 0 }, data: {}, width: 100, height: 40 },
];

type Handler<TName extends keyof ReactFlowProps> = NonNullable<ReactFlowProps[TName]>;

// A node with a toolbar (drawn into the renderer) and a popover drawn into the body of the page.
function BarNode(): ReactElement {
  return (
    <>
      a<NodeToolbar isVisible>bar</NodeToolbar>
      {createPortal(<div className="popover">popover</div>, document.body)}
    </>
  );
}

async function flow(props: ReactFlowProps = {}): Promise<void> {
  cleanup();
  await act(async () => {
    render(
      <ReactFlow
        width={800}
        height={600}
        defaultNodes={NODES}
        nodeTypes={{ bar: BarNode }}
        {...props}
      />,
    );
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

function spin(target: Element): void {
  act(() => {
    fireEvent.wheel(target, { deltaY: -100, clientX: 400, clientY: 300 });
  });
}

// As React Flow, whose d3-zoom listens on the renderer and stops the wheel it takes.
describe("the wheel", () => {
  it("zooms over a node's toolbar, which is drawn outside of the pane", async () => {
    await flow();
    spin(query(".react-flow__node-toolbar"));
    expect(viewport()).not.toBe("translate(0px,0px) scale(1)");
  });

  it("is not told to onPaneScroll when it zooms", async () => {
    const onPaneScroll = vi.fn<Handler<"onPaneScroll">>();
    await flow({ onPaneScroll });
    spin(query(".react-flow__pane"));
    expect(onPaneScroll).not.toHaveBeenCalled();
  });

  it("is told to onPaneScroll when the canvas leaves it alone, over the pane itself only", async () => {
    const onPaneScroll = vi.fn<Handler<"onPaneScroll">>();
    await flow({ onPaneScroll, zoomOnScroll: false });
    spin(query(".react-flow__pane"));
    spin(query('.react-flow__node[data-id="a"]'));
    expect(onPaneScroll).toHaveBeenCalledOnce();
  });
});

// As React Flow's wheel handlers and its filter for d3-zoom.
describe("the wheel, left alone by the canvas", () => {
  it("is cancelled for a pinch over a noWheelClassName element, so that the page does not zoom", async () => {
    await flow();
    const node = query('.react-flow__node[data-id="a"]');
    node.classList.add("nowheel");
    // The pinch of a trackpad comes as a wheel with Ctrl held (set here, as the test page drops it).
    const pinch = createEvent.wheel(node, { deltaY: -100, clientX: 50, clientY: 20 });
    Object.defineProperty(pinch, "ctrlKey", { value: true });
    let left = true;
    act(() => {
      left = fireEvent(node, pinch);
    });
    expect([left, viewport()]).toStrictEqual([false, "translate(0px,0px) scale(1)"]);
  });

  it("zooms nothing while a box is drawn", async () => {
    await flow({ selectionOnDrag: true, panOnDrag: false });
    const pane = query(".react-flow__pane");
    act(() => {
      fireEvent.pointerDown(pane, { button: 0, clientX: 400, clientY: 300 });
      fireEvent.pointerMove(WINDOW, { clientX: 450, clientY: 350 });
    });
    spin(pane);
    act(() => {
      fireEvent.pointerUp(WINDOW, { clientX: 450, clientY: 350 });
    });
    expect(viewport()).toBe("translate(0px,0px) scale(1)");
  });
});

describe("a press on what a node draws into the body of the page", () => {
  it("neither drags the node nor pans the canvas", async () => {
    const onMoveStart = vi.fn<Handler<"onMoveStart">>();
    await flow({ onMoveStart });
    act(() => {
      fireEvent.pointerDown(query(".popover"), { button: 0, clientX: 300, clientY: 300 });
      fireEvent.pointerMove(WINDOW, { clientX: 340, clientY: 320 });
      fireEvent.pointerUp(WINDOW, { clientX: 340, clientY: 320 });
    });
    const node = query('.react-flow__node[data-id="a"]').style.transform;
    expect([onMoveStart.mock.calls.length, node]).toStrictEqual([0, "translate(0px,0px)"]);
  });
});

// As React Flow, which zooms a pinch by one call to d3-zoom per event when the canvas pans by scrolling.
describe("a pinch while the canvas pans by scrolling", () => {
  it("tells its end 150 ms after the event, not after the wheel has been quiet as well", async () => {
    vi.useFakeTimers();
    try {
      const onMoveEnd = vi.fn<Handler<"onMoveEnd">>();
      await flow({ onMoveEnd, panOnScroll: true });
      const pane = query(".react-flow__pane");
      const pinch = createEvent.wheel(pane, { deltaY: -60, clientX: 400, clientY: 300 });
      Object.defineProperty(pinch, "ctrlKey", { value: true });
      act(() => {
        fireEvent(pane, pinch);
      });
      act(() => {
        vi.advanceTimersByTime(140);
      });
      const early = onMoveEnd.mock.calls.length;
      act(() => {
        vi.advanceTimersByTime(20);
      });
      expect([early, onMoveEnd.mock.calls.length]).toStrictEqual([0, 1]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("tells its end apart from that of a pan by scrolling just before it", async () => {
    vi.useFakeTimers();
    try {
      const onMoveEnd = vi.fn<Handler<"onMoveEnd">>();
      await flow({ onMoveEnd, panOnScroll: true });
      const pane = query(".react-flow__pane");
      act(() => {
        fireEvent.wheel(pane, { deltaY: 40, clientX: 400, clientY: 300 });
      });
      act(() => {
        vi.advanceTimersByTime(20);
      });
      const pinch = createEvent.wheel(pane, { deltaY: -60, clientX: 400, clientY: 300 });
      Object.defineProperty(pinch, "ctrlKey", { value: true });
      act(() => {
        fireEvent(pane, pinch);
      });
      act(() => {
        vi.advanceTimersByTime(400);
      });
      expect(onMoveEnd).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
