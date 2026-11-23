import { Position } from "@free-flow/core";
import { act, cleanup, render } from "@testing-library/react";
import type { ReactElement } from "react";
import { useLayoutEffect } from "react";
import { describe, expect, it, vi } from "vite-plus/test";

import { Handle } from "./handle.tsx";
import { ReactFlow } from "./react-flow.tsx";
import type { ReactFlowStore } from "./store-context.ts";
import { flowSettled } from "./test-settle.ts";
import type { Node } from "./types.ts";
import { useStoreApi } from "./use-store.ts";

// Two target handles without an id: the second one opens and closes.
function FlagNode({ data }: { data: { open: boolean } }): ReactElement {
  return (
    <>
      <Handle type="target" position={Position.Left} />
      <Handle type="target" position={Position.Top} isConnectable={data.open} />
    </>
  );
}

const NODE_TYPES = { flag: FlagNode };

function nodesWith(open: boolean): Node[] {
  return [
    { id: "a", type: "flag", position: { x: 0, y: 0 }, data: { open }, width: 100, height: 40 },
  ];
}

// Hands the store of the flow it is rendered in to `onStore`.
function Capture({ onStore }: { onStore: (store: ReactFlowStore) => void }): null {
  const store = useStoreApi();
  useLayoutEffect(() => {
    onStore(store);
  });
  return null;
}

function flowOf(open: boolean, onStore: (store: ReactFlowStore) => void): ReactElement {
  return (
    <ReactFlow width={800} height={600} nodes={nodesWith(open)} nodeTypes={NODE_TYPES}>
      <Capture onStore={onStore} />
    </ReactFlow>
  );
}

// A page without layout measures every box as having no size, and the flow then keeps the handles it
// knew (as React Flow does for a hidden flow): the boxes are given a size while `run` goes on.
async function withSizedBoxes(run: () => Promise<void>): Promise<void> {
  const width = vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(100);
  const height = vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(40);
  try {
    await run();
  } finally {
    width.mockRestore();
    height.mockRestore();
  }
}

// Renders the flow with the handle open, then closed; tells what the flow knows of it then.
async function knownAfterClosing(): Promise<(boolean | undefined)[]> {
  const held: { store: ReactFlowStore | undefined } = { store: undefined };
  const keep = (store: ReactFlowStore): void => {
    held.store = store;
  };
  cleanup();
  const { rerender } = render(flowOf(true, keep));
  await act(flowSettled);
  await act(async () => {
    rerender(flowOf(false, keep));
    await flowSettled();
  });
  const targets = held.store?.getState().nodeLookup.get("a")?.internals.handleBounds?.target ?? [];
  return targets.map((bound) => bound.isConnectable);
}

// As with React Flow, whose connection reads the classes of the handle on the page when it asks.
describe("a handle whose isConnectable changes", () => {
  it("is known by the flow to be closed, once it is, and another handle without an id is not", async () => {
    let known: (boolean | undefined)[] = [];
    await withSizedBoxes(async () => {
      known = await knownAfterClosing();
    });
    expect(known).toStrictEqual([true, false]);
  });
});
