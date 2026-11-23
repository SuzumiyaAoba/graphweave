import { errorMessages } from "./error-messages.ts";
import type { OnError } from "./error-messages.ts";
import type { InternalNode } from "./flow-state.ts";
import { clamp } from "./geometry.ts";
import { nodeSize } from "./graph.ts";
import type { CoordinateExtent, NodeBase, NodeOrigin, XYPosition } from "./types.ts";

// Where a node ends up when it is moved to `nextPosition` (the absolute position of its top left
// corner): kept inside its extent, and told as a position relative to its parent. This follows
// React Flow's `calculateNodePosition`, step by step; `xyflow-node-position-parity.test.ts` holds it
// to that.

export interface NodePositioning {
  /** Relative to the parent, and at the node's origin. */
  position: XYPosition;
  /** The top left corner, in flow coordinates. */
  positionAbsolute: XYPosition;
}

export function isExtent(extent: unknown): extent is CoordinateExtent {
  return Array.isArray(extent);
}

function clampPosition(
  position: XYPosition,
  extent: CoordinateExtent,
  size: { width: number; height: number },
): XYPosition {
  return {
    x: clamp(position.x, extent[0][0], extent[1][0] - size.width),
    y: clamp(position.y, extent[0][1], extent[1][1] - size.height),
  };
}

// The box a node with `extent: "parent"` is kept in: its parent's. A parent that has no size (it is
// not measured yet) or is missing keeps nothing.
function parentBox(parent: InternalNode | undefined): CoordinateExtent | undefined {
  if (parent === undefined) {
    return undefined;
  }
  const { width, height } = nodeSize(parent);
  const { x, y } = parent.internals.positionAbsolute;
  return width === 0 || height === 0
    ? undefined
    : [
        [x, y],
        [x + width, y + height],
      ];
}

// The extent that applies to the node, in absolute coordinates; `undefined` for none at all.
function extentOf(
  node: InternalNode,
  parent: InternalNode | undefined,
  nodeExtent: CoordinateExtent | undefined,
): CoordinateExtent | undefined {
  if (node.extent === "parent" && node.expandParent !== true) {
    return parentBox(parent);
  }
  if (node.extent === "parent") {
    // It may leave its parent, which then grows; nothing else holds it either.
    return undefined;
  }
  if (parent !== undefined && isExtent(node.extent)) {
    const { x, y } = parent.internals.positionAbsolute;
    return [
      [node.extent[0][0] + x, node.extent[0][1] + y],
      [node.extent[1][0] + x, node.extent[1][1] + y],
    ];
  }
  if (node.extent === undefined) {
    return nodeExtent;
  }
  return isExtent(node.extent) ? node.extent : undefined;
}

export interface PositionRequest<TNode extends NodeBase> {
  node: InternalNode<TNode>;
  nodeLookup: ReadonlyMap<string, InternalNode<TNode>>;
  /** Where the top left corner is to go, in flow coordinates. */
  nextPosition: XYPosition;
  nodeOrigin: NodeOrigin;
  /** The extent of the flow, for the nodes that have none of their own. */
  nodeExtent?: CoordinateExtent | undefined;
  /** Told (code 005) of a node with the extent `parent` and no parent, and (015) of one never measured. */
  onError?: OnError | undefined;
}

// The two mistakes React Flow tells of while a node is placed: a parent extent without a parent, and
// a node that has not been measured.
function reportProblems<TNode extends NodeBase>(
  request: PositionRequest<TNode>,
  parent: InternalNode | undefined,
): void {
  const { node, onError } = request;
  if (node.extent === "parent" && node.expandParent !== true && parent === undefined) {
    onError?.("005", errorMessages.error005());
  }
  if (node.measured.width === undefined || node.measured.height === undefined) {
    onError?.("015", errorMessages.error015());
  }
}

export function calculateNodePosition<TNode extends NodeBase>(
  request: PositionRequest<TNode>,
): NodePositioning {
  const { node, nodeLookup, nextPosition, nodeExtent } = request;
  const parent = node.parentId === undefined ? undefined : nodeLookup.get(node.parentId);
  const origin = node.origin ?? request.nodeOrigin;
  const extent = extentOf(node, parent, nodeExtent);
  reportProblems(request, parent);
  const size = nodeSize(node);
  const positionAbsolute =
    extent === undefined ? nextPosition : clampPosition(nextPosition, extent, size);
  const parentAt = parent?.internals.positionAbsolute ?? { x: 0, y: 0 };
  return {
    position: {
      x: positionAbsolute.x - parentAt.x + size.width * origin[0],
      y: positionAbsolute.y - parentAt.y + size.height * origin[1],
    },
    positionAbsolute,
  };
}
