import type { EdgePath } from "./edge-paths.ts";
import { Position } from "./types.ts";

// Helpers for comparing Free-Flow with what the real @xyflow/react 12.12.1 returned (the fixtures
// in `xyflow-fixtures.json`): paths whose numbers may differ by rounding, results whose keys may
// come in another order.

const POSITIONS: ReadonlyMap<string, Position> = new Map(
  Object.values(Position).map((value) => [value, value]),
);

function positionOf(name: string): Position {
  const found = POSITIONS.get(name);
  if (found === undefined) {
    throw new TypeError(`unknown position ${name}`);
  }
  return found;
}

// How far two numbers may be apart, relative to their size, and still count as the same.
const TOLERANCE = 1e-9;

const NUMBER = /-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/giu;

function numbersIn(text: string): number[] {
  return (text.match(NUMBER) ?? []).map(Number);
}

function closeTo(left: number, right: number): boolean {
  return Math.abs(left - right) <= TOLERANCE * Math.max(1, Math.abs(left), Math.abs(right));
}

export function allClose(left: readonly number[], right: readonly number[]): boolean {
  return (
    left.length === right.length &&
    left.every((value, at) => closeTo(value, right[at] ?? Number.NaN))
  );
}

// A value with its keys in order and its undefined keys gone, as text, so that two can be compared.
function sorted(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item: unknown) => sorted(item));
  }
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .toSorted(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, sorted(item)]),
    );
  }
  return value;
}

// JSON would turn NaN and Infinity into null, which must not pass for each other.
function plain(_key: string, value: unknown): unknown {
  return typeof value === "number" && !Number.isFinite(value) ? String(value) : value;
}

export function canonical(value: unknown): string {
  return JSON.stringify(sorted(value), plain);
}

// What differs, as lines: the cases whose result is not the one React Flow gave.
export function wrongCases<TInput>(
  cases: readonly { input: TInput; output: unknown }[],
  resultOf: (input: TInput) => unknown,
): string[] {
  return cases.flatMap(({ input, output }) => {
    const ours = resultOf(input);
    return canonical(ours) === canonical(output)
      ? []
      : [canonical({ input, ours, expected: output })];
  });
}

export interface PathCase {
  input: {
    sourceX: number;
    sourceY: number;
    targetX: number;
    targetY: number;
    sourcePosition?: string;
    targetPosition?: string;
    curvature?: number;
    centerX?: number;
    centerY?: number;
    borderRadius?: number;
    offset?: number;
    stepPosition?: number;
  };
  output: readonly (number | string)[];
}

// The commands and separators of a path must be the same; the numbers may differ by rounding.
function samePath(ours: EdgePath, expected: PathCase["output"]): boolean {
  const [oursPath, ...oursRest] = ours;
  const [path, ...rest] = expected;
  return (
    typeof path === "string" &&
    oursPath.replaceAll(NUMBER, "#") === path.replaceAll(NUMBER, "#") &&
    allClose(numbersIn(oursPath), numbersIn(path)) &&
    allClose(oursRest, rest.map(Number))
  );
}

export function pathDifferences(
  cases: readonly PathCase[],
  pathOf: (input: PathCase["input"]) => EdgePath,
): string[] {
  return cases.flatMap(({ input, output }) => {
    const ours = pathOf(input);
    return samePath(ours, output) ? [] : [canonical({ input, ours, expected: output })];
  });
}

export function endsOf(input: PathCase["input"]): {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
} {
  const { sourceX, sourceY, targetX, targetY } = input;
  return { sourceX, sourceY, targetX, targetY };
}

export function facingOf(input: PathCase["input"]): {
  sourcePosition: Position;
  targetPosition: Position;
} {
  return {
    sourcePosition: positionOf(input.sourcePosition ?? "bottom"),
    targetPosition: positionOf(input.targetPosition ?? "top"),
  };
}
