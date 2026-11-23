import type { Viewport } from "./camera.ts";
import { createConfigActions } from "./config-actions.ts";
import { createInitialState } from "./flow-state.ts";
import type { FlowSettings, FlowStore, FlowStoreState } from "./flow-store-types.ts";
import { createNodeActions } from "./node-actions.ts";
import { createSelectionActions } from "./selection-actions.ts";
import { createStore } from "./store.ts";
import type { EdgeBase, NodeBase, Transform } from "./types.ts";
import { createViewportActions } from "./viewport-actions.ts";
import { withoutUndefined } from "./without-undefined.ts";
import type { WithUndefined } from "./without-undefined.ts";

export type FlowStoreOptions<TNode extends NodeBase, TEdge extends EdgeBase> = FlowSettings<
  TNode,
  TEdge
> &
  WithUndefined<{
    /** Controlled nodes: the owner holds them and applies the reported changes. */
    nodes: TNode[];
    /** Uncontrolled nodes: the flow holds them and applies the changes itself. */
    defaultNodes: TNode[];
    edges: TEdge[];
    defaultEdges: TEdge[];
    viewport: Viewport;
    width: number;
    height: number;
  }>;

function initialTransform(viewport: Viewport | undefined): Transform {
  return viewport === undefined ? [0, 0, 1] : [viewport.x, viewport.y, viewport.zoom];
}

/** Creates the store behind a flow: its state, the lookups derived from it, and the actions. */
export function createFlowStore<TNode extends NodeBase, TEdge extends EdgeBase>(
  options: FlowStoreOptions<TNode, TEdge> = {},
): FlowStore<TNode, TEdge> {
  const { nodes, defaultNodes, edges, defaultEdges, ...settings } = options;
  const store = createStore<FlowStoreState<TNode, TEdge>>((api) => ({
    ...createInitialState<TNode, TEdge>(),
    ...withoutUndefined(settings),
    transform: initialTransform(settings.viewport),
    hasDefaultNodes: defaultNodes !== undefined,
    hasDefaultEdges: defaultEdges !== undefined,
    ...createConfigActions(api),
    ...createNodeActions(api),
    ...createSelectionActions(api),
    ...createViewportActions(api),
  }));
  store.subscribe((state, previous) => {
    const changed =
      state.nodeLookup !== previous.nodeLookup ||
      state.width !== previous.width ||
      state.height !== previous.height;
    // A fit that waited goes ahead once every node has been measured, as in React Flow.
    if (state.fitViewQueued && changed && state.nodesInitialized) {
      const run = state.runQueuedFit ?? state.fitView;
      run(state.fitViewOptions);
    }
  });
  const initialNodes = nodes ?? defaultNodes;
  const initialEdges = edges ?? defaultEdges;
  if (initialNodes !== undefined) {
    store.getState().setNodes(initialNodes);
  }
  if (initialEdges !== undefined) {
    store.getState().setEdges(initialEdges);
  }
  return store;
}
