import {
  connectionKey,
  getBoundsOfRects,
  isEdge,
  isNode,
  nodeSize,
  rectOverlapArea,
} from "@graphweave/core";
import type { InternalNode, Rect } from "@graphweave/core";

import { enqueueEdges, enqueueNodes } from "./batch-queue.ts";
import type { ReactFlowInstance, UpdateOptions } from "./instance-types.ts";
import type { ReactFlowStore } from "./store-context.ts";
import type { Edge, Node } from "./types.ts";

type GraphMethodNames =
  | "getNodes"
  | "setNodes"
  | "addNodes"
  | "getNode"
  | "getInternalNode"
  | "getEdges"
  | "setEdges"
  | "addEdges"
  | "getEdge"
  | "deleteElements"
  | "getIntersectingNodes"
  | "isNodeIntersecting"
  | "updateNode"
  | "updateNodeData"
  | "updateEdge"
  | "updateEdgeData"
  | "getNodesBounds"
  | "getNodeConnections"
  | "getHandleConnections";

function asArray<TItem>(value: TItem | TItem[]): TItem[] {
  return Array.isArray(value) ? value : [value];
}

// The element after an update: the patch merged into it, or, with `replace`, the patch itself. As in
// React Flow a node or edge is only replaced by a complete one (`complete`); else it is merged.
function updated<TItem extends object>(
  current: TItem,
  update: Partial<TItem> | ((current: TItem) => Partial<TItem>),
  rule: { replace: boolean; complete: (patch: Partial<TItem>) => boolean },
): TItem {
  const patch = typeof update === "function" ? update(current) : update;
  if (rule.replace && rule.complete(patch)) {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- a replacement is a complete element
    return { ...patch } as TItem;
  }
  return { ...current, ...patch };
}

// The data of an element after an update: the patch merged into it, or with `replace` in its place.
function updatedData<TData extends object>(
  current: TData,
  patch: Partial<TData>,
  options: UpdateOptions | undefined,
): TData {
  return updated(current, patch, { replace: options?.replace === true, complete: () => true });
}

function updateNodes(store: ReactFlowStore, id: string, change: (node: Node) => Node): void {
  enqueueNodes(store, (nodes) => nodes.map((node) => (node.id === id ? change(node) : node)));
}

function updateEdges(store: ReactFlowStore, id: string, change: (edge: Edge) => Edge): void {
  enqueueEdges(store, (edges) => edges.map((edge) => (edge.id === id ? change(edge) : edge)));
}

function rectOf(node: InternalNode): Rect {
  return { ...node.internals.positionAbsolute, ...nodeSize(node) };
}

function isRect(value: { id: string } | Rect): value is Rect {
  return !("id" in value);
}

// The box of a node handed over whole (with its position), taken as it is, as React Flow's getNodeRect
// takes it: the node handed to onNodeDrag is where the drag has put it, though the flow may not have it
// there yet. Its position is made absolute with its parent's (React Flow's own sum, which takes the
// child's size with the parent's origin, is not copied), and its origin is taken off.
function rectOfGiven(store: ReactFlowStore, node: Node): Rect {
  const { nodeLookup, nodeOrigin } = store.getState();
  // A node object that does not carry its size (its owner did not take the measuring) has the size the
  // flow knows it by: React Flow takes it as having none, and then as meeting every node.
  const internal = nodeLookup.get(node.id);
  const known = internal === undefined ? undefined : rectOf(internal);
  const width = node.measured?.width ?? node.width ?? node.initialWidth ?? known?.width ?? 0;
  const height = node.measured?.height ?? node.height ?? node.initialHeight ?? known?.height ?? 0;
  const parent = node.parentId === undefined ? undefined : nodeLookup.get(node.parentId);
  const base = parent?.internals.positionAbsolute ?? { x: 0, y: 0 };
  const [originX, originY] = node.origin ?? nodeOrigin;
  const x = base.x + node.position.x - width * originX;
  return { x, y: base.y + node.position.y - height * originY, width, height };
}

function isGivenNode(target: { id: string }): target is Node {
  return "position" in target && !("internals" in target);
}

function isInternal(target: { id: string }): target is InternalNode {
  return "internals" in target;
}

function rectFor(store: ReactFlowStore, target: { id: string } | Rect): Rect | undefined {
  if (isRect(target)) {
    return target;
  }
  // An internal node is where it says it is, as React Flow reads its `positionAbsolute`.
  if (isInternal(target)) {
    return rectOf(target);
  }
  if (isGivenNode(target)) {
    return rectOfGiven(store, target);
  }
  const internal = store.getState().nodeLookup.get(target.id);
  return internal === undefined ? undefined : rectOf(internal);
}

// As React Flow decides it: any overlap counts when `partially`; otherwise one of the two has to lie
// inside the other (the overlap is as big as the smaller one).
function within(inner: Rect, outer: Rect): boolean {
  const right = inner.x + inner.width <= outer.x + outer.width;
  const below = inner.y + inner.height <= outer.y + outer.height;
  return inner.x >= outer.x && inner.y >= outer.y && right && below;
}

function intersects(rect: Rect, area: Rect, partially: boolean): boolean {
  // A box of no size (a point, a line) meets what holds it: React Flow takes it to meet everything.
  if (rect.width * rect.height <= 0 || area.width * area.height <= 0) {
    return within(rect, area) || within(area, rect);
  }
  // Rounded up, as React Flow's getOverlappingArea rounds it.
  const overlap = Math.ceil(rectOverlapArea(rect, area));
  return (
    (partially && overlap > 0) ||
    overlap >= area.width * area.height ||
    overlap >= rect.width * rect.height
  );
}

function nodeIntersects(
  store: ReactFlowStore,
  target: { id: string } | Rect,
  options: { area: Rect; partially: boolean },
): boolean {
  const rect = rectFor(store, target);
  return rect !== undefined && intersects(rect, options.area, options.partially);
}

// As in React Flow, the nodes of the flow are where the flow has them, and nodes handed over to look
// among are where they say they are.
function candidateRect(store: ReactFlowStore, node: Node, given: boolean): Rect | undefined {
  if (given) {
    return isInternal(node) ? rectOf(node) : rectOfGiven(store, node);
  }
  const internal = store.getState().nodeLookup.get(node.id);
  return internal === undefined ? undefined : rectOf(internal);
}

function getIntersectingNodes(
  store: ReactFlowStore,
  target: { id: string } | Rect,
  options: { partially: boolean; candidates: Node[] | undefined },
): Node[] {
  const rect = rectFor(store, target);
  if (rect === undefined) {
    return [];
  }
  const given = options.candidates !== undefined;
  return (options.candidates ?? store.getState().nodes).filter((node) => {
    const isSelf = !isRect(target) && node.id === target.id;
    const box = candidateRect(store, node, given);
    return !isSelf && box !== undefined && intersects(rect, box, options.partially);
  });
}

function getNodesBounds(store: ReactFlowStore, nodes: readonly (string | { id: string })[]): Rect {
  const { nodeLookup } = store.getState();
  const rects = nodes.flatMap((node) => {
    const internal = nodeLookup.get(typeof node === "string" ? node : node.id);
    return internal === undefined ? [] : [rectOf(internal)];
  });
  return getBoundsOfRects(rects);
}

function connectionsOf(
  store: ReactFlowStore,
  params: Parameters<ReactFlowInstance["getNodeConnections"]>[0],
): ReturnType<ReactFlowInstance["getNodeConnections"]> {
  const key = connectionKey(params.nodeId, params.type, params.handleId);
  return [...(store.getState().connectionLookup.get(key)?.values() ?? [])];
}

type NodeMethodNames =
  | "getNodes"
  | "setNodes"
  | "addNodes"
  | "getNode"
  | "getInternalNode"
  | "getIntersectingNodes"
  | "isNodeIntersecting"
  | "updateNode"
  | "updateNodeData"
  | "getNodesBounds";

type EdgeMethodNames =
  | "getEdges"
  | "setEdges"
  | "addEdges"
  | "getEdge"
  | "updateEdge"
  | "updateEdgeData";

function createNodeMethods(store: ReactFlowStore): Pick<ReactFlowInstance, NodeMethodNames> {
  return {
    getNodes: () => store.getState().nodes,
    setNodes: (payload) => {
      enqueueNodes(store, payload);
    },
    addNodes: (payload) => {
      enqueueNodes(store, (nodes) => [...nodes, ...asArray(payload)]);
    },
    getNode: (id) => store.getState().nodeLookup.get(id)?.internals.userNode,
    getInternalNode: (id) => store.getState().nodeLookup.get(id),
    getIntersectingNodes: (target, partially, candidates) =>
      getIntersectingNodes(store, target, { partially: partially ?? true, candidates }),
    isNodeIntersecting: (target, area, partially = true) =>
      nodeIntersects(store, target, { area, partially }),
    updateNode: (id, update, options) => {
      updateNodes(store, id, (node) =>
        updated(node, update, { replace: options?.replace === true, complete: isNode }),
      );
    },
    updateNodeData: (id, update, options) => {
      updateNodes(store, id, (node) => ({
        ...node,
        data: updatedData(node.data, typeof update === "function" ? update(node) : update, options),
      }));
    },
    getNodesBounds: (nodes) => getNodesBounds(store, nodes),
  };
}

function createEdgeMethods(store: ReactFlowStore): Pick<ReactFlowInstance, EdgeMethodNames> {
  return {
    getEdges: () => store.getState().edges,
    setEdges: (payload) => {
      enqueueEdges(store, payload);
    },
    addEdges: (payload) => {
      enqueueEdges(store, (edges) => [...edges, ...asArray(payload)]);
    },
    getEdge: (id) => store.getState().edgeLookup.get(id),
    updateEdge: (id, update, options) => {
      updateEdges(store, id, (edge) =>
        updated(edge, update, { replace: options?.replace === true, complete: isEdge }),
      );
    },
    updateEdgeData: (id, update, options) => {
      updateEdges(store, id, (edge) => ({
        ...edge,
        data: updatedData(
          edge.data ?? {},
          typeof update === "function" ? update(edge) : update,
          options,
        ),
      }));
    },
  };
}

async function deleteElementsOf(
  store: ReactFlowStore,
  params: Parameters<ReactFlowInstance["deleteElements"]>[0],
): ReturnType<ReactFlowInstance["deleteElements"]> {
  const deleted = await store.getState().deleteElements(params);
  return deleted;
}

/** The node and edge methods of the instance. */
export function createGraphInstance(
  store: ReactFlowStore,
): Pick<ReactFlowInstance, GraphMethodNames> {
  return {
    ...createNodeMethods(store),
    ...createEdgeMethods(store),
    // Bound rather than wrapped: a wrapper returning a promise would itself have to be async.
    deleteElements: deleteElementsOf.bind(undefined, store),
    getNodeConnections: (params) => connectionsOf(store, params),
    // oxlint-disable-next-line typescript/no-deprecated -- provided for React Flow compatibility
    getHandleConnections: ({ id, ...params }) =>
      connectionsOf(store, id === undefined ? params : { ...params, handleId: id }),
  };
}
