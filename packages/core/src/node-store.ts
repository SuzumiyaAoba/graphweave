import { normalizeRect } from "./geometry.ts";
import type { Rect } from "./geometry.ts";

/** Returned by {@link NodeStore.slotOf} when the id is unknown. */
export const NO_SLOT = -1;

const INITIAL_CAPACITY = 64;
const DEAD = 0;
const ALIVE = 1;

/**
 * Backing typed arrays of a {@link NodeStore}, indexed by slot. They are what gets uploaded to the GPU
 * (or shared with WASM), so the layout is structure-of-arrays.
 *
 * The arrays are replaced when the store grows: re-read {@link NodeStore.columns} instead of caching
 * them. Only the first {@link NodeStore.slotCount} entries are meaningful, and freed slots keep stale
 * values, so consult `alive` before reading a slot.
 */
export interface NodeColumns {
  readonly x: Float32Array;
  readonly y: Float32Array;
  readonly width: Float32Array;
  readonly height: Float32Array;
  readonly alive: Uint8Array;
}

function grownFloats(source: Float32Array, capacity: number): Float32Array<ArrayBuffer> {
  const target = new Float32Array(capacity);
  target.set(source);
  return target;
}

function grownBytes(source: Uint8Array, capacity: number): Uint8Array<ArrayBuffer> {
  const target = new Uint8Array(capacity);
  target.set(source);
  return target;
}

/**
 * Node geometry kept in typed-array columns addressed by a dense `u32` slot. String ids are translated
 * to slots here and never cross the JS/WASM boundary; user `data` stays outside the store.
 *
 * Slots of removed nodes are reused, so a slot is only meaningful while {@link NodeStore.isAlive}.
 */
export class NodeStore {
  #x = new Float32Array(INITIAL_CAPACITY);
  #y = new Float32Array(INITIAL_CAPACITY);
  #width = new Float32Array(INITIAL_CAPACITY);
  #height = new Float32Array(INITIAL_CAPACITY);
  #alive = new Uint8Array(INITIAL_CAPACITY);
  #capacity = INITIAL_CAPACITY;
  #slotCount = 0;
  readonly #slotById = new Map<string, number>();
  readonly #idBySlot: string[] = [];
  readonly #freeSlots: number[] = [];

  /** Number of live nodes. */
  public get count(): number {
    return this.#slotById.size;
  }

  /** One past the highest slot ever handed out; the iteration bound for {@link NodeStore.columns}. */
  public get slotCount(): number {
    return this.#slotCount;
  }

  /** The current backing arrays. Valid until the next {@link NodeStore.add}. */
  public get columns(): NodeColumns {
    return { x: this.#x, y: this.#y, width: this.#width, height: this.#height, alive: this.#alive };
  }

  /**
   * Adds a node and returns its slot.
   *
   * @throws {Error} When the id is already present.
   * @throws {RangeError} When the rectangle is invalid.
   */
  public add(id: string, rect: Rect): number {
    if (this.#slotById.has(id)) {
      throw new Error(`Node "${id}" already exists`);
    }
    const normalized = normalizeRect(rect);
    const slot = this.#freeSlots.pop() ?? this.#allocate();
    this.#slotById.set(id, slot);
    this.#idBySlot[slot] = id;
    this.#alive[slot] = ALIVE;
    this.#write(slot, normalized);
    return slot;
  }

  /** Removes a node and frees its slot for reuse. Returns `false` when the id is unknown. */
  public remove(id: string): boolean {
    const slot = this.slotOf(id);
    if (slot === NO_SLOT) {
      return false;
    }
    this.#slotById.delete(id);
    this.#idBySlot[slot] = "";
    this.#alive[slot] = DEAD;
    this.#freeSlots.push(slot);
    return true;
  }

  /** The slot of a node, or {@link NO_SLOT} when the id is unknown. */
  public slotOf(id: string): number {
    return this.#slotById.get(id) ?? NO_SLOT;
  }

  /**
   * The id of the node in a slot.
   *
   * @throws {RangeError} When the slot is not alive.
   */
  public idOf(slot: number): string {
    this.#assertAlive(slot);
    const id = this.#idBySlot[slot];
    if (typeof id !== "string") {
      throw new TypeError(`Slot ${String(slot)} has no id`);
    }
    return id;
  }

  /** Whether the slot currently holds a node. */
  public isAlive(slot: number): boolean {
    return this.#alive[slot] === ALIVE;
  }

  /**
   * The geometry of a live node, as stored (`float32` precision).
   *
   * @throws {RangeError} When the slot is not alive.
   */
  public rectOf(slot: number): Rect {
    this.#assertAlive(slot);
    return {
      x: this.#x[slot] ?? 0,
      y: this.#y[slot] ?? 0,
      width: this.#width[slot] ?? 0,
      height: this.#height[slot] ?? 0,
    };
  }

  /**
   * Replaces the geometry of a live node.
   *
   * @throws {RangeError} When the slot is not alive or the rectangle is invalid.
   */
  public setRect(slot: number, rect: Rect): void {
    this.#assertAlive(slot);
    this.#write(slot, normalizeRect(rect));
  }

  #allocate(): number {
    const slot = this.#slotCount;
    this.#slotCount += 1;
    if (slot === this.#capacity) {
      this.#capacity *= 2;
      this.#x = grownFloats(this.#x, this.#capacity);
      this.#y = grownFloats(this.#y, this.#capacity);
      this.#width = grownFloats(this.#width, this.#capacity);
      this.#height = grownFloats(this.#height, this.#capacity);
      this.#alive = grownBytes(this.#alive, this.#capacity);
    }
    return slot;
  }

  #write(slot: number, rect: Rect): void {
    this.#x[slot] = rect.x;
    this.#y[slot] = rect.y;
    this.#width[slot] = rect.width;
    this.#height[slot] = rect.height;
  }

  #assertAlive(slot: number): void {
    if (!this.isAlive(slot)) {
      throw new RangeError(`Slot ${String(slot)} is not alive`);
    }
  }
}
