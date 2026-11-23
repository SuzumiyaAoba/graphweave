import { NO_CONNECTION, createInitialState } from "./flow-state.ts";
import type { FlowActions, FlowStore, FlowStoreState } from "./flow-store-types.ts";
import type { EdgeBase, NodeBase } from "./types.ts";

type ConfigActionNames =
  | "setMinZoom"
  | "setMaxZoom"
  | "setTranslateExtent"
  | "setNodeExtent"
  | "setDefaultNodesAndEdges"
  | "cancelConnection"
  | "updateConnection"
  | "reset";

// What a flow holds, as an empty flow starts with it; the settings and callbacks are not part of it.
function startingState<TNode extends NodeBase, TEdge extends EdgeBase>(): Partial<
  FlowStoreState<TNode, TEdge>
> {
  const initial = createInitialState<TNode, TEdge>();
  return {
    nodes: initial.nodes,
    edges: initial.edges,
    nodeLookup: initial.nodeLookup,
    parentLookup: initial.parentLookup,
    edgeLookup: initial.edgeLookup,
    connectionLookup: initial.connectionLookup,
    nodesInitialized: initial.nodesInitialized,
    viewport: initial.viewport,
    pendingViewport: initial.pendingViewport,
    transform: [initial.viewport.x, initial.viewport.y, initial.viewport.zoom],
    fitViewQueued: initial.fitViewQueued,
    fitViewOptions: initial.fitViewOptions,
    connection: initial.connection,
    connectionClickStartHandle: initial.connectionClickStartHandle,
    multiSelectionActive: initial.multiSelectionActive,
    userSelectionActive: initial.userSelectionActive,
    userSelectionRect: initial.userSelectionRect,
    nodesSelectionActive: initial.nodesSelectionActive,
  };
}

/**
 * The actions that set one piece of the store's configuration or state, as React Flow's store has
 * them: zoom limits, extents, the nodes and edges a flow owns, the connection in progress, and a
 * reset of what the flow holds to how it starts.
 */
export function createConfigActions<TNode extends NodeBase, TEdge extends EdgeBase>(
  api: FlowStore<TNode, TEdge>,
): Pick<FlowActions<TNode, TEdge>, ConfigActionNames> {
  return {
    setMinZoom: (minZoom) => {
      api.setState({ minZoom });
    },
    setMaxZoom: (maxZoom) => {
      api.setState({ maxZoom });
    },
    setTranslateExtent: (translateExtent) => {
      api.setState({ translateExtent });
    },
    setNodeExtent: (nodeExtent) => {
      api.setState({ nodeExtent });
    },
    setDefaultNodesAndEdges: (nodes, edges) => {
      if (nodes !== undefined) {
        api.getState().setNodes(nodes);
        api.setState({ hasDefaultNodes: true });
      }
      if (edges !== undefined) {
        api.getState().setEdges(edges);
        api.setState({ hasDefaultEdges: true });
      }
    },
    cancelConnection: () => {
      api.setState({ connection: NO_CONNECTION });
    },
    updateConnection: (connection) => {
      api.setState({ connection });
    },
    reset: () => {
      api.setState(startingState<TNode, TEdge>());
    },
  };
}
