import { describe, expect, it } from "vite-plus/test";

import type { InternalNode } from "./flow-state.ts";
import { startNodeDrag } from "./node-drag.ts";
import type { DragConfig, DragSession } from "./node-drag.ts";
import { buildNodeLookups } from "./node-internals.ts";
import { makeNode } from "./test-fixtures.ts";
import type { NodeBase } from "./types.ts";

const CONFIG: DragConfig = {
  snapToGrid: false,
  snapGrid: [15, 15],
  nodeExtent: [
    [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY],
    [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY],
  ],
  threshold: 0,
  zoom: 1,
  nodeOrigin: [0, 0],
};

type Lookup = ReadonlyMap<string, InternalNode>;

function lookupOf(list: NodeBase[]): Lookup {
  return buildNodeLookups(list, new Map(), {
    nodeOrigin: [0, 0],
    elevateNodesOnSelect: false,
    selectedNodeZ: 1000,
  }).nodeLookup;
}

const SIZE = { width: 100, height: 50, measured: { width: 100, height: 50 } };

// A parent of 300 by 200 at `parentAt`, and a child of 100 by 50 at (50, 50) in it.
function family(parentAt: { x: number; y: number }, extra: Partial<NodeBase>): NodeBase[] {
  return [
    makeNode("p", {
      position: parentAt,
      width: 300,
      height: 200,
      measured: { width: 300, height: 200 },
    }),
    makeNode("c", { ...SIZE, position: { x: 50, y: 50 }, parentId: "p", ...extra }),
  ];
}

// The session that drags the child of `lookup`, with the nodes as they are now when they differ.
function dragging(lookup: Lookup, current?: Lookup): DragSession {
  const item = lookup.get("c");
  if (item === undefined) {
    throw new Error("no node c");
  }
  return startNodeDrag(
    [item],
    { x: 0, y: 0 },
    { lookup, current: () => current ?? lookup, config: CONFIG },
  );
}

describe("dragging a node that expands its parent", () => {
  it("follows the parent when that has moved meanwhile, and keeps the node where the pointer put it", () => {
    const before = lookupOf(family({ x: 0, y: 0 }, { expandParent: true }));
    const after = lookupOf(family({ x: -30, y: -20 }, { expandParent: true }));
    // The pointer takes the node by (-10, -10) while the parent has moved by (-30, -20): the node is
    // at (40, 40) on the page, which is (70, 60) from the parent as it is now.
    expect(dragging(before, after).move({ x: -10, y: -10 })[0]).toMatchObject({
      position: { x: 70, y: 60 },
      positionAbsolute: { x: 40, y: 40 },
    });
  });

  it("is not held inside its parent by `extent: parent`, as another node is", () => {
    const free = lookupOf(family({ x: 0, y: 0 }, { expandParent: true, extent: "parent" }));
    const held = lookupOf(family({ x: 0, y: 0 }, { extent: "parent" }));
    expect(dragging(free).move({ x: -500, y: 0 })[0]?.positionAbsolute).toStrictEqual({
      x: -450,
      y: 50,
    });
    expect(dragging(held).move({ x: -500, y: 0 })[0]?.positionAbsolute).toStrictEqual({
      x: 0,
      y: 50,
    });
  });
});
