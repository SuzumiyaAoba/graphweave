import type { DragSession } from "@graphweave/core";

import type { ReactFlowStore } from "./store-context.ts";
import type { Node } from "./types.ts";

/**
 * The nodes the drag callbacks are told, as React Flow tells them: copies of the owner's nodes,
 * where the drag has put them and flagged as being dragged (not any more at the end), whether or not
 * the owner has taken the changes yet. The pressed node, if any, comes apart.
 */
export function draggedNodes(
  context: { store: ReactFlowStore; nodeId?: string | undefined },
  session: Pick<DragSession, "positions">,
  dragging: boolean,
): { pressed: Node | undefined; nodes: Node[] } {
  const { nodeLookup } = context.store.getState();
  const positions = session.positions();
  const nodes = positions.flatMap(({ id, position }) => {
    const node = nodeLookup.get(id)?.internals.userNode;
    return node === undefined ? [] : [{ ...node, position, dragging }];
  });
  const { nodeId } = context;
  const user = nodeId === undefined ? undefined : nodeLookup.get(nodeId)?.internals.userNode;
  const at = positions.find(({ id }) => id === nodeId)?.position;
  const pressed =
    user === undefined ? undefined : { ...user, position: at ?? user.position, dragging };
  return { pressed, nodes };
}
