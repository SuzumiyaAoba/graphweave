import { errorMessages } from "@graphweave/core";
import type { OnError } from "@graphweave/core";

import type { ReactFlowStore } from "./store-context.ts";

function leaveSelection(
  state: ReturnType<ReactFlowStore["getState"]>,
  id: string,
  unselect: boolean,
): boolean {
  const leaves = unselect || state.multiSelectionActive;
  if (leaves) {
    state.unselectNodesAndEdges({ nodes: [{ id }], edges: [] });
  }
  return leaves;
}

// What a click, or Enter, Space or Escape on a focused node, does to its selection, as React Flow's
// `handleNodeClick`: a node that is not selected becomes selected (also for Escape); a selected one
// leaves the selection for Escape, and for a click while several are being selected. Resolves to
// whether the node left the selection.
export function selectFromClick(
  store: ReactFlowStore,
  id: string,
  { onError, unselect = false }: { onError: OnError | undefined; unselect?: boolean },
): boolean {
  const state = store.getState();
  const node = state.nodeLookup.get(id);
  if (node === undefined) {
    // The node went away before its click was handled, which React Flow tells of.
    onError?.("012", errorMessages.error012(id));
    return false;
  }
  if (node.selected !== true) {
    state.addSelectedNodes([id]);
    return false;
  }
  return leaveSelection(state, id, unselect);
}

export const SELECTION_KEYS = new Set(["Enter", " ", "Escape"]);
