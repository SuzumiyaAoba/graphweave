import { describe, expect, it } from "vite-plus/test";

import type { InternalNode } from "./flow-state.ts";
import { buildNodeLookups } from "./node-internals.ts";
import { getEdgesOfNodes, getNodesInRect, selectionRectOf } from "./selection-box.ts";
import { idsOf, makeEdge, makeNode } from "./test-fixtures.ts";
import type { NodeBase } from "./types.ts";
import { SelectionMode } from "./types.ts";

function box(id: string, at: [x: number, y: number], extra: Partial<NodeBase> = {}): NodeBase {
  return makeNode(id, { position: { x: at[0], y: at[1] }, width: 100, height: 100, ...extra });
}

function internals(nodes: NodeBase[]): InternalNode[] {
  return [
    ...buildNodeLookups(nodes, new Map(), {
      nodeOrigin: [0, 0],
      elevateNodesOnSelect: false,
      selectedNodeZ: 0,
    }).nodeLookup.values(),
  ];
}

const PARTIAL = { mode: SelectionMode.Partial, elementsSelectable: true };
const FULL = { mode: SelectionMode.Full, elementsSelectable: true };

describe("selectionRectOf", () => {
  it("spans the drag in any direction and remembers where it started", () => {
    expect(selectionRectOf({ x: 50, y: 60 }, { x: 10, y: 100 })).toStrictEqual({
      x: 10,
      y: 60,
      width: 40,
      height: 40,
      startX: 50,
      startY: 60,
    });
    expect(selectionRectOf({ x: 0, y: 0 }, { x: 5, y: 7 })).toMatchObject({ width: 5, height: 7 });
  });
});

describe("getNodesInRect", () => {
  const nodes = internals([box("a", [0, 0]), box("b", [150, 0]), box("c", [0, 300])]);
  const area = { x: 50, y: 50, width: 150, height: 40 };

  it("picks up every node the box touches in partial mode", () => {
    expect(getNodesInRect(nodes, area, PARTIAL)).toStrictEqual(["a", "b"]);
  });

  it("picks up only the nodes the box encloses in full mode", () => {
    expect(getNodesInRect(nodes, area, FULL)).toStrictEqual([]);
    expect(getNodesInRect(nodes, { x: -10, y: -10, width: 130, height: 130 }, FULL)).toStrictEqual([
      "a",
    ]);
  });

  it("does not count nodes that only touch the edge of the box", () => {
    expect(getNodesInRect(nodes, { x: 100, y: 0, width: 50, height: 50 }, PARTIAL)).toStrictEqual(
      [],
    );
  });

  it("skips hidden and unselectable nodes, and obeys elementsSelectable", () => {
    const mixed = internals([
      box("hidden", [0, 0], { hidden: true }),
      box("locked", [0, 0], { selectable: false }),
      box("open", [0, 0], { selectable: true }),
      box("plain", [0, 0]),
    ]);
    const everything = { x: -10, y: -10, width: 500, height: 500 };
    expect(getNodesInRect(mixed, everything, PARTIAL)).toStrictEqual(["open", "plain"]);
    expect(
      getNodesInRect(mixed, everything, { ...PARTIAL, elementsSelectable: false }),
    ).toStrictEqual(["open"]);
  });

  it("measures nodes by their measured size", () => {
    const measured = internals([makeNode("m", { measured: { width: 300, height: 300 } })]);
    expect(
      getNodesInRect(measured, { x: 250, y: 250, width: 10, height: 10 }, PARTIAL),
    ).toStrictEqual(["m"]);
  });
});

describe("getEdgesOfNodes", () => {
  const edges = [
    makeEdge("ab", ["a", "b"]),
    makeEdge("bc", ["b", "c"]),
    makeEdge("ac", ["a", "c"], { selectable: false }),
    makeEdge("hidden", ["a", "b"], { hidden: true }),
  ];

  it("takes every selectable edge that touches one of the nodes, as React Flow's box does", () => {
    // `bc` is taken although `c` is not in the box; so is the hidden edge, which React Flow does not skip.
    expect(idsOf(getEdgesOfNodes(["a", "b"], edges, true))).toStrictEqual(["ab", "bc", "hidden"]);
    expect(idsOf(getEdgesOfNodes(["c"], edges, true))).toStrictEqual(["bc"]);
  });

  it("falls back to the default for edges without their own flag", () => {
    expect(idsOf(getEdgesOfNodes(["a", "b", "c"], edges, false))).toStrictEqual([]);
  });
});

// As React Flow's getNodesInside, which rounds the overlap up before comparing it with the area.
describe("getNodesInRect in full mode, at the edge of the box", () => {
  it("takes a node that the box misses by less than a pixel of its area", () => {
    const nodes = internals([box("a", [0, 0])]);
    const area = { x: 0.005, y: 0, width: 300, height: 300 };
    expect(getNodesInRect(nodes, area, FULL)).toStrictEqual(["a"]);
  });

  it("leaves out a node that the box misses by a pixel of its area or more", () => {
    const nodes = internals([box("a", [0, 0])]);
    const area = { x: 0.02, y: 0, width: 300, height: 300 };
    expect(getNodesInRect(nodes, area, FULL)).toStrictEqual([]);
  });
});

describe("getNodesInRect in partial mode, for a box of no width", () => {
  // As React Flow's getNodesInside: the overlap with a drag straight down is nothing.
  it("picks up nothing", () => {
    const nodes = internals([box("a", [0, 0])]);
    expect(getNodesInRect(nodes, { x: 50, y: -10, width: 0, height: 300 }, PARTIAL)).toStrictEqual(
      [],
    );
  });
});
