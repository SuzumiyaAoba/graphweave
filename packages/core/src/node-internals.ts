import type { HandleBounds, InternalNode } from "./flow-state.ts";
import { absolutePositionOf } from "./node-placement.ts";
import type { PlacementOptions } from "./node-placement.ts";
import type {
  EdgeBase,
  HandleType,
  NodeBase,
  NodeConnection,
  XYPosition,
  ZIndexMode,
} from "./types.ts";

export interface InternalsOptions extends PlacementOptions {
  elevateNodesOnSelect: boolean;
  selectedNodeZ: number;
  /** How the stacking is worked out; `basic` when left out. */
  zIndexMode?: ZIndexMode | undefined;
}

// What the build adds to the options: how much further up each top-level parent is lifted.
interface BuildOptions extends InternalsOptions {
  rootOffsets: ReadonlyMap<string, number>;
}

const ROOT_PARENT_Z_INCREMENT = 10;

// Gives `parent` the next number up from `count` if it is a top-level node without one, and says
// what the count is then: a parent's own number, whenever one of its children comes up.
function countAfter(indexes: Map<string, number>, parent: NodeBase, count: number): number {
  if (parent.parentId === undefined && !indexes.has(parent.id)) {
    indexes.set(parent.id, count + 1);
  }
  return indexes.get(parent.id) ?? count;
}

// The number of each top-level node that has children, in the order its children first come up.
function rootIndexesOf(nodes: readonly NodeBase[]): Map<string, number> {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const indexes = new Map<string, number>();
  let count = 0;
  for (const node of nodes) {
    const parent = node.parentId === undefined ? undefined : byId.get(node.parentId);
    count = parent === undefined ? count : countAfter(indexes, parent, count);
  }
  return indexes;
}

// With `zIndexMode: "auto"` each of those is lifted ten more than the one before, so that the nodes
// of one tree stack together.
function rootOffsetsOf(nodes: readonly NodeBase[]): Map<string, number> {
  const indexes = rootIndexesOf(nodes);
  return new Map([...indexes].map(([id, index]) => [id, index * ROOT_PARENT_Z_INCREMENT]));
}

export interface NodeLookups<TNode extends NodeBase> {
  nodeLookup: Map<string, InternalNode<TNode>>;
  parentLookup: Map<string, Map<string, InternalNode<TNode>>>;
}

function zIndexOf(node: NodeBase, options: BuildOptions): number {
  const own = node.zIndex ?? 0;
  if (options.zIndexMode === "manual") {
    return own;
  }
  const elevation =
    options.elevateNodesOnSelect && node.selected === true ? options.selectedNodeZ : 0;
  return own + elevation + (options.rootOffsets.get(node.id) ?? 0);
}

function samePlace(internal: InternalNode, position: XYPosition, z: number): boolean {
  const current = internal.internals;
  return (
    current.positionAbsolute.x === position.x &&
    current.positionAbsolute.y === position.y &&
    current.z === z
  );
}

interface Placement {
  positionAbsolute: XYPosition;
  z: number;
}

function placementOf(
  node: NodeBase,
  parent: InternalNode | undefined,
  options: BuildOptions,
): Placement {
  const ownZ = zIndexOf(node, options);
  return {
    positionAbsolute: absolutePositionOf(node, parent, options),
    z: parent === undefined ? ownZ : Math.max(ownZ, parent.internals.z + 1),
  };
}

const DEFAULT_HANDLE_SIZE = 1;

// Handles the owner describes on the node (`handles`) are the handle bounds, so that edges can be
// drawn before anything is measured, on the server for one. Measuring replaces them, as in React Flow.
function handleBoundsOf(node: NodeBase): HandleBounds | undefined {
  if (node.handles === undefined) {
    return undefined;
  }
  const bounds: HandleBounds = { source: [], target: [] };
  for (const handle of node.handles) {
    bounds[handle.type].push({
      id: handle.id ?? null,
      type: handle.type,
      position: handle.position,
      x: handle.x,
      y: handle.y,
      width: handle.width ?? DEFAULT_HANDLE_SIZE,
      height: handle.height ?? DEFAULT_HANDLE_SIZE,
    });
  }
  return bounds;
}

interface BuildInput<TNode extends NodeBase> {
  node: TNode;
  parent: InternalNode<TNode> | undefined;
  previous: InternalNode<TNode> | undefined;
}

function buildInternalNode<TNode extends NodeBase>(
  { node, parent, previous }: BuildInput<TNode>,
  options: BuildOptions,
): InternalNode<TNode> {
  // A node the owner never gave a measured size (it ignores `dimensions` changes) keeps the size that
  // was measured for it earlier, so it does not go back to unmeasured whenever its object changes.
  const sized =
    node.measured === undefined && previous?.measured.width !== undefined
      ? { ...node, measured: previous.measured }
      : node;
  const placement = placementOf(sized, parent, options);
  if (
    previous !== undefined &&
    previous.internals.userNode === node &&
    samePlace(previous, placement.positionAbsolute, placement.z)
  ) {
    return previous;
  }
  return {
    ...sized,
    measured: { ...sized.measured },
    internals: {
      ...placement,
      userNode: node,
      handleBounds: handleBoundsOf(node) ?? previous?.internals.handleBounds,
    },
  };
}

interface ResolveContext<TNode extends NodeBase> {
  userNodes: Map<string, TNode>;
  previous: Map<string, InternalNode<TNode>>;
  options: BuildOptions;
  resolved: Map<string, InternalNode<TNode>>;
  visiting: Set<string>;
}

// Resolves a node after its parent chain; a parent cycle or an unknown parent leaves the node
// unparented instead of looping.
function resolveNode<TNode extends NodeBase>(
  id: string,
  context: ResolveContext<TNode>,
): InternalNode<TNode> | undefined {
  const cached = context.resolved.get(id);
  const node = context.userNodes.get(id);
  if (cached !== undefined || node === undefined) {
    return cached;
  }
  context.visiting.add(id);
  const parent =
    node.parentId === undefined || context.visiting.has(node.parentId)
      ? undefined
      : resolveNode(node.parentId, context);
  context.visiting.delete(id);
  const internal = buildInternalNode(
    { node, parent, previous: context.previous.get(id) },
    context.options,
  );
  context.resolved.set(id, internal);
  return internal;
}

function indexByParent<TNode extends NodeBase>(
  nodeLookup: Map<string, InternalNode<TNode>>,
): Map<string, Map<string, InternalNode<TNode>>> {
  const parentLookup = new Map<string, Map<string, InternalNode<TNode>>>();
  for (const internal of nodeLookup.values()) {
    const { parentId } = internal;
    if (parentId !== undefined && nodeLookup.has(parentId)) {
      const children = parentLookup.get(parentId) ?? new Map<string, InternalNode<TNode>>();
      children.set(internal.id, internal);
      parentLookup.set(parentId, children);
    }
  }
  return parentLookup;
}

/**
 * Builds the internal view of `nodes`. Internal nodes whose user node, absolute position and z
 * did not change are taken over from `previous` as the same object, so consumers that compare by
 * identity only see the nodes that really changed.
 */
export function buildNodeLookups<TNode extends NodeBase>(
  nodes: readonly TNode[],
  previous: Map<string, InternalNode<TNode>>,
  options: InternalsOptions,
): NodeLookups<TNode> {
  const context: ResolveContext<TNode> = {
    userNodes: new Map(nodes.map((node) => [node.id, node])),
    previous,
    options: {
      ...options,
      rootOffsets: options.zIndexMode === "auto" ? rootOffsetsOf(nodes) : new Map(),
    },
    resolved: new Map(),
    visiting: new Set(),
  };
  const nodeLookup = new Map<string, InternalNode<TNode>>();
  for (const node of nodes) {
    const internal = resolveNode(node.id, context);
    if (internal !== undefined) {
      nodeLookup.set(node.id, internal);
    }
  }
  return { nodeLookup, parentLookup: indexByParent(nodeLookup) };
}

/** The lookup key for the connections of a node, of one side of it, or of a single handle. */
export function connectionKey(nodeId: string, type?: HandleType, handleId?: string | null): string {
  if (type === undefined) {
    return nodeId;
  }
  return handleId === undefined ? `${nodeId}-${type}` : `${nodeId}-${type}-${handleId ?? ""}`;
}

export interface EdgeLookups<TEdge extends EdgeBase> {
  edgeLookup: Map<string, TEdge>;
  connectionLookup: Map<string, Map<string, NodeConnection>>;
}

function addConnection(
  lookup: Map<string, Map<string, NodeConnection>>,
  key: string,
  connection: NodeConnection,
): void {
  const connections = lookup.get(key) ?? new Map<string, NodeConnection>();
  connections.set(connection.edgeId, connection);
  lookup.set(key, connections);
}

function registerEdge(lookup: Map<string, Map<string, NodeConnection>>, edge: EdgeBase): void {
  const connection: NodeConnection = {
    edgeId: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle ?? null,
    targetHandle: edge.targetHandle ?? null,
  };
  const keys = [
    connectionKey(edge.source),
    connectionKey(edge.source, "source"),
    connectionKey(edge.source, "source", connection.sourceHandle),
    connectionKey(edge.target),
    connectionKey(edge.target, "target"),
    connectionKey(edge.target, "target", connection.targetHandle),
  ];
  for (const key of keys) {
    addConnection(lookup, key, connection);
  }
}

export function buildEdgeLookups<TEdge extends EdgeBase>(
  edges: readonly TEdge[],
): EdgeLookups<TEdge> {
  const connectionLookup = new Map<string, Map<string, NodeConnection>>();
  for (const edge of edges) {
    registerEdge(connectionLookup, edge);
  }
  return { edgeLookup: new Map(edges.map((edge) => [edge.id, edge])), connectionLookup };
}
