import { describe, expect, it, vi } from "vite-plus/test";

import type { FlowStore } from "./flow-store-types.ts";
import type { FlowStoreOptions } from "./flow-store.ts";
import { createFlowStore } from "./flow-store.ts";
import { idsOf, makeEdge, makeNode } from "./test-fixtures.ts";
import type { EdgeBase, NodeBase, NodeChange } from "./types.ts";

type Options = FlowStoreOptions<NodeBase, EdgeBase>;

function selectable(): FlowStore {
  return createFlowStore({
    defaultNodes: [makeNode("a", { selected: true }), makeNode("b"), makeNode("c")],
    defaultEdges: [makeEdge("e1", ["a", "b"], { selected: true })],
  });
}

function selectedNodeIds(store: FlowStore): string[] {
  return idsOf(store.getState().nodes.filter((item) => item.selected === true));
}

function graph(extra: Options = {}): FlowStore {
  return createFlowStore({
    defaultNodes: [makeNode("a"), makeNode("b"), makeNode("c", { parentId: "b" })],
    defaultEdges: [
      makeEdge("e1", ["a", "b"]),
      makeEdge("e2", ["b", "c"]),
      makeEdge("e3", ["a", "c"]),
    ],
    ...extra,
  });
}

describe("createFlowStore: selection", () => {
  it("selects only the given nodes and clears the edge selection", () => {
    const store = selectable();
    store.getState().addSelectedNodes(["b"]);
    expect(selectedNodeIds(store)).toStrictEqual(["b"]);
    expect(store.getState().edges[0]?.selected).toBe(false);
  });

  it("adds to the selection while multi-selection is active", () => {
    const store = selectable();
    store.setState({ multiSelectionActive: true });
    store.getState().addSelectedNodes(["c", "missing"]);
    expect(selectedNodeIds(store)).toStrictEqual(["a", "c"]);
    expect(store.getState().edges[0]?.selected).toBe(true);
  });

  it("selects edges and clears the node selection", () => {
    const store = selectable();
    store.getState().addSelectedEdges(["e1"]);
    expect(selectedNodeIds(store)).toStrictEqual([]);
    expect(store.getState().edges[0]?.selected).toBe(true);
  });

  it("clears everything on reset", () => {
    const store = selectable();
    store.setState({ nodesSelectionActive: true });
    store.getState().resetSelectedElements();
    expect(selectedNodeIds(store)).toStrictEqual([]);
    expect(store.getState().edges[0]?.selected).toBe(false);
    expect(store.getState().nodesSelectionActive).toBe(false);
  });

  it("unselects just the given elements", () => {
    const store = selectable();
    store.getState().unselectNodesAndEdges({ nodes: [{ id: "a" }], edges: [] });
    expect(selectedNodeIds(store)).toStrictEqual([]);
    expect(store.getState().edges[0]?.selected).toBe(true);
  });

  it("selects exactly the given nodes and edges", () => {
    const store = selectable();
    store.getState().setSelection({ nodes: ["b", "c"], edges: [] });
    expect(selectedNodeIds(store)).toStrictEqual(["b", "c"]);
    expect(store.getState().edges[0]?.selected).toBe(false);
    store.getState().setSelection({ nodes: [], edges: ["e1"] });
    expect(selectedNodeIds(store)).toStrictEqual([]);
    expect(store.getState().edges[0]?.selected).toBe(true);
  });

  it("closes the selection frame when a node is selected on its own", () => {
    const store = selectable();
    store.setState({ nodesSelectionActive: true });
    store.getState().addSelectedNodes(["b"]);
    expect(store.getState().nodesSelectionActive).toBe(false);
  });

  it("does not report a selection that is already in place", () => {
    const onNodesChange = vi.fn<(changes: NodeChange[]) => void>();
    const store = createFlowStore({ nodes: [makeNode("a", { selected: true })], onNodesChange });
    store.getState().addSelectedNodes(["a"]);
    expect(onNodesChange).not.toHaveBeenCalled();
  });
});

describe("createFlowStore: deleteElements", () => {
  it("removes a node with its children and every edge that touches them", async () => {
    const onDelete = vi.fn<(elements: { nodes: NodeBase[]; edges: EdgeBase[] }) => void>();
    const store = graph({ onDelete });
    const result = await store.getState().deleteElements({ nodes: [{ id: "b" }] });
    expect(idsOf(result.deletedNodes)).toStrictEqual(["b", "c"]);
    expect(idsOf(result.deletedEdges)).toStrictEqual(["e1", "e2", "e3"]);
    expect(idsOf(store.getState().nodes)).toStrictEqual(["a"]);
    expect(store.getState().edges).toStrictEqual([]);
    expect(onDelete).toHaveBeenCalledOnce();
  });

  it("removes a single edge and leaves the nodes", async () => {
    const store = graph();
    await store.getState().deleteElements({ edges: [{ id: "e1" }] });
    expect(idsOf(store.getState().edges)).toStrictEqual(["e2", "e3"]);
    expect(store.getState().nodes).toHaveLength(3);
  });

  it("keeps elements that are not deletable", async () => {
    const store = createFlowStore({
      defaultNodes: [makeNode("a", { deletable: false }), makeNode("b")],
      defaultEdges: [makeEdge("e1", ["a", "b"], { deletable: false })],
    });
    const result = await store
      .getState()
      .deleteElements({ nodes: [{ id: "a" }], edges: [{ id: "e1" }] });
    expect(result.deletedNodes).toStrictEqual([]);
    expect(result.deletedEdges).toStrictEqual([]);
    expect(store.getState().nodes).toHaveLength(2);
  });

  it("does nothing when onBeforeDelete says no", async () => {
    const onDelete = vi.fn<(elements: { nodes: NodeBase[]; edges: EdgeBase[] }) => void>();
    const store = graph({ onBeforeDelete: () => false, onDelete });
    const result = await store.getState().deleteElements({ nodes: [{ id: "a" }] });
    expect(result.deletedNodes).toStrictEqual([]);
    expect(store.getState().nodes).toHaveLength(3);
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("deletes what onBeforeDelete narrows the request down to", async () => {
    const store = graph({
      onBeforeDelete: (doomed) => ({ nodes: [], edges: doomed.edges.slice(0, 1) }),
    });
    const result = await store.getState().deleteElements({ nodes: [{ id: "a" }] });
    expect(idsOf(result.deletedEdges)).toStrictEqual(["e1"]);
    expect(store.getState().nodes).toHaveLength(3);
    expect(idsOf(store.getState().edges)).toStrictEqual(["e2", "e3"]);
  });

  it("reports node and edge deletions separately", async () => {
    const onNodesDelete = vi.fn<(nodes: NodeBase[]) => void>();
    const onEdgesDelete = vi.fn<(edges: EdgeBase[]) => void>();
    const store = graph({ onNodesDelete, onEdgesDelete });
    await store.getState().deleteElements({ nodes: [{ id: "a" }] });
    expect(onNodesDelete).toHaveBeenCalledWith([expect.objectContaining({ id: "a" })]);
    expect(onEdgesDelete).toHaveBeenCalledWith([
      expect.objectContaining({ id: "e1" }),
      expect.objectContaining({ id: "e3" }),
    ]);
  });
});
