import { describe, expect, it, vi } from "vite-plus/test";

import { createFlowStore } from "./flow-store.ts";
import { makeEdge, makeNode } from "./test-fixtures.ts";
import type { EdgeBase, NodeBase } from "./types.ts";

function ids(items: readonly { id: string }[]): string[] {
  return items.map(({ id }) => id);
}

describe("what a deletion removes, as React Flow works it out", () => {
  it("leaves an edge that cannot be deleted, even when a node it touches goes", async () => {
    const seen: string[][] = [];
    const store = createFlowStore({
      defaultNodes: [makeNode("a"), makeNode("b")],
      defaultEdges: [
        makeEdge("ab", ["a", "b"]),
        makeEdge("keep", ["a", "b"], { deletable: false }),
      ],
      onBeforeDelete: ({ edges }) => {
        seen.push(ids(edges));
        return true;
      },
    });
    const result = await store.getState().deleteElements({ nodes: [{ id: "a" }] });
    expect(seen).toStrictEqual([["ab"]]);
    expect(ids(result.deletedEdges)).toStrictEqual(["ab"]);
    expect(ids(store.getState().edges)).toStrictEqual(["keep"]);
  });

  it("does not take the children of a parent that cannot be deleted", async () => {
    const store = createFlowStore({
      defaultNodes: [makeNode("p", { deletable: false }), makeNode("k", { parentId: "p" })],
    });
    const result = await store.getState().deleteElements({ nodes: [{ id: "p" }] });
    expect(result.deletedNodes).toStrictEqual([]);
    expect(ids(store.getState().nodes)).toStrictEqual(["p", "k"]);
  });

  it("takes a child with its parent whichever of them comes first in the list", async () => {
    const parentFirst = createFlowStore({
      defaultNodes: [makeNode("p"), makeNode("k", { parentId: "p" })],
    });
    const childFirst = createFlowStore({
      defaultNodes: [makeNode("k", { parentId: "p" }), makeNode("p")],
    });
    const first = await parentFirst.getState().deleteElements({ nodes: [{ id: "p" }] });
    const second = await childFirst.getState().deleteElements({ nodes: [{ id: "p" }] });
    // The nodes come back in the order of the list, as React Flow gives them.
    expect([ids(first.deletedNodes), ids(second.deletedNodes)]).toStrictEqual([
      ["p", "k"],
      ["k", "p"],
    ]);
  });

  it("takes the whole depth of a family, but never below a parent that stays", async () => {
    const store = createFlowStore({
      defaultNodes: [
        makeNode("c", { parentId: "b" }),
        makeNode("b", { parentId: "a" }),
        makeNode("a"),
        makeNode("x", { deletable: false }),
        makeNode("y", { parentId: "x" }),
      ],
    });
    const result = await store.getState().deleteElements({ nodes: [{ id: "a" }, { id: "x" }] });
    expect(ids(result.deletedNodes)).toStrictEqual(["c", "b", "a"]);
  });

  it("lists the edges of the removed nodes first, then the edges that were asked for", async () => {
    const store = createFlowStore({
      defaultNodes: [makeNode("a"), makeNode("b"), makeNode("c")],
      defaultEdges: [makeEdge("bc", ["b", "c"]), makeEdge("ab", ["a", "b"])],
    });
    const result = await store
      .getState()
      .deleteElements({ nodes: [{ id: "a" }], edges: [{ id: "bc" }] });
    expect(ids(result.deletedEdges)).toStrictEqual(["ab", "bc"]);
  });
});

describe("what a deletion reports, and in which order", () => {
  it("tells the edges, then the nodes, then both, each before it is applied", async () => {
    const order: string[] = [];
    const store = createFlowStore({
      defaultNodes: [makeNode("a"), makeNode("b")],
      defaultEdges: [makeEdge("ab", ["a", "b"])],
      onEdgesDelete: () => {
        order.push("edgesDelete");
      },
      onEdgesChange: () => {
        order.push("edgesChange");
      },
      onNodesDelete: () => {
        order.push("nodesDelete");
      },
      onNodesChange: () => {
        order.push("nodesChange");
      },
      onDelete: () => {
        order.push("delete");
      },
    });
    await store.getState().deleteElements({ nodes: [{ id: "a" }] });
    expect(order).toStrictEqual([
      "edgesDelete",
      "edgesChange",
      "nodesDelete",
      "nodesChange",
      "delete",
    ]);
  });

  it("does not report a kind of element that was not deleted, nor a deletion of nothing", async () => {
    const onNodesDelete = vi.fn<(nodes: NodeBase[]) => void>();
    const onEdgesDelete = vi.fn<(edges: EdgeBase[]) => void>();
    const onDelete = vi.fn<(elements: { nodes: NodeBase[]; edges: EdgeBase[] }) => void>();
    const store = createFlowStore({
      defaultNodes: [makeNode("a"), makeNode("b")],
      defaultEdges: [makeEdge("ab", ["a", "b"])],
      onNodesDelete,
      onEdgesDelete,
      onDelete,
    });
    await store.getState().deleteElements({ edges: [{ id: "ab" }] });
    expect([onNodesDelete.mock.calls.length, onEdgesDelete.mock.calls.length]).toStrictEqual([
      0, 1,
    ]);
    await store.getState().deleteElements({});
    expect(onDelete).toHaveBeenCalledOnce();
  });
});
