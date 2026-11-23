import { normalizePoint, normalizeRect, rectContainsPoint, rectsIntersect } from "./geometry.ts";
import type { Rect } from "./geometry.ts";
import { assertSlot, toSortedSlots } from "./spatial-index.ts";
import type { SpatialIndex } from "./spatial-index.ts";

/**
 * Linear-scan {@link SpatialIndex}. It is obviously correct and therefore the oracle other
 * implementations (the uniform grid, later the WASM ones) are compared against.
 */
export class BruteForceIndex implements SpatialIndex {
  readonly #rects = new Map<number, Rect>();

  public get size(): number {
    return this.#rects.size;
  }

  public insert(slot: number, rect: Rect): void {
    assertSlot(slot);
    if (this.#rects.has(slot)) {
      throw new Error(`Slot ${String(slot)} is already indexed`);
    }
    this.#rects.set(slot, normalizeRect(rect));
  }

  public update(slot: number, rect: Rect): void {
    assertSlot(slot);
    if (!this.#rects.has(slot)) {
      throw new Error(`Slot ${String(slot)} is not indexed`);
    }
    this.#rects.set(slot, normalizeRect(rect));
  }

  public remove(slot: number): boolean {
    return this.#rects.delete(slot);
  }

  public queryRect(rect: Rect): Uint32Array {
    const query = normalizeRect(rect);
    const hits: number[] = [];
    for (const [slot, stored] of this.#rects) {
      if (rectsIntersect(stored, query)) {
        hits.push(slot);
      }
    }
    return toSortedSlots(hits);
  }

  public queryPoint(x: number, y: number): Uint32Array {
    const point = normalizePoint(x, y);
    const hits: number[] = [];
    for (const [slot, stored] of this.#rects) {
      if (rectContainsPoint(stored, point.x, point.y)) {
        hits.push(slot);
      }
    }
    return toSortedSlots(hits);
  }
}
