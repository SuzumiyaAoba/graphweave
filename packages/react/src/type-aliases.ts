import type {
  ControlPosition,
  CoordinateExtent,
  FlowActions,
  InternalNode,
  NodeConnection,
  Position,
  SelectionToClear,
  XYPosition,
} from "@free-flow/core";

import type {
  DeleteElementsParams,
  FlowObject,
  ReactFlowInstance,
  ViewportHelperOptions,
} from "./instance-types.ts";
import type { MiniMapProps } from "./minimap.tsx";
import type { NodeResizeControlProps } from "./node-resize-control.tsx";
import type { PanZoomInstance } from "./pan-zoom-adapter.ts";
import type {
  EdgeMouseHandler,
  NodeMouseHandler,
  OnError,
  OnReconnect,
  OnReconnectEnd,
  OnReconnectStart,
} from "./react-flow-props.ts";
import type {
  BezierPathOptions,
  Edge,
  EdgeLabelOptions,
  EdgeProps,
  EdgeTypes,
  Node,
  NodeTypes,
  SmoothStepPathOptions,
} from "./types.ts";
import type { ViewMirror } from "./view-mirror.ts";

// Names that React Flow gives to types Free-Flow has too, under another name or written inline.

export type Align = "center" | "start" | "end";
export type ColorModeClass = "light" | "dark";
export type ControlLinePosition = Extract<ControlPosition, "top" | "bottom" | "left" | "right">;
export type XYZPosition = XYPosition & { z: number };

export type HandleConnection = NodeConnection;
export type ReactFlowJsonObject<TNode extends Node = Node, TEdge extends Edge = Edge> = FlowObject<
  TNode,
  TEdge
>;
export type DeleteElementsOptions = DeleteElementsParams;
export type UnselectNodesAndEdgesParams = SelectionToClear;
export type ViewportHelperFunctionOptions = ViewportHelperOptions;

export type FitView<TNode extends Node = Node> = ReactFlowInstance<TNode>["fitView"];
export type FitBounds = ReactFlowInstance["fitBounds"];
export type SetCenter = ReactFlowInstance["setCenter"];
export type SetViewport = ReactFlowInstance["setViewport"];
export type ViewportHelperFunctions = Pick<
  ReactFlowInstance,
  | "zoomIn"
  | "zoomOut"
  | "zoomTo"
  | "getZoom"
  | "setViewport"
  | "getViewport"
  | "setCenter"
  | "fitBounds"
  | "screenToFlowPosition"
  | "flowToScreenPosition"
>;
export type GeneralHelpers = Omit<
  ReactFlowInstance,
  keyof ViewportHelperFunctions | "viewportInitialized"
>;

export type GetMiniMapNodeAttribute<TNode extends Node = Node> = (node: TNode) => string;
export type MiniMapNodes = Pick<
  MiniMapProps,
  | "nodeColor"
  | "nodeStrokeColor"
  | "nodeClassName"
  | "nodeBorderRadius"
  | "nodeStrokeWidth"
  | "nodeComponent"
> & {
  onClick?: (event: MouseEvent, nodeId: string) => void;
};

export type ResizeControlProps = NodeResizeControlProps;
export type ResizeControlLineProps = Omit<ResizeControlProps, "resizeDirection"> & {
  position?: ControlLinePosition;
};

export type BuiltInNode =
  | Node<{ label: string }, "input" | "output" | "default">
  | Node<Record<string, never>, "group">;
export type BuiltInEdge = Edge<
  Record<string, unknown>,
  "smoothstep" | "default" | "step" | "straight" | undefined
>;

/** Where the two ends of an edge are, and which way the handles there face. */
interface EdgePosition {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourcePosition: Position;
  targetPosition: Position;
}

/** What the built-in edge components take: an edge's position, its label, and a few of its options. */
export type EdgeComponentProps = EdgePosition &
  EdgeLabelOptions & {
    id?: EdgeProps["id"];
    markerStart?: EdgeProps["markerStart"];
    markerEnd?: EdgeProps["markerEnd"];
    interactionWidth?: EdgeProps["interactionWidth"];
    style?: EdgeProps["style"];
    sourceHandleId?: EdgeProps["sourceHandleId"];
    targetHandleId?: EdgeProps["targetHandleId"];
  };
export type EdgeComponentWithPathOptions<PathOptions> = EdgeComponentProps & {
  pathOptions?: PathOptions | undefined;
};
type StepPathOptions = Pick<SmoothStepPathOptions, "offset" | "stepPosition">;
export type BezierEdgeProps = EdgeComponentWithPathOptions<BezierPathOptions>;
export type SmoothStepEdgeProps = EdgeComponentWithPathOptions<SmoothStepPathOptions>;
export type StepEdgeProps = EdgeComponentWithPathOptions<StepPathOptions>;
export type StraightEdgeProps = Omit<EdgeComponentProps, "sourcePosition" | "targetPosition">;
export type SimpleBezierEdgeProps = EdgeComponentProps;

/**
 * The props of the piece that draws a node, as React Flow names them. Free-Flow's own piece reads
 * the same things from the store, and takes only the `id`; the rest is accepted and left to it.
 */
export interface NodeWrapperProps {
  id: string;
  nodesConnectable?: boolean;
  elementsSelectable?: boolean;
  nodesDraggable?: boolean;
  nodesFocusable?: boolean;
  onClick?: NodeMouseHandler;
  onDoubleClick?: NodeMouseHandler;
  onMouseEnter?: NodeMouseHandler;
  onMouseMove?: NodeMouseHandler;
  onMouseLeave?: NodeMouseHandler;
  onContextMenu?: NodeMouseHandler;
  resizeObserver?: ResizeObserver | null;
  noDragClassName?: string;
  noPanClassName?: string;
  rfId?: string;
  disableKeyboardA11y?: boolean;
  nodeTypes?: NodeTypes;
  nodeExtent?: CoordinateExtent;
  onError?: OnError;
  nodeClickDistance?: number;
}

/** The props of the piece that draws an edge, as React Flow names them (see `NodeWrapperProps`). */
export interface EdgeWrapperProps {
  id: string;
  edgesFocusable?: boolean;
  edgesReconnectable?: boolean;
  elementsSelectable?: boolean;
  noPanClassName?: string;
  onClick?: EdgeMouseHandler;
  onDoubleClick?: EdgeMouseHandler;
  onReconnect?: OnReconnect;
  onContextMenu?: EdgeMouseHandler;
  onMouseEnter?: EdgeMouseHandler;
  onMouseMove?: EdgeMouseHandler;
  onMouseLeave?: EdgeMouseHandler;
  reconnectRadius?: number;
  onReconnectStart?: OnReconnectStart;
  onReconnectEnd?: OnReconnectEnd;
  rfId?: string;
  edgeTypes?: EdgeTypes;
  onError?: OnError;
  disableKeyboardA11y?: boolean;
}

/** The actions of React Flow's store, which Free-Flow's store has, with the same names. */
export type ReactFlowActions = Pick<
  FlowActions,
  | "setNodes"
  | "setEdges"
  | "setDefaultNodesAndEdges"
  | "updateNodePositions"
  | "resetSelectedElements"
  | "unselectNodesAndEdges"
  | "addSelectedNodes"
  | "addSelectedEdges"
  | "setMinZoom"
  | "setMaxZoom"
  | "setTranslateExtent"
  | "setNodeExtent"
  | "cancelConnection"
  | "updateConnection"
  | "reset"
  | "triggerNodeChanges"
  | "triggerEdgeChanges"
  | "panBy"
  | "setCenter"
> &
  Pick<ViewMirror, "updateNodeInternals">;

/** What fitting the nodes into a canvas takes: the nodes, the canvas and the limits of the zoom. */
export interface FitViewParams {
  nodes: ReadonlyMap<string, InternalNode>;
  width: number;
  height: number;
  panZoom: PanZoomInstance;
  minZoom: number;
  maxZoom: number;
}
