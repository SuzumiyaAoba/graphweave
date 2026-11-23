import type { FitViewOptions } from "@free-flow/core";

import { handled } from "./handled.ts";
import { motionOf } from "./instance-viewport.ts";
import type { ReactFlowStore } from "./store-context.ts";
import { runViewportChange } from "./viewport-animation.ts";

/**
 * Frames the nodes as the flow starts, gliding there when `fitViewOptions` ask for a duration, as
 * React Flow does. When there is nothing to frame yet the fit waits in the store.
 */
export function fitAtStart(
  store: ReactFlowStore,
  options: FitViewOptions | undefined,
  onError: ((code: string, message: string) => void) | undefined,
): void {
  handled(
    runViewportChange(store, () => store.getState().fitView(options), motionOf(options)),
    (failure) => {
      onError?.("101", `Fitting the view failed: ${String(failure)}`);
    },
  );
}

/**
 * Makes a fit that waits, when the nodes it waits for have been measured already: a fit asked for
 * while the flow was away from the provider that kept its nodes, which nothing else would start
 * once the flow is back (its nodes measure to the sizes they had).
 */
export function fitIfWaiting(store: ReactFlowStore): void {
  const state = store.getState();
  if (state.fitViewQueued && state.nodesInitialized) {
    (state.runQueuedFit ?? state.fitView)(state.fitViewOptions);
  }
}
