import { arrowDelta, nudgeNodes } from "@graphweave/core";
import type { Point } from "@graphweave/core";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";

import type { AriaLabelConfig } from "./aria-label-config.ts";
import type { ReactFlowStore } from "./store-context.ts";

/** Moves the selected nodes with the arrow keys (shift for a bigger step) and announces where they went. */
const DIRECTIONS: ReadonlyMap<string, string> = new Map([
  ["ArrowUp", "up"],
  ["ArrowDown", "down"],
  ["ArrowLeft", "left"],
  ["ArrowRight", "right"],
]);

// Moves the selection by `delta`.
function nudgeSelection(store: ReactFlowStore, delta: Point): void {
  const state = store.getState();
  const selected = [...state.nodeLookup.values()].filter((node) => node.selected === true);
  const config = {
    snapToGrid: state.snapToGrid,
    snapGrid: state.snapGrid,
    nodeExtent: state.nodeExtent,
    threshold: 0,
    zoom: state.viewport.zoom,
    nodeOrigin: state.nodeOrigin,
    onError: state.onError,
  };
  const changes = nudgeNodes(
    state.nodeLookup,
    selected.map((node) => node.id),
    { delta, config, nodesDraggable: state.nodesDraggable },
  );
  state.updateNodePositions(changes);
}

/** Moves the selected nodes with the arrow keys pressed on their frame (shift for a bigger step). */
export function moveSelection(
  store: ReactFlowStore,
  event: ReactKeyboardEvent<HTMLDivElement>,
): void {
  const state = store.getState();
  const delta = arrowDelta(event.key, {
    shift: event.shiftKey,
    snapToGrid: state.snapToGrid,
    snapGrid: state.snapGrid,
  });
  if (delta !== undefined) {
    event.preventDefault();
    nudgeSelection(store, delta);
  }
}

export interface KeyboardMove {
  /** The node whose key was pressed. */
  nodeId: string;
  announce: AriaLabelConfig["node.a11yDescription.ariaLiveMessage"];
}

/**
 * Moves the selected nodes with the arrow keys (shift for a bigger step). The message for screen
 * readers gives the position of the node the key was pressed on as it was before the move, in whole
 * units, which is what React Flow announces.
 */
export function keyboardMove(
  store: ReactFlowStore,
  event: ReactKeyboardEvent<HTMLDivElement>,
  { nodeId, announce }: KeyboardMove,
): void {
  const state = store.getState();
  const delta = arrowDelta(event.key, {
    shift: event.shiftKey,
    snapToGrid: state.snapToGrid,
    snapGrid: state.snapGrid,
  });
  if (delta === undefined) {
    return;
  }
  event.preventDefault();
  const before = state.nodeLookup.get(nodeId)?.internals.positionAbsolute;
  nudgeSelection(store, delta);
  if (before !== undefined) {
    store.setState({
      ariaLiveMessage: announce({
        direction: DIRECTIONS.get(event.key) ?? event.key,
        x: Math.trunc(before.x),
        y: Math.trunc(before.y),
      }),
    });
  }
}
