import { act, renderHook } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { describe, expect, it } from "vite-plus/test";

import { ReactFlowProvider } from "./react-flow-provider.tsx";
import type { Node } from "./types.ts";
import { useNodesInitialized } from "./use-graph-hooks.ts";
import { useStoreApi } from "./use-store.ts";

// As React Flow's: the default waits for every shown node to be measured (a size the owner gave does
// not count), and with hidden nodes counted every node needs its handles measured too.
const NODES: Node[] = [
  { id: "a", position: { x: 0, y: 0 }, data: {}, width: 100, height: 40 },
  { id: "h", position: { x: 0, y: 100 }, data: {}, width: 100, height: 40, hidden: true },
];

function wrapper({ children }: { children: ReactNode }): ReactElement {
  return <ReactFlowProvider initialNodes={NODES}>{children}</ReactFlowProvider>;
}

function watch(): { store: ReturnType<typeof useStoreApi>; current: () => [boolean, boolean] } {
  const { result } = renderHook(
    () => ({
      store: useStoreApi(),
      shown: useNodesInitialized(),
      all: useNodesInitialized({ includeHiddenNodes: true }),
    }),
    { wrapper },
  );
  return {
    store: result.current.store,
    current: () => [result.current.shown, result.current.all],
  };
}

function measure(store: ReturnType<typeof useStoreApi>, id: string): void {
  act(() => {
    store.getState().updateNodeDimensions([
      {
        id,
        width: 100,
        height: 40,
        handleBounds: { source: [], target: [] },
      },
    ]);
  });
}

describe("useNodesInitialized", () => {
  it("is false for nodes that were only given a size, hidden nodes counted or not", () => {
    const { current } = watch();
    expect(current()).toStrictEqual([false, false]);
  });

  it("is true once the shown nodes are measured, and for hidden ones only when they are too", () => {
    const { store, current } = watch();
    measure(store, "a");
    expect(current()).toStrictEqual([true, false]);
    measure(store, "h");
    expect(current()).toStrictEqual([true, true]);
  });
});
