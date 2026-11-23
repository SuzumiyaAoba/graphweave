import type { HandleBound, HandleBounds, InternalNode } from "./flow-state.ts";
import type { Rect } from "./geometry.ts";
import type { HandleType, NodeBase, XYPosition } from "./types.ts";
import { ConnectionMode, Position } from "./types.ts";

const HALF = 0.5;

const OPPOSITE: Readonly<Record<Position, Position>> = {
  [Position.Left]: Position.Right,
  [Position.Right]: Position.Left,
  [Position.Top]: Position.Bottom,
  [Position.Bottom]: Position.Top,
};

export function oppositePosition(position: Position): Position {
  return OPPOSITE[position];
}

/** The size a node is laid out with: measured, else declared, else zero. */
export function sizeOf(node: NodeBase): { width: number; height: number } {
  return {
    width: node.measured?.width ?? node.width ?? node.initialWidth ?? 0,
    height: node.measured?.height ?? node.height ?? node.initialHeight ?? 0,
  };
}

// The point on a rectangle's side that faces `position`, halfway along it.
function sidePoint(rect: Rect, position: Position): XYPosition {
  if (position === Position.Left) {
    return { x: rect.x, y: rect.y + rect.height * HALF };
  }
  if (position === Position.Right) {
    return { x: rect.x + rect.width, y: rect.y + rect.height * HALF };
  }
  return position === Position.Top
    ? { x: rect.x + rect.width * HALF, y: rect.y }
    : { x: rect.x + rect.width * HALF, y: rect.y + rect.height };
}

/**
 * Where a handle sits in flow coordinates. By default that is the point on the handle's outer edge
 * where an edge attaches; with `center` it is the middle of the handle, which is what hit-testing
 * uses. Without a measured handle the node's own box stands in for it.
 */
export function getHandlePosition(
  node: InternalNode,
  handle: HandleBound | undefined,
  options: { fallback: Position; center?: boolean },
): XYPosition {
  const origin = node.internals.positionAbsolute;
  const { width, height } = handle ?? sizeOf(node);
  const rect = { x: origin.x + (handle?.x ?? 0), y: origin.y + (handle?.y ?? 0), width, height };
  if (options.center === true) {
    return { x: rect.x + width * HALF, y: rect.y + height * HALF };
  }
  return sidePoint(rect, handle?.position ?? options.fallback);
}

/** The handles a node has on one side, or on both when `type` is left out. */
export function handlesOf(node: InternalNode, type?: HandleType): HandleBound[] {
  const bounds = node.internals.handleBounds;
  if (bounds === undefined) {
    return [];
  }
  return type === undefined ? [...bounds.source, ...bounds.target] : bounds[type];
}

export function findHandle(
  node: InternalNode,
  type: HandleType,
  id: string | null,
): HandleBound | undefined {
  return handlesOf(node, type).find((handle) => handle.id === id);
}

/**
 * The handle an end of an edge hangs on. In loose mode it may be of the other type (every handle can
 * be a source, say), so one of the type asked for is looked for first and any other after it.
 */
export function findAttachedHandle(
  node: InternalNode,
  ref: { type: HandleType; id: string | null },
  mode: ConnectionMode,
): HandleBound | undefined {
  const exact = findHandle(node, ref.type, ref.id);
  if (exact !== undefined || mode !== ConnectionMode.Loose) {
    return exact;
  }
  return findHandle(node, ref.type === "source" ? "target" : "source", ref.id);
}

function sameHandle(a: HandleBound, b: HandleBound): boolean {
  return (
    a.id === b.id &&
    a.type === b.type &&
    a.position === b.position &&
    a.x === b.x &&
    a.y === b.y &&
    a.width === b.width &&
    a.height === b.height &&
    a.isConnectable === b.isConnectable &&
    a.isConnectableStart === b.isConnectableStart &&
    a.isConnectableEnd === b.isConnectableEnd
  );
}

function sameHandles(a: readonly HandleBound[], b: readonly HandleBound[]): boolean {
  return (
    a.length === b.length &&
    a.every((handle, index) => b[index] !== undefined && sameHandle(handle, b[index]))
  );
}

/** Whether two sets of measured handles describe the same boxes, so a re-measure can be skipped. */
export function sameHandleBounds(a: HandleBounds | undefined, b: HandleBounds): boolean {
  return a !== undefined && sameHandles(a.source, b.source) && sameHandles(a.target, b.target);
}
