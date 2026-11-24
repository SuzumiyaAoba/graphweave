import { BruteForceIndex, NodeStore, UniformGridIndex, clampZoom } from "@graphweave/core";
import type { Point, Size, SpatialIndex, Viewport } from "@graphweave/core";

/** Which spatial index answers visibility and hit-test queries. */
export type IndexKind = "grid" | "brute-force";

export interface SceneOptions {
  readonly nodeCount: number;
  readonly index: IndexKind;
  /** Edge length of a grid cell in flow units; only used by the `grid` index. */
  readonly cellSize: number;
  readonly seed: number;
}

/**
 * A node store and the spatial index over it. The core keeps them separate and leaves keeping them
 * in sync to the caller; `createScene` and `translateNode` are that caller for this playground.
 */
export interface Scene {
  readonly store: NodeStore;
  readonly index: SpatialIndex;
  /** Side length of the square that the nodes are scattered over, in flow units. */
  readonly extent: number;
}

export const DEFAULT_SEED = 1;
export const MIN_ZOOM = 0.01;
export const MAX_ZOOM = 4;

// The average node owns a NODE_SPACING x NODE_SPACING square, so the density stays the same for any count.
const NODE_SPACING = 120;
const MIN_NODE_WIDTH = 80;
const NODE_WIDTH_RANGE = 60;
const MIN_NODE_HEIGHT = 40;
const NODE_HEIGHT_RANGE = 40;

// Roughly 20 nodes fit across the initial view, however many nodes the scene has.
const TARGET_VISIBLE_WIDTH = 2400;
const FIT_MARGIN = 0.95;

const LCG_MULTIPLIER = 1_664_525;
const LCG_INCREMENT = 1_013_904_223;
const LCG_MODULUS = 4_294_967_296;

/** Deterministic linear congruential generator in `[0, 1)`, so a seed always yields the same scene. */
function createRandom(seed: number): () => number {
  let state = seed;
  return function random(): number {
    state = (state * LCG_MULTIPLIER + LCG_INCREMENT) % LCG_MODULUS;
    return state / LCG_MODULUS;
  };
}

function createIndex(kind: IndexKind, cellSize: number): SpatialIndex {
  if (kind === "grid") {
    return new UniformGridIndex(cellSize);
  }
  return new BruteForceIndex();
}

/** Scatters `nodeCount` nodes of varying size over a square and indexes them. */
export function createScene(options: SceneOptions): Scene {
  const random = createRandom(options.seed);
  const extent = Math.sqrt(options.nodeCount) * NODE_SPACING;
  const store = new NodeStore();
  const index = createIndex(options.index, options.cellSize);
  for (let i = 0; i < options.nodeCount; i += 1) {
    const slot = store.add(`node-${String(i)}`, {
      x: random() * extent,
      y: random() * extent,
      width: MIN_NODE_WIDTH + random() * NODE_WIDTH_RANGE,
      height: MIN_NODE_HEIGHT + random() * NODE_HEIGHT_RANGE,
    });
    index.insert(slot, store.rectOf(slot));
  }
  return { store, index, extent };
}

/** Moves a node by a flow-space delta, updating the store and the index together. */
export function translateNode(scene: Scene, slot: number, delta: Point): void {
  const rect = scene.store.rectOf(slot);
  const moved = {
    x: rect.x + delta.x,
    y: rect.y + delta.y,
    width: rect.width,
    height: rect.height,
  };
  scene.store.setRect(slot, moved);
  scene.index.update(slot, moved);
}

/**
 * A camera that shows the whole scene when it is small and a window of about 20 nodes across when it
 * is large, centred on the scene.
 */
export function initialViewport(scene: Scene, size: Size): Viewport {
  const fitZoom = (Math.min(size.width, size.height) / Math.max(scene.extent, 1)) * FIT_MARGIN;
  const zoom = clampZoom(Math.max(fitZoom, size.width / TARGET_VISIBLE_WIDTH), MIN_ZOOM, MAX_ZOOM);
  const center = scene.extent / 2;
  return { x: size.width / 2 - center * zoom, y: size.height / 2 - center * zoom, zoom };
}
