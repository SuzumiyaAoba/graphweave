import type { NodeChange } from "@free-flow/core";
import { useLayoutEffect, useState } from "react";

import type { ReactFlowStore } from "./store-context.ts";
import type { Edge, Node } from "./types.ts";

/** New nodes or edges, or how to make them from the ones there are. */
export type ListPayload<TItem> = TItem[] | ((current: TItem[]) => TItem[]);

type Structural<TItem> =
  | { type: "add"; item: TItem; index: number }
  | { type: "remove"; id: string }
  | { type: "replace"; id: string; item: TItem };

// The changes that turn `previous` into `next`, in React Flow's order: what is a different object
// is replaced and what is new is added (with where it is), then what is gone is removed.
function diffElements<TItem extends { id: string }>(
  previous: readonly TItem[],
  next: readonly TItem[],
): Structural<TItem>[] {
  const before = new Map(previous.map((item) => [item.id, item]));
  const after = new Set(next.map((item) => item.id));
  const kept = next.flatMap((item, index): Structural<TItem>[] => {
    const old = before.get(item.id);
    if (old === undefined) {
      return [{ type: "add", item, index }];
    }
    return old === item ? [] : [{ type: "replace", id: item.id, item }];
  });
  const removed = previous
    .filter((item) => !after.has(item.id))
    .map((item): Structural<TItem> => ({ type: "remove", id: item.id }));
  return [...kept, ...removed];
}

// Arrays are never callable, so a function payload is the "compute it from the current one" form.
function resolveAll<TItem>(payloads: readonly ListPayload<TItem>[], current: TItem[]): TItem[] {
  let next = current;
  for (const payload of payloads) {
    next = typeof payload === "function" ? payload(next) : payload;
  }
  return next;
}

function throughMiddleware(store: ReactFlowStore, changes: NodeChange<Node>[]): NodeChange<Node>[] {
  let told = changes;
  for (const middleware of store.getState().onNodesChangeMiddlewareMap.values()) {
    told = middleware(told);
  }
  return told;
}

// A flow that owns its nodes takes the new array; the owner is told what changed either way. As in
// React Flow the flow takes the nodes as they were asked for, and what the owner hears has been
// through the node middleware.
function applyNodes(store: ReactFlowStore, payloads: readonly ListPayload<Node>[]): boolean {
  const state = store.getState();
  const next = resolveAll(payloads, state.nodes);
  const told = throughMiddleware(store, diffElements(state.nodes, next));
  if (state.hasDefaultNodes) {
    state.setNodes(next);
  }
  if (told.length > 0) {
    state.onNodesChange?.(told);
  }
  return !state.hasDefaultNodes && told.length > 0;
}

// A flow that owns its edges takes the new array, and is not told; the owner of the edges is, and as
// in React Flow even when nothing changed (with no changes then), unlike for the nodes.
function applyEdges(store: ReactFlowStore, payloads: readonly ListPayload<Edge>[]): void {
  const state = store.getState();
  const next = resolveAll(payloads, state.edges);
  if (state.hasDefaultEdges) {
    state.setEdges(next);
    return;
  }
  const changes = diffElements(state.edges, next);
  if (changes.length === 0) {
    state.onEdgesChange?.([]);
  } else {
    state.triggerEdgeChanges(changes);
  }
}

/** What the instance has been asked to do to the nodes and edges, and how the flow is woken for it. */
interface Queue {
  nodes: ListPayload<Node>[];
  edges: ListPayload<Edge>[];
  /** Makes the flow render, so that the queue is run before its next paint. */
  wake: (() => void) | undefined;
  /** How many times the flow has been woken for the queue, as of its last run. */
  served: number;
  /** Whether the flow that ran the queue has gone away: what is asked for then is dropped. */
  gone: boolean;
}

const queues = new WeakMap<ReactFlowStore, Queue>();

function queueOf(store: ReactFlowStore): Queue {
  const known = queues.get(store);
  if (known !== undefined) {
    return known;
  }
  const queue: Queue = { nodes: [], edges: [], wake: undefined, served: 0, gone: false };
  queues.set(store, queue);
  return queue;
}

/**
 * Runs what has been queued: the nodes as one change, then the edges as one. Tells whether the
 * owner of the nodes was handed changes to apply, so that the new nodes are still to come.
 */
export function flushBatch(store: ReactFlowStore): { nodesToCome: boolean } {
  const queue = queueOf(store);
  if (queue.gone) {
    // A flow that went away runs nothing: what was asked for waits for it to come back.
    return { nodesToCome: false };
  }
  const { nodes, edges } = queue;
  queue.nodes = [];
  queue.edges = [];
  const nodesToCome = nodes.length > 0 && applyNodes(store, nodes);
  if (edges.length > 0) {
    applyEdges(store, edges);
  }
  return { nodesToCome };
}

// As in React Flow, what the instance is asked to do to the nodes and edges is not done at once: the
// calls made before the flow renders next are run together then, each on the outcome of the one
// before. Without a flow on the page to render they are run as soon as the caller is done.
function schedule(store: ReactFlowStore): void {
  const queue = queueOf(store);
  const { wake } = queue;
  if (queue.gone) {
    // As in React Flow nothing is done while the flow is away: what is asked for waits for it to
    // come back (a flow that was only hidden), and is never done for one that does not.
    return;
  }
  if (wake === undefined) {
    queueMicrotask(() => {
      flushBatch(store);
    });
  } else {
    wake();
  }
}

export function enqueueNodes(store: ReactFlowStore, payload: ListPayload<Node>): void {
  queueOf(store).nodes.push(payload);
  schedule(store);
}

export function enqueueEdges(store: ReactFlowStore, payload: ListPayload<Edge>): void {
  queueOf(store).edges.push(payload);
  schedule(store);
}

/** Runs the queue of the store in a layout effect of the flow, whenever something was queued. */
export function useBatchQueue(store: ReactFlowStore): void {
  const [serial, setSerial] = useState(0);
  useLayoutEffect(() => {
    const queue = queueOf(store);
    queue.gone = false;
    queue.wake = (): void => {
      setSerial((count) => count + 1);
    };
    return (): void => {
      queue.wake = undefined;
      queue.gone = true;
    };
  }, [store]);
  // Every render that a call asked for runs the queue; one that nothing asked for finds it empty.
  useLayoutEffect(() => {
    queueOf(store).served = serial;
    flushBatch(store);
  }, [store, serial]);
}
