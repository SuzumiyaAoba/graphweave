import { describe, expect, it } from "vite-plus/test";

import { NO_SLOT, NodeStore } from "./node-store.ts";

const unit = { x: 0, y: 0, width: 10, height: 10 };

describe("NodeStore", () => {
  it("hands out dense slots and maps ids both ways", () => {
    const store = new NodeStore();

    expect(store.add("a", unit)).toBe(0);
    expect(store.add("b", unit)).toBe(1);
    expect(store.slotOf("b")).toBe(1);
    expect(store.idOf(1)).toBe("b");
  });

  it("counts live nodes and handed-out slots", () => {
    const store = new NodeStore();
    store.add("a", unit);
    store.add("b", unit);

    expect(store.count).toBe(2);
    expect(store.slotCount).toBe(2);
  });

  it("stores geometry at float32 precision", () => {
    const store = new NodeStore();
    const slot = store.add("a", { x: 0.1, y: -0.1, width: 16_777_217, height: 1 });

    expect(store.rectOf(slot)).toStrictEqual({
      x: Math.fround(0.1),
      y: Math.fround(-0.1),
      width: 16_777_216,
      height: 1,
    });
  });

  it("exposes the columns for upload", () => {
    const store = new NodeStore();
    store.add("a", { x: 1, y: 2, width: 3, height: 4 });
    const { x, y, width, height, alive } = store.columns;

    expect([x[0], y[0], width[0], height[0], alive[0]]).toStrictEqual([1, 2, 3, 4, 1]);
  });

  it("rejects duplicate ids and invalid rectangles", () => {
    const store = new NodeStore();
    store.add("a", unit);

    expect(() => store.add("a", unit)).toThrow(Error);
    expect(() => store.add("b", { x: 0, y: 0, width: -1, height: 10 })).toThrow(RangeError);
    expect(() => store.add("c", { x: Number.NaN, y: 0, width: 10, height: 10 })).toThrow(
      RangeError,
    );
    expect(store.count).toBe(1);
  });

  it("frees the slot of a removed node", () => {
    const store = new NodeStore();
    store.add("a", unit);
    const second = store.add("b", unit);

    expect(store.remove("b")).toBe(true);
    expect(store.isAlive(second)).toBe(false);
    expect(() => store.idOf(second)).toThrow(RangeError);
    expect(store.slotOf("b")).toBe(NO_SLOT);
    expect(store.count).toBe(1);
  });

  it("reuses the slot of a removed node", () => {
    const store = new NodeStore();
    store.add("a", unit);
    const second = store.add("b", unit);
    store.remove("b");

    expect(store.add("c", unit)).toBe(second);
    expect(store.slotCount).toBe(2);
    expect(store.idOf(second)).toBe("c");
  });

  it("reports unknown ids on remove", () => {
    expect(new NodeStore().remove("missing")).toBe(false);
  });

  it("updates the geometry of a live node", () => {
    const store = new NodeStore();
    const slot = store.add("a", unit);

    store.setRect(slot, { x: 5, y: 6, width: 7, height: 8 });

    expect(store.rectOf(slot)).toStrictEqual({ x: 5, y: 6, width: 7, height: 8 });
  });

  it("refuses to read or write a free slot", () => {
    const store = new NodeStore();
    const slot = store.add("a", unit);
    store.remove("a");

    expect(() => store.rectOf(slot)).toThrow(RangeError);
    expect(() => {
      store.setRect(slot, unit);
    }).toThrow(RangeError);
    expect(() => store.rectOf(99)).toThrow(RangeError);
  });

  it("keeps all data when it grows past the initial capacity", () => {
    const store = new NodeStore();
    const total = 1000;
    for (let i = 0; i < total; i += 1) {
      store.add(`n${String(i)}`, { x: i, y: -i, width: 1, height: 2 });
    }

    expect(store.count).toBe(total);
    expect(store.columns.x.length).toBeGreaterThanOrEqual(total);
    expect(store.rectOf(store.slotOf("n999"))).toStrictEqual({
      x: 999,
      y: -999,
      width: 1,
      height: 2,
    });
    expect(store.rectOf(store.slotOf("n1"))).toStrictEqual({ x: 1, y: -1, width: 1, height: 2 });
  });

  it("replaces the backing arrays when it grows, so cached columns go stale", () => {
    const store = new NodeStore();
    const slot = store.add("a", unit);
    const stale = store.columns.x;
    for (let i = 0; i < 100; i += 1) {
      store.add(`n${String(i)}`, unit);
    }
    store.setRect(slot, { x: 7, y: 0, width: 10, height: 10 });

    expect(store.columns.x).not.toBe(stale);
    expect(store.columns.x[slot]).toBe(7);
    expect(stale[slot]).toBe(0);
  });

  it("rejects rectangles that overflow float32 without storing them", () => {
    const store = new NodeStore();

    expect(() => store.add("a", { x: 1e39, y: 0, width: 1, height: 1 })).toThrow(RangeError);
    expect(store.count).toBe(0);
    expect(store.slotCount).toBe(0);
  });
});
