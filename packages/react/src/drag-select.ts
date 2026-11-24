import type { InternalNode } from "@graphweave/core";

import { setDraggedNode } from "./drag-flag.ts";
import type { ReactFlowState, ReactFlowStore } from "./store-context.ts";

// Dragging a node that cannot be selected by dragging clears the selection, unless it is added to.
function clearSelectionForDrag(
  state: ReactFlowState,
  node: InternalNode,
  selectable: boolean,
): void {
  const keeps = state.selectNodesOnDrag && selectable;
  if (!keeps && !state.multiSelectionActive && node.selected !== true) {
    state.unselectNodesAndEdges();
  }
}

// Selects the node as a click on it does: an unselected one is added, and a selected one leaves the
// selection when several are being picked.
function selectLikeClick(store: ReactFlowStore, node: InternalNode): void {
  const state = store.getState();
  store.setState({ nodesSelectionActive: false });
  if (node.selected !== true) {
    state.addSelectedNodes([node.id]);
  } else if (state.multiSelectionActive) {
    state.unselectNodesAndEdges({ nodes: [{ id: node.id }], edges: [] });
  }
}

/** The drag is over: no node is being dragged by its own press any more. */
export function forgetDraggedNode(store: ReactFlowStore): void {
  setDraggedNode(store, undefined);
}

/**
 * What React Flow does as the drag of a node begins (not at the press): a node that can be selected
 * by dragging is selected as by a click, and one that cannot clears the selection.
 */
export function selectAtDragStart(store: ReactFlowStore, nodeId: string | undefined): void {
  setDraggedNode(store, nodeId);
  const state = store.getState();
  const node = nodeId === undefined ? undefined : state.nodeLookup.get(nodeId);
  if (node === undefined) {
    return;
  }
  const selectable = node.selectable ?? state.elementsSelectable;
  clearSelectionForDrag(state, node, selectable);
  if (selectable && state.selectNodesOnDrag) {
    selectLikeClick(store, node);
  }
}
