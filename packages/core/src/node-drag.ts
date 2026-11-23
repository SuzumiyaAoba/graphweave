import type { OnError } from "./error-messages.ts";
import type { InternalNode } from "./flow-state.ts";
import { clamp } from "./geometry.ts";
import type { Point } from "./geometry.ts";
import { placeAll } from "./node-drag-place.ts";
import type { Held } from "./node-drag-place.ts";
import type {
  CoordinateExtent,
  NodeOrigin,
  NodePositionChange,
  SnapGrid,
  XYPosition,
} from "./types.ts";
import { snapToGrid } from "./viewport.ts";

export interface DragConfig {
  snapToGrid: boolean;
  snapGrid: SnapGrid;
  /** Absolute bounds for nodes that have no `extent` of their own. */
  nodeExtent: CoordinateExtent;
  /** Screen pixels the pointer must travel before a drag starts. */
  threshold: number;
  zoom: number;
  /** The origin of nodes that have none of their own. */
  nodeOrigin: NodeOrigin;
  /** Told of the mistakes found while nodes are placed (see `calculateNodePosition`). */
  onError?: OnError | undefined;
}

export interface DragContext {
  /** The nodes as they were when the drag began. */
  lookup: ReadonlyMap<string, InternalNode>;
  config: DragConfig;
  /** The nodes as they are now, for the parents that move while their child is dragged out. */
  current?: (() => ReadonlyMap<string, InternalNode>) | undefined;
}

export interface DragSession {
  /** True once the pointer has travelled far enough for this to count as a drag. */
  started: () => boolean;
  /** The position changes for the pointer at `point` (flow coordinates); none before the threshold. */
  move: (point: Point) => NodePositionChange[];
  /** The changes that end the drag, so the nodes stop being flagged as `dragging`. */
  end: () => NodePositionChange[];
  /** Where the dragged nodes are, in the order they are dragged: what the drag callbacks are told. */
  positions: () => { id: string; position: XYPosition }[];
}

type Lookup = ReadonlyMap<string, InternalNode>;

function hasDraggedAncestor(
  node: InternalNode,
  dragged: ReadonlySet<string>,
  lookup: Lookup,
): boolean {
  let { parentId } = node;
  const seen = new Set<string>();
  while (parentId !== undefined && !seen.has(parentId)) {
    if (dragged.has(parentId)) {
      return true;
    }
    seen.add(parentId);
    parentId = lookup.get(parentId)?.parentId;
  }
  return false;
}

/**
 * The nodes that move when the given ones are dragged: only draggable ones, and no node whose
 * ancestor is dragged as well, because a child follows its parent by itself.
 */
export function getDragItems(
  lookup: Lookup,
  ids: Iterable<string>,
  nodesDraggable: boolean,
): InternalNode[] {
  const wanted = new Set(ids);
  const items: InternalNode[] = [];
  // In the order of the flow, as in React Flow: the first of them is what the others snap to.
  for (const node of lookup.values()) {
    const draggable = node.draggable ?? nodesDraggable;
    if (wanted.has(node.id) && draggable && !hasDraggedAncestor(node, wanted, lookup)) {
      items.push(node);
    }
  }
  return items;
}

function changeFor(held: Held, dragging: boolean): NodePositionChange {
  return {
    id: held.node.id,
    type: "position",
    position: held.position,
    positionAbsolute: held.absolute,
    dragging,
  };
}

// Where the nodes are: where the drag has put them, or where they were before it began.
function positionsOf(
  held: readonly Held[] | undefined,
  items: readonly InternalNode[],
): { id: string; position: XYPosition }[] {
  return held === undefined
    ? items.map(({ id, position }) => ({ id, position }))
    : held.map(({ node, position }) => ({ id: node.id, position }));
}

// The nodes as they are held: each by the point of it that is under the pointer at `reference`.
function holdAll(items: readonly InternalNode[], reference: Point): Held[] {
  return items.map((node) => ({
    node,
    distance: {
      x: reference.x - node.internals.positionAbsolute.x,
      y: reference.y - node.internals.positionAbsolute.y,
    },
    position: node.position,
    absolute: node.internals.positionAbsolute,
  }));
}

// What going from screen pixels to the flow and back may add to a distance.
const ROUNDING = 1e-9;

// Whether the pointer has travelled more than the threshold, which is in screen pixels: a pointer
// that is exactly the threshold away has not, whatever the zoom makes of the arithmetic.
function farEnough(point: Point, reference: Point, config: DragConfig): boolean {
  const travelled = Math.hypot(point.x - reference.x, point.y - reference.y) * config.zoom;
  return travelled - config.threshold > ROUNDING;
}

// Whether snapping takes the pointer elsewhere than where it is.
function offGrid(point: Point, config: DragConfig): boolean {
  if (!config.snapToGrid) {
    return false;
  }
  const snapped = snapToGrid(point, config.snapGrid);
  return snapped.x !== point.x || snapped.y !== point.y;
}

/**
 * Starts dragging `items` with the pointer at `origin` (flow coordinates). The nodes are held from
 * where the pointer is when the drag begins; the nodes of the flow are read afresh at every move
 * (`current`), since a parent may have moved (or grown) in the meantime. With no threshold the drag
 * has begun at the press; nodes that were never moved are not reported as put down at the end, as in
 * React Flow.
 */
export function startNodeDrag(
  items: readonly InternalNode[],
  origin: Point,
  context: DragContext,
): DragSession {
  const { threshold } = context.config;
  let moved = false;
  let reference = origin;
  let held: Held[] | undefined = threshold <= 0 ? holdAll(items, origin) : undefined;
  // Begins the drag with this move if the pointer has gone far enough; tells whether the move is
  // to place the nodes.
  function begins(point: Point): boolean {
    if (!farEnough(point, reference, context.config)) {
      return false;
    }
    // As in React Flow, the pointer's travel up to now does not move the nodes: they are held
    // from where the pointer is when the drag begins, so they do not jump to catch up.
    reference = point;
    held = holdAll(items, reference);
    // The move that begins the drag places nothing, as in React Flow: a node that its extent
    // holds elsewhere than where its owner has it is only put there by the next move. With a
    // grid it does place them, unless the pointer is right on the grid.
    return offGrid(point, context.config);
  }
  return {
    started: () => held !== undefined,
    move: (point) => {
      if (held === undefined && !begins(point)) {
        return [];
      }
      const now = held ?? [];
      const lookup = context.current?.() ?? context.lookup;
      const changed = placeAll({ held: now, point, config: context.config, lookup });
      moved ||= changed;
      return changed ? now.map((item) => changeFor(item, true)) : [];
    },
    end: () => (moved ? (held ?? []).map((item) => changeFor(item, false)) : []),
    positions: () => positionsOf(held, items),
  };
}

const AUTO_PAN_EDGE = 40;
const AUTO_PAN_SPEED = 15;

// The share of full speed for a pointer at `value` along one axis, as React Flow works it out:
// nothing outside the edge zones, at least one pixel's worth from the first pixel into one, and full
// speed at the border and beyond. `max` is where the far edge zone begins.
function autoPanShare(value: number, max: number): number {
  if (value < AUTO_PAN_EDGE) {
    return clamp(Math.abs(value - AUTO_PAN_EDGE), 1, AUTO_PAN_EDGE) / AUTO_PAN_EDGE;
  }
  return value > max ? -clamp(Math.abs(value - max), 1, AUTO_PAN_EDGE) / AUTO_PAN_EDGE : 0;
}

/**
 * How far to move the viewport, in screen pixels per tick, so that content past the edge the pointer
 * is close to scrolls into view (near the left edge the viewport moves right, and so on). The caller
 * also moves a dragged node by the opposite amount, in flow units, so it stays under the pointer.
 * `point` is relative to the canvas.
 */
export function calcAutoPan(
  point: Point,
  size: { width: number; height: number },
  speed: number = AUTO_PAN_SPEED,
): Point {
  // Without a size every position is "at the right edge", which would scroll for ever.
  if (size.width <= 0 || size.height <= 0) {
    return { x: 0, y: 0 };
  }
  return {
    x: autoPanShare(point.x, size.width - AUTO_PAN_EDGE) * speed,
    y: autoPanShare(point.y, size.height - AUTO_PAN_EDGE) * speed,
  };
}
