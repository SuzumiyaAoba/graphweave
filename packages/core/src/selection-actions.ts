import type { FlowActions, FlowStore, SelectionToClear } from "./flow-store-types.ts";
import type { EdgeBase, NodeBase } from "./types.ts";

type SelectionActionNames =
  | "addSelectedNodes"
  | "addSelectedEdges"
  | "unselectNodesAndEdges"
  | "setSelection"
  | "resetSelectedElements";

interface SelectChange {
  id: string;
  type: "select";
  selected: boolean;
}

function select(id: string, selected: boolean): SelectChange {
  return { id, type: "select", selected };
}

// Changes that make the selection of `items` equal to `wanted`.
function exclusiveSelection(
  items: ReadonlyMap<string, { selected?: boolean }>,
  wanted: ReadonlySet<string>,
): SelectChange[] {
  const changes: SelectChange[] = [];
  for (const [id, item] of items) {
    const isWanted = wanted.has(id);
    if ((item.selected === true) !== isWanted) {
      changes.push(select(id, isWanted));
    }
  }
  return changes;
}

// Changes that select every id of `wanted` that exists and is not selected yet.
function additiveSelection(
  items: ReadonlyMap<string, { selected?: boolean }>,
  wanted: Iterable<string>,
): SelectChange[] {
  const changes: SelectChange[] = [];
  for (const id of wanted) {
    const item = items.get(id);
    if (item !== undefined && item.selected !== true) {
      changes.push(select(id, true));
    }
  }
  return changes;
}

function selectedIds(items: ReadonlyMap<string, { selected?: boolean }>): string[] {
  return [...items].filter(([, item]) => item.selected === true).map(([id]) => id);
}

function addSelectedNodes<TNode extends NodeBase, TEdge extends EdgeBase>(
  api: FlowStore<TNode, TEdge>,
  ids: readonly string[],
): void {
  api.setState({ nodesSelectionActive: false });
  const state = api.getState();
  if (state.multiSelectionActive) {
    state.triggerNodeChanges(additiveSelection(state.nodeLookup, ids));
    return;
  }
  state.triggerNodeChanges(exclusiveSelection(state.nodeLookup, new Set(ids)));
  state.triggerEdgeChanges(exclusiveSelection(state.edgeLookup, new Set()));
}

function addSelectedEdges<TNode extends NodeBase, TEdge extends EdgeBase>(
  api: FlowStore<TNode, TEdge>,
  ids: readonly string[],
): void {
  api.setState({ nodesSelectionActive: false });
  const state = api.getState();
  if (state.multiSelectionActive) {
    state.triggerEdgeChanges(additiveSelection(state.edgeLookup, ids));
    return;
  }
  state.triggerEdgeChanges(exclusiveSelection(state.edgeLookup, new Set(ids)));
  state.triggerNodeChanges(exclusiveSelection(state.nodeLookup, new Set()));
}

function unselectNodesAndEdges<TNode extends NodeBase, TEdge extends EdgeBase>(
  api: FlowStore<TNode, TEdge>,
  selection: SelectionToClear = {},
): void {
  const state = api.getState();
  const nodeIds = selection.nodes?.map(({ id }) => id) ?? selectedIds(state.nodeLookup);
  const edgeIds = selection.edges?.map(({ id }) => id) ?? selectedIds(state.edgeLookup);
  state.triggerNodeChanges(nodeIds.map((id) => select(id, false)));
  state.triggerEdgeChanges(edgeIds.map((id) => select(id, false)));
}

function setSelection<TNode extends NodeBase, TEdge extends EdgeBase>(
  api: FlowStore<TNode, TEdge>,
  selection: { nodes: readonly string[]; edges: readonly string[] },
): void {
  const state = api.getState();
  state.triggerNodeChanges(exclusiveSelection(state.nodeLookup, new Set(selection.nodes)));
  state.triggerEdgeChanges(exclusiveSelection(state.edgeLookup, new Set(selection.edges)));
}

export function createSelectionActions<TNode extends NodeBase, TEdge extends EdgeBase>(
  api: FlowStore<TNode, TEdge>,
): Pick<FlowActions<TNode, TEdge>, SelectionActionNames> {
  return {
    addSelectedNodes: (ids) => {
      addSelectedNodes(api, ids);
    },
    addSelectedEdges: (ids) => {
      addSelectedEdges(api, ids);
    },
    unselectNodesAndEdges: (selection) => {
      unselectNodesAndEdges(api, selection);
    },
    setSelection: (selection) => {
      setSelection(api, selection);
    },
    resetSelectedElements: () => {
      // As in React Flow: where nothing can be selected, nothing is taken out of the selection. The
      // frame around a selection goes either way (React Flow's pane takes it away itself).
      if (api.getState().elementsSelectable) {
        unselectNodesAndEdges(api);
      }
      api.setState({ nodesSelectionActive: false });
    },
  };
}
