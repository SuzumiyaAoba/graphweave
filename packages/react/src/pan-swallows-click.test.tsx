import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";

import type { ReactFlowProps } from "./react-flow-props.ts";
import { ReactFlow } from "./react-flow.tsx";

const WINDOW = globalThis.window;

// A node that cannot be dragged does not stop a pan that begins on it.
async function flow(props: ReactFlowProps): Promise<HTMLElement> {
  cleanup();
  await act(async () => {
    render(
      <ReactFlow
        width={800}
        height={600}
        defaultNodes={[
          {
            id: "a",
            position: { x: 100, y: 100 },
            data: {},
            width: 100,
            height: 40,
            draggable: false,
          },
        ]}
        {...props}
      />,
    );
    await Promise.resolve();
  });
  const node = document.querySelector<HTMLElement>(".react-flow__node");
  if (node === null) {
    throw new Error("there is no node");
  }
  return node;
}

function pan(node: HTMLElement, distance: number): void {
  act(() => {
    fireEvent.pointerDown(node, { button: 0, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(WINDOW, { clientX: 10 + distance, clientY: 10 });
    fireEvent.pointerUp(WINDOW, { clientX: 10 + distance, clientY: 10 });
  });
}

describe("the click that follows a pan that began on a node", () => {
  it("is not a click on the node when the pan moved, as d3-zoom stops it", async () => {
    const onNodeClick = vi.fn<NonNullable<ReactFlowProps["onNodeClick"]>>();
    const node = await flow({ onNodeClick });
    pan(node, 40);
    act(() => {
      fireEvent.click(node);
    });
    expect(onNodeClick).not.toHaveBeenCalled();
  });

  it("is a click on the node when the pointer did not move", async () => {
    const onNodeClick = vi.fn<NonNullable<ReactFlowProps["onNodeClick"]>>();
    const node = await flow({ onNodeClick });
    pan(node, 0);
    act(() => {
      fireEvent.click(node);
    });
    expect(onNodeClick).toHaveBeenCalledOnce();
  });

  it("is still a click when the pointer moved one pixel, the default paneClickDistance", async () => {
    const onNodeClick = vi.fn<NonNullable<ReactFlowProps["onNodeClick"]>>();
    const node = await flow({ onNodeClick });
    pan(node, 1);
    act(() => {
      fireEvent.click(node);
    });
    expect(onNodeClick).toHaveBeenCalledOnce();
  });

  it("is still a click when the pointer moved less than the paneClickDistance of the flow", async () => {
    const onNodeClick = vi.fn<NonNullable<ReactFlowProps["onNodeClick"]>>();
    const node = await flow({ onNodeClick, paneClickDistance: 10 });
    pan(node, 5);
    act(() => {
      fireEvent.click(node);
    });
    expect(onNodeClick).toHaveBeenCalledOnce();
  });

  it("lets a click through again once the task is over, whatever the pan did", async () => {
    const onNodeClick = vi.fn<NonNullable<ReactFlowProps["onNodeClick"]>>();
    const node = await flow({ onNodeClick });
    pan(node, 40);
    await act(async () => {
      // oxlint-disable-next-line promise/avoid-new -- wraps the callback-based setTimeout
      await new Promise((resolve) => {
        setTimeout(resolve, 0);
      });
    });
    act(() => {
      fireEvent.click(node);
    });
    expect(onNodeClick).toHaveBeenCalledOnce();
  });

  it("is not stopped after a pan by a finger, which d3-zoom does not stop either", async () => {
    const onNodeClick = vi.fn<NonNullable<ReactFlowProps["onNodeClick"]>>();
    const node = await flow({ onNodeClick });
    const layer = document.querySelector<HTMLElement>(".react-flow__viewport");
    const before = layer?.style.transform;
    act(() => {
      fireEvent.pointerDown(node, {
        button: 0,
        pointerType: "touch",
        pointerId: 1,
        isPrimary: true,
        clientX: 10,
        clientY: 10,
      });
      fireEvent.pointerMove(WINDOW, {
        pointerType: "touch",
        pointerId: 1,
        clientX: 60,
        clientY: 10,
      });
      fireEvent.pointerUp(WINDOW, { pointerType: "touch", pointerId: 1 });
    });
    // The finger did pan the canvas, and the click that follows it is still a click on the node.
    expect(layer?.style.transform).not.toBe(before);
    act(() => {
      fireEvent.click(node);
    });
    expect(onNodeClick).toHaveBeenCalledOnce();
  });
});
