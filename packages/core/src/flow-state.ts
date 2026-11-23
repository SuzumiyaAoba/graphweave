import type { Viewport } from "./camera.ts";
import type { MiddlewareMap } from "./change-middleware.ts";
import type {
  Connection,
  CoordinateExtent,
  EdgeBase,
  EdgeChange,
  FitViewOptions,
  HandleType,
  NodeBase,
  NodeChange,
  NodeConnection,
  NodeOrigin,
  Position,
  SnapGrid,
  XYPosition,
  ZIndexMode,
} from "./types.ts";
import { ConnectionMode } from "./types.ts";

/** A handle's box in flow units, relative to its node; on a connection's handles, to the canvas. */
export interface HandleBound {
  id: string | null;
  type: HandleType;
  /** The node the handle belongs to: set when the handle is measured, and on a connection's handles. */
  nodeId?: string | undefined;
  position: Position;
  x: number;
  y: number;
  width: number;
  height: number;
  /** All default to `true`: whether a connection may start here, end here, or neither. */
  isConnectable?: boolean;
  isConnectableStart?: boolean;
  isConnectableEnd?: boolean;
}

export interface HandleBounds {
  source: HandleBound[];
  target: HandleBound[];
}

export interface NodeInternals<TNode extends NodeBase = NodeBase> {
  /** Top-left corner in flow coordinates: parents and the node origin are already applied. */
  positionAbsolute: XYPosition;
  z: number;
  /** The object the owner passed in; its identity changes only when the owner changed the node. */
  userNode: TNode;
  handleBounds: HandleBounds | undefined;
}

export type InternalNode<TNode extends NodeBase = NodeBase> = TNode & {
  measured: { width?: number; height?: number };
  internals: NodeInternals<TNode>;
};

export interface NoConnection {
  inProgress: false;
  isValid: null;
  from: null;
  fromHandle: null;
  fromPosition: null;
  fromNode: null;
  to: null;
  toHandle: null;
  toPosition: null;
  toNode: null;
  pointer: null;
}

export interface ConnectionInProgress {
  inProgress: true;
  isValid: boolean | null;
  from: XYPosition;
  fromHandle: HandleBound;
  /** Which end the drag began at: `fromHandle`'s type, unless loose mode hung it on the other. */
  fromRole?: HandleType;
  fromPosition: Position;
  fromNode: InternalNode;
  to: XYPosition;
  toHandle: HandleBound | null;
  toPosition: Position;
  toNode: InternalNode | null;
  /** Where the pointer is, in pixels from the top left of the canvas (the line may end elsewhere). */
  pointer: XYPosition;
}

export type ConnectionState = NoConnection | ConnectionInProgress;

/** A connection as it was when it ended: no `inProgress`, and a `toPosition` only over a handle. */
export type FinalConnectionState = Omit<ConnectionState, "inProgress">;

/** Where a connection made by clicks (`connectOnClick`) began, waiting for the second click. */
export interface ClickConnectionStart {
  nodeId: string;
  type: HandleType;
  id: string | null;
}

export const NO_CONNECTION: NoConnection = {
  inProgress: false,
  isValid: null,
  from: null,
  fromHandle: null,
  fromPosition: null,
  fromNode: null,
  to: null,
  toHandle: null,
  toPosition: null,
  toNode: null,
  pointer: null,
};

export interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
  startX: number;
  startY: number;
}

/** Options that decide how the flow behaves; the React props map onto these one to one. */
export interface FlowConfig {
  minZoom: number;
  maxZoom: number;
  translateExtent: CoordinateExtent;
  nodeExtent: CoordinateExtent;
  nodeOrigin: NodeOrigin;
  snapToGrid: boolean;
  snapGrid: SnapGrid;
  nodesDraggable: boolean;
  nodesConnectable: boolean;
  nodesFocusable: boolean;
  edgesFocusable: boolean;
  edgesReconnectable: boolean;
  elementsSelectable: boolean;
  selectNodesOnDrag: boolean;
  elevateNodesOnSelect: boolean;
  elevateEdgesOnSelect: boolean;
  zIndexMode: ZIndexMode;
  connectionMode: ConnectionMode;
  connectionRadius: number;
  connectionDragThreshold: number;
  nodeDragThreshold: number;
  autoPanOnConnect: boolean;
  autoPanOnNodeDrag: boolean;
  autoPanSpeed: number;
  onlyRenderVisibleElements: boolean;
  /** Whether every batch of changes that is told is also written to the console. */
  debug: boolean;
  /** Extra z-index a selected node gets when `elevateNodesOnSelect` is on. */
  selectedNodeZ: number;
}

const INFINITE_EXTENT: CoordinateExtent = [
  [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY],
  [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY],
];

const DEFAULT_MIN_ZOOM = 0.5;
const DEFAULT_MAX_ZOOM = 2;
const DEFAULT_SNAP_STEP = 15;
const DEFAULT_CONNECTION_RADIUS = 20;
const DEFAULT_AUTO_PAN_SPEED = 15;
const DEFAULT_SELECTED_NODE_Z = 1000;

export const DEFAULT_CONFIG: FlowConfig = {
  minZoom: DEFAULT_MIN_ZOOM,
  maxZoom: DEFAULT_MAX_ZOOM,
  translateExtent: INFINITE_EXTENT,
  nodeExtent: INFINITE_EXTENT,
  nodeOrigin: [0, 0],
  snapToGrid: false,
  snapGrid: [DEFAULT_SNAP_STEP, DEFAULT_SNAP_STEP],
  nodesDraggable: true,
  nodesConnectable: true,
  nodesFocusable: true,
  edgesFocusable: true,
  edgesReconnectable: true,
  elementsSelectable: true,
  selectNodesOnDrag: true,
  elevateNodesOnSelect: true,
  zIndexMode: "basic",
  elevateEdgesOnSelect: false,
  connectionMode: ConnectionMode.Strict,
  connectionRadius: DEFAULT_CONNECTION_RADIUS,
  connectionDragThreshold: 1,
  nodeDragThreshold: 1,
  autoPanOnConnect: true,
  autoPanOnNodeDrag: true,
  autoPanSpeed: DEFAULT_AUTO_PAN_SPEED,
  onlyRenderVisibleElements: false,
  debug: false,
  selectedNodeZ: DEFAULT_SELECTED_NODE_Z,
};

/** What `onBeforeDelete` answers: `false` cancels, `true` deletes all, or the narrowed-down elements. */
export type DeleteVerdict<TNode extends NodeBase, TEdge extends EdgeBase> =
  | boolean
  | { nodes: TNode[]; edges: TEdge[] };

export interface FlowCallbacks<
  TNode extends NodeBase = NodeBase,
  TEdge extends EdgeBase = EdgeBase,
> {
  onNodesChange?: ((changes: NodeChange<TNode>[]) => void) | undefined;
  onEdgesChange?: ((changes: EdgeChange<TEdge>[]) => void) | undefined;
  onConnect?: ((connection: Connection) => void) | undefined;
  onNodesDelete?: ((nodes: TNode[]) => void) | undefined;
  onEdgesDelete?: ((edges: TEdge[]) => void) | undefined;
  onDelete?: ((elements: { nodes: TNode[]; edges: TEdge[] }) => void) | undefined;
  onBeforeDelete?:
    | ((elements: {
        nodes: TNode[];
        edges: TEdge[];
      }) => Promise<DeleteVerdict<TNode, TEdge>> | DeleteVerdict<TNode, TEdge>)
    | undefined;
  onViewportChange?: ((viewport: Viewport) => void) | undefined;
  isValidConnection?: ((connection: Connection | TEdge) => boolean) | undefined;
}

/** Everything the store holds. Config and callbacks are part of it so interactions can read them. */
export interface FlowState<TNode extends NodeBase = NodeBase, TEdge extends EdgeBase = EdgeBase>
  extends FlowConfig, FlowCallbacks<TNode, TEdge> {
  nodes: TNode[];
  edges: TEdge[];
  nodeLookup: Map<string, InternalNode<TNode>>;
  parentLookup: Map<string, Map<string, InternalNode<TNode>>>;
  edgeLookup: Map<string, TEdge>;
  /** `nodeId`, `nodeId-type` and `nodeId-type-handleId` keys, each mapping edge id to connection. */
  connectionLookup: Map<string, Map<string, NodeConnection>>;
  /** Controlled flows leave `nodes` to the owner; uncontrolled ones apply changes themselves. */
  hasDefaultNodes: boolean;
  hasDefaultEdges: boolean;
  /** Run in order on every batch of node (edge) changes before it is applied and reported. */
  onNodesChangeMiddlewareMap: MiddlewareMap<NodeChange<TNode>>;
  onEdgesChangeMiddlewareMap: MiddlewareMap<EdgeChange<TEdge>>;
  viewport: Viewport;
  /** Whether the owner holds the viewport (the `viewport` prop): a pan or zoom is only reported. */
  viewportControlled: boolean;
  /**
   * While the owner holds the viewport: where the user has moved it to, which the owner has not
   * handed back yet (what React Flow keeps in d3). The next gesture goes on from here, and
   * `viewport` (what is drawn) is only set by the owner. `undefined` otherwise.
   */
  pendingViewport: Viewport | undefined;
  width: number;
  height: number;
  /** Whether every node has been measured at least once. */
  nodesInitialized: boolean;
  /** A fit was asked for before there was anything to fit; it runs as soon as there is. */
  fitViewQueued: boolean;
  fitViewOptions: FitViewOptions | undefined;
  /** What runs a queued fit (the fit itself by default); a binding that animates sets it. */
  runQueuedFit: ((options: FitViewOptions | undefined) => void) | undefined;
  connection: ConnectionState;
  connectionClickStartHandle: ClickConnectionStart | null;
  multiSelectionActive: boolean;
  userSelectionActive: boolean;
  userSelectionRect: SelectionRect | null;
  nodesSelectionActive: boolean;
  /** The latest message for screen readers, announced through an `aria-live` region. */
  ariaLiveMessage: string;
}

export function createInitialState<TNode extends NodeBase, TEdge extends EdgeBase>(): FlowState<
  TNode,
  TEdge
> {
  return {
    ...DEFAULT_CONFIG,
    nodes: [],
    edges: [],
    nodeLookup: new Map(),
    parentLookup: new Map(),
    edgeLookup: new Map(),
    connectionLookup: new Map(),
    hasDefaultNodes: false,
    hasDefaultEdges: false,
    onNodesChangeMiddlewareMap: new Map(),
    onEdgesChangeMiddlewareMap: new Map(),
    viewport: { x: 0, y: 0, zoom: 1 },
    viewportControlled: false,
    pendingViewport: undefined,
    width: 0,
    height: 0,
    nodesInitialized: false,
    fitViewQueued: false,
    fitViewOptions: undefined,
    runQueuedFit: undefined,
    connection: NO_CONNECTION,
    connectionClickStartHandle: null,
    multiSelectionActive: false,
    userSelectionActive: false,
    userSelectionRect: null,
    nodesSelectionActive: false,
    ariaLiveMessage: "",
  };
}
