import { describe, expect, it } from "vite-plus/test";

import type { HandleBounds } from "./flow-state.ts";
import { createFlowStore } from "./flow-store.ts";
import { Position } from "./types.ts";

const bounds: HandleBounds = {
  source: [
    { id: null, type: "source", position: Position.Right, x: 100, y: 20, width: 8, height: 8 },
  ],
  target: [],
};

describe("a node that is measured at no size, as the nodes of a hidden flow are", () => {
  it("keeps the handles it knows, as in React Flow", () => {
    const store = createFlowStore({
      defaultNodes: [
        { id: "a", position: { x: 0, y: 0 }, data: {}, measured: { width: 100, height: 50 } },
      ],
    });
    const { updateNodeDimensions } = store.getState();
    updateNodeDimensions([{ id: "a", width: 100, height: 50, handleBounds: bounds }]);
    updateNodeDimensions([
      { id: "a", width: 0, height: 0, handleBounds: { source: [], target: [] } },
    ]);
    expect(store.getState().nodeLookup.get("a")?.internals.handleBounds).toStrictEqual(bounds);
  });
});
