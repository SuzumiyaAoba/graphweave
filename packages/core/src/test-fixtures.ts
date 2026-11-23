import type { EdgeBase, NodeBase } from "./types.ts";

/** A node at the origin; `extra` overrides any field. Shared by the tests. */
export function makeNode(id: string, extra: Partial<NodeBase> = {}): NodeBase {
  return { id, position: { x: 0, y: 0 }, data: {}, ...extra };
}

/** An edge from `source` to `target`; `extra` overrides any field. Shared by the tests. */
export function makeEdge(
  id: string,
  ends: [source: string, target: string],
  extra: Partial<EdgeBase> = {},
): EdgeBase {
  return { id, source: ends[0], target: ends[1], ...extra };
}

export function idsOf(items: readonly { id: string }[]): string[] {
  return items.map((item) => item.id);
}
