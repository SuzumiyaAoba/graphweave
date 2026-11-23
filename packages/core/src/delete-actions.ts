import type { DeletedElements, ElementsToDelete, FlowStore } from "./flow-store-types.ts";
import { getConnectedEdges } from "./graph.ts";
import type { EdgeBase, NodeBase } from "./types.ts";

interface Doomed<TNode extends NodeBase, TEdge extends EdgeBase> {
  nodes: TNode[];
  edges: TEdge[];
}

// Whether the node goes next: it may be deleted, was asked for or has a parent that goes.
function goesNext(node: NodeBase, goes: ReadonlySet<string>, asked: ReadonlySet<string>): boolean {
  return (
    node.deletable !== false &&
    !goes.has(node.id) &&
    (asked.has(node.id) || goes.has(node.parentId ?? ""))
  );
}

// A node goes when it was asked for and may be deleted, or when its parent goes. React Flow needs
// the parent to come first in the list to take the child along; here the order does not matter, so
// that a child is never left behind with a parent that is gone. The result keeps the list's order.
function nodesToRemove<TNode extends NodeBase>(
  nodes: readonly TNode[],
  asked: ReadonlySet<string>,
): TNode[] {
  const goes = new Set<string>();
  let grew = true;
  while (grew) {
    const going = nodes.filter((node) => goesNext(node, goes, asked));
    grew = going.length > 0;
    for (const { id } of going) {
      goes.add(id);
    }
  }
  return nodes.filter(({ id }) => goes.has(id));
}

// Elements that share an id count once, as they do in React Flow, which looks elements up by id: the
// one that comes last, where the first of them was.
function oncePerId<TItem extends { id: string }>(items: readonly TItem[]): TItem[] {
  return [...new Map(items.map((item) => [item.id, item])).values()];
}

// What a deletion request actually removes: undeletable elements stay, and the edges of removed
// nodes go with them (those that may be deleted: an undeletable edge stays, as in React Flow).
function collectDoomed<TNode extends NodeBase, TEdge extends EdgeBase>(
  api: FlowStore<TNode, TEdge>,
  elements: ElementsToDelete,
): Doomed<TNode, TEdge> {
  const state = api.getState();
  const nodes = nodesToRemove(state.nodes, new Set((elements.nodes ?? []).map(({ id }) => id)));
  const askedEdges = new Set((elements.edges ?? []).map(({ id }) => id));
  const deletable = state.edges.filter((edge) => edge.deletable !== false);
  // The edges that touch the removed nodes come first, then the ones that were asked for.
  const edges = getConnectedEdges(nodes, deletable);
  for (const edge of deletable) {
    if (askedEdges.has(edge.id) && !edges.includes(edge)) {
      edges.push(edge);
    }
  }
  return { nodes: oncePerId(nodes), edges: oncePerId(edges) };
}

// Reports the removal to the owner's delete callbacks and to the flow, in the order React Flow does:
// edges, then nodes, then everything together; a list with nothing in it is not reported.
function commitDeletion<TNode extends NodeBase, TEdge extends EdgeBase>(
  api: FlowStore<TNode, TEdge>,
  { nodes, edges }: Doomed<TNode, TEdge>,
): void {
  const state = api.getState();
  if (edges.length > 0) {
    state.onEdgesDelete?.(edges);
    state.triggerEdgeChanges(edges.map(({ id }) => ({ id, type: "remove" })));
  }
  if (nodes.length > 0) {
    state.onNodesDelete?.(nodes);
    state.triggerNodeChanges(nodes.map(({ id }) => ({ id, type: "remove" })));
  }
  if (nodes.length > 0 || edges.length > 0) {
    state.onDelete?.({ nodes, edges });
  }
}

export async function deleteElements<TNode extends NodeBase, TEdge extends EdgeBase>(
  api: FlowStore<TNode, TEdge>,
  elements: ElementsToDelete,
): Promise<DeletedElements<TNode, TEdge>> {
  const doomed = collectDoomed(api, elements);
  const { onBeforeDelete } = api.getState();
  // A callback that answers with nothing (possible from plain JavaScript) deletes nothing: the
  // commit below throws, as React Flow's does.
  // Awaited also without one, as React Flow's is: the elements go after the caller's code has run.
  const verdict = await (onBeforeDelete?.(doomed) ?? true);
  if (verdict === false) {
    return { deletedNodes: [], deletedEdges: [] };
  }
  const approved = verdict === true ? doomed : verdict;
  commitDeletion(api, approved);
  return { deletedNodes: approved.nodes, deletedEdges: approved.edges };
}
