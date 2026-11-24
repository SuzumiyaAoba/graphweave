import type {
  FitBoundsOptions,
  FitViewOptions,
  HandleType,
  InternalNode,
  NodeConnection,
  Rect,
  SnapGrid,
  Viewport,
  ViewportInterpolation,
  XYPosition,
} from "@graphweave/core";

import type { Edge, Node } from "./types.ts";

export interface ViewportHelperOptions {
  /** Animate the move over this many milliseconds. */
  duration?: number | undefined;
  /** Maps how far the animation is (0 to 1) to how far it has come; slow at both ends by default. */
  ease?: ((progress: number) => number) | undefined;
  /** The path the move takes: along a smooth zoom path (the default), or straight. */
  interpolate?: ViewportInterpolation | undefined;
}

export interface SetCenterOptions extends ViewportHelperOptions {
  zoom?: number | undefined;
}

export interface FlowObject<TNode extends Node = Node, TEdge extends Edge = Edge> {
  nodes: TNode[];
  edges: TEdge[];
  viewport: Viewport;
}

export interface DeleteElementsParams {
  nodes?: readonly { id: string }[] | undefined;
  edges?: readonly { id: string }[] | undefined;
}

export interface UpdateOptions {
  /** Replace the whole node or edge (or its data) instead of merging into it. */
  replace?: boolean | undefined;
}

type Update<TValue> = Partial<TValue> | ((current: TValue) => Partial<TValue>);
type Updater<TValue> = TValue | ((current: TValue) => TValue);

/** The methods `useReactFlow` returns, and what `onInit` receives. */
export interface ReactFlowInstance<TNode extends Node = Node, TEdge extends Edge = Edge> {
  getNodes: () => TNode[];
  setNodes: (nodes: Updater<TNode[]>) => void;
  addNodes: (nodes: TNode | TNode[]) => void;
  getNode: (id: string) => TNode | undefined;
  getInternalNode: (id: string) => InternalNode<TNode> | undefined;
  getEdges: () => TEdge[];
  setEdges: (edges: Updater<TEdge[]>) => void;
  addEdges: (edges: TEdge | TEdge[]) => void;
  getEdge: (id: string) => TEdge | undefined;
  toObject: () => FlowObject<TNode, TEdge>;
  deleteElements: (params: DeleteElementsParams) => Promise<{
    deletedNodes: TNode[];
    deletedEdges: TEdge[];
  }>;
  getIntersectingNodes: (
    node: { id: string } | Rect,
    partially?: boolean,
    nodes?: TNode[],
  ) => TNode[];
  isNodeIntersecting: (node: { id: string } | Rect, area: Rect, partially?: boolean) => boolean;
  updateNode: (id: string, update: Update<TNode>, options?: UpdateOptions) => void;
  /** As in React Flow, an updater function is given the whole node, and returns its new data. */
  updateNodeData: (
    id: string,
    update: Partial<TNode["data"]> | ((node: TNode) => Partial<TNode["data"]>),
    options?: UpdateOptions,
  ) => void;
  updateEdge: (id: string, update: Update<TEdge>, options?: UpdateOptions) => void;
  updateEdgeData: (
    id: string,
    update:
      | Partial<NonNullable<TEdge["data"]>>
      | ((edge: TEdge) => Partial<NonNullable<TEdge["data"]>>),
    options?: UpdateOptions,
  ) => void;
  getNodesBounds: (nodes: readonly (string | { id: string })[]) => Rect;
  getNodeConnections: (params: {
    type?: HandleType;
    handleId?: string | null;
    nodeId: string;
  }) => NodeConnection[];
  /** @deprecated Use `getNodeConnections`. */
  getHandleConnections: (params: {
    type: HandleType;
    id?: string | null;
    nodeId: string;
  }) => NodeConnection[];
  fitView: (options?: FitViewOptions<TNode>) => Promise<boolean>;
  zoomIn: (options?: ViewportHelperOptions) => Promise<boolean>;
  zoomOut: (options?: ViewportHelperOptions) => Promise<boolean>;
  zoomTo: (zoom: number, options?: ViewportHelperOptions) => Promise<boolean>;
  getZoom: () => number;
  setViewport: (viewport: Viewport, options?: ViewportHelperOptions) => Promise<boolean>;
  getViewport: () => Viewport;
  setCenter: (x: number, y: number, options?: SetCenterOptions) => Promise<boolean>;
  fitBounds: (bounds: Rect, options?: FitBoundsOptions) => Promise<boolean>;
  screenToFlowPosition: (
    position: XYPosition,
    options?: { snapToGrid?: boolean; snapGrid?: SnapGrid },
  ) => XYPosition;
  flowToScreenPosition: (position: XYPosition) => XYPosition;
  /** True once the canvas has been measured and the nodes have a size. */
  viewportInitialized: boolean;
}
