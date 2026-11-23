import { describe, expect, it } from "vite-plus/test";

import { BruteForceIndex } from "./brute-force-index.ts";
import { UniformGridIndex } from "./grid-index.ts";
import type { SpatialIndex } from "./spatial-index.ts";

const implementations: readonly (readonly [string, () => SpatialIndex])[] = [
  ["BruteForceIndex", () => new BruteForceIndex()],
  ["UniformGridIndex", () => new UniformGridIndex(32)],
];

function slots(result: Uint32Array): number[] {
  return [...result];
}

describe.each(implementations)("%s", (_name, create) => {
  const box = { x: 0, y: 0, width: 10, height: 10 };

  it("finds overlapping rectangles in ascending slot order", () => {
    const index = create();
    index.insert(7, box);
    index.insert(2, { x: 5, y: 5, width: 10, height: 10 });
    index.insert(4, { x: 100, y: 100, width: 1, height: 1 });

    expect(slots(index.queryRect({ x: 4, y: 4, width: 3, height: 3 }))).toStrictEqual([2, 7]);
    expect(index.size).toBe(3);
  });

  it("does not report rectangles that only touch the query along an edge", () => {
    const index = create();
    index.insert(1, box);

    expect(slots(index.queryRect({ x: 10, y: 0, width: 5, height: 10 }))).toStrictEqual([]);
    expect(slots(index.queryRect({ x: -5, y: -5, width: 5, height: 5 }))).toStrictEqual([]);
  });

  it("treats rectangles as half-open for point queries", () => {
    const index = create();
    index.insert(1, box);
    index.insert(2, { x: 10, y: 0, width: 10, height: 10 });

    expect(slots(index.queryPoint(0, 0))).toStrictEqual([1]);
    expect(slots(index.queryPoint(9.5, 9.5))).toStrictEqual([1]);
    expect(slots(index.queryPoint(10, 5))).toStrictEqual([2]);
    expect(slots(index.queryPoint(10, 10))).toStrictEqual([]);
  });

  it("handles negative coordinates", () => {
    const index = create();
    index.insert(3, { x: -50, y: -50, width: 20, height: 20 });

    expect(slots(index.queryPoint(-40, -40))).toStrictEqual([3]);
    expect(slots(index.queryRect({ x: -100, y: -100, width: 60, height: 60 }))).toStrictEqual([3]);
  });

  it("moves a rectangle on update", () => {
    const index = create();
    index.insert(1, box);

    index.update(1, { x: 500, y: 500, width: 10, height: 10 });

    expect(slots(index.queryRect(box))).toStrictEqual([]);
    expect(slots(index.queryPoint(505, 505))).toStrictEqual([1]);
    expect(index.size).toBe(1);
  });

  it("forgets a removed slot", () => {
    const index = create();
    index.insert(1, box);

    expect(index.remove(1)).toBe(true);
    expect(index.remove(1)).toBe(false);
    expect(slots(index.queryRect(box))).toStrictEqual([]);
    expect(index.size).toBe(0);
  });

  it("indexes the float32 value of a rectangle", () => {
    const index = create();
    index.insert(1, { x: 16_777_217, y: 0, width: 1, height: 1 });

    expect(slots(index.queryPoint(16_777_216, 0))).toStrictEqual([1]);
  });

  it("finds rectangles far larger than a grid cell", () => {
    const index = create();
    index.insert(1, { x: -50_000, y: -50_000, width: 100_000, height: 100_000 });
    index.insert(2, { x: 0, y: 0, width: 1, height: 1 });

    expect(slots(index.queryPoint(31_000, -29_000))).toStrictEqual([1]);
    expect(slots(index.queryRect({ x: 0, y: 0, width: 0.5, height: 0.5 }))).toStrictEqual([1, 2]);
    expect(slots(index.queryRect({ x: -1e9, y: -1e9, width: 2e9, height: 2e9 }))).toStrictEqual([
      1, 2,
    ]);
    expect(index.remove(1)).toBe(true);
    expect(slots(index.queryPoint(31_000, -29_000))).toStrictEqual([]);
  });

  it("rounds queries to float32 like stored rectangles", () => {
    const index = create();
    index.insert(1, { x: 0, y: 0, width: 16_777_218, height: 10 });

    expect(slots(index.queryPoint(16_777_216.1, 5))).toStrictEqual([1]);
    expect(slots(index.queryPoint(16_777_217.9, 5))).toStrictEqual([]);
  });

  it("rejects queries that are not finite or have a negative size", () => {
    const index = create();
    index.insert(1, { x: 0, y: 0, width: 100, height: 100 });

    expect(() => index.queryRect({ x: 40, y: 40, width: -35, height: -35 })).toThrow(RangeError);
    expect(() => index.queryRect({ x: Number.NaN, y: 0, width: 1, height: 1 })).toThrow(RangeError);
    expect(() =>
      index.queryRect({ x: 0, y: 0, width: Number.POSITIVE_INFINITY, height: 1 }),
    ).toThrow(RangeError);
    expect(() => index.queryPoint(Number.NaN, 0)).toThrow(RangeError);
    expect(() => index.queryPoint(0, 1e39)).toThrow(RangeError);
  });

  it("keeps results exact far beyond the grid's addressable cells", () => {
    const index = create();
    index.insert(1, { x: 1e12, y: 0, width: 10, height: 10 });
    index.insert(2, { x: 2e12, y: 0, width: 10, height: 10 });
    index.insert(3, { x: -1e12, y: 0, width: 10, height: 10 });

    expect(slots(index.queryPoint(1e12, 5))).toStrictEqual([1]);
    expect(slots(index.queryPoint(2e12, 5))).toStrictEqual([2]);
    expect(slots(index.queryPoint(-1e12, 5))).toStrictEqual([3]);
    expect(slots(index.queryRect({ x: 1.5e12, y: 0, width: 1e12, height: 10 }))).toStrictEqual([2]);
  });

  it("refuses rectangles that overflow float32", () => {
    const index = create();

    expect(() => {
      index.insert(1, { x: -1e39, y: 0, width: 2e39, height: 1 });
    }).toThrow(RangeError);
    expect(index.size).toBe(0);
  });

  it("rejects bad arguments", () => {
    const index = create();
    index.insert(1, box);

    expect(() => {
      index.insert(1, box);
    }).toThrow(Error);
    expect(() => {
      index.update(2, box);
    }).toThrow(Error);
    expect(() => {
      index.insert(2, { x: 0, y: 0, width: 10, height: -1 });
    }).toThrow(RangeError);
    expect(() => {
      index.insert(-1, box);
    }).toThrow(RangeError);
    expect(() => {
      index.insert(1.5, box);
    }).toThrow(RangeError);
  });

  it("leaves the index untouched when an argument is rejected", () => {
    const index = create();
    index.insert(1, box);

    expect(() => {
      index.insert(2, { x: 0, y: 0, width: 10, height: -1 });
    }).toThrow(RangeError);
    expect(index.size).toBe(1);
    expect(slots(index.queryPoint(5, 5))).toStrictEqual([1]);
  });
});
