import type { MiddlewareMap } from "./change-middleware.ts";
import { applyEdgeChanges, applyNodeChanges } from "./changes.ts";
import { deleteElements } from "./delete-actions.ts";
import type { InternalNode } from "./flow-state.ts";
import type {
  FlowActions,
  FlowSettings,
  FlowStore,
  NodeDimensionUpdate,
} from "./flow-store-types.ts";
import { buildEdgeLookups, buildNodeLookups } from "./node-internals.ts";
import { dimensionChangeOf, recordHandleBounds, recordSize } from "./node-measure.ts";
import { expandParentsOf, expandParentsOfMeasured } from "./parent-expansion.ts";
import type { EdgeBase, NodeBase } from "./types.ts";
import { withoutUndefined } from "./without-undefined.ts";

type NodeActionNames =
  | "addNodeChangeMiddleware"
  | "addEdgeChangeMiddleware"
  | "setConfig"
  | "setNodes"
  | "setEdges"
  | "updateNodeDimensions"
  | "triggerNodeChanges"
  | "updateNodePositions"
  | "triggerEdgeChanges"
  | "deleteElements";

// A node is initialised once its size is known: measured, or given by the owner.
// A node counts as initialized once it has been measured (a size the owner gave it does not count,
// as in React Flow); a hidden node is not waited for.
function isInitialized(internal: InternalNode): boolean {
  return (
    internal.hidden === true ||
    (internal.measured.width !== undefined && internal.measured.height !== undefined)
  );
}

// The changes after every middleware has had its say, in the order they were added.
function runMiddleware<TChange>(middleware: MiddlewareMap<TChange>, changes: TChange[]): TChange[] {
  let current = changes;
  for (const step of middleware.values()) {
    current = step(current);
  }
  return current;
}

// Builds the internal nodes from `nodes`, taking over unchanged ones from `previous`.
function rebuildNodes<TNode extends NodeBase, TEdge extends EdgeBase>(
  api: FlowStore<TNode, TEdge>,
  nodes: TNode[],
  previous: Map<string, InternalNode<TNode>>,
): void {
  const state = api.getState();
  const { nodeLookup, parentLookup } = buildNodeLookups(nodes, previous, state);
  api.setState({
    nodes,
    nodeLookup,
    parentLookup,
    nodesInitialized:
      nodeLookup.size > 0 && [...nodeLookup.values()].every((internal) => isInitialized(internal)),
  });
}

function setNodes<TNode extends NodeBase, TEdge extends EdgeBase>(
  api: FlowStore<TNode, TEdge>,
  nodes: TNode[],
): void {
  rebuildNodes(api, nodes, api.getState().nodeLookup);
}

function setEdges<TNode extends NodeBase, TEdge extends EdgeBase>(
  api: FlowStore<TNode, TEdge>,
  edges: TEdge[],
): void {
  api.setState({ edges, ...buildEdgeLookups(edges) });
}

// What the `debug` option does, as in React Flow: every batch of changes that is told (after the
// middleware, and only when there is something in it) is also written to the console.
function tellDebug(debug: boolean, kind: "node" | "edge", changes: readonly unknown[]): void {
  if (debug) {
    // oxlint-disable-next-line eslint/no-console -- printing is the whole point of `debug`
    console.log(`Free-Flow: trigger ${kind} changes`, changes);
  }
}

// A flow that owns its nodes (`defaultNodes`) applies the changes itself; a controlled one leaves
// that to the owner, who gets the changes through `onNodesChange`. Both are told. The node middleware
// has been run before, where there is one to run: as in React Flow it sees the nodes being moved
// (`updateNodePositions`) and what the instance is asked to do to the nodes, and nothing else.
function triggerNodeChanges<TNode extends NodeBase, TEdge extends EdgeBase>(
  api: FlowStore<TNode, TEdge>,
  changes: Parameters<FlowActions<TNode, TEdge>["triggerNodeChanges"]>[0],
): void {
  const state = api.getState();
  if (changes.length === 0) {
    return;
  }
  if (state.hasDefaultNodes) {
    setNodes(api, applyNodeChanges(changes, state.nodes));
  }
  tellDebug(state.debug, "node", changes);
  state.onNodesChange?.(changes);
}

// Unlike the node middleware, the edge middleware sees every batch of edge changes. React Flow keeps
// edge middleware but never runs it, which can only be a defect; Free-Flow does not copy it.
function triggerEdgeChanges<TNode extends NodeBase, TEdge extends EdgeBase>(
  api: FlowStore<TNode, TEdge>,
  changes: Parameters<FlowActions<TNode, TEdge>["triggerEdgeChanges"]>[0],
): void {
  const state = api.getState();
  const processed = runMiddleware(state.onEdgesChangeMiddlewareMap, changes);
  if (processed.length === 0) {
    return;
  }
  if (state.hasDefaultEdges) {
    setEdges(api, applyEdgeChanges(processed, state.edges));
  }
  tellDebug(state.debug, "edge", processed);
  state.onEdgesChange?.(processed);
}

// A fit that waited goes ahead after any measuring, also when some node could not be measured, as
// React Flow's does.
function fitAfterMeasuring<TNode extends NodeBase, TEdge extends EdgeBase>(
  api: FlowStore<TNode, TEdge>,
): void {
  const state = api.getState();
  if (state.fitViewQueued && !state.nodesInitialized) {
    (state.runQueuedFit ?? state.fitView)(state.fitViewOptions);
  }
}

interface Measured {
  sizes: boolean;
  bounds: boolean;
}

// Takes the measurements into the flow, and lets a fit that waited go ahead.
function takeMeasurements<TNode extends NodeBase, TEdge extends EdgeBase>(
  api: FlowStore<TNode, TEdge>,
  measured: Measured & { nodes: TNode[]; nodeLookup: Map<string, InternalNode<TNode>> },
): void {
  if (measured.sizes) {
    // The measured size can move a node (its origin) and decides `nodesInitialized`, so the internal
    // nodes are rebuilt; this holds whether or not the owner applies the `dimensions` changes.
    rebuildNodes(api, measured.nodes, measured.nodeLookup);
  } else if (measured.bounds) {
    api.setState({ nodeLookup: measured.nodeLookup });
  }
  if (measured.sizes || measured.bounds) {
    fitAfterMeasuring(api);
  }
}

function updateNodeDimensions<TNode extends NodeBase, TEdge extends EdgeBase>(
  api: FlowStore<TNode, TEdge>,
  updates: readonly NodeDimensionUpdate[],
): void {
  const state = api.getState();
  const nodeLookup = new Map(state.nodeLookup);
  const bounds = updates.map((update) => recordHandleBounds(nodeLookup, update)).some(Boolean);
  const sizes = updates.map((update) => recordSize(nodeLookup, update)).some(Boolean);
  takeMeasurements(api, { sizes, bounds, nodes: state.nodes, nodeLookup });
  const changes = updates
    .map((update) => dimensionChangeOf(state.nodeLookup.get(update.id), update))
    .filter((change) => change !== undefined);
  const { nodeLookup: measured, parentLookup, nodeOrigin } = api.getState();
  const grown = expandParentsOfMeasured(
    changes,
    { nodeLookup: measured, parentLookup },
    nodeOrigin,
  );
  api.getState().triggerNodeChanges([...changes, ...grown]);
}

// The internal nodes depend on a few settings, so they are rebuilt when one of those changes.
function setConfig<TNode extends NodeBase, TEdge extends EdgeBase>(
  api: FlowStore<TNode, TEdge>,
  settings: FlowSettings<TNode, TEdge>,
): void {
  const before = api.getState();
  api.setState(withoutUndefined(settings));
  const after = api.getState();
  const affectsInternals =
    before.nodeOrigin !== after.nodeOrigin ||
    before.nodeExtent !== after.nodeExtent ||
    before.elevateNodesOnSelect !== after.elevateNodesOnSelect ||
    before.selectedNodeZ !== after.selectedNodeZ ||
    before.zIndexMode !== after.zIndexMode;
  if (affectsInternals) {
    setNodes(api, after.nodes);
  }
}

function without<TChange>(
  middleware: MiddlewareMap<TChange>,
  removed: symbol,
): MiddlewareMap<TChange> {
  const rest = new Map(middleware);
  rest.delete(removed);
  return rest;
}

// Adds a middleware for node changes; the function it returns takes it away again.
function addNodeMiddleware<TNode extends NodeBase, TEdge extends EdgeBase>(
  api: FlowStore<TNode, TEdge>,
  middleware: Parameters<FlowActions<TNode, TEdge>["addNodeChangeMiddleware"]>[0],
): () => void {
  const key = Symbol("node change middleware");
  api.setState((state) => ({
    onNodesChangeMiddlewareMap: new Map(state.onNodesChangeMiddlewareMap).set(key, middleware),
  }));
  return () => {
    api.setState((state) => ({
      onNodesChangeMiddlewareMap: without(state.onNodesChangeMiddlewareMap, key),
    }));
  };
}

function addEdgeMiddleware<TNode extends NodeBase, TEdge extends EdgeBase>(
  api: FlowStore<TNode, TEdge>,
  middleware: Parameters<FlowActions<TNode, TEdge>["addEdgeChangeMiddleware"]>[0],
): () => void {
  const key = Symbol("edge change middleware");
  api.setState((state) => ({
    onEdgesChangeMiddlewareMap: new Map(state.onEdgesChangeMiddlewareMap).set(key, middleware),
  }));
  return () => {
    api.setState((state) => ({
      onEdgesChangeMiddlewareMap: without(state.onEdgesChangeMiddlewareMap, key),
    }));
  };
}

export function createNodeActions<TNode extends NodeBase, TEdge extends EdgeBase>(
  api: FlowStore<TNode, TEdge>,
): Pick<FlowActions<TNode, TEdge>, NodeActionNames> {
  return {
    addNodeChangeMiddleware: (middleware) => addNodeMiddleware(api, middleware),
    addEdgeChangeMiddleware: (middleware) => addEdgeMiddleware(api, middleware),
    setConfig: (settings) => {
      setConfig(api, settings);
    },
    setNodes: (nodes) => {
      setNodes(api, nodes);
    },
    setEdges: (edges) => {
      setEdges(api, edges);
    },
    updateNodeDimensions: (updates) => {
      updateNodeDimensions(api, updates);
    },
    triggerNodeChanges: (changes) => {
      triggerNodeChanges(api, changes);
    },
    // The node middleware sees the moves together with how they grow their parents.
    updateNodePositions: (changes) => {
      const { nodeLookup, parentLookup, nodeOrigin, onNodesChangeMiddlewareMap } = api.getState();
      const moves = expandParentsOf(changes, { nodeLookup, parentLookup }, nodeOrigin);
      triggerNodeChanges(api, runMiddleware(onNodesChangeMiddlewareMap, moves));
    },
    triggerEdgeChanges: (changes) => {
      triggerEdgeChanges(api, changes);
    },
    deleteElements: async (elements) => {
      const deleted = await deleteElements(api, elements);
      return deleted;
    },
  };
}
