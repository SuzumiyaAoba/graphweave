import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { useLayoutEffect } from "react";
import { describe, expect, it, vi } from "vite-plus/test";

import type { ReactFlowProps } from "./react-flow-props.ts";
import { ReactFlow } from "./react-flow.tsx";
import type { ReactFlowStore } from "./store-context.ts";
import type { Node } from "./types.ts";
import { useStoreApi } from "./use-store.ts";

const WINDOW = globalThis.window;

const NODES: Node[] = [
  { id: "a", position: { x: 0, y: 0 }, data: {}, width: 100, height: 40 },
  { id: "b", position: { x: 200, y: 100 }, data: {}, width: 100, height: 40 },
];

async function show(props: ReactFlowProps): Promise<void> {
  cleanup();
  await act(async () => {
    render(<ReactFlow width={800} height={600} {...props} />);
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

// Presses node `a` and moves the pointer 20 px, then 20 px more, then lets it go: the first move
// begins the drag, the second moves the node. Away from the edge of the canvas, where it would scroll.
function dragA(): void {
  act(() => {
    fireEvent.pointerDown(query('.react-flow__node[data-id="a"]'), {
      button: 0,
      clientX: 300,
      clientY: 300,
    });
    fireEvent.pointerMove(WINDOW, { clientX: 320, clientY: 300 });
    fireEvent.pointerMove(WINDOW, { clientX: 340, clientY: 300 });
    fireEvent.pointerUp(WINDOW, { clientX: 340, clientY: 300 });
  });
}

describe("the nodes a drag tells its callbacks, as React Flow tells them", () => {
  it("are where the drag has put them and flagged as dragged, though the owner has not taken them", async () => {
    const onNodeDragStart = vi.fn<NonNullable<ReactFlowProps["onNodeDragStart"]>>();
    const onNodeDrag = vi.fn<NonNullable<ReactFlowProps["onNodeDrag"]>>();
    const onNodeDragStop = vi.fn<NonNullable<ReactFlowProps["onNodeDragStop"]>>();
    // An owner that holds its nodes and does not take the changes.
    await show({ nodes: NODES, onNodeDragStart, onNodeDrag, onNodeDragStop });
    dragA();
    const started = onNodeDragStart.mock.calls[0]?.[1];
    const moved = onNodeDrag.mock.calls.at(-1)?.[1];
    const stopped = onNodeDragStop.mock.calls[0]?.[1];
    expect([started?.position, started?.dragging]).toStrictEqual([{ x: 0, y: 0 }, true]);
    expect([moved?.position, moved?.dragging]).toStrictEqual([{ x: 20, y: 0 }, true]);
    expect([stopped?.position, stopped?.dragging]).toStrictEqual([{ x: 20, y: 0 }, false]);
  });

  it("are copies: the owner's own nodes are left as they were", async () => {
    const onNodeDragStop = vi.fn<NonNullable<ReactFlowProps["onNodeDragStop"]>>();
    await show({ nodes: NODES, onNodeDragStop });
    dragA();
    expect(onNodeDragStop.mock.calls[0]?.[1]).not.toBe(NODES[0]);
    expect(NODES[0]?.position).toStrictEqual({ x: 0, y: 0 });
  });
});

describe("the state a connection ends with", () => {
  it("holds the node it began at as the flow holds it, with its internals", async () => {
    const onConnectEnd = vi.fn<NonNullable<ReactFlowProps["onConnectEnd"]>>();
    await show({ defaultNodes: NODES, onConnectEnd });
    act(() => {
      fireEvent.pointerDown(query('.react-flow__node[data-id="a"] .react-flow__handle.source'), {
        button: 0,
        clientX: 0,
        clientY: 0,
      });
      fireEvent.pointerMove(WINDOW, { clientX: 400, clientY: 400 });
      fireEvent.pointerUp(WINDOW, { clientX: 400, clientY: 400 });
    });
    const state = onConnectEnd.mock.calls[0]?.[1];
    expect(state?.fromNode).toHaveProperty("internals.positionAbsolute", { x: 0, y: 0 });
  });
});

const SELECTED: Node[] = [
  { id: "a", position: { x: 0, y: 0 }, data: {}, width: 100, height: 40, selected: true },
  { id: "b", position: { x: 200, y: 100 }, data: {}, width: 100, height: 40, selected: true },
];

// An owner that answers onBeforeDelete with no.
async function refuse(): Promise<boolean> {
  await Promise.resolve();
  return false;
}

// Hands the store of the flow it is rendered in to `onStore`.
function Capture({ onStore }: { onStore: (store: ReactFlowStore) => void }): null {
  const store = useStoreApi();
  useLayoutEffect(() => {
    onStore(store);
  });
  return null;
}

describe("the delete key", () => {
  it("takes away the frame around the selection also when onBeforeDelete refuses", async () => {
    const held: { store: ReactFlowStore | undefined } = { store: undefined };
    cleanup();
    await act(async () => {
      render(
        <ReactFlow width={800} height={600} defaultNodes={SELECTED} onBeforeDelete={refuse}>
          <Capture
            onStore={(store) => {
              held.store = store;
            }}
          />
        </ReactFlow>,
      );
      await Promise.resolve();
    });
    act(() => {
      held.store?.setState({ nodesSelectionActive: true });
    });
    await act(async () => {
      fireEvent.keyDown(document.body, { key: "Backspace" });
      await Promise.resolve();
    });
    expect(held.store?.getState().nodesSelectionActive).toBe(false);
    expect(document.querySelectorAll(".react-flow__node")).toHaveLength(2);
  });
});
