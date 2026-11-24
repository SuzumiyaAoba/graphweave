import type { EdgeBase, EdgeData, NodeBase, NodeData, Position } from "@graphweave/core";
import type {
  ComponentType,
  CSSProperties,
  DOMAttributes,
  HTMLAttributes,
  ReactNode,
  SVGAttributes,
} from "react";

/** A node. `type` picks the component in `nodeTypes`; `data` is yours. */
export interface Node<
  TData extends NodeData = NodeData,
  TType extends string = string,
> extends NodeBase<TData, TType> {
  style?: CSSProperties;
  className?: string;
  ariaRole?: string;
  /** General escape hatch for adding custom attributes to the node's DOM element. */
  domAttributes?: Omit<
    HTMLAttributes<HTMLDivElement>,
    | "id"
    | "style"
    | "className"
    | "draggable"
    | "role"
    | "aria-label"
    | "defaultValue"
    | "dangerouslySetInnerHTML"
    | keyof DOMAttributes<HTMLDivElement>
  >;
}

export interface EdgeLabelOptions {
  label?: ReactNode | undefined;
  labelStyle?: CSSProperties | undefined;
  labelShowBg?: boolean | undefined;
  labelBgStyle?: CSSProperties | undefined;
  labelBgPadding?: [number, number] | undefined;
  labelBgBorderRadius?: number | undefined;
}

export interface BezierPathOptions {
  curvature?: number | undefined;
}

export interface SmoothStepPathOptions {
  borderRadius?: number | undefined;
  offset?: number | undefined;
  stepPosition?: number | undefined;
}

export type EdgePathOptions = BezierPathOptions & SmoothStepPathOptions;

/** An edge between two nodes, optionally between particular handles. */
export interface Edge<
  TData extends EdgeData = EdgeData,
  TType extends string | undefined = string | undefined,
>
  extends EdgeBase<TData, TType>, EdgeLabelOptions {
  style?: CSSProperties;
  className?: string;
  pathOptions?: EdgePathOptions;
  ariaRole?: string;
  /** General escape hatch for adding custom attributes to the edge's DOM element. */
  domAttributes?: Omit<
    SVGAttributes<SVGGElement>,
    "id" | "style" | "className" | "role" | "aria-label" | "dangerouslySetInnerHTML"
  >;
}

/** What a custom node component receives. */
export interface NodeProps<TNode extends Node = Node> {
  id: TNode["id"];
  data: TNode["data"];
  type: string;
  selected: boolean;
  dragging: boolean;
  draggable: boolean;
  selectable: boolean;
  deletable: boolean;
  isConnectable: boolean;
  zIndex: number;
  positionAbsoluteX: number;
  positionAbsoluteY: number;
  width?: number | undefined;
  height?: number | undefined;
  sourcePosition?: Position | undefined;
  targetPosition?: Position | undefined;
  dragHandle?: string | undefined;
  parentId?: string | undefined;
}

/** What a custom edge component receives. */
export interface EdgeProps<TEdge extends Edge = Edge> extends EdgeLabelOptions {
  id: TEdge["id"];
  type: string;
  source: string;
  target: string;
  sourceHandleId?: string | null | undefined;
  targetHandleId?: string | null | undefined;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourcePosition: Position;
  targetPosition: Position;
  /** As the owner wrote them on the edge, so `undefined` when they said nothing, as in React Flow. */
  selected?: boolean | undefined;
  animated?: boolean | undefined;
  selectable: boolean;
  deletable: boolean;
  data?: TEdge["data"] | undefined;
  style?: CSSProperties | undefined;
  markerStart?: string | undefined;
  markerEnd?: string | undefined;
  interactionWidth?: number | undefined;
  pathOptions?: EdgePathOptions | undefined;
}

export type NodeTypes = Record<string, ComponentType<NodeProps<never>>>;
export type EdgeTypes = Record<string, ComponentType<EdgeProps<never>>>;

export type PanelPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right"
  | "center-left"
  | "center-right";
