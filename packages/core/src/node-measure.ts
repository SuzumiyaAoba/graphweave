import type { HandleBounds, InternalNode } from "./flow-state.ts";
import type { NodeDimensionUpdate } from "./flow-store-types.ts";
import { sameHandleBounds } from "./handle-geometry.ts";
import type { NodeBase, NodeDimensionChange } from "./types.ts";

function withHandleBounds<TNode extends NodeBase>(
  internal: InternalNode<TNode>,
  handleBounds: HandleBounds,
): InternalNode<TNode> {
  return { ...internal, internals: { ...internal.internals, handleBounds } };
}

// A box of no size is a node that cannot be measured at the moment (hidden, collapsed, not laid out
// yet), as in React Flow: what is known of its size stays.
function sizeChanged(internal: InternalNode, update: NodeDimensionUpdate): boolean {
  const measurable = update.width > 0 && update.height > 0;
  return (
    measurable &&
    (internal.measured.width !== update.width || internal.measured.height !== update.height)
  );
}

// Stores measured handle bounds on the internal node; true when they differ from what it had.
export function recordHandleBounds(
  lookup: Map<string, InternalNode>,
  update: NodeDimensionUpdate,
): boolean {
  const internal = lookup.get(update.id);
  // A box of no size cannot be measured at the moment (its flow is hidden, say): the handles that are
  // known stay, as in React Flow. Where none are known yet they are taken all the same, so that a
  // node whose size the owner gave has its handles where there is no layout to measure.
  const unmeasurable = update.width <= 0 || update.height <= 0;
  if (
    internal === undefined ||
    (unmeasurable && internal.internals.handleBounds !== undefined) ||
    update.handleBounds === undefined ||
    sameHandleBounds(internal.internals.handleBounds, update.handleBounds)
  ) {
    return false;
  }
  lookup.set(update.id, withHandleBounds(internal, update.handleBounds));
  return true;
}

// Stores a measured size on the internal node; true when it differs from what it had.
export function recordSize(
  lookup: Map<string, InternalNode>,
  update: NodeDimensionUpdate,
): boolean {
  const internal = lookup.get(update.id);
  if (internal === undefined || !sizeChanged(internal, update)) {
    return false;
  }
  lookup.set(update.id, { ...internal, measured: { width: update.width, height: update.height } });
  return true;
}

// The change that brings a node's measured size up to date, if it differs.
export function dimensionChangeOf(
  internal: InternalNode | undefined,
  update: NodeDimensionUpdate,
): NodeDimensionChange | undefined {
  if (internal === undefined || !sizeChanged(internal, update)) {
    return undefined;
  }
  return {
    id: update.id,
    type: "dimensions",
    dimensions: { width: update.width, height: update.height },
  };
}
