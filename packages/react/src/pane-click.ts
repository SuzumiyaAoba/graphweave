import type { MouseEvent as ReactMouseEvent } from "react";

import { endClickConnection } from "./handle-click.ts";
import type { PaneDeps } from "./pane-types.ts";

/**
 * A click on the empty canvas: it leaves the connection that clicks on handles began, tells the
 * owner, and clears the selection.
 */
export function paneClicked(deps: PaneDeps, native: MouseEvent, shown: ReactMouseEvent): void {
  const { store, view } = deps;
  endClickConnection(store, view, native);
  view.getState().onPaneClick?.(shown);
  store.getState().resetSelectedElements();
}
