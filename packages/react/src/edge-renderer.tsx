import { getBoundsOfRects, rectsIntersect, visibleRect } from "@free-flow/core";
import type { InternalNode, Rect } from "@free-flow/core";
import type { ReactElement } from "react";

import { EdgeWrapper } from "./edge-wrapper.tsx";
import { MarkerDefinitions } from "./markers.tsx";
import { shallow } from "./shallow.ts";
import type { ReactFlowState } from "./store-context.ts";
import type { Node } from "./types.ts";
import { useStore } from "./use-store.ts";

function boxOf(node: InternalNode<Node>): Rect {
  return {
    x: node.internals.positionAbsolute.x,
    y: node.internals.positionAbsolute.y,
    width: node.measured.width ?? node.width ?? 0,
    height: node.measured.height ?? node.height ?? 0,
  };
}

// An edge is on screen when the box spanned by its two nodes touches the visible area.
function isEdgeOnScreen(
  state: ReactFlowState,
  ends: { source: string; target: string },
  view: Rect,
): boolean {
  const source = state.nodeLookup.get(ends.source);
  const target = state.nodeLookup.get(ends.target);
  return source === undefined || target === undefined
    ? false
    : rectsIntersect(getBoundsOfRects([boxOf(source), boxOf(target)]), view);
}

function visibleEdgeIds(state: ReactFlowState): string[] {
  const edges = state.edges.filter((edge) => edge.hidden !== true);
  if (!state.onlyRenderVisibleElements || state.width <= 0) {
    return edges.map((edge) => edge.id);
  }
  const view = visibleRect(state.viewport, { width: state.width, height: state.height });
  return edges.filter((edge) => isEdgeOnScreen(state, edge, view)).map((edge) => edge.id);
}

/** Draws the edges. Each one re-renders on its own, when it or one of its nodes changes. */
export function EdgeRenderer(): ReactElement {
  const ids = useStore(visibleEdgeIds, shallow);
  return (
    <div className="react-flow__edges">
      <MarkerDefinitions />
      {ids.map((id) => (
        <EdgeWrapper key={id} id={id} />
      ))}
    </div>
  );
}
