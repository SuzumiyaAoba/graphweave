import { describe, expect, it, vi } from "vite-plus/test";

import type { HandleBounds } from "./flow-state.ts";
import { createFlowStore } from "./flow-store.ts";
import { makeEdge, makeNode } from "./test-fixtures.ts";
import type { EdgeChange, NodeChange } from "./types.ts";

type NodesChanged = (changes: NodeChange[]) => void;
type EdgesChanged = (changes: EdgeChange[]) => void;

describe("createFlowStore: state", () => {
  it("builds the lookups for the nodes and edges it is given", () => {
    const nodes = [makeNode("a"), makeNode("b")];
    const edges = [makeEdge("e1", ["a", "b"])];
    const store = createFlowStore({ nodes, edges });
    const state = store.getState();
    expect(state.nodes).toBe(nodes);
    expect(state.edges).toBe(edges);
    expect([...state.nodeLookup.keys()]).toStrictEqual(["a", "b"]);
    expect(state.edgeLookup.get("e1")).toBe(edges[0]);
    expect(state.hasDefaultNodes).toBe(false);
  });

  it("starts empty, with React Flow's defaults", () => {
    const state = createFlowStore().getState();
    expect(state.nodes).toStrictEqual([]);
    expect(state.viewport).toStrictEqual({ x: 0, y: 0, zoom: 1 });
    expect(state.minZoom).toBe(0.5);
    expect(state.maxZoom).toBe(2);
    expect(state.nodesDraggable).toBe(true);
  });

  it("lets options override the defaults but ignores undefined ones", () => {
    const state = createFlowStore({ minZoom: 0.1, maxZoom: undefined }).getState();
    expect(state.minZoom).toBe(0.1);
    expect(state.maxZoom).toBe(2);
  });

  it("merges later settings, ignoring undefined values", () => {
    const store = createFlowStore();
    store.getState().setConfig({ minZoom: 0.2, maxZoom: undefined });
    expect(store.getState().minZoom).toBe(0.2);
    expect(store.getState().maxZoom).toBe(2);
  });

  it("rebuilds the internal nodes when the node origin changes", () => {
    const store = createFlowStore({ nodes: [makeNode("a", { width: 100, height: 100 })] });
    expect(store.getState().nodeLookup.get("a")?.internals.positionAbsolute).toStrictEqual({
      x: 0,
      y: 0,
    });
    store.getState().setConfig({ nodeOrigin: [0.5, 0.5] });
    expect(store.getState().nodeLookup.get("a")?.internals.positionAbsolute).toStrictEqual({
      x: -50,
      y: -50,
    });
  });

  it("keeps the internal node of an unchanged node when other nodes are replaced", () => {
    const unchanged = makeNode("a");
    const store = createFlowStore({ nodes: [unchanged, makeNode("b")] });
    const before = store.getState().nodeLookup.get("a");
    store.getState().setNodes([unchanged, makeNode("b", { position: { x: 5, y: 5 } })]);
    expect(store.getState().nodeLookup.get("a")).toBe(before);
  });

  it("notifies subscribers when nodes are set", () => {
    const store = createFlowStore();
    const listener = vi.fn<() => void>();
    store.subscribe(listener);
    store.getState().setNodes([makeNode("a")]);
    expect(listener).toHaveBeenCalledOnce();
  });
});

describe("createFlowStore: changes", () => {
  const select = { id: "a", type: "select", selected: true } as const;

  it("leaves controlled nodes to the owner and only reports the changes", () => {
    const nodes = [makeNode("a")];
    const onNodesChange = vi.fn<NodesChanged>();
    const store = createFlowStore({ nodes, onNodesChange });
    store.getState().triggerNodeChanges([select]);
    expect(store.getState().nodes).toBe(nodes);
    expect(onNodesChange).toHaveBeenCalledWith([select]);
  });

  it("applies the changes to uncontrolled nodes and still reports them", () => {
    const onNodesChange = vi.fn<NodesChanged>();
    const store = createFlowStore({ defaultNodes: [makeNode("a")], onNodesChange });
    store.getState().triggerNodeChanges([select]);
    expect(store.getState().nodes[0]?.selected).toBe(true);
    expect(store.getState().nodeLookup.get("a")?.selected).toBe(true);
    expect(onNodesChange).toHaveBeenCalledOnce();
  });

  it("applies and reports edge changes the same way", () => {
    const onEdgesChange = vi.fn<EdgesChanged>();
    const store = createFlowStore({
      defaultNodes: [],
      defaultEdges: [makeEdge("e1", ["a", "b"])],
      onEdgesChange,
    });
    store.getState().triggerEdgeChanges([{ id: "e1", type: "select", selected: true }]);
    expect(store.getState().edges[0]?.selected).toBe(true);
    expect(store.getState().edgeLookup.get("e1")?.selected).toBe(true);
    expect(onEdgesChange).toHaveBeenCalledOnce();
  });

  it("ignores an empty change list", () => {
    const onNodesChange = vi.fn<NodesChanged>();
    const store = createFlowStore({ defaultNodes: [makeNode("a")], onNodesChange });
    store.getState().triggerNodeChanges([]);
    expect(onNodesChange).not.toHaveBeenCalled();
  });
});

describe("createFlowStore: node dimensions", () => {
  const bounds: HandleBounds = {
    source: [{ id: null, type: "source", position: "right", x: 100, y: 20, width: 8, height: 8 }],
    target: [],
  };

  it("reports a measured size as a dimensions change and records it on uncontrolled nodes", () => {
    const onNodesChange = vi.fn<NodesChanged>();
    const store = createFlowStore({ defaultNodes: [makeNode("a")], onNodesChange });
    expect(store.getState().nodesInitialized).toBe(false);
    store.getState().updateNodeDimensions([{ id: "a", width: 100, height: 50 }]);
    expect(onNodesChange).toHaveBeenCalledWith([
      { id: "a", type: "dimensions", dimensions: { width: 100, height: 50 } },
    ]);
    expect(store.getState().nodes[0]?.measured).toStrictEqual({ width: 100, height: 50 });
    expect(store.getState().nodesInitialized).toBe(true);
  });

  it("keeps the size it knows when a node is measured at no size, and takes handles it had none of", () => {
    const onNodesChange = vi.fn<NodesChanged>();
    const store = createFlowStore({
      defaultNodes: [makeNode("a", { measured: { width: 100, height: 50 } })],
      onNodesChange,
    });
    store.getState().updateNodeDimensions([{ id: "a", width: 0, height: 0, handleBounds: bounds }]);
    expect(onNodesChange).not.toHaveBeenCalled();
    expect(store.getState().nodes[0]?.measured).toStrictEqual({ width: 100, height: 50 });
    expect(store.getState().nodeLookup.get("a")?.internals.handleBounds).toStrictEqual(bounds);
  });

  it("waits for a measurement, however much of a size the owner gave", () => {
    const store = createFlowStore({
      defaultNodes: [makeNode("a", { width: 100, height: 50 })],
    });
    expect(store.getState().nodesInitialized).toBe(false);
    store.getState().updateNodeDimensions([{ id: "a", width: 100, height: 50 }]);
    expect(store.getState().nodesInitialized).toBe(true);
  });

  it("does not wait for a node that is hidden, nor count a flow with no nodes", () => {
    const hidden = createFlowStore({
      defaultNodes: [
        makeNode("a", { measured: { width: 10, height: 10 } }),
        makeNode("b", { hidden: true }),
      ],
    });
    expect([
      hidden.getState().nodesInitialized,
      createFlowStore().getState().nodesInitialized,
    ]).toStrictEqual([true, false]);
  });

  it("takes the handles a node describes as its handle bounds, until it is measured", () => {
    const store = createFlowStore({
      defaultNodes: [
        makeNode("a", {
          handles: [{ type: "source", position: "right", x: 100, y: 20, width: 8, height: 8 }],
        }),
      ],
    });
    expect(store.getState().nodeLookup.get("a")?.internals.handleBounds).toStrictEqual({
      source: [{ id: null, type: "source", position: "right", x: 100, y: 20, width: 8, height: 8 }],
      target: [],
    });
  });

  it("reports nothing when the size did not change, or the node is unknown", () => {
    const onNodesChange = vi.fn<NodesChanged>();
    const store = createFlowStore({
      defaultNodes: [makeNode("a", { measured: { width: 100, height: 50 } })],
      onNodesChange,
    });
    store.getState().updateNodeDimensions([
      { id: "a", width: 100, height: 50 },
      { id: "missing", width: 1, height: 1 },
    ]);
    expect(onNodesChange).not.toHaveBeenCalled();
  });

  it("stores handle bounds on the internal node and keeps them across updates", () => {
    const store = createFlowStore({ defaultNodes: [makeNode("a")] });
    store
      .getState()
      .updateNodeDimensions([{ id: "a", width: 100, height: 50, handleBounds: bounds }]);
    expect(store.getState().nodeLookup.get("a")?.internals.handleBounds).toBe(bounds);
    store.getState().triggerNodeChanges([{ id: "a", type: "select", selected: true }]);
    expect(store.getState().nodeLookup.get("a")?.internals.handleBounds).toBe(bounds);
  });

  it("keeps measured sizes of a controlled flow even when the owner ignores the changes", () => {
    const store = createFlowStore({ nodes: [makeNode("a")] });
    expect(store.getState().nodesInitialized).toBe(false);
    store.getState().updateNodeDimensions([{ id: "a", width: 100, height: 50 }]);
    expect(store.getState().nodeLookup.get("a")?.measured).toStrictEqual({
      width: 100,
      height: 50,
    });
    expect(store.getState().nodesInitialized).toBe(true);
    store.getState().setNodes([makeNode("a", { position: { x: 5, y: 5 } })]);
    expect(store.getState().nodeLookup.get("a")?.measured).toStrictEqual({
      width: 100,
      height: 50,
    });
  });

  it("places a measured node by its origin once the size is known", () => {
    const store = createFlowStore({ nodes: [makeNode("a")], nodeOrigin: [0.5, 0.5] });
    store.getState().updateNodeDimensions([{ id: "a", width: 100, height: 50 }]);
    expect(store.getState().nodeLookup.get("a")?.internals.positionAbsolute).toStrictEqual({
      x: -50,
      y: -25,
    });
  });

  it("leaves the lookup alone when the handles measure the same as before", () => {
    const store = createFlowStore({ nodes: [makeNode("a")] });
    store
      .getState()
      .updateNodeDimensions([{ id: "a", width: 10, height: 10, handleBounds: bounds }]);
    const before = store.getState().nodeLookup;
    store
      .getState()
      .updateNodeDimensions([
        { id: "a", width: 10, height: 10, handleBounds: structuredClone(bounds) },
      ]);
    expect(store.getState().nodeLookup).toBe(before);
  });

  it("changes only the internal node whose handles were measured", () => {
    const store = createFlowStore({ nodes: [makeNode("a"), makeNode("b")] });
    const untouched = store.getState().nodeLookup.get("b");
    store
      .getState()
      .updateNodeDimensions([{ id: "a", width: 10, height: 10, handleBounds: bounds }]);
    expect(store.getState().nodeLookup.get("b")).toBe(untouched);
  });
});
