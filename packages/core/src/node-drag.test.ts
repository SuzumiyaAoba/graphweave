import { describe, expect, it } from "vite-plus/test";

import type { InternalNode } from "./flow-state.ts";
import { calcAutoPan, getDragItems, startNodeDrag } from "./node-drag.ts";
import type { DragConfig } from "./node-drag.ts";
import { buildNodeLookups } from "./node-internals.ts";
import { idsOf, makeNode } from "./test-fixtures.ts";
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

// A function that drags the named nodes from the origin to a point and returns the positions the
// changes report, under the given config.
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

// Whether a drag of one node has begun at the press, under a threshold.
function beginsWith(threshold: number): boolean {
  const lookup = lookupOf([sized("a", [0, 0])]);
  const items = getDragItems(lookup, ["a"], true);
  const config = { ...CONFIG, threshold };
  return startNodeDrag(items, { x: 0, y: 0 }, { lookup, config }).started();
}

describe("getDragItems", () => {
  it("returns the requested nodes that exist", () => {
    const lookup = lookupOf([sized("a", [0, 0]), sized("b", [0, 0])]);
    // In the order of the flow, whatever the order asked for.
    expect(idsOf(getDragItems(lookup, ["b", "a", "missing"], true))).toStrictEqual(["a", "b"]);
  });

  it("honours nodesDraggable and the node's own draggable flag", () => {
    const lookup = lookupOf([
      sized("a", [0, 0]),
      sized("b", [0, 0], { draggable: true }),
      sized("c", [0, 0], { draggable: false }),
    ]);
    expect(idsOf(getDragItems(lookup, ["a", "b", "c"], false))).toStrictEqual(["b"]);
    expect(idsOf(getDragItems(lookup, ["a", "b", "c"], true))).toStrictEqual(["a", "b"]);
  });

  it("leaves out a child whose ancestor is dragged too", () => {
    const lookup = lookupOf([
      sized("root", [0, 0]),
      sized("mid", [0, 0], { parentId: "root" }),
      sized("leaf", [0, 0], { parentId: "mid" }),
      sized("other", [0, 0]),
    ]);
    expect(idsOf(getDragItems(lookup, ["leaf", "root", "other"], true))).toStrictEqual([
      "root",
      "other",
    ]);
    expect(idsOf(getDragItems(lookup, ["leaf", "mid"], true))).toStrictEqual(["mid"]);
  });
});

describe("startNodeDrag", () => {
  it("moves a node by how far the pointer travelled", () => {
    const lookup = lookupOf([sized("a", [10, 20])]);
    const session = startNodeDrag(
      getDragItems(lookup, ["a"], true),
      { x: 0, y: 0 },
      { lookup, config: CONFIG },
    );
    expect(session.move({ x: 5, y: 7 })).toStrictEqual([
      {
        id: "a",
        type: "position",
        position: { x: 15, y: 27 },
        positionAbsolute: { x: 15, y: 27 },
        dragging: true,
      },
    ]);
  });

  it("moves a whole selection by the same delta", () => {
    const positions = dragTo([sized("a", [0, 0]), sized("b", [100, 50])], ["a", "b"], {
      x: 10,
      y: -5,
    });
    expect(positions).toStrictEqual({ a: { x: 10, y: -5 }, b: { x: 110, y: 45 } });
  });

  it("reports a child's position relative to its parent", () => {
    const lookup = lookupOf([
      sized("parent", [100, 100]),
      sized("child", [5, 5], { parentId: "parent" }),
    ]);
    const session = startNodeDrag(
      getDragItems(lookup, ["child"], true),
      { x: 0, y: 0 },
      { lookup, config: CONFIG },
    );
    const [change] = session.move({ x: 10, y: 0 });
    expect(change?.position).toStrictEqual({ x: 15, y: 5 });
    expect(change?.positionAbsolute).toStrictEqual({ x: 115, y: 105 });
  });

  it("has begun at the press when there is no threshold, and only after it otherwise", () => {
    expect([beginsWith(0), beginsWith(4)]).toStrictEqual([true, false]);
  });

  it("waits for the threshold, measured in screen pixels, and then keeps dragging", () => {
    const lookup = lookupOf([sized("a", [0, 0])]);
    const config = { ...CONFIG, threshold: 4, zoom: 2 };
    const session = startNodeDrag(
      getDragItems(lookup, ["a"], true),
      { x: 0, y: 0 },
      { lookup, config },
    );
    expect(session.move({ x: 1, y: 0 })).toStrictEqual([]);
    expect(session.started()).toBe(false);
    // 4 screen pixels is not more than the threshold; 3 flow units at zoom 2 are 6.
    expect(session.move({ x: 2, y: 0 })).toStrictEqual([]);
    // The drag begins here, and holds the node where it is: nothing has moved yet.
    expect(session.move({ x: 3, y: 0 })).toStrictEqual([]);
    expect(session.started()).toBe(true);
    expect(session.move({ x: 0.5, y: 0 })).toHaveLength(1);
  });

  it("holds the nodes from where the pointer is when the drag begins, so they do not jump", () => {
    const lookup = lookupOf([sized("a", [10, 10])]);
    const config = { ...CONFIG, threshold: 4, zoom: 1 };
    const session = startNodeDrag(
      getDragItems(lookup, ["a"], true),
      { x: 0, y: 0 },
      { lookup, config },
    );
    // The pointer crosses the threshold at x = 5: the node has not moved yet.
    expect(session.move({ x: 5, y: 0 })).toStrictEqual([]);
    expect(session.started()).toBe(true);
    // From there it follows the pointer's further travel.
    expect(session.move({ x: 20, y: 7 })[0]?.positionAbsolute).toStrictEqual({ x: 25, y: 17 });
  });

  it("ends with dragging off at the last position, or with nothing if it never started", () => {
    const lookup = lookupOf([sized("a", [0, 0])]);
    const session = startNodeDrag(
      getDragItems(lookup, ["a"], true),
      { x: 0, y: 0 },
      { lookup, config: CONFIG },
    );
    session.move({ x: 8, y: 9 });
    expect(session.end()).toStrictEqual([
      {
        id: "a",
        type: "position",
        position: { x: 8, y: 9 },
        positionAbsolute: { x: 8, y: 9 },
        dragging: false,
      },
    ]);
    const idle = startNodeDrag(
      getDragItems(lookup, ["a"], true),
      { x: 0, y: 0 },
      { lookup, config: { ...CONFIG, threshold: 10 } },
    );
    idle.move({ x: 1, y: 1 });
    expect(idle.end()).toStrictEqual([]);
  });
});

describe("startNodeDrag: snapping", () => {
  it("lands the grabbed node on the grid and keeps the others' offset", () => {
    const positions = draggerFor({ ...CONFIG, snapToGrid: true })(
      [sized("a", [3, 3]), sized("b", [50, 50])],
      ["a", "b"],
      { x: 4, y: 4 },
    );
    expect(positions).toStrictEqual({ a: { x: 10, y: 10 }, b: { x: 57, y: 57 } });
  });

  it("snaps to the first of the nodes in the order of the flow, not to the one that was grabbed", () => {
    const lookup = lookupOf([sized("a", [3, 3]), sized("b", [50, 50])]);
    const session = startNodeDrag(
      getDragItems(lookup, ["b", "a"], true),
      { x: 0, y: 0 },
      { lookup, config: { ...CONFIG, snapToGrid: true } },
    );
    const moved = Object.fromEntries(
      session.move({ x: 7, y: 7 }).map((change) => [change.id, change.position]),
    );
    expect(moved).toStrictEqual({ a: { x: 10, y: 10 }, b: { x: 57, y: 57 } });
  });
});

describe("calcAutoPan", () => {
  const size = { width: 400, height: 300 };

  it("does not pan while the pointer is away from the edges", () => {
    expect(calcAutoPan({ x: 200, y: 150 }, size)).toStrictEqual({ x: 0, y: 0 });
  });

  it("moves the viewport to reveal what lies past the nearest edge, faster the closer the pointer is", () => {
    expect(calcAutoPan({ x: 0, y: 150 }, size, 10)).toStrictEqual({ x: 10, y: 0 });
    expect(calcAutoPan({ x: 20, y: 150 }, size, 10)).toStrictEqual({ x: 5, y: 0 });
    expect(calcAutoPan({ x: 400, y: 150 }, size, 10)).toStrictEqual({ x: -10, y: 0 });
    expect(calcAutoPan({ x: 200, y: 300 }, size, 10)).toStrictEqual({ x: 0, y: -10 });
  });

  it("does not pan a canvas that has no size", () => {
    expect(calcAutoPan({ x: 0, y: 0 }, { width: 0, height: 0 }, 10)).toStrictEqual({ x: 0, y: 0 });
    expect(calcAutoPan({ x: 5, y: 5 }, { width: 400, height: 0 }, 10)).toStrictEqual({
      x: 0,
      y: 0,
    });
  });

  it("combines both axes in a corner and caps at full speed outside the canvas", () => {
    expect(calcAutoPan({ x: -50, y: -50 }, size, 10)).toStrictEqual({ x: 10, y: 10 });
    expect(calcAutoPan({ x: 999, y: 999 }, size, 10)).toStrictEqual({ x: -10, y: -10 });
  });
});
