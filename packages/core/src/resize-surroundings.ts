import type { InternalNode } from "./flow-state.ts";
import { nodeSize } from "./graph.ts";
import { isExtent } from "./node-position.ts";
import type { Extent } from "./resize-dimensions.ts";
import type { NodeBase, NodeOrigin, XYPosition } from "./types.ts";

// The things around a node that limit how it can be resized, and the children that have to keep their
// place on screen when its top left moves.

export interface ChildPosition {
  id: string;
  position: XYPosition;
}

export interface ResizeWorld<TNode extends NodeBase = NodeBase> {
  node: InternalNode<TNode>;
  nodeLookup: ReadonlyMap<string, InternalNode<TNode>>;
  parentLookup: ReadonlyMap<string, ReadonlyMap<string, InternalNode<TNode>>>;
  nodeOrigin: NodeOrigin;
  /**
   * The same as it is now. The changes of each step are made against that (a parent that grew at
   * the step before is the one the next step starts from), where the limits come from the start.
   */
  current?: (() => ResizeWorld<TNode>) | undefined;
}

// The box of a child, relative to the node, that the node must not shrink away from.
function childExtentOf(child: InternalNode, node: InternalNode, origin: NodeOrigin): Extent {
  const x = node.position.x + child.position.x;
  const y = node.position.y + child.position.y;
  const { width, height } = nodeSize(child);
  const offset: XYPosition = { x: origin[0] * width, y: origin[1] * height };
  return [
    [x - offset.x, y - offset.y],
    [x + width - offset.x, y + height - offset.y],
  ];
}

function unionOf(a: Extent | undefined, b: Extent): Extent {
  return a === undefined
    ? b
    : [
        [Math.min(b[0][0], a[0][0]), Math.min(b[0][1], a[0][1])],
        [Math.max(b[1][0], a[1][0]), Math.max(b[1][1], a[1][1])],
      ];
}

export interface Surroundings {
  parent: InternalNode | undefined;
  /** Where the node may be: its own extent, or its parent's box for `extent: "parent"`. */
  nodeExtent: Extent | undefined;
  /** The children whose place on screen is kept when the node's top left moves. */
  children: ChildPosition[];
  /** The box that the children that stay in the node (or make it grow) take up. */
  childExtent: Extent | undefined;
}

function unionAll(extents: readonly Extent[]): Extent | undefined {
  const [first, ...rest] = extents;
  if (first === undefined) {
    return undefined;
  }
  let union = first;
  for (const extent of rest) {
    union = unionOf(union, extent);
  }
  return union;
}

// The parent that limits the node (it must stay inside it) or that it makes grow.
function parentOf<TNode extends NodeBase>(world: ResizeWorld<TNode>): InternalNode | undefined {
  const { node, nodeLookup } = world;
  const limits = node.extent === "parent" || node.expandParent === true;
  return node.parentId !== undefined && limits ? nodeLookup.get(node.parentId) : undefined;
}

function nodeExtentOf(node: InternalNode, parent: InternalNode | undefined): Extent | undefined {
  if (parent !== undefined && node.extent === "parent") {
    return [
      [0, 0],
      [nodeSize(parent).width, nodeSize(parent).height],
    ];
  }
  return isExtent(node.extent) ? node.extent : undefined;
}

export function surroundingsOf<TNode extends NodeBase>(world: ResizeWorld<TNode>): Surroundings {
  const { node, nodeLookup, nodeOrigin } = world;
  const parent = parentOf(world);
  const kids = [...nodeLookup.values()].filter((child) => child.parentId === node.id);
  const staying = kids.filter((child) => child.extent === "parent" || child.expandParent === true);
  return {
    parent,
    nodeExtent: nodeExtentOf(node, parent),
    children: kids.map((child) => ({ id: child.id, position: { ...child.position } })),
    childExtent: unionAll(
      staying.map((child) => childExtentOf(child, node, child.origin ?? nodeOrigin)),
    ),
  };
}
