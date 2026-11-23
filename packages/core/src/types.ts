// Enum-like constants are plain objects because `erasableSyntaxOnly` forbids `enum`.

export const Position = {
  Left: "left",
  Top: "top",
  Right: "right",
  Bottom: "bottom",
} as const;
export type Position = (typeof Position)[keyof typeof Position];

export const MarkerType = {
  Arrow: "arrow",
  ArrowClosed: "arrowclosed",
} as const;
export type MarkerType = (typeof MarkerType)[keyof typeof MarkerType];

export const ConnectionMode = {
  Strict: "strict",
  Loose: "loose",
} as const;
export type ConnectionMode = (typeof ConnectionMode)[keyof typeof ConnectionMode];

export const ConnectionLineType = {
  Bezier: "default",
  Straight: "straight",
  Step: "step",
  SmoothStep: "smoothstep",
  SimpleBezier: "simplebezier",
} as const;
export type ConnectionLineType = (typeof ConnectionLineType)[keyof typeof ConnectionLineType];

export const PanOnScrollMode = {
  Free: "free",
  Vertical: "vertical",
  Horizontal: "horizontal",
} as const;
export type PanOnScrollMode = (typeof PanOnScrollMode)[keyof typeof PanOnScrollMode];

export const SelectionMode = {
  Partial: "partial",
  Full: "full",
} as const;
export type SelectionMode = (typeof SelectionMode)[keyof typeof SelectionMode];

export const ResizeControlVariant = {
  Handle: "handle",
  Line: "line",
} as const;
export type ResizeControlVariant = (typeof ResizeControlVariant)[keyof typeof ResizeControlVariant];

export type HandleType = "source" | "target";

export interface XYPosition {
  readonly x: number;
  readonly y: number;
}

export interface Dimensions {
  readonly width: number;
  readonly height: number;
}

/** Top-left and bottom-right corners, `[[minX, minY], [maxX, maxY]]`. */
export type CoordinateExtent = readonly [readonly [number, number], readonly [number, number]];

/** Where the node's `position` sits inside the node: `[0, 0]` is the top-left, `[0.5, 0.5]` the centre. */
export type NodeOrigin = readonly [number, number];

export type SnapGrid = readonly [number, number];

/** A `Rect` expressed by its two corners instead of an origin and a size. */
export interface Box {
  readonly x: number;
  readonly y: number;
  readonly x2: number;
  readonly y2: number;
}

export interface NodeHandle {
  readonly id?: string | null;
  readonly x: number;
  readonly y: number;
  readonly position: Position;
  readonly type: HandleType;
  readonly width?: number;
  readonly height?: number;
}

export type NodeData = Record<string, unknown>;

export interface NodeBase<Data extends NodeData = NodeData, Type extends string = string> {
  id: string;
  position: XYPosition;
  data: Data;
  type?: Type;
  sourcePosition?: Position;
  targetPosition?: Position;
  hidden?: boolean;
  selected?: boolean;
  dragging?: boolean;
  resizing?: boolean;
  draggable?: boolean;
  selectable?: boolean;
  connectable?: boolean;
  deletable?: boolean;
  focusable?: boolean;
  dragHandle?: string;
  width?: number;
  height?: number;
  initialWidth?: number;
  initialHeight?: number;
  /** Size measured from the rendered node; this is what layout and hit-testing use. */
  measured?: { width?: number; height?: number };
  parentId?: string;
  zIndex?: number;
  extent?: "parent" | CoordinateExtent;
  expandParent?: boolean;
  ariaLabel?: string;
  origin?: NodeOrigin;
  handles?: NodeHandle[];
}

export interface EdgeMarker {
  type: MarkerType;
  color?: string | null;
  width?: number;
  height?: number;
  markerUnits?: string;
  orient?: string;
  strokeWidth?: number;
}

export type EdgeMarkerType = string | EdgeMarker;

export type EdgeData = Record<string, unknown>;

export interface EdgeBase<
  Data extends EdgeData = EdgeData,
  Type extends string | undefined = string | undefined,
> {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  type?: Type;
  data?: Data;
  animated?: boolean;
  hidden?: boolean;
  selected?: boolean;
  deletable?: boolean;
  selectable?: boolean;
  focusable?: boolean;
  reconnectable?: boolean | HandleType;
  markerStart?: EdgeMarkerType;
  markerEnd?: EdgeMarkerType;
  zIndex?: number;
  ariaLabel?: string | null;
  interactionWidth?: number;
}

export interface Connection {
  source: string;
  target: string;
  sourceHandle: string | null;
  targetHandle: string | null;
}

export interface NodeConnection extends Connection {
  edgeId: string;
}

export type Transform = readonly [number, number, number];

/** Pan/zoom are bounded to this when set. */
export interface ViewportConstraints {
  minZoom: number;
  maxZoom: number;
  translateExtent: CoordinateExtent;
}

/** One amount of room: a share of the canvas (`0.1`), pixels (`"10px"`) or a percentage (`"5%"`). */
export type PaddingValue = number | `${number}px` | `${number}%`;

/** The room around what is framed: the same all round, or per side (`x` and `y` set two sides each). */
export type Padding =
  | PaddingValue
  | {
      top?: PaddingValue | undefined;
      right?: PaddingValue | undefined;
      bottom?: PaddingValue | undefined;
      left?: PaddingValue | undefined;
      x?: PaddingValue | undefined;
      y?: PaddingValue | undefined;
    };

/** The path an animated move of the viewport takes: along a smooth zoom path, or straight. */
export type ViewportInterpolation = "smooth" | "linear";

export interface FitBoundsOptions {
  padding?: Padding | undefined;
  duration?: number | undefined;
  /** Maps how far the animation is (0 to 1) to how far it has come; slow at both ends by default. */
  ease?: ((progress: number) => number) | undefined;
  interpolate?: ViewportInterpolation | undefined;
}

export interface FitViewOptions<TNode extends NodeBase = NodeBase> extends FitBoundsOptions {
  minZoom?: number | undefined;
  maxZoom?: number | undefined;
  /** Restrict the fit to these nodes (the app's own, or just ids); all visible nodes when omitted. */
  nodes?: readonly (TNode | { id: string })[] | undefined;
  includeHiddenNodes?: boolean | undefined;
}

// Changes: what a UI interaction reports so the owner of the state can apply it.

export interface NodeDimensionChange {
  id: string;
  type: "dimensions";
  dimensions?: Dimensions;
  resizing?: boolean;
  /** When set, the dimensions are also written to `width`/`height` (a user-driven resize). */
  setAttributes?: boolean | "width" | "height";
}

export interface NodePositionChange {
  id: string;
  type: "position";
  position?: XYPosition;
  positionAbsolute?: XYPosition;
  dragging?: boolean;
}

export interface NodeSelectionChange {
  id: string;
  type: "select";
  selected: boolean;
}

export interface NodeRemoveChange {
  id: string;
  type: "remove";
}

export interface NodeAddChange<TNode extends NodeBase = NodeBase> {
  item: TNode;
  type: "add";
  index?: number;
}

export interface NodeReplaceChange<TNode extends NodeBase = NodeBase> {
  id: string;
  item: TNode;
  type: "replace";
}

export type NodeChange<TNode extends NodeBase = NodeBase> =
  | NodeDimensionChange
  | NodePositionChange
  | NodeSelectionChange
  | NodeRemoveChange
  | NodeAddChange<TNode>
  | NodeReplaceChange<TNode>;

export interface EdgeSelectionChange {
  id: string;
  type: "select";
  selected: boolean;
}

export interface EdgeRemoveChange {
  id: string;
  type: "remove";
}

export interface EdgeAddChange<TEdge extends EdgeBase = EdgeBase> {
  item: TEdge;
  type: "add";
  index?: number;
}

export interface EdgeReplaceChange<TEdge extends EdgeBase = EdgeBase> {
  id: string;
  item: TEdge;
  type: "replace";
}

export type EdgeChange<TEdge extends EdgeBase = EdgeBase> =
  | EdgeSelectionChange
  | EdgeRemoveChange
  | EdgeAddChange<TEdge>
  | EdgeReplaceChange<TEdge>;

/**
 * How the stacking of nodes and edges is worked out: `basic` lifts selected nodes and the nodes of
 * a parent; `auto` also stacks each tree of nodes above the one before it; `manual` leaves it to the
 * `zIndex` of the nodes and edges.
 */
export type ZIndexMode = "auto" | "basic" | "manual";
