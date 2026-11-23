import { createFlowStore, createStore } from "@free-flow/core";
import type {
  CoordinateExtent,
  FitViewOptions,
  FlowSettings,
  NodeOrigin,
  WithUndefined,
  ZIndexMode,
} from "@free-flow/core";
import { useState } from "react";
import type { ReactElement, ReactNode } from "react";

import { useBatchQueue } from "./batch-queue.ts";
import { combineStores } from "./combined-store.ts";
import { failQueuedFit, settleQueuedFit } from "./fit-view-wait.ts";
import { handled } from "./handled.ts";
import { motionOf } from "./instance-viewport.ts";
import { noop } from "./noop.ts";
import { StoreContext } from "./store-context.ts";
import type { ReactFlowStore } from "./store-context.ts";
import type { Edge, Node } from "./types.ts";
import { MIRROR_KEYS, initialMirror } from "./view-mirror.ts";
import type { ViewMirror } from "./view-mirror.ts";
import { defaultViewProps } from "./view-props.ts";
import { runViewportChange } from "./viewport-animation.ts";

export type ReactFlowProviderProps = WithUndefined<{
  /** Nodes the store starts with when the flow is controlled. */
  initialNodes: Node[];
  initialEdges: Edge[];
  /** Nodes the flow owns and updates itself. */
  defaultNodes: Node[];
  defaultEdges: Edge[];
  /** The canvas size before it has been measured; lets `fitView` run during the first render. */
  initialWidth: number;
  initialHeight: number;
  /** Frame the nodes as soon as they have been measured. */
  fitView: boolean;
  initialFitViewOptions: FitViewOptions;
  initialMinZoom: number;
  initialMaxZoom: number;
  nodeOrigin: NodeOrigin;
  nodeExtent: CoordinateExtent;
  zIndexMode: ZIndexMode;
  /** Settings the store starts with, so that the first render already follows them. */
  initialSettings: FlowSettings<Node, Edge>;
  /** What the store mirrors of the React-level props to start with. */
  initialMirror: ViewMirror;
}> & { children: ReactNode };

// The fit that waited for the nodes, now that it can be made; what waits for it is told.
async function fitQueued(
  store: ReactFlowStore,
  options: FitViewOptions | undefined,
): Promise<void> {
  try {
    await runViewportChange(store, () => store.getState().fitView(options), motionOf(options));
  } catch (error) {
    failQueuedFit(store, error);
    throw error;
  }
  settleQueuedFit(store);
}

function createStoreFor(props: ReactFlowProviderProps): ReactFlowStore {
  const core = createFlowStore<Node, Edge>({
    nodes: props.initialNodes,
    edges: props.initialEdges,
    defaultNodes: props.defaultNodes,
    defaultEdges: props.defaultEdges,
    width: props.initialWidth,
    height: props.initialHeight,
    minZoom: props.initialMinZoom,
    maxZoom: props.initialMaxZoom,
    nodeOrigin: props.nodeOrigin,
    nodeExtent: props.nodeExtent,
    zIndexMode: props.zIndexMode,
    ...props.initialSettings,
  });
  const mirror = createStore<ViewMirror>(
    () => props.initialMirror ?? initialMirror(defaultViewProps()),
  );
  const store = combineStores(core, mirror, MIRROR_KEYS);
  // A fit that had to wait for the nodes to be measured glides there when it was asked to.
  store.setState({
    runQueuedFit: (options) => {
      // An animated move does not fail; there is nothing to tell if it did.
      handled(fitQueued(store, options), noop);
    },
  });
  if (props.fitView === true) {
    // Frames the nodes at once when their size is known (as the server renders them), else it waits.
    store.getState().fitView(props.initialFitViewOptions);
  }
  return store;
}

/**
 * Makes a flow's store available to the hooks and components below it. `<ReactFlow>` creates one
 * itself; use the provider to reach the store from outside of it (a sidebar, a toolbar).
 */
export function ReactFlowProvider(props: ReactFlowProviderProps): ReactElement {
  const [store] = useState(() => createStoreFor(props));
  useBatchQueue(store);
  return <StoreContext.Provider value={store}>{props.children}</StoreContext.Provider>;
}
