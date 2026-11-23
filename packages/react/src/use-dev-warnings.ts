import { errorMessages } from "@free-flow/core";
import { useEffect, useRef } from "react";

import { inDevelopment } from "./dev-warn.ts";
import type { ViewPropsStore } from "./view-props.ts";

type Types = Readonly<Record<string, unknown>>;

const NO_TYPES: Types = {};

// Tells (code 002, in development) that `nodeTypes` or `edgeTypes` is a new object whose entries
// differ from the last one: it is most likely made again on every render, and the nodes or edges
// would be mounted anew each time.
function useTypesWarning(view: ViewPropsStore, types: Types | undefined): void {
  const current = types ?? NO_TYPES;
  const previous = useRef(current);
  useEffect(() => {
    if (!inDevelopment()) {
      return;
    }
    const keys = new Set([...Object.keys(previous.current), ...Object.keys(current)]);
    if ([...keys].some((key) => previous.current[key] !== current[key])) {
      view.getState().onError?.("002", errorMessages.error002());
    }
    previous.current = current;
  }, [current, view]);
}

// Tells (code 013, in development, once) that the stylesheet is not there: the pane has the
// z-index the stylesheet gives it.
function useStylesWarning(view: ViewPropsStore): void {
  useEffect(() => {
    if (!inDevelopment()) {
      return;
    }
    const pane = document.querySelector(".react-flow__pane");
    if (pane !== null && getComputedStyle(pane).zIndex !== "1") {
      view.getState().onError?.("013", errorMessages.error013());
    }
  }, [view]);
}

/** The warnings React Flow gives while the app is being developed. */
export function useDevWarnings(
  view: ViewPropsStore,
  types: { nodeTypes?: Types | undefined; edgeTypes?: Types | undefined },
): void {
  useTypesWarning(view, types.nodeTypes);
  useTypesWarning(view, types.edgeTypes);
  useStylesWarning(view);
}
