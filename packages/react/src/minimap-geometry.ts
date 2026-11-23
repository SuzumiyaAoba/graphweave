import type { Rect } from "@free-flow/core";

/** The part of the flow the mini map shows, and how much flow space one mini map pixel covers. */
export interface MiniMapView {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Flow units per pixel of the mini map. */
  viewScale: number;
  /** The margin added around the content, in flow units. */
  offset: number;
}

function unionOf(a: Rect, b: Rect): Rect {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y,
  };
}

export interface MiniMapViewInput {
  /** The box around all nodes; undefined when there are none. */
  nodesBounds: Rect | undefined;
  /** The part of the flow the main canvas shows right now. */
  visible: Rect;
  /** Size of the mini map element, in pixels. */
  element: { width: number; height: number };
  /** Margin around the content, as a multiple of `viewScale`. */
  offsetScale: number;
}

/**
 * The frame of the mini map: it holds every node and the visible area, keeps the element's aspect
 * ratio, centres the content, and leaves a margin of `offsetScale` pixels.
 */
export function miniMapView(input: MiniMapViewInput): MiniMapView {
  const { element, offsetScale } = input;
  const content =
    input.nodesBounds === undefined ? input.visible : unionOf(input.nodesBounds, input.visible);
  const scale = Math.max(content.width / element.width, content.height / element.height);
  // A flow with nothing to show still needs a usable scale.
  const viewScale = scale > 0 ? scale : 1;
  const viewWidth = viewScale * element.width;
  const viewHeight = viewScale * element.height;
  const offset = offsetScale * viewScale;
  return {
    x: content.x - (viewWidth - content.width) / 2 - offset,
    y: content.y - (viewHeight - content.height) / 2 - offset,
    width: viewWidth + offset * 2,
    height: viewHeight + offset * 2,
    viewScale,
    offset,
  };
}

/**
 * An SVG path that fills everything in the frame except the visible area (use `evenodd`). As in
 * React Flow, the frame reaches one more `offset` past the edge of what the mini map shows.
 */
export function maskPath(view: MiniMapView, visible: Rect): string {
  const { x, y, offset } = view;
  const width = view.width + offset * 2;
  const height = view.height + offset * 2;
  const frame = `M${x - offset},${y - offset}h${width}v${height}h${-width}z`;
  const hole = `M${visible.x},${visible.y}h${visible.width}v${visible.height}h${-visible.width}z`;
  return `${frame} ${hole}`;
}
