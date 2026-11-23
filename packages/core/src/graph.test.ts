import { describe, expect, it } from "vite-plus/test";

import {
  addEdge,
  getConnectedEdges,
  getEdgeId,
  getIncomers,
  getNodeRect,
  getOutgoers,
  isEdge,
  isNode,
  reconnectEdge,
} from "./graph.ts";
import { getNodesBounds } from "./nodes-bounds.ts";
import type { Connection, EdgeBase, NodeBase } from "./types.ts";

function node(id: string, extra: Partial<NodeBase> = {}): NodeBase {
  return { id, position: { x: 0, y: 0 }, data: {}, ...extra };
}

function edge(id: string, source: string, target: string): EdgeBase {
  return { id, source, target };
}

describe("isNode / isEdge", () => {
  it("tells nodes and edges apart", () => {
    expect(isNode(node("a"))).toBe(true);
    expect(isNode(edge("e", "a", "b"))).toBe(false);
    expect(isEdge(edge("e", "a", "b"))).toBe(true);
    expect(isEdge(node("a"))).toBe(false);
    expect(isNode(null)).toBe(false);
    expect(isEdge("edge")).toBe(false);
  });
});

describe("incomers, outgoers and connected edges", () => {
  const nodes = [node("a"), node("b"), node("c"), node("d")];
  const edges = [edge("e1", "a", "b"), edge("e2", "c", "b"), edge("e3", "b", "d")];

  it("finds the nodes feeding into a node, in node order", () => {
    expect(getIncomers(node("b"), nodes, edges).map((item) => item.id)).toStrictEqual(["a", "c"]);
  });

  it("finds the nodes a node feeds into", () => {
    expect(getOutgoers(node("b"), nodes, edges).map((item) => item.id)).toStrictEqual(["d"]);
    expect(getOutgoers(node("d"), nodes, edges)).toStrictEqual([]);
  });

  it("finds edges touching any of the given nodes", () => {
    expect(getConnectedEdges([node("a")], edges).map((item) => item.id)).toStrictEqual(["e1"]);
    expect(getConnectedEdges([node("d"), node("c")], edges).map((item) => item.id)).toStrictEqual([
      "e2",
      "e3",
    ]);
    expect(getConnectedEdges([], edges)).toStrictEqual([]);
  });
});

describe("node bounds", () => {
  it("prefers the measured size and respects the node origin", () => {
    const measured = node("a", {
      position: { x: 100, y: 100 },
      width: 10,
      height: 10,
      measured: { width: 40, height: 20 },
    });
    expect(getNodeRect(measured)).toStrictEqual({ x: 100, y: 100, width: 40, height: 20 });
    expect(getNodeRect(measured, [0.5, 0.5])).toStrictEqual({
      x: 80,
      y: 90,
      width: 40,
      height: 20,
    });
    expect(getNodeRect({ ...measured, origin: [1, 1] }, [0.5, 0.5])).toStrictEqual({
      x: 60,
      y: 80,
      width: 40,
      height: 20,
    });
  });

  it("falls back to width/height, then initial size, then zero", () => {
    expect(getNodeRect(node("a", { position: { x: 0, y: 0 }, width: 5, height: 6 }))).toStrictEqual(
      {
        x: 0,
        y: 0,
        width: 5,
        height: 6,
      },
    );
    expect(
      getNodeRect(node("a", { position: { x: 0, y: 0 }, initialWidth: 7, initialHeight: 8 })),
    ).toStrictEqual({
      x: 0,
      y: 0,
      width: 7,
      height: 8,
    });
    expect(getNodeRect(node("a"))).toStrictEqual({ x: 0, y: 0, width: 0, height: 0 });
  });

  it("unions the rectangles, hidden nodes included as in React Flow", () => {
    const nodes = [
      node("a", { position: { x: 0, y: 0 }, width: 10, height: 10 }),
      node("b", { position: { x: 100, y: 50 }, width: 20, height: 20 }),
      node("c", { position: { x: 9999, y: 9999 }, width: 1, height: 1, hidden: true }),
    ];
    expect(getNodesBounds(nodes)).toStrictEqual({ x: 0, y: 0, width: 10_000, height: 10_000 });
  });

  it("returns an empty rectangle for no nodes", () => {
    expect(getNodesBounds([])).toStrictEqual({ x: 0, y: 0, width: 0, height: 0 });
  });
});

function connection(extra: Partial<Connection> = {}): Connection {
  return { source: "a", target: "b", sourceHandle: null, targetHandle: null, ...extra };
}

describe("addEdge", () => {
  it("builds an id from the connection and leaves null handles out", () => {
    const result = addEdge<EdgeBase>(connection({ sourceHandle: "s" }), []);
    expect(result).toStrictEqual([
      { id: "xy-edge__as-b", source: "a", target: "b", sourceHandle: "s" },
    ]);
    expect(result[0]?.id).toBe(getEdgeId(connection({ sourceHandle: "s" })));
  });

  it("keeps an explicit id and extra fields", () => {
    const result = addEdge({ id: "mine", source: "a", target: "b", animated: true }, []);
    expect(result).toStrictEqual([{ id: "mine", source: "a", target: "b", animated: true }]);
  });

  it("does not add the same connection twice, treating a missing handle as null", () => {
    const existing: EdgeBase[] = [edge("e1", "a", "b")];
    expect(addEdge<EdgeBase>(connection(), existing)).toHaveLength(1);
    expect(addEdge<EdgeBase>(connection({ sourceHandle: "x" }), existing)).toHaveLength(2);
  });

  it("does not mutate the input", () => {
    const edges: EdgeBase[] = [];
    addEdge<EdgeBase>(connection(), edges);
    expect(edges).toStrictEqual([]);
  });
});

describe("reconnectEdge", () => {
  it("moves the edge to the new endpoints and gives it a new id by default", () => {
    const old = edge("e1", "a", "b");
    const result = reconnectEdge(
      old,
      { source: "a", target: "c", sourceHandle: null, targetHandle: null },
      [old, edge("e2", "x", "y")],
    );
    expect(result.map((item) => item.id)).toStrictEqual(["e2", "xy-edge__a-c"]);
    expect(result[1]?.target).toBe("c");
  });

  it("can keep the old id", () => {
    const old = edge("e1", "a", "b");
    const result = reconnectEdge(
      old,
      { source: "a", target: "c", sourceHandle: null, targetHandle: null },
      [old],
      {
        shouldReplaceId: false,
      },
    );
    expect(result[0]?.id).toBe("e1");
    expect(result[0]?.target).toBe("c");
  });

  it("moves the edge also onto a connection that another edge makes, as React Flow does", () => {
    const old = edge("e1", "a", "c");
    const edges = [edge("e0", "a", "b"), old];
    const result = reconnectEdge(
      old,
      { source: "a", target: "b", sourceHandle: null, targetHandle: null },
      edges,
    );
    expect(result.map((item) => item.id)).toStrictEqual(["e0", "xy-edge__a-b"]);
  });

  it("gives the edge its new id also when it is dropped back where it was", () => {
    const old = edge("e1", "a", "b");
    const result = reconnectEdge(
      old,
      { source: "a", target: "b", sourceHandle: null, targetHandle: null },
      [old],
    );
    expect(result.map((item) => item.id)).toStrictEqual(["xy-edge__a-b"]);
  });

  it("leaves the edges alone when the edge would get the id of another edge", () => {
    const old = edge("e1", "a", "c");
    const edges = [edge("xy-edge__a-b", "a", "b"), old];
    const result = reconnectEdge(
      old,
      { source: "a", target: "b", sourceHandle: null, targetHandle: null },
      edges,
    );
    expect(result).toBe(edges);
  });

  it("returns the edges unchanged when the old edge is not there", () => {
    const edges = [edge("e2", "x", "y")];
    const result = reconnectEdge(
      edge("gone", "a", "b"),
      { source: "a", target: "c", sourceHandle: null, targetHandle: null },
      edges,
    );
    expect(result).toStrictEqual(edges);
  });
});
