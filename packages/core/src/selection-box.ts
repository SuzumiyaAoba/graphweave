import type { InternalNode, SelectionRect } from "./flow-state.ts";
import type { Point, Rect } from "./geometry.ts";
import { rectOverlapArea } from "./geometry.ts";
import type { EdgeBase, NodeBase } from "./types.ts";
import { SelectionMode } from "./types.ts";

/** The rectangle spanned by a drag from `start` to `current`, whichever direction it goes. */
export function selectionRectOf(start: Point, current: Point): SelectionRect {
  return {
    x: Math.min(start.x, current.x),
    y: Math.min(start.y, current.y),
    width: Math.abs(current.x - start.x),
    height: Math.abs(current.y - start.y),
    startX: start.x,
    startY: start.y,
  };
}

function nodeRect(node: InternalNode): Rect {
  const { x, y } = node.internals.positionAbsolute;
  return {
    x,
    y,
    width: node.measured.width ?? node.width ?? node.initialWidth ?? 0,
    height: node.measured.height ?? node.height ?? node.initialHeight ?? 0,
  };
}

function contains(outer: Rect, inner: Rect): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  );
}

// Whether the box picks up the node, as React Flow's getNodesInside tells it: the overlap, rounded up as
// React Flow rounds it, has to cover the node's area in full mode (so that a node a fraction of a pixel
// out of the box still counts) and be more than nothing in partial mode (so that a box of no width, a
// drag straight down, picks up no node that has a size). A node with no size counts when it lies inside
// the box, edges included: React Flow takes such a node, and one it has no handle bounds for, into
// every box, which is not copied.
function picks(box: Rect, rect: Rect, mode: SelectionMode): boolean {
  const area = rect.width * rect.height;
  if (area <= 0) {
    return contains(box, rect);
  }
  const overlap = Math.ceil(rectOverlapArea(box, rect));
  return mode === SelectionMode.Full ? overlap >= area : overlap > 0;
}

export interface SelectionQuery {
  /** `partial` selects nodes the box touches, `full` only those it encloses. */
  mode: SelectionMode;
  /** The flow's `elementsSelectable`; a node's own `selectable` overrides it. */
  elementsSelectable: boolean;
}

/** The ids of the selectable, visible nodes that a selection box picks up. */
export function getNodesInRect(
  nodes: Iterable<InternalNode>,
  box: Rect,
  query: SelectionQuery,
): string[] {
  const ids: string[] = [];
  for (const node of nodes) {
    const selectable = node.selectable ?? query.elementsSelectable;
    const rect = nodeRect(node);
    const hit = picks(box, rect, query.mode);
    if (selectable && node.hidden !== true && hit) {
      ids.push(node.id);
    }
  }
  return ids;
}

/**
 * The selectable edges that touch any of the given nodes, as React Flow's selection box takes them:
 * an edge whose other end is not in the box is selected as well.
 */
export function getEdgesOfNodes<TEdge extends EdgeBase>(
  nodeIds: Iterable<NodeBase["id"]>,
  edges: readonly TEdge[],
  selectableByDefault: boolean,
): TEdge[] {
  const ids = new Set(nodeIds);
  return edges.filter(
    (edge) =>
      (edge.selectable ?? selectableByDefault) && (ids.has(edge.source) || ids.has(edge.target)),
  );
}
