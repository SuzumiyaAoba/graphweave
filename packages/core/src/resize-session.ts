import type { Point } from "./geometry.ts";
import { nodeSize } from "./graph.ts";
import type { ControlPosition } from "./node-resize.ts";
import { resizeChanges } from "./resize-changes.ts";
import type { Change } from "./resize-changes.ts";
import type { Boundaries, ControlDirection } from "./resize-dimensions.ts";
import { getDimensionsAfterResize } from "./resize-dimensions.ts";
import { changedBetween, controlOf, directionOf } from "./resize-direction.ts";
import type { Changed } from "./resize-direction.ts";
import { surroundingsOf } from "./resize-surroundings.ts";
import type { ChildPosition, ResizeWorld, Surroundings } from "./resize-surroundings.ts";
import type { NodeBase, NodeChange, NodeDimensionChange, NodeOrigin } from "./types.ts";

// What happens while a node is resized by one of its controls, as React Flow's `XYResizer` and the
// `NodeResizeControl` that drives it do it: the node's own position, the children that keep their
// place on screen when its top left moves, the extent of a node that stays in its parent, the
// smallest size its children allow, and a child that makes its parent grow (`expandParent`).

/** The position (the node's own, relative to its parent) and size of the node. */
export interface ResizeValues {
  width: number;
  height: number;
  x: number;
  y: number;
}

/** The same with which way the control moved each side: `1` outwards, `-1` inwards, `0` not at all. */
export interface ResizeValuesWithDirection extends ResizeValues {
  direction: [horizontal: number, vertical: number];
}

export interface ResizeSetup {
  controlPosition: ControlPosition;
  boundaries: Boundaries;
  keepAspectRatio: boolean;
  /** Restrict the resize to one axis. */
  resizeDirection?: "horizontal" | "vertical" | undefined;
}

export interface ResizeStep {
  /** What the callbacks are told. */
  values: ResizeValuesWithDirection;
  /** What to apply to the nodes. */
  changes: NodeChange[];
}

export type { ResizeWorld } from "./resize-surroundings.ts";

export interface ResizeSession {
  /** The values when the resize began. */
  start: ResizeValues;
  /**
   * Takes the control to `pointer` (flow coordinates, snapped to the grid if that is on). Nothing
   * comes back when the size and position stay as they are, or when `accepts` says no to the new
   * values (the resize then stays where it was).
   */
  move: (
    pointer: Point,
    accepts?: (values: ResizeValuesWithDirection) => boolean,
  ) => ResizeStep | undefined;
  /** What the node ended with and the change that says it is no longer being resized. */
  end: () => { values: ResizeValues; change: NodeDimensionChange };
}

interface StartValues extends ResizeValues {
  pointerX: number;
  pointerY: number;
}

// Everything one resize keeps track of. `previous` and `start` are what React Flow calls `prevValues`
// and `startValues`; they change as the resize goes on.
interface Run<TNode extends NodeBase> {
  world: ResizeWorld<TNode>;
  setup: ResizeSetup;
  control: ControlDirection;
  /** The node's origin: its own, or the flow's. */
  origin: NodeOrigin;
  around: Surroundings;
  previous: ResizeValues;
  start: StartValues;
}

// Moves the children the other way when the node's top left moves, so that they stay where they are.
function shiftChildren<TNode extends NodeBase>(
  run: Run<TNode>,
  next: ResizeValues,
): ChildPosition[] {
  const { previous, origin } = run;
  return run.around.children.map((child) => {
    child.position = {
      x: child.position.x - (next.x - previous.x) + origin[0] * (next.width - previous.width),
      y: child.position.y - (next.y - previous.y) + origin[1] * (next.height - previous.height),
    };
    return { id: child.id, position: child.position };
  });
}

// The position half of a step: the node's origin moves with its near side, and so, the other way,
// do its children (they stay where they are on screen).
function placeChange<TNode extends NodeBase>(
  run: Run<TNode>,
  next: ResizeValues,
  changed: Changed,
): { change: Change; childChanges: ChildPosition[] } {
  const x = changed.x ? next.x : run.previous.x;
  const y = changed.y ? next.y : run.previous.y;
  const childChanges = shiftChildren(run, next);
  run.previous = { ...run.previous, x, y };
  return { change: { x, y }, childChanges };
}

// The size half of a step, which a one-axis resize only applies along its axis.
function sizeChange<TNode extends NodeBase>(
  run: Run<TNode>,
  next: ResizeValues,
  changed: Changed,
): Change {
  const direction = run.setup.resizeDirection;
  const horizontal = direction === undefined || direction === "horizontal";
  const vertical = direction === undefined || direction === "vertical";
  const width = changed.width && horizontal ? next.width : run.previous.width;
  const height = changed.height && vertical ? next.height : run.previous.height;
  run.previous = { ...run.previous, width, height };
  return { width, height };
}

// How the node and its children are changed when the control is where `next` says; `previous`
// becomes what the node now has.
function changeFor<TNode extends NodeBase>(
  run: Run<TNode>,
  next: ResizeValues,
  changed: Changed,
): { change: Change; childChanges: ChildPosition[] } {
  const { origin } = run;
  const moves = changed.x || changed.y || origin[0] === 1 || origin[1] === 1;
  const placed = moves
    ? placeChange(run, next, changed)
    : { change: {}, childChanges: [] as ChildPosition[] };
  const resized = changed.width || changed.height ? sizeChange(run, next, changed) : {};
  return { change: { ...placed.change, ...resized }, childChanges: placed.childChanges };
}

// Resizing a node that expands its parent from its top or left: the node cannot go further out than
// the parent's corner, so what was asked for beyond that is taken off the start.
function fixExpandParent<TNode extends NodeBase>(run: Run<TNode>, change: Change): void {
  if (run.around.parent === undefined || run.world.node.expandParent !== true) {
    return;
  }
  const xLimit = run.origin[0] * (change.width ?? 0);
  if (change.x !== undefined && change.x !== 0 && change.x < xLimit) {
    run.previous = { ...run.previous, x: xLimit };
    run.start.x -= change.x - xLimit;
  }
  const yLimit = run.origin[1] * (change.height ?? 0);
  if (change.y !== undefined && change.y !== 0 && change.y < yLimit) {
    run.previous = { ...run.previous, y: yLimit };
    run.start.y -= change.y - yLimit;
  }
}

interface Snapshot {
  previous: ResizeValues;
  startX: number;
  startY: number;
  children: ChildPosition[];
}

function snapshotOf<TNode extends NodeBase>(run: Run<TNode>): Snapshot {
  return {
    previous: run.previous,
    startX: run.start.x,
    startY: run.start.y,
    children: run.around.children.map((child) => ({ ...child, position: { ...child.position } })),
  };
}

function restore<TNode extends NodeBase>(run: Run<TNode>, snapshot: Snapshot): void {
  run.previous = snapshot.previous;
  run.start.x = snapshot.startX;
  run.start.y = snapshot.startY;
  for (const [index, child] of run.around.children.entries()) {
    child.position = snapshot.children[index]?.position ?? child.position;
  }
}

// Where the control puts the node when the pointer is at `at`, before anything is limited by what
// was resized already.
function shapeAt<TNode extends NodeBase>(run: Run<TNode>, at: Point): ResizeValues {
  const { start, setup, around } = run;
  return getDimensionsAfterResize(
    { x: start.x, y: start.y, width: start.width, height: start.height },
    { direction: run.control, pointer: { x: at.x - start.pointerX, y: at.y - start.pointerY } },
    {
      boundaries: setup.boundaries,
      keepAspectRatio: setup.keepAspectRatio && start.width > 0 && start.height > 0,
      nodeOrigin: run.origin,
      extent: around.nodeExtent,
      childExtent: around.childExtent,
    },
  );
}

// Whether `accepts` lets the step stand; if not, the resize goes back to how it was.
function stands<TNode extends NodeBase>(
  run: Run<TNode>,
  snapshot: Snapshot,
  verdict: boolean | undefined,
): boolean {
  if (verdict === false) {
    restore(run, snapshot);
    return false;
  }
  return true;
}

// The step the control takes to `next`, which at least one of the sides says it changes.
function stepFor<TNode extends NodeBase>(
  run: Run<TNode>,
  move: { next: ResizeValues; changed: Changed },
  accepts: ((values: ResizeValuesWithDirection) => boolean) | undefined,
): ResizeStep | undefined {
  const snapshot = snapshotOf(run);
  const { change, childChanges } = changeFor(run, move.next, move.changed);
  fixExpandParent(run, change);
  const direction = directionOf(run.previous, snapshot.previous, run.control);
  const values: ResizeValuesWithDirection = { ...run.previous, direction };
  if (!stands(run, snapshot, accepts?.(values))) {
    return undefined;
  }
  const { resizeDirection } = run.setup;
  const world = run.world.current?.() ?? run.world;
  return { values, changes: resizeChanges(world, { change, childChanges, resizeDirection }) };
}

function stepOf<TNode extends NodeBase>(
  run: Run<TNode>,
  at: Point,
  accepts: ((values: ResizeValuesWithDirection) => boolean) | undefined,
): ResizeStep | undefined {
  const next = shapeAt(run, at);
  const changed = changedBetween(next, run.previous);
  const anything = changed.width || changed.height || changed.x || changed.y;
  return anything ? stepFor(run, { next, changed }, accepts) : undefined;
}

/** Begins resizing `world.node` by a control, with the pointer at `pointer` (flow coordinates). */
export function startResize<TNode extends NodeBase>(
  world: ResizeWorld<TNode>,
  setup: ResizeSetup,
  pointer: Point,
): ResizeSession {
  const { node } = world;
  const first: ResizeValues = { ...nodeSize(node), x: node.position.x, y: node.position.y };
  const run: Run<TNode> = {
    world,
    setup,
    control: controlOf(setup.controlPosition),
    origin: node.origin ?? world.nodeOrigin,
    around: surroundingsOf(world),
    previous: { ...first },
    start: { ...first, pointerX: pointer.x, pointerY: pointer.y },
  };
  return {
    start: { ...first },
    move: (at, accepts) => stepOf(run, at, accepts),
    end: () => ({
      values: { ...run.previous },
      change: {
        id: node.id,
        type: "dimensions",
        resizing: false,
        dimensions: { width: run.previous.width, height: run.previous.height },
      },
    }),
  };
}
