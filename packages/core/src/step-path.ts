import { HALF } from "./geometry.ts";
import type { XYPosition } from "./types.ts";

const SECOND_TO_LAST = -2;

// Whether `middle` lies on the straight segment from `start` to `end`, going the same way.
function isBetween(start: XYPosition, middle: XYPosition, end: XYPosition): boolean {
  return (
    (start.x === middle.x &&
      middle.x === end.x &&
      (middle.y - start.y) * (end.y - middle.y) >= 0) ||
    (start.y === middle.y && middle.y === end.y && (middle.x - start.x) * (end.x - middle.x) >= 0)
  );
}

// Drops the middle of three points on a line, so corners are the only vertices.
export function tidy(points: readonly XYPosition[]): XYPosition[] {
  const result: XYPosition[] = [];
  for (const point of points) {
    const start = result.at(SECOND_TO_LAST);
    const middle = result.at(-1);
    if (start !== undefined && middle !== undefined && isBetween(start, middle, point)) {
      result.pop();
    }
    result.push(point);
  }
  return result;
}

function distance(from: XYPosition, to: XYPosition): number {
  return Math.hypot(to.x - from.x, to.y - from.y);
}

interface Bend {
  previous: XYPosition;
  corner: XYPosition;
  next: XYPosition;
  radius: number;
}

// The rounded corner of a route that turns at `corner`, as React Flow draws it: a line to where the
// curve starts, then a quadratic through the corner.
function curve({ previous, corner, next }: Bend, size: number): string {
  const { x, y } = corner;
  if (previous.y === y) {
    const xDir = previous.x < next.x ? -1 : 1;
    const yDir = previous.y < next.y ? 1 : -1;
    return `L ${x + size * xDir},${y}Q ${x},${y} ${x},${y + size * yDir}`;
  }
  const xDir = previous.x < next.x ? 1 : -1;
  const yDir = previous.y < next.y ? -1 : 1;
  return `L ${x},${y + size * yDir}Q ${x},${y} ${x + size * xDir},${y}`;
}

function bend(input: Bend): string {
  const { previous, corner, next, radius } = input;
  const straight =
    (previous.x === corner.x && corner.x === next.x) ||
    (previous.y === corner.y && corner.y === next.y);
  if (straight) {
    return `L${corner.x} ${corner.y}`;
  }
  const size = Math.min(distance(previous, corner) * HALF, distance(corner, next) * HALF, radius);
  return curve(input, size);
}

export function toPath(points: readonly XYPosition[], radius: number): string {
  const [first] = points;
  const last = points.at(-1);
  if (first === undefined || last === undefined) {
    return "";
  }
  let path = `M${first.x} ${first.y}`;
  for (let index = 1; index < points.length - 1; index += 1) {
    const [previous, corner, next] = points.slice(index - 1, index + 2);
    if (previous !== undefined && corner !== undefined && next !== undefined) {
      path += bend({ previous, corner, next, radius });
    }
  }
  return `${path}L${last.x} ${last.y}`;
}
