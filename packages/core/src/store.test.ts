import { describe, expect, it, vi } from "vite-plus/test";

import { createStore } from "./store.ts";
import type { Listener } from "./store.ts";

interface Counter {
  count: number;
  label: string;
}

interface WithAction {
  count: number;
  increment: () => void;
}

function counter(count = 0): Counter {
  return { count, label: "a" };
}

function listenerMock(): ReturnType<typeof vi.fn<Listener<Counter>>> {
  return vi.fn<Listener<Counter>>();
}

describe("createStore", () => {
  it("merges partial updates and keeps the other values", () => {
    const store = createStore<Counter>(() => counter());
    store.setState({ count: 1 });
    expect(store.getState()).toStrictEqual({ count: 1, label: "a" });
  });

  it("accepts an updater that reads the current state", () => {
    const store = createStore<Counter>(() => counter(1));
    store.setState((state) => ({ count: state.count + 1 }));
    expect(store.getState().count).toBe(2);
  });

  it("notifies listeners with the new and the previous state", () => {
    const store = createStore<Counter>(() => counter());
    const listener = listenerMock();
    store.subscribe(listener);
    store.setState({ count: 1 });
    expect(listener).toHaveBeenCalledExactlyOnceWith(
      { count: 1, label: "a" },
      { count: 0, label: "a" },
    );
  });

  it("does not notify, or replace the state object, when nothing changed", () => {
    const store = createStore<Counter>(() => counter());
    const listener = listenerMock();
    store.subscribe(listener);
    const before = store.getState();
    store.setState({ count: 0 });
    store.setState({});
    expect(listener).not.toHaveBeenCalled();
    expect(store.getState()).toBe(before);
  });

  it("stops notifying after unsubscribe", () => {
    const store = createStore<Counter>(() => counter());
    const listener = listenerMock();
    const unsubscribe = store.subscribe(listener);
    unsubscribe();
    store.setState({ count: 1 });
    expect(listener).not.toHaveBeenCalled();
  });

  it("lets a listener unsubscribe another one while notifying", () => {
    const store = createStore<Counter>(() => counter());
    const second = listenerMock();
    const unsubscribeSecond = store.subscribe(second);
    store.subscribe(() => {
      unsubscribeSecond();
    });
    store.setState({ count: 1 });
    store.setState({ count: 2 });
    expect(second).toHaveBeenCalledOnce();
  });

  it("hands the store to the initializer so the state can hold actions", () => {
    const store = createStore<WithAction>((api) => ({
      count: 0,
      increment: (): void => {
        api.setState((state) => ({ count: state.count + 1 }));
      },
    }));
    store.getState().increment();
    store.getState().increment();
    expect(store.getState().count).toBe(2);
  });

  it("can be destructured because its members do not depend on `this`", () => {
    const { getState, setState } = createStore<Counter>(() => counter());
    setState({ count: 3 });
    expect(getState().count).toBe(3);
  });
});
