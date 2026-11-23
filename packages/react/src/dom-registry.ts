import type { HandleFlagLists } from "./measure.ts";
import type { ReactFlowStore } from "./store-context.ts";

// The DOM element each flow renders into. The store itself knows nothing about the DOM, but
// converting a screen position to a flow position and re-measuring nodes need the element.
const elements = new WeakMap<ReactFlowStore, HTMLElement>();

export function registerFlowElement(store: ReactFlowStore, element: HTMLElement): () => void {
  elements.set(store, element);
  return () => {
    if (elements.get(store) === element) {
      elements.delete(store);
    }
  };
}

/** The element of the flow, or `undefined` before it was mounted. */
export function getFlowElement(store: ReactFlowStore): HTMLElement | undefined {
  return elements.get(store);
}

type Remeasure = () => void;

const remeasurers = new WeakMap<ReactFlowStore, Map<string, Remeasure>>();

/** Lets a node say how to measure itself again; the returned function withdraws it. */
export function registerRemeasure(
  store: ReactFlowStore,
  nodeId: string,
  remeasure: Remeasure,
): () => void {
  const byNode = remeasurers.get(store) ?? new Map<string, Remeasure>();
  byNode.set(nodeId, remeasure);
  remeasurers.set(store, byNode);
  return () => {
    if (byNode.get(nodeId) === remeasure) {
      byNode.delete(nodeId);
    }
  };
}

/** Measures the given nodes again, or every node when no ids are given. */
export function remeasureNodes(store: ReactFlowStore, ids?: readonly string[]): void {
  const byNode = remeasurers.get(store);
  const wanted = ids ?? [...(byNode?.keys() ?? [])];
  for (const id of wanted) {
    byNode?.get(id)?.();
  }
}

type FlagReader = () => HandleFlagLists;

const flagReaders = new WeakMap<ReactFlowStore, Map<string, FlagReader>>();

/** Lets a node say how to read what its handles say about connecting; the function withdraws it. */
export function registerFlagReader(
  store: ReactFlowStore,
  nodeId: string,
  read: FlagReader,
): () => void {
  const byNode = flagReaders.get(store) ?? new Map<string, FlagReader>();
  byNode.set(nodeId, read);
  flagReaders.set(store, byNode);
  return () => {
    if (byNode.get(nodeId) === read) {
      byNode.delete(nodeId);
    }
  };
}

/** Reads what the handles of a node on the page say about connecting them, if it is on the page. */
export function readHandleFlags(
  store: ReactFlowStore,
  nodeId: string,
): HandleFlagLists | undefined {
  return flagReaders.get(store)?.get(nodeId)?.();
}
