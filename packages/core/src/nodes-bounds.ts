import type { InternalNode } from "./flow-state.ts";
import type { Rect } from "./geometry.ts";
import { getBoundsOfRects, getNodeRect, nodeSize } from "./graph.ts";
import type { NodeBase, NodeOrigin } from "./types.ts";

export interface NodeBoundsOptions {
  nodeOrigin?: NodeOrigin;
  /** The flow's nodes: ids are found in it, and nodes are taken as the flow has them (sub flows). */
  nodeLookup?: ReadonlyMap<string, InternalNode>;
}

function isInternalNode(node: NodeBase): node is InternalNode {
  // As React Flow tells them: what has internals, and is not an edge.
  return "internals" in node && !("source" in node) && !("target" in node);
}

// The node a bound is taken of: through the lookup when there is one; an id without one is none.
function boundsNodeOf(
  item: string | NodeBase,
  lookup: ReadonlyMap<string, InternalNode> | undefined,
): NodeBase | undefined {
  if (typeof item === "string") {
    return lookup?.get(item);
  }
  return lookup === undefined || isInternalNode(item) ? item : lookup.get(item.id);
}

/**
 * The box around the given nodes, given as nodes, internal nodes or (with a `nodeLookup`) ids. As in
 * React Flow, what cannot be found is left out, and nothing left gives a box of no size at the origin.
 */
export function getNodesBounds(
  nodes: readonly (string | NodeBase)[],
  options: NodeBoundsOptions = {},
): Rect {
  const rects = nodes.flatMap((item) => {
    const node = boundsNodeOf(item, options.nodeLookup);
    if (node === undefined) {
      return [];
    }
    return isInternalNode(node)
      ? [{ ...node.internals.positionAbsolute, ...nodeSize(node) }]
      : [getNodeRect(node, options.nodeOrigin)];
  });
  return getBoundsOfRects(rects);
}
