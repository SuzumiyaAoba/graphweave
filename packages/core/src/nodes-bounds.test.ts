import { describe, expect, it } from "vite-plus/test";

import { createFlowStore } from "./flow-store.ts";
import { getNodesBounds } from "./nodes-bounds.ts";
import type { NodeBase } from "./types.ts";

const a: NodeBase = { id: "a", position: { x: 10, y: 20 }, data: {}, width: 30, height: 40 };
const box = { x: 10, y: 20, width: 30, height: 40 };

describe("getNodesBounds", () => {
  it("leaves out ids when there is no lookup, as React Flow does", () => {
    expect(getNodesBounds(["a", "b"])).toStrictEqual({ x: 0, y: 0, width: 0, height: 0 });
    expect(getNodesBounds(["b", a])).toStrictEqual(box);
  });

  it("finds ids and nodes in the lookup and skips what it does not hold", () => {
    const parent: NodeBase = { id: "p", position: { x: 90, y: 180 }, data: {} };
    const child: NodeBase = { ...a, parentId: "p" };
    const { nodeLookup } = createFlowStore({ nodes: [parent, child] }).getState();
    const moved = { x: 100, y: 200, width: 30, height: 40 };
    expect(getNodesBounds(["a", "gone"], { nodeLookup })).toStrictEqual(moved);
    expect(getNodesBounds([child], { nodeLookup })).toStrictEqual(moved);
    const internal = [...nodeLookup.values()].filter((node) => node.id === "a");
    expect(getNodesBounds(internal)).toStrictEqual(moved);
  });
});
