import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";

import type { ReactFlowInstance } from "./instance-types.ts";
import { noop } from "./noop.ts";
import type { ReactFlowProps } from "./react-flow-props.ts";
import { ReactFlow } from "./react-flow.tsx";
import { flowSettled } from "./test-settle.ts";
import type { Edge, Node } from "./types.ts";

// Happy-dom has no layout, so every handle is measured at its node's origin: the handles of "a" are
// at (0, 0), those of "b" at (200, 100) and those of "c" at (400, 0).
const NODES: Node[] = [
  { id: "a", position: { x: 0, y: 0 }, data: {}, width: 100, height: 40 },
  { id: "b", position: { x: 200, y: 100 }, data: {}, width: 100, height: 40 },
  { id: "c", position: { x: 400, y: 0 }, data: {}, width: 100, height: 40 },
];

const EDGE: Edge = { id: "e", source: "a", target: "b" };

const WINDOW = globalThis.window;

async function show(edges: Edge[], extra: Partial<ReactFlowProps> = {}): Promise<void> {
  cleanup();
  await act(async () => {
    render(
      <ReactFlow width={800} height={600} defaultNodes={NODES} defaultEdges={edges} {...extra} />,
    );
    await flowSettled();
  });
  await act(flowSettled);
}

function anchors(end: string): number {
  return document.querySelectorAll(`.react-flow__edgeupdater-${end}`).length;
}

function edgeClass(id: string): string {
  return document.querySelector(`[data-id="${id}"]`)?.getAttribute("class") ?? "";
}

function targetAnchor(): Element {
  const anchor = document.querySelector(".react-flow__edgeupdater-target");
  if (anchor === null) {
    throw new Error("no anchor on the target end");
  }
  return anchor;
}

function pane(): Element {
  const element = document.querySelector(".react-flow__pane");
  if (element === null) {
    throw new Error("no pane");
  }
  return element;
}

interface Spot {
  x: number;
  y: number;
}

// The target end of "e" is where "b"'s handle is.
const TARGET_END: Spot = { x: 200, y: 100 };
const ON_C: Spot = { x: 400, y: 0 };
const NOWHERE: Spot = { x: 700, y: 500 };

function press(at: Spot): void {
  act(() => {
    fireEvent.pointerDown(targetAnchor(), { button: 0, clientX: at.x, clientY: at.y });
  });
}

function moveTo(at: Spot): void {
  act(() => {
    fireEvent.pointerMove(WINDOW, { clientX: at.x, clientY: at.y });
  });
}

function release(at: Spot): void {
  act(() => {
    fireEvent.pointerUp(WINDOW, { clientX: at.x, clientY: at.y });
  });
}

function dragTargetEnd(to: Spot): void {
  press(TARGET_END);
  moveTo(to);
  release(to);
}

interface Holder {
  instance: ReactFlowInstance | undefined;
}

async function deleteEdge(holder: Holder, id: string): Promise<void> {
  await act(async () => {
    await holder.instance?.deleteElements({ edges: [{ id }] });
  });
}

describe("edge reconnect anchors", () => {
  it("sit on both ends of an edge once `onReconnect` is given", async () => {
    await show([EDGE], { onReconnect: noop });
    expect(anchors("source")).toBe(1);
    expect(anchors("target")).toBe(1);
  });

  it("are left out without `onReconnect`", async () => {
    await show([EDGE]);
    expect(document.querySelectorAll(".react-flow__edgeupdater")).toHaveLength(0);
  });

  it("follow an edge's own `reconnectable`, which names the one end that can move", async () => {
    await show([{ ...EDGE, reconnectable: "target" }], { onReconnect: noop });
    expect(anchors("source")).toBe(0);
    expect(anchors("target")).toBe(1);
  });

  it("are left out of an edge that is not reconnectable", async () => {
    await show([{ ...EDGE, reconnectable: false }], { onReconnect: noop });
    expect(document.querySelectorAll(".react-flow__edgeupdater")).toHaveLength(0);
  });
});

describe("reconnecting an edge", () => {
  it("reports the new connection when the end is dropped on another handle", async () => {
    const onReconnect = vi.fn<NonNullable<ReactFlowProps["onReconnect"]>>();
    await show([EDGE], { onReconnect });
    dragTargetEnd(ON_C);
    expect(onReconnect).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ id: "e", source: "a", target: "b" }),
      expect.objectContaining({ source: "a", target: "c" }),
    );
  });

  it("leaves moving the edge to `onReconnect`, even in a flow that owns its edges", async () => {
    await show([EDGE], { onReconnect: noop });
    dragTargetEnd(ON_C);
    expect(document.querySelector('[data-id="e"]')).not.toBeNull();
    expect(document.querySelector('[data-id="xy-edge__a-c"]')).toBeNull();
  });

  it("does not draw the edge while one of its ends is moved", async () => {
    await show([EDGE], { onReconnect: noop });
    expect(document.querySelectorAll('[data-id="e"] .react-flow__edge-path')).toHaveLength(1);
    press(TARGET_END);
    moveTo(ON_C);
    expect(document.querySelectorAll('[data-id="e"] .react-flow__edge-path')).toHaveLength(0);
    release(ON_C);
    expect(document.querySelectorAll('[data-id="e"] .react-flow__edge-path')).toHaveLength(1);
  });

  it("also tells the flow's onConnectStart and onConnectEnd", async () => {
    const onConnectStart = vi.fn<NonNullable<ReactFlowProps["onConnectStart"]>>();
    const onConnectEnd = vi.fn<NonNullable<ReactFlowProps["onConnectEnd"]>>();
    await show([EDGE], { onReconnect: noop, onConnectStart, onConnectEnd });
    dragTargetEnd(ON_C);
    expect(onConnectStart).toHaveBeenCalledExactlyOnceWith(expect.anything(), {
      nodeId: "a",
      handleId: null,
      handleType: "source",
    });
    expect(onConnectEnd).toHaveBeenCalledOnce();
  });

  it("shows the edge as being updated while the pointer is over one of its ends", async () => {
    await show([EDGE], { onReconnect: noop });
    expect(edgeClass("e")).not.toContain("updating");
    act(() => {
      fireEvent.mouseEnter(targetAnchor());
    });
    expect(edgeClass("e")).toContain("updating");
    act(() => {
      fireEvent.mouseOut(targetAnchor());
    });
    expect(edgeClass("e")).not.toContain("updating");
  });

  it("selects the edge when an end is clicked", async () => {
    await show([EDGE], { onReconnect: noop });
    act(() => {
      fireEvent.click(targetAnchor());
    });
    expect(edgeClass("e")).toContain("selected");
  });

  it("reports the kind of the end that stays where it is, as React Flow does", async () => {
    const onReconnectStart = vi.fn<NonNullable<ReactFlowProps["onReconnectStart"]>>();
    const onReconnectEnd = vi.fn<NonNullable<ReactFlowProps["onReconnectEnd"]>>();
    await show([EDGE], { onReconnect: noop, onReconnectStart, onReconnectEnd });
    dragTargetEnd(NOWHERE);
    // The target end was dragged, so the end that stays is the source.
    expect(onReconnectStart).toHaveBeenCalledExactlyOnceWith(
      expect.anything(),
      expect.objectContaining({ id: "e" }),
      "source",
    );
    expect(onReconnectEnd).toHaveBeenCalledExactlyOnceWith(
      expect.anything(),
      expect.objectContaining({ id: "e" }),
      "source",
      expect.anything(),
    );
  });

  it("keeps the selection when an end is dropped on the empty canvas", async () => {
    await show([EDGE], { onReconnect: noop });
    act(() => {
      fireEvent.click(targetAnchor());
    });
    press(TARGET_END);
    moveTo(NOWHERE);
    act(() => {
      fireEvent.pointerUp(pane(), { clientX: NOWHERE.x, clientY: NOWHERE.y });
      fireEvent.click(pane());
    });
    expect(edgeClass("e")).toContain("selected");
  });

  it("starts nothing for a click on an end", async () => {
    const onReconnectStart = vi.fn<NonNullable<ReactFlowProps["onReconnectStart"]>>();
    const onReconnectEnd = vi.fn<NonNullable<ReactFlowProps["onReconnectEnd"]>>();
    await show([EDGE], { onReconnect: noop, onReconnectStart, onReconnectEnd });
    press(TARGET_END);
    release(TARGET_END);
    expect(onReconnectStart).not.toHaveBeenCalled();
    expect(onReconnectEnd).not.toHaveBeenCalled();
  });

  it("only reports where the drag ended when it is dropped on empty space", async () => {
    const onReconnect = vi.fn<NonNullable<ReactFlowProps["onReconnect"]>>();
    const onReconnectStart = vi.fn<NonNullable<ReactFlowProps["onReconnectStart"]>>();
    const onReconnectEnd = vi.fn<NonNullable<ReactFlowProps["onReconnectEnd"]>>();
    await show([EDGE], { onReconnect, onReconnectStart, onReconnectEnd });
    dragTargetEnd(NOWHERE);
    expect(onReconnectStart).toHaveBeenCalledOnce();
    expect(onReconnectEnd).toHaveBeenCalledOnce();
    expect(onReconnect).not.toHaveBeenCalled();
    expect(document.querySelector('[data-id="e"]')).not.toBeNull();
  });

  it("leaves a second edge alone when the connection it would make already exists", async () => {
    const edges: Edge[] = [EDGE, { id: "f", source: "a", target: "c" }];
    const onReconnect = vi.fn<NonNullable<ReactFlowProps["onReconnect"]>>();
    await show(edges, { onReconnect });
    dragTargetEnd(ON_C);
    // The drop reached the handle and was reported; the flow just does not make a second a -> c.
    expect(onReconnect).toHaveBeenCalledOnce();
    expect(document.querySelectorAll(".react-flow__edge")).toHaveLength(2);
    expect(document.querySelector('[data-id="e"]')).not.toBeNull();
  });

  it("reports the edge as it was when the drag began, even if it was removed meanwhile", async () => {
    const holder: Holder = { instance: undefined };
    const onReconnect = vi.fn<NonNullable<ReactFlowProps["onReconnect"]>>();
    await show([EDGE], {
      onReconnect,
      onInit: (instance) => {
        holder.instance = instance;
      },
    });
    press(TARGET_END);
    await deleteEdge(holder, "e");
    moveTo(ON_C);
    release(ON_C);
    expect(onReconnect).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ id: "e" }),
      expect.objectContaining({ source: "a", target: "c" }),
    );
    expect(document.querySelectorAll(".react-flow__edge")).toHaveLength(0);
  });
});
