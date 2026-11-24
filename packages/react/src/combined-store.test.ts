import { createStore } from "@graphweave/core";
import { describe, expect, it, vi } from "vite-plus/test";

import { combineStores } from "./combined-store.ts";

interface Main {
  nodes: string[];
  queued: boolean;
}

interface Side {
  handlers: string[];
}

function make(): ReturnType<typeof combineStores<Main, Side>> {
  const main = createStore<Main>(() => ({ nodes: [], queued: false }));
  const side = createStore<Side>(() => ({ handlers: [] }));
  return combineStores(main, side, new Set(["handlers"]));
}

describe("combineStores", () => {
  it("gives both states side by side, the same object until one of them changes", () => {
    const store = make();
    const first = store.getState();
    expect(store.getState()).toBe(first);
    store.setState({ handlers: ["a"] });
    expect(store.getState()).not.toBe(first);
    expect(store.getState()).toStrictEqual({ nodes: [], queued: false, handlers: ["a"] });
  });

  it("hands each key to the store that owns it", () => {
    const main = createStore<Main>(() => ({ nodes: [], queued: false }));
    const side = createStore<Side>(() => ({ handlers: [] }));
    const store = combineStores(main, side, new Set(["handlers"]));
    store.setState({ queued: true, handlers: ["a"] });
    expect([main.getState().queued, side.getState().handlers]).toStrictEqual([true, ["a"]]);
    expect(Object.keys(main.getState())).not.toContain("handlers");
  });

  it("tells a listener once of a change with keys of both, when both are written", () => {
    const store = make();
    const seen: Main[] & Side[] = [];
    const listener = vi.fn<(state: Main & Side) => void>((state) => {
      seen.push({ ...state });
    });
    store.subscribe(listener);
    store.setState({ nodes: ["n"], handlers: ["h"] });
    expect(seen).toStrictEqual([{ nodes: ["n"], queued: false, handlers: ["h"] }]);
  });

  it("tells a listener of each change that has keys of one store only", () => {
    const store = make();
    const listener = vi.fn<(state: Main & Side) => void>();
    store.subscribe(listener);
    store.setState({ nodes: ["n"] });
    store.setState({ handlers: ["h"] });
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("stops telling a listener that has unsubscribed", () => {
    const store = make();
    const listener = vi.fn<(state: Main & Side) => void>();
    const unsubscribe = store.subscribe(listener);
    unsubscribe();
    store.setState({ nodes: ["n"], handlers: ["h"] });
    expect(listener).not.toHaveBeenCalled();
  });
});
