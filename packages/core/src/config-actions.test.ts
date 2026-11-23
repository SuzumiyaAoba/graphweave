import { describe, expect, it } from "vite-plus/test";

import { createFlowStore } from "./flow-store.ts";
import { makeNode } from "./test-fixtures.ts";

describe("the actions that set the store's configuration", () => {
  it("set the zoom limits and the extents", () => {
    const store = createFlowStore();
    store.getState().setMinZoom(0.25);
    store.getState().setMaxZoom(3);
    store.getState().setTranslateExtent([
      [-10, -20],
      [30, 40],
    ]);
    store.getState().setNodeExtent([
      [0, 0],
      [100, 100],
    ]);
    const { minZoom, maxZoom, translateExtent, nodeExtent } = store.getState();
    expect({ minZoom, maxZoom, translateExtent, nodeExtent }).toStrictEqual({
      minZoom: 0.25,
      maxZoom: 3,
      translateExtent: [
        [-10, -20],
        [30, 40],
      ],
      nodeExtent: [
        [0, 0],
        [100, 100],
      ],
    });
  });

  it("make the flow own the nodes and edges it is given", () => {
    const store = createFlowStore();
    store.getState().setDefaultNodesAndEdges([makeNode("a")]);
    const { nodes, hasDefaultNodes, hasDefaultEdges } = store.getState();
    expect([nodes.map((node) => node.id), hasDefaultNodes, hasDefaultEdges]).toStrictEqual([
      ["a"],
      true,
      false,
    ]);
  });

  it("reset what the flow holds and leave its settings", () => {
    const store = createFlowStore({ defaultNodes: [makeNode("a")], minZoom: 0.3 });
    store.getState().setViewport({ x: 5, y: 6, zoom: 1 });
    store.getState().reset();
    const { nodes, viewport, transform, minZoom } = store.getState();
    expect([nodes.length, viewport, [...transform], minZoom]).toStrictEqual([
      0,
      { x: 0, y: 0, zoom: 1 },
      [0, 0, 1],
      0.3,
    ]);
  });
});
