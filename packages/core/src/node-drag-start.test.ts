import { describe, expect, it } from "vite-plus/test";

import { getDragItems, startNodeDrag } from "./node-drag.ts";
import type { DragConfig, DragSession } from "./node-drag.ts";
import { buildNodeLookups } from "./node-internals.ts";
import { makeNode } from "./test-fixtures.ts";

const CONFIG: DragConfig = {
  snapToGrid: false,
  snapGrid: [40, 40],
  nodeExtent: [
    [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY],
    [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY],
  ],
  threshold: 1,
  zoom: 1,
  nodeOrigin: [0, 0],
};

// A drag of one node at (100, 100), pressed at (110, 110).
function dragOne(config: DragConfig): DragSession {
  const nodes = [makeNode("a", { position: { x: 100, y: 100 }, width: 20, height: 20 })];
  const { nodeLookup: lookup } = buildNodeLookups(nodes, new Map(), {
    nodeOrigin: [0, 0],
    elevateNodesOnSelect: false,
    selectedNodeZ: 0,
  });
  return startNodeDrag(getDragItems(lookup, ["a"], true), { x: 110, y: 110 }, { lookup, config });
}

describe("the move that begins a drag, once the pointer has gone past the threshold", () => {
  it("places nothing, as in React Flow: the node is held from where the pointer is then", () => {
    const session = dragOne(CONFIG);
    expect(session.move({ x: 125, y: 118 })).toStrictEqual([]);
    expect(session.started()).toBe(true);
    expect(session.move({ x: 135, y: 118 }).map((change) => change.position)).toStrictEqual([
      { x: 110, y: 100 },
    ]);
  });

  it("places the node at once with a grid that the pointer is not on", () => {
    const session = dragOne({ ...CONFIG, snapToGrid: true });
    const [change] = session.move({ x: 125, y: 118 });
    expect(change?.position).toStrictEqual({ x: 120, y: 120 });
  });

  it("is not told as the end of a drag when nothing was placed after it", () => {
    const session = dragOne(CONFIG);
    session.move({ x: 125, y: 118 });
    expect(session.end()).toStrictEqual([]);
  });
});
