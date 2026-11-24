import { MarkerType } from "@graphweave/core";
import type { NodeChange } from "@graphweave/core";
import { act, cleanup, fireEvent, render, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";

import type { ReactFlowProps } from "./react-flow-props.ts";
import { ReactFlow } from "./react-flow.tsx";
import type { Edge, Node } from "./types.ts";
import { useKeyPress } from "./use-key-press.ts";

const WINDOW = globalThis.window;

const NODES: Node[] = [
  { id: "a", position: { x: 0, y: 0 }, data: {}, width: 100, height: 40 },
  { id: "b", position: { x: 200, y: 100 }, data: {}, width: 100, height: 40 },
];

async function show(props: ReactFlowProps): Promise<void> {
  cleanup();
  await act(async () => {
    render(<ReactFlow width={800} height={600} defaultNodes={NODES} {...props} />);
    await Promise.resolve();
  });
}

function query(selector: string): Element {
  const element = document.querySelector(selector);
  if (element === null) {
    throw new Error(`nothing matches ${selector}`);
  }
  return element;
}

function node(id: string): Element | null {
  return document.querySelector(`.react-flow__node[data-id="${id}"]`);
}

const A_SOURCE_HANDLE = '.react-flow__node[data-id="a"] .react-flow__handle.source';
const NODE_A = '.react-flow__node[data-id="a"]';

describe("onlyRenderVisibleElements", () => {
  const FAR: Node = { id: "far", position: { x: 5000, y: 5000 }, data: {}, width: 100, height: 40 };

  it("leaves out the nodes that are outside the canvas", async () => {
    await show({ onlyRenderVisibleElements: true, defaultNodes: [...NODES, FAR] });
    expect(node("a")).not.toBeNull();
    expect(node("far")).toBeNull();
  });

  it("renders every node otherwise", async () => {
    await show({ defaultNodes: [...NODES, FAR] });
    expect(node("far")).not.toBeNull();
  });
});

const B_TARGET_HANDLE = '.react-flow__node[data-id="b"] .react-flow__handle.target';

async function clickHandle(props: ReactFlowProps): Promise<void> {
  await show(props);
  act(() => {
    fireEvent.click(query(A_SOURCE_HANDLE));
  });
}

describe("connectOnClick", () => {
  it("starts a connection with a click on a handle, and draws nothing", async () => {
    const onClickConnectStart = vi.fn<NonNullable<ReactFlowProps["onClickConnectStart"]>>();
    await clickHandle({ onClickConnectStart });
    expect(onClickConnectStart).toHaveBeenCalledOnce();
    expect(query(A_SOURCE_HANDLE).classList.contains("clickconnecting")).toBe(true);
    expect(document.querySelector(".react-flow__connection-path")).toBeNull();
  });

  it("makes the connection with a click on another handle", async () => {
    const onConnect = vi.fn<NonNullable<ReactFlowProps["onConnect"]>>();
    const onClickConnectEnd = vi.fn<NonNullable<ReactFlowProps["onClickConnectEnd"]>>();
    await clickHandle({ onConnect, onClickConnectEnd });
    act(() => {
      fireEvent.click(query(B_TARGET_HANDLE));
    });
    expect(onConnect).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ source: "a", target: "b" }),
    );
    expect(onClickConnectEnd).toHaveBeenCalledOnce();
    expect(query(A_SOURCE_HANDLE).classList.contains("clickconnecting")).toBe(false);
  });

  it("makes nothing, but still ends, when the flow refuses the connection", async () => {
    const onConnect = vi.fn<NonNullable<ReactFlowProps["onConnect"]>>();
    const onClickConnectEnd = vi.fn<NonNullable<ReactFlowProps["onClickConnectEnd"]>>();
    await clickHandle({ onConnect, onClickConnectEnd, isValidConnection: () => false });
    act(() => {
      fireEvent.click(query(B_TARGET_HANDLE));
    });
    expect(onConnect).not.toHaveBeenCalled();
    expect(onClickConnectEnd).toHaveBeenCalledOnce();
  });

  it("ends with a click on the canvas", async () => {
    const onClickConnectEnd = vi.fn<NonNullable<ReactFlowProps["onClickConnectEnd"]>>();
    await clickHandle({ onClickConnectEnd });
    act(() => {
      fireEvent.click(query(".react-flow__pane"));
    });
    expect(onClickConnectEnd).toHaveBeenCalledOnce();
    expect(query(A_SOURCE_HANDLE).classList.contains("clickconnecting")).toBe(false);
  });

  it("does not when it is turned off", async () => {
    const onClickConnectStart = vi.fn<NonNullable<ReactFlowProps["onClickConnectStart"]>>();
    await clickHandle({ onClickConnectStart, connectOnClick: false });
    expect(onClickConnectStart).not.toHaveBeenCalled();
    expect(query(A_SOURCE_HANDLE).classList.contains("clickconnecting")).toBe(false);
  });
});

interface Move {
  clientX: number;
  clientY: number;
}

// Presses the source handle of `a` and moves the pointer through `moves`; the pointer is then
// released at the last of them (or where it was pressed).
async function dragFromA(moves: readonly Move[], props: ReactFlowProps): Promise<void> {
  await show(props);
  act(() => {
    fireEvent.pointerDown(query(A_SOURCE_HANDLE), { button: 0, clientX: 0, clientY: 0 });
    for (const move of moves) {
      fireEvent.pointerMove(WINDOW, move);
    }
    fireEvent.pointerUp(WINDOW, moves.at(-1) ?? { clientX: 0, clientY: 0 });
  });
}

describe("connectionDragThreshold", () => {
  const TO_B: Move = { clientX: 200, clientY: 100 };

  it("starts the connection once the pointer has moved past it", async () => {
    const onConnectStart = vi.fn<NonNullable<ReactFlowProps["onConnectStart"]>>();
    await dragFromA([TO_B], { onConnectStart });
    expect(onConnectStart).toHaveBeenCalledOnce();
  });

  it("starts nothing for a press that does not get that far", async () => {
    const onConnectStart = vi.fn<NonNullable<ReactFlowProps["onConnectStart"]>>();
    const onConnectEnd = vi.fn<NonNullable<ReactFlowProps["onConnectEnd"]>>();
    await dragFromA([{ clientX: 1, clientY: 0 }], { onConnectStart, onConnectEnd });
    expect(onConnectStart).not.toHaveBeenCalled();
    expect(onConnectEnd).not.toHaveBeenCalled();
  });

  it("starts at the press when it is 0, and reports the end of a click", async () => {
    const onConnectStart = vi.fn<NonNullable<ReactFlowProps["onConnectStart"]>>();
    const onConnectEnd = vi.fn<NonNullable<ReactFlowProps["onConnectEnd"]>>();
    await dragFromA([], { connectionDragThreshold: 0, onConnectStart, onConnectEnd });
    expect(onConnectStart).toHaveBeenCalledOnce();
    expect(onConnectEnd).toHaveBeenCalledOnce();
  });

  it("gives the connection the default edge options", async () => {
    const onConnect = vi.fn<NonNullable<ReactFlowProps["onConnect"]>>();
    await dragFromA([TO_B], { onConnect, defaultEdgeOptions: { type: "smoothstep" } });
    expect(onConnect).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ source: "a", target: "b", type: "smoothstep" }),
    );
  });
});

async function pressKey(key: string, props: ReactFlowProps): Promise<void> {
  await show(props);
  act(() => {
    fireEvent.click(query(NODE_A));
  });
  await act(async () => {
    fireEvent.keyDown(document.body, { key });
    await Promise.resolve();
  });
}

describe("key codes", () => {
  it("deletes the selection with the key deleteKeyCode names", async () => {
    await pressKey("x", { deleteKeyCode: "x" });
    expect(node("a")).toBeNull();
  });

  it("does not delete with the default key then", async () => {
    await pressKey("Backspace", { deleteKeyCode: "x" });
    expect(node("a")).not.toBeNull();
  });

  it("does not delete at all when deleteKeyCode is null", async () => {
    await pressKey("Backspace", { deleteKeyCode: null });
    expect(node("a")).not.toBeNull();
  });

  it("adds to the selection while multiSelectionKeyCode is held", async () => {
    await show({ multiSelectionKeyCode: "Shift" });
    // The key is taken in before the clicks, as it is when a person presses it first.
    act(() => {
      fireEvent.keyDown(document.body, { key: "Shift" });
    });
    act(() => {
      fireEvent.click(query(NODE_A));
    });
    act(() => {
      fireEvent.click(query('.react-flow__node[data-id="b"]'));
    });
    expect(document.querySelectorAll(".react-flow__node.selected")).toHaveLength(2);
  });

  it("replaces the selection without it", async () => {
    await show({ multiSelectionKeyCode: "Shift" });
    act(() => {
      fireEvent.click(query(NODE_A));
    });
    act(() => {
      fireEvent.click(query('.react-flow__node[data-id="b"]'));
    });
    expect(document.querySelectorAll(".react-flow__node.selected")).toHaveLength(1);
  });
});

describe("useKeyPress", () => {
  it("is true while the key is down", () => {
    const { result } = renderHook(() => useKeyPress("a"));
    expect(result.current).toBe(false);
    act(() => {
      fireEvent.keyDown(document.body, { key: "a" });
    });
    expect(result.current).toBe(true);
    act(() => {
      fireEvent.keyUp(document.body, { key: "a" });
    });
    expect(result.current).toBe(false);
  });
});

describe("markers", () => {
  it("draws the arrow an edge asks for and points the edge at it", async () => {
    const edge: Edge = {
      id: "e",
      source: "a",
      target: "b",
      markerEnd: { type: MarkerType.ArrowClosed },
    };
    await show({ defaultEdges: [edge] });
    expect(document.querySelector("marker")).not.toBeNull();
    expect(query('.react-flow__edge[data-id="e"] path').getAttribute("marker-end")).toContain(
      "url('#",
    );
  });
});

describe("keyboard moves", () => {
  it("moves a selected node with the arrow keys and announces it", async () => {
    const seen: NodeChange[] = [];
    await show({
      onNodesChange: (changes) => {
        seen.push(...changes);
      },
    });
    const element = query(NODE_A);
    act(() => {
      fireEvent.click(element);
    });
    act(() => {
      fireEvent.keyDown(element, { key: "ArrowRight" });
    });
    const moved = seen.filter((change) => change.type === "position");
    expect(moved.length).toBeGreaterThan(0);
    expect(query(".a11y-live, [aria-live]").textContent).not.toBe("");
  });
});
