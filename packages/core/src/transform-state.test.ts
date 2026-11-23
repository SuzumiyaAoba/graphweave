import { describe, expect, it } from "vite-plus/test";

import { createFlowStore } from "./flow-store.ts";

describe("the transform of the store", () => {
  it("starts as the viewport the store starts with", () => {
    expect(
      createFlowStore({ viewport: { x: 5, y: 6, zoom: 2 } }).getState().transform,
    ).toStrictEqual([5, 6, 2]);
  });

  it("is [0, 0, 1] when there is no viewport to start from", () => {
    expect(createFlowStore().getState().transform).toStrictEqual([0, 0, 1]);
  });

  it("follows the viewport that is set", () => {
    const store = createFlowStore();
    store.getState().setViewport({ x: 10, y: 20, zoom: 1.5 });
    expect(store.getState().transform).toStrictEqual([10, 20, 1.5]);
  });

  it("follows the viewport that the owner hands in", () => {
    const store = createFlowStore();
    store.getState().syncViewport({ x: -4, y: 8, zoom: 1 });
    expect(store.getState().transform).toStrictEqual([-4, 8, 1]);
  });

  it("stays with what is drawn while the owner holds the viewport", () => {
    const store = createFlowStore();
    store.setState({ viewportControlled: true });
    store.getState().setViewport({ x: 10, y: 20, zoom: 1.5 });
    expect(store.getState().transform).toStrictEqual([0, 0, 1]);
  });
});
