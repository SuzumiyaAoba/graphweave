import type { ReactFlowStore } from "./store-context.ts";
import type { ViewPropsStore } from "./view-props.ts";

/** What the pane shows while a gesture is going on. */
export interface PaneUi {
  dragging: boolean;
  selecting: boolean;
}

/** Keys that change what a press on the pane does; the component keeps them current. */
export interface PaneKeys {
  selectionKeyPressed: boolean;
  panActivationKeyPressed: boolean;
}

/** What decides how a press on the pane is understood: the keys held, and whether selecting is on. */
export interface PaneMode extends PaneKeys {
  elementsSelectable: boolean;
}

export interface PaneDeps {
  store: ReactFlowStore;
  view: ViewPropsStore;
  element: HTMLElement;
  keys: () => PaneKeys;
  onUi: (ui: PaneUi) => void;
}
