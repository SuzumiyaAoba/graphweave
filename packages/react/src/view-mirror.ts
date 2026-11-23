import type { Viewport } from "@free-flow/core";

import type { AriaLabelConfig } from "./aria-label-config.ts";
import { noop } from "./noop.ts";
import type { PanZoomInstance } from "./pan-zoom-adapter.ts";
import type { SelectionChange } from "./selection-listener.tsx";
import { VIEW_PROP_KEYS } from "./view-props.ts";
import type { ViewProps } from "./view-props.ts";

/**
 * What the flow's store holds besides its own state, for code that reads the store the way it
 * reads React Flow's (`useStore((state) => state.rfId)`): the props the React layer keeps in a store
 * of its own, and a few things of the binding (`panZoom` is there once the flow is shown).
 */
/** A promise and the way to settle it, which a fit that has to wait for the nodes hands out. */
export interface FitViewResolver {
  promise: Promise<boolean>;
  resolve: (done: boolean) => void;
  reject: (reason?: unknown) => void;
}

/** What React Flow's `updateNodeInternals` takes for each node: the element to measure again. */
export interface InternalNodeUpdate {
  id: string;
  nodeElement: HTMLDivElement;
  force?: boolean;
}

export interface ViewMirror extends ViewProps {
  fitViewResolver: FitViewResolver | null;
  /** Called with the selection whenever it changes, by the hooks that listen to it. */
  onSelectionChangeHandlers: ((selection: SelectionChange) => void)[];
  /** Tells what listens through `useOnViewportChange` that a pan or zoom began (or ended). */
  onViewportChangeStart?: ((viewport: Viewport) => void) | undefined;
  onViewportChangeEnd?: ((viewport: Viewport) => void) | undefined;
  /** Measures the nodes again, and fits the view afterwards when `triggerFitView` is set. */
  updateNodeInternals: (
    updates: Map<string, InternalNodeUpdate>,
    params?: { triggerFitView: boolean },
  ) => void;
  lib: "react";
  ariaLabelConfig: AriaLabelConfig;
  domNode: HTMLElement | null;
  panZoom: PanZoomInstance | null;
  paneDragging: boolean;
}

/** The keys that belong to the mirror and not to the flow's own state. */
export const MIRROR_KEYS: ReadonlySet<string> = new Set<string>([
  ...VIEW_PROP_KEYS,
  "ariaLabels",
  "nodesDraggableProp",
  "ariaLabelConfig",
  "lib",
  "domNode",
  "panZoom",
  "paneDragging",
  "updateNodeInternals",
  "fitViewResolver",
  "onSelectionChangeHandlers",
  "onViewportChangeStart",
  "onViewportChangeEnd",
]);

/** The mirror a flow starts with. */
export function initialMirror(view: ViewProps): ViewMirror {
  return {
    ...view,
    ariaLabelConfig: view.ariaLabels,
    lib: "react",
    domNode: null,
    panZoom: null,
    paneDragging: false,
    updateNodeInternals: noop,
    fitViewResolver: null,
    onSelectionChangeHandlers: [],
  };
}

/** What changes in the mirror when the props do. */
export function mirrorUpdate(view: ViewProps): Partial<ViewMirror> {
  return { ...view, ariaLabelConfig: view.ariaLabels };
}
