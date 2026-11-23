import type { Viewport } from "./camera.ts";
import type { ChangeMiddleware } from "./change-middleware.ts";
import type {
  ConnectionState,
  FlowCallbacks,
  FlowConfig,
  FlowState,
  HandleBounds,
} from "./flow-state.ts";
import type { Point, Rect } from "./geometry.ts";
import type { Store } from "./store.ts";
import type {
  CoordinateExtent,
  EdgeBase,
  EdgeChange,
  FitBoundsOptions,
  FitViewOptions,
  NodeBase,
  NodeChange,
  NodePositionChange,
  Transform,
} from "./types.ts";
import type { WithUndefined } from "./without-undefined.ts";

/** What a node reports after it was measured: its size and where its handles are. */
export interface NodeDimensionUpdate {
  id: string;
  width: number;
  height: number;
  handleBounds?: HandleBounds;
}

export interface ElementsToDelete {
  nodes?: readonly { id: string }[] | undefined;
  edges?: readonly { id: string }[] | undefined;
}

export interface SelectionToClear {
  nodes?: readonly { id: string }[] | undefined;
  edges?: readonly { id: string }[] | undefined;
}

export interface DeletedElements<TNode extends NodeBase, TEdge extends EdgeBase> {
  deletedNodes: TNode[];
  deletedEdges: TEdge[];
}

/** The options and callbacks that can change while the flow is mounted. */
export type FlowSettings<TNode extends NodeBase, TEdge extends EdgeBase> = WithUndefined<
  FlowConfig & FlowCallbacks<TNode, TEdge>
>;

export interface FlowActions<TNode extends NodeBase = NodeBase, TEdge extends EdgeBase = EdgeBase> {
  /** Merges settings into the state; `undefined` values are ignored. */
  setConfig: (settings: FlowSettings<TNode, TEdge>) => void;
  setNodes: (nodes: TNode[]) => void;
  setEdges: (edges: TEdge[]) => void;
  /** Applies measured sizes and handle positions; reports size changes as `dimensions` changes. */
  updateNodeDimensions: (updates: readonly NodeDimensionUpdate[]) => void;
  /** Applies the changes when the flow owns its nodes and reports them; no middleware is run. */
  triggerNodeChanges: (changes: NodeChange<TNode>[]) => void;
  /**
   * Moves nodes as the position changes say: a node that expands its parent is held at the parent's
   * corner and makes the parent grow where it reaches beyond it. The changes go through the node
   * middleware, then are applied and reported.
   */
  updateNodePositions: (changes: NodePositionChange[]) => void;
  /** Runs the edge middleware, then applies the changes when the flow owns its edges and reports them. */
  triggerEdgeChanges: (changes: EdgeChange<TEdge>[]) => void;
  /**
   * Adds a middleware for node changes; the returned function removes it again. As in React Flow it
   * sees the nodes being moved and what the instance is asked to do to the nodes, and nothing else.
   */
  addNodeChangeMiddleware: (middleware: ChangeMiddleware<NodeChange<TNode>>) => () => void;
  /** Adds a middleware that sees every batch of edge changes; the returned function removes it. */
  addEdgeChangeMiddleware: (middleware: ChangeMiddleware<EdgeChange<TEdge>>) => () => void;
  addSelectedNodes: (ids: readonly string[]) => void;
  addSelectedEdges: (ids: readonly string[]) => void;
  unselectNodesAndEdges: (selection?: SelectionToClear) => void;
  /** Selects exactly these nodes and edges and unselects everything else. */
  setSelection: (selection: { nodes: readonly string[]; edges: readonly string[] }) => void;
  resetSelectedElements: () => void;
  deleteElements: (elements: ElementsToDelete) => Promise<DeletedElements<TNode, TEdge>>;
  setSize: (width: number, height: number) => void;
  /**
   * Moves the viewport, clamped to the zoom range and `translateExtent`, and tells `onViewportChange`;
   * returns whether it changed. When the owner holds the viewport (`viewportControlled`) it is only
   * told, and the stored viewport stays where it is.
   */
  setViewport: (viewport: Viewport) => boolean;
  /** The viewport as it is given, not held to `translateExtent` or to the range of the zoom. */
  setViewportAsGiven: (viewport: Viewport) => boolean;
  /** Takes the viewport the owner hands in, without telling `onViewportChange` about it. */
  syncViewport: (viewport: Viewport) => void;
  panBy: (delta: Point) => boolean;
  /** Zooms about `anchor` (a canvas point), the centre of the canvas by default. */
  zoomTo: (zoom: number, anchor?: Point) => boolean;
  zoomIn: (anchor?: Point) => boolean;
  zoomOut: (anchor?: Point) => boolean;
  /** `asked`: the owner asked for this fit now, which is then made even with no node to frame. */
  fitView: (options?: FitViewOptions, asked?: boolean) => boolean;
  fitBounds: (bounds: Rect, options?: FitBoundsOptions) => boolean;
  setCenter: (x: number, y: number, options?: { zoom?: number | undefined }) => boolean;
  setMinZoom: (minZoom: number) => void;
  setMaxZoom: (maxZoom: number) => void;
  setTranslateExtent: (translateExtent: CoordinateExtent) => void;
  setNodeExtent: (nodeExtent: CoordinateExtent) => void;
  /** Makes the flow own the nodes (and edges) it is given, as `defaultNodes` does. */
  setDefaultNodesAndEdges: (nodes?: TNode[], edges?: TEdge[]) => void;
  /** Puts the connection in progress, or its end, in the state that is drawn. */
  updateConnection: (connection: ConnectionState) => void;
  cancelConnection: () => void;
  /** Puts what the flow holds (nodes, edges, viewport, selection, connection) back to the start. */
  reset: () => void;
}

export type FlowStoreState<
  TNode extends NodeBase = NodeBase,
  TEdge extends EdgeBase = EdgeBase,
> = FlowState<TNode, TEdge> &
  FlowActions<TNode, TEdge> & {
    /** The viewport that is drawn as `[x, y, zoom]`, as React Flow's store keeps it. */
    transform: Transform;
  };

export type FlowStore<TNode extends NodeBase = NodeBase, TEdge extends EdgeBase = EdgeBase> = Store<
  FlowStoreState<TNode, TEdge>
>;
