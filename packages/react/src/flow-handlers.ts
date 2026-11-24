import type {
  Connection,
  EdgeChange,
  FinalConnectionState,
  HandleType,
  NodeChange,
  Viewport,
} from "@graphweave/core";
import type { MouseEvent as ReactMouseEvent } from "react";

import type { ReactFlowInstance } from "./instance-types.ts";
import type { Edge, Node } from "./types.ts";
import type { SelectionChange } from "./use-events.ts";

// The callbacks of a flow, with the node and edge types of the app (React Flow's own defaults).
export type NodeMouseHandler<TNode extends Node = Node> = (
  event: ReactMouseEvent,
  node: TNode,
) => void;
export type EdgeMouseHandler<TEdge extends Edge = Edge> = (
  event: ReactMouseEvent,
  edge: TEdge,
) => void;
export type OnNodeDrag<TNode extends Node = Node> = (
  event: ReactMouseEvent,
  node: TNode,
  nodes: TNode[],
) => void;
export type OnSelectionDrag<TNode extends Node = Node> = (
  event: ReactMouseEvent,
  nodes: TNode[],
) => void;
export type SelectionContextMenuHandler<TNode extends Node = Node> = (
  event: ReactMouseEvent,
  nodes: TNode[],
) => void;

export interface OnConnectStartParams {
  nodeId: string | null;
  handleId: string | null;
  handleType: HandleType | null;
}

export type OnConnect = (connection: Connection) => void;
export type OnConnectStart = (
  event: MouseEvent | TouchEvent | PointerEvent,
  params: OnConnectStartParams,
) => void;
export type OnConnectEnd = (
  event: MouseEvent | TouchEvent | PointerEvent,
  connectionState: FinalConnectionState,
) => void;
export type OnMove = (event: MouseEvent | TouchEvent | null, viewport: Viewport) => void;
export type OnReconnect<TEdge extends Edge = Edge> = (
  oldEdge: TEdge,
  newConnection: Connection,
) => void;
export type OnReconnectStart<TEdge extends Edge = Edge> = (
  event: ReactMouseEvent,
  edge: TEdge,
  handleType: HandleType,
) => void;
// oxlint-disable-next-line eslint/max-params -- React Flow's own callback signature
export type OnReconnectEnd<TEdge extends Edge = Edge> = (
  event: MouseEvent | TouchEvent | PointerEvent,
  edge: TEdge,
  handleType: HandleType,
  connectionState: FinalConnectionState,
) => void;
export type OnError = (id: string, message: string) => void;
export type OnInit<TNode extends Node = Node, TEdge extends Edge = Edge> = (
  instance: ReactFlowInstance<TNode, TEdge>,
) => void;
export type OnSelectionChange<TNode extends Node = Node, TEdge extends Edge = Edge> = (
  selection: SelectionChange<TNode, TEdge>,
) => void;
export type OnSelectionChangeFunc<
  TNode extends Node = Node,
  TEdge extends Edge = Edge,
> = OnSelectionChange<TNode, TEdge>;
export type OnSelectionChangeParams<
  TNode extends Node = Node,
  TEdge extends Edge = Edge,
> = SelectionChange<TNode, TEdge>;
export type OnNodesChange<TNode extends Node = Node> = (changes: NodeChange<TNode>[]) => void;
export type OnEdgesChange<TEdge extends Edge = Edge> = (changes: EdgeChange<TEdge>[]) => void;
export type OnDelete<TNode extends Node = Node, TEdge extends Edge = Edge> = (elements: {
  nodes: TNode[];
  edges: TEdge[];
}) => void;
export type OnNodesDelete<TNode extends Node = Node> = (nodes: TNode[]) => void;
export type OnEdgesDelete<TEdge extends Edge = Edge> = (edges: TEdge[]) => void;
export type OnMoveStart = OnMove;
export type OnMoveEnd = OnMove;
export type SelectionDragHandler<TNode extends Node = Node> = OnSelectionDrag<TNode>;
