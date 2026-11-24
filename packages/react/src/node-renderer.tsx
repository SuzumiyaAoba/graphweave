import { rectsIntersect, visibleRect } from "@graphweave/core";
import type { InternalNode, NodeDimensionUpdate, Rect } from "@graphweave/core";
import { useEffect, useMemo } from "react";
import type { ReactElement } from "react";

import { CONTAINER_STYLE } from "./container-style.ts";
import { measureNode } from "./measure.ts";
import { NodeObserverContext, NodeWrapper } from "./node-wrapper.tsx";
import type { NodeObserver } from "./node-wrapper.tsx";
import { shallow } from "./shallow.ts";
import type { ReactFlowState, ReactFlowStore } from "./store-context.ts";
import type { Node } from "./types.ts";
import { useStore, useStoreApi } from "./use-store.ts";

interface ManagedObserver extends NodeObserver {
  disconnect: () => void;
}

// An observer tells about a node once when it starts to watch it, which is when the node has just
// been measured: with the size the store already has, and handles known, there is nothing to take.
// (Taking the handles again would put measured ones over those the owner gave with `handles`, where
// React Flow, which measures once, keeps the owner's.) What it tells later is always taken: a node
// that has been resized has its handles elsewhere, though the store knows its size already.
function isNews(store: ReactFlowStore, update: NodeDimensionUpdate, first: boolean): boolean {
  const known = store.getState().nodeLookup.get(update.id);
  const sameSize =
    known?.measured.width === update.width && known.measured.height === update.height;
  return !first || !sameSize || known.internals.handleBounds === undefined;
}

// One observer for all nodes: when a node's box changes, its size and handles are measured again.
function createObserver(store: ReactFlowStore): ManagedObserver | null {
  if (typeof ResizeObserver === "undefined") {
    return null;
  }
  // The elements the observer has not told about yet.
  const fresh = new WeakSet<Element>();
  const observer = new ResizeObserver((entries) => {
    const { zoom } = store.getState().viewport;
    const updates = entries.flatMap((entry) => {
      const first = fresh.delete(entry.target);
      if (!(entry.target instanceof HTMLElement)) {
        return [];
      }
      const update = measureNode(entry.target, zoom);
      return isNews(store, update, first) ? [update] : [];
    });
    if (updates.length > 0) {
      store.getState().updateNodeDimensions(updates);
    }
  });
  return {
    observe: (element) => {
      fresh.add(element);
      observer.observe(element);
    },
    unobserve: (element) => {
      observer.unobserve(element);
    },
    disconnect: () => {
      observer.disconnect();
    },
  };
}

function useNodeObserver(store: ReactFlowStore): NodeObserver | null {
  const observer = useMemo(() => createObserver(store), [store]);
  useEffect(
    () => (): void => {
      observer?.disconnect();
    },
    [observer],
  );
  return observer;
}

// As React Flow's getNodesInside: a node the flow has no handle bounds for yet is drawn wherever it is,
// so that it gets measured (also one whose size is given), and so is a node being dragged, which goes
// on being dragged when it leaves the screen.
function isNodeOnScreen(node: InternalNode<Node>, view: Rect): boolean {
  if (node.internals.handleBounds === undefined || node.dragging === true) {
    return true;
  }
  const { x, y } = node.internals.positionAbsolute;
  const width = node.measured.width ?? node.width ?? node.initialWidth ?? 0;
  const height = node.measured.height ?? node.height ?? node.initialHeight ?? 0;
  return rectsIntersect({ x, y, width, height }, view);
}

function visibleNodeIds(state: ReactFlowState): string[] {
  const nodes = [...state.nodeLookup.values()].filter((node) => node.hidden !== true);
  if (!state.onlyRenderVisibleElements || state.width <= 0) {
    return nodes.map((node) => node.id);
  }
  const view = visibleRect(state.viewport, { width: state.width, height: state.height });
  return nodes.filter((node) => isNodeOnScreen(node, view)).map((node) => node.id);
}

/** Renders the nodes. Each one re-renders on its own, when it changes. */
export function NodeRenderer(): ReactElement {
  const store = useStoreApi();
  const ids = useStore(visibleNodeIds, shallow);
  const observer = useNodeObserver(store);
  return (
    <div className="react-flow__nodes" style={CONTAINER_STYLE}>
      <NodeObserverContext.Provider value={observer}>
        {ids.map((id) => (
          <NodeWrapper key={id} id={id} />
        ))}
      </NodeObserverContext.Provider>
    </div>
  );
}
