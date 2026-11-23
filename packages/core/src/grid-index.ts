import { normalizePoint, normalizeRect, rectContainsPoint, rectsIntersect } from "./geometry.ts";
import type { Rect } from "./geometry.ts";
import { assertSlot, toSortedSlots } from "./spatial-index.ts";
import type { SpatialIndex } from "./spatial-index.ts";

// Cell coordinates are clamped to `±CELL_LIMIT` so that the packed numeric key stays below 2^53.
// Clamping is applied identically on insert and query, so it can only add false candidates.
const CELL_LIMIT = 16_777_216;
const CELL_SPAN = 2 * CELL_LIMIT + 1;

// A rectangle covering more cells than this is kept in a separate list that every query checks.
const MAX_CELLS_PER_ENTRY = 256;

interface CellRange {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}

function cellCoord(value: number, cellSize: number): number {
  return Math.max(-CELL_LIMIT, Math.min(CELL_LIMIT, Math.floor(value / cellSize)));
}

function cellKey(cellX: number, cellY: number): number {
  return (cellX + CELL_LIMIT) * CELL_SPAN + (cellY + CELL_LIMIT);
}

function cellCount(range: CellRange): number {
  return Math.max(0, range.maxX - range.minX + 1) * Math.max(0, range.maxY - range.minY + 1);
}

function sameRange(a: CellRange, b: CellRange): boolean {
  return a.minX === b.minX && a.maxX === b.maxX && a.minY === b.minY && a.maxY === b.maxY;
}

/**
 * Uniform-grid {@link SpatialIndex}: space is cut into square cells and every rectangle is registered
 * in the cells it touches. Moving a node within the same cells costs O(1), which is what dragging
 * needs; sparse cells live in a `Map`, so the plane is unbounded.
 *
 * Choose `cellSize` around two average node sizes: smaller cells make queries tighter but make large
 * nodes register in more cells.
 *
 * Coordinates farther than about 16.7 million cells from the origin share the outermost cells. That
 * never changes results (candidates are re-checked exactly) but such nodes lose the grid's selectivity.
 */
export class UniformGridIndex implements SpatialIndex {
  readonly #cellSize: number;
  readonly #rects = new Map<number, Rect>();
  readonly #cells = new Map<number, Set<number>>();
  readonly #oversized = new Set<number>();

  /** @throws {RangeError} When `cellSize` is not a positive finite number. */
  public constructor(cellSize: number) {
    if (!Number.isFinite(cellSize) || cellSize <= 0) {
      throw new RangeError(`cellSize must be a positive finite number, got ${String(cellSize)}`);
    }
    this.#cellSize = cellSize;
  }

  public get size(): number {
    return this.#rects.size;
  }

  public insert(slot: number, rect: Rect): void {
    assertSlot(slot);
    if (this.#rects.has(slot)) {
      throw new Error(`Slot ${String(slot)} is already indexed`);
    }
    const normalized = normalizeRect(rect);
    this.#rects.set(slot, normalized);
    this.#place(slot, this.#rangeOf(normalized));
  }

  public update(slot: number, rect: Rect): void {
    assertSlot(slot);
    const previous = this.#rects.get(slot);
    if (!previous) {
      throw new Error(`Slot ${String(slot)} is not indexed`);
    }
    const normalized = normalizeRect(rect);
    this.#rects.set(slot, normalized);
    this.#relocate(slot, previous, normalized);
  }

  public remove(slot: number): boolean {
    const stored = this.#rects.get(slot);
    if (!stored) {
      return false;
    }
    this.#unplace(slot, this.#rangeOf(stored));
    this.#rects.delete(slot);
    return true;
  }

  public queryRect(rect: Rect): Uint32Array {
    const query = normalizeRect(rect);
    const range = this.#rangeOf(query);
    const hits = new Set<number>();
    if (cellCount(range) > this.#cells.size) {
      // The query spans more cells than are occupied, so scanning the entries is cheaper.
      this.#collect(this.#rects.keys(), query, hits);
    } else {
      for (let cellX = range.minX; cellX <= range.maxX; cellX += 1) {
        for (let cellY = range.minY; cellY <= range.maxY; cellY += 1) {
          this.#collect(this.#cells.get(cellKey(cellX, cellY)) ?? [], query, hits);
        }
      }
      this.#collect(this.#oversized, query, hits);
    }
    return toSortedSlots(hits);
  }

  public queryPoint(x: number, y: number): Uint32Array {
    const point = normalizePoint(x, y);
    const hits: number[] = [];
    const key = cellKey(cellCoord(point.x, this.#cellSize), cellCoord(point.y, this.#cellSize));
    for (const candidates of [this.#cells.get(key) ?? [], this.#oversized]) {
      for (const slot of candidates) {
        const stored = this.#rects.get(slot);
        if (stored && rectContainsPoint(stored, point.x, point.y)) {
          hits.push(slot);
        }
      }
    }
    return toSortedSlots(hits);
  }

  #rangeOf(rect: Rect): CellRange {
    return {
      minX: cellCoord(rect.x, this.#cellSize),
      maxX: cellCoord(rect.x + rect.width, this.#cellSize),
      minY: cellCoord(rect.y, this.#cellSize),
      maxY: cellCoord(rect.y + rect.height, this.#cellSize),
    };
  }

  #collect(candidates: Iterable<number>, query: Rect, hits: Set<number>): void {
    for (const slot of candidates) {
      const stored = this.#rects.get(slot);
      if (stored && rectsIntersect(stored, query)) {
        hits.add(slot);
      }
    }
  }

  /** Re-registers a slot only when its rectangle moved to a different set of cells. */
  #relocate(slot: number, previous: Rect, next: Rect): void {
    const before = this.#rangeOf(previous);
    const after = this.#rangeOf(next);
    if (!sameRange(before, after)) {
      this.#unplace(slot, before);
      this.#place(slot, after);
    }
  }

  #place(slot: number, range: CellRange): void {
    if (cellCount(range) > MAX_CELLS_PER_ENTRY) {
      this.#oversized.add(slot);
      return;
    }
    for (let cellX = range.minX; cellX <= range.maxX; cellX += 1) {
      for (let cellY = range.minY; cellY <= range.maxY; cellY += 1) {
        const key = cellKey(cellX, cellY);
        const cell = this.#cells.get(key) ?? new Set<number>();
        cell.add(slot);
        this.#cells.set(key, cell);
      }
    }
  }

  #unplace(slot: number, range: CellRange): void {
    if (cellCount(range) > MAX_CELLS_PER_ENTRY) {
      this.#oversized.delete(slot);
      return;
    }
    for (let cellX = range.minX; cellX <= range.maxX; cellX += 1) {
      for (let cellY = range.minY; cellY <= range.maxY; cellY += 1) {
        this.#leave(cellKey(cellX, cellY), slot);
      }
    }
  }

  #leave(key: number, slot: number): void {
    const cell = this.#cells.get(key);
    if (!cell) {
      return;
    }
    cell.delete(slot);
    if (cell.size === 0) {
      this.#cells.delete(key);
    }
  }
}
