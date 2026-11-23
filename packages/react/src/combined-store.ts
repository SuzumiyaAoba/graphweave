import type { Store } from "@free-flow/core";

interface Merged<TMain, TSide> {
  main: TMain;
  side: TSide;
  merged: TMain & TSide;
}

function merge<TMain extends object, TSide extends object>(
  main: TMain,
  side: TSide,
): Merged<TMain, TSide> {
  return { main, side, merged: { ...side, ...main } };
}

// Hands each key of a change to the store that owns it.
function split(
  change: object,
  sideKeys: ReadonlySet<string>,
): { main: Record<string, unknown>; side: Record<string, unknown> } {
  const parts: { main: Record<string, unknown>; side: Record<string, unknown> } = {
    main: {},
    side: {},
  };
  for (const [key, value] of Object.entries(change)) {
    parts[sideKeys.has(key) ? "side" : "main"][key] = value;
  }
  return parts;
}

// Writes a change into the two stores, each key into the one that owns it: the side store first.
function write<TMain extends object, TSide extends object>(
  stores: { main: Store<TMain>; side: Store<TSide> },
  sideKeys: ReadonlySet<string>,
  change: object,
): void {
  const parts = split(change, sideKeys);
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- each part holds keys of its own store
  stores.side.setState(parts.side as Partial<TSide>);
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- each part holds keys of its own store
  stores.main.setState(parts.main as Partial<TMain>);
}

/**
 * Two stores seen as one: `getState` gives the two states side by side (the same object until one
 * of them changes), `setState` hands each key to the store that owns it, and a listener is told
 * when either changes. A change that has keys of both is told once, after both are written, so that
 * no listener sees one half of it. React Flow keeps all of this in one store, and code written for
 * it reads it through `useStore`.
 */
export function combineStores<TMain extends object, TSide extends object>(
  main: Store<TMain>,
  side: Store<TSide>,
  sideKeys: ReadonlySet<string>,
): Store<TMain & TSide> {
  let cache = merge(main.getState(), side.getState());
  let writing = 0;
  const notifiers = new Set<() => void>();
  const getState = (): TMain & TSide => {
    if (cache.main !== main.getState() || cache.side !== side.getState()) {
      cache = merge(main.getState(), side.getState());
    }
    return cache.merged;
  };
  const setState: Store<TMain & TSide>["setState"] = (partial) => {
    const change = typeof partial === "function" ? partial(getState()) : partial;
    writing += 1;
    try {
      write({ main, side }, sideKeys, change);
    } finally {
      writing -= 1;
    }
    for (const notify of notifiers) {
      notify();
    }
  };
  const subscribe: Store<TMain & TSide>["subscribe"] = (listener) => {
    let last = getState();
    const notify = (): void => {
      if (writing > 0) {
        return;
      }
      const now = getState();
      const previous = last;
      last = now;
      if (now !== previous) {
        listener(now, previous);
      }
    };
    const stopMain = main.subscribe(notify);
    const stopSide = side.subscribe(notify);
    notifiers.add(notify);
    return (): void => {
      notifiers.delete(notify);
      stopMain();
      stopSide();
    };
  };
  return { getState, setState, subscribe };
}
