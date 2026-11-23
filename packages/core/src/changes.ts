import type {
  EdgeBase,
  EdgeChange,
  NodeBase,
  NodeChange,
  NodeDimensionChange,
  NodePositionChange,
} from "./types.ts";

interface Identified {
  id: string;
}

// The part of every change type that the generic algorithm needs; each concrete change is
// assignable to it, so no casts are needed.
interface ChangeView<TItem> {
  type: string;
  id?: string;
  item?: TItem;
  index?: number;
}

interface GroupedChanges<TChange> {
  byId: Map<string, TChange[]>;
  added: TChange[];
}

function addToGroup<TChange extends ChangeView<unknown>>(
  grouped: GroupedChanges<TChange>,
  change: TChange,
): void {
  if (change.type === "add") {
    grouped.added.push(change);
    return;
  }
  if (change.id === undefined) {
    return;
  }
  const own = grouped.byId.get(change.id);
  if (own === undefined || change.type === "remove" || change.type === "replace") {
    grouped.byId.set(change.id, [change]);
  } else {
    own.push(change);
  }
}

// Groups the changes of every existing element by id, in order. `remove` and `replace` reset what
// was collected for the id and win over everything that follows them.
function groupChanges<TChange extends ChangeView<unknown>>(
  changes: readonly TChange[],
): GroupedChanges<TChange> {
  const grouped: GroupedChanges<TChange> = { byId: new Map(), added: [] };
  for (const change of changes) {
    addToGroup(grouped, change);
  }
  return grouped;
}

// The element after its own changes, as a list: empty when it was removed.
function applyToElement<TItem extends Identified, TChange extends ChangeView<TItem>>(
  element: TItem,
  own: readonly TChange[],
  applyField: (change: TChange, element: TItem) => TItem,
): TItem[] {
  const [first] = own;
  if (first?.type === "remove") {
    return [];
  }
  if (first?.type === "replace") {
    return first.item === undefined ? [] : [{ ...first.item }];
  }
  let next = element;
  for (const change of own) {
    next = applyField(change, next);
  }
  return [next];
}

function insertAdded<TItem extends Identified>(result: TItem[], change: ChangeView<TItem>): void {
  if (change.item === undefined) {
    return;
  }
  if (change.index === undefined) {
    result.push({ ...change.item });
  } else {
    result.splice(change.index, 0, { ...change.item });
  }
}

function applyChanges<TItem extends Identified, TChange extends ChangeView<TItem>>(
  changes: readonly TChange[],
  elements: readonly TItem[],
  applyField: (change: TChange, element: TItem) => TItem,
): TItem[] {
  const { byId, added } = groupChanges(changes);
  const result = elements.flatMap((element) => {
    const own = byId.get(element.id);
    return own === undefined ? [element] : applyToElement(element, own, applyField);
  });
  for (const change of added) {
    insertAdded(result, change);
  }
  return result;
}

// The `width`/`height` a user-driven resize writes next to the measured size.
function sizeAttributes(change: NodeDimensionChange): { width?: number; height?: number } {
  const { dimensions, setAttributes } = change;
  const result: { width?: number; height?: number } = {};
  if (dimensions === undefined || setAttributes === undefined || setAttributes === false) {
    return result;
  }
  if (setAttributes === true || setAttributes === "width") {
    result.width = dimensions.width;
  }
  if (setAttributes === true || setAttributes === "height") {
    result.height = dimensions.height;
  }
  return result;
}

function applyNodeDimension<TNode extends NodeBase>(
  change: NodeDimensionChange,
  node: TNode,
): TNode {
  const { dimensions, resizing } = change;
  return {
    ...node,
    ...(dimensions === undefined ? {} : { measured: { ...node.measured, ...dimensions } }),
    ...sizeAttributes(change),
    ...(resizing === undefined ? {} : { resizing }),
  };
}

function applyNodePosition<TNode extends NodeBase>(change: NodePositionChange, node: TNode): TNode {
  const { position, dragging } = change;
  return {
    ...node,
    ...(position === undefined ? {} : { position }),
    ...(dragging === undefined ? {} : { dragging }),
  };
}

function applyNodeField<TNode extends NodeBase>(change: NodeChange<TNode>, node: TNode): TNode {
  if (change.type === "select") {
    return { ...node, selected: change.selected };
  }
  if (change.type === "position") {
    return applyNodePosition(change, node);
  }
  if (change.type === "dimensions") {
    return applyNodeDimension(change, node);
  }
  return node;
}

/**
 * Applies the changes reported by `onNodesChange` to a node array and returns a new array. Nodes
 * without changes keep their identity, so memoised consumers do not re-render.
 */
export function applyNodeChanges<TNode extends NodeBase>(
  changes: readonly NodeChange<TNode>[],
  nodes: readonly TNode[],
): TNode[] {
  return applyChanges<TNode, NodeChange<TNode>>(changes, nodes, applyNodeField);
}

function applyEdgeField<TEdge extends EdgeBase>(change: EdgeChange<TEdge>, edge: TEdge): TEdge {
  return change.type === "select" ? { ...edge, selected: change.selected } : edge;
}

/** Applies the changes reported by `onEdgesChange` to an edge array and returns a new array. */
export function applyEdgeChanges<TEdge extends EdgeBase>(
  changes: readonly EdgeChange<TEdge>[],
  edges: readonly TEdge[],
): TEdge[] {
  return applyChanges<TEdge, EdgeChange<TEdge>>(changes, edges, applyEdgeField);
}
