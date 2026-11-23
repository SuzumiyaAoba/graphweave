import { handleExpandParent } from "./expand-parent.ts";
import type { ExpandingChild, ParentLookups } from "./expand-parent.ts";
import { nodeSize } from "./graph.ts";
import type {
  NodeBase,
  NodeChange,
  NodeDimensionChange,
  NodeOrigin,
  NodePositionChange,
} from "./types.ts";

// A node with `expandParent` that is moved cannot go past the corner of its parent (its position is
// not negative); where it reaches beyond the other sides, the parent grows to hold it. React Flow
// does this for every move of nodes, by pointer or keyboard, in `updateNodePositions`.

// What a moved node that expands its parent adds to the parent's box.
function childOf<TNode extends NodeBase>(
  change: NodePositionChange,
  lookups: ParentLookups<TNode>,
): ExpandingChild | undefined {
  const node = lookups.nodeLookup.get(change.id);
  if (
    node?.expandParent !== true ||
    node.parentId === undefined ||
    change.position === undefined ||
    change.positionAbsolute === undefined
  ) {
    return undefined;
  }
  return {
    id: node.id,
    parentId: node.parentId,
    rect: { ...change.positionAbsolute, ...nodeSize(node) },
  };
}

// The change as it is told to the owner: React Flow's position change carries no absolute position
// (it is only what the expansion of a parent is worked out from), and a node that expands its parent
// is held at the corner of it.
function held(change: NodePositionChange, child: ExpandingChild | undefined): NodePositionChange {
  const told = { ...change };
  delete told.positionAbsolute;
  return child === undefined || told.position === undefined
    ? told
    : { ...told, position: { x: Math.max(0, told.position.x), y: Math.max(0, told.position.y) } };
}

/**
 * The changes for moving nodes as given (`position` changes), with the nodes that expand their parent
 * held at its corner and the changes that make each such parent big enough for them added.
 */
export function expandParentsOf<TNode extends NodeBase>(
  changes: readonly NodePositionChange[],
  lookups: ParentLookups<TNode>,
  nodeOrigin: NodeOrigin,
): NodeChange<TNode>[] {
  const children = changes.flatMap((change) => childOf(change, lookups) ?? []);
  const moved = changes.map((change) =>
    held(
      change,
      children.find((child) => child.id === change.id),
    ),
  );
  return [...moved, ...handleExpandParent(children, lookups, nodeOrigin)];
}

/**
 * The changes that make the parents of the nodes that have just been measured big enough for those
 * that expand their parent: as in React Flow, a node of a new size reaches as far as it now does.
 */
export function expandParentsOfMeasured<TNode extends NodeBase>(
  changes: readonly NodeDimensionChange[],
  lookups: ParentLookups<TNode>,
  nodeOrigin: NodeOrigin,
): NodeChange<TNode>[] {
  const children = changes.flatMap((change): ExpandingChild[] => {
    const node = lookups.nodeLookup.get(change.id);
    if (
      node?.expandParent !== true ||
      node.parentId === undefined ||
      change.dimensions === undefined
    ) {
      return [];
    }
    const rect = { ...node.internals.positionAbsolute, ...change.dimensions };
    return [{ id: node.id, parentId: node.parentId, rect }];
  });
  return handleExpandParent(children, lookups, nodeOrigin);
}
