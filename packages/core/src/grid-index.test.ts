import { describe, expect, it } from "vite-plus/test";

import { BruteForceIndex } from "./brute-force-index.ts";
import type { Rect } from "./geometry.ts";
import { UniformGridIndex } from "./grid-index.ts";

const modulus = 4_294_967_296;
const slotRange = 150;

/** Deterministic linear congruential generator in `[0, 1)`; no bitwise operators needed. */
function createRandom(seed: number): () => number {
  let state = seed;
  return function random(): number {
    state = (state * 1_664_525 + 1_013_904_223) % modulus;
    return state / modulus;
  };
}

/** Half of the coordinates snap to the cell grid so that boundary cases are exercised constantly. */
function coordinate(random: () => number, cellSize: number, extent: number): number {
  const raw = (random() - 0.5) * extent;
  if (random() < 0.5) {
    return Math.round(raw / cellSize) * cellSize;
  }
  return raw;
}

function randomRect(random: () => number, cellSize: number): Rect {
  // One in twenty rectangles is far larger than a cell, so the oversized list is used too.
  let span = cellSize * 3;
  if (random() < 0.05) {
    span = cellSize * 40;
  }
  return {
    x: coordinate(random, cellSize, 1000),
    y: coordinate(random, cellSize, 1000),
    width: Math.abs(coordinate(random, cellSize, span)),
    height: Math.abs(coordinate(random, cellSize, span)),
  };
}

interface Scenario {
  readonly random: () => number;
  readonly cellSize: number;
  readonly oracle: BruteForceIndex;
  readonly grid: UniformGridIndex;
  readonly live: Set<number>;
}

function insertEverywhere(scenario: Scenario, slot: number, rect: Rect): void {
  scenario.live.add(slot);
  scenario.oracle.insert(slot, rect);
  scenario.grid.insert(slot, rect);
}

function removeEverywhere(scenario: Scenario, slot: number): void {
  scenario.live.delete(slot);
  scenario.oracle.remove(slot);
  scenario.grid.remove(slot);
}

function updateEverywhere(scenario: Scenario, slot: number, rect: Rect): void {
  scenario.oracle.update(slot, rect);
  scenario.grid.update(slot, rect);
}

function applyRandomOperation(scenario: Scenario): void {
  const { random, cellSize, live } = scenario;
  const slot = Math.floor(random() * slotRange);
  const rect = randomRect(random, cellSize);
  const roll = random();
  if (!live.has(slot)) {
    insertEverywhere(scenario, slot, rect);
  } else if (roll < 0.25) {
    removeEverywhere(scenario, slot);
  } else {
    updateEverywhere(scenario, slot, rect);
  }
}

describe("UniformGridIndex", () => {
  it("rejects a cell size that is not positive and finite", () => {
    expect(() => new UniformGridIndex(0)).toThrow(RangeError);
    expect(() => new UniformGridIndex(-4)).toThrow(RangeError);
    expect(() => new UniformGridIndex(Number.NaN)).toThrow(RangeError);
    expect(() => new UniformGridIndex(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });

  it.each([
    [1, 16],
    [2, 16],
    [3, 64],
    [4, 7.5],
    [5, 1000],
  ])("agrees with the brute-force oracle (seed %i, cell size %f)", (seed, cellSize) => {
    const scenario: Scenario = {
      random: createRandom(seed),
      cellSize,
      oracle: new BruteForceIndex(),
      grid: new UniformGridIndex(cellSize),
      live: new Set<number>(),
    };

    let totalHits = 0;
    for (let step = 0; step < 3000; step += 1) {
      applyRandomOperation(scenario);
      const query = randomRect(scenario.random, cellSize);
      const x = coordinate(scenario.random, cellSize, 1000);
      const y = coordinate(scenario.random, cellSize, 1000);
      const expected = scenario.oracle.queryRect(query);
      totalHits += expected.length;

      expect(scenario.grid.queryRect(query)).toStrictEqual(expected);
      expect(scenario.grid.queryPoint(x, y)).toStrictEqual(scenario.oracle.queryPoint(x, y));
      expect(scenario.grid.size).toBe(scenario.oracle.size);
    }

    // Agreeing on empty results would prove nothing: the queries must actually hit rectangles.
    expect(totalHits).toBeGreaterThan(20);
  });
});
