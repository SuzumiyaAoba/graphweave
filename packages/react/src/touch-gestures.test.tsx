import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";

import { noop } from "./noop.ts";
import type { ReactFlowProps } from "./react-flow-props.ts";
import { ReactFlow } from "./react-flow.tsx";
import type { Node } from "./types.ts";

const WINDOW = globalThis.window;

const NODES: Node[] = [{ id: "a", position: { x: 300, y: 300 }, data: {}, width: 100, height: 40 }];

async function flow(props: ReactFlowProps): Promise<void> {
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

interface Finger {
  id: number;
  x: number;
  y: number;
}

function put(target: Element, { id, x, y }: Finger): void {
  fireEvent.pointerDown(target, {
    button: 0,
    pointerType: "touch",
    pointerId: id,
    isPrimary: id === 1,
    clientX: x,
    clientY: y,
  });
}

function slide({ id, x, y }: Finger): void {
  fireEvent.pointerMove(WINDOW, {
    pointerType: "touch",
    pointerId: id,
    clientX: x,
    clientY: y,
  });
}

function lift(...ids: number[]): void {
  for (const id of ids) {
    fireEvent.pointerUp(WINDOW, { pointerType: "touch", pointerId: id });
  }
}

// One finger down on the pane at (100, 100), moved to (160, 130), and lifted.
function dragPane(): string {
  const pane = query(".react-flow__pane");
  act(() => {
    put(pane, { id: 1, x: 100, y: 100 });
    slide({ id: 1, x: 160, y: 130 });
    lift(1);
  });
  return viewport();
}

describe("a finger on the pane", () => {
  it("pans it", async () => {
    await flow({});
    expect(dragPane()).toBe("translate(60px,30px) scale(1)");
  });

  it("pans it even when `panOnDrag` lists only mouse buttons", async () => {
    await flow({ panOnDrag: [1, 2] });
    expect(dragPane()).toBe("translate(60px,30px) scale(1)");
  });

  it("does not pan it when panning is off", async () => {
    await flow({ panOnDrag: false });
    expect(dragPane()).toBe("translate(0px,0px) scale(1)");
  });

  it("pans instead of drawing a selection box when the canvas can be panned", async () => {
    await flow({ panOnDrag: [1, 2], selectionOnDrag: true });
    expect(dragPane()).toBe("translate(60px,30px) scale(1)");
  });
});

// Two fingers down at (100, 100) and (200, 100), then spread to (50, 100) and (250, 100).
function pinchOut(first: Element): string {
  const pane = query(".react-flow__pane");
  act(() => {
    put(first, { id: 1, x: 100, y: 100 });
    put(pane, { id: 2, x: 200, y: 100 });
    slide({ id: 1, x: 50, y: 100 });
    slide({ id: 2, x: 250, y: 100 });
    lift(1, 2);
  });
  return viewport();
}

describe("two fingers", () => {
  it("pinch the canvas, keeping the point between them in place", async () => {
    await flow({});
    expect(pinchOut(query(".react-flow__pane"))).toBe("translate(-150px,-100px) scale(2)");
  });

  it("pinch it when one of them is on a node, which pans nothing by itself", async () => {
    await flow({});
    expect(pinchOut(query('.react-flow__node[data-id="a"]'))).toBe(
      "translate(-150px,-100px) scale(2)",
    );
  });

  it("do not pinch it when panning is off", async () => {
    await flow({ panOnDrag: false });
    expect(pinchOut(query(".react-flow__pane"))).toBe("translate(0px,0px) scale(1)");
  });

  it("do not pinch it when `zoomOnPinch` is off, and the first keeps panning alone", async () => {
    await flow({ zoomOnPinch: false });
    expect(pinchOut(query(".react-flow__pane"))).toBe("translate(-50px,0px) scale(1)");
  });
});

// A finger on the node at (100, 100) moves to (110, 100), which takes hold of the node, and on to
// (160, 130); a second finger may go down on the pane before the second move.
function dragNode(between: () => void): string {
  const node = query('.react-flow__node[data-id="a"]');
  act(() => {
    put(node, { id: 1, x: 100, y: 100 });
    slide({ id: 1, x: 110, y: 100 });
    between();
    slide({ id: 1, x: 160, y: 130 });
    lift(1, 2);
  });
  return node.style.transform;
}

function secondFinger(): void {
  put(query(".react-flow__pane"), { id: 2, x: 400, y: 400 });
}

// Two fingers pinch, one lifts, and the other moves on: the pan carries on from where the pinch left
// the canvas, as in d3-zoom, instead of going back to where it was before.
function pinchThenPanWithOne(): string {
  const pane = query(".react-flow__pane");
  act(() => {
    put(pane, { id: 1, x: 100, y: 100 });
    put(pane, { id: 2, x: 200, y: 100 });
    slide({ id: 1, x: 50, y: 100 });
    slide({ id: 2, x: 250, y: 100 });
    lift(2);
    slide({ id: 1, x: 60, y: 100 });
    lift(1);
  });
  return viewport();
}

describe("a finger left after a pinch", () => {
  it("goes on panning from where the pinch left the canvas", async () => {
    await flow({});
    expect(pinchThenPanWithOne()).toBe("translate(-140px,-100px) scale(2)");
  });
});

describe("a node dragged by a finger", () => {
  it("follows it", async () => {
    await flow({});
    expect(dragNode(noop)).toBe("translate(350px,330px)");
  });

  it("stops following it once a second finger is down", async () => {
    await flow({});
    expect(dragNode(secondFinger)).toBe("translate(300px,300px)");
  });
});
