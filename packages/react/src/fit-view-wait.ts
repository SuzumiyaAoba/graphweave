import { noop } from "./noop.ts";
import type { ReactFlowStore } from "./store-context.ts";
import type { FitViewResolver } from "./view-mirror.ts";

function createResolver(): FitViewResolver {
  const settle: Pick<FitViewResolver, "resolve" | "reject"> = { resolve: noop, reject: noop };
  // oxlint-disable-next-line promise/avoid-new -- the functions that settle the promise are handed out
  const promise = new Promise<boolean>((resolve, reject) => {
    settle.resolve = resolve;
    settle.reject = reject;
  });
  return {
    promise,
    resolve: (done) => {
      settle.resolve(done);
    },
    reject: (reason) => {
      settle.reject(reason);
    },
  };
}

/**
 * A fit that had to wait for the nodes to be measured: what is returned is settled when the fit has
 * been made, as React Flow's `fitView` does. Fits asked for in the meantime share one promise.
 */
export async function waitForQueuedFit(store: ReactFlowStore): Promise<boolean> {
  const resolver: FitViewResolver = store.getState().fitViewResolver ?? createResolver();
  store.setState({ fitViewResolver: resolver });
  const done = await resolver.promise;
  return done;
}

/** Settles what `waitForQueuedFit` gave out, once the queued fit has been made: with `true`, as React Flow does. */
export function settleQueuedFit(store: ReactFlowStore): void {
  const { fitViewResolver } = store.getState();
  if (fitViewResolver !== null && !store.getState().fitViewQueued) {
    store.setState({ fitViewResolver: null });
    fitViewResolver.resolve(true);
  }
}

/** Tells what waits for the queued fit that it could not be made, rather than leaving it waiting. */
export function failQueuedFit(store: ReactFlowStore, failure: unknown): void {
  const { fitViewResolver } = store.getState();
  if (fitViewResolver !== null) {
    store.setState({ fitViewResolver: null });
    fitViewResolver.reject(failure);
  }
}
