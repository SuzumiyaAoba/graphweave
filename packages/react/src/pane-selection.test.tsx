import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";

import type { ReactFlowProps } from "./react-flow-props.ts";
import { ReactFlow } from "./react-flow.tsx";
import type { Node } from "./types.ts";

const WINDOW = globalThis.window;

const NODES: Node[] = [
  { id: "a", position: { x: 100, y: 100 }, data: {}, width: 100, height: 40 },
  { id: "b", position: { x: 400, y: 300 }, data: {}, width: 100, height: 40 },
];

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

const PANE = ".react-flow__pane";
const NODE_A = '.react-flow__node[data-id="a"]';

function holdShift(): void {
  act(() => {
    fireEvent.keyDown(document.body, { key: "Shift" });
  });
}

function releaseShift(): void {
  act(() => {
    fireEvent.keyUp(document.body, { key: "Shift" });
  });
}

function press(selector: string): void {
  act(() => {
    fireEvent.pointerDown(query(selector), { button: 0, clientX: 10, clientY: 10 });
  });
}

function moveTo(x: number, y: number): void {
  act(() => {
    fireEvent.pointerMove(WINDOW, { clientX: x, clientY: y });
  });
}

function letGo(x: number, y: number): void {
  act(() => {
    fireEvent.pointerUp(WINDOW, { clientX: x, clientY: y });
  });
}

type Handler<TName extends keyof ReactFlowProps> = NonNullable<ReactFlowProps[TName]>;

describe("with the selection key held", () => {
  it("draws a box from a press on a node instead of dragging the node", async () => {
    const onSelectionStart = vi.fn<Handler<"onSelectionStart">>();
    const onSelectionEnd = vi.fn<Handler<"onSelectionEnd">>();
    const onNodeDragStart = vi.fn<Handler<"onNodeDragStart">>();
    await flow({ onSelectionStart, onSelectionEnd, onNodeDragStart });
    holdShift();
    press(NODE_A);
    moveTo(300, 200);
    letGo(300, 200);
    releaseShift();
    expect([
      onSelectionStart.mock.calls.length,
      onSelectionEnd.mock.calls.length,
      onNodeDragStart.mock.calls.length,
    ]).toStrictEqual([1, 1, 0]);
  });

  it("calls a press on the pane that did not move a click, and draws no box", async () => {
    const onSelectionStart = vi.fn<Handler<"onSelectionStart">>();
    const onPaneClick = vi.fn<Handler<"onPaneClick">>();
    await flow({ onSelectionStart, onPaneClick });
    holdShift();
    press(PANE);
    letGo(10, 10);
    releaseShift();
    expect([onSelectionStart.mock.calls.length, onPaneClick.mock.calls.length]).toStrictEqual([
      0, 1,
    ]);
  });
});

describe("selectionOnDrag", () => {
  const DRAG = { selectionOnDrag: true, panOnDrag: false } as const;

  it("starts the box only once the pointer has moved", async () => {
    const onSelectionStart = vi.fn<Handler<"onSelectionStart">>();
    const onSelectionEnd = vi.fn<Handler<"onSelectionEnd">>();
    await flow({ onSelectionStart, onSelectionEnd, ...DRAG });
    press(PANE);
    const atPress = onSelectionStart.mock.calls.length;
    moveTo(200, 150);
    const afterMove = onSelectionStart.mock.calls.length;
    letGo(200, 150);
    expect([atPress, afterMove, onSelectionEnd.mock.calls.length]).toStrictEqual([0, 1, 1]);
  });

  it("does not draw a box from a press on a node", async () => {
    const onSelectionStart = vi.fn<Handler<"onSelectionStart">>();
    await flow({ onSelectionStart, ...DRAG });
    press(NODE_A);
    moveTo(300, 200);
    letGo(300, 200);
    expect(onSelectionStart).not.toHaveBeenCalled();
  });
});

describe("onSelectionChange", () => {
  it("is told the selection once the flow is shown", async () => {
    const onSelectionChange = vi.fn<Handler<"onSelectionChange">>();
    await flow({ onSelectionChange });
    expect(onSelectionChange.mock.calls).toStrictEqual([[{ nodes: [], edges: [] }]]);
  });
});
