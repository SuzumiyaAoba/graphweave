import { describe, expect, it } from "vite-plus/test";

import { createFlowStore } from "./flow-store.ts";
import { makeNode } from "./test-fixtures.ts";
import type { NodeBase } from "./types.ts";

const EXTENT = [
  [0, 0],
  [500, 300],
] as const;

function placed(store: ReturnType<typeof createFlowStore>, id: string): [number, number] {
  const at = store.getState().nodeLookup.get(id)?.internals.positionAbsolute;
  return [at?.x ?? Number.NaN, at?.y ?? Number.NaN];
}

function sized(id: string, at: [x: number, y: number], extra: Partial<NodeBase> = {}): NodeBase {
  return makeNode(id, {
    position: { x: at[0], y: at[1] },
    measured: { width: 150, height: 40 },
    ...extra,
  });
}

describe("nodeExtent, applied when the nodes are adopted", () => {
  it("holds each node's corner inside it, keeping the node's own position as it is", () => {
    const nodes = [sized("a", [-100, -50]), sized("b", [700, 400]), sized("c", [100, 100])];
    const store = createFlowStore({ defaultNodes: nodes, nodeExtent: EXTENT });
    expect([placed(store, "a"), placed(store, "b"), placed(store, "c")]).toStrictEqual([
      [0, 0],
      [350, 260],
      [100, 100],
    ]);
    expect(store.getState().nodes[0]?.position).toStrictEqual({ x: -100, y: -50 });
  });

  it("lets a node's own extent take the place of it", () => {
    const own = sized("a", [0, 0], {
      extent: [
        [200, 100],
        [450, 250],
      ],
    });
    const store = createFlowStore({ defaultNodes: [own], nodeExtent: EXTENT });
    expect(placed(store, "a")).toStrictEqual([200, 100]);
  });

  it("applies when the extent changes afterwards, and when a node is measured", () => {
    const store = createFlowStore({ defaultNodes: [sized("a", [900, 900])] });
    expect(placed(store, "a")).toStrictEqual([900, 900]);
    store.getState().setConfig({ nodeExtent: EXTENT });
    expect(placed(store, "a")).toStrictEqual([350, 260]);
  });

  it("holds a child inside its parent when its extent says parent", () => {
    const parent = sized("p", [100, 100], { measured: { width: 200, height: 100 } });
    const child = sized("k", [500, 500], {
      parentId: "p",
      extent: "parent",
      measured: { width: 50, height: 20 },
    });
    const store = createFlowStore({ defaultNodes: [parent, child] });
    expect(placed(store, "k")).toStrictEqual([250, 180]);
  });
});

describe("translateExtent, applied to the viewport a flow starts with", () => {
  it("holds it inside the extent once the canvas has a size, as React Flow does", () => {
    const store = createFlowStore({
      viewport: { x: 500, y: 300, zoom: 1 },
      translateExtent: [
        [-200, -100],
        [900, 600],
      ],
    });
    expect(store.getState().viewport).toStrictEqual({ x: 500, y: 300, zoom: 1 });
    store.getState().setSize(1280, 800);
    // Measured against the real library on a 1280 by 800 canvas.
    expect(store.getState().viewport).toStrictEqual({ x: 290, y: 150, zoom: 1 });
  });

  it("leaves the viewport alone when the canvas changes size later", () => {
    const store = createFlowStore({
      viewport: { x: 0, y: 0, zoom: 1 },
      translateExtent: [
        [-200, -100],
        [900, 600],
      ],
      width: 800,
      height: 600,
    });
    store.getState().setSize(400, 300);
    expect(store.getState().viewport).toStrictEqual({ x: 0, y: 0, zoom: 1 });
  });
});
