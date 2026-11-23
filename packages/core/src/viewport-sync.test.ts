import { describe, expect, it, vi } from "vite-plus/test";

import { createFlowStore } from "./flow-store.ts";

function held(): ReturnType<typeof createFlowStore> {
  const store = createFlowStore({ width: 800, height: 600, viewport: { x: 50, y: 40, zoom: 1 } });
  store.setState({ viewportControlled: true });
  return store;
}

describe("syncViewport", () => {
  it("tells nobody when it is given the viewport that is drawn and nothing waits for the owner", () => {
    const store = held();
    const listener = vi.fn<() => void>();
    store.subscribe(listener);
    store.getState().syncViewport({ x: 50, y: 40, zoom: 1 });
    expect(listener).not.toHaveBeenCalled();
  });

  it("takes over a viewport that is not the one drawn", () => {
    const store = held();
    store.getState().syncViewport({ x: 100, y: 40, zoom: 1 });
    expect(store.getState().viewport).toStrictEqual({ x: 100, y: 40, zoom: 1 });
  });

  it("answers a move of the user's that waits for the owner, also when the owner holds on", () => {
    const store = held();
    store.getState().setViewport({ x: 20, y: 40, zoom: 1 });
    expect(store.getState().pendingViewport).toStrictEqual({ x: 20, y: 40, zoom: 1 });
    store.getState().syncViewport({ x: 50, y: 40, zoom: 1 });
    expect(store.getState().pendingViewport).toBeUndefined();
    expect(store.getState().viewport).toStrictEqual({ x: 50, y: 40, zoom: 1 });
  });
});
