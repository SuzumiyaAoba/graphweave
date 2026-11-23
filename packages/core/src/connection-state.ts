import type { ConnectionInProgress, InternalNode } from "./flow-state.ts";
import { getHandlePosition, oppositePosition } from "./handle-geometry.ts";
import type { XYPosition } from "./types.ts";

// The pointer is over nothing a connection could end on.
export function missState(progress: ConnectionInProgress, point: XYPosition): ConnectionInProgress {
  return {
    ...progress,
    to: point,
    toHandle: null,
    toNode: null,
    toPosition: oppositePosition(progress.fromPosition),
    isValid: null,
  };
}

// A refusal only shows while the pointer is also within the radius of a handle, as in React Flow.
export function verdictOf(valid: boolean, insideRadius: boolean): boolean | null {
  if (valid) {
    return true;
  }
  return insideRadius ? false : null;
}

// As in React Flow the line starts where the node puts the handle now (the node may have moved since
// the drag began; the handle is taken as it was then). The node the connection holds stays the same.
export function restarted(
  progress: ConnectionInProgress,
  node: InternalNode,
): ConnectionInProgress {
  const handle = progress.fromHandle;
  return {
    ...progress,
    from: getHandlePosition(node, handle, { fallback: handle.position, center: true }),
  };
}
