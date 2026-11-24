import { describe, expect, it, vi } from "vite-plus/test";

import { createFlowStore } from "./flow-store.ts";
import { makeEdge, makeNode } from "./test-fixtures.ts";
import type { EdgeChange, NodeChange } from "./types.ts";

type NodesChanged = (changes: NodeChange[]) => void;

function keepAll(changes: NodeChange[]): NodeChange[] {
  return changes;
}

function keepEdges(changes: EdgeChange[]): EdgeChange[] {
  return changes;
}

function dropMoves(changes: NodeChange[]): NodeChange[] {
  return changes.filter((change) => change.type !== "position");
}

const MOVE_A = { id: "a", type: "position", position: { x: 5, y: 5 } } as const;

describe("createFlowStore: the maps of change middleware", () => {
  it("starts with no middleware for nodes or edges", () => {
    const state = createFlowStore({ defaultNodes: [makeNode("a")] }).getState();
    expect([
      state.onNodesChangeMiddlewareMap.size,
      state.onEdgesChangeMiddlewareMap.size,
    ]).toStrictEqual([0, 0]);
  });

  it("holds each node middleware under a key of its own, and drops it when it is removed", () => {
    const store = createFlowStore({ defaultNodes: [makeNode("a")] });
    const remove = store.getState().addNodeChangeMiddleware(keepAll);
    expect([...store.getState().onNodesChangeMiddlewareMap.values()]).toStrictEqual([keepAll]);
    remove();
    expect(store.getState().onNodesChangeMiddlewareMap.size).toBe(0);
  });

  it("holds each edge middleware under a key of its own, and drops it when it is removed", () => {
    const store = createFlowStore({ defaultEdges: [makeEdge("e1", ["a", "b"])] });
    const remove = store.getState().addEdgeChangeMiddleware(keepEdges);
    expect([...store.getState().onEdgesChangeMiddlewareMap.values()]).toStrictEqual([keepEdges]);
    remove();
    expect(store.getState().onEdgesChangeMiddlewareMap.size).toBe(0);
  });

  it("runs a function registered twice twice, and takes away only the registration removed", () => {
    const seen: string[] = [];
    function note(changes: NodeChange[]): NodeChange[] {
      seen.push("note");
      return changes;
    }
    const store = createFlowStore({ defaultNodes: [makeNode("a")] });
    const removeFirst = store.getState().addNodeChangeMiddleware(note);
    store.getState().addNodeChangeMiddleware(note);
    store.getState().updateNodePositions([MOVE_A]);
    removeFirst();
    store.getState().updateNodePositions([MOVE_A]);
    expect(seen).toStrictEqual(["note", "note", "note"]);
  });

  it("replaces the map each time, so that what was read before is not changed", () => {
    const store = createFlowStore({ defaultNodes: [makeNode("a")] });
    const before = store.getState().onNodesChangeMiddlewareMap;
    store.getState().addNodeChangeMiddleware(keepAll);
    expect([before.size, store.getState().onNodesChangeMiddlewareMap.size]).toStrictEqual([0, 1]);
  });

  it("runs the middleware of a map that was set on the store", () => {
    const store = createFlowStore({ defaultNodes: [makeNode("a")] });
    store.setState({ onNodesChangeMiddlewareMap: new Map([[Symbol("mine"), dropMoves]]) });
    store.getState().updateNodePositions([MOVE_A]);
    expect(store.getState().nodes[0]?.position).toStrictEqual({ x: 0, y: 0 });
  });
});

describe("createFlowStore: change middleware", () => {
  it("lets node middleware rewrite the moves of nodes before they are applied and reported", () => {
    const onNodesChange = vi.fn<NodesChanged>();
    const store = createFlowStore({ defaultNodes: [makeNode("a")], onNodesChange });
    store
      .getState()
      .addNodeChangeMiddleware((changes) => changes.filter((change) => change.type !== "position"));
    store.getState().updateNodePositions([MOVE_A]);
    expect(store.getState().nodes[0]?.position).toStrictEqual({ x: 0, y: 0 });
    expect(onNodesChange).not.toHaveBeenCalled();
  });

  it("runs node middleware in order and stops running a removed one", () => {
    const seen: string[] = [];
    const store = createFlowStore({ defaultNodes: [makeNode("a")] });
    store.getState().addNodeChangeMiddleware((changes) => {
      seen.push("first");
      return changes;
    });
    const removeSecond = store.getState().addNodeChangeMiddleware((changes) => {
      seen.push("second");
      return changes;
    });
    store.getState().updateNodePositions([MOVE_A]);
    removeSecond();
    store.getState().updateNodePositions([MOVE_A]);
    expect(seen).toStrictEqual(["first", "second", "first"]);
  });

  // As in React Flow, the node middleware sees the moves only, not a selection or a removal.
  it("does not show node middleware the node changes that are triggered directly", () => {
    const store = createFlowStore({ defaultNodes: [makeNode("a")] });
    store.getState().addNodeChangeMiddleware(() => []);
    store.getState().triggerNodeChanges([{ id: "a", type: "select", selected: true }]);
    expect(store.getState().nodes[0]?.selected).toBe(true);
  });

  // React Flow keeps edge middleware without ever running it; GraphWeave runs it.
  it("runs edge middleware for the edge changes that are triggered", () => {
    const store = createFlowStore({ defaultNodes: [], defaultEdges: [makeEdge("e1", ["a", "b"])] });
    store.getState().addEdgeChangeMiddleware(() => []);
    store.getState().triggerEdgeChanges([{ id: "e1", type: "select", selected: true }]);
    expect(store.getState().edges[0]?.selected).toBeUndefined();
  });
});
