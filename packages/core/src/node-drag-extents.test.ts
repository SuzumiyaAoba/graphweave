import { describe, expect, it } from "vite-plus/test";

import type { InternalNode } from "./flow-state.ts";
import { getDragItems, startNodeDrag } from "./node-drag.ts";
import type { DragConfig } from "./node-drag.ts";
import { buildNodeLookups } from "./node-internals.ts";
import { makeNode } from "./test-fixtures.ts";
import type { NodeBase } from "./types.ts";

const CONFIG: DragConfig = {
  snapToGrid: false,
  snapGrid: [10, 10],
  nodeExtent: [
    [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY],
    [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY],
  ],
  threshold: 0,
  zoom: 1,
  nodeOrigin: [0, 0],
};

function lookupOf(nodes: NodeBase[]): Map<string, InternalNode> {
  return buildNodeLookups(nodes, new Map(), {
    nodeOrigin: [0, 0],
    elevateNodesOnSelect: false,
    selectedNodeZ: 0,
  }).nodeLookup;
}

function sized(id: string, at: [x: number, y: number], extra: Partial<NodeBase> = {}): NodeBase {
  return makeNode(id, { position: { x: at[0], y: at[1] }, width: 20, height: 20, ...extra });
}

type Positions = Record<string, { x: number; y: number }>;

function draggerFor(
  config: DragConfig,
): (nodes: NodeBase[], ids: string[], to: { x: number; y: number }) => Positions {
  return (nodes, ids, to) => {
    const lookup = lookupOf(nodes);
    const session = startNodeDrag(
      getDragItems(lookup, ids, true),
      { x: 0, y: 0 },
      { lookup, config },
    );
    const positions: Positions = {};
    for (const change of session.move(to)) {
      if (change.position !== undefined) {
        positions[change.id] = change.position;
      }
    }
    return positions;
  };
}

const dragTo = draggerFor(CONFIG);

describe("startNodeDrag: extents", () => {
  it("keeps a child inside its parent when its extent is 'parent'", () => {
    const nodes = [
      sized("parent", [0, 0], { width: 100, height: 100 }),
      sized("child", [10, 10], { parentId: "parent", extent: "parent" }),
    ];
    expect(dragTo(nodes, ["child"], { x: 500, y: -500 })).toStrictEqual({ child: { x: 80, y: 0 } });
  });

  it("applies a coordinate extent relative to the parent", () => {
    const nodes = [
      sized("parent", [100, 100], { width: 200, height: 200 }),
      sized("child", [10, 10], {
        parentId: "parent",
        extent: [
          [0, 0],
          [50, 50],
        ],
      }),
    ];
    expect(dragTo(nodes, ["child"], { x: 100, y: 100 })).toStrictEqual({ child: { x: 30, y: 30 } });
  });

  it("applies the global node extent to nodes without their own", () => {
    const config = {
      ...CONFIG,
      nodeExtent: [
        [0, 0],
        [200, 200],
      ] as const,
    };
    const nodes = [sized("a", [0, 0], { width: 50, height: 50 })];
    expect(draggerFor(config)(nodes, ["a"], { x: -30, y: 500 })).toStrictEqual({
      a: { x: 0, y: 150 },
    });
  });

  it("puts a node that is bigger than its area at the far end of it, as React Flow clamps", () => {
    const nodes = [
      sized("parent", [0, 0], { width: 30, height: 30 }),
      sized("child", [0, 0], { parentId: "parent", extent: "parent", width: 50, height: 50 }),
    ];
    expect(dragTo(nodes, ["child"], { x: 20, y: 20 })).toStrictEqual({ child: { x: -20, y: -20 } });
  });

  it("does not hold a node in a parent that has no size, or that is not there", () => {
    const flat = [
      sized("parent", [0, 0], { width: 0, height: 0 }),
      sized("child", [10, 10], { parentId: "parent", extent: "parent" }),
    ];
    // The child starts at the far corner of the parent that has no size (-20 for a node of 20, as
    // React Flow places it when the nodes are adopted), and the drag then adds the whole distance.
    expect(dragTo(flat, ["child"], { x: 500, y: 500 })).toStrictEqual({
      child: { x: 480, y: 480 },
    });
    const orphan = [sized("child", [10, 10], { parentId: "gone", extent: "parent" })];
    expect(dragTo(orphan, ["child"], { x: 500, y: 500 })).toStrictEqual({
      child: { x: 510, y: 510 },
    });
  });

  it("keeps several nodes under the extent of the flow as a group", () => {
    const config = {
      ...CONFIG,
      nodeExtent: [
        [0, 0],
        [300, 300],
      ] as DragConfig["nodeExtent"],
    };
    const nodes = [sized("a", [0, 0], { width: 50 }), sized("b", [200, 0], { width: 50 })];
    expect(draggerFor(config)(nodes, ["a", "b"], { x: 200, y: 0 })).toStrictEqual({
      a: { x: 50, y: 0 },
      b: { x: 250, y: 0 },
    });
  });
});
