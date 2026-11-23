import { describe, expect, it } from "vite-plus/test";

import {
  normalizePoint,
  normalizeRect,
  rectContainsPoint,
  rectOverlapArea,
  rectsIntersect,
} from "./geometry.ts";

describe("rectsIntersect", () => {
  const base = { x: 0, y: 0, width: 10, height: 10 };

  it("returns true for overlapping rectangles", () => {
    expect(rectsIntersect(base, { x: 5, y: 5, width: 10, height: 10 })).toBe(true);
  });

  it("returns true when one rectangle contains the other", () => {
    expect(rectsIntersect(base, { x: 2, y: 2, width: 2, height: 2 })).toBe(true);
  });

  it("returns false for disjoint rectangles", () => {
    expect(rectsIntersect(base, { x: 20, y: 20, width: 5, height: 5 })).toBe(false);
  });

  it("returns false for rectangles that only touch along an edge", () => {
    expect(rectsIntersect(base, { x: 10, y: 0, width: 5, height: 10 })).toBe(false);
  });
});

describe("rectContainsPoint", () => {
  const base = { x: 0, y: 0, width: 10, height: 10 };

  it("includes the top-left corner and excludes the bottom-right one", () => {
    expect(rectContainsPoint(base, 0, 0)).toBe(true);
    expect(rectContainsPoint(base, 10, 10)).toBe(false);
  });

  it("returns false outside the rectangle", () => {
    expect(rectContainsPoint(base, -1, 5)).toBe(false);
    expect(rectContainsPoint(base, 5, 11)).toBe(false);
  });
});

describe("normalizeRect", () => {
  it("rounds components to float32", () => {
    expect(normalizeRect({ x: 0.1, y: 16_777_217, width: 1, height: 2 })).toStrictEqual({
      x: Math.fround(0.1),
      y: 16_777_216,
      width: 1,
      height: 2,
    });
  });

  it("rejects non-finite components and negative sizes", () => {
    expect(() => normalizeRect({ x: Number.POSITIVE_INFINITY, y: 0, width: 1, height: 1 })).toThrow(
      RangeError,
    );
    expect(() => normalizeRect({ x: Number.NaN, y: 0, width: 1, height: 1 })).toThrow(RangeError);
    expect(() => normalizeRect({ x: 0, y: 0, width: -1, height: 1 })).toThrow(RangeError);
  });

  it("rejects finite doubles that overflow float32", () => {
    expect(() => normalizeRect({ x: 1e39, y: 0, width: 1, height: 1 })).toThrow(RangeError);
    expect(() => normalizeRect({ x: -1e39, y: 0, width: 2e39, height: 1 })).toThrow(RangeError);
  });
});

describe("normalizePoint", () => {
  it("rounds components to float32", () => {
    expect(normalizePoint(0.1, 16_777_217)).toStrictEqual({ x: Math.fround(0.1), y: 16_777_216 });
  });

  it("rejects non-finite values and float32 overflow", () => {
    expect(() => normalizePoint(Number.NaN, 0)).toThrow(RangeError);
    expect(() => normalizePoint(0, Number.NEGATIVE_INFINITY)).toThrow(RangeError);
    expect(() => normalizePoint(1e39, 0)).toThrow(RangeError);
  });
});

describe("rectOverlapArea", () => {
  const base = { x: 0, y: 0, width: 10, height: 10 };

  it("is the size of the shared region", () => {
    expect(rectOverlapArea(base, { x: 5, y: 6, width: 10, height: 10 })).toBe(20);
    expect(rectOverlapArea(base, { x: 2, y: 2, width: 3, height: 3 })).toBe(9);
  });

  it("is zero for rectangles that are apart or only touch", () => {
    expect(rectOverlapArea(base, { x: 20, y: 0, width: 5, height: 5 })).toBe(0);
    expect(rectOverlapArea(base, { x: 10, y: 0, width: 5, height: 5 })).toBe(0);
  });

  it("is symmetric", () => {
    const other = { x: -4, y: 3, width: 8, height: 20 };
    expect(rectOverlapArea(base, other)).toBe(rectOverlapArea(other, base));
  });
});
