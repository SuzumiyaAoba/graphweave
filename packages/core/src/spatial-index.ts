import type { Rect } from "./geometry.ts";

/**
 * Spatial index over node rectangles, keyed by the slot of a {@link NodeStore}.
 *
 * The contract is deliberately numeric (slots in, a `Uint32Array` out) so that a WASM implementation
 * can replace the TypeScript ones without allocating objects at the boundary.
 *
 * Every rectangle and every query is rounded to `float32` on the way in (see `normalizeRect`) and
 * rejected with a `RangeError` when it is not finite or has a negative size. Edges are computed in
 * double precision from the rounded values, so an implementation working on `f32` data must widen to
 * `f64` for comparisons to agree exactly. `queryRect` follows `rectsIntersect` (touching edges do not
 * hit) while `queryPoint` follows `rectContainsPoint` (half-open).
 */
export interface SpatialIndex {
  /** Number of indexed slots. */
  readonly size: number;
  /** Indexes a slot. Throws when the slot is already present or the rectangle is invalid. */
  insert: (slot: number, rect: Rect) => void;
  /** Replaces the rectangle of an indexed slot. Throws when the slot is absent or the rectangle is invalid. */
  update: (slot: number, rect: Rect) => void;
  /** Removes a slot. Returns `false` when it was not indexed. */
  remove: (slot: number) => boolean;
  /** Slots whose rectangle overlaps `rect`, in ascending order. */
  queryRect: (rect: Rect) => Uint32Array;
  /** Slots whose rectangle contains the point, in ascending order. */
  queryPoint: (x: number, y: number) => Uint32Array;
}

const MAX_SLOT = 4_294_967_295;

/**
 * Shared argument check for implementations.
 *
 * @throws {RangeError} When the slot is not a `u32`.
 */
export function assertSlot(slot: number): void {
  if (!Number.isInteger(slot) || slot < 0 || slot > MAX_SLOT) {
    throw new RangeError(`Slot must be an unsigned 32-bit integer, got ${String(slot)}`);
  }
}

/** Collects slots into the canonical query result: unique and ascending. */
export function toSortedSlots(slots: Iterable<number>): Uint32Array {
  return Uint32Array.from(new Set(slots)).toSorted();
}
