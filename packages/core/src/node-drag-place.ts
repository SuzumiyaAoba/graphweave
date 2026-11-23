import type { OnError } from "./error-messages.ts";
import type { InternalNode } from "./flow-state.ts";
import type { Point } from "./geometry.ts";
import { nodeSize } from "./graph.ts";
import { calculateNodePosition } from "./node-position.ts";
import type { CoordinateExtent, NodeOrigin, SnapGrid, XYPosition } from "./types.ts";
import { snapToGrid } from "./viewport.ts";

// Where the pointer takes the nodes of a drag: each at the same distance from it as when the drag
// began, snapped to the grid, kept in its extent and told relative to its parent. This follows
// `updateNodes` of React Flow's `XYDrag`.

export interface PlaceConfig {
  snapToGrid: boolean;
  snapGrid: SnapGrid;
  /** Absolute bounds for nodes that have no `extent` of their own. */
  nodeExtent: CoordinateExtent;
  nodeOrigin: NodeOrigin;
  /** Told of the mistakes found while nodes are placed (see `calculateNodePosition`). */
  onError?: OnError | undefined;
}

interface Delta {
  x: number;
  y: number;
}

// What the drag keeps of each node it moves: where it is held, and where it is now.
export interface Held {
  node: InternalNode;
  /** How far the node's top left corner is from the pointer, from where the drag began. */
  distance: Delta;
  position: XYPosition;
  absolute: XYPosition;
}

interface Box {
  x: number;
  y: number;
  x2: number;
  y2: number;
}

function boundsOf(held: readonly Held[]): Box {
  const boxes = held.map((item) => {
    const { width, height } = nodeSize(item.node);
    const { x, y } = item.absolute;
    return { x, y, x2: x + width, y2: y + height };
  });
  return {
    x: Math.min(...boxes.map((box) => box.x)),
    y: Math.min(...boxes.map((box) => box.y)),
    x2: Math.max(...boxes.map((box) => box.x2)),
    y2: Math.max(...boxes.map((box) => box.y2)),
  };
}

// With several nodes moved under an extent of the flow, the box of all of them has to stay inside
// it, so each node's own bounds are what is left after the others take their room.
function groupExtent(held: Held, box: Box, extent: CoordinateExtent): CoordinateExtent {
  const { width, height } = nodeSize(held.node);
  const { x, y } = held.absolute;
  return [
    [x - box.x + extent[0][0], y - box.y + extent[0][1]],
    [x + width - box.x2 + extent[1][0], y + height - box.y2 + extent[1][1]],
  ];
}

// With snapping on and several nodes, the first one lands on the grid and the others keep their
// offset to it, as in React Flow.
function snapOffsetOf(
  first: Held | undefined,
  point: Point,
  config: PlaceConfig,
): Delta | undefined {
  if (first === undefined || !config.snapToGrid) {
    return undefined;
  }
  const at = { x: point.x - first.distance.x, y: point.y - first.distance.y };
  const snapped = snapToGrid(at, config.snapGrid);
  return { x: snapped.x - at.x, y: snapped.y - at.y };
}

// The position snapped to the grid: relative to the first node when several are moved together.
function snappedPosition(
  wanted: XYPosition,
  snapping: { offset: Delta | undefined; config: PlaceConfig },
): XYPosition {
  const { offset, config } = snapping;
  if (!config.snapToGrid) {
    return wanted;
  }
  return offset === undefined
    ? snapToGrid(wanted, config.snapGrid)
    : { x: Math.round(wanted.x + offset.x), y: Math.round(wanted.y + offset.y) };
}

export interface Moving {
  held: Held[];
  point: Point;
  config: PlaceConfig;
  lookup: ReadonlyMap<string, InternalNode>;
}

interface Shared {
  moving: Moving;
  box: Box | undefined;
  offset: Delta | undefined;
}

// The extent a node is kept in: that of the flow, or its share of it when several nodes are moved.
function extentFor(item: Held, shared: Shared): CoordinateExtent {
  const { nodeExtent } = shared.moving.config;
  return shared.box !== undefined && item.node.extent === undefined
    ? groupExtent(item, shared.box, nodeExtent)
    : nodeExtent;
}

// Moves one node to where the pointer takes it; true if it changed place.
function placeOne(item: Held, shared: Shared): boolean {
  const { point, config, lookup } = shared.moving;
  const node = lookup.get(item.node.id);
  if (node === undefined) {
    return false;
  }
  const wanted = { x: point.x - item.distance.x, y: point.y - item.distance.y };
  const placed = calculateNodePosition({
    node,
    nodeLookup: lookup,
    nextPosition: snappedPosition(wanted, { offset: shared.offset, config }),
    nodeOrigin: config.nodeOrigin,
    nodeExtent: extentFor(item, shared),
    onError: config.onError,
  });
  const changed = placed.position.x !== item.position.x || placed.position.y !== item.position.y;
  item.position = placed.position;
  item.absolute = placed.positionAbsolute;
  return changed;
}

/** Moves every node to where the pointer takes it; true if any of them changed place. */
export function placeAll(moving: Moving): boolean {
  const multiple = moving.held.length > 1;
  const shared: Shared = {
    moving,
    box: multiple ? boundsOf(moving.held) : undefined,
    offset: multiple ? snapOffsetOf(moving.held[0], moving.point, moving.config) : undefined,
  };
  return moving.held.map((item) => placeOne(item, shared)).includes(true);
}
