import { errorMessages } from "@graphweave/core";
import { useEffect } from "react";

import type { ViewPropsStore } from "./view-props.ts";

/** Tells `onError` about a node or edge type nobody registered, which is drawn as `default` instead. */
export function useUnknownTypeError(
  view: ViewPropsStore,
  kind: "Edge" | "Node",
  type: string | undefined,
): void {
  useEffect(() => {
    if (type !== undefined) {
      view
        .getState()
        .onError?.(
          kind === "Node" ? "003" : "011",
          kind === "Node" ? errorMessages.error003(type) : errorMessages.error011(type),
        );
    }
  }, [kind, type, view]);
}
