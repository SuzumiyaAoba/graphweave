import { evaluateAbsolutePosition, handleExpandParent } from "./expand-parent.ts";
import { nodeSize } from "./graph.ts";
import type { ChildPosition, ResizeWorld } from "./resize-surroundings.ts";
import type { NodeBase, NodeChange, NodePositionChange } from "./types.ts";

export interface Change {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

interface Step {
  change: Change;
  childChanges: readonly ChildPosition[];
  resizeDirection: "horizontal" | "vertical" | undefined;
}

// What `setAttributes` says: both sides are written, or only the one that is resized.
function attributesFor(direction: Step["resizeDirection"]): true | "width" | "height" {
  if (direction === undefined) {
    return true;
  }
  return direction === "horizontal" ? "width" : "height";
}

// Where the node is held, along one axis, when it has made its parent grow: not before the corner.
function held(value: number | undefined, limit: number): number | undefined {
  return value === undefined || value === 0 ? undefined : Math.max(limit, value);
}

interface Held {
  x: number | undefined;
  y: number | undefined;
}

// A node that expands its parent makes it grow first, and then stays inside the parent's corner.
function expansionFor<TNode extends NodeBase>(
  world: ResizeWorld<TNode>,
  change: Change,
): { changes: NodeChange[]; at: Held } {
  const { node, nodeLookup, parentLookup, nodeOrigin } = world;
  if (node.expandParent !== true || node.parentId === undefined) {
    return { changes: [], at: { x: change.x, y: change.y } };
  }
  const origin = node.origin ?? nodeOrigin;
  const own = nodeSize(node);
  const size = { width: change.width ?? own.width, height: change.height ?? own.height };
  const position = { x: change.x ?? node.position.x, y: change.y ?? node.position.y };
  const absolute = evaluateAbsolutePosition(
    { position, size },
    nodeLookup.get(node.parentId),
    origin,
  );
  const child = { id: node.id, parentId: node.parentId, rect: { ...size, ...absolute } };
  return {
    changes: handleExpandParent([child], { nodeLookup, parentLookup }, nodeOrigin),
    at: { x: held(change.x, origin[0] * size.width), y: held(change.y, origin[1] * size.height) },
  };
}

function moved(child: ChildPosition): NodePositionChange {
  return { id: child.id, type: "position", position: child.position };
}

// The changes for one step of the resize, as `NodeResizeControl` makes them: a parent that has to
// grow for its child first, then the node's position and size, then the children that move.
export function resizeChanges<TNode extends NodeBase>(
  world: ResizeWorld<TNode>,
  step: Step,
): NodeChange[] {
  const { change } = step;
  const { changes, at } = expansionFor(world, change);
  const { id } = world.node;
  if (at.x !== undefined && at.y !== undefined) {
    changes.push({ id, type: "position", position: { x: at.x, y: at.y } });
  }
  if (change.width !== undefined && change.height !== undefined) {
    changes.push({
      id,
      type: "dimensions",
      resizing: true,
      setAttributes: attributesFor(step.resizeDirection),
      dimensions: { width: change.width, height: change.height },
    });
  }
  changes.push(...step.childChanges.map((child) => moved(child)));
  return changes;
}
