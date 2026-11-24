import { getBoundsOfRects, visibleRect } from "@graphweave/core";
import type { InternalNode, Rect, XYPosition } from "@graphweave/core";
import { createElement, memo, useEffect, useLayoutEffect, useRef } from "react";
import type {
  ComponentType,
  CSSProperties,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactElement,
} from "react";

import { cx } from "./class-names.ts";
import { maskPath, miniMapView } from "./minimap-geometry.ts";
import { MiniMapNode } from "./minimap-node.tsx";
import type { MiniMapNodeProps } from "./minimap-node.tsx";
import { flowPositionOf } from "./minimap-position.ts";
import { miniMapStyle } from "./minimap-style.ts";
import { useMiniMapWheel } from "./minimap-wheel.ts";
import { holdSelectionWhilePressed } from "./no-select.ts";
import { Panel } from "./panel.tsx";
import { trackPointer } from "./pointer-track.ts";
import { shallow } from "./shallow.ts";
import type { ReactFlowState } from "./store-context.ts";
import { swallowClickAfterMove } from "./swallow-click.ts";
import { markZoomable } from "./touch-style.ts";
import type { Node, PanelPosition } from "./types.ts";
import { useStore, useStoreApi } from "./use-store.ts";
import { useViewProps } from "./view-props.ts";
import { changeViewportNow } from "./viewport-animation.ts";

const DEFAULT_WIDTH = 200;
const DEFAULT_HEIGHT = 150;
const DEFAULT_BORDER_RADIUS = 5;
const DEFAULT_OFFSET_SCALE = 5;

type PerNode<TValue, TNode extends Node = Node> = TValue | ((node: TNode) => TValue);

export interface MiniMapProps<TNode extends Node = Node> {
  style?: CSSProperties | undefined;
  className?: string | undefined;
  nodeColor?: PerNode<string, TNode> | undefined;
  nodeStrokeColor?: PerNode<string, TNode> | undefined;
  nodeClassName?: PerNode<string, TNode> | undefined;
  nodeBorderRadius?: number | undefined;
  nodeStrokeWidth?: number | undefined;
  nodeComponent?: ComponentType<MiniMapNodeProps> | undefined;
  bgColor?: string | undefined;
  maskColor?: string | undefined;
  maskStrokeColor?: string | undefined;
  maskStrokeWidth?: number | undefined;
  position?: PanelPosition | undefined;
  /** Called with the flow position under a click on the map. */
  onClick?: ((event: ReactMouseEvent, position: XYPosition) => void) | undefined;
  onNodeClick?: ((event: ReactMouseEvent, node: TNode) => void) | undefined;
  /** Dragging on the map pans the flow. */
  pannable?: boolean | undefined;
  /** The wheel on the map zooms the flow. */
  zoomable?: boolean | undefined;
  ariaLabel?: string | null | undefined;
  inversePan?: boolean | undefined;
  zoomStep?: number | undefined;
  offsetScale?: number | undefined;
}

function pickString(value: PerNode<string> | undefined, node: Node): string | undefined {
  return typeof value === "function" ? value(node) : value;
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === "number" ? value : fallback;
}

// A node is drawn once its size is known: measured, or given by the owner.
function sizeOfNode(node: InternalNode<Node>): { width: number; height: number } | undefined {
  const width = node.measured.width ?? node.width ?? node.initialWidth;
  const height = node.measured.height ?? node.height ?? node.initialHeight;
  return width === undefined || height === undefined ? undefined : { width, height };
}

function nodesBoundsOf(state: ReactFlowState): Rect | undefined {
  const rects = [...state.nodeLookup.values()].flatMap((node) => {
    const size = sizeOfNode(node);
    return node.hidden === true || size === undefined
      ? []
      : [{ ...node.internals.positionAbsolute, ...size }];
  });
  return rects.length === 0 ? undefined : getBoundsOfRects(rects);
}

function visibleNodeIds(state: ReactFlowState): string[] {
  return [...state.nodeLookup.values()]
    .filter((node) => node.hidden !== true && sizeOfNode(node) !== undefined)
    .map((node) => node.id);
}

// Chromium draws the sharp edges of the small rectangles best; the others get the precise ones.
const SHAPE_RENDERING =
  !("window" in globalThis) || Boolean(Reflect.get(globalThis, "chrome"))
    ? "crispEdges"
    : "geometricPrecision";

interface NodeItemProps extends Omit<MiniMapProps, "style" | "className"> {
  id: string;
}

function MiniMapNodeItemComponent({
  id,
  nodeColor,
  nodeStrokeColor,
  nodeClassName,
  nodeBorderRadius = DEFAULT_BORDER_RADIUS,
  nodeStrokeWidth,
  nodeComponent = MiniMapNode,
  onNodeClick,
}: NodeItemProps): ReactElement | null {
  const node = useStore((state) => state.nodeLookup.get(id));
  if (node === undefined) {
    return null;
  }
  const user = node.internals.userNode;
  const size = sizeOfNode(node);
  // Like React Flow, a hidden node and one without a size are left out.
  if (user.hidden === true || size === undefined) {
    return null;
  }
  return createElement(nodeComponent, {
    id,
    x: node.internals.positionAbsolute.x,
    y: node.internals.positionAbsolute.y,
    width: size.width,
    height: size.height,
    style: user.style,
    borderRadius: nodeBorderRadius,
    className: pickString(nodeClassName, user) ?? "",
    color: pickString(nodeColor, user),
    strokeColor: pickString(nodeStrokeColor, user),
    strokeWidth: nodeStrokeWidth,
    shapeRendering: SHAPE_RENDERING,
    selected: node.selected === true,
    onClick:
      onNodeClick === undefined
        ? undefined
        : (event, nodeId) => {
            const target = nodeId === id ? user : undefined;
            if (target !== undefined) {
              onNodeClick(event, target);
            }
          },
  });
}

const MiniMapNodeItem = memo(MiniMapNodeItemComponent);

/**
 * An overview of the whole flow: its nodes as small rectangles and the part currently visible as a
 * window. It can pan and zoom the flow when `pannable` and `zoomable` are set.
 */
export function MiniMap<TNode extends Node = Node>(props: MiniMapProps<TNode>): ReactElement;
export function MiniMap({
  style,
  className,
  bgColor,
  maskColor,
  maskStrokeColor,
  maskStrokeWidth,
  position = "bottom-right",
  onClick,
  pannable = false,
  zoomable = false,
  ariaLabel,
  inversePan = false,
  zoomStep = 1,
  offsetScale = DEFAULT_OFFSET_SCALE,
  ...nodeProps
}: MiniMapProps): ReactElement {
  const store = useStoreApi();
  const labels = useViewProps((props) => props.ariaLabels);
  const titleId = `react-flow__minimap-desc-${useViewProps((props) => props.rfId)}`;
  const svgRef = useRef<SVGSVGElement>(null);
  const ids = useStore(visibleNodeIds, shallow);
  const bounds = useStore(nodesBoundsOf, shallow);
  const viewport = useStore((state) => state.viewport);
  const size = useStore((state) => ({ width: state.width, height: state.height }), shallow);
  const element = {
    width: numberOr(style?.width, DEFAULT_WIDTH),
    height: numberOr(style?.height, DEFAULT_HEIGHT),
  };
  const visible = visibleRect(viewport, size);
  const view = miniMapView({ nodesBounds: bounds, visible, element, offsetScale });
  const label = ariaLabel === undefined ? labels["minimap.ariaLabel"] : ariaLabel;

  const currentView = useRef(view);
  useEffect(() => {
    currentView.current = view;
  });
  // The map is panned and zoomed as a whole, so a tap on it leaves no highlight.
  useLayoutEffect(() => {
    markZoomable(svgRef.current);
  }, []);
  useMiniMapWheel(svgRef, zoomable, zoomStep);

  const handlePointerDown = (event: ReactPointerEvent<SVGSVGElement>): void => {
    if (event.button !== 0) {
      return;
    }
    // React Flow's map always has a d3-zoom, which selects no text while a mouse presses it.
    holdSelectionWhilePressed(event.nativeEvent);
    if (!pannable) {
      return;
    }
    let last = { x: event.clientX, y: event.clientY };
    const sign = inversePan ? -1 : 1;
    trackPointer(
      event,
      (move) => {
        const { zoom } = store.getState().viewport;
        const delta = {
          x: -(move.clientX - last.x) * currentView.current.viewScale * zoom * sign,
          y: -(move.clientY - last.y) * currentView.current.viewScale * zoom * sign,
        };
        // As a call: a move that leaves the viewport where it was is told all the same.
        changeViewportNow(store, () => store.getState().panBy(delta));
        last = { x: move.clientX, y: move.clientY };
      },
      (up) => {
        // The click that ends a drag is not a click on the map.
        swallowClickAfterMove(event.nativeEvent, up);
      },
    );
  };
  const handleClick = (event: ReactMouseEvent<SVGSVGElement>): void => {
    if (onClick !== undefined && svgRef.current !== null) {
      onClick(event, flowPositionOf(svgRef.current, view, { x: event.clientX, y: event.clientY }));
    }
  };
  return (
    <Panel
      position={position}
      style={miniMapStyle(
        style,
        { bgColor, maskColor, maskStrokeColor, maskStrokeWidth, ...nodeProps },
        view.viewScale,
      )}
      className={cx("react-flow__minimap", className)}
      data-testid="rf__minimap"
    >
      {/* A map is a pointer affordance (drag to pan, wheel to zoom, click to report); it has no keyboard equivalent. */}
      {/* oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions */}
      <svg
        ref={svgRef}
        width={element.width}
        height={element.height}
        viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`}
        className="react-flow__minimap-svg"
        // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- the svg is the picture; there is no `img` element for inline SVG
        role="img"
        aria-labelledby={label === null ? undefined : titleId}
        onPointerDown={handlePointerDown}
        onClick={handleClick}
      >
        {label === null ? null : <title id={titleId}>{label}</title>}
        {ids.map((id) => (
          // The node's own id goes last: a prop the map does not know (an `id`) must not replace it.
          <MiniMapNodeItem key={id} {...nodeProps} id={id} />
        ))}
        <path
          className="react-flow__minimap-mask"
          d={maskPath(view, visible)}
          fillRule="evenodd"
          pointerEvents="none"
        />
      </svg>
    </Panel>
  );
}
