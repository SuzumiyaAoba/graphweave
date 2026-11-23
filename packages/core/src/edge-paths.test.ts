import { describe, expect, it } from "vite-plus/test";

import {
  getBezierEdgeCenter,
  getBezierPath,
  getEdgeCenter,
  getSimpleBezierPath,
  getStraightPath,
} from "./edge-paths.ts";
import { getSmoothStepPath } from "./smooth-step.ts";
import { Position } from "./types.ts";

const POSITIONS = [Position.Left, Position.Top, Position.Right, Position.Bottom] as const;

function numbersOf(path: string): number[] {
  return (path.match(/-?\d+(?:\.\d+)?/gu) ?? []).map(Number);
}

function pairsOf(path: string): [number, number][] {
  const values = numbersOf(path);
  const pairs: [number, number][] = [];
  for (let index = 0; index + 1 < values.length; index += 2) {
    pairs.push([values[index] ?? 0, values[index + 1] ?? 0]);
  }
  return pairs;
}

type Pair = readonly [number, number];

interface OrthogonalCase {
  source: Pair;
  target: Pair;
  sourcePosition: Position;
  targetPosition: Position;
}

const SOURCES: readonly Pair[] = [
  [0, 0],
  [200, 120],
  [60, 300],
];
const TARGETS: readonly Pair[] = [
  [300, 40],
  [-150, 200],
  [60, -80],
  [0, 0],
];

const ORTHOGONAL_CASES: readonly OrthogonalCase[] = SOURCES.flatMap((source) =>
  TARGETS.flatMap((target) =>
    POSITIONS.flatMap((sourcePosition) =>
      POSITIONS.map((targetPosition) => ({ source, target, sourcePosition, targetPosition })),
    ),
  ),
);

function isAxisAligned(points: readonly Pair[]): boolean {
  return points.every(([x, y], index) => {
    const previous = points[index - 1];
    return previous === undefined || previous[0] === x || previous[1] === y;
  });
}

function isOrthogonal({ source, target, sourcePosition, targetPosition }: OrthogonalCase): boolean {
  const [path] = getSmoothStepPath({
    sourceX: source[0],
    sourceY: source[1],
    sourcePosition,
    targetX: target[0],
    targetY: target[1],
    targetPosition,
    borderRadius: 0,
  });
  const points = pairsOf(path);
  const [first] = points;
  const last = points.at(-1);
  return (
    first?.[0] === source[0] &&
    first[1] === source[1] &&
    last?.[0] === target[0] &&
    last[1] === target[1] &&
    isAxisAligned(points)
  );
}

describe("getEdgeCenter", () => {
  it("is the midpoint and half the extent, whichever way the edge points", () => {
    expect(getEdgeCenter({ sourceX: 0, sourceY: 0, targetX: 100, targetY: 50 })).toStrictEqual([
      50, 25, 50, 25,
    ]);
    expect(getEdgeCenter({ sourceX: 100, sourceY: 50, targetX: 0, targetY: 0 })).toStrictEqual([
      50, 25, 50, 25,
    ]);
  });
});

describe("getStraightPath", () => {
  it("draws a line and puts the label in the middle", () => {
    expect(getStraightPath({ sourceX: 0, sourceY: 0, targetX: 100, targetY: 50 })).toStrictEqual([
      "M 0,0L 100,50",
      50,
      25,
      50,
      25,
    ]);
  });
});

describe("getBezierPath", () => {
  it("uses a control offset of half the distance when the target lies ahead", () => {
    const result = getBezierPath({
      sourceX: 0,
      sourceY: 0,
      sourcePosition: Position.Right,
      targetX: 100,
      targetY: 0,
      targetPosition: Position.Left,
    });
    expect(result[0]).toBe("M0,0 C50,0 50,0 100,0");
    expect(result[1]).toBe(50);
    expect(result[2]).toBe(0);
  });

  it("defaults to a vertical edge from the bottom of the source to the top of the target", () => {
    expect(getBezierPath({ sourceX: 0, sourceY: 0, targetX: 0, targetY: 100 })[0]).toBe(
      "M0,0 C0,50 0,50 0,100",
    );
  });

  it("bends outwards by the curvature when the target lies behind the handle", () => {
    const result = getBezierPath({
      sourceX: 100,
      sourceY: 0,
      sourcePosition: Position.Right,
      targetX: 0,
      targetY: 0,
      targetPosition: Position.Left,
    });
    expect(result[0]).toBe("M100,0 C162.5,0 -62.5,0 0,0");
  });

  it("scales the outward bend with the curvature", () => {
    const flat = getBezierPath({
      sourceX: 100,
      sourceY: 0,
      sourcePosition: Position.Right,
      targetX: 0,
      targetY: 0,
      targetPosition: Position.Left,
      curvature: 0,
    });
    expect(flat[0]).toBe("M100,0 C100,0 0,0 0,0");
  });

  it("finds the midpoint of the curve from its control points", () => {
    expect(
      getBezierEdgeCenter({
        sourceX: 0,
        sourceY: 0,
        targetX: 100,
        targetY: 0,
        sourceControlX: 50,
        sourceControlY: 0,
        targetControlX: 50,
        targetControlY: 0,
      }),
    ).toStrictEqual([50, 0, 50, 0]);
  });
});

describe("getSimpleBezierPath", () => {
  it("puts the control points halfway along the facing axis", () => {
    const result = getSimpleBezierPath({
      sourceX: 0,
      sourceY: 0,
      sourcePosition: Position.Right,
      targetX: 100,
      targetY: 40,
      targetPosition: Position.Left,
    });
    expect(result[0]).toBe("M0,0 C50,0 50,40 100,40");
  });
});

describe("getSmoothStepPath", () => {
  it("makes a Z shape between facing handles", () => {
    const result = getSmoothStepPath({
      sourceX: 0,
      sourceY: 0,
      sourcePosition: Position.Right,
      targetX: 100,
      targetY: 50,
      targetPosition: Position.Left,
      borderRadius: 0,
    });
    // As in React Flow, a corner with radius 0 is still drawn as a (flat) curve.
    expect(result[0]).toBe("M0 0L 50,0Q 50,0 50,0L 50,50Q 50,50 50,50L100 50");
    expect(result.slice(1)).toStrictEqual([50, 25, 50, 25]);
  });

  it("rounds the corners with quadratic curves", () => {
    const result = getSmoothStepPath({
      sourceX: 0,
      sourceY: 0,
      sourcePosition: Position.Right,
      targetX: 100,
      targetY: 50,
      targetPosition: Position.Left,
    });
    expect(result[0]).toBe("M0 0L 45,0Q 50,0 50,5L 50,45Q 50,50 55,50L100 50");
  });

  it("limits the radius to half of the neighbouring segments", () => {
    const result = getSmoothStepPath({
      sourceX: 0,
      sourceY: 0,
      sourcePosition: Position.Right,
      targetX: 100,
      targetY: 4,
      targetPosition: Position.Left,
      borderRadius: 50,
    });
    expect(result[0]).toBe("M0 0L 48,0Q 50,0 50,2L 50,2Q 50,4 52,4L100 4");
  });

  it("is a straight line when the handles are aligned", () => {
    const result = getSmoothStepPath({
      sourceX: 0,
      sourceY: 0,
      targetX: 0,
      targetY: 100,
    });
    expect(result[0]).toBe("M0 0L0 100");
  });

  it("uses one corner for perpendicular handles", () => {
    const result = getSmoothStepPath({
      sourceX: 0,
      sourceY: 0,
      sourcePosition: Position.Right,
      targetX: 100,
      targetY: 100,
      targetPosition: Position.Top,
      borderRadius: 0,
    });
    expect(result[0]).toBe("M0 0L 100,0Q 100,0 100,0L100 100");
  });

  it("honours centerX and offset", () => {
    const result = getSmoothStepPath({
      sourceX: 0,
      sourceY: 0,
      sourcePosition: Position.Right,
      targetX: 100,
      targetY: 50,
      targetPosition: Position.Left,
      borderRadius: 0,
      centerX: 30,
      offset: 10,
    });
    expect(result[0]).toBe("M0 0L 30,0Q 30,0 30,0L 30,50Q 30,50 30,50L100 50");
    expect(result[1]).toBe(30);
  });

  it("starts at the source, ends at the target and only uses axis-aligned segments for every handle pair", () => {
    expect(ORTHOGONAL_CASES.filter((testCase) => !isOrthogonal(testCase))).toStrictEqual([]);
  });
});
