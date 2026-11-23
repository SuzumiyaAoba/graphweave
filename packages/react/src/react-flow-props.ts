import type {
  Connection,
  ConnectionLineType,
  ConnectionMode,
  ConnectionState,
  CoordinateExtent,
  FitViewOptions,
  InternalNode,
  KeyCode,
  NodeOrigin,
  PanOnScrollMode,
  SelectionMode,
  SnapGrid,
  Viewport,
  WithUndefined,
  XYPosition,
  ZIndexMode,
} from "@free-flow/core";
import type {
  ComponentType,
  CSSProperties,
  HTMLAttributes,
  MouseEvent as ReactMouseEvent,
  ReactNode,
  Ref,
} from "react";

import type { AriaLabelConfig } from "./aria-label-config.ts";
import type {
  EdgeMouseHandler,
  NodeMouseHandler,
  OnConnect,
  OnConnectEnd,
  OnConnectStart,
  OnDelete,
  OnEdgesChange,
  OnEdgesDelete,
  OnError,
  OnInit,
  OnMove,
  OnMoveEnd,
  OnMoveStart,
  OnNodeDrag,
  OnNodesChange,
  OnNodesDelete,
  OnReconnect,
  OnReconnectEnd,
  OnReconnectStart,
  OnSelectionChange,
  OnSelectionDrag,
  SelectionContextMenuHandler,
} from "./flow-handlers.ts";
import type { Edge, EdgeTypes, Node, NodeTypes, PanelPosition } from "./types.ts";

export type {
  EdgeMouseHandler,
  NodeMouseHandler,
  OnConnect,
  OnConnectEnd,
  OnConnectStart,
  OnConnectStartParams,
  OnDelete,
  OnEdgesChange,
  OnEdgesDelete,
  OnError,
  OnInit,
  OnMove,
  OnMoveEnd,
  OnMoveStart,
  OnNodeDrag,
  OnNodesChange,
  OnNodesDelete,
  OnReconnect,
  OnReconnectEnd,
  OnReconnectStart,
  OnSelectionChange,
  OnSelectionChangeFunc,
  OnSelectionChangeParams,
  OnSelectionDrag,
  SelectionContextMenuHandler,
  SelectionDragHandler,
} from "./flow-handlers.ts";

/** What every edge gets before its own options: all of an edge's options but where it goes. */
export type DefaultEdgeOptions = Omit<
  Edge,
  "id" | "source" | "target" | "sourceHandle" | "targetHandle" | "selected"
>;
export type OnBeforeDelete<TNode extends Node = Node, TEdge extends Edge = Edge> = (elements: {
  nodes: TNode[];
  edges: TEdge[];
}) =>
  | Promise<boolean | { nodes: TNode[]; edges: TEdge[] }>
  | boolean
  | { nodes: TNode[]; edges: TEdge[] };
export type IsValidConnection<TEdge extends Edge = Edge> = (
  connection: Connection | TEdge,
) => boolean;

export interface ConnectionLineComponentProps<TNode extends Node = Node> {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  fromPosition: string;
  toPosition: string;
  connectionLineType: ConnectionLineType;
  connectionLineStyle?: CSSProperties | undefined;
  connectionStatus: "valid" | "invalid" | null;
  fromNode: InternalNode<TNode>;
  /** As in React Flow, always there while a connection line is drawn. */
  fromHandle: NonNullable<ConnectionState["fromHandle"]>;
  toNode: InternalNode<TNode> | null;
  toHandle: ConnectionState["toHandle"];
  /** Where the pointer is, in pixels from the top left of the canvas. */
  pointer: XYPosition;
}

export type ConnectionLineComponent<TNode extends Node = Node> = ComponentType<
  ConnectionLineComponentProps<TNode>
>;

export type PanOnDrag = boolean | readonly number[];

export type ColorMode = "light" | "dark" | "system";

export interface ProOptions {
  account?: string | undefined;
  /** Accepted for compatibility: Free-Flow draws no attribution, so there is nothing to hide. */
  hideAttribution?: boolean | undefined;
}

/** Everything `<ReactFlow>` accepts besides the HTML attributes of its container. */
export interface ReactFlowOptions<TNode extends Node = Node, TEdge extends Edge = Edge> {
  nodes: TNode[];
  edges: TEdge[];
  defaultNodes: TNode[];
  defaultEdges: TEdge[];
  nodeTypes: NodeTypes;
  edgeTypes: EdgeTypes;
  defaultEdgeOptions: DefaultEdgeOptions;

  onNodesChange: OnNodesChange<TNode>;
  onEdgesChange: OnEdgesChange<TEdge>;
  onConnect: OnConnect;
  onConnectStart: OnConnectStart;
  onConnectEnd: OnConnectEnd;
  onClickConnectStart: OnConnectStart;
  onClickConnectEnd: OnConnectEnd;
  isValidConnection: IsValidConnection<TEdge>;
  onNodeClick: NodeMouseHandler<TNode>;
  onNodeDoubleClick: NodeMouseHandler<TNode>;
  onNodeMouseEnter: NodeMouseHandler<TNode>;
  onNodeMouseMove: NodeMouseHandler<TNode>;
  onNodeMouseLeave: NodeMouseHandler<TNode>;
  onNodeContextMenu: NodeMouseHandler<TNode>;
  onNodeDragStart: OnNodeDrag<TNode>;
  onNodeDrag: OnNodeDrag<TNode>;
  onNodeDragStop: OnNodeDrag<TNode>;
  onEdgeClick: EdgeMouseHandler<TEdge>;
  onEdgeDoubleClick: EdgeMouseHandler<TEdge>;
  onEdgeContextMenu: EdgeMouseHandler<TEdge>;
  onEdgeMouseEnter: EdgeMouseHandler<TEdge>;
  onEdgeMouseMove: EdgeMouseHandler<TEdge>;
  onEdgeMouseLeave: EdgeMouseHandler<TEdge>;
  onReconnect: OnReconnect<TEdge>;
  onReconnectStart: OnReconnectStart<TEdge>;
  onReconnectEnd: OnReconnectEnd<TEdge>;
  onSelectionChange: OnSelectionChange<TNode, TEdge>;
  onSelectionDragStart: OnSelectionDrag<TNode>;
  onSelectionDrag: OnSelectionDrag<TNode>;
  onSelectionDragStop: OnSelectionDrag<TNode>;
  onSelectionContextMenu: SelectionContextMenuHandler<TNode>;
  onSelectionStart: (event: ReactMouseEvent) => void;
  onSelectionEnd: (event: ReactMouseEvent) => void;
  onPaneClick: (event: ReactMouseEvent) => void;
  onPaneContextMenu: (event: ReactMouseEvent | MouseEvent) => void;
  onPaneScroll: (event?: WheelEvent) => void;
  onPaneMouseMove: (event: ReactMouseEvent) => void;
  onPaneMouseEnter: (event: ReactMouseEvent) => void;
  onPaneMouseLeave: (event: ReactMouseEvent) => void;
  onMove: OnMove;
  onMoveStart: OnMoveStart;
  onMoveEnd: OnMoveEnd;
  onViewportChange: (viewport: Viewport) => void;
  onInit: OnInit<TNode, TEdge>;
  onDelete: OnDelete<TNode, TEdge>;
  onNodesDelete: OnNodesDelete<TNode>;
  onEdgesDelete: OnEdgesDelete<TEdge>;
  onBeforeDelete: OnBeforeDelete<TNode, TEdge>;
  onError: OnError;

  connectionMode: ConnectionMode;
  connectionLineType: ConnectionLineType;
  connectionLineStyle: CSSProperties;
  connectionLineComponent: ConnectionLineComponent<TNode>;
  connectionLineContainerStyle: CSSProperties;
  connectionRadius: number;
  connectOnClick: boolean;
  selectionKeyCode: KeyCode | null;
  multiSelectionKeyCode: KeyCode | null;
  deleteKeyCode: KeyCode | null;
  panActivationKeyCode: KeyCode | null;
  zoomActivationKeyCode: KeyCode | null;
  fitView: boolean;
  fitViewOptions: FitViewOptions;
  minZoom: number;
  maxZoom: number;
  defaultViewport: Viewport;
  viewport: Viewport;
  snapToGrid: boolean;
  snapGrid: SnapGrid;
  defaultMarkerColor: string | null;
  nodesDraggable: boolean;
  nodesConnectable: boolean;
  nodesFocusable: boolean;
  edgesFocusable: boolean;
  edgesReconnectable: boolean;
  elementsSelectable: boolean;
  autoPanOnConnect: boolean;
  autoPanOnNodeDrag: boolean;
  /** Scrolls the canvas while a selection box is drawn and the pointer is near its edge. */
  autoPanOnSelection: boolean;
  /** Centres the viewport on a node that is out of view when the keyboard focuses it. */
  autoPanOnNodeFocus: boolean;
  /** Accepted for compatibility: Free-Flow draws no attribution, so there is nothing to place. */
  attributionPosition: PanelPosition;
  autoPanSpeed: number;
  selectNodesOnDrag: boolean;
  panOnDrag: PanOnDrag;
  panOnScroll: boolean;
  panOnScrollSpeed: number;
  panOnScrollMode: PanOnScrollMode;
  zoomOnScroll: boolean;
  zoomOnPinch: boolean;
  zoomOnDoubleClick: boolean;
  selectionOnDrag: boolean;
  selectionMode: SelectionMode;
  preventScrolling: boolean;
  paneClickDistance: number;
  nodeClickDistance: number;
  nodeDragThreshold: number;
  connectionDragThreshold: number;
  nodeExtent: CoordinateExtent;
  translateExtent: CoordinateExtent;
  nodeOrigin: NodeOrigin;
  elevateNodesOnSelect: boolean;
  elevateEdgesOnSelect: boolean;
  zIndexMode: ZIndexMode;
  onlyRenderVisibleElements: boolean;
  disableKeyboardA11y: boolean;
  noDragClassName: string;
  noWheelClassName: string;
  noPanClassName: string;
  rfId: string;
  ariaLabelConfig: Partial<AriaLabelConfig>;
  colorMode: ColorMode;
  proOptions: ProOptions;
  /** Logs every batch of node and edge changes to the console. */
  debug: boolean;
  width: number;
  height: number;
  reconnectRadius: number;
}

export type ReactFlowProps<TNode extends Node = Node, TEdge extends Edge = Edge> = WithUndefined<
  ReactFlowOptions<TNode, TEdge>
> &
  Omit<HTMLAttributes<HTMLDivElement>, keyof ReactFlowOptions | "onError" | "children"> & {
    children?: ReactNode;
    /** As in React Flow, the element that wraps the flow. */
    ref?: Ref<HTMLDivElement> | undefined;
  };
