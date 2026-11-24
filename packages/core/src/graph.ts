import { errorMessages } from "./error-messages.ts";
import type { OnError } from "./error-messages.ts";
import type { Rect } from "./geometry.ts";
import type { Connection, EdgeBase, NodeBase, NodeOrigin } from "./types.ts";

const DEFAULT_NODE_ORIGIN: NodeOrigin = [0, 0];

const EMPTY_RECT: Rect = { x: 0, y: 0, width: 0, height: 0 };

/** Narrows an unknown element to a node: it has an `id` and a `position` but no `source`/`target`. */
// oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- mirrors React Flow, where callers name their node type
export function isNode<TNode extends NodeBase = NodeBase>(element: unknown): element is TNode {
  return (
    typeof element === "object" &&
    element !== null &&
    "id" in element &&
    "position" in element &&
    !("source" in element) &&
    !("target" in element)
  );
}

/** Narrows an unknown element to an edge: it has an `id`, a `source` and a `target`. */
// oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- mirrors React Flow, where callers name their edge type
export function isEdge<TEdge extends EdgeBase = EdgeBase>(element: unknown): element is TEdge {
  return (
    typeof element === "object" &&
    element !== null &&
    "id" in element &&
    "source" in element &&
    "target" in element
  );
}

type EdgeEnds = Pick<EdgeBase, "source" | "target">;

/** Nodes with an edge that points at `node`, in the order of `nodes`. */
// oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- React Flow takes the edge type too
export function getIncomers<TNode extends NodeBase, TEdge extends EdgeEnds = EdgeEnds>(
  node: Pick<NodeBase, "id">,
  nodes: readonly TNode[],
  edges: readonly TEdge[],
): TNode[] {
  const sources = new Set<string>();
  for (const edge of edges) {
    if (edge.target === node.id) {
      sources.add(edge.source);
    }
  }
  return nodes.filter((candidate) => sources.has(candidate.id));
}

/** Nodes that an edge from `node` points at, in the order of `nodes`. */
// oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- React Flow takes the edge type too
export function getOutgoers<TNode extends NodeBase, TEdge extends EdgeEnds = EdgeEnds>(
  node: Pick<NodeBase, "id">,
  nodes: readonly TNode[],
  edges: readonly TEdge[],
): TNode[] {
  const targets = new Set<string>();
  for (const edge of edges) {
    if (edge.source === node.id) {
      targets.add(edge.target);
    }
  }
  return nodes.filter((candidate) => targets.has(candidate.id));
}

/** Edges that start or end at any of `nodes`. */
// As in React Flow, the node type comes first, then the edge type.
export function getConnectedEdges<
  // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- React Flow takes the node type too
  TNode extends Pick<NodeBase, "id"> = Pick<NodeBase, "id">,
  TEdge extends EdgeEnds = EdgeEnds,
>(nodes: readonly TNode[], edges: readonly TEdge[]): TEdge[] {
  const ids = new Set(nodes.map((node) => node.id));
  return edges.filter((edge) => ids.has(edge.source) || ids.has(edge.target));
}

/** The size a node is drawn at: measured, else given, else its initial size. */
export function nodeSize(node: NodeBase): { width: number; height: number } {
  return {
    width: node.measured?.width ?? node.width ?? node.initialWidth ?? 0,
    height: node.measured?.height ?? node.height ?? node.initialHeight ?? 0,
  };
}

/**
 * The rectangle a node occupies in flow coordinates. `position` is interpreted through the node's
 * own `origin`, falling back to `nodeOrigin`. Parent-relative positions are not resolved here.
 */
export function getNodeRect(node: NodeBase, nodeOrigin: NodeOrigin = DEFAULT_NODE_ORIGIN): Rect {
  const [originX, originY] = node.origin ?? nodeOrigin;
  const { width, height } = nodeSize(node);
  return {
    x: node.position.x - width * originX,
    y: node.position.y - height * originY,
    width,
    height,
  };
}

interface Extent {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function growExtent(extent: Extent, rect: Rect): void {
  extent.minX = Math.min(extent.minX, rect.x);
  extent.minY = Math.min(extent.minY, rect.y);
  extent.maxX = Math.max(extent.maxX, rect.x + rect.width);
  extent.maxY = Math.max(extent.maxY, rect.y + rect.height);
}

/** The smallest rectangle that contains every rectangle; an empty input gives a zero rectangle. */
export function getBoundsOfRects(rects: Iterable<Rect>): Rect {
  const extent: Extent = {
    minX: Number.POSITIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
  };
  for (const rect of rects) {
    growExtent(extent, rect);
  }
  if (extent.minX === Number.POSITIVE_INFINITY) {
    return { ...EMPTY_RECT };
  }
  return {
    x: extent.minX,
    y: extent.minY,
    width: extent.maxX - extent.minX,
    height: extent.maxY - extent.minY,
  };
}

/**
 * The smallest rectangle that contains every given node, hidden ones too (as in React Flow); an
 * empty input gives a zero rectangle.
 */

/** The id `addEdge` and `reconnectEdge` give to an edge made from a connection. */
export function getEdgeId(connection: Connection): string {
  const { source, sourceHandle, target, targetHandle } = connection;
  return `xy-edge__${source}${sourceHandle ?? ""}-${target}${targetHandle ?? ""}`;
}

// A handle that is `null` means "no handle", which an edge expresses by leaving the property out.
function withoutNullHandles<TEdge extends EdgeBase>(edge: TEdge): TEdge {
  const copy = { ...edge };
  if (copy.sourceHandle === null) {
    delete copy.sourceHandle;
  }
  if (copy.targetHandle === null) {
    delete copy.targetHandle;
  }
  return copy;
}

function noHandle(handle: string | null | undefined): boolean {
  return handle === undefined || handle === null || handle === "";
}

// As React Flow works it out: handles that are both empty (missing, null or "") are the same one.
function connectionExists(edge: EdgeBase, edges: readonly EdgeBase[]): boolean {
  return edges.some(
    (other) =>
      other.source === edge.source &&
      other.target === edge.target &&
      (other.sourceHandle === edge.sourceHandle ||
        (noHandle(other.sourceHandle) && noHandle(edge.sourceHandle))) &&
      (other.targetHandle === edge.targetHandle ||
        (noHandle(other.targetHandle) && noHandle(edge.targetHandle))),
  );
}

export interface AddEdgeOptions {
  /** Derives the id of an edge made from a connection; `getEdgeId` when left out. */
  getEdgeId?: ((connection: Connection) => string) | undefined;
  /** Told (code 006) when `source` or `target` is missing. */
  onError?: OnError | undefined;
}

/**
 * Adds an edge built from a connection (or a full edge) and returns a new array. Returns the input
 * array itself when the same connection already exists or `source`/`target` are missing, as React
 * Flow does.
 */
export function addEdge<TEdge extends EdgeBase>(
  edgeParams: TEdge | Connection,
  edges: TEdge[],
  options: AddEdgeOptions = {},
): TEdge[] {
  if (!edgeParams.source || !edgeParams.target) {
    options.onError?.("006", errorMessages.error006());
    return edges;
  }
  const edge = isEdge<TEdge>(edgeParams)
    ? { ...edgeParams }
    : // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- a connection becomes an edge of the caller's own edge type
      ({ ...edgeParams, id: (options.getEdgeId ?? getEdgeId)(edgeParams) } as TEdge);
  if (connectionExists(edge, edges)) {
    return edges;
  }
  return [...edges, withoutNullHandles(edge)];
}

export interface ReconnectEdgeOptions {
  /** Derive a new id from the new connection. Defaults to `true`; `false` keeps the old id. */
  shouldReplaceId?: boolean;
  /** Derives the id of the new edge; `getEdgeId` when left out. */
  getEdgeId?: ((connection: Connection) => string) | undefined;
  /** Told (code 006) when the connection has no `source` or `target`, and (code 007) when the old edge is not there. */
  onError?: OnError | undefined;
}

// Whether the reconnection cannot go ahead, telling `onError` why when it is a mistake: the new
// connection has no end, or the old edge is not there.
function cannotReconnect<TEdge extends EdgeBase>(
  request: { oldEdge: TEdge; newConnection: Connection; edges: readonly TEdge[] },
  onError: OnError | undefined,
): boolean {
  const { oldEdge, newConnection, edges } = request;
  if (!newConnection.source || !newConnection.target) {
    onError?.("006", errorMessages.error006());
    return true;
  }
  if (!edges.some((edge) => edge.id === oldEdge.id)) {
    onError?.("007", errorMessages.error007(oldEdge.id));
    return true;
  }
  return false;
}

// The edge a reconnection makes, built as React Flow builds it, keys in the same order: the old edge
// without its id, then the id, then the four ends (and nothing else of the connection).
function reconnected<TEdge extends EdgeBase>(
  oldEdge: TEdge,
  id: string,
  connection: Connection,
): TEdge {
  const next: TEdge = { ...oldEdge };
  Reflect.deleteProperty(next, "id");
  next.id = id;
  next.source = connection.source;
  next.target = connection.target;
  next.sourceHandle = connection.sourceHandle;
  next.targetHandle = connection.targetHandle;
  return next;
}

/**
 * Replaces the endpoints of `oldEdge` with `newConnection`; the edge moves to the end of the array.
 * Returns the input array itself when `oldEdge` is not there, or when the edge would get the id of
 * another edge.
 */
// oxlint-disable-next-line eslint/max-params -- keeps React Flow's positional signature
export function reconnectEdge<TEdge extends EdgeBase>(
  oldEdge: TEdge,
  newConnection: Connection,
  edges: TEdge[],
  options: ReconnectEdgeOptions = {},
): TEdge[] {
  if (cannotReconnect({ oldEdge, newConnection, edges }, options.onError)) {
    return edges;
  }
  const id =
    options.shouldReplaceId === false
      ? oldEdge.id
      : (options.getEdgeId ?? getEdgeId)(newConnection);
  // GraphWeave's own rule: an edge is not given the id that another edge has already.
  if (edges.some((edge) => edge.id === id && edge.id !== oldEdge.id)) {
    return edges;
  }
  const next = reconnected(oldEdge, id, newConnection);
  return [...edges.filter((edge) => edge.id !== oldEdge.id), next];
}
