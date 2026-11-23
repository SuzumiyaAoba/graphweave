import { describe, expect, it } from "vite-plus/test";

import type { HandleBounds, InternalNode } from "./flow-state.ts";
import { buildEdgeLookups, buildNodeLookups, connectionKey } from "./node-internals.ts";
import type { InternalsOptions } from "./node-internals.ts";
import type { EdgeBase, NodeBase } from "./types.ts";

const OPTIONS: InternalsOptions = {
  nodeOrigin: [0, 0],
  elevateNodesOnSelect: true,
  selectedNodeZ: 1000,
};

function node(id: string, extra: Partial<NodeBase> = {}): NodeBase {
  return { id, position: { x: 0, y: 0 }, data: {}, ...extra };
}

function keysOf(map: ReadonlyMap<string, unknown> | undefined): string[] {
  return [...(map?.keys() ?? [])];
}

// The edge ids registered under a connection key.
function edgesAt(
  lookup: ReadonlyMap<string, ReadonlyMap<string, unknown>>,
  ...key: Parameters<typeof connectionKey>
): string[] {
  return keysOf(lookup.get(connectionKey(...key)));
}

// Gives the internal node `id` handle bounds, the way a measurement would.
function measureHandles(lookup: ReadonlyMap<string, InternalNode>, id: string): HandleBounds {
  const bounds: HandleBounds = { source: [], target: [] };
  const internal = lookup.get(id);
  Object.assign(internal?.internals ?? {}, { handleBounds: bounds });
  return bounds;
}

describe("buildNodeLookups", () => {
  it("keeps the nodes in order and exposes the user node", () => {
    const a = node("a");
    const b = node("b");
    const { nodeLookup } = buildNodeLookups([a, b], new Map(), OPTIONS);
    expect([...nodeLookup.keys()]).toStrictEqual(["a", "b"]);
    expect(nodeLookup.get("a")?.internals.userNode).toBe(a);
  });

  it("places a node by its position and shifts it by the node origin", () => {
    const sized = node("a", { position: { x: 100, y: 50 }, measured: { width: 40, height: 20 } });
    const { nodeLookup } = buildNodeLookups([sized], new Map(), {
      ...OPTIONS,
      nodeOrigin: [0.5, 0.5],
    });
    expect(nodeLookup.get("a")?.internals.positionAbsolute).toStrictEqual({ x: 80, y: 40 });
  });

  it("lets a node override the origin for itself", () => {
    const sized = node("a", { position: { x: 100, y: 50 }, width: 40, height: 20, origin: [1, 1] });
    const { nodeLookup } = buildNodeLookups([sized], new Map(), OPTIONS);
    expect(nodeLookup.get("a")?.internals.positionAbsolute).toStrictEqual({ x: 60, y: 30 });
  });

  it("adds the parent's position to a child, whatever their order in the array", () => {
    const child = node("child", { position: { x: 5, y: 6 }, parentId: "parent" });
    const parent = node("parent", { position: { x: 100, y: 200 } });
    const { nodeLookup, parentLookup } = buildNodeLookups([child, parent], new Map(), OPTIONS);
    expect(nodeLookup.get("child")?.internals.positionAbsolute).toStrictEqual({ x: 105, y: 206 });
    expect(keysOf(parentLookup.get("parent"))).toStrictEqual(["child"]);
  });

  it("follows chains of parents", () => {
    const nodes = [
      node("c", { position: { x: 1, y: 1 }, parentId: "b" }),
      node("b", { position: { x: 10, y: 10 }, parentId: "a" }),
      node("a", { position: { x: 100, y: 100 } }),
    ];
    const { nodeLookup } = buildNodeLookups(nodes, new Map(), OPTIONS);
    expect(nodeLookup.get("c")?.internals.positionAbsolute).toStrictEqual({ x: 111, y: 111 });
  });

  it("treats an unknown parent and a parent cycle as no parent instead of failing", () => {
    const orphan = node("orphan", { position: { x: 3, y: 4 }, parentId: "missing" });
    const first = node("first", { position: { x: 1, y: 1 }, parentId: "second" });
    const second = node("second", { position: { x: 2, y: 2 }, parentId: "first" });
    const { nodeLookup } = buildNodeLookups([orphan, first, second], new Map(), OPTIONS);
    expect(nodeLookup.get("orphan")?.internals.positionAbsolute).toStrictEqual({ x: 3, y: 4 });
    expect(nodeLookup.size).toBe(3);
  });

  it("raises a selected node and keeps children above their parent", () => {
    const nodes = [
      node("plain"),
      node("picked", { selected: true }),
      node("layered", { zIndex: 5 }),
      node("kid", { parentId: "picked" }),
    ];
    const { nodeLookup } = buildNodeLookups(nodes, new Map(), OPTIONS);
    expect(nodeLookup.get("plain")?.internals.z).toBe(0);
    expect(nodeLookup.get("picked")?.internals.z).toBe(1000);
    expect(nodeLookup.get("layered")?.internals.z).toBe(5);
    expect(nodeLookup.get("kid")?.internals.z).toBe(1001);
    const flat = buildNodeLookups(nodes, new Map(), { ...OPTIONS, elevateNodesOnSelect: false });
    expect(flat.nodeLookup.get("picked")?.internals.z).toBe(0);
  });

  it("reuses internal nodes that did not change and replaces those that did", () => {
    const a = node("a");
    const b = node("b");
    const first = buildNodeLookups([a, b], new Map(), OPTIONS).nodeLookup;
    const moved = { ...b, position: { x: 9, y: 9 } };
    const second = buildNodeLookups([a, moved], first, OPTIONS).nodeLookup;
    expect(second.get("a")).toBe(first.get("a"));
    expect(second.get("b")).not.toBe(first.get("b"));
    expect(second.get("b")?.internals.positionAbsolute).toStrictEqual({ x: 9, y: 9 });
  });

  it("rebuilds a child when its parent moved, even if the child object is the same", () => {
    const child = node("child", { position: { x: 1, y: 1 }, parentId: "parent" });
    const first = buildNodeLookups([node("parent"), child], new Map(), OPTIONS).nodeLookup;
    const movedParent = node("parent", { position: { x: 50, y: 0 } });
    const second = buildNodeLookups([movedParent, child], first, OPTIONS).nodeLookup;
    expect(second.get("child")).not.toBe(first.get("child"));
    expect(second.get("child")?.internals.positionAbsolute).toStrictEqual({ x: 51, y: 1 });
  });

  it("carries handle bounds over to the rebuilt node", () => {
    const a = node("a");
    const first = buildNodeLookups([a], new Map(), OPTIONS).nodeLookup;
    const bounds = measureHandles(first, "a");
    const second = buildNodeLookups(
      [{ ...a, position: { x: 1, y: 1 } }],
      first,
      OPTIONS,
    ).nodeLookup;
    expect(second.get("a")?.internals.handleBounds).toBe(bounds);
  });
});

describe("buildEdgeLookups", () => {
  const edges: EdgeBase[] = [
    { id: "e1", source: "a", target: "b", sourceHandle: "out" },
    { id: "e2", source: "a", target: "c" },
  ];

  it("indexes edges by id", () => {
    expect(buildEdgeLookups(edges).edgeLookup.get("e2")).toBe(edges[1]);
  });

  it("indexes connections by node, side and handle", () => {
    const { connectionLookup } = buildEdgeLookups(edges);
    expect(edgesAt(connectionLookup, "a")).toStrictEqual(["e1", "e2"]);
    expect(edgesAt(connectionLookup, "a", "source")).toStrictEqual(["e1", "e2"]);
    expect(edgesAt(connectionLookup, "a", "source", "out")).toStrictEqual(["e1"]);
    expect(edgesAt(connectionLookup, "a", "source", null)).toStrictEqual(["e2"]);
    expect(edgesAt(connectionLookup, "b", "target")).toStrictEqual(["e1"]);
    expect(connectionLookup.get(connectionKey("c", "source"))).toBeUndefined();
  });

  it("stores the connection with null handles filled in", () => {
    const { connectionLookup } = buildEdgeLookups(edges);
    expect(connectionLookup.get(connectionKey("a"))?.get("e2")).toStrictEqual({
      edgeId: "e2",
      source: "a",
      target: "c",
      sourceHandle: null,
      targetHandle: null,
    });
  });
});
