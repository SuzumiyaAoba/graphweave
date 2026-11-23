import { describe, expect, it } from "vite-plus/test";

import {
  DEFAULT_SEED,
  MAX_ZOOM,
  MIN_ZOOM,
  createScene,
  initialViewport,
  translateNode,
} from "./scene.ts";
import type { SceneOptions } from "./scene.ts";

const options: SceneOptions = { nodeCount: 500, index: "grid", cellSize: 224, seed: DEFAULT_SEED };

describe("createScene", () => {
  it("stores and indexes every node", () => {
    const scene = createScene(options);

    expect(scene.store.count).toBe(500);
    expect(scene.index.size).toBe(500);
  });

  it("is deterministic for a seed and differs between seeds", () => {
    const first = createScene(options);
    const again = createScene(options);
    const other = createScene({ nodeCount: 500, index: "grid", cellSize: 224, seed: 2 });

    expect(again.store.rectOf(0)).toStrictEqual(first.store.rectOf(0));
    expect(other.store.rectOf(0)).not.toStrictEqual(first.store.rectOf(0));
  });

  it("keeps nodes within the extent", () => {
    const scene = createScene(options);
    const { x, y } = scene.store.columns;

    expect(Math.max(...x.slice(0, scene.store.slotCount))).toBeLessThanOrEqual(scene.extent);
    expect(Math.min(...y.slice(0, scene.store.slotCount))).toBeGreaterThanOrEqual(0);
  });

  it("answers queries the same way with either index", () => {
    const grid = createScene(options);
    const bruteForce = createScene({
      nodeCount: 500,
      index: "brute-force",
      cellSize: 224,
      seed: DEFAULT_SEED,
    });
    const area = { x: 200, y: 300, width: 900, height: 600 };

    expect(grid.index.queryRect(area).length).toBeGreaterThan(0);
    expect(grid.index.queryRect(area)).toStrictEqual(bruteForce.index.queryRect(area));
  });
});

describe("translateNode", () => {
  it("moves the node in the store and in the index together", () => {
    const scene = createScene(options);
    const before = scene.store.rectOf(7);

    translateNode(scene, 7, { x: 1000, y: -50 });

    const after = scene.store.rectOf(7);
    expect(after.x).toBeCloseTo(before.x + 1000);
    expect(after.y).toBeCloseTo(before.y - 50);
    expect([...scene.index.queryPoint(after.x + 1, after.y + 1)]).toContain(7);
  });

  it("removes the node from its old position in the index", () => {
    const scene = createScene(options);
    const before = scene.store.rectOf(7);

    translateNode(scene, 7, { x: 100_000, y: 100_000 });

    expect([...scene.index.queryPoint(before.x + 1, before.y + 1)]).not.toContain(7);
  });
});

describe("initialViewport", () => {
  it("fits a small scene entirely", () => {
    const scene = createScene({ nodeCount: 100, index: "grid", cellSize: 224, seed: DEFAULT_SEED });
    const viewport = initialViewport(scene, { width: 800, height: 600 });

    expect(viewport.zoom * scene.extent).toBeLessThanOrEqual(600);
  });

  it("shows a window of a large scene instead of all of it", () => {
    const scene = createScene({
      nodeCount: 100_000,
      index: "grid",
      cellSize: 224,
      seed: DEFAULT_SEED,
    });
    const viewport = initialViewport(scene, { width: 800, height: 600 });

    expect(viewport.zoom * scene.extent).toBeGreaterThan(600);
  });

  it("stays inside the zoom limits even for an empty canvas", () => {
    const scene = createScene({ nodeCount: 0, index: "grid", cellSize: 224, seed: DEFAULT_SEED });
    const { zoom } = initialViewport(scene, { width: 0, height: 0 });

    expect(zoom).toBeGreaterThanOrEqual(MIN_ZOOM);
    expect(zoom).toBeLessThanOrEqual(MAX_ZOOM);
  });
});
