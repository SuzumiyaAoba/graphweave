import type { Viewport } from "@free-flow/core";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";

import type { ReactFlowInstance } from "./instance-types.ts";
import type { ReactFlowProps } from "./react-flow-props.ts";
import { ReactFlow } from "./react-flow.tsx";
import { flowSettled } from "./test-settle.ts";
import type { Node } from "./types.ts";
import { useOnViewportChange } from "./use-events.ts";

const NODES: Node[] = [
  { id: "a", position: { x: 0, y: 0 }, data: {}, width: 100, height: 40 },
  { id: "b", position: { x: 200, y: 100 }, data: {}, width: 100, height: 40 },
];

interface Shown {
  instance: ReactFlowInstance | undefined;
}

async function show(props: ReactFlowProps, children?: React.ReactNode): Promise<Shown> {
  const shown: Shown = { instance: undefined };
  cleanup();
  act(() => {
    render(
      <ReactFlow
        width={800}
        height={600}
        onInit={(instance) => {
          shown.instance = instance;
        }}
        {...props}
      >
        {children}
      </ReactFlow>,
    );
  });
  await act(flowSettled);
  return shown;
}

function paneOf(): Element {
  const pane = document.querySelector(".react-flow__pane");
  if (pane === null) {
    throw new Error("there is no pane");
  }
  return pane;
}

describe("what the instance is asked to do to the nodes", () => {
  it("is done together when the flow renders next, as one change", async () => {
    const onNodesChange = vi.fn<NonNullable<ReactFlowProps["onNodesChange"]>>();
    const shown = await show({ nodes: NODES, onNodesChange });
    onNodesChange.mockClear();
    await act(async () => {
      shown.instance?.updateNodeData("a", { one: 1 });
      shown.instance?.updateNodeData("b", { two: 2 });
      // Not yet: the calls wait for the flow to render.
      expect(onNodesChange).not.toHaveBeenCalled();
      await flowSettled();
    });
    expect(onNodesChange).toHaveBeenCalledOnce();
    expect(onNodesChange.mock.calls[0]?.[0].map((change) => change.type)).toStrictEqual([
      "replace",
      "replace",
    ]);
  });

  it("tells where a node that is added goes", async () => {
    const onNodesChange = vi.fn<NonNullable<ReactFlowProps["onNodesChange"]>>();
    const shown = await show({ nodes: NODES, onNodesChange });
    onNodesChange.mockClear();
    await act(async () => {
      shown.instance?.addNodes({ id: "c", position: { x: 0, y: 0 }, data: {} });
      await flowSettled();
    });
    expect(onNodesChange.mock.calls[0]?.[0]).toStrictEqual([
      { type: "add", index: 2, item: { id: "c", position: { x: 0, y: 0 }, data: {} } },
    ]);
  });
});

describe("a move of the viewport that a call makes", () => {
  it("is told to onMove before the hooks that listen to the viewport", async () => {
    const told: string[] = [];
    function Watch(): null {
      useOnViewportChange({
        onChange: () => {
          told.push("hook");
        },
      });
      return null;
    }
    const onMove = (): void => {
      told.push("onMove");
    };
    const shown = await show({ defaultNodes: NODES, onMove }, <Watch />);
    told.length = 0;
    await act(async () => {
      await shown.instance?.setViewport({ x: 10, y: 20, zoom: 1 });
    });
    expect(told).toStrictEqual(["onMove", "hook"]);
  });

  it("is told also when it leaves the viewport where it was", async () => {
    const onMove = vi.fn<(event: unknown, viewport: Viewport) => void>();
    const shown = await show({ defaultNodes: NODES, onMove });
    onMove.mockClear();
    await act(async () => {
      await shown.instance?.setViewport({ x: 0, y: 0, zoom: 1 });
    });
    expect(onMove).toHaveBeenCalledExactlyOnceWith(null, { x: 0, y: 0, zoom: 1 });
  });
});

describe("a pan by scrolling", () => {
  it("is told as begun by its first wheel event, and as moved from the second", async () => {
    const onMoveStart = vi.fn<NonNullable<ReactFlowProps["onMoveStart"]>>();
    const onMove = vi.fn<NonNullable<ReactFlowProps["onMove"]>>();
    await show({ defaultNodes: NODES, panOnScroll: true, onMoveStart, onMove });
    const pane = paneOf();
    onMove.mockClear();
    act(() => {
      fireEvent.wheel(pane, { deltaY: 40 });
    });
    // The start is told from where the first event took the canvas, and is not a move.
    expect(onMoveStart.mock.calls.map(([, viewport]) => viewport.y)).toStrictEqual([-20]);
    expect(onMove).not.toHaveBeenCalled();
    act(() => {
      fireEvent.wheel(pane, { deltaY: 40 });
    });
    expect(onMove.mock.calls.map(([, viewport]) => viewport.y)).toStrictEqual([-40]);
  });
});
