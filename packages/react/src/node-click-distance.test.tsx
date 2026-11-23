import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";

import type { ReactFlowProps } from "./react-flow-props.ts";
import { ReactFlow } from "./react-flow.tsx";
import type { Node } from "./types.ts";

const NODES: Node[] = [{ id: "a", position: { x: 0, y: 0 }, data: {}, width: 100, height: 40 }];

const WINDOW = globalThis.window;

async function flow(props: ReactFlowProps): Promise<HTMLElement> {
  cleanup();
  await act(async () => {
    render(<ReactFlow width={800} height={600} defaultNodes={NODES} {...props} />);
    await Promise.resolve();
  });
  const node = document.querySelector<HTMLElement>('.react-flow__node[data-id="a"]');
  if (node === null) {
    throw new Error("no node");
  }
  return node;
}

// Presses the node, moves the pointer `distance` px away and releases, then the browser's click.
function pressAndRelease(node: HTMLElement, distance: number): void {
  act(() => {
    fireEvent.pointerDown(node, { button: 0, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(WINDOW, { clientX: distance, clientY: 0 });
    fireEvent.pointerUp(WINDOW, { clientX: distance, clientY: 0 });
    fireEvent.click(node);
  });
}

describe("nodeClickDistance", () => {
  it("counts a press and release without movement as a click", async () => {
    const onNodeClick = vi.fn<NonNullable<ReactFlowProps["onNodeClick"]>>();
    const node = await flow({ onNodeClick });
    pressAndRelease(node, 0);
    expect(onNodeClick).toHaveBeenCalledOnce();
  });

  it("takes the click away once the pointer has moved, by default", async () => {
    const onNodeClick = vi.fn<NonNullable<ReactFlowProps["onNodeClick"]>>();
    const node = await flow({ onNodeClick });
    pressAndRelease(node, 3);
    expect(onNodeClick).not.toHaveBeenCalled();
  });

  it("still sends the click when the pointer stayed within the distance", async () => {
    const onNodeClick = vi.fn<NonNullable<ReactFlowProps["onNodeClick"]>>();
    const node = await flow({ onNodeClick, nodeClickDistance: 5 });
    pressAndRelease(node, 3);
    expect(onNodeClick).toHaveBeenCalledOnce();
  });

  it("takes the click away when the pointer went beyond the distance", async () => {
    const onNodeClick = vi.fn<NonNullable<ReactFlowProps["onNodeClick"]>>();
    const node = await flow({ onNodeClick, nodeClickDistance: 5 });
    pressAndRelease(node, 9);
    expect(onNodeClick).not.toHaveBeenCalled();
  });
});
