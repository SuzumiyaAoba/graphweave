import { useEffect } from "react";

import { handled } from "./handled.ts";
import type { ReactFlowStore } from "./store-context.ts";
import { useKeyPress } from "./use-key-press.ts";
import { useViewProps } from "./view-props.ts";
import type { ViewPropsStore } from "./view-props.ts";

/**
 * The keyboard shortcuts of the flow as a whole: the key that adds to a selection while held, and
 * the key that deletes the selected nodes and edges.
 */
export function useGlobalKeys(store: ReactFlowStore, view: ViewPropsStore): void {
  const deleteKeyCode = useViewProps((props) => props.deleteKeyCode);
  const multiSelectionKeyCode = useViewProps((props) => props.multiSelectionKeyCode);
  const deletePressed = useKeyPress(deleteKeyCode, { actInsideInputWithModifier: false });
  const multiSelectionPressed = useKeyPress(multiSelectionKeyCode, {
    target: globalThis.window,
  });
  useEffect(() => {
    store.setState({ multiSelectionActive: multiSelectionPressed });
  }, [multiSelectionPressed, store]);
  useEffect(() => {
    if (!deletePressed) {
      return;
    }
    const { nodes, edges, deleteElements } = store.getState();
    handled(
      deleteElements({
        nodes: nodes.filter((node) => node.selected === true),
        edges: edges.filter((edge) => edge.selected === true),
      }),
      (failure) => {
        view.getState().onError?.("100", `Deleting the selection failed: ${String(failure)}`);
      },
    );
    // As in React Flow the frame around the selection goes, whatever `onBeforeDelete` answers.
    store.setState({ nodesSelectionActive: false });
  }, [deletePressed, store, view]);
}
