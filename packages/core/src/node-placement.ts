import type { InternalNode } from "./flow-state.ts";
import { clamp } from "./geometry.ts";
import { nodeSize } from "./graph.ts";
import type { CoordinateExtent, NodeBase, NodeOrigin, XYPosition } from "./types.ts";

/** What places a node: where nodes start from, and the limit that keeps them on the canvas. */
export interface PlacementOptions {
  nodeOrigin: NodeOrigin;
  /** Keeps every node's top-left corner inside it; no limit when left out. */
  nodeExtent?: CoordinateExtent | undefined;
}

interface Size {
  width: number;
  height: number;
}

// The node's top-left corner relative to its parent, with the origin applied.
function localTopLeft(node: NodeBase, nodeOrigin: NodeOrigin): XYPosition {
  const [originX, originY] = node.origin ?? nodeOrigin;
  const { width, height } = nodeSize(node);
  return { x: node.position.x - width * originX, y: node.position.y - height * originY };
}

// Moves the corner of a box of `size` into `extent`, the far side winning when it does not fit.
function clampInto(position: XYPosition, extent: CoordinateExtent, size: Size): XYPosition {
  return {
    x: clamp(position.x, extent[0][0], extent[1][0] - size.width),
    y: clamp(position.y, extent[0][1], extent[1][1] - size.height),
  };
}

const UNLIMITED: CoordinateExtent = [
  [-Infinity, -Infinity],
  [Infinity, Infinity],
];

// A node's own extent, when it is a box of coordinates (`parent` is not one).
function boxOf(node: NodeBase): CoordinateExtent | undefined {
  return node.extent === undefined || node.extent === "parent" ? undefined : node.extent;
}

// The box of a parent on the canvas, which a child with the extent `parent` stays inside.
function boxOfParent(parent: InternalNode): CoordinateExtent {
  const at = parent.internals.positionAbsolute;
  const room = nodeSize(parent);
  return [
    [at.x, at.y],
    [at.x + room.width, at.y + room.height],
  ];
}

// A child's place on the canvas: its own extent holds it in its parent's space, the flow's extent
// holds it on the canvas, and `parent` keeps it inside its parent's box.
function childPosition(
  node: NodeBase,
  parent: InternalNode,
  options: PlacementOptions,
): XYPosition {
  const size = nodeSize(node);
  const local = localTopLeft(node, options.nodeOrigin);
  const box = boxOf(node);
  const placed = box === undefined ? local : clampInto(local, box, size);
  const at = parent.internals.positionAbsolute;
  const onCanvas = clampInto(
    { x: at.x + placed.x, y: at.y + placed.y },
    options.nodeExtent ?? UNLIMITED,
    size,
  );
  return node.extent === "parent" ? clampInto(onCanvas, boxOfParent(parent), size) : onCanvas;
}

/**
 * Where a node lies on the canvas, as React Flow works it out when it adopts the nodes. A node with
 * no parent is held by its own extent or else by the flow's.
 */
export function absolutePositionOf(
  node: NodeBase,
  parent: InternalNode | undefined,
  options: PlacementOptions,
): XYPosition {
  if (parent !== undefined) {
    return childPosition(node, parent, options);
  }
  const extent = boxOf(node) ?? options.nodeExtent ?? UNLIMITED;
  return clampInto(localTopLeft(node, options.nodeOrigin), extent, nodeSize(node));
}
