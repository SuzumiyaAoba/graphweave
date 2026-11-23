import { rectOverlapArea, visibleRect } from "@free-flow/core";
import type { FocusEvent as ReactFocusEvent } from "react";

import type { ReactFlowStore } from "./store-context.ts";
import type { ViewPropsStore } from "./view-props.ts";

// `:focus-visible` is what tells a focus by keyboard from one by click; an engine that does not know
// the selector says no.
function isFocusVisible(element: Element): boolean {
  try {
    return element.matches(":focus-visible");
  } catch {
    return false;
  }
}

/**
 * `autoPanOnNodeFocus`: when a node that is out of view gets the focus from the keyboard, the viewport
 * centres on it (keeping its zoom), as React Flow does.
 */
export function panToFocusedNode(
  context: { store: ReactFlowStore; view: ViewPropsStore; nodeId: string },
  event: ReactFocusEvent<HTMLElement>,
): void {
  const { store, view, nodeId } = context;
  const node = store.getState().nodeLookup.get(nodeId);
  if (
    node === undefined ||
    !view.getState().autoPanOnNodeFocus ||
    view.getState().disableKeyboardA11y ||
    !isFocusVisible(event.currentTarget)
  ) {
    return;
  }
  const { viewport, width, height } = store.getState();
  const size = {
    width: node.measured.width ?? node.width ?? 0,
    height: node.measured.height ?? node.height ?? 0,
  };
  const { x, y } = node.internals.positionAbsolute;
  const seen = rectOverlapArea({ x, y, ...size }, visibleRect(viewport, { width, height })) > 0;
  if (!seen) {
    // The node's own position, as React Flow centres on it (which is off for a node in a parent).
    store
      .getState()
      .setCenter(node.position.x + size.width / 2, node.position.y + size.height / 2, {
        zoom: viewport.zoom,
      });
  }
}
