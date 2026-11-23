export type Listener<TState> = (state: TState, previous: TState) => void;

/** A tiny observable state container; it is what `useSyncExternalStore` subscribes to. */
export interface Store<TState> {
  getState: () => TState;
  /** Shallow-merges `partial` into the state; listeners run only when a value actually changed. */
  setState: (partial: Partial<TState> | ((state: TState) => Partial<TState>)) => void;
  subscribe: (listener: Listener<TState>) => () => void;
}

function changes<TState extends object>(state: TState, partial: Partial<TState>): boolean {
  return Object.entries(partial).some(([key, value]) => !Object.is(Reflect.get(state, key), value));
}

// The members are arrow functions so a store can be destructured (`const { getState } = store`).
class ObservableStore<TState extends object> implements Store<TState> {
  #state: TState;
  readonly #listeners = new Set<Listener<TState>>();

  public constructor(initialize: (store: Store<TState>) => TState) {
    this.#state = initialize(this);
  }

  public getState = (): TState => this.#state;

  public setState = (partial: Partial<TState> | ((state: TState) => Partial<TState>)): void => {
    const current = this.#state;
    const next = typeof partial === "function" ? partial(current) : partial;
    if (!changes(current, next)) {
      return;
    }
    this.#state = { ...current, ...next };
    // A snapshot, because a listener may unsubscribe itself or another one while being notified.
    // oxlint-disable-next-line unicorn/no-useless-spread
    for (const listener of [...this.#listeners]) {
      listener(this.#state, current);
    }
  };

  public subscribe = (listener: Listener<TState>): (() => void) => {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };
}

/**
 * Creates a store. `initialize` receives the store itself, which lets the initial state contain
 * actions that close over `getState`/`setState`; they must not be called before it returns.
 */
export function createStore<TState extends object>(
  initialize: (store: Store<TState>) => TState,
): Store<TState> {
  return new ObservableStore(initialize);
}
