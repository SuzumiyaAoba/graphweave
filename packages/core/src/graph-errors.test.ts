import { describe, expect, it, vi } from "vite-plus/test";

import type { OnError } from "./error-messages.ts";
import { addEdge, reconnectEdge } from "./graph.ts";
import { buildNodeLookups } from "./node-internals.ts";
import { calculateNodePosition } from "./node-position.ts";
import { makeEdge, makeNode } from "./test-fixtures.ts";
import type { Connection, EdgeBase } from "./types.ts";

const CONNECTION: Connection = { source: "a", target: "b", sourceHandle: null, targetHandle: null };

describe("addEdge, which gives back what it was given when there is nothing to add", () => {
  it("returns the same array and tells (006) when the connection has no end", () => {
    const edges: EdgeBase[] = [makeEdge("e", ["a", "b"])];
    const onError = vi.fn<OnError>();
    const result = addEdge({ ...CONNECTION, target: "" }, edges, { onError });
    expect(result).toBe(edges);
    expect(onError).toHaveBeenCalledExactlyOnceWith(
      "006",
      "Can't create edge. An edge needs a source and a target.",
    );
  });

  it("returns the same array for a connection that is already there, empty handles being the same", () => {
    const edges: EdgeBase[] = [makeEdge("e", ["a", "b"], { sourceHandle: "" })];
    expect(addEdge(CONNECTION, edges)).toBe(edges);
  });

  it("makes the id of the new edge with the function it is given", () => {
    const result = addEdge<EdgeBase>(CONNECTION, [], { getEdgeId: () => "mine" });
    expect(result.map(({ id }) => id)).toStrictEqual(["mine"]);
  });
});

describe("reconnectEdge, which gives back what it was given when it cannot go ahead", () => {
  it("returns the same array and tells (006) when the new connection has no end", () => {
    const old = makeEdge("e", ["a", "b"]);
    const edges = [old];
    const onError = vi.fn<OnError>();
    expect(reconnectEdge(old, { ...CONNECTION, source: "" }, edges, { onError })).toBe(edges);
    expect(onError).toHaveBeenCalledExactlyOnceWith(
      "006",
      "Can't create edge. An edge needs a source and a target.",
    );
  });

  it("returns the same array and tells (007) when the old edge is not there", () => {
    const edges: EdgeBase[] = [makeEdge("x", ["a", "b"])];
    const onError = vi.fn<OnError>();
    const result = reconnectEdge(makeEdge("gone", ["a", "c"]), CONNECTION, edges, { onError });
    expect(result).toBe(edges);
    expect(onError).toHaveBeenCalledExactlyOnceWith(
      "007",
      "The old edge with id=gone does not exist.",
    );
  });

  it("makes the new id with the function it is given", () => {
    const old = makeEdge("e", ["a", "c"]);
    const result = reconnectEdge(old, CONNECTION, [old], { getEdgeId: () => "mine" });
    expect(result.map(({ id }) => id)).toStrictEqual(["mine"]);
  });
});

function placeWith(extra: Parameters<typeof makeNode>[1]): string[] {
  const { nodeLookup } = buildNodeLookups([makeNode("n", extra)], new Map(), {
    nodeOrigin: [0, 0],
    elevateNodesOnSelect: false,
    selectedNodeZ: 0,
  });
  const node = nodeLookup.get("n");
  const told: string[] = [];
  if (node !== undefined) {
    calculateNodePosition({
      node,
      nodeLookup,
      nextPosition: { x: 5, y: 5 },
      nodeOrigin: [0, 0],
      onError: (code) => {
        told.push(code);
      },
    });
  }
  return told;
}

describe("placing a node, which tells of two mistakes", () => {
  it("tells (005) of a parent extent without a parent, and (015) of a node never measured", () => {
    expect(placeWith({ extent: "parent", measured: { width: 10, height: 10 } })).toStrictEqual([
      "005",
    ]);
    expect(placeWith({})).toStrictEqual(["015"]);
  });

  it("tells nothing of a measured node with no parent extent", () => {
    expect(placeWith({ measured: { width: 10, height: 10 } })).toStrictEqual([]);
  });
});
