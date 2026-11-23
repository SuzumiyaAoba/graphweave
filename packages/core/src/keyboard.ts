import type { InternalNode } from "./flow-state.ts";
import type { Point } from "./geometry.ts";
import type { DragConfig } from "./node-drag.ts";
import { calculateNodePosition } from "./node-position.ts";
import type { NodePositionChange, SnapGrid } from "./types.ts";
import { snapToGrid } from "./viewport.ts";

/** One key, a combination joined with `+` (`"Meta+k"`), or a list of alternatives. */
export type KeyCode = string | readonly string[];

const COMBINATION_SEPARATOR = "+";

/** The alternatives of a key code, each as the list of keys that have to be down together. */
export function parseKeyCode(keyCode: KeyCode): string[][] {
  const alternatives = typeof keyCode === "string" ? [keyCode] : keyCode;
  return alternatives.map((alternative) =>
    // A lone "+" is the plus key itself, not an empty combination.
    alternative === COMBINATION_SEPARATOR
      ? [alternative]
      : alternative.split(COMBINATION_SEPARATOR),
  );
}

interface KeyboardEventLike {
  key: string;
  code: string;
}

/** Whether an event is for `key`: a `code` such as "Backspace" or "KeyA", or a printable `key`. */
export function eventMatchesKey(event: KeyboardEventLike, key: string): boolean {
  return event.code === key || event.key === key || event.key.toLowerCase() === key.toLowerCase();
}

/** Whether every key of some alternative is among the keys that are currently down. */
export function isKeyCodePressed(
  alternatives: readonly string[][],
  pressed: ReadonlySet<string>,
): boolean {
  const down = new Set([...pressed].map((key) => key.toLowerCase()));
  return alternatives.some((keys) => keys.every((key) => down.has(key.toLowerCase())));
}

const ARROW_STEP = 5;
const SHIFT_FACTOR = 4;

const ARROWS: ReadonlyMap<string, Point> = new Map([
  ["ArrowUp", { x: 0, y: -1 }],
  ["ArrowDown", { x: 0, y: 1 }],
  ["ArrowLeft", { x: -1, y: 0 }],
  ["ArrowRight", { x: 1, y: 0 }],
]);

/**
 * How far an arrow key moves the selected nodes: 5 flow units, or one grid cell when snapping to a
 * grid, and four times that with Shift. Keys that are not arrows give `undefined`.
 */
export function arrowDelta(
  key: string,
  options: { shift: boolean; snapToGrid: boolean; snapGrid: SnapGrid },
): Point | undefined {
  const direction = ARROWS.get(key);
  if (direction === undefined) {
    return undefined;
  }
  const [gridX, gridY] = options.snapGrid;
  const factor = options.shift ? SHIFT_FACTOR : 1;
  const stepX = (options.snapToGrid ? gridX : ARROW_STEP) * factor;
  const stepY = (options.snapToGrid ? gridY : ARROW_STEP) * factor;
  return { x: direction.x * stepX, y: direction.y * stepY };
}

/**
 * The position changes that nudge the given nodes by `delta`, as one finished (not dragging) move.
 * Each node is moved and snapped to the grid on its own, as React Flow's keyboard move does.
 */
export function nudgeNodes(
  lookup: ReadonlyMap<string, InternalNode>,
  ids: Iterable<string>,
  move: { delta: Point; config: DragConfig; nodesDraggable: boolean },
): NodePositionChange[] {
  const wanted = new Set(ids);
  const { delta, config } = move;
  const moving = [...lookup.values()].filter(
    (node) => wanted.has(node.id) && (node.draggable ?? move.nodesDraggable),
  );
  return moving.map((node) => {
    const at = node.internals.positionAbsolute;
    const wantedAt = { x: at.x + delta.x, y: at.y + delta.y };
    const placed = calculateNodePosition({
      node,
      nodeLookup: lookup,
      nextPosition: config.snapToGrid ? snapToGrid(wantedAt, config.snapGrid) : wantedAt,
      nodeOrigin: config.nodeOrigin,
      nodeExtent: config.nodeExtent,
      onError: config.onError,
    });
    return {
      id: node.id,
      type: "position",
      position: placed.position,
      positionAbsolute: placed.positionAbsolute,
      dragging: false,
    };
  });
}
