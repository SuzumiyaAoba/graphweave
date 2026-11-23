import { flowToScreen } from "./camera.ts";
import type { Viewport } from "./camera.ts";
import { missState, restarted, verdictOf } from "./connection-state.ts";
import type {
  ClickConnectionStart,
  ConnectionInProgress,
  HandleBound,
  InternalNode,
} from "./flow-state.ts";
import type { FlowStore } from "./flow-store-types.ts";
import { nodeSize } from "./graph.ts";
import {
  findAttachedHandle,
  getHandlePosition,
  handlesOf,
  oppositePosition,
} from "./handle-geometry.ts";
import type { Connection, EdgeBase, HandleType, NodeBase, XYPosition } from "./types.ts";
import { ConnectionMode } from "./types.ts";
import { currentViewport } from "./viewport-actions.ts";

/** One end of a connection: a handle and the node it belongs to. */
export interface End {
  node: InternalNode;
  handle: HandleBound;
  /** Which end of the connection this is, when that is not simply the type of `handle` (loose mode). */
  role?: HandleType | undefined;
}

/** The connection a drag between two handles would make; the source end is always first. */
export function connectionBetween(from: End, to: End): Connection {
  const fromRole = from.role ?? from.handle.type;
  const [source, target] = fromRole === "source" ? [from, to] : [to, from];
  return {
    source: source.node.id,
    sourceHandle: source.handle.id,
    target: target.node.id,
    targetHandle: target.handle.id,
  };
}

/** The part of the flow state that decides which connections are possible. */
export interface ConnectionRules {
  nodeLookup: ReadonlyMap<string, InternalNode>;
  connectionRadius: number;
  connectionMode: ConnectionMode;
  isValidConnection?: ((connection: Connection) => boolean) | undefined;
}

function sameHandle(a: End, b: End): boolean {
  return a.node.id === b.node.id && a.handle.type === b.handle.type && a.handle.id === b.handle.id;
}

// Only the handle's own flags count, as in React Flow: a node being `connectable` (or
// `nodesConnectable` being on) reaches a handle through the `isConnectable` its node component
// passes on, which the built-in node types do.
function canStart(end: End): boolean {
  return end.handle.isConnectable !== false && end.handle.isConnectableStart !== false;
}

function canEnd(end: End): boolean {
  return end.handle.isConnectable !== false && end.handle.isConnectableEnd !== false;
}

// Strict mode joins a source to a target; loose mode joins any two handles of different nodes or
// with different ids (the kind of handle does not matter, so a node cannot join its own two handles
// that share an id).
function typesFit(mode: ConnectionMode, from: End, to: End): boolean {
  return mode === ConnectionMode.Strict
    ? from.handle.type !== to.handle.type
    : from.node.id !== to.node.id || from.handle.id !== to.handle.id;
}

/** Whether `from` may be connected to `to` under the flow's rules and its `isValidConnection`. */
export function isValidConnection(rules: ConnectionRules, from: End, to: End): boolean {
  if (!canEnd(to) || !typesFit(rules.connectionMode, from, to)) {
    return false;
  }
  return rules.isValidConnection?.(connectionBetween(from, to)) ?? true;
}

function nodeNearPoint(node: InternalNode, point: XYPosition, radius: number): boolean {
  const { x, y } = node.internals.positionAbsolute;
  const { width, height } = nodeSize(node);
  return (
    point.x >= x - radius &&
    point.x <= x + width + radius &&
    point.y >= y - radius &&
    point.y <= y + height + radius
  );
}

interface Candidate extends End {
  distance: number;
}

function candidatesOf(node: InternalNode, point: XYPosition): Candidate[] {
  return handlesOf(node).map((handle) => {
    const center = getHandlePosition(node, handle, { fallback: handle.position, center: true });
    return { node, handle, distance: Math.hypot(center.x - point.x, center.y - point.y) };
  });
}

// Of the handles at the same, shortest distance the one of the other kind wins, as in React Flow.
function nearestOf(candidates: readonly Candidate[], from: End): Candidate | undefined {
  const shortest = Math.min(...candidates.map((candidate) => candidate.distance));
  const nearest = candidates.filter((candidate) => candidate.distance === shortest);
  const opposite = (from.role ?? from.handle.type) === "source" ? "target" : "source";
  return nearest.find((candidate) => candidate.handle.type === opposite) ?? nearest[0];
}

// The handle closest to `point` within the connection radius, of whatever kind (whether a drag from
// `from` may end there is decided afterwards, so that the line can show a refusal).
function closestHandle(rules: ConnectionRules, from: End, point: XYPosition): End | undefined {
  const nodes = [...rules.nodeLookup.values()];
  const nearby = nodes.filter(
    (node) => node.hidden !== true && nodeNearPoint(node, point, rules.connectionRadius),
  );
  return nearestOf(
    nearby
      .flatMap((node) => candidatesOf(node, point))
      .filter(
        (candidate) => candidate.distance <= rules.connectionRadius && !sameHandle(from, candidate),
      ),
    from,
  );
}

export function endOf(
  rules: ConnectionRules,
  ref: { nodeId: string; type: HandleType; id: string | null },
): End | undefined {
  const node = rules.nodeLookup.get(ref.nodeId);
  const handle =
    node === undefined ? undefined : findAttachedHandle(node, ref, rules.connectionMode);
  return node === undefined || handle === undefined ? undefined : { node, handle, role: ref.type };
}

export interface StartConnectionParams {
  nodeId: string;
  handleId: string | null;
  handleType: HandleType;
  /** The pointer, in flow coordinates. */
  point: XYPosition;
  /**
   * Start without asking whether the handle may start a connection: the end of an edge that is
   * being moved is dragged out of the handle at its other end, whatever that handle allows.
   */
  unchecked?: boolean | undefined;
}

function startEnd(rules: ConnectionRules, params: StartConnectionParams): End | undefined {
  const from = endOf(rules, {
    nodeId: params.nodeId,
    type: params.handleType,
    id: params.handleId,
  });
  return from !== undefined && (params.unchecked === true || canStart(from)) ? from : undefined;
}

/** Whether a connection may be dragged out of this handle; nothing is started. */
export function canStartConnection<TNode extends NodeBase, TEdge extends EdgeBase>(
  api: FlowStore<TNode, TEdge>,
  params: StartConnectionParams,
): boolean {
  return startEnd(api.getState(), params) !== undefined;
}

// Where a point of the flow is on the canvas, in pixels from its top left.
function pointerAt(
  state: { viewport: Viewport; pendingViewport: Viewport | undefined },
  point: XYPosition,
): XYPosition {
  return flowToScreen(currentViewport(state), point);
}

/** Begins a connection drag from a handle; returns false when that handle cannot start one. */
export function startConnection<TNode extends NodeBase, TEdge extends EdgeBase>(
  api: FlowStore<TNode, TEdge>,
  params: StartConnectionParams,
): boolean {
  const from = startEnd(api.getState(), params);
  if (from === undefined) {
    return false;
  }
  api.setState({
    connection: {
      inProgress: true,
      isValid: null,
      // The line starts at the middle of the handle, as in React Flow.
      from: getHandlePosition(from.node, from.handle, {
        fallback: from.handle.position,
        center: true,
      }),
      fromHandle: { ...from.handle, nodeId: from.node.id },
      fromRole: params.handleType,
      fromPosition: from.handle.position,
      fromNode: from.node,
      to: params.point,
      toHandle: null,
      toPosition: oppositePosition(from.handle.position),
      toNode: null,
      pointer: pointerAt(api.getState(), params.point),
    },
  });
  return true;
}

// The end a drag started from, with the node looked up again in the current nodes.
export function originOf(node: InternalNode, progress: ConnectionInProgress): End {
  return { node, handle: progress.fromHandle, role: progress.fromRole };
}

interface Hover {
  point: XYPosition;
  /** The handle that is under the pointer on the page, if the caller can tell; it goes first. */
  under?: ClickConnectionStart | undefined;
}

// The handle a drag from `from` is aimed at, and the nearest one within the radius (they differ when
// the page says another handle is under the pointer).
function aimOf(
  rules: ConnectionRules,
  from: End,
  hover: Hover,
): { target: End | undefined; near: End | undefined } {
  const near = closestHandle(rules, from, hover.point);
  const below = hover.under === undefined ? undefined : endOf(rules, hover.under);
  return { target: below ?? near, near };
}

// The pointer is aimed at the handle `target`, which the connection may end on or not.
function aimedState(
  progress: ConnectionInProgress,
  target: End,
  aim: { valid: boolean; inside: boolean; point: XYPosition },
): ConnectionInProgress {
  const center = getHandlePosition(target.node, target.handle, {
    fallback: target.handle.position,
    center: true,
  });
  return {
    ...progress,
    isValid: verdictOf(aim.valid, aim.inside),
    // Over a valid handle the line ends at the middle of it, as in React Flow.
    to: aim.valid ? center : aim.point,
    // The handle comes with its node and with where it is in the flow (its middle), as in React Flow.
    toHandle: { ...target.handle, nodeId: target.node.id, x: center.x, y: center.y },
    toNode: target.node,
    toPosition: aim.valid ? target.handle.position : oppositePosition(progress.fromPosition),
  };
}

function hoverState(
  rules: ConnectionRules,
  progress: ConnectionInProgress,
  hover: Hover,
): ConnectionInProgress {
  const fromNode = rules.nodeLookup.get(progress.fromNode.id);
  if (fromNode === undefined) {
    return missState(progress, hover.point);
  }
  const moved = restarted(progress, fromNode);
  const from = originOf(fromNode, moved);
  const { target, near } = aimOf(rules, from, hover);
  if (target === undefined) {
    return missState(moved, hover.point);
  }
  const valid = isValidConnection(rules, from, target);
  return aimedState(moved, target, { valid, inside: near !== undefined, point: hover.point });
}

/**
 * Follows the pointer (flow coordinates): finds the handle under it and checks it. A handle the
 * caller says is under the pointer (`under`) is taken before the nearest one, even outside the
 * connection radius.
 */
export function updateConnection<TNode extends NodeBase, TEdge extends EdgeBase>(
  api: FlowStore<TNode, TEdge>,
  point: XYPosition,
  under?: ClickConnectionStart,
): void {
  const state = api.getState();
  if (state.connection.inProgress) {
    const pointer = pointerAt(state, point);
    api.setState({
      connection: { ...hoverState(state, state.connection, { point, under }), pointer },
    });
  }
}
