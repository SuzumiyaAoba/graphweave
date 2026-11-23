import { describe, expect, it } from "vite-plus/test";

import { createFlowStore } from "./flow-store.ts";
import type { EdgeBase, NodeBase } from "./types.ts";

describe("a zoom outside a range that was narrowed", () => {
  it("is kept by a pan, and held to the range by the next zoom", () => {
    const store = createFlowStore<NodeBase, EdgeBase>({ width: 800, height: 600 });
    store.getState().setViewportAsGiven({ x: 0, y: 0, zoom: 2 });
    store.setState({ maxZoom: 1.5 });
    store.getState().panBy({ x: 10, y: 20 });
    expect(store.getState().viewport).toStrictEqual({ x: 10, y: 20, zoom: 2 });
    store.getState().zoomTo(3);
    expect(store.getState().viewport.zoom).toBe(1.5);
  });

  it("is still lifted off zero by a pan", () => {
    const store = createFlowStore<NodeBase, EdgeBase>({ width: 800, height: 600 });
    store.getState().setViewportAsGiven({ x: 0, y: 0, zoom: 0 });
    store.getState().panBy({ x: 5, y: 0 });
    expect(store.getState().viewport.zoom).toBeGreaterThan(0);
  });
});
