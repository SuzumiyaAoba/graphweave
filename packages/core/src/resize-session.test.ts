import { describe, expect, it } from "vite-plus/test";

import { applyNodeChanges } from "./changes.ts";
import type { Point, Size } from "./geometry.ts";
import { buildNodeLookups } from "./node-internals.ts";
import type { ControlPosition } from "./node-resize.ts";
import { startResize } from "./resize-session.ts";
import type { ResizeSession, ResizeSetup, ResizeStep, ResizeWorld } from "./resize-session.ts";
import { makeNode } from "./test-fixtures.ts";
import type { NodeBase, NodeChange } from "./types.ts";

const BOUNDARIES = { minWidth: 10, minHeight: 10, maxWidth: 1e6, maxHeight: 1e6 };
const START: Point = { x: 500, y: 500 };

// A node of the given size that has been measured, so that it is as the browser leaves it.
function sized(id: string, size: Size, extra: Partial<NodeBase> = {}): NodeBase {
  const { width, height } = size;
  return makeNode(id, { width, height, measured: { width, height }, ...extra });
}

function resizing(
  nodes: NodeBase[],
  control: [id: string, position: ControlPosition],
  extra: Partial<ResizeSetup> = {},
): ResizeSession {
  const [id, position] = control;
  const lookups = buildNodeLookups(nodes, new Map(), {
    nodeOrigin: [0, 0],
    elevateNodesOnSelect: false,
    selectedNodeZ: 1000,
  });
  const node = lookups.nodeLookup.get(id);
  if (node === undefined) {
    throw new Error(`no node ${id}`);
  }
  const world: ResizeWorld = { node, ...lookups, nodeOrigin: [0, 0] };
  const setup = { controlPosition: position, boundaries: BOUNDARIES, keepAspectRatio: false };
  return startResize(world, { ...setup, ...extra }, START);
}

function by(delta: Point): Point {
  return { x: START.x + delta.x, y: START.y + delta.y };
}

function changesOf(step: ResizeStep | undefined): readonly NodeChange[] {
  return step?.changes ?? [];
}

// The nodes a change is about, in order.
function idsOf(step: ResizeStep | undefined): string[] {
  const changes: readonly NodeChange[] = step?.changes ?? [];
  return changes.flatMap((change) => ("id" in change ? [change.id] : []));
}

const ROOT: NodeBase[] = [
  sized("n", { width: 200, height: 100 }, { position: { x: 100, y: 100 } }),
];

describe("a resize", () => {
  it("only changes the size when the far side moves", () => {
    const step = resizing(ROOT, ["n", "bottom-right"]).move(by({ x: 40, y: 20 }));
    expect(step?.changes).toStrictEqual([
      {
        id: "n",
        type: "dimensions",
        resizing: true,
        setAttributes: true,
        dimensions: { width: 240, height: 120 },
      },
    ]);
  });

  it("moves the node as well when the near side moves, and says which way each side went", () => {
    const step = resizing(ROOT, ["n", "top-left"]).move(by({ x: 20, y: 10 }));
    expect(step?.changes).toStrictEqual([
      { id: "n", type: "position", position: { x: 120, y: 110 } },
      {
        id: "n",
        type: "dimensions",
        resizing: true,
        setAttributes: true,
        dimensions: { width: 180, height: 90 },
      },
    ]);
    expect(step?.values).toStrictEqual({
      x: 120,
      y: 110,
      width: 180,
      height: 90,
      direction: [1, 1],
    });
  });

  it("changes nothing when the pointer has not moved the size", () => {
    expect(resizing(ROOT, ["n", "right"]).move(START)).toBeUndefined();
  });

  it("writes only the width for a horizontal resize", () => {
    const step = resizing(ROOT, ["n", "bottom-right"], { resizeDirection: "horizontal" }).move(
      by({ x: 40, y: 20 }),
    );
    expect(step?.changes[0]).toMatchObject({
      setAttributes: "width",
      dimensions: { width: 240, height: 100 },
    });
  });

  it("stays where it was when the callback says no, and goes on from there", () => {
    const session = resizing(ROOT, ["n", "bottom-right"]);
    expect(session.move(by({ x: 40, y: 0 }), () => false)).toBeUndefined();
    const step = session.move(by({ x: 60, y: 0 }));
    expect(step?.values.width).toBe(260);
  });

  it("ends with the size it had, and says it is no longer resizing", () => {
    const session = resizing(ROOT, ["n", "bottom-right"]);
    session.move(by({ x: 40, y: 20 }));
    expect(session.end().change).toStrictEqual({
      id: "n",
      type: "dimensions",
      resizing: false,
      dimensions: { width: 240, height: 120 },
    });
  });
});

const PARENT_AND_CHILD: NodeBase[] = [
  sized("p", { width: 300, height: 200 }, { position: { x: 0, y: 0 } }),
  sized("c", { width: 100, height: 50 }, { position: { x: 50, y: 50 }, parentId: "p" }),
];

describe("a resize of a node with children", () => {
  it("moves the children the other way when its top left moves, so that they stay put", () => {
    const step = resizing(PARENT_AND_CHILD, ["p", "top-left"]).move(by({ x: 20, y: 10 }));
    expect(step?.changes).toContainEqual({
      id: "c",
      type: "position",
      position: { x: 30, y: 40 },
    });
  });

  it("does not let the node shrink away from a child that has to stay inside it", () => {
    const bound: NodeBase[] = [
      sized("p", { width: 300, height: 200 }, { position: { x: 0, y: 0 } }),
      sized(
        "c",
        { width: 100, height: 50 },
        { position: { x: 50, y: 50 }, parentId: "p", extent: "parent" },
      ),
    ];
    const step = resizing(bound, ["p", "bottom-right"]).move(by({ x: -500, y: -500 }));
    expect(step?.values).toMatchObject({ width: 150, height: 100 });
  });
});

describe("a resize of a node that stays in its parent", () => {
  it("cannot grow past the parent", () => {
    const nodes: NodeBase[] = [
      sized("p", { width: 300, height: 200 }, { position: { x: 0, y: 0 } }),
      sized(
        "c",
        { width: 100, height: 50 },
        { position: { x: 50, y: 50 }, parentId: "p", extent: "parent" },
      ),
    ];
    const step = resizing(nodes, ["c", "bottom-right"]).move(by({ x: 900, y: 900 }));
    expect(step?.values).toMatchObject({ width: 250, height: 150 });
  });
});

describe("a resize of a node that expands its parent", () => {
  const nodes: NodeBase[] = [
    sized("p", { width: 200, height: 100 }, { position: { x: 0, y: 0 } }),
    sized(
      "c",
      { width: 40, height: 20 },
      { position: { x: 10, y: 10 }, parentId: "p", expandParent: true },
    ),
  ];

  it("makes the parent grow first, then changes the node", () => {
    const step = resizing(nodes, ["c", "bottom-right"]).move(by({ x: 300, y: 0 }));
    expect(step?.changes).toStrictEqual([
      {
        id: "p",
        type: "dimensions",
        setAttributes: true,
        dimensions: { width: 350, height: 100 },
      },
      {
        id: "c",
        type: "dimensions",
        resizing: true,
        setAttributes: true,
        dimensions: { width: 340, height: 20 },
      },
    ]);
  });

  it("leaves the parent as it is while the node stays inside", () => {
    const step = resizing(nodes, ["c", "bottom-right"]).move(by({ x: 20, y: 10 }));
    expect(idsOf(step)).toStrictEqual(["c"]);
  });
});

function worldFor(list: NodeBase[], id: string): ResizeWorld {
  const lookups = buildNodeLookups(list, new Map(), {
    nodeOrigin: [0, 0],
    elevateNodesOnSelect: false,
    selectedNodeZ: 1000,
  });
  const node = lookups.nodeLookup.get(id);
  if (node === undefined) {
    throw new Error(`no node ${id}`);
  }
  return { node, ...lookups, nodeOrigin: [0, 0] };
}

describe("a resize that goes on after its parent has grown", () => {
  it("starts each step from the parent as the step before left it", () => {
    const start: NodeBase[] = [
      sized("p", { width: 100, height: 100 }, { position: { x: 0, y: 0 } }),
      sized(
        "c",
        { width: 40, height: 40 },
        { position: { x: 50, y: 50 }, parentId: "p", expandParent: true },
      ),
    ];
    let latest = start;
    const session = startResize(
      { ...worldFor(start, "c"), current: () => worldFor(latest, "c") },
      { controlPosition: "bottom-right", boundaries: BOUNDARIES, keepAspectRatio: false },
      START,
    );
    const first = session.move(by({ x: 100, y: 0 }));
    latest = applyNodeChanges(changesOf(first), latest);
    // Back to a box that fits in the parent as it now is: nothing more happens to the parent.
    const second = session.move(by({ x: 20, y: 0 }));
    expect(idsOf(second)).toStrictEqual(["c"]);
  });
});
