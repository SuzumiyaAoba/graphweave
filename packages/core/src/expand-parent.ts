import type { InternalNode } from "./flow-state.ts";
import type { Rect } from "./geometry.ts";
import { getBoundsOfRects, nodeSize } from "./graph.ts";
import type {
  Dimensions,
  NodeBase,
  NodeDimensionChange,
  NodeOrigin,
  NodePositionChange,
  XYPosition,
} from "./types.ts";

// A node with `expandParent` that goes beyond the box of its parent makes the parent grow (and, on
// its top and left, move, with its other children moving the opposite way so that they stay put).
// This follows React Flow's `handleExpandParent`, step by step; `xyflow-expand-parent-parity.test.ts`
// holds it to that.

/** A child whose box is to be fitted into its parent: the box is in absolute flow coordinates. */
export interface ExpandingChild {
  id: string;
  parentId: string;
  rect: Rect;
}

export interface ParentLookups<TNode extends NodeBase> {
  nodeLookup: ReadonlyMap<string, InternalNode<TNode>>;
  parentLookup: ReadonlyMap<string, ReadonlyMap<string, InternalNode<TNode>>>;
}

type ParentChange = NodePositionChange | NodeDimensionChange;

// The box a node takes up in flow coordinates.
function rectOf(node: InternalNode): Rect {
  const { x, y } = node.internals.positionAbsolute;
  return { x, y, ...nodeSize(node) };
}

// The smallest box that holds every child of each parent and the parent itself.
function expansionsOf<TNode extends NodeBase>(
  children: readonly ExpandingChild[],
  nodeLookup: ReadonlyMap<string, InternalNode<TNode>>,
): Map<string, { expandedRect: Rect; parent: InternalNode<TNode> }> {
  const expansions = new Map<string, { expandedRect: Rect; parent: InternalNode<TNode> }>();
  for (const child of children) {
    const parent = nodeLookup.get(child.parentId);
    if (parent !== undefined) {
      const parentRect = expansions.get(child.parentId)?.expandedRect ?? rectOf(parent);
      expansions.set(child.parentId, {
        expandedRect: getBoundsOfRects([parentRect, child.rect]),
        parent,
      });
    }
  }
  return expansions;
}

interface Growth {
  xChange: number;
  yChange: number;
  newWidth: number;
  newHeight: number;
  widthChange: number;
  heightChange: number;
}

// How much the parent grows to the left and up (it moves by that), and in size.
function growthOf(parent: InternalNode, expandedRect: Rect, nodeOrigin: NodeOrigin): Growth {
  const { x, y } = parent.internals.positionAbsolute;
  const dimensions = nodeSize(parent);
  const [originX, originY] = parent.origin ?? nodeOrigin;
  const newWidth = Math.max(dimensions.width, Math.round(expandedRect.width));
  const newHeight = Math.max(dimensions.height, Math.round(expandedRect.height));
  return {
    xChange: expandedRect.x < x ? Math.round(Math.abs(x - expandedRect.x)) : 0,
    yChange: expandedRect.y < y ? Math.round(Math.abs(y - expandedRect.y)) : 0,
    newWidth,
    newHeight,
    widthChange: (newWidth - dimensions.width) * originX,
    heightChange: (newHeight - dimensions.height) * originY,
  };
}

// The parent moves, so the children it already had move the other way to stay where they are.
function moveChanges<TNode extends NodeBase>(
  parent: InternalNode<TNode>,
  growth: Growth,
  context: { children: readonly ExpandingChild[]; lookups: ParentLookups<TNode> },
): NodePositionChange[] {
  const { xChange, yChange, widthChange, heightChange } = growth;
  const changes: NodePositionChange[] = [
    {
      id: parent.id,
      type: "position",
      position: {
        x: parent.position.x - xChange + widthChange,
        y: parent.position.y - yChange + heightChange,
      },
    },
  ];
  for (const sibling of context.lookups.parentLookup.get(parent.id)?.values() ?? []) {
    if (!context.children.some((child) => child.id === sibling.id)) {
      changes.push({
        id: sibling.id,
        type: "position",
        position: { x: sibling.position.x + xChange, y: sibling.position.y + yChange },
      });
    }
  }
  return changes;
}

function parentChanges<TNode extends NodeBase>(
  parent: InternalNode<TNode>,
  expandedRect: Rect,
  context: {
    children: readonly ExpandingChild[];
    lookups: ParentLookups<TNode>;
    origin: NodeOrigin;
  },
): ParentChange[] {
  const growth = growthOf(parent, expandedRect, context.origin);
  const { xChange, yChange, newWidth, newHeight, widthChange, heightChange } = growth;
  const dimensions = nodeSize(parent);
  const [originX, originY] = parent.origin ?? context.origin;
  const changes: ParentChange[] =
    xChange > 0 || yChange > 0 || widthChange !== 0 || heightChange !== 0
      ? moveChanges(parent, growth, context)
      : [];
  if (
    dimensions.width < expandedRect.width ||
    dimensions.height < expandedRect.height ||
    xChange !== 0 ||
    yChange !== 0
  ) {
    changes.push({
      id: parent.id,
      type: "dimensions",
      setAttributes: true,
      dimensions: {
        width: newWidth + (xChange === 0 ? 0 : originX * xChange - widthChange),
        height: newHeight + (yChange === 0 ? 0 : originY * yChange - heightChange),
      },
    });
  }
  return changes;
}

/**
 * The changes that make each parent of `children` big enough to hold them. A child's `rect` is its
 * box in absolute flow coordinates.
 */
export function handleExpandParent<TNode extends NodeBase>(
  children: readonly ExpandingChild[],
  lookups: ParentLookups<TNode>,
  nodeOrigin: NodeOrigin = [0, 0],
): ParentChange[] {
  const changes: ParentChange[] = [];
  for (const [, { expandedRect, parent }] of expansionsOf(children, lookups.nodeLookup)) {
    changes.push(...parentChanges(parent, expandedRect, { children, lookups, origin: nodeOrigin }));
  }
  return changes;
}

/**
 * Where `position` (relative to the parent) is in absolute flow coordinates, for a box of the given
 * size at the node's origin.
 */
export function evaluateAbsolutePosition(
  box: { position: XYPosition; size: Dimensions },
  parent: InternalNode | undefined,
  nodeOrigin: NodeOrigin,
): XYPosition {
  const { position, size } = box;
  if (parent === undefined) {
    return { ...position };
  }
  const [originX, originY] = parent.origin ?? nodeOrigin;
  return {
    x: position.x + parent.internals.positionAbsolute.x - size.width * originX,
    y: position.y + parent.internals.positionAbsolute.y - size.height * originY,
  };
}
